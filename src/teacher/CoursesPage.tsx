import type { Course } from '@shared/types';
import { CourseRow, CourseRowSkeleton, TopLists } from '@/courses/CourseParts';
import { formatDate, timeRange } from '@/lib/format';
import { Pill } from '@/ui/Pill';
import { useTeacher } from './TeacherData';

/** 학생과 같은 강좌 목록·상세·Top 5. 신청 버튼 없음, 내 담당 강좌 강조. */
export default function CoursesPage() {
  const { me, courses, myCourses, tid, openCourse } = useTeacher();
  const byDate = new Map<string, Course[]>();
  for (const c of courses ?? []) byDate.set(c.date, [...(byDate.get(c.date) ?? []), c]);

  return (
    <main className="px-5 pt-[max(env(safe-area-inset-top),16px)]">
      <p className="pt-2 text-[14px] font-semibold text-sub">🎟️ 강좌</p>
      <h1 className="text-[24px] font-extrabold tracking-tight">{me?.name ? `${me.name} 선생님, 안녕하세요` : '안녕하세요'}</h1>

      <section className="mt-3 rounded-[28px] bg-gradient-to-br from-brand-50 via-white to-orange-50 p-4 ring-1 ring-line">
        <p className="text-[15px] font-bold">📚 내가 맡은 강좌 {myCourses.length}개</p>
        {myCourses.length === 0 ? (
          <p className="mt-1 text-[14px] text-sub">아직 배정된 강좌가 없어요. 배정은 관리자가 대시보드에서 해요.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {myCourses.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => openCourse(c)} className="flex min-h-11 w-full items-center gap-2 rounded-2xl bg-white px-3 text-left text-[14px] shadow-sm ring-1 ring-line">
                  <span className="shrink-0 font-semibold text-sub">{formatDate(c.date)}</span>
                  <span className="flex-1 truncate font-bold">{c.name}</span>
                  <span className="shrink-0 text-[12px] text-sub">{timeRange(c)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-7">{courses ? <TopLists courses={courses} onOpen={openCourse} /> : <div className="h-52 animate-pulse rounded-3xl bg-soft" />}</div>

      <div className="mt-8 space-y-8">
        {!courses && [0, 1, 2].map((i) => <CourseRowSkeleton key={i} />)}
        {[...byDate].map(([date, list]) => (
          <section key={date}>
            <div className="flex items-center gap-2 px-1">
              <h2 className="text-[19px] font-extrabold">{formatDate(date)}</h2>
              {list.every((c) => c.category === '필수') ? <Pill tone="purple">필수</Pill> : <Pill tone="blue">선택</Pill>}
              <span className="ml-auto text-[13px] text-sub">{list.length}개</span>
            </div>
            <div className="mt-1">
              {list.map((c) => (
                <CourseRow key={c.id} c={c} highlight={c.teacherIds?.includes(tid)} onOpen={openCourse} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
