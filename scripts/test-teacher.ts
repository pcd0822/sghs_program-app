/**
 * 에뮬레이터에서 교사 화면의 자료 접근(보안 규칙)과 출결 공유를 시험한다.  (npm run emu, npm run seed:emu 후)
 *   npm run test:teacher
 * 브라우저와 같은 방식(웹 SDK + 보안 규칙 적용)으로 읽어서, 규칙이 실제로 막고 허용하는지 본다.
 * 주의: 시험장의 신청·출결 자료를 지우고 시작한다.
 */

import { deleteApp, initializeApp as initClient, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithCustomToken } from 'firebase/auth';
import { collection, connectFirestoreEmulator, doc, getDoc, getDocs, getFirestore, query, where } from 'firebase/firestore';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { callAs, check, db, finish, resetApplications, setPeriod, studentToken } from './emu-util';

const DATE = '2026-12-01';
const COURSE = 'P02-1201';

// 시험 준비: 신청·출결 비우고, 교과 교사(담임 아님) 한 명을 강좌에 배정
await resetApplications();
for (const d of (await db.collection('attendance').get()).docs) await db.recursiveDelete(d.ref);
const secrets = (await db.collection('teacherSecrets').get()).docs;
const teachers = new Map((await db.collection('teachers').get()).docs.map((d) => [d.id, d.data()]));
const pick = (pred: (t: FirebaseFirestore.DocumentData) => boolean) => secrets.map((s) => s.id).find((id) => pred(teachers.get(id)!))!;
const subjectT = pick((t) => t.homeroom === null && !t.isAdmin);
const homeroom1 = pick((t) => t.homeroom === 1);
const homeroom2 = pick((t) => t.homeroom === 2);
await db.doc(`courses/${COURSE}`).update({ teacherIds: [subjectT] });

await setPeriod('open');
for (const sid of ['30101', '30201']) {
  const r = await callAs(await studentToken(sid), 'applyCourse', { courseId: COURSE });
  if (!r.result?.ok) throw new Error(`신청 실패 ${sid}: ${r.error?.message}`);
}

// 교사·학생으로 로그인한 웹 SDK 클라이언트
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
  const idToken = await auth.currentUser!.getIdToken();
  return { fs, idToken };
}
const teacherClaims = (tid: string) => {
  const t = teachers.get(tid)!;
  return { role: 'teacher', tid, homeroom: t.homeroom, admin: t.isAdmin === true };
};
const S = await clientAs(`t_${subjectT}`, teacherClaims(subjectT));
const H1 = await clientAs(`t_${homeroom1}`, teacherClaims(homeroom1));
const H2 = await clientAs(`t_${homeroom2}`, teacherClaims(homeroom2));
const ST = await clientAs('s_30101', { role: 'student', sid: '30101', classNo: 1 });

async function allowed(p: Promise<unknown>): Promise<boolean> {
  try {
    await p;
    return true;
  } catch {
    return false;
  }
}
const attQuerySubject = () =>
  getDocs(query(collection(S.fs, 'attendance'), where('date', '==', DATE), where('viewerTeacherIds', 'array-contains', subjectT)));
const attQueryClass = (c: typeof H1, classNo: number) =>
  getDocs(query(collection(c.fs, 'attendance'), where('date', '==', DATE), where('classNo', '==', classNo)));
const absentOf = (snap: Awaited<ReturnType<typeof attQuerySubject>>, sid: string) => snap.docs.find((d) => d.get('sid') === sid)?.get('absent') === true;

// ── 출석부 읽기 권한
const roster = await getDocs(query(collection(S.fs, 'enrollments'), where('courseId', '==', COURSE), where('teacherIds', 'array-contains', subjectT)));
check('교과 교사: 내 강좌 수강생 명단 읽기', roster.size === 2, `${roster.size}명`);
check('교과 교사: 학급 학생 명단은 못 읽음', !(await allowed(getDocs(query(collection(S.fs, 'students'), where('classNo', '==', 1))))));
check('교과 교사: 학생 연락처는 못 읽음', !(await allowed(getDoc(doc(S.fs, 'studentSecrets/30101')))));
check('담임 1반: 자기 반 학생 명단 읽기', await allowed(getDocs(query(collection(H1.fs, 'students'), where('classNo', '==', 1)))));
check('담임 1반: 2반 학생 명단은 못 읽음', !(await allowed(getDocs(query(collection(H1.fs, 'students'), where('classNo', '==', 2))))));
check('담임 1반: 자기 반 신청 현황 읽기', await allowed(getDocs(query(collection(H1.fs, 'applications'), where('classNo', '==', 1)))));
check('학생: 내 신청 내역 읽기', await allowed(getDoc(doc(ST.fs, 'applications/30101'))));
check('학생: 다른 학생 신청 내역은 못 읽음', !(await allowed(getDoc(doc(ST.fs, 'applications/30201')))));
check('학생: 다른 학생 연락처는 못 읽음', !(await allowed(getDoc(doc(ST.fs, 'studentSecrets/30201')))));
check('학생: 교사 코드는 못 읽음', !(await allowed(getDocs(collection(ST.fs, 'teacherSecrets')))));

// ── 출결 공유: 담임 결석 → 교과 교사 출석부 "결과"
let r = await callAs(H1.idToken, 'setAttendance', { date: DATE, sid: '30101', absent: true });
check('담임 1반: 30101 결석 체크', r.result?.ok === true, r.error?.message);
let snap = await attQuerySubject();
check('→ 교과 교사 출석부에 결과로 보임', absentOf(snap, '30101'));

// 교과 교사 결과 → 담임 2반 학급출결 "결석"
r = await callAs(S.idToken, 'setAttendance', { date: DATE, sid: '30201', absent: true });
check('교과 교사: 30201 결과 체크', r.result?.ok === true, r.error?.message);
snap = await attQueryClass(H2, 2);
check('→ 담임 2반 학급출결에 결석으로 보임', absentOf(snap, '30201'));

// 한쪽에서 풀면 다른 쪽도 풀림
await callAs(S.idToken, 'setAttendance', { date: DATE, sid: '30101', absent: false });
snap = await attQueryClass(H1, 1);
check('교과 교사가 풀면 담임 화면에서도 풀림', snap.docs.find((d) => d.get('sid') === '30101')?.get('absent') === false);
check('누가 바꿨는지 기록', snap.docs.find((d) => d.get('sid') === '30101')?.get('updatedByName') === teachers.get(subjectT)!.name);

// 권한 없는 출결 변경
r = await callAs(S.idToken, 'setAttendance', { date: DATE, sid: '30301', absent: true });
check('교과 교사: 내 강좌 학생이 아니면 출결 못 바꿈', r.error?.status === 'PERMISSION_DENIED');
r = await callAs(H1.idToken, 'setAttendance', { date: DATE, sid: '30201', absent: false });
check('담임 1반: 2반 학생 출결 못 바꿈(그날 강좌 담당도 아님)', r.error?.status === 'PERMISSION_DENIED');
r = await callAs(ST.idToken, 'setAttendance', { date: DATE, sid: '30101', absent: false });
check('학생은 출결 못 바꿈', r.error?.status === 'UNAUTHENTICATED');

const hist = await db.collection(`attendance/${DATE}__30101/history`).get();
check('변경 기록(history) 2건', hist.size === 2, `${hist.size}건`);

// 출결 기록이 있는 날 학생이 강좌를 바꾸면 새 담당 교사에게도 보이는지
await callAs(await studentToken('30201'), 'cancelCourse', { courseId: COURSE });
snap = await attQuerySubject();
check('학생이 강좌를 취소하면 그 교사 출석부에서 빠짐', !snap.docs.some((d) => d.get('sid') === '30201'));

await db.doc(`courses/${COURSE}`).update({ teacherIds: [] });
await resetApplications();
for (const d of (await db.collection('attendance').get()).docs) await db.recursiveDelete(d.ref);
await Promise.all(apps.map((a) => deleteApp(a)));
finish('교사 화면 권한·출결 시험');
