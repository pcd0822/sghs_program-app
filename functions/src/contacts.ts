// 교과수업출결 출석부의 학생 연락처 (2026-11-27, 사용자 결정: 강좌 담당 교사도 자기 강좌 수강생 연락처를 본다)
// 연락처(studentSecrets)는 보안 규칙상 담임·전체 담당·admin 만 읽으므로, 담당 교사에겐 이 함수가 확인 후 건넨다.
// 출석부를 열 때 한 번만 부른다(실시간 수신 없음) → 읽기 = 수강생 수 + 강좌 1건.

import { onCall } from 'firebase-functions/v2/https';
import type { Course } from '../../shared/types';
import { db, fail } from './app';

export const courseContacts = onCall(async (req) => {
  const t = req.auth?.token;
  if (!t || t.role !== 'teacher' || typeof t.tid !== 'string') fail('교사로 로그인해 주세요.', 'unauthenticated');
  const courseId = (req.data as { courseId?: unknown } | null)?.courseId;
  if (typeof courseId !== 'string' || !/^[\w-]{1,64}$/.test(courseId)) fail('강좌를 다시 선택해 주세요.', 'invalid-argument');

  const course = (await db.collection('courses').doc(courseId).get()).data() as Course | undefined;
  if (!course) fail('없어진 강좌예요.', 'not-found');

  // admin · 전체 학급 · 그 강좌 담당 교사는 수강생 전부, 담임은 자기 반 학생만(규칙의 seesClass 와 같은 기준).
  const all = t.admin === true || t.homeroom === 0 || (course.teacherIds ?? []).includes(t.tid);
  const homeroom = typeof t.homeroom === 'number' && t.homeroom > 0 ? t.homeroom : null;
  if (!all && homeroom === null) fail('이 강좌 수강생 연락처를 볼 권한이 없어요.', 'permission-denied');

  const enr = (await db.collection('enrollments').where('courseId', '==', courseId).get()).docs;
  const sids = enr.filter((e) => all || e.get('classNo') === homeroom).map((e) => String(e.get('sid')));
  if (!sids.length) return { phones: {} };

  const snaps = await db.getAll(...sids.map((sid) => db.collection('studentSecrets').doc(sid)));
  const phones: Record<string, string> = {};
  snaps.forEach((s, i) => {
    const phone = s.get('phone');
    if (typeof phone === 'string' && phone) phones[sids[i]] = phone;
  });
  return { phones };
});
