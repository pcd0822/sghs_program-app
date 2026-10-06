/**
 * 에뮬레이터에서 수강신청 규칙(4장)을 시험한다.  (npm run emu, npm run seed:emu 후)
 *   npm run test:apply
 * 주의: 시험장의 신청 자료를 모두 지우고 시작한다.
 */

import { callAs, check, db, finish, resetApplications, setPeriod, studentToken } from './emu-util';

await resetApplications();
const A = await studentToken('30101');
const B = await studentToken('30102');

// 신청 기간
await setPeriod('closed');
let r = await callAs(A, 'applyCourse', { courseId: 'P02-1201' });
check('기간 밖 신청 → 거부', r.error?.details?.reason === 'CLOSED', r.error?.message);
await setPeriod('open');

// 기본 신청
r = await callAs(A, 'applyCourse', { courseId: 'P02-1201' });
check('선택 강좌 신청', r.result?.ok === true);
r = await callAs(A, 'applyCourse', { courseId: 'P02-1201' });
check('같은 강좌 다시 눌러도 한 번만(멱등)', r.result?.already === true);
let course = (await db.doc('courses/P02-1201').get()).data()!;
check('인원 수 1 증가', course.count === 1, `count=${course.count}`);

// 같은 날 선택 2개
r = await callAs(A, 'applyCourse', { courseId: 'P03-1201' });
check('같은 날 선택 2개 → 거부', r.error?.details?.reason === 'SAME_DATE', r.error?.message);

// 같은 코드 중복 (P09: 12.1.과 12.2.)
await callAs(B, 'applyCourse', { courseId: 'P09-1201' });
r = await callAs(B, 'applyCourse', { courseId: 'P09-1202' });
check('같은 프로그램코드 다른 날 → 거부', r.error?.details?.reason === 'DUP_CODE', r.error?.message);
// P13 A반 → B반
await callAs(A, 'applyCourse', { courseId: 'P13-1202-1' });
r = await callAs(A, 'applyCourse', { courseId: 'P13-1202-2' });
check('P13 A반 신청 후 B반 → 거부', r.error?.details?.reason === 'DUP_CODE');

// 자부담 확인
r = await callAs(A, 'applyCourse', { courseId: 'P20-1209' });
check('자부담 강좌 확인 없이 → 거부', r.error?.details?.reason === 'SELF_PAY_CONFIRM');
r = await callAs(A, 'applyCourse', { courseId: 'P20-1209', confirmSelfPay: true });
check('자부담 확인 후 → 신청', r.result?.ok === true);
r = await callAs(A, 'applyCourse', { courseId: 'P20-1210', confirmSelfPay: true });
check('만화카페 12.9. 신청 후 12.10. → 거부', r.error?.details?.reason === 'DUP_CODE');

// 필수(정원 없음) — shard 카운터
r = await callAs(A, 'applyCourse', { courseId: 'P01-1130' });
check('필수 강좌 신청', r.result?.ok === true);
const shards = await db.collection('courses/P01-1130/shards').get();
const total = shards.docs.reduce((s, d) => s + (d.get('count') as number), 0);
course = (await db.doc('courses/P01-1130').get()).data()!;
check('필수 강좌는 강좌 문서가 아닌 shard 로 셈', total === 1 && course.count === 0, `shard 합=${total}, 문서 count=${course.count}`);

// 제출: 아직 빠진 것 있음
r = await callAs(A, 'submitApplication', {});
check('빠진 강좌 있으면 제출 거부 + 무엇이 빠졌는지', r.error?.details?.reason === 'INCOMPLETE' && /12\.3\.|12\.10\./.test(r.error.message), r.error?.message);

// 나머지 채우기: 12.3. 필수, 12.10. 선택
await callAs(A, 'applyCourse', { courseId: 'P18-1203' });
await callAs(A, 'applyCourse', { courseId: 'P24-1210' });
r = await callAs(A, 'submitApplication', {});
check('모두 채우면 제출', r.result?.ok === true);
let app = (await db.doc('applications/30101').get()).data()!;
check('제출 상태 저장', app.submitted === true);

// 제출 후 취소 → 미제출
r = await callAs(A, 'cancelCourse', { courseId: 'P24-1210' });
app = (await db.doc('applications/30101').get()).data()!;
check('제출 후 취소 → 미제출로 돌아감', r.result?.ok === true && app.submitted === false && !app.items['P24-1210']);
course = (await db.doc('courses/P24-1210').get()).data()!;
check('취소하면 인원 수 감소', course.count === 0, `count=${course.count}`);
const enr = await db.doc('enrollments/P24-1210__30101').get();
check('취소하면 출석부 명단에서도 빠짐', !enr.exists);
r = await callAs(A, 'cancelCourse', { courseId: 'P24-1210' });
check('이미 취소한 강좌 다시 취소해도 안전(멱등)', r.result?.already === true);

// 강좌별 개별 마감
await db.doc('courses/P25-1210').update({ closeAt: Date.now() - 1000 });
r = await callAs(A, 'applyCourse', { courseId: 'P25-1210' });
check('개별 마감된 강좌 → 거부', r.error?.details?.reason === 'CLOSED', r.error?.message);
await db.doc('courses/P25-1210').update({ closeAt: null });

// 교사·로그인 안 한 사람은 신청 불가
const res = await fetch('http://127.0.0.1:5001/demo-sghs/asia-northeast3/applyCourse', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ data: { courseId: 'P02-1201' } }),
});
check('로그인 안 하면 신청 불가', ((await res.json()) as { error?: { status?: string } }).error?.status === 'UNAUTHENTICATED');

// 미니 동시 시험: 학생 40명이 정원 10명 강좌(P27-1209)에 동시에
const sids = Array.from({ length: 40 }, (_, i) => `3${String(2 + Math.floor(i / 20)).padStart(2, '0')}${String((i % 20) + 1).padStart(2, '0')}`);
const tokens = await Promise.all(sids.map(studentToken));
const results = await Promise.all(tokens.map((t) => callAs(t, 'applyCourse', { courseId: 'P27-1209' })));
const ok = results.filter((x) => x.result?.ok).length;
const full = results.filter((x) => x.error?.details?.reason === 'FULL').length;
course = (await db.doc('courses/P27-1209').get()).data()!;
const enrolled = (await db.collection('enrollments').where('courseId', '==', 'P27-1209').count().get()).data().count;
check('40명 동시 → 정확히 10명 성공', ok === 10 && course.count === 10 && enrolled === 10, `성공 ${ok}, 정원마감 ${full}, 기타 ${40 - ok - full}, count=${course.count}, 명단=${enrolled}`);

await resetApplications();
finish('수강신청 규칙 시험');
