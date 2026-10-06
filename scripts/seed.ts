/**
 * 초기 자료 등록: seed/수강신청DB.xlsx → Firestore
 *
 *   npm run seed:emu                 내 컴퓨터 시험장(에뮬레이터)에 등록
 *   npm run seed -- --yes            실제 파이어베이스에 등록
 *   npm run seed -- --dry-run        읽기만 하고 무엇이 등록될지 보여줌
 *   npm run seed -- --yes --overwrite  이미 있는 학생·교사·강좌도 시트 내용으로 덮어씀
 *
 * 여러 번 실행해도 중복으로 등록되지 않는다.
 * - 학생: 학번이 문서 ID
 * - 교사: 코드가 같은 교사가 있으면 같은 교사로 본다
 * - 강좌: 프로그램코드 + 날짜(+같은 날 순번)로 ID를 만든다
 * 기본은 "없는 것만 추가". 대시보드에서 고친 내용을 지우지 않으려고 --overwrite 를 따로 둔다.
 * 신청 인원·썸네일·개별 마감은 --overwrite 여도 건드리지 않는다.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applicationDefault, cert, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import * as XLSX from 'xlsx';
import { DEFAULT_DAY_NOTES, DEFAULT_FIXED_EVENTS, DEFAULT_PERIOD } from '../shared/defaults';
import { formatDate, normalizeName, parseSheetDate, parseSid, parseTimeRange, phoneDigits, timesOverlap } from '../shared/text';
import type { Category, Course } from '../shared/types';

const args = new Set(process.argv.slice(2));
const EMULATOR = args.has('--emulator');
const DRY = args.has('--dry-run');
const OVERWRITE = args.has('--overwrite');
const fileArg = process.argv.find((a) => a.startsWith('--file='));
const FILE = resolve(fileArg ? fileArg.slice(7) : 'seed/수강신청DB.xlsx');

// ───────────────────────── 엑셀 읽기 ─────────────────────────

type Row = Record<string, string>;

function readSheet(wb: XLSX.WorkBook, name: string): Row[] {
  const ws = wb.Sheets[name];
  if (!ws) throw new Error(`시트 "${name}"를 찾을 수 없습니다. 시트 이름: ${wb.SheetNames.join(', ')}`);
  // raw:false → 화면에 보이는 글자 그대로. (장소 "3-1"이 날짜로 바뀌어 저장된 칸도 "3-1"로 읽힌다)
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { raw: false, defval: '' });
  return rows
    .map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.replace(/\s+/g, ''), String(v ?? '').trim()])))
    .filter((r) => Object.values(r).some((v) => v !== ''));
}

function col(row: Row, ...names: string[]): string {
  for (const n of names) {
    const v = row[n.replace(/\s+/g, '')];
    if (v !== undefined) return v;
  }
  return '';
}

const truthy = (v: string) => ['true', 'o', 'y', 'yes', '1', '✓', '✔', 'v'].includes(v.trim().toLowerCase());

// ───────────────────────── 자료 변환 ─────────────────────────

interface SeedStudent { sid: string; name: string; classNo: number; number: number; phone: string }
interface SeedTeacher { name: string; code: string; homeroom: number | null; isAdmin: boolean }
type SeedCourse = Omit<Course, 'count' | 'thumbnailUrl' | 'closeAt' | 'teacherIds'> & { teacherCodes: string[] };

const errors: string[] = [];
const warnings: string[] = [];

function parseStudents(rows: Row[]): SeedStudent[] {
  const seen = new Set<string>();
  const out: SeedStudent[] = [];
  rows.forEach((r, i) => {
    const line = `사전등록학생명단 ${i + 2}행`;
    const p = parseSid(col(r, '학번'));
    const name = normalizeName(col(r, '이름'));
    if (!p) return void errors.push(`${line}: 학번이 5자리 숫자가 아닙니다 ("${col(r, '학번')}")`);
    if (!name) return void errors.push(`${line}: 이름이 비어 있습니다`);
    if (seen.has(p.sid)) return void errors.push(`${line}: 학번 ${p.sid} 이 두 번 나옵니다`);
    seen.add(p.sid);
    out.push({ ...p, name, phone: phoneDigits(col(r, '연락처')) });
  });
  return out;
}

function parseTeachers(rows: Row[]): SeedTeacher[] {
  const seen = new Set<string>();
  const out: SeedTeacher[] = [];
  rows.forEach((r, i) => {
    const line = `사전등록관리자명단 ${i + 2}행`;
    const name = col(r, '이름');
    // 코드는 반드시 문자. 숫자로 읽혀 앞의 0이 빠졌으면 다시 채운다.
    const rawCode = col(r, '코드');
    const code = /^\d{1,4}$/.test(rawCode) ? rawCode.padStart(4, '0') : rawCode;
    const hr = col(r, '담당학급');
    if (!name) return void errors.push(`${line}: 이름이 비어 있습니다`);
    if (!/^\d{4}$/.test(code)) return void errors.push(`${line}: 코드는 4자리 숫자여야 합니다 ("${rawCode}")`);
    if (seen.has(code)) return void errors.push(`${line}: 코드 ${code} 가 두 번 나옵니다`);
    if (hr !== '' && !/^[0-9]$/.test(hr)) return void errors.push(`${line}: 담당학급은 비우거나 0~9 여야 합니다 ("${hr}")`);
    seen.add(code);
    out.push({ name, code, homeroom: hr === '' ? null : Number(hr), isAdmin: /admin/i.test(col(r, '관리권한')) });
  });
  return out;
}

/** P07 전공콘서트 3개 행 → 12.1.=P07, 12.2.(3-9)=P29, 12.2.(대강당)=P30. 시트에서 이미 코드가 다르면 시트 값 사용. */
function remapCode(code: string, date: string, place: string): string {
  if (code !== 'P07' || date !== '2026-12-02') return code;
  return place.replace(/\s/g, '') === '대강당' ? 'P30' : 'P29';
}

function parseCourses(rows: Row[]): SeedCourse[] {
  const out: SeedCourse[] = [];
  rows.forEach((r, i) => {
    const line = `프로그램DB ${i + 2}행`;
    try {
      const category = col(r, '분류') as Category;
      if (category !== '필수' && category !== '선택') throw new Error(`분류는 "필수" 또는 "선택"이어야 합니다 ("${category}")`);
      const date = parseSheetDate(col(r, '수강일'));
      const { start, end } = parseTimeRange(col(r, '시간'));
      const place = col(r, '장소');
      const rawCode = col(r, '프로그램코드');
      if (!rawCode) throw new Error('프로그램코드가 비어 있습니다');
      const capRaw = col(r, '신청가능인원');
      let capacity: number | null;
      if (capRaw.replace(/\s/g, '') === '전교생') capacity = null;
      else if (/^\d+$/.test(capRaw) && Number(capRaw) > 0) capacity = Number(capRaw);
      else throw new Error(`신청 가능 인원은 숫자 또는 "전교생"이어야 합니다 ("${capRaw}")`);
      const name = col(r, '프로그램명');
      if (!name) throw new Error('프로그램명이 비어 있습니다');
      out.push({
        id: '',
        code: remapCode(rawCode, date, place),
        category,
        type: col(r, '유형'),
        name,
        intro: col(r, '프로그램소개'),
        date,
        start,
        end,
        place,
        instructor: col(r, '강사(주최)명', '강사명'),
        capacity,
        selfPay: truthy(col(r, '비용부담')),
        fixedSize: truthy(col(r, '인원고정')),
        order: i + 1,
        // 마지막 열 이름 오타(담딩) / 고친 이름(담당) 둘 다 읽는다. 여러 명이면 쉼표·공백으로 구분.
        teacherCodes: col(r, '담당교사코드', '담딩교사코드')
          .split(/[\s,/;]+/)
          .filter(Boolean)
          .map((c) => (/^\d{1,4}$/.test(c) ? c.padStart(4, '0') : c)),
      });
    } catch (e) {
      errors.push(`${line}: ${(e as Error).message}`);
    }
  });

  // 강좌 ID: 코드-월일, 같은 코드가 같은 날 여러 행이면 -1, -2 …
  const groups = new Map<string, SeedCourse[]>();
  for (const c of out) {
    const k = `${c.code}-${c.date.slice(5).replace('-', '')}`;
    groups.set(k, [...(groups.get(k) ?? []), c]);
  }
  for (const [k, list] of groups) list.forEach((c, i) => (c.id = list.length > 1 ? `${k}-${i + 1}` : k));
  return out;
}

/** 강좌 시간이 고정 일정 초기값과 겹치면 알린다. */
function checkCourses(courses: SeedCourse[]) {
  for (const c of courses) {
    for (const ev of DEFAULT_FIXED_EVENTS) {
      if (ev.date === c.date && timesOverlap(ev, c)) {
        warnings.push(`${formatDate(c.date)} "${c.name}"(${c.start}~${c.end}) 이 고정 일정 "${ev.title}"(${ev.start}~${ev.end}) 과 겹칩니다`);
      }
    }
  }
}

// ───────────────────────── 실행 ─────────────────────────

async function main() {
  if (!existsSync(FILE)) throw new Error(`파일이 없습니다: ${FILE}`);
  const wb = XLSX.read(readFileSync(FILE));
  const students = parseStudents(readSheet(wb, '사전등록학생명단'));
  const teachers = parseTeachers(readSheet(wb, '사전등록관리자명단'));
  const courses = parseCourses(readSheet(wb, '프로그램DB'));
  checkCourses(courses);

  const teacherCodes = new Set(teachers.map((t) => t.code));
  for (const c of courses) {
    for (const code of c.teacherCodes) {
      if (!teacherCodes.has(code)) warnings.push(`강좌 ${c.id} "${c.name}": 담당교사코드 ${code} 인 교사가 명단에 없습니다 (배정하지 않음)`);
    }
  }

  console.log(`\n📄 ${FILE}`);
  console.log(`  학생 ${students.length}명 (연락처 있음 ${students.filter((s) => s.phone).length}명)`);
  console.log(`  교사 ${teachers.length}명 (admin ${teachers.filter((t) => t.isAdmin).length}명)`);
  console.log(`  강좌 ${courses.length}개 / 프로그램 ${new Set(courses.map((c) => c.code)).size}종`);
  const dates = [...new Set(courses.map((c) => c.date))].sort();
  for (const d of dates) {
    const list = courses.filter((c) => c.date === d);
    const cap = list.some((c) => c.capacity === null) ? '제한 없음' : `정원 합계 ${list.reduce((s, c) => s + (c.capacity ?? 0), 0)}명`;
    console.log(`    ${formatDate(d)} ${list[0].category === '필수' ? '필수' : '선택'} ${list.length}개 · ${cap}`);
  }
  for (const w of warnings) console.log(`  ⚠️  ${w}`);
  if (errors.length) {
    for (const e of errors) console.log(`  ❌ ${e}`);
    throw new Error(`엑셀에 고쳐야 할 곳이 ${errors.length}군데 있어 등록하지 않았습니다.`);
  }
  if (DRY) {
    console.log('\n(--dry-run) 읽기만 했습니다. 강좌 ID 목록:');
    for (const c of courses) console.log(`    ${c.id.padEnd(12)} ${c.category} ${c.name} · ${c.place}`);
    return;
  }

  const db = connect();
  await write(db, students, teachers, courses);
}

function connect(): Firestore {
  if (EMULATOR) {
    process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
    initializeApp({ projectId: 'demo-sghs' });
    console.log('\n🧪 에뮬레이터(내 컴퓨터 시험장)에 등록합니다.');
  } else {
    if (!args.has('--yes')) {
      throw new Error('실제 파이어베이스에 등록하려면 --yes 를 붙여 주세요:  npm run seed -- --yes');
    }
    const keyFile = resolve('seed/service-account.json');
    const credential = existsSync(keyFile) ? cert(keyFile) : applicationDefault();
    initializeApp({ credential, projectId: 'sghs-program-app' });
    console.log('\n🔥 실제 파이어베이스(sghs-program-app)에 등록합니다.');
  }
  return getFirestore();
}

async function write(db: Firestore, students: SeedStudent[], teachers: SeedTeacher[], courses: SeedCourse[]) {
  const bw = db.bulkWriter();
  const stat = { stuNew: 0, stuUpd: 0, phone: 0, tNew: 0, tUpd: 0, cNew: 0, cUpd: 0, skipped: 0 };

  // 학생
  const stuExisting = new Set((await db.collection('students').select().get()).docs.map((d) => d.id));
  const secretExisting = new Map((await db.collection('studentSecrets').get()).docs.map((d) => [d.id, phoneDigits(d.get('phone'))]));
  for (const s of students) {
    const exists = stuExisting.has(s.sid);
    if (!exists) {
      bw.set(db.collection('students').doc(s.sid), { sid: s.sid, name: s.name, classNo: s.classNo, number: s.number, photoUrl: null });
      stat.stuNew++;
    } else if (OVERWRITE) {
      bw.set(db.collection('students').doc(s.sid), { sid: s.sid, name: s.name, classNo: s.classNo, number: s.number }, { merge: true });
      stat.stuUpd++;
    } else stat.skipped++;
    // 연락처: 시트에 값이 있을 때만. 대시보드에서 일괄 등록한 연락처를 빈칸으로 지우지 않는다.
    if (s.phone && (!secretExisting.get(s.sid) || OVERWRITE)) {
      // classNo 는 보안 규칙에서 "담임만 연락처 열람"을 판단하는 데 쓴다.
      bw.set(db.collection('studentSecrets').doc(s.sid), { phone: s.phone, classNo: s.classNo }, { merge: true });
      stat.phone++;
    }
  }

  // 교사 — 문서 ID는 코드가 아닌 임의값(코드가 문서 ID로 노출되면 안 되므로)
  const codeToId = new Map((await db.collection('teacherSecrets').get()).docs.map((d) => [String(d.get('code')), d.id]));
  for (const t of teachers) {
    let id = codeToId.get(t.code);
    if (!id) {
      id = db.collection('teachers').doc().id;
      codeToId.set(t.code, id);
      bw.set(db.collection('teachers').doc(id), { id, name: t.name, homeroom: t.homeroom, isAdmin: t.isAdmin, photoUrl: null });
      bw.set(db.collection('teacherSecrets').doc(id), { code: t.code });
      stat.tNew++;
    } else if (OVERWRITE) {
      bw.set(db.collection('teachers').doc(id), { id, name: t.name, homeroom: t.homeroom, isAdmin: t.isAdmin }, { merge: true });
      stat.tUpd++;
    } else stat.skipped++;
  }

  // 강좌
  const courseExisting = new Set((await db.collection('courses').select().get()).docs.map((d) => d.id));
  for (const { teacherCodes, ...c } of courses) {
    const teacherIds = teacherCodes.map((code) => codeToId.get(code)).filter((v): v is string => !!v);
    const ref = db.collection('courses').doc(c.id);
    if (!courseExisting.has(c.id)) {
      const doc: Course = { ...c, teacherIds, count: 0, thumbnailUrl: null, closeAt: null };
      bw.set(ref, doc);
      stat.cNew++;
    } else if (OVERWRITE) {
      bw.set(ref, { ...c, teacherIds }, { merge: true });
      stat.cUpd++;
    } else stat.skipped++;
  }

  // 설정 — 없을 때만
  const cfg = db.collection('config');
  const [tt, period] = await db.getAll(cfg.doc('timetable'), cfg.doc('period'));
  if (!tt.exists) bw.set(cfg.doc('timetable'), { fixedEvents: DEFAULT_FIXED_EVENTS, dayNotes: DEFAULT_DAY_NOTES });
  if (!period.exists) bw.set(cfg.doc('period'), DEFAULT_PERIOD);

  await bw.close();
  console.log('\n✅ 등록 완료');
  console.log(`  학생: 새로 ${stat.stuNew}명, 덮어씀 ${stat.stuUpd}명, 연락처 기록 ${stat.phone}명`);
  console.log(`  교사: 새로 ${stat.tNew}명, 덮어씀 ${stat.tUpd}명`);
  console.log(`  강좌: 새로 ${stat.cNew}개, 덮어씀 ${stat.cUpd}개`);
  if (stat.skipped) console.log(`  이미 있어서 건너뜀: ${stat.skipped}건 (덮어쓰려면 --overwrite)`);
  console.log(`  시간표 기본값: ${tt.exists ? '이미 있음' : '새로 등록'} / 신청 기간: ${period.exists ? '이미 있음' : '새로 등록(닫힘)'}`);
}

main().catch((e) => {
  console.error(`\n❌ ${(e as Error).message}`);
  process.exit(1);
});
