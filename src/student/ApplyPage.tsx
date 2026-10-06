import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import type { Course } from '@shared/types';
import { CourseRow, CourseRowSkeleton, TopLists } from '@/courses/CourseParts';
import { formatDate } from '@/lib/format';
import { Pill } from '@/ui/Pill';
import { PeriodBanner } from './PeriodBanner';
import { useStudent } from './StudentData';

export default function ApplyPage() {
  const { me, courses, items, prog, app, openCourse, openMyList } = useStudent();
  const { hash } = useLocation();

  // 시간표의 "아직 신청하지 않았어요"에서 넘어오면 그 날짜로 이동
  useEffect(() => {
    if (!hash || !courses) return;
    const el = document.getElementById(decodeURIComponent(hash.slice(1)));
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash, courses]);

  const byDate = new Map<string, Course[]>();
  for (const c of courses ?? []) byDate.set(c.date, [...(byDate.get(c.date) ?? []), c]);
  const count = Object.keys(items).length;

  return (
    <main className="px-5 pt-[max(env(safe-area-inset-top),16px)]">
      <header className="flex items-center justify-between pt-2">
        <div>
          <p className="text-[14px] font-semibold text-sub">🎟️ 수강신청</p>
          <h1 className="text-[24px] font-extrabold tracking-tight">{me?.name ? `${me.name}님, 반가워요 👋` : '반가워요 👋'}</h1>
        </div>
      </header>

      <PeriodBanner />

      {/* 내 진행 상황 */}
      <section className="mt-3 rounded-[28px] bg-gradient-to-br from-brand-50 via-white to-orange-50 p-4 ring-1 ring-line">
        <div className="flex flex-wrap items-center gap-1.5">
          {prog ? (
            <>
              <Pill tone="purple">
                필수 {prog.requiredDone}/{prog.requiredTotal}
              </Pill>
              <Pill tone="blue">
                선택 {prog.selectiveDone}/{prog.selectiveTotal}
              </Pill>
              <Pill tone={app?.submitted ? 'green' : 'gray'}>{app?.submitted ? '✅ 제출 완료' : '미제출'}</Pill>
            </>
          ) : (
            <span className="h-5 w-40 animate-pulse rounded-full bg-soft" />
          )}
        </div>
        <p className="mt-2 text-[14px] text-[#45454f]">
          {!prog
            ? ' '
            : app?.submitted
              ? '제출을 마쳤어요. 기간 안에는 바꿀 수 있어요.'
              : prog.complete
                ? '모두 골랐어요! 내 신청 목록에서 제출해 주세요.'
                : `필수 강좌 전부와 날짜마다 선택 강좌 1개씩 골라 주세요.`}
        </p>
        <button
          type="button"
          onClick={openMyList}
          className="mt-3 flex min-h-12 w-full items-center justify-between rounded-2xl bg-white px-4 text-[15px] font-bold shadow-sm ring-1 ring-line active:scale-[0.99]"
        >
          <span>📋 내 신청 목록</span>
          <span className="text-brand-600">
            {count}개 <span aria-hidden>›</span>
          </span>
        </button>
      </section>

      <div className="mt-7">{courses ? <TopLists courses={courses} onOpen={openCourse} /> : <div className="h-52 animate-pulse rounded-3xl bg-soft" />}</div>

      <div className="mt-8 space-y-8">
        {!courses &&
          [0, 1].map((i) => (
            <section key={i}>
              <div className="h-6 w-32 animate-pulse rounded bg-soft" />
              {[0, 1, 2].map((j) => (
                <CourseRowSkeleton key={j} />
              ))}
            </section>
          ))}
        {[...byDate].map(([date, list]) => {
          const required = list[0].category === '필수' && list.every((c) => c.category === '필수');
          const mine = list.filter((c) => items[c.id]);
          const done = required ? mine.length === list.length : mine.some((c) => c.category === '선택');
          return (
            <section key={date} id={`d-${date}`} className="scroll-mt-4">
              <div className="flex items-center gap-2 px-1">
                <h2 className="text-[19px] font-extrabold">{formatDate(date)}</h2>
                {required ? <Pill tone="purple">필수</Pill> : <Pill tone="blue">선택 1개</Pill>}
                <span className={`ml-auto text-[13px] font-semibold ${done ? 'text-emerald-600' : 'text-orange-600'}`}>{done ? '✓ 신청함' : '미신청'}</span>
              </div>
              <div className="mt-1">
                {list.map((c) => (
                  <CourseRow key={c.id} c={c} applied={!!items[c.id]} onOpen={openCourse} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* 목록이 길어 아래로 내려가도 바로 열 수 있게 */}
      <button
        type="button"
        onClick={openMyList}
        className="fixed right-[max(16px,calc(50vw-256px+16px))] bottom-[calc(max(env(safe-area-inset-bottom),12px)+76px)] z-30 flex min-h-12 items-center gap-1.5 rounded-full bg-ink px-4 text-[14px] font-bold text-white shadow-lg active:scale-95"
      >
        📋 내 신청 <span className="rounded-full bg-white/20 px-1.5">{count}</span>
      </button>
    </main>
  );
}
