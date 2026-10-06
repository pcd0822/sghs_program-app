/**
 * 시험용 자료를 한 번에 지운다(실제 운영 전 초기화).
 *
 *   npm run purge -- --emulator            시험장에서 무엇이 지워질지 보기
 *   npm run purge -- --emulator --yes      시험장에서 지우기
 *   npm run purge                          실서버에서 무엇이 지워질지 보기(지우지 않음)
 *   npm run purge -- --yes                 실서버에서 지우기
 *
 * 지우는 것: 신청 내역(applications·enrollments), 신청 인원 수(0으로), 출결(+변경 기록), 문의 글(공지는 남김),
 *           가입 신청, 로그인 실패 기록·잠금
 * 남기는 것: 학생·교사 명단, 연락처, 강좌, 시간표, 신청 기간, 공지, 프로필 사진
 *   --with-notices 를 붙이면 공지도 지운다.
 */

import { connect } from './admin-connect';

const YES = process.argv.includes('--yes');
const WITH_NOTICES = process.argv.includes('--with-notices');
const { db } = connect('시험 자료 삭제');

const plan: { label: string; refs: FirebaseFirestore.DocumentReference[]; recursive?: boolean }[] = [];
const add = async (label: string, name: string, filter?: (d: FirebaseFirestore.QueryDocumentSnapshot) => boolean, recursive = false) => {
  const docs = (await db.collection(name).get()).docs.filter((d) => !filter || filter(d));
  plan.push({ label, refs: docs.map((d) => d.ref), recursive });
};

await add('신청 내역(학생별)', 'applications');
await add('출석부 명단(강좌별 신청)', 'enrollments');
await add('출결 기록(+변경 기록)', 'attendance', undefined, true);
await add(WITH_NOTICES ? '문의 글·공지' : '문의 글(공지 제외)', 'inquiries', (d) => WITH_NOTICES || d.get('isNotice') !== true);
await add('문의 작성자 정보', 'inquiryAuthors');
await add('가입 신청', 'signupRequests');
await add('로그인 실패 기록', 'adminLoginLogs');
await add('로그인 잠금', 'loginGuards');
const shards = (await db.collectionGroup('shards').get()).docs;
const courses = (await db.collection('courses').get()).docs;
const counted = courses.filter((c) => Number(c.get('count') ?? 0) !== 0);

console.log('\n지울 자료:');
for (const p of plan) console.log(`  · ${p.label}: ${p.refs.length}건`);
console.log(`  · 정원 없는 강좌 인원 수 칸: ${shards.length}건`);
console.log(`  · 신청 인원 수를 0으로 되돌릴 강좌: ${counted.length}개`);

if (!YES) {
  console.log('\n(보기만 했어요) 정말 지우려면 --yes 를 붙여 다시 실행해 주세요.');
  process.exit(0);
}

const bw = db.bulkWriter();
for (const p of plan) {
  for (const r of p.refs) {
    if (p.recursive) await db.recursiveDelete(r);
    else bw.delete(r);
  }
}
for (const s of shards) bw.delete(s.ref);
for (const c of counted) bw.update(c.ref, { count: 0 });
await bw.close();
console.log('\n✅ 시험 자료를 지웠어요. 대시보드 현황판에서 "인원 수 점검"으로 한 번 더 확인해 보세요.');
