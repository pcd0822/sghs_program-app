/**
 * 에뮬레이터에서 admin 서버 기능(저장 및 배포 · 수동 배정 · 인원 수 점검)을 시험한다.
 *   npm run test:admin
 * 시험 중 바꾼 강좌·시간표·교사·학생은 끝에 원래대로 되돌린다. 신청·출결 자료는 지운다.
 */

import { getAuth } from 'firebase-admin/auth';
import type { CourseInput } from '../shared/admin';
import type { Course } from '../shared/types';
import { callAs, check, db, finish, resetApplications, setPeriod, studentToken } from './emu-util';

async function teacherToken(tid: string, homeroom: number | null, admin: boolean): Promise<string> {
  const custom = await getAuth().createCustomToken(`t_${tid}`, { role: 'teacher', tid, homeroom, admin });
  const res = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=demo', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: custom, returnSecureToken: true }),
  });
  return ((await res.json()) as { idToken: string }).idToken;
}
const input = (c: Course): CourseInput => {
  const { count: _c, ...rest } = c;
  return rest;
};

// ── 준비: 원래 상태 저장
const backupCourses = (await db.collection('courses').get()).docs.map((d) => ({ id: d.id, data: d.data() }));
const backupTimetable = (await db.doc('config/timetable').get()).data();
const backupPeriod = (await db.doc('config/period').get()).data();
await resetApplications();
for (const d of (await db.collection('attendance').get()).docs) await db.recursiveDelete(d.ref);

const teachers = new Map((await db.collection('teachers').get()).docs.map((d) => [d.id, d.data()]));
const adminId = [...teachers].find(([, t]) => t.isAdmin)![0];
const subjectId = [...teachers].find(([, t]) => t.homeroom === null && !t.isAdmin)![0];
const homeroom1 = [...teachers].find(([, t]) => t.homeroom === 1)![0];
const ADMIN = await teacherToken(adminId, teachers.get(adminId)!.homeroom, true);
const NOT_ADMIN = await teacherToken(homeroom1, 1, false);
const course = async (id: string) => ({ ...((await db.doc(`courses/${id}`).get()).data() as Course), id });

await setPeriod('open');
for (const sid of ['30101', '30102']) await callAs(await studentToken(sid), 'applyCourse', { courseId: 'P02-1201' });
await callAs(await studentToken('30101'), 'applyCourse', { courseId: 'P01-1130' });

// ── 권한
let r = await callAs(NOT_ADMIN, 'adminPublish', {});
check('admin 아니면 저장 및 배포 불가', r.error?.status === 'PERMISSION_DENIED');

// ── 담당교사 변경 → 출석부 명단·출결 열람 교사 갱신
await callAs(ADMIN, 'setAttendance', { date: '2026-12-01', sid: '30101', absent: true });
const p02 = await course('P02-1201');
r = await callAs(ADMIN, 'adminPublish', { courses: { upsert: [{ ...input(p02), teacherIds: [subjectId], name: '망스티치 동전지갑(이름변경)' }], remove: [] } });
check('강좌 수정 저장', r.result?.ok === true, r.error?.message);
const enr = await db.doc('enrollments/P02-1201__30101').get();
check('→ 출석부 명단의 담당교사도 바뀜', JSON.stringify(enr.get('teacherIds')) === JSON.stringify([subjectId]));
const att = await db.doc('attendance/2026-12-01__30101').get();
check('→ 이미 있는 출결 기록의 열람 교사도 바뀜', (att.get('viewerTeacherIds') as string[]).includes(subjectId));
const app1 = (await db.doc('applications/30101').get()).data()!;
check('→ 학생 신청 목록의 강좌명도 바뀜', app1.items['P02-1201'].name === '망스티치 동전지갑(이름변경)');
check('→ 신청 인원 수는 그대로', (await course('P02-1201')).count === 2);

// ── 시간표 겹침 막기
const tt = (await db.doc('config/timetable').get()).data()!;
r = await callAs(ADMIN, 'adminPublish', {
  timetable: { ...tt, fixedEvents: [...tt.fixedEvents, { id: 'x', date: '2026-12-01', start: '10:30', end: '11:00', title: '겹치는 일정', place: '', description: '' }] },
});
check('강좌 시간과 겹치는 고정 일정 → 거부', r.error?.status === 'FAILED_PRECONDITION' && /겹쳐요/.test(r.error.message), r.error?.message);
r = await callAs(ADMIN, 'adminPublish', { courses: { upsert: [{ ...input(await course('P03-1201')), start: '08:00', end: '09:00' }], remove: [] } });
check('고정 일정과 겹치게 강좌 시간 변경 → 거부', r.error?.status === 'FAILED_PRECONDITION');

// ── 검사
r = await callAs(ADMIN, 'adminPublish', { period: { mode: 'auto', openAt: 2000, closeAt: 1000 } });
check('마감이 시작보다 빠른 신청 기간 → 거부', r.error?.status === 'INVALID_ARGUMENT');
const anyCode = String((await db.doc(`teacherSecrets/${homeroom1}`).get()).get('code'));
r = await callAs(ADMIN, 'adminPublish', { teachers: { upsert: [{ id: 'newTeacherX', name: '새교사', code: anyCode, homeroom: null, isAdmin: false }], remove: [] } });
check('다른 교사와 같은 코드 → 거부', r.error?.status === 'INVALID_ARGUMENT', r.error?.message);

// ── 강좌 추가·삭제
const newC: CourseInput = { ...input(p02), id: 'NEW-test01', code: 'P99', name: '새 강좌', teacherIds: [], capacity: 5 };
r = await callAs(ADMIN, 'adminPublish', { courses: { upsert: [newC], remove: [] } });
check('강좌 추가', r.result?.ok === true && (await course('NEW-test01')).count === 0, r.error?.message);
await callAs(await studentToken('30103'), 'applyCourse', { courseId: 'NEW-test01' });
r = await callAs(ADMIN, 'adminPublish', { courses: { upsert: [], remove: ['NEW-test01'] } });
const app3 = (await db.doc('applications/30103').get()).data()!;
check('신청자 있는 강좌 삭제 → 그 학생 신청도 빠지고 미제출', r.result?.ok === true && !app3.items['NEW-test01'] && app3.submitted === false);
check('→ 강좌 문서 삭제', !(await db.doc('courses/NEW-test01').get()).exists);

// ── 학생 추가·삭제
r = await callAs(ADMIN, 'adminPublish', { students: { upsert: [{ sid: '30998', name: '추가학생', phone: '010-5555-6666' }], remove: [] } });
const sec = (await db.doc('studentSecrets/30998').get()).data();
check('학생 추가 + 연락처 숫자만 저장', r.result?.ok === true && sec?.phone === '01055556666' && sec?.classNo === 9);
await callAs(await studentToken('30998'), 'applyCourse', { courseId: 'P04-1201' });
r = await callAs(ADMIN, 'adminPublish', { students: { upsert: [], remove: ['30998'] } });
check('신청한 학생 삭제 → 신청 인원도 줄어듦', r.result?.ok === true && (await course('P04-1201')).count === 0 && !(await db.doc('students/30998').get()).exists);

// ── 수동 배정
await setPeriod('closed');
r = await callAs(ADMIN, 'adminAssign', { sid: '30104', add: 'P05-1201' });
check('마감 후에도 수동 배정 가능', r.result?.ok === true, r.error?.message);
r = await callAs(ADMIN, 'adminAssign', { sid: '30104', add: 'P06-1201' });
check('수동 배정도 같은 날 선택 2개는 거부', r.error?.details?.reason === 'SAME_DATE');
r = await callAs(ADMIN, 'adminAssign', { sid: '30104', add: 'P06-1201', remove: 'P05-1201' });
const app4 = (await db.doc('applications/30104').get()).data()!;
check('변경(빼고 넣기) 한 번에', r.result?.ok === true && !!app4.items['P06-1201'] && !app4.items['P05-1201'] && app4.items['P06-1201'].by === 'admin');
await callAs(ADMIN, 'adminAssign', { sid: '30104', add: 'P09-1202' });
r = await callAs(ADMIN, 'adminAssign', { sid: '30104', add: 'P09-1201', remove: 'P06-1201' });
check('수동 배정도 같은 코드 중복은 거부', r.error?.details?.reason === 'DUP_CODE');
// 정원 10명 강좌에 11명 → 마지막은 경고만
let last: Awaited<ReturnType<typeof callAs>> | null = null;
for (let n = 1; n <= 11; n++) last = await callAs(ADMIN, 'adminAssign', { sid: `302${String(n).padStart(2, '0')}`, add: 'P27-1209' });
const w = (last as unknown as { result?: { warning?: string } }).result?.warning;
check('수동 배정은 정원 초과 허용(경고만)', !!w && (await course('P27-1209')).count === 11, w);

// ── 인원 수 점검
await db.doc('courses/P27-1209').update({ count: 3 });
r = await callAs(ADMIN, 'adminRecount', {});
check('어긋난 인원 수를 실제 신청 수로 고침', (await course('P27-1209')).count === 11);
const shards = await db.collection('courses/P01-1130/shards').get();
check('정원 없는 강좌는 shard 로 다시 셈', shards.docs.reduce((s, d) => s + Number(d.get('count')), 0) === 1);

// ── 되돌리기
await resetApplications();
for (const d of (await db.collection('attendance').get()).docs) await db.recursiveDelete(d.ref);
for (const d of (await db.collection('courses').get()).docs) if (!backupCourses.some((b) => b.id === d.id)) await db.recursiveDelete(d.ref);
for (const b of backupCourses) await db.doc(`courses/${b.id}`).set({ ...b.data, count: 0 });
if (backupTimetable) await db.doc('config/timetable').set(backupTimetable);
if (backupPeriod) await db.doc('config/period').set(backupPeriod);
await db.doc('students/30998').delete();
await db.doc('studentSecrets/30998').delete();
finish('admin 기능 시험');
