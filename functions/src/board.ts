// 문의 게시판 · 공지. 쓰기는 모두 여기서(작성자 별칭·가린 이름은 서버가 정한다).

import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { LOGIN_GUARD } from '../../shared/constants';
import { maskName } from '../../shared/text';
import { db, fail } from './app';
import { assertNotLocked, recordFail } from './guard';

const MAX_TITLE = 80;
const MAX_BODY = 4000;
const MAX_NOTICE = 20000;

function text(v: unknown, max: number, label: string): string {
  const s = String(v ?? '').trim();
  if (!s) fail(`${label}을(를) 입력해 주세요.`, 'invalid-argument');
  if (s.length > max) fail(`${label}이(가) 너무 길어요(${max}자 이하).`, 'invalid-argument');
  return s;
}

function requireAdmin(req: CallableRequest): void {
  const t = req.auth?.token;
  if (!t || t.role !== 'teacher' || t.admin !== true) fail('관리자만 할 수 있어요.', 'permission-denied');
}

/** 학생 문의 작성. 비밀글이 기본. */
export const createInquiry = onCall(async (req) => {
  const t = req.auth?.token;
  if (!t || t.role !== 'student' || typeof t.qa !== 'string' || !t.qa) fail('다시 로그인해 주세요.', 'unauthenticated');
  const d = (req.data ?? {}) as Record<string, unknown>;
  const title = text(d.title, MAX_TITLE, '제목');
  const body = text(d.body, MAX_BODY, '내용');
  const secret = d.secret !== false;

  // 도배 방지: 학생 한 명이 10분에 10개까지
  const guard = { scope: 'qa', key: String(t.sid) };
  await assertNotLocked([guard]);
  await recordFail(guard.scope, guard.key, { maxFails: 10, lockMs: LOGIN_GUARD.student.lockMs * 2, windowMs: 10 * 60_000 });

  const stu = (await db.doc(`students/${t.sid}`).get()).data();
  const now = Date.now();
  const ref = db.collection('inquiries').doc();
  const batch = db.batch();
  batch.set(ref, {
    title,
    body,
    secret,
    isNotice: false,
    authorAlias: t.qa,
    authorMasked: maskName(String(stu?.name ?? '학생')),
    createdAt: now,
    updatedAt: now,
    answered: false,
    answer: null,
    answeredAt: null,
  });
  batch.set(db.doc(`inquiryAuthors/${ref.id}`), { sid: t.sid, name: String(stu?.name ?? '') });
  await batch.commit();
  return { ok: true, id: ref.id };
});

/** 작성자 본인(답변 전) 또는 admin 이 삭제 */
export const deleteInquiry = onCall(async (req) => {
  const t = req.auth?.token;
  const id = String((req.data as { id?: unknown })?.id ?? '');
  if (!t || !/^[\w-]{1,64}$/.test(id)) fail('잘못된 요청이에요.', 'invalid-argument');
  const snap = await db.doc(`inquiries/${id}`).get();
  if (!snap.exists) return { ok: true };
  const isAdmin = t.role === 'teacher' && t.admin === true;
  const isOwner = t.role === 'student' && snap.get('authorAlias') === t.qa;
  if (!isAdmin && !isOwner) fail('내가 쓴 글만 지울 수 있어요.', 'permission-denied');
  if (!isAdmin && snap.get('answered')) fail('답변이 달린 글은 지울 수 없어요.', 'failed-precondition');
  await db.doc(`inquiries/${id}`).delete();
  await db.doc(`inquiryAuthors/${id}`).delete();
  return { ok: true };
});

/** admin 답변(빈 문자열이면 답변 지우기) */
export const answerInquiry = onCall(async (req) => {
  requireAdmin(req);
  const { id, answer } = (req.data ?? {}) as { id?: unknown; answer?: unknown };
  const ref = db.doc(`inquiries/${String(id ?? '')}`);
  if (!(await ref.get()).exists) fail('없는 글이에요.', 'not-found');
  const a = String(answer ?? '').trim();
  if (a.length > MAX_BODY) fail('답변이 너무 길어요.', 'invalid-argument');
  const now = Date.now();
  await ref.update({ answer: a || null, answered: !!a, answeredAt: a ? now : null, updatedAt: now });
  return { ok: true };
});

/** admin [공지] 작성·수정 */
export const saveNotice = onCall(async (req) => {
  requireAdmin(req);
  const d = (req.data ?? {}) as Record<string, unknown>;
  const title = text(d.title, MAX_TITLE, '제목');
  const body = text(d.body, MAX_NOTICE, '내용');
  const now = Date.now();
  const id = typeof d.id === 'string' && d.id ? d.id : null;
  if (id) {
    const ref = db.doc(`inquiries/${id}`);
    const snap = await ref.get();
    if (!snap.exists || !snap.get('isNotice')) fail('없는 공지예요.', 'not-found');
    await ref.update({ title, body, updatedAt: now });
    return { ok: true, id };
  }
  const ref = await db.collection('inquiries').add({
    title,
    body,
    secret: false,
    isNotice: true,
    authorAlias: 'admin',
    authorMasked: '관리자',
    createdAt: now,
    updatedAt: now,
    answered: false,
    answer: null,
    answeredAt: null,
  });
  return { ok: true, id: ref.id };
});
