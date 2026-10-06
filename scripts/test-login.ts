/**
 * 에뮬레이터에서 로그인 함수를 시험한다.  (먼저 npm run emu, npm run seed:emu, npm run emu:phones)
 *   npm run test:login
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const BASE = 'http://127.0.0.1:5001/demo-sghs/asia-northeast3';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
initializeApp({ projectId: 'demo-sghs' });
const db = getFirestore();

async function callFn(name: string, data: unknown, ip = '10.0.0.1') {
  const res = await fetch(`${BASE}/${name}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify({ data }),
  });
  const body = (await res.json()) as { result?: { token?: string; name?: string }; error?: { status: string; message: string } };
  return body;
}

let failed = 0;
function check(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
}

// 시험마다 잠금 기록을 비운다
const guards = await db.collection('loginGuards').get();
await Promise.all(guards.docs.map((d) => d.ref.delete()));

const stu = (await db.collection('students').doc('30101').get()).data();
if (!stu) throw new Error('먼저 npm run seed:emu 를 실행하세요');

let r = await callFn('loginStudent', { sid: '30101', name: stu.name, phone: '010-1234-5678', deviceId: 'test-device-001' });
check('학생: 학번·이름·연락처 일치 → 로그인', !!r.result?.token);

r = await callFn('loginStudent', { sid: '30101', name: ` ${stu.name} `, phone: '010 1234 5678', deviceId: 'test-device-001' });
check('학생: 공백·하이픈이 달라도 로그인', !!r.result?.token);

r = await callFn('loginStudent', { sid: '30101', name: stu.name, phone: '010-9999-9999', deviceId: 'test-device-001' });
check('학생: 연락처 틀림 → 거부', r.error?.status === 'PERMISSION_DENIED', r.error?.message);

r = await callFn('loginStudent', { sid: '30101', name: '다른이름', phone: '010-1234-5678', deviceId: 'test-device-001' });
check('학생: 이름 틀림 → 거부', r.error?.status === 'PERMISSION_DENIED');

r = await callFn('loginStudent', { sid: '39999', name: '없음', phone: '010-1234-5678', deviceId: 'test-device-001' });
check('학생: 없는 학번 → 거부', r.error?.status === 'PERMISSION_DENIED');

// 교사 — 코드는 화면에 출력하지 않는다
const secrets = await db.collection('teacherSecrets').get();
const anyCode = String(secrets.docs[0].get('code'));
const codes = new Set(secrets.docs.map((d) => String(d.get('code'))));
const wrong = ['9999', '9998', '9997', '9996', '9995', '9994'].filter((c) => !codes.has(c));

r = await callFn('loginTeacher', { code: anyCode, deviceId: 'teacher-device-01' });
check('교사: 올바른 코드 → 로그인', !!r.result?.token);

for (let i = 1; i <= 5; i++) {
  r = await callFn('loginTeacher', { code: wrong[i - 1], deviceId: 'teacher-device-02' });
}
check('교사: 같은 기기 5회 실패 → 잠김', r.error?.status === 'RESOURCE_EXHAUSTED', r.error?.message);
r = await callFn('loginTeacher', { code: anyCode, deviceId: 'teacher-device-02' });
check('교사: 잠긴 기기는 맞는 코드도 거부', r.error?.status === 'RESOURCE_EXHAUSTED');
r = await callFn('loginTeacher', { code: anyCode, deviceId: 'teacher-device-03' });
check('교사: 같은 IP 다른 기기는 로그인 가능(학교 와이파이 공용 IP)', !!r.result?.token);

// IP 상한: 기기를 바꿔 가며 31번 틀리면 IP 전체 잠금
for (let i = 0; i < 31; i++) {
  r = await callFn('loginTeacher', { code: wrong[i % wrong.length], deviceId: `rotating-device-${String(i).padStart(3, '0')}` }, '10.9.9.9');
}
check('교사: 같은 IP 1시간 30회 초과 → IP 잠김', r.error?.status === 'RESOURCE_EXHAUSTED', r.error?.message);
r = await callFn('loginTeacher', { code: anyCode, deviceId: 'fresh-device-999' }, '10.9.9.9');
check('교사: 잠긴 IP에서는 새 기기도 거부', r.error?.status === 'RESOURCE_EXHAUSTED');

const logs = await db.collection('adminLoginLogs').count().get();
check('관리자 로그인 실패 기록 남음', logs.data().count >= 36, `${logs.data().count}건`);

console.log(failed ? `\n❌ ${failed}개 실패` : '\n🎉 로그인 시험 모두 통과');
process.exit(failed ? 1 : 0);
