// 강좌 좋아요(하트). 학생만 누를 수 있고, 수는 모두가 본다.
// - 학생 한 명의 좋아요 = likes/{학번}.courses 지도 하나(본인만 읽음).
// - 강좌별 좋아요 수 = courseLikes/{강좌ID}.count.
//   강좌 문서(courses)에 세지 않는 이유: 신청 트랜잭션이 강좌 문서를 잠그고 정원을 확인하므로,
//   같은 문서에 좋아요가 몰리면 여는 날 신청이 느려진다. 좋아요는 강좌 문서를 읽지도 쓰지도 않는다(존재 확인만 잠금 없이).
// - "누르기/풀기"가 아니라 "누름=참/거짓"을 받는다 → 연타·재전송해도 두 번 세지 않는다.

import { FieldValue } from 'firebase-admin/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { db, fail } from './app';

export const setLike = onCall(async (req) => {
  const t = req.auth?.token;
  if (!t || t.role !== 'student' || typeof t.sid !== 'string') fail('학생으로 로그인하면 좋아요를 누를 수 있어요.', 'unauthenticated');
  const { courseId, liked } = (req.data ?? {}) as { courseId?: unknown; liked?: unknown };
  if (typeof courseId !== 'string' || !/^[\w-]{1,64}$/.test(courseId)) fail('강좌를 다시 선택해 주세요.', 'invalid-argument');
  if (typeof liked !== 'boolean') fail('요청이 올바르지 않아요.', 'invalid-argument');

  // 트랜잭션 밖에서 잠금 없이 존재만 확인(신청 트랜잭션과 부딪히지 않게)
  if (!(await db.collection('courses').doc(courseId).get()).exists) fail('없어진 강좌예요.', 'not-found');

  const mine = db.collection('likes').doc(t.sid);
  const counter = db.collection('courseLikes').doc(courseId);
  const changed = await db.runTransaction(async (tx) => {
    const cur = ((await tx.get(mine)).get('courses') ?? {}) as Record<string, boolean>;
    if (!!cur[courseId] === liked) return false; // 이미 그 상태 → 아무것도 안 바꿈
    tx.set(mine, { courses: { [courseId]: liked ? true : FieldValue.delete() }, updatedAt: Date.now() }, { merge: true });
    tx.set(counter, { count: FieldValue.increment(liked ? 1 : -1) }, { merge: true });
    return true;
  });
  return { liked, changed };
});
