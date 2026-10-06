/**
 * 동시 접속 시험: 신청이 열리는 순간 250명이 한꺼번에 누르는 상황.
 *
 *   npm run test:load                       에뮬레이터(내 컴퓨터 시험장)
 *   npm run test:load -- --prod --yes       실제 서버(배포 후, 학생에게 열기 전에만!)
 *
 * 1) 정원 10명 강좌에 250명 동시 신청 → 정확히 10명만 성공해야 한다.
 * 2) 정원 없는 강좌에 250명 동시 신청 → 250명 모두 성공, 인원 수 250.
 * 3) 같은 학생이 버튼을 5번 연타 → 신청은 한 번만.
 * 학생 화면과 같은 방식으로 일시 오류는 최대 3번 다시 시도한다.
 *
 * - 에뮬레이터: 기존 강좌(P27-1209 정원 10, P01-1130 정원 없음)로 시험. 에뮬레이터는 잠금 처리가 실제보다 훨씬 느려서
 *   "걸린 시간"과 연결 끊김은 참고만 하고, 정원·인원 수가 정확한지를 본다.
 * - 실서버: 임시 시험 강좌 2개와 가짜 학번(명단에 없는 61~88번)으로 시험하고, 끝나면 모두 지우고 신청 기간을 되돌린다.
 *   seed/service-account.json 과 .env.production.local(VITE_FIREBASE_API_KEY) 이 필요하다.
 * 결과는 scripts/out/load-test.json 에 남긴다.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

const PROD = process.argv.includes('--prod');
if (PROD && !process.argv.includes('--yes')) {
  console.error('실제 서버 시험은 신청 기간을 잠깐 열고 시험 강좌를 만들어요. 학생에게 열기 전에만 --prod --yes 로 실행해 주세요.');
  process.exit(1);
}
const N = 250;
const RETRYABLE = new Set(['UNAVAILABLE', 'DEADLINE_EXCEEDED', 'ABORTED', 'INTERNAL', 'NETWORK']);

// ───────── 연결 ─────────
let apiKey = 'demo';
let FN = 'http://127.0.0.1:5001/demo-sghs/asia-northeast3';
let AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
if (PROD) {
  if (!existsSync('seed/service-account.json')) throw new Error('seed/service-account.json 이 없어요(README 참고).');
  const env = existsSync('.env.production.local') ? readFileSync('.env.production.local', 'utf8') : '';
  apiKey = env.match(/^VITE_FIREBASE_API_KEY=(.+)$/m)?.[1]?.trim() ?? '';
  if (!apiKey) throw new Error('.env.production.local 에 VITE_FIREBASE_API_KEY 가 없어요.');
  initializeApp({ credential: cert('seed/service-account.json'), projectId: 'sghs-program-app' });
  FN = 'https://asia-northeast3-sghs-program-app.cloudfunctions.net';
  AUTH = 'https://identitytoolkit.googleapis.com/v1';
} else {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  initializeApp({ projectId: 'demo-sghs' });
}
const db: Firestore = getFirestore();

async function token(sid: string): Promise<string> {
  const custom = await getAuth().createCustomToken(`s_${sid}`, { role: 'student', sid, classNo: Number(sid.slice(1, 3)), qa: 'loadtest' });
  const res = await fetch(`${AUTH}/accounts:signInWithCustomToken?key=${apiKey}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: custom, returnSecureToken: true }),
  });
  return ((await res.json()) as { idToken: string }).idToken;
}

interface Res {
  result?: { ok?: boolean };
  error?: { status: string; message?: string; details?: { reason?: string } };
}
async function callOnce(tk: string, name: string, data: unknown): Promise<Res> {
  try {
    const res = await fetch(`${FN}/${name}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${tk}` },
      body: JSON.stringify({ data }),
    });
    const body = (await res.json().catch(() => null)) as Res | null;
    return body?.result || body?.error ? body : { error: { status: 'NETWORK', message: `HTTP ${res.status}` } };
  } catch (e) {
    return { error: { status: 'NETWORK', message: (e as Error).message } };
  }
}
/** 학생 화면(src/lib/call.ts)과 같은 재시도 */
async function callLikeClient(tk: string, name: string, data: unknown) {
  const t0 = performance.now();
  let retries = 0;
  for (;;) {
    const r = await callOnce(tk, name, data);
    if (r.error && RETRYABLE.has(r.error.status) && retries < 3) {
      retries++;
      await new Promise((ok) => setTimeout(ok, 300 * 2 ** (retries - 1) + Math.random() * 300));
      continue;
    }
    return { r, ms: performance.now() - t0, retries };
  }
}

let failed = 0;
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const pct = (xs: number[], p: number) => Math.round([...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor((p / 100) * xs.length))]);

// ───────── 준비 ─────────
const sids: string[] = [];
for (let c = 1; c <= 9 && sids.length < N; c++) for (let n = PROD ? 61 : 1; n <= (PROD ? 88 : 28) && sids.length < N; n++) sids.push(`3${String(c).padStart(2, '0')}${String(n).padStart(2, '0')}`);

const CAP = PROD ? 'LOADTEST-CAP10' : 'P27-1209';
const FREE = PROD ? 'LOADTEST-FREE' : 'P01-1130';
const TAP = PROD ? 'LOADTEST-TAP' : 'P11-1202'; // 위 두 강좌와 다른 날짜(같은 날 선택 1개 규칙에 걸리지 않게)
const periodBefore = (await db.doc('config/period').get()).data();

async function cleanup() {
  const bw = db.bulkWriter();
  for (const cid of [CAP, FREE, TAP]) {
    for (const d of (await db.collection('enrollments').where('courseId', '==', cid).get()).docs) bw.delete(d.ref);
  }
  for (const sid of sids) bw.delete(db.doc(`applications/${sid}`));
  await bw.close();
  if (PROD) {
    for (const cid of [CAP, FREE, TAP]) await db.recursiveDelete(db.doc(`courses/${cid}`));
    if (periodBefore) await db.doc('config/period').set(periodBefore);
  } else {
    for (const cid of [CAP, TAP]) await db.doc(`courses/${cid}`).update({ count: 0 });
    await db.recursiveDelete(db.collection(`courses/${FREE}/shards`));
  }
}

await cleanup();
if (PROD) {
  const base = { type: '체험', intro: '동시 접속 시험용(자동 삭제)', start: '09:00', end: '10:00', place: '시험', instructor: '', selfPay: false, fixedSize: false, teacherIds: [], thumbnailUrl: null, closeAt: null, order: 999, count: 0 };
  await db.doc(`courses/${CAP}`).set({ ...base, id: CAP, code: 'LT1', category: '선택', name: '[시험] 정원 10', date: '2026-12-11', capacity: 10 });
  await db.doc(`courses/${FREE}`).set({ ...base, id: FREE, code: 'LT2', category: '선택', name: '[시험] 정원 없음', date: '2026-12-08', capacity: null });
  await db.doc(`courses/${TAP}`).set({ ...base, id: TAP, code: 'LT3', category: '선택', name: '[시험] 연타', date: '2026-12-07', capacity: 30 });
}
await db.doc('config/period').set({ mode: 'open', openAt: null, closeAt: null });

console.log(`${PROD ? '🔥 실서버' : '🧪 에뮬레이터'} · 학생 ${N}명 로그인 토큰 만드는 중…`);
const tokens: string[] = [];
for (let i = 0; i < N; i += 25) tokens.push(...(await Promise.all(sids.slice(i, i + 25).map(token))));
const report: Record<string, unknown> = { at: new Date().toISOString(), target: PROD ? 'production' : 'emulator', students: N };

async function burst(label: string, courseId: string) {
  console.log(`\n▶ ${label}: ${N}명이 동시에 신청`);
  const t0 = performance.now();
  const res = await Promise.all(tokens.map((t) => callLikeClient(t, 'applyCourse', { courseId })));
  const ok = res.filter((x) => x.r.result?.ok).length;
  const full = res.filter((x) => x.r.error?.details?.reason === 'FULL').length;
  const other = res.filter((x) => !x.r.result?.ok && x.r.error?.details?.reason !== 'FULL');
  const ms = res.map((x) => x.ms);
  const summary = {
    성공: ok,
    정원마감: full,
    기타실패: other.length,
    기타실패_내용: [...new Set(other.map((x) => `${x.r.error?.status}: ${x.r.error?.message ?? ''}`))].slice(0, 3),
    재시도_총횟수: res.reduce((s, x) => s + x.retries, 0),
    응답시간_ms: { 중간값: pct(ms, 50), 상위5퍼: pct(ms, 95), 최대: Math.round(Math.max(...ms)) },
    전체_ms: Math.round(performance.now() - t0),
  };
  console.log(summary);
  report[label] = summary;
  return { ok, full, other: other.length };
}

const a = await burst('정원10명_강좌', CAP);
const cap = (await db.doc(`courses/${CAP}`).get()).data()!;
const capEnr = (await db.collection('enrollments').where('courseId', '==', CAP).count().get()).data().count;
check('정원 10명 강좌: 정원 초과 0명(정확히 10명)', a.ok === 10 && cap.count === 10 && capEnr === 10, `성공 ${a.ok} · 인원 수 ${cap.count} · 출석부 ${capEnr}`);
check('나머지는 "정원 마감" 또는 "다시 눌러 주세요" 안내', a.ok + a.full + a.other === N, `마감 ${a.full} · 기타 ${a.other}`);
if (a.other) console.log(`   ℹ️ 기타 ${a.other}건은 학생 화면에서 "신청자가 몰리고 있어요. 다시 눌러 주세요"로 보이고, 다시 누르면 "마감"이 떠요.`);

const b = await burst('정원없는_강좌', FREE);
const shards = await db.collection(`courses/${FREE}/shards`).get();
const total = shards.docs.reduce((s, d) => s + Number(d.get('count')), 0);
check('정원 없는 강좌: 250명 모두 성공', b.ok === N && total === N, `성공 ${b.ok} · 인원 수(나눠 센 합) ${total}`);
check('인원 수를 여러 칸에 나눠 셈(한 문서에 몰리지 않음)', shards.size > 1, `${shards.size}칸`);

const taps = await Promise.all(Array.from({ length: 5 }, () => callLikeClient(tokens[0], 'applyCourse', { courseId: TAP })));
const tap = (await db.doc(`courses/${TAP}`).get()).data()!;
check('같은 학생 5번 연타 → 신청은 1번', taps.every((x) => x.r.result?.ok) && tap.count === 1, `인원 수 ${tap.count}`);

mkdirSync('scripts/out', { recursive: true });
writeFileSync('scripts/out/load-test.json', JSON.stringify(report, null, 2));
await cleanup();
if (!PROD && periodBefore) await db.doc('config/period').set(periodBefore);
console.log('\n결과 파일: scripts/out/load-test.json (시험 자료는 지웠어요)');
console.log(failed ? `❌ ${failed}개 실패` : '🎉 동시 접속 시험 통과');
process.exit(failed ? 1 : 0);
