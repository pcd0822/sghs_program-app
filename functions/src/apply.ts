// 학생 수강신청 · 취소 · 제출. 모든 판정은 여기서 하고, 쓰기는 트랜잭션 하나로 묶는다.
//
// 동시 접속 설계
// - 학생별 신청 문서(applications/{학번}) 하나를 트랜잭션에서 읽는다 → 같은 학생의 연타·중복 요청은 차례대로 처리된다.
// - 정원 있는 강좌: 강좌 문서의 count 를 읽고 +1. 정원을 한 명도 넘지 않는다.
// - 정원 없는 강좌(전교생 필수): 강좌 문서에는 쓰지 않고 shards/0~9 중 하나를 증가 연산으로 갱신한다 → 217명이 몰려도 한 문서에 쓰기가 몰리지 않는다.

import { FieldPath, FieldValue, type DocumentReference } from 'firebase-admin/firestore';
import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { COUNTER_SHARDS } from '../../shared/constants';
import { checkPersonalRules, checkWindow, missingText, progress, type AppItem, type Application } from '../../shared/rules';
import { formatDate } from '../../shared/text';
import type { Course, PeriodConfig } from '../../shared/types';
import { db, fail } from './app';
import { refreshAttendanceViewers } from './attendance';

function requireStudent(req: CallableRequest): { sid: string; classNo: number } {
  const t = req.auth?.token;
  if (!t || t.role !== 'student' || typeof t.sid !== 'string') fail('다시 로그인해 주세요.', 'unauthenticated');
  return { sid: t.sid, classNo: Number(t.classNo) };
}

function readCourseId(data: unknown): string {
  const id = (data as { courseId?: unknown } | null)?.courseId;
  if (typeof id !== 'string' || !/^[\w-]{1,64}$/.test(id)) fail('강좌를 다시 선택해 주세요.', 'invalid-argument');
  return id;
}

const refs = (sid: string, courseId: string) => ({
  app: db.collection('applications').doc(sid),
  course: db.collection('courses').doc(courseId),
  period: db.collection('config').doc('period'),
  student: db.collection('students').doc(sid),
  enrollment: db.collection('enrollments').doc(`${courseId}__${sid}`),
});

export const shardRef = (courseId: string): DocumentReference =>
  db.collection('courses').doc(courseId).collection('shards').doc(String(Math.floor(Math.random() * COUNTER_SHARDS)));

const TX = { maxAttempts: 10 };

export const applyCourse = onCall(async (req) => {
  const { sid, classNo } = requireStudent(req);
  const courseId = readCourseId(req.data);
  const confirmSelfPay = (req.data as { confirmSelfPay?: unknown }).confirmSelfPay === true;
  const r = refs(sid, courseId);

  const res = await db.runTransaction(async (tx) => {
    const [appSnap, courseSnap, periodSnap, stuSnap] = await tx.getAll(r.app, r.course, r.period, r.student);
    if (!courseSnap.exists) fail('없어진 강좌예요. 목록을 새로 확인해 주세요.', 'not-found', 'NOT_FOUND');
    const course = { ...(courseSnap.data() as Course), id: courseId };
    const now = Date.now();

    const win = checkWindow(periodSnap.data() as PeriodConfig | undefined, course, now);
    if (win) fail(win.message, 'failed-precondition', win.code);

    const items = (appSnap.data() as Application | undefined)?.items ?? {};
    // 같은 요청이 두 번 도착한 경우(연타·재시도): 이미 신청돼 있으면 성공으로 본다.
    if (items[courseId]) return { already: true, date: course.date };

    const rule = checkPersonalRules(course, items);
    if (rule) fail(rule.message, 'failed-precondition', rule.code);
    if (course.selfPay && !confirmSelfPay) {
      fail('자부담 강좌예요. 확인 후 다시 신청해 주세요.', 'failed-precondition', 'SELF_PAY_CONFIRM');
    }

    if (course.capacity !== null) {
      if (course.count >= course.capacity) fail('아쉽게도 정원이 다 찼어요.', 'failed-precondition', 'FULL');
      tx.update(r.course, { count: course.count + 1 });
    } else {
      tx.set(shardRef(courseId), { count: FieldValue.increment(1) }, { merge: true });
    }

    const stu = stuSnap.data() ?? {};
    const item: AppItem = { name: course.name, code: course.code, date: course.date, category: course.category, at: now, by: 'student' };
    tx.set(
      r.app,
      {
        sid,
        classNo,
        number: Number(stu.number ?? Number(sid.slice(3))),
        name: String(stu.name ?? ''),
        items: { [courseId]: item },
        submitted: false,
        submittedAt: null,
        updatedAt: now,
      },
      { merge: true },
    );
    tx.set(r.enrollment, {
      courseId,
      sid,
      name: String(stu.name ?? ''),
      classNo,
      number: Number(stu.number ?? 0),
      photoUrl: stu.photoUrl ?? null,
      date: course.date,
      teacherIds: course.teacherIds ?? [],
      at: now,
    });
    return { already: false, date: course.date };
  }, TX);
  // 이미 출결 기록이 있는 날이면 담당 교사 출석부에도 보이도록 열람 교사 목록을 맞춘다.
  if (!res.already) await refreshAttendanceViewers(res.date, sid);
  return { ok: true, already: res.already };
});

export const cancelCourse = onCall(async (req) => {
  const { sid } = requireStudent(req);
  const courseId = readCourseId(req.data);
  const r = refs(sid, courseId);

  const res = await db.runTransaction(async (tx) => {
    const [appSnap, courseSnap, periodSnap] = await tx.getAll(r.app, r.course, r.period);
    const items = (appSnap.data() as Application | undefined)?.items ?? {};
    if (!items[courseId]) return { already: true, date: '' };

    const course = courseSnap.exists ? { ...(courseSnap.data() as Course), id: courseId } : null;
    const now = Date.now();
    const win = checkWindow(periodSnap.data() as PeriodConfig | undefined, course, now);
    if (win) fail(win.message.replace('신청이', '신청·취소가'), 'failed-precondition', win.code);

    if (course) {
      if (course.capacity !== null) tx.update(r.course, { count: Math.max(0, course.count - 1) });
      else tx.set(shardRef(courseId), { count: FieldValue.increment(-1) }, { merge: true });
    }
    // 취소하면 제출 상태가 "미제출"로 돌아간다.
    tx.update(r.app, new FieldPath('items', courseId), FieldValue.delete(), 'submitted', false, 'submittedAt', null, 'updatedAt', now);
    tx.delete(r.enrollment);
    return { already: false, date: items[courseId].date };
  }, TX);
  if (!res.already) await refreshAttendanceViewers(res.date, sid);
  return { ok: true, already: res.already };
});

export const submitApplication = onCall(async (req) => {
  const { sid } = requireStudent(req);
  // 강좌 목록은 트랜잭션 밖에서 읽는다(40여 개 문서에 잠금을 걸지 않으려고).
  const courses = (await db.collection('courses').get()).docs.map((d) => ({ ...(d.data() as Course), id: d.id }));
  const appRef = db.collection('applications').doc(sid);
  const periodRef = db.collection('config').doc('period');

  return db.runTransaction(async (tx) => {
    const [appSnap, periodSnap] = await tx.getAll(appRef, periodRef);
    const now = Date.now();
    const win = checkWindow(periodSnap.data() as PeriodConfig | undefined, null, now);
    if (win) fail(win.message, 'failed-precondition', win.code);

    const app = appSnap.data() as Application | undefined;
    const p = progress(courses, app?.items ?? {});
    if (!p.complete) {
      fail(`아직 신청하지 않은 강좌가 있어요: ${p.missing.map((m) => missingText(m, formatDate)).join(', ')}`, 'failed-precondition', 'INCOMPLETE');
    }
    if (app?.submitted) return { ok: true, already: true };
    tx.update(appRef, { submitted: true, submittedAt: now, updatedAt: now });
    return { ok: true, already: false };
  }, TX);
});
