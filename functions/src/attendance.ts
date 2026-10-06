// 출결: attendance/{날짜__학번} 하나를 학급출결(결석)과 교과수업출결(결과)이 함께 쓴다.
// - 담임이 결석 체크 → 그 학생이 그날 신청한 강좌 담당 교사 출석부에도 "결과"로 보인다(반대도 같음).
// - 교과 교사가 이 문서를 읽을 수 있도록 viewerTeacherIds(그날 그 학생 강좌의 담당 교사들)를 함께 저장한다.
// - 바꿀 때마다 history 에 누가 언제 무엇으로 바꿨는지 남긴다.

import { FieldValue } from 'firebase-admin/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { OPERATING_DATES } from '../../shared/constants';
import { parseSid } from '../../shared/text';
import { db, fail } from './app';

export const attendanceId = (date: string, sid: string) => `${date}__${sid}`;

/** 그날 그 학생이 신청한 강좌들의 담당 교사 */
export async function viewerTeachersFor(date: string, sid: string): Promise<string[]> {
  const snap = await db.collection('enrollments').where('sid', '==', sid).where('date', '==', date).get();
  return [...new Set(snap.docs.flatMap((d) => (d.get('teacherIds') as string[] | undefined) ?? []))];
}

/** 신청·취소·배정 변경 뒤 이미 있는 출결 문서의 열람 교사 목록을 새로 맞춘다(문서가 없으면 아무것도 안 함). */
export async function refreshAttendanceViewers(date: string, sid: string): Promise<void> {
  const ref = db.collection('attendance').doc(attendanceId(date, sid));
  if (!(await ref.get()).exists) return;
  await ref.update({ viewerTeacherIds: await viewerTeachersFor(date, sid) });
}

export const setAttendance = onCall(async (req) => {
  const t = req.auth?.token;
  if (!t || t.role !== 'teacher' || typeof t.tid !== 'string') fail('교사로 로그인해 주세요.', 'unauthenticated');
  const { date, sid: rawSid, absent } = (req.data ?? {}) as Record<string, unknown>;
  const p = parseSid(rawSid);
  if (!p || typeof date !== 'string' || !OPERATING_DATES.includes(date) || typeof absent !== 'boolean') {
    fail('출결 정보가 올바르지 않아요.', 'invalid-argument');
  }

  const viewers = await viewerTeachersFor(date, p.sid);
  const homeroom = typeof t.homeroom === 'number' ? t.homeroom : null;
  const allowed = t.admin === true || homeroom === 0 || homeroom === p.classNo || viewers.includes(t.tid);
  if (!allowed) fail('이 학생의 출결을 바꿀 권한이 없어요.', 'permission-denied');

  const teacher = (await db.collection('teachers').doc(t.tid).get()).data();
  const now = Date.now();
  const ref = db.collection('attendance').doc(attendanceId(date, p.sid));
  const batch = db.batch();
  batch.set(ref, {
    date,
    sid: p.sid,
    classNo: p.classNo,
    absent,
    viewerTeacherIds: viewers,
    updatedBy: t.tid,
    updatedByName: String(teacher?.name ?? ''),
    updatedAt: now,
  });
  batch.set(ref.collection('history').doc(), {
    absent,
    by: t.tid,
    byName: String(teacher?.name ?? ''),
    at: now,
    serverAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();
  return { ok: true };
});
