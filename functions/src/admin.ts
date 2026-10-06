// admin 전용 서버 기능
// - adminPublish: 대시보드의 "저장 및 배포". 강좌·교사·학생·신청 기간·시간표 변경을 한 번에 검사하고 반영한다.
//   복사본(신청 문서의 강좌명, 출석부 명단의 담당교사·이름, 출결 열람 교사)도 함께 맞춘다.
// - adminAssign: 수동 배정(추가·변경·삭제). 마감 후에도 가능, 정원 초과는 경고만. 코드 중복·같은 날 선택 규칙은 지킨다.
// - adminRecount: 신청 인원 수를 실제 신청 기록으로 다시 맞춘다.

import { FieldPath, FieldValue, type DocumentData } from 'firebase-admin/firestore';
import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import {
  findOverlaps,
  overlapText,
  validateCourse,
  validatePeriod,
  validateStudent,
  validateTeacher,
  validateTimetable,
  type CourseInput,
  type PublishPayload,
  type StudentInput,
  type TeacherInput,
} from '../../shared/admin';
import { DEFAULT_DAY_NOTES } from '../../shared/defaults';
import { checkPersonalRules, progress, type AppItem, type Application } from '../../shared/rules';
import { parseSid, phoneDigits } from '../../shared/text';
import type { Course, TimetableConfig } from '../../shared/types';
import { auth, db, fail } from './app';
import { refreshAttendanceViewers } from './attendance';
import { shardRef } from './apply';

function requireAdmin(req: CallableRequest): string {
  const t = req.auth?.token;
  if (!t || t.role !== 'teacher' || t.admin !== true) fail('관리자만 할 수 있어요.', 'permission-denied');
  return String(t.tid);
}

const courseCol = () => db.collection('courses');

async function allCourses(): Promise<Map<string, Course>> {
  const snap = await courseCol().get();
  return new Map(snap.docs.map((d) => [d.id, { ...(d.data() as Course), id: d.id }]));
}

async function enrollmentsOf(courseId: string) {
  return (await db.collection('enrollments').where('courseId', '==', courseId).get()).docs;
}

/** 강좌의 정원 칸(count / shards)을 실제 신청 수로 다시 쓴다 */
async function recountCourse(courseId: string, capacity: number | null): Promise<number> {
  const n = (await db.collection('enrollments').where('courseId', '==', courseId).count().get()).data().count;
  const shards = await courseCol().doc(courseId).collection('shards').get();
  const batch = db.batch();
  shards.docs.forEach((d) => batch.delete(d.ref));
  if (capacity === null) {
    batch.set(courseCol().doc(courseId).collection('shards').doc('0'), { count: n });
    batch.update(courseCol().doc(courseId), { count: 0 });
  } else {
    batch.update(courseCol().doc(courseId), { count: n });
  }
  await batch.commit();
  return n;
}

// ───────────────────────── 저장 및 배포 ─────────────────────────

export const adminPublish = onCall({ timeoutSeconds: 300, memory: '512MiB' }, async (req) => {
  requireAdmin(req);
  const p = (req.data ?? {}) as PublishPayload;

  // ── 1) 지금 상태 읽기
  const current = await allCourses();
  const [ttSnap, secretSnap, teacherSnap] = await Promise.all([
    db.doc('config/timetable').get(),
    db.collection('teacherSecrets').get(),
    db.collection('teachers').get(),
  ]);
  const timetable = (p.timetable ?? ttSnap.data() ?? { fixedEvents: [], dayNotes: DEFAULT_DAY_NOTES }) as TimetableConfig;
  const teacherCodes = new Map(secretSnap.docs.map((d) => [d.id, String(d.get('code'))]));
  const teacherDocs = new Map(teacherSnap.docs.map((d) => [d.id, d.data()]));

  // ── 2) 검사 — 하나라도 틀리면 아무것도 쓰지 않는다
  const tUpsert: TeacherInput[] = p.teachers?.upsert ?? [];
  const tRemove = new Set(p.teachers?.remove ?? []);
  for (const t of tUpsert) {
    const e = validateTeacher(t);
    if (e) fail(e, 'invalid-argument');
  }
  const finalCodes = new Map(teacherCodes);
  for (const id of tRemove) finalCodes.delete(id);
  for (const t of tUpsert) finalCodes.set(t.id, t.code);
  const seen = new Map<string, string>();
  for (const [id, code] of finalCodes) {
    if (seen.has(code)) fail(`교사 코드 ${code} 가 두 명에게 겹쳐요. 코드는 모두 달라야 해요.`, 'invalid-argument');
    seen.set(code, id);
  }
  const finalTeacherIds = new Set(finalCodes.keys());

  const cUpsert: CourseInput[] = p.courses?.upsert ?? [];
  const cRemove = new Set(p.courses?.remove ?? []);
  const finalCourses = new Map(current);
  for (const id of cRemove) finalCourses.delete(id);
  for (const c of cUpsert) {
    const e = validateCourse(c);
    if (e) fail(e, 'invalid-argument');
    finalCourses.set(c.id, { ...(current.get(c.id) ?? { count: 0 }), ...c } as Course);
  }
  // 없어지는 교사는 강좌 담당에서도 뺀다
  const touchedCourses = new Set(cUpsert.map((c) => c.id));
  for (const [id, c] of finalCourses) {
    const kept = (c.teacherIds ?? []).filter((t) => finalTeacherIds.has(t));
    if (kept.length !== (c.teacherIds ?? []).length) {
      finalCourses.set(id, { ...c, teacherIds: kept });
      touchedCourses.add(id);
    }
  }

  if (p.timetable) {
    const e = validateTimetable(p.timetable);
    if (e) fail(e, 'invalid-argument');
  }
  if (p.timetable || cUpsert.length) {
    const ov = findOverlaps([...finalCourses.values()], timetable.fixedEvents);
    if (ov.length) fail(`저장하지 않았어요. ${overlapText(ov[0])}${ov.length > 1 ? ` 외 ${ov.length - 1}건` : ''}`, 'failed-precondition');
  }
  if (p.period) {
    const e = validatePeriod(p.period);
    if (e) fail(e, 'invalid-argument');
  }

  const sUpsert: StudentInput[] = p.students?.upsert ?? [];
  const sRemove = new Set(p.students?.remove ?? []);
  for (const s of sUpsert) {
    const e = validateStudent(s);
    if (e) fail(e, 'invalid-argument');
  }

  const summary: string[] = [];
  const revoke = new Set<string>();
  const viewerRefresh = new Set<string>(); // "date|sid"

  // ── 3) 교사
  for (const t of tUpsert) {
    const before = teacherDocs.get(t.id);
    await db.doc(`teachers/${t.id}`).set(
      { id: t.id, name: t.name.trim(), homeroom: t.homeroom, isAdmin: t.isAdmin, ...(before ? {} : { photoUrl: null }) },
      { merge: true },
    );
    await db.doc(`teacherSecrets/${t.id}`).set({ code: t.code });
    // 권한이 바뀌면 로그인을 끊어 새 권한으로 다시 들어오게 한다(화면도 바뀐 것을 알아채고 로그아웃시킨다).
    if (before && (before.homeroom !== t.homeroom || before.isAdmin !== t.isAdmin || teacherCodes.get(t.id) !== t.code)) revoke.add(t.id);
  }
  for (const id of tRemove) {
    await db.doc(`teachers/${id}`).delete();
    await db.doc(`teacherSecrets/${id}`).delete();
    revoke.add(id);
  }
  if (tUpsert.length || tRemove.size) summary.push(`교사 ${tUpsert.length}명 저장 · ${tRemove.size}명 삭제`);

  // ── 4) 강좌
  for (const id of cRemove) {
    const before = current.get(id);
    const enr = await enrollmentsOf(id);
    const bw = db.bulkWriter();
    for (const e of enr) {
      const sid = String(e.get('sid'));
      bw.update(db.doc(`applications/${sid}`), new FieldPath('items', id), FieldValue.delete(), 'submitted', false, 'submittedAt', null, 'updatedAt', Date.now());
      bw.delete(e.ref);
      if (before) viewerRefresh.add(`${before.date}|${sid}`);
    }
    await bw.close();
    await db.recursiveDelete(courseCol().doc(id));
  }
  for (const id of touchedCourses) {
    const next = finalCourses.get(id)!;
    const before = current.get(id);
    const { count: _ignored, ...fields } = next;
    if (!before) {
      await courseCol().doc(id).set({ ...fields, count: 0 });
      continue;
    }
    await courseCol().doc(id).set(fields, { merge: true });

    const copyChanged = before.name !== next.name || before.code !== next.code || before.date !== next.date || before.category !== next.category;
    const teachersChanged = JSON.stringify([...(before.teacherIds ?? [])].sort()) !== JSON.stringify([...next.teacherIds].sort());
    if (copyChanged || teachersChanged) {
      const enr = await enrollmentsOf(id);
      const bw = db.bulkWriter();
      for (const e of enr) {
        const sid = String(e.get('sid'));
        bw.update(e.ref, { teacherIds: next.teacherIds, date: next.date });
        if (copyChanged) {
          bw.update(
            db.doc(`applications/${sid}`),
            new FieldPath('items', id, 'name'), next.name,
            new FieldPath('items', id, 'code'), next.code,
            new FieldPath('items', id, 'date'), next.date,
            new FieldPath('items', id, 'category'), next.category,
          );
        }
        viewerRefresh.add(`${next.date}|${sid}`);
        if (before.date !== next.date) viewerRefresh.add(`${before.date}|${sid}`);
      }
      await bw.close();
    }
    if ((before.capacity === null) !== (next.capacity === null)) await recountCourse(id, next.capacity);
  }
  if (cUpsert.length || cRemove.size) summary.push(`강좌 ${cUpsert.length}개 저장 · ${cRemove.size}개 삭제`);

  // ── 5) 학생
  if (sUpsert.length || sRemove.size) {
    const existing = new Set((await db.collection('students').select().get()).docs.map((d) => d.id));
    for (const s of sUpsert) {
      const { sid, classNo, number } = parseSid(s.sid)!;
      const name = s.name.trim();
      const phone = phoneDigits(s.phone);
      const bw = db.bulkWriter();
      bw.set(db.doc(`students/${sid}`), { sid, name, classNo, number, ...(existing.has(sid) ? {} : { photoUrl: null }) }, { merge: true });
      bw.set(db.doc(`studentSecrets/${sid}`), { phone, classNo });
      if (existing.has(sid)) {
        // 이름 복사본(신청 문서·출석부 명단)도 맞춘다
        const app = await db.doc(`applications/${sid}`).get();
        if (app.exists && app.get('name') !== name) bw.update(app.ref, { name });
        for (const e of (await db.collection('enrollments').where('sid', '==', sid).get()).docs) {
          if (e.get('name') !== name) bw.update(e.ref, { name });
        }
      }
      await bw.close();
    }
    for (const sid of sRemove) {
      const app = (await db.doc(`applications/${sid}`).get()).data() as Application | undefined;
      const bw = db.bulkWriter();
      for (const [cid, it] of Object.entries(app?.items ?? {})) {
        const c = current.get(cid);
        if (c?.capacity === null) bw.set(shardRef(cid), { count: FieldValue.increment(-1) }, { merge: true });
        else if (c) bw.update(courseCol().doc(cid), { count: FieldValue.increment(-1) });
        bw.delete(db.doc(`enrollments/${cid}__${sid}`));
        viewerRefresh.add(`${it.date}|${sid}`);
      }
      bw.delete(db.doc(`applications/${sid}`));
      bw.delete(db.doc(`students/${sid}`));
      bw.delete(db.doc(`studentSecrets/${sid}`));
      await bw.close();
    }
    summary.push(`학생 ${sUpsert.length}명 저장 · ${sRemove.size}명 삭제`);
  }

  // ── 6) 신청 기간 · 시간표
  if (p.period) {
    await db.doc('config/period').set(p.period);
    summary.push('신청 일정 저장');
  }
  if (p.timetable) {
    await db.doc('config/timetable').set(p.timetable);
    summary.push('시간표 저장');
  }

  // ── 7) 뒷정리: 출결 열람 교사, 바뀐 교사 로그인 끊기
  for (const key of viewerRefresh) {
    const [date, sid] = key.split('|');
    await refreshAttendanceViewers(date, sid);
  }
  for (const id of revoke) {
    await auth.revokeRefreshTokens(`t_${id}`).catch(() => undefined); // 한 번도 로그인 안 한 교사는 계정이 없다
  }
  return { ok: true, summary };
});

// ───────────────────────── 수동 배정 ─────────────────────────

export const adminAssign = onCall(async (req) => {
  requireAdmin(req);
  const { sid: rawSid, add, remove } = (req.data ?? {}) as { sid?: unknown; add?: unknown; remove?: unknown };
  const parsed = parseSid(rawSid);
  if (!parsed) fail('학번이 올바르지 않아요.', 'invalid-argument');
  const sid = parsed.sid;
  const addId = typeof add === 'string' && add ? add : null;
  const removeId = typeof remove === 'string' && remove ? remove : null;
  if (!addId && !removeId) fail('추가하거나 뺄 강좌를 골라 주세요.', 'invalid-argument');

  const courses = [...(await allCourses()).values()];
  const appRef = db.doc(`applications/${sid}`);

  const res = await db.runTransaction(async (tx) => {
    const reads = [appRef, db.doc(`students/${sid}`), ...(addId ? [courseCol().doc(addId)] : []), ...(removeId ? [courseCol().doc(removeId)] : [])];
    const snaps = await tx.getAll(...reads);
    const [appSnap, stuSnap] = snaps;
    const addSnap = addId ? snaps[2] : null;
    const removeSnap = removeId ? snaps[addId ? 3 : 2] : null;
    if (!stuSnap.exists) fail('학생 명단에 없는 학번이에요.', 'not-found');
    const stu = stuSnap.data() as DocumentData;
    const items: Record<string, AppItem> = { ...((appSnap.data() as Application | undefined)?.items ?? {}) };
    const now = Date.now();
    let warning: string | null = null;
    const dates: string[] = [];

    if (removeId) {
      if (!items[removeId]) fail('그 학생이 신청하지 않은 강좌예요.', 'failed-precondition');
      dates.push(items[removeId].date);
      const rc = removeSnap?.exists ? ({ ...(removeSnap.data() as Course), id: removeId }) : null;
      if (rc) {
        if (rc.capacity !== null) tx.update(courseCol().doc(removeId), { count: Math.max(0, rc.count - 1) });
        else tx.set(shardRef(removeId), { count: FieldValue.increment(-1) }, { merge: true });
      }
      tx.delete(db.doc(`enrollments/${removeId}__${sid}`));
      delete items[removeId];
    }
    if (addId) {
      if (!addSnap?.exists) fail('없는 강좌예요.', 'not-found');
      const c = { ...(addSnap.data() as Course), id: addId };
      // admin 도 코드 중복·같은 날 선택 1개 규칙은 어길 수 없다(변경이면 빠질 강좌는 제외하고 검사)
      const rule = checkPersonalRules(c, items);
      if (rule) fail(rule.message, 'failed-precondition', rule.code);
      if (c.capacity !== null) {
        if (c.count >= c.capacity) warning = `정원을 넘었어요 (${c.count + 1}/${c.capacity}명)`;
        tx.update(courseCol().doc(addId), { count: c.count + 1 });
      } else {
        tx.set(shardRef(addId), { count: FieldValue.increment(1) }, { merge: true });
      }
      items[addId] = { name: c.name, code: c.code, date: c.date, category: c.category, at: now, by: 'admin' };
      tx.set(db.doc(`enrollments/${addId}__${sid}`), {
        courseId: addId,
        sid,
        name: String(stu.name ?? ''),
        classNo: parsed.classNo,
        number: parsed.number,
        photoUrl: stu.photoUrl ?? null,
        date: c.date,
        teacherIds: c.teacherIds ?? [],
        at: now,
      });
      dates.push(c.date);
    }
    const wasSubmitted = (appSnap.data() as Application | undefined)?.submitted === true;
    // 빠진 것이 생기면 제출 상태를 풀고, 다 채워져도 자동 제출은 하지 않는다
    const stillComplete = progress(courses, items).complete;
    tx.set(appRef, {
      sid,
      classNo: parsed.classNo,
      number: parsed.number,
      name: String(stu.name ?? ''),
      items,
      submitted: wasSubmitted && stillComplete,
      submittedAt: wasSubmitted && stillComplete ? (appSnap.get('submittedAt') ?? null) : null,
      updatedAt: now,
    });
    return { warning, dates };
  });

  for (const d of new Set(res.dates)) await refreshAttendanceViewers(d, sid);
  return { ok: true, warning: res.warning };
});

// ───────────────────────── 인원 수 다시 맞추기 ─────────────────────────

export const adminRecount = onCall({ timeoutSeconds: 120 }, async (req) => {
  requireAdmin(req);
  const courses = await allCourses();
  const fixed: string[] = [];
  for (const c of courses.values()) {
    const before = c.capacity === null
      ? (await courseCol().doc(c.id).collection('shards').get()).docs.reduce((s, d) => s + Number(d.get('count') ?? 0), 0)
      : c.count;
    const after = await recountCourse(c.id, c.capacity);
    if (before !== after) fixed.push(`${c.name}(${c.date.slice(5)}) ${before}→${after}`);
  }
  return { ok: true, fixed };
});
