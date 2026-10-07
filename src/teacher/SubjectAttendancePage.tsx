import { BookOpenCheck, Inbox } from 'lucide-react';
import { EmptyArt, Eyebrow } from '@/ui/Glyph';
import { collection, query, where } from 'firebase/firestore';
import { useSearchParams } from 'react-router-dom';
import type { Course } from '@shared/types';
import { useQueryDocs } from '@/data/live';
import { db } from '@/lib/firebase';
import { formatDate, timeRange } from '@/lib/format';
import { CourseThumb } from '@/ui/CourseThumb';
import { PinIcon } from '@/ui/Icons';
import { AttendCheck, Avatar, toAttendanceMap, useAttendanceToggle, type AttendanceDoc } from './attendance';
import { useTeacher } from './TeacherData';

interface Enrollment {
  courseId: string;
  sid: string;
  name: string;
  classNo: number;
  number: number;
  photoUrl: string | null;
  date: string;
}

/** 교과수업출결: 내게 배정된 강좌 목록 → 강좌를 고르면 수강생 출석부 */
export default function SubjectAttendancePage() {
  const { myCourses, courses } = useTeacher();
  const [params, setParams] = useSearchParams();
  const selected = myCourses.find((c) => c.id === params.get('c')) ?? null;

  if (selected) return <Roster c={selected} onBack={() => setParams({})} />;

  return (
    <main className="px-5 pt-[max(env(safe-area-inset-top),16px)]">
      <Eyebrow icon={BookOpenCheck} tone="mint">교과수업출결</Eyebrow>
      <h1 className="text-[24px] font-extrabold tracking-tight">내 담당 강좌 출석부</h1>
      {!courses ? (
        <div className="mt-4 h-40 animate-pulse rounded-3xl bg-soft" />
      ) : myCourses.length === 0 ? (
        <div className="mt-16 text-center text-sub">
          <EmptyArt icon={Inbox} tone="slate" />
          <p className="mt-3">아직 배정된 강좌가 없어요.</p>
          <p className="text-[14px]">배정은 관리자가 대시보드에서 해요.</p>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {myCourses.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setParams({ c: c.id })}
                className="flex w-full items-center gap-3 rounded-3xl p-3 text-left ring-1 ring-line transition hover:bg-soft active:scale-[0.99]"
              >
                <CourseThumb type={c.type} name={c.name} url={c.thumbnailUrl} className="size-14 rounded-2xl" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-sub">
                    {formatDate(c.date)} {timeRange(c)}
                  </span>
                  <span className="block truncate text-[16px] font-bold">{c.name}</span>
                  <span className="flex items-center gap-1 text-[13px] text-sub">
                    <PinIcon /> {c.place}
                  </span>
                </span>
                <span className="text-sub" aria-hidden>
                  ›
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function Roster({ c, onBack }: { c: Course; onBack(): void }) {
  const { tid } = useTeacher();
  // 규칙상 교과 교사는 "자기에게 배정된" 수강생·출결만 읽을 수 있으므로 쿼리에도 그 조건을 넣는다.
  const roster = useQueryDocs<Enrollment>(`enr-${c.id}-${tid}`, () =>
    query(collection(db, 'enrollments'), where('courseId', '==', c.id), where('teacherIds', 'array-contains', tid)),
  );
  const att = useQueryDocs<AttendanceDoc>(`att-${c.date}-${tid}`, () =>
    query(collection(db, 'attendance'), where('date', '==', c.date), where('viewerTeacherIds', 'array-contains', tid)),
  );
  const attMap = toAttendanceMap(att);
  const { pending, toggle } = useAttendanceToggle(c.date);
  const list = [...(roster ?? [])].sort((a, b) => a.sid.localeCompare(b.sid));
  const absentCount = list.filter((s) => attMap.get(s.sid)?.absent).length;

  return (
    <main className="px-5 pt-[max(env(safe-area-inset-top),16px)]">
      <button type="button" onClick={onBack} className="-ml-3 flex min-h-11 items-center gap-1 rounded-full px-3 text-[15px] font-semibold text-sub hover:bg-soft">
        ‹ 강좌 목록
      </button>
      <h1 className="mt-1 text-[22px] leading-snug font-extrabold">{c.name}</h1>
      <p className="mt-0.5 text-[14px] text-sub">
        {formatDate(c.date)} {timeRange(c)} · {c.place}
      </p>

      <div className="sticky top-0 z-10 -mx-5 mt-3 flex gap-2 bg-white/90 px-5 py-2 backdrop-blur">
        <span className="rounded-full bg-soft px-3 py-1.5 text-[14px] font-bold">수강생 {list.length}명</span>
        <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[14px] font-bold text-emerald-700">출석 {list.length - absentCount}</span>
        <span className="rounded-full bg-rose-50 px-3 py-1.5 text-[14px] font-bold text-rose-600">결과 {absentCount}</span>
      </div>
      <p className="text-[13px] text-sub">체크하면 "결과", 비워 두면 "출석"이에요. 담임 선생님의 학급출결과 같은 기록이에요.</p>

      {!roster ? (
        <div className="mt-3 space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-soft" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <p className="mt-10 text-center text-sub">아직 신청한 학생이 없어요.</p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {list.map((s) => (
            <li key={s.sid} className="flex items-center gap-3 py-2.5">
              <Avatar url={s.photoUrl} name={s.name} size={44} />
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-bold">{s.name}</p>
                <p className="text-[13px] text-sub tabular-nums">{s.sid}</p>
              </div>
              <AttendCheck
                checked={!!attMap.get(s.sid)?.absent}
                pending={pending[s.sid]}
                onLabel="결과"
                offLabel="출석"
                meta={attMap.get(s.sid)}
                onChange={(v) => toggle(s.sid, v)}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
