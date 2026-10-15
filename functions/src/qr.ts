// 출석 QR: 강좌마다 시작 QR·종료 QR 두 개. 학생이 휴대폰 기본 카메라로 찍으면 앱 주소가 열리고,
// 그 브라우저에 로그인된 본인 계정으로만 체크된다(학번을 입력받지 않는다 → 남의 출석을 대신 못 찍음).
// - QR 안에는 강좌ID·시작/종료·비밀값이 들어 있다. 비밀값은 courseQr/{강좌ID} 에만 있고 학생은 못 읽는다.
// - QR 은 이미지로 저장할 수 있으므로, 교사가 QR 을 켠 동안(최대 QR_OPEN_MS)만 통한다.
// - 찍은 시각은 수강 기록(enrollments)에 남긴다 → 출석부 실시간 화면에 바로 보이고 따로 복사본을 두지 않는다.
// - 둘 다 찍어야 "QR 완료". 미완료 학생을 결과로 바꾸는 건 교사가 버튼(markQrIncomplete)으로 한다.

import { randomBytes } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { QR_OPEN_MS } from '../../shared/constants';
import { canUseQr, type Course, type CourseQr, type QrPhase } from '../../shared/types';
import { db, fail } from './app';
import { attendanceId, viewerTeachersFor } from './attendance';

const newKey = () => randomBytes(16).toString('base64url');
const qrRef = (courseId: string) => db.collection('courseQr').doc(courseId);
const isPhase = (v: unknown): v is QrPhase => v === 'start' || v === 'end';
const phaseText = (p: QrPhase) => (p === 'start' ? '시작' : '종료');

function readCourseId(v: unknown): string {
  if (typeof v !== 'string' || !/^[\w-]{1,64}$/.test(v)) fail('강좌를 다시 선택해 주세요.', 'invalid-argument');
  return v;
}

async function requireQrTeacher(req: CallableRequest, courseId: string) {
  const t = req.auth?.token;
  if (!t || t.role !== 'teacher' || typeof t.tid !== 'string') fail('교사로 로그인해 주세요.', 'unauthenticated');
  const course = (await db.collection('courses').doc(courseId).get()).data() as Course | undefined;
  if (!course) fail('없어진 강좌예요.', 'not-found');
  if (!canUseQr(t, course.teacherIds)) fail('이 강좌의 출석 QR을 열 권한이 없어요.', 'permission-denied');
  return { t, course };
}

/** 교사: QR 만들기(처음 한 번) · 켜기 · 끄기 */
export const qrControl = onCall(async (req) => {
  const { courseId: rawId, action, phase } = (req.data ?? {}) as Record<string, unknown>;
  const courseId = readCourseId(rawId);
  if (action !== 'ensure' && action !== 'open' && action !== 'close') fail('요청이 올바르지 않아요.', 'invalid-argument');
  if (action !== 'ensure' && !isPhase(phase)) fail('시작/종료를 골라 주세요.', 'invalid-argument');
  const { t } = await requireQrTeacher(req, courseId);
  const ref = qrRef(courseId);

  if (action === 'ensure') {
    // 처음 열 때만 비밀값을 만든다. 이미 있으면 그대로(저장해 둔 QR 이미지가 계속 쓸 수 있게).
    await db.runTransaction(async (tx) => {
      if ((await tx.get(ref)).exists) return;
      const doc: CourseQr = { startKey: newKey(), endKey: newKey(), startOpenUntil: null, endOpenUntil: null };
      tx.set(ref, doc);
    });
    return { ok: true };
  }

  const snap = await ref.get();
  if (!snap.exists) fail('QR을 먼저 만들어 주세요.', 'failed-precondition');
  const teacher = (await db.collection('teachers').doc(t.tid).get()).data();
  const now = Date.now();
  const until = action === 'open' ? now + QR_OPEN_MS : null;
  await ref.update({ [`${phase}OpenUntil`]: until, updatedByName: String(teacher?.name ?? ''), updatedAt: now });
  return { ok: true, openUntil: until };
});

/** 학생: QR 을 찍어 열린 주소에서 부른다. 로그인된 본인만 체크된다. */
export const qrCheckin = onCall(async (req) => {
  const t = req.auth?.token;
  if (!t || t.role !== 'student' || typeof t.sid !== 'string') fail('학생 계정으로 로그인해 주세요.', 'unauthenticated');
  const { courseId: rawId, phase, key } = (req.data ?? {}) as Record<string, unknown>;
  const courseId = readCourseId(rawId);
  if (!isPhase(phase) || typeof key !== 'string' || key.length > 64) fail('올바른 출석 QR이 아니에요.', 'invalid-argument');

  const enrRef = db.collection('enrollments').doc(`${courseId}__${t.sid}`);
  const [qrSnap, enrSnap] = await db.getAll(qrRef(courseId), enrRef);
  const qr = qrSnap.data() as CourseQr | undefined;
  if (!qr || (phase === 'start' ? qr.startKey : qr.endKey) !== key) fail('올바른 출석 QR이 아니에요.', 'invalid-argument', 'BAD_KEY');

  const field = phase === 'start' ? 'qrStartAt' : 'qrEndAt';
  const now = Date.now();
  // 이미 찍었으면 처음 시각을 그대로 둔다(두 번 찍어도 성공으로 본다). QR 이 꺼진 뒤 다시 찍어도 기록은 남아 있다.
  if (enrSnap.exists && typeof enrSnap.get(field) === 'number') {
    return { ok: true, already: true, at: enrSnap.get(field) as number, phase, other: enrSnap.get(phase === 'start' ? 'qrEndAt' : 'qrStartAt') ?? null };
  }
  const openUntil = phase === 'start' ? qr.startOpenUntil : qr.endOpenUntil;
  if (!openUntil || openUntil < now) {
    fail(`지금은 ${phaseText(phase)} 출석을 받지 않아요. 선생님이 QR을 열어 주시면 다시 찍어 주세요.`, 'failed-precondition', 'CLOSED');
  }
  if (!enrSnap.exists) fail('이 강좌를 신청한 학생만 출석 체크할 수 있어요.', 'permission-denied', 'NOT_ENROLLED');

  await enrRef.update({ [field]: now });
  return { ok: true, already: false, at: now, phase, other: enrSnap.get(phase === 'start' ? 'qrEndAt' : 'qrStartAt') ?? null };
});

/** 교사: 시작·종료 QR 을 다 찍지 않은 수강생을 한 번에 "결과"로 바꾼다(이미 결과인 학생은 그대로). */
export const markQrIncomplete = onCall(async (req) => {
  const courseId = readCourseId((req.data as { courseId?: unknown } | null)?.courseId);
  const { t, course } = await requireQrTeacher(req, courseId);
  // 출결을 바꾸는 권한은 setAttendance 와 같다: 강좌 단위로 한꺼번에 바꾸려면 admin · 전체 학급 · 담당 교사.
  if (!(t.admin === true || t.homeroom === 0 || course.teacherIds.includes(t.tid))) {
    fail('이 강좌 수강생 출결을 한꺼번에 바꿀 권한이 없어요.', 'permission-denied');
  }

  const enr = (await db.collection('enrollments').where('courseId', '==', courseId).get()).docs;
  const targets = enr.filter((e) => typeof e.get('qrStartAt') !== 'number' || typeof e.get('qrEndAt') !== 'number');
  if (!targets.length) return { ok: true, changed: 0 };

  const attRefs = targets.map((e) => db.collection('attendance').doc(attendanceId(course.date, String(e.get('sid')))));
  const attSnaps = await db.getAll(...attRefs);
  const todo = targets.filter((_, i) => attSnaps[i].get('absent') !== true);

  const teacher = (await db.collection('teachers').doc(t.tid).get()).data();
  const byName = String(teacher?.name ?? '');
  const now = Date.now();
  // 한 묶음 최대 500건 → 학생 한 명당 2건(출결 + 기록)이므로 200명씩
  for (let i = 0; i < todo.length; i += 200) {
    const batch = db.batch();
    for (const e of todo.slice(i, i + 200)) {
      const sid = String(e.get('sid'));
      const ref = db.collection('attendance').doc(attendanceId(course.date, sid));
      batch.set(ref, {
        date: course.date,
        sid,
        classNo: Number(e.get('classNo')),
        absent: true,
        viewerTeacherIds: await viewerTeachersFor(course.date, sid),
        updatedBy: t.tid,
        updatedByName: byName,
        updatedAt: now,
      });
      batch.set(ref.collection('history').doc(), { absent: true, by: t.tid, byName, at: now, serverAt: FieldValue.serverTimestamp(), reason: 'QR 미완료 일괄' });
    }
    await batch.commit();
  }
  return { ok: true, changed: todo.length };
});
