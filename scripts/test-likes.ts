/**
 * 에뮬레이터에서 강좌 좋아요(하트)를 시험한다.  (npm run emu, npm run seed:emu 후)
 *   npm run test:likes
 * - 누름/풀기, 같은 요청을 여러 번 보내도 한 번만 셈(연타·재전송)
 * - 여러 학생이 동시에 눌러도 수가 정확함
 * - 학생만 누를 수 있음, 없는 강좌·잘못된 요청 거부
 * - 강좌 문서(신청 인원)는 건드리지 않음
 * - 규칙: 내 좋아요는 본인만, 강좌별 수는 로그인한 사람만 읽음
 */

import { deleteApp, initializeApp as initClient, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithCustomToken } from 'firebase/auth';
import { connectFirestoreEmulator, doc, getDoc, getFirestore } from 'firebase/firestore';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { callAs, check, db, finish, studentToken } from './emu-util';

const COURSE = 'P02-1201';
const OTHER = 'P03-1201';

// 시작 전 좋아요 자료 비우기
for (const name of ['likes', 'courseLikes']) for (const d of (await db.collection(name).get()).docs) await d.ref.delete();
const before = (await db.doc(`courses/${COURSE}`).get()).data()!;

const count = async (id: string) => Number((await db.doc(`courseLikes/${id}`).get()).get('count') ?? 0);
const mine = async (sid: string) => ((await db.doc(`likes/${sid}`).get()).get('courses') ?? {}) as Record<string, boolean>;

const s1 = await studentToken('30101');
const s2 = await studentToken('30201');

// ── 누름·풀기
let r = await callAs(s1, 'setLike', { courseId: COURSE, liked: true });
check('좋아요 누름', !r.error && (await count(COURSE)) === 1, r.error?.message);
check('→ 내 좋아요 목록에 들어감', (await mine('30101'))[COURSE] === true);

// 같은 요청 3번(연타·재전송) → 그대로 1
await Promise.all([1, 2, 3].map(() => callAs(s1, 'setLike', { courseId: COURSE, liked: true })));
check('같은 "누름"을 여러 번 보내도 1번만 셈', (await count(COURSE)) === 1, String(await count(COURSE)));

r = await callAs(s1, 'setLike', { courseId: COURSE, liked: false });
check('좋아요 풀기', !r.error && (await count(COURSE)) === 0);
check('→ 내 목록에서 빠짐', !(COURSE in (await mine('30101'))));
r = await callAs(s1, 'setLike', { courseId: COURSE, liked: false });
check('이미 푼 걸 또 풀어도 0 아래로 안 내려감', (await count(COURSE)) === 0);

// ── 여러 학생 동시에
const sids = ['30101', '30102', '30103', '30104', '30105', '30201', '30202', '30203', '30204', '30205'];
const tokens = await Promise.all(sids.map(studentToken));
await Promise.all(tokens.map((t) => callAs(t, 'setLike', { courseId: OTHER, liked: true })));
check('10명이 동시에 누름 → 10', (await count(OTHER)) === 10, String(await count(OTHER)));
await Promise.all(tokens.slice(0, 4).map((t) => callAs(t, 'setLike', { courseId: OTHER, liked: false })));
check('그중 4명이 동시에 풂 → 6', (await count(OTHER)) === 6, String(await count(OTHER)));

// ── 강좌 문서(신청 인원)는 그대로
const after = (await db.doc(`courses/${COURSE}`).get()).data()!;
check('강좌 문서는 건드리지 않음(신청 트랜잭션과 안 부딪힘)', after.count === before.count && JSON.stringify(after) === JSON.stringify(before));

// ── 거부
const adminAuth = getAdminAuth();
const teacherTok = await (async () => {
  const custom = await adminAuth.createCustomToken('t_x', { role: 'teacher', tid: 'x', homeroom: null, admin: false });
  const res = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=demo', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: custom, returnSecureToken: true }),
  });
  return ((await res.json()) as { idToken: string }).idToken;
})();
r = await callAs(teacherTok, 'setLike', { courseId: COURSE, liked: true });
check('교사는 누를 수 없음', r.error?.status === 'UNAUTHENTICATED', r.error?.message);
r = await callAs(s2, 'setLike', { courseId: 'NOPE-0000', liked: true });
check('없는 강좌 → 거부', r.error?.status === 'NOT_FOUND', r.error?.message);
r = await callAs(s2, 'setLike', { courseId: '../courses', liked: true });
check('이상한 강좌ID → 거부', r.error?.status === 'INVALID_ARGUMENT');
r = await callAs(s2, 'setLike', { courseId: COURSE, liked: 'yes' });
check('누름 값이 참/거짓이 아님 → 거부', r.error?.status === 'INVALID_ARGUMENT');

// ── 규칙(브라우저에서 읽기)
const apps: FirebaseApp[] = [];
async function clientAs(uid: string, claims: object) {
  const app = initClient({ apiKey: 'demo', projectId: 'demo-sghs' }, uid);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const fs = getFirestore(app);
  connectFirestoreEmulator(fs, '127.0.0.1', 8080);
  await signInWithCustomToken(auth, await adminAuth.createCustomToken(uid, claims as Record<string, unknown>));
  return fs;
}
const ok = async (p: Promise<unknown>) => p.then(() => true, () => false);
const A = await clientAs('s_30101', { role: 'student', sid: '30101', classNo: 1 });
check('규칙: 내 좋아요 목록 읽기 가능', await ok(getDoc(doc(A, 'likes/30101'))));
check('규칙: 남의 좋아요 목록은 못 읽음', !(await ok(getDoc(doc(A, 'likes/30201')))));
check('규칙: 강좌별 좋아요 수는 읽음', await ok(getDoc(doc(A, `courseLikes/${OTHER}`))));
const anon = initClient({ apiKey: 'demo', projectId: 'demo-sghs' }, 'anon');
apps.push(anon);
const anonFs = getFirestore(anon);
connectFirestoreEmulator(anonFs, '127.0.0.1', 8080);
check('규칙: 로그인 안 하면 좋아요 수 못 읽음', !(await ok(getDoc(doc(anonFs, `courseLikes/${OTHER}`)))));

// 정리
for (const name of ['likes', 'courseLikes']) for (const d of (await db.collection(name).get()).docs) await d.ref.delete();
await Promise.all(apps.map((a) => deleteApp(a)));
finish('좋아요 시험');
