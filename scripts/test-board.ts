/**
 * 에뮬레이터에서 5단계 기능(문의·공지 권한, 회원가입 승인, 프로필 수정)을 시험한다.
 *   npm run test:board
 */

import { deleteApp, initializeApp as initClient, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithCustomToken } from 'firebase/auth';
import { collection, connectFirestoreEmulator, doc, getDoc, getDocs, getFirestore, query, where } from 'firebase/firestore';
import { callAs, check, db, finish } from './emu-util';

const FN = 'http://127.0.0.1:5001/demo-sghs/asia-northeast3';
async function anon(name: string, data: unknown) {
  const res = await fetch(`${FN}/${name}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ data }) });
  return (await res.json()) as { result?: { token?: string; ok?: boolean }; error?: { status: string; message: string; details?: { reason?: string } } };
}

// 준비: 시험 학생 연락처, 게시판·가입 신청 비우기
const PHONE = '01012345678';
for (const sid of ['30101', '30102']) await db.doc(`studentSecrets/${sid}`).set({ phone: PHONE, classNo: 1 });
for (const c of ['inquiries', 'inquiryAuthors', 'signupRequests', 'loginGuards']) for (const d of (await db.collection(c).get()).docs) await d.ref.delete();
for (const sid of ['30997']) {
  await db.doc(`students/${sid}`).delete();
  await db.doc(`studentSecrets/${sid}`).delete();
}

// 실제 로그인 함수로 토큰을 받는다(문의 별칭 claim 포함)
const apps: FirebaseApp[] = [];
async function loginStudent(sid: string, phone = PHONE) {
  const name = String((await db.doc(`students/${sid}`).get()).get('name'));
  const r = await anon('loginStudent', { sid, name, phone, deviceId: `test-board-${sid}` });
  if (!r.result?.token) throw new Error(`로그인 실패 ${sid}: ${r.error?.message}`);
  const app = initClient({ apiKey: 'demo', projectId: 'demo-sghs' }, `board-${sid}-${apps.length}`);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const fs = getFirestore(app);
  connectFirestoreEmulator(fs, '127.0.0.1', 8080);
  await signInWithCustomToken(auth, r.result.token);
  const qa = String((await auth.currentUser!.getIdTokenResult()).claims.qa ?? '');
  return { fs, idToken: await auth.currentUser!.getIdToken(), qa, uid: auth.currentUser!.uid };
}
const adminId = (await db.collection('teachers').where('isAdmin', '==', true).limit(1).get()).docs[0].id;
async function adminClient() {
  const { getAuth: adminAuth } = await import('firebase-admin/auth');
  const custom = await adminAuth().createCustomToken(`t_${adminId}`, { role: 'teacher', tid: adminId, homeroom: 0, admin: true });
  const app = initClient({ apiKey: 'demo', projectId: 'demo-sghs' }, 'board-admin');
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const fs = getFirestore(app);
  connectFirestoreEmulator(fs, '127.0.0.1', 8080);
  await signInWithCustomToken(auth, custom);
  return { fs, idToken: await auth.currentUser!.getIdToken() };
}
const allowed = async (p: Promise<unknown>) => p.then(() => true).catch(() => false);

const A = await loginStudent('30101');
const B = await loginStudent('30102');
const ADM = await adminClient();
check('로그인하면 문의 별칭이 생김', !!A.qa && A.qa !== B.qa);

// ── 문의
let r = await callAs(A.idToken, 'createInquiry', { title: 'A의 비밀 질문', body: '내용', secret: true });
const secretId = (r.result as { id?: string } | undefined)?.id ?? '';
check('학생 비밀글 작성', !!secretId, r.error?.message);
r = await callAs(B.idToken, 'createInquiry', { title: 'B의 공개 질문', body: '내용', secret: false });
const publicId = (r.result as { id?: string } | undefined)?.id ?? '';
const pubDoc = (await db.doc(`inquiries/${publicId}`).get()).data()!;
check('공개 글 작성자 이름은 가려짐(○)', /○/.test(pubDoc.authorMasked) && !JSON.stringify(pubDoc).includes('30102'), pubDoc.authorMasked);

const bPublic = await getDocs(query(collection(B.fs, 'inquiries'), where('secret', '==', false)));
check('다른 학생: 공개 글은 보임', bPublic.docs.some((d) => d.id === publicId));
check('다른 학생: 남의 비밀글은 목록에 없음', !bPublic.docs.some((d) => d.id === secretId));
check('다른 학생: 남의 비밀글 직접 열기도 막힘', !(await allowed(getDoc(doc(B.fs, `inquiries/${secretId}`)))));
const aMine = await getDocs(query(collection(A.fs, 'inquiries'), where('authorAlias', '==', A.qa)));
check('작성자: 내 비밀글 보임', aMine.docs.some((d) => d.id === secretId));
check('학생: 실제 작성자 정보는 못 읽음', !(await allowed(getDoc(doc(A.fs, `inquiryAuthors/${secretId}`)))));
check('admin: 비밀글과 실제 작성자 읽기', (await allowed(getDoc(doc(ADM.fs, `inquiries/${secretId}`)))) && (await getDoc(doc(ADM.fs, `inquiryAuthors/${secretId}`))).get('sid') === '30101');

r = await callAs(B.idToken, 'answerInquiry', { id: secretId, answer: '답' });
check('학생은 답변 못 함', r.error?.status === 'PERMISSION_DENIED');
r = await callAs(ADM.idToken, 'answerInquiry', { id: secretId, answer: '답변입니다' });
check('admin 답변 → 답변 완료', r.result?.ok === true && (await db.doc(`inquiries/${secretId}`).get()).get('answered') === true);
r = await callAs(A.idToken, 'deleteInquiry', { id: secretId });
check('답변 달린 내 글은 못 지움', r.error?.status === 'FAILED_PRECONDITION');
r = await callAs(A.idToken, 'deleteInquiry', { id: publicId });
check('남의 글은 못 지움', r.error?.status === 'PERMISSION_DENIED');
r = await callAs(B.idToken, 'deleteInquiry', { id: publicId });
check('답변 전 내 글은 지울 수 있음', r.result?.ok === true && !(await db.doc(`inquiries/${publicId}`).get()).exists);

// ── 공지
r = await callAs(A.idToken, 'saveNotice', { title: '공지', body: '내용' });
check('학생은 공지 못 씀', r.error?.status === 'PERMISSION_DENIED');
r = await callAs(ADM.idToken, 'saveNotice', { title: '📢 첫 공지', body: '**굵게** <span style="color: #e11d48">빨강</span>' });
const nid = (r.result as { id?: string } | undefined)?.id ?? '';
const bSees = await getDocs(query(collection(B.fs, 'inquiries'), where('secret', '==', false)));
check('공지는 모든 학생에게 보임', bSees.docs.some((d) => d.id === nid && d.get('isNotice') === true));

// ── 회원가입
r = await anon('requestSignup', { sid: '30101', name: '누구', phone: '010-1111-2222', deviceId: 'signup-dev-1' });
check('이미 명단에 있는 학번은 가입 신청 불가', r.error?.status === 'ALREADY_EXISTS');
r = await anon('requestSignup', { sid: '30997', name: '새학생', phone: '010-9999-0000', deviceId: 'signup-dev-1' });
check('명단에 없는 학번 가입 신청', r.result?.ok === true);
r = await anon('requestSignup', { sid: '30997', name: '새학생', phone: '010-9999-0000', deviceId: 'signup-dev-1' });
check('대기 중 중복 신청 불가', r.error?.status === 'ALREADY_EXISTS');
r = await anon('loginStudent', { sid: '30997', name: '새학생', phone: '01099990000', deviceId: 'signup-dev-2' });
check('승인 전 로그인 → "승인 대기" 안내', r.error?.details?.reason === 'SIGNUP_PENDING', r.error?.message);
check('학생은 가입 신청 목록 못 읽음', !(await allowed(getDocs(collection(A.fs, 'signupRequests')))));
r = await callAs(ADM.idToken, 'reviewSignup', { sid: '30997', approve: true });
check('admin 승인', r.result?.ok === true);
const after = await anon('loginStudent', { sid: '30997', name: '새학생', phone: '010-9999-0000', deviceId: 'signup-dev-2' });
check('승인 후 바로 로그인', !!after.result?.token, after.error?.message);

// ── 프로필
r = await callAs(A.idToken, 'updateProfile', { phone: '010-7777-8888' });
check('학생 연락처 수정', r.result?.ok === true && (await db.doc('studentSecrets/30101').get()).get('phone') === '01077778888');
await db.doc('enrollments/P02-1201__30101').set({ courseId: 'P02-1201', sid: '30101', name: 'x', classNo: 1, number: 1, photoUrl: null, date: '2026-12-01', teacherIds: [], at: 0 });
const path = `profiles/${A.uid}/test.webp`;
r = await callAs(A.idToken, 'updateProfile', { photoPath: path, photoUrl: `http://x/o/${encodeURIComponent(path)}?alt=media` });
check('사진 수정 → 출석부 명단 사진도 바뀜', r.result?.ok === true && !!(await db.doc('enrollments/P02-1201__30101').get()).get('photoUrl'));
r = await callAs(A.idToken, 'updateProfile', { photoPath: `profiles/s_30102/x.webp`, photoUrl: `http://x/o/${encodeURIComponent('profiles/s_30102/x.webp')}` });
check('남의 폴더 사진 주소는 거부', r.error?.status === 'INVALID_ARGUMENT');

// 되돌리기
for (const sid of ['30101', '30102']) await db.doc(`studentSecrets/${sid}`).set({ phone: PHONE, classNo: 1 });
await db.doc('students/30101').update({ photoUrl: null, photoPath: null });
await db.doc('enrollments/P02-1201__30101').delete();
for (const sid of ['30997']) {
  await db.doc(`students/${sid}`).delete();
  await db.doc(`studentSecrets/${sid}`).delete();
}
for (const c of ['inquiries', 'inquiryAuthors', 'signupRequests', 'loginGuards']) for (const d of (await db.collection(c).get()).docs) await d.ref.delete();
await Promise.all(apps.map((a) => deleteApp(a)));
finish('문의·가입·프로필 시험');
