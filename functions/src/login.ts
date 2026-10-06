// 로그인: 등록 정보를 서버에서 확인하고, 역할·학급이 담긴 커스텀 토큰을 발급한다.
// 학생 연락처(studentSecrets)와 교사 코드(teacherSecrets)는 보안 규칙상 브라우저에서 읽을 수 없다.

import { randomBytes } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { LOGIN_GUARD } from '../../shared/constants';
import { normalizeName, parseSid, phoneDigits } from '../../shared/text';
import type { Claims } from '../../shared/types';
import { auth, db, fail } from './app';
import { assertNotLocked, hash, readCaller, recordFail, resetGuard } from './guard';

export const studentUid = (sid: string) => `s_${sid}`;
export const teacherUid = (tid: string) => `t_${tid}`;

const MISMATCH = '입력한 정보가 등록된 정보와 일치하지 않아요. 학번·이름·연락처를 다시 확인해 주세요.';

export const loginStudent = onCall(async (req) => {
  const { sid: rawSid, name, phone, deviceId } = (req.data ?? {}) as Record<string, unknown>;
  const caller = readCaller(req, deviceId);
  const guard = { scope: 'stu', key: caller.deviceKey };
  await assertNotLocked([guard]);

  const parsed = parseSid(rawSid);
  const nameIn = normalizeName(name);
  const phoneIn = phoneDigits(phone);
  if (!parsed || !nameIn || phoneIn.length < 9) {
    fail('학번 5자리, 이름, 연락처를 모두 입력해 주세요.', 'invalid-argument');
  }

  const [stuSnap, secretSnap] = await db.getAll(
    db.collection('students').doc(parsed.sid),
    db.collection('studentSecrets').doc(parsed.sid),
  );
  const stu = stuSnap.data();
  const registeredPhone = phoneDigits(secretSnap.data()?.phone);

  if (!stu) {
    // 가입 신청을 한 학생이면 상태를 알려 준다
    const req = (await db.collection('signupRequests').doc(parsed.sid).get()).data();
    if (req && normalizeName(req.name) === nameIn && phoneDigits(req.phone) === phoneIn) {
      if (req.status === 'pending') fail('가입 신청이 아직 승인 대기 중이에요. 승인되면 로그인할 수 있어요.', 'failed-precondition', 'SIGNUP_PENDING');
      if (req.status === 'rejected') fail('가입 신청이 승인되지 않았어요. 담임 선생님께 문의해 주세요.', 'failed-precondition', 'SIGNUP_REJECTED');
    }
    await onStudentFail(guard.key);
    fail(MISMATCH, 'permission-denied');
  }
  if (normalizeName(stu.name) !== nameIn) {
    await onStudentFail(guard.key);
    fail(MISMATCH, 'permission-denied');
  }
  if (!registeredPhone) {
    // 이름까지 맞았는데 연락처가 아직 등록 전인 경우 — 실패 횟수에 넣지 않는다.
    fail('아직 연락처가 등록되지 않았어요. 담임 선생님께 문의해 주세요.', 'failed-precondition');
  }
  if (registeredPhone !== phoneIn) {
    await onStudentFail(guard.key);
    fail(MISMATCH, 'permission-denied');
  }

  await resetGuard(guard.scope, guard.key);
  // 문의 게시판 별칭: 처음 로그인할 때 한 번 만들어 둔다
  let qa = typeof stu.qaAlias === 'string' ? stu.qaAlias : '';
  if (!qa) {
    qa = randomBytes(9).toString('base64url');
    await db.collection('students').doc(parsed.sid).update({ qaAlias: qa });
  }
  const claims: Claims = { role: 'student', sid: parsed.sid, classNo: parsed.classNo, qa };
  const token = await auth.createCustomToken(studentUid(parsed.sid), claims);
  return { token, name: stu.name as string };
});

async function onStudentFail(deviceKey: string) {
  const locked = await recordFail('stu', deviceKey, LOGIN_GUARD.student);
  if (locked) fail('로그인 시도가 너무 많아요. 5분 뒤에 다시 시도해 주세요.', 'resource-exhausted');
}

export const loginTeacher = onCall(async (req) => {
  const { code, deviceId } = (req.data ?? {}) as Record<string, unknown>;
  const caller = readCaller(req, deviceId);
  const deviceGuard = { scope: 'tch', key: caller.deviceKey };
  const ipGuard = { scope: 'tip', key: hash(caller.ip) };
  await assertNotLocked([deviceGuard, ipGuard]);

  const codeIn = String(code ?? '').trim();
  const found = /^\d{4}$/.test(codeIn)
    ? await db.collection('teacherSecrets').where('code', '==', codeIn).limit(1).get()
    : null;
  const secret = found && !found.empty ? found.docs[0] : null;

  if (!secret) {
    const [deviceLocked, ipLocked] = await Promise.all([
      recordFail(deviceGuard.scope, deviceGuard.key, LOGIN_GUARD.teacher),
      recordFail(ipGuard.scope, ipGuard.key, LOGIN_GUARD.teacherIp),
    ]);
    await db.collection('adminLoginLogs').add({
      at: FieldValue.serverTimestamp(),
      ip: caller.ip,
      device: caller.deviceKey.slice(0, 14),
      userAgent: caller.userAgent,
      // 입력값 전체를 남기면 거의 맞힌 코드가 기록에 남으므로 앞 두 자리만.
      codeHint: codeIn.slice(0, 2).padEnd(codeIn.length || 2, '*'),
      locked: deviceLocked || ipLocked,
    });
    if (ipLocked) fail('이 네트워크에서 로그인 실패가 너무 많아 잠시 잠겼어요. 30분 뒤에 다시 시도해 주세요.', 'resource-exhausted');
    if (deviceLocked) fail('로그인 시도가 너무 많아요. 5분 뒤에 다시 시도해 주세요.', 'resource-exhausted');
    fail('코드가 올바르지 않아요.', 'permission-denied');
  }

  const teacherSnap = await db.collection('teachers').doc(secret.id).get();
  const t = teacherSnap.data();
  if (!t) fail('교사 정보를 찾을 수 없어요. 관리자에게 문의해 주세요.', 'not-found');

  await resetGuard(deviceGuard.scope, deviceGuard.key);
  const claims: Claims = {
    role: 'teacher',
    tid: secret.id,
    homeroom: typeof t.homeroom === 'number' ? t.homeroom : null,
    admin: t.isAdmin === true,
  };
  const token = await auth.createCustomToken(teacherUid(secret.id), claims);
  return { token, name: t.name as string };
});
