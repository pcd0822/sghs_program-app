// 프로필(사진·연락처)과 회원가입 신청·승인

import { getStorage } from 'firebase-admin/storage';
import { onCall } from 'firebase-functions/v2/https';
import { normalizeName, parseSid, phoneDigits } from '../../shared/text';
import { db, fail } from './app';
import { assertNotLocked, readCaller, recordFail } from './guard';

/**
 * 프로필 사진·연락처 수정. 사진은 브라우저가 Storage 의 profiles/{uid}/ 에 올린 뒤 경로와 주소를 보낸다.
 * 학생 사진은 출석부 명단(enrollments)의 복사본까지 바꿔 교사 화면에 바로 보이게 한다.
 */
export const updateProfile = onCall(async (req) => {
  const t = req.auth?.token;
  const uid = req.auth?.uid;
  if (!t || !uid) fail('다시 로그인해 주세요.', 'unauthenticated');
  const d = (req.data ?? {}) as { photoPath?: unknown; photoUrl?: unknown; phone?: unknown; removePhoto?: unknown };

  let photo: { path: string; url: string } | null | undefined;
  if (d.removePhoto === true) photo = null;
  else if (typeof d.photoPath === 'string' && typeof d.photoUrl === 'string') {
    // 내 폴더에 올린 파일인지 확인
    if (!d.photoPath.startsWith(`profiles/${uid}/`) || !d.photoUrl.includes(encodeURIComponent(d.photoPath))) {
      fail('사진 주소가 올바르지 않아요.', 'invalid-argument');
    }
    photo = { path: d.photoPath, url: d.photoUrl };
  }

  const isStudent = t.role === 'student';
  const ref = isStudent ? db.doc(`students/${t.sid}`) : db.doc(`teachers/${t.tid}`);
  const before = (await ref.get()).data();
  if (!before) fail('정보를 찾을 수 없어요.', 'not-found');

  if (photo !== undefined) {
    await ref.update({ photoUrl: photo?.url ?? null, photoPath: photo?.path ?? null });
    // 예전 사진 파일 지우기
    const old = before.photoPath as string | undefined;
    if (old && old !== photo?.path && old.startsWith(`profiles/${uid}/`)) {
      await getStorage().bucket().file(old).delete({ ignoreNotFound: true }).catch(() => undefined);
    }
    if (isStudent) {
      const enr = await db.collection('enrollments').where('sid', '==', t.sid).get();
      const batch = db.batch();
      enr.docs.forEach((e) => batch.update(e.ref, { photoUrl: photo?.url ?? null }));
      await batch.commit();
    }
  }

  if (d.phone !== undefined) {
    if (!isStudent) fail('교사는 연락처를 저장하지 않아요.', 'invalid-argument');
    const phone = phoneDigits(d.phone);
    if (phone.length < 10 || phone.length > 11) fail('연락처를 정확히 입력해 주세요.', 'invalid-argument');
    await db.doc(`studentSecrets/${t.sid}`).set({ phone, classNo: Number(t.classNo) }, { merge: true });
  }
  return { ok: true };
});

/** 명단에 없는 학생의 가입 신청(로그인 전) */
export const requestSignup = onCall(async (req) => {
  const { sid: rawSid, name, phone, deviceId } = (req.data ?? {}) as Record<string, unknown>;
  const caller = readCaller(req, deviceId);
  const guard = { scope: 'sgn', key: caller.deviceKey };
  await assertNotLocked([guard]);
  // 같은 기기에서 1시간에 5번까지
  await recordFail(guard.scope, guard.key, { maxFails: 5, lockMs: 60 * 60_000, windowMs: 60 * 60_000 });

  const p = parseSid(rawSid);
  const n = normalizeName(name);
  const ph = phoneDigits(phone);
  if (!p || !n || ph.length < 10 || ph.length > 11) fail('학번 5자리, 이름, 연락처를 정확히 입력해 주세요.', 'invalid-argument');

  if ((await db.doc(`students/${p.sid}`).get()).exists) {
    fail('이미 명단에 있는 학번이에요. 로그인해 주세요. 연락처가 등록되지 않았다면 담임 선생님께 문의해 주세요.', 'already-exists');
  }
  const ref = db.doc(`signupRequests/${p.sid}`);
  const prev = (await ref.get()).data();
  if (prev?.status === 'pending') fail('이미 가입 신청이 접수되어 승인을 기다리고 있어요.', 'already-exists');
  await ref.set({ sid: p.sid, name: n, phone: ph, status: 'pending', createdAt: Date.now(), reviewedAt: null });
  return { ok: true };
});

/** admin 가입 승인·거절. 승인하면 학생 명단에 등록되어 바로 로그인할 수 있다. */
export const reviewSignup = onCall(async (req) => {
  const t = req.auth?.token;
  if (!t || t.role !== 'teacher' || t.admin !== true) fail('관리자만 할 수 있어요.', 'permission-denied');
  const { sid: rawSid, approve } = (req.data ?? {}) as { sid?: unknown; approve?: unknown };
  const p = parseSid(rawSid);
  if (!p) fail('학번이 올바르지 않아요.', 'invalid-argument');
  const ref = db.doc(`signupRequests/${p.sid}`);
  const r = (await ref.get()).data();
  if (!r || r.status !== 'pending') fail('대기 중인 가입 신청이 아니에요.', 'failed-precondition');

  const now = Date.now();
  if (approve === true) {
    if ((await db.doc(`students/${p.sid}`).get()).exists) fail('이미 명단에 있는 학번이에요.', 'already-exists');
    const batch = db.batch();
    batch.set(db.doc(`students/${p.sid}`), { sid: p.sid, name: r.name, classNo: p.classNo, number: p.number, photoUrl: null });
    batch.set(db.doc(`studentSecrets/${p.sid}`), { phone: r.phone, classNo: p.classNo });
    batch.update(ref, { status: 'approved', reviewedAt: now });
    await batch.commit();
  } else {
    await ref.update({ status: 'rejected', reviewedAt: now });
  }
  return { ok: true };
});
