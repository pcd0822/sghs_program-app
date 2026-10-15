/**
 * 에뮬레이터에서 출석 QR(시작·종료) 체크를 시험한다.  (npm run emu, npm run seed:emu 후)
 *   npm run test:qr
 * - QR 권한: admin · 담임 · 전체 학급 · 담당 교사만 / 교과 교사(미배정)·학생은 못 연다
 * - 받기를 켠 동안만, 신청한 학생 본인만, 올바른 비밀값만 체크된다
 * - 미완료 일괄 결과 처리
 * 주의: 시험장의 신청·출결 자료를 지우고 시작한다.
 */

import { deleteApp, initializeApp as initClient, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithCustomToken } from 'firebase/auth';
import { connectFirestoreEmulator, doc, getDoc, getFirestore } from 'firebase/firestore';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { callAs, check, db, finish, resetApplications, setPeriod, studentToken } from './emu-util';

const DATE = '2026-12-01';
const COURSE = 'P02-1201';

await resetApplications();
for (const d of (await db.collection('attendance').get()).docs) await db.recursiveDelete(d.ref);
await db.doc(`courseQr/${COURSE}`).delete();
const secrets = (await db.collection('teacherSecrets').get()).docs;
const teachers = new Map((await db.collection('teachers').get()).docs.map((d) => [d.id, d.data()]));
const ids = secrets.map((s) => s.id);
const subjects = ids.filter((id) => teachers.get(id)!.homeroom === null && !teachers.get(id)!.isAdmin);
const [subjectT, otherT] = subjects;
const homeroom1 = ids.find((id) => teachers.get(id)!.homeroom === 1)!;
if (!otherT) throw new Error('담임 아닌 교과 교사가 2명 이상 필요해요(seed 확인).');
await db.doc(`courses/${COURSE}`).update({ teacherIds: [subjectT] });

await setPeriod('open');
for (const sid of ['30101', '30201']) {
  const r = await callAs(await studentToken(sid), 'applyCourse', { courseId: COURSE });
  if (!r.result?.ok) throw new Error(`신청 실패 ${sid}: ${r.error?.message}`);
}

const adminAuth = getAdminAuth();
const apps: FirebaseApp[] = [];
async function clientAs(uid: string, claims: object) {
  const app = initClient({ apiKey: 'demo', projectId: 'demo-sghs' }, uid);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const fs = getFirestore(app);
  connectFirestoreEmulator(fs, '127.0.0.1', 8080);
  await signInWithCustomToken(auth, await adminAuth.createCustomToken(uid, claims as Record<string, unknown>));
  return { fs, idToken: await auth.currentUser!.getIdToken() };
}
const teacherClaims = (tid: string) => {
  const t = teachers.get(tid)!;
  return { role: 'teacher', tid, homeroom: t.homeroom, admin: t.isAdmin === true };
};
const S = await clientAs(`t_${subjectT}`, teacherClaims(subjectT));
const O = await clientAs(`t_${otherT}`, teacherClaims(otherT));
const H1 = await clientAs(`t_${homeroom1}`, teacherClaims(homeroom1));
const ST = await clientAs('s_30101', { role: 'student', sid: '30101', classNo: 1 });
const s1 = ST.idToken;
const s2 = await studentToken('30201');
const s3 = await studentToken('30301'); // 신청 안 한 학생

async function allowed(p: Promise<unknown>): Promise<boolean> {
  try {
    await p;
    return true;
  } catch {
    return false;
  }
}
type R = Awaited<ReturnType<typeof callAs>> & { result?: { at?: number; other?: number | null; changed?: number } };
const run = (token: string, name: string, data: unknown) => callAs(token, name, data) as Promise<R>;

// ── QR 열기 권한
let r = await run(O.idToken, 'qrControl', { courseId: COURSE, action: 'ensure' });
check('미배정 교과 교사: QR 못 만듦', r.error?.status === 'PERMISSION_DENIED', r.error?.message);
r = await run(s1, 'qrControl', { courseId: COURSE, action: 'ensure' });
check('학생: QR 못 만듦', !!r.error);
r = await run(H1.idToken, 'qrControl', { courseId: COURSE, action: 'ensure' });
check('담임(미배정): QR 만들기', r.result?.ok === true, r.error?.message);
const qr = (await db.doc(`courseQr/${COURSE}`).get()).data()!;
check('비밀값 두 개 생성(서로 다름)', typeof qr.startKey === 'string' && qr.startKey.length >= 20 && qr.startKey !== qr.endKey);
r = await run(S.idToken, 'qrControl', { courseId: COURSE, action: 'ensure' });
const qr2 = (await db.doc(`courseQr/${COURSE}`).get()).data()!;
check('다시 만들어도 비밀값 그대로(저장한 이미지 유지)', qr2.startKey === qr.startKey && qr2.endKey === qr.endKey);

check('보안 규칙: 담당 교사 QR 읽기', await allowed(getDoc(doc(S.fs, `courseQr/${COURSE}`))));
check('보안 규칙: 담임 QR 읽기', await allowed(getDoc(doc(H1.fs, `courseQr/${COURSE}`))));
check('보안 규칙: 미배정 교과 교사 QR 못 읽음', !(await allowed(getDoc(doc(O.fs, `courseQr/${COURSE}`)))));
check('보안 규칙: 학생 QR 못 읽음', !(await allowed(getDoc(doc(ST.fs, `courseQr/${COURSE}`)))));

// ── 학생 체크
const start = { courseId: COURSE, phase: 'start', key: qr.startKey };
r = await run(s1, 'qrCheckin', start);
check('받기 꺼져 있으면 거부', r.error?.details?.reason === 'CLOSED', r.error?.message);
r = await run(S.idToken, 'qrControl', { courseId: COURSE, action: 'open', phase: 'start' });
check('담당 교사: 시작 받기 켜기', r.result?.ok === true, r.error?.message);
r = await run(s1, 'qrCheckin', { ...start, key: 'wrong-key' });
check('틀린 비밀값 거부', r.error?.details?.reason === 'BAD_KEY');
r = await run(s1, 'qrCheckin', { ...start, key: qr.endKey });
check('종료 비밀값으로 시작 체크 불가', r.error?.details?.reason === 'BAD_KEY');
r = await run(S.idToken, 'qrCheckin', start);
check('교사 계정으로는 체크 불가', r.error?.status === 'UNAUTHENTICATED');
r = await run(s3, 'qrCheckin', start);
check('신청 안 한 학생 거부', r.error?.details?.reason === 'NOT_ENROLLED', r.error?.message);
r = await run(s1, 'qrCheckin', start);
const firstAt = r.result?.at;
check('신청한 학생: 시작 체크', r.result?.ok === true && typeof firstAt === 'number', r.error?.message);
r = await run(s1, 'qrCheckin', start);
check('두 번 찍어도 처음 시각 유지', r.result?.already === true && r.result?.at === firstAt);
const enr1 = (await db.doc(`enrollments/${COURSE}__30101`).get()).data()!;
check('수강 기록에 시작 시각 저장', enr1.qrStartAt === firstAt && enr1.qrEndAt === undefined);

r = await run(S.idToken, 'qrControl', { courseId: COURSE, action: 'close', phase: 'start' });
r = await run(s2, 'qrCheckin', start);
check('받기 끈 뒤에는 거부', r.error?.details?.reason === 'CLOSED');
await db.doc(`courseQr/${COURSE}`).update({ startOpenUntil: Date.now() - 1000 });
r = await run(s2, 'qrCheckin', start);
check('받기 시간(30분) 지나면 거부', r.error?.details?.reason === 'CLOSED');

r = await run(H1.idToken, 'qrControl', { courseId: COURSE, action: 'open', phase: 'end' });
check('담임: 종료 받기 켜기', r.result?.ok === true, r.error?.message);
r = await run(s1, 'qrCheckin', { courseId: COURSE, phase: 'end', key: qr.endKey });
check('종료 체크 + 시작 시각 함께 돌려줌', r.result?.ok === true && r.result?.other === firstAt, r.error?.message);

// ── 미완료 일괄 결과 처리
r = await run(H1.idToken, 'markQrIncomplete', { courseId: COURSE });
check('담임(미배정): 강좌 일괄 처리 불가', r.error?.status === 'PERMISSION_DENIED');
r = await run(S.idToken, 'markQrIncomplete', { courseId: COURSE });
check('담당 교사: 미완료 1명 결과 처리', r.result?.changed === 1, JSON.stringify(r.result ?? r.error));
const a1 = (await db.doc(`attendance/${DATE}__30101`).get()).data();
const a2 = (await db.doc(`attendance/${DATE}__30201`).get()).data();
check('둘 다 찍은 학생은 그대로', a1?.absent !== true);
check('미완료 학생은 결과 + 담당 교사 열람 가능', a2?.absent === true && (a2?.viewerTeacherIds as string[]).includes(subjectT));
r = await run(S.idToken, 'markQrIncomplete', { courseId: COURSE });
check('다시 눌러도 중복 처리 없음', r.result?.changed === 0);

await Promise.all(apps.map((a) => deleteApp(a)));
finish('출석 QR 시험');
