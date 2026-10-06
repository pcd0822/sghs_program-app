/**
 * 수강신청 종료 후 전체 자료를 엑셀 한 파일로 보관한다.
 *   npm run export -- --yes            실서버 → seed/backup/전체자료_날짜.xlsx
 *   npm run export -- --emulator       시험장
 * 결과 파일에는 학생 연락처가 들어 있으므로 seed/ 폴더(깃허브에 안 올라감)에 저장한다. 교사 코드는 넣지 않는다.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { formatDate } from '../shared/text';
import { connect } from './admin-connect';

if (!process.argv.includes('--emulator') && !process.argv.includes('--yes')) {
  console.error('실서버 자료를 내려받으려면 --yes 를 붙여 주세요:  npm run export -- --yes');
  process.exit(1);
}
const { db } = connect('전체 자료 보관');
const get = async (name: string) => (await db.collection(name).get()).docs.map((d) => ({ _id: d.id, ...d.data() })) as Record<string, any>[];

const [students, secrets, teachers, courses, apps, attendance, inquiries, authors] = await Promise.all(
  ['students', 'studentSecrets', 'teachers', 'courses', 'applications', 'attendance', 'inquiries', 'inquiryAuthors'].map(get),
);
const phone = new Map(secrets.map((s) => [s._id, s.phone]));
const tName = new Map(teachers.map((t) => [t._id, t.name]));
const time = (ms: number | null | undefined) => (ms ? new Date(ms).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '');
courses.sort((a, b) => `${a.date}${a.start}${a.order}`.localeCompare(`${b.date}${b.start}${b.order}`));
const dates = [...new Set(courses.map((c) => c.date as string))].sort();
const appBySid = new Map(apps.map((a) => [a._id, a]));

const sheets: [string, unknown[][]][] = [
  ['학생', [['학번', '반', '번호', '이름', '연락처'], ...students.sort((a, b) => a._id.localeCompare(b._id)).map((s) => [s._id, s.classNo, s.number, s.name, phone.get(s._id) ?? ''])]],
  [
    '학생별 신청',
    [
      ['학번', '이름', '제출', '제출 시각', ...dates.map(formatDate)],
      ...students.map((s) => {
        const a = appBySid.get(s._id);
        const items = Object.values((a?.items ?? {}) as Record<string, { name: string; date: string }>);
        return [s._id, s.name, a?.submitted ? '제출' : items.length ? '미제출' : '미신청', time(a?.submittedAt), ...dates.map((d) => items.filter((i) => i.date === d).map((i) => i.name).join(', '))];
      }),
    ],
  ],
  [
    '강좌별 명단',
    [
      ['날짜', '강좌', '장소', '학번', '이름', '배정'],
      ...courses.flatMap((c) =>
        apps
          .filter((a) => a.items?.[c._id])
          .sort((x, y) => x._id.localeCompare(y._id))
          .map((a) => [formatDate(c.date), c.name, c.place, a._id, a.name, a.items[c._id].by === 'admin' ? '관리자' : '학생']),
      ),
    ],
  ],
  [
    '강좌',
    [
      ['강좌ID', '분류', '유형', '코드', '날짜', '시간', '강좌', '장소', '강사', '정원', '신청', '자부담', '인원고정', '담당교사'],
      ...courses.map((c) => [
        c._id, c.category, c.type, c.code, formatDate(c.date), `${c.start}~${c.end}`, c.name, c.place, c.instructor,
        c.capacity ?? '제한 없음', apps.filter((a) => a.items?.[c._id]).length, c.selfPay ? 'O' : '', c.fixedSize ? 'O' : '',
        (c.teacherIds ?? []).map((t: string) => tName.get(t) ?? t).join(', '),
      ]),
    ],
  ],
  [
    '출결',
    [
      ['날짜', '학번', '반', '상태', '마지막 변경', '변경 시각'],
      ...attendance.sort((a, b) => `${a.date}${a.sid}`.localeCompare(`${b.date}${b.sid}`)).map((x) => [formatDate(x.date), x.sid, x.classNo, x.absent ? '결석(결과)' : '출석', x.updatedByName, time(x.updatedAt)]),
    ],
  ],
  [
    '문의·공지',
    [
      ['종류', '작성 시각', '작성자', '비밀', '제목', '내용', '답변', '답변 시각'],
      ...inquiries.sort((a, b) => a.createdAt - b.createdAt).map((q) => {
        const au = authors.find((x) => x._id === q._id);
        return [q.isNotice ? '공지' : '문의', time(q.createdAt), au ? `${au.sid} ${au.name}` : q.authorMasked, q.secret ? 'O' : '', q.title, q.body, q.answer ?? '', time(q.answeredAt)];
      }),
    ],
  ],
];

const wb = XLSX.utils.book_new();
for (const [name, rows] of sheets) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
mkdirSync('seed/backup', { recursive: true });
const d = new Date();
const file = `seed/backup/전체자료_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.xlsx`;
// ESM 에서는 XLSX.writeFile 이 파일 시스템을 못 써서 버퍼로 만들어 직접 쓴다
writeFileSync(file, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
console.log(`✅ ${file} 에 저장했어요 (${sheets.map(([n, r]) => `${n} ${r.length - 1}`).join(' · ')})`);
