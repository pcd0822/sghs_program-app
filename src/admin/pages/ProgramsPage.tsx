import { Presentation, Ticket, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { CourseInput } from '@shared/admin';
import type { Course } from '@shared/types';
import { formatDate, timeRange } from '@/lib/format';
import { CourseThumb } from '@/ui/CourseThumb';
import { Pill } from '@/ui/Pill';
import { enrolled, toCourseInput, useAdmin } from '../AdminData';
import { CourseEditor, newCourseInput } from '../CourseEditor';
import { TeacherPicker } from '../TeacherPicker';
import { Card, DirtyDot, PageHead, SmallButton, TableWrap, SearchBox } from '../ui';

export default function ProgramsPage() {
  const a = useAdmin();
  const [date, setDate] = useState<string>('all');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<{ c: CourseInput; isNew: boolean } | null>(null);
  const [assignMode, setAssignMode] = useState(false);

  const dates = useMemo(() => [...new Set(a.courses.map((c) => c.date))].sort(), [a.courses]);
  const teacherName = new Map(a.teachers.map((t) => [t.id, t.name]));
  const list = a.courses.filter((c) => (date === 'all' || c.date === date) && (!q || `${c.name}${c.code}${c.place}`.includes(q.trim())));
  const removed = [...a.dirtyKeys.courses].filter((id) => !a.courses.some((c) => c.id === id));

  const open = (c: Course) => setEditing({ c: toCourseInput(c), isNew: false });
  const add = () => setEditing({ c: newCourseInput(new Set(a.courses.map((c) => c.id)), a.courses.length + 1), isNew: true });

  return (
    <div className="space-y-4">
      <PageHead
        icon={Ticket}
        title="프로그램·담당교사"
        desc={`강좌 ${a.courses.length}개 · 고친 내용은 "저장 및 배포"를 눌러야 반영돼요.`}
        actions={
          <>
            <SmallButton onClick={() => setAssignMode((v) => !v)} tone={assignMode ? 'dark' : 'default'}>
              <Presentation size={16} aria-hidden /> 담당교사 배정 {assignMode ? '끝내기' : '모드'}
            </SmallButton>
            <SmallButton tone="brand" onClick={add}>
              ＋ 강좌 추가
            </SmallButton>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <SearchBox placeholder="강좌명·코드·장소" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
          {['all', ...dates].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDate(d)}
              className={`min-h-9 shrink-0 rounded-full px-3 text-[13px] font-bold ${date === d ? 'bg-ink text-white' : 'bg-white text-sub ring-1 ring-line'}`}
            >
              {d === 'all' ? '전체' : formatDate(d)}
            </button>
          ))}
        </div>
      </div>
      {removed.length > 0 && <p className="rounded-2xl bg-rose-50 px-4 py-2 text-[14px] font-semibold text-rose-600"><Trash2 size={15} className="mr-1 inline" aria-hidden />삭제 예정 강좌 {removed.length}개 (저장 및 배포 시 삭제)</p>}

      {assignMode ? (
        <Card>
          <p className="mb-3 text-[14px] text-sub">이름을 입력하면 일치하는 교사만 목록에 나와요. 강좌마다 여러 명을 지정할 수 있어요.</p>
          <ul className="divide-y divide-line">
            {list.map((c) => (
              <li key={c.id} className="grid gap-2 py-3 lg:grid-cols-[1fr_420px] lg:items-start">
                <div>
                  <p className="text-[13px] text-sub">
                    {formatDate(c.date)} {timeRange(c)} · {c.code}
                  </p>
                  <p className="font-bold">
                    {c.name} {a.dirtyKeys.courses.has(c.id) && <DirtyDot />}
                  </p>
                </div>
                <TeacherPicker teachers={a.teachers} value={c.teacherIds} onChange={(ids) => a.setCourse({ ...toCourseInput(c), teacherIds: ids })} />
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <>
          {/* 컴퓨터: 넓은 표 */}
          <Card className="hidden lg:block">
            <TableWrap>
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>분류</th>
                  <th>코드</th>
                  <th>강좌</th>
                  <th>시간</th>
                  <th>장소</th>
                  <th className="text-right">신청/정원</th>
                  <th>표시</th>
                  <th>담당교사</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((c) => {
                  const n = enrolled(a, c);
                  const over = c.capacity !== null && n > c.capacity;
                  const under = c.fixedSize && c.capacity !== null && n < c.capacity;
                  return (
                    <tr key={c.id} className={`hover:bg-soft ${a.dirtyKeys.courses.has(c.id) ? 'bg-orange-50/50' : ''}`}>
                      <td className="whitespace-nowrap">{formatDate(c.date)}</td>
                      <td>{c.category === '필수' ? <Pill tone="purple">필수</Pill> : <Pill tone="blue">선택</Pill>}</td>
                      <td className="font-mono text-[13px]">{c.code}</td>
                      <td className="max-w-[260px]">
                        <button type="button" onClick={() => open(c)} className="text-left font-bold hover:underline">
                          {c.name}
                        </button>{' '}
                        {a.dirtyKeys.courses.has(c.id) && <DirtyDot />}
                      </td>
                      <td className="whitespace-nowrap text-sub">{timeRange(c)}</td>
                      <td className="max-w-[160px] truncate text-sub">{c.place}</td>
                      <td className={`text-right font-bold tabular-nums ${over ? 'text-rose-600' : under ? 'text-orange-600' : ''}`}>
                        {n}/{c.capacity ?? '∞'}
                      </td>
                      <td className="space-x-1 whitespace-nowrap">
                        {c.selfPay && <Pill tone="orange">자부담</Pill>}
                        {c.fixedSize && <Pill tone={under ? 'red' : 'gray'}>인원고정</Pill>}
                        {c.closeAt !== null && <Pill tone="gray">개별마감</Pill>}
                      </td>
                      <td className="max-w-[160px] truncate">{c.teacherIds.map((id) => teacherName.get(id) ?? '?').join(', ') || <span className="text-zinc-300">미배정</span>}</td>
                      <td>
                        <SmallButton onClick={() => open(c)}>편집</SmallButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </TableWrap>
          </Card>

          {/* 휴대폰: 카드 목록 */}
          <ul className="space-y-2 lg:hidden">
            {list.map((c) => {
              const n = enrolled(a, c);
              return (
                <li key={c.id}>
                  <button type="button" onClick={() => open(c)} className="flex w-full gap-3 rounded-3xl bg-white p-3 text-left ring-1 ring-line active:scale-[0.99]">
                    <CourseThumb type={c.type} name={c.name} url={c.thumbnailUrl} className="size-16 shrink-0 rounded-2xl" />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1 text-[12px] text-sub">
                        {formatDate(c.date)} · {c.code} {c.selfPay && <Pill tone="orange">자부담</Pill>} {c.fixedSize && <Pill tone="gray">인원고정</Pill>}
                        {a.dirtyKeys.courses.has(c.id) && <DirtyDot />}
                      </span>
                      <span className="block truncate font-bold">{c.name}</span>
                      <span className="block text-[13px] text-sub">
                        {timeRange(c)} · 신청 {n}/{c.capacity ?? '∞'} · {c.teacherIds.map((id) => teacherName.get(id)).join(', ') || '담당 미배정'}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {editing && <CourseEditor initial={editing.c} isNew={editing.isNew} onClose={() => setEditing(null)} />}
    </div>
  );
}
