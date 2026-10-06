import { useState } from 'react';
import type { FixedEvent } from '@shared/types';
import { eventEmoji, FixedEventSheet, WeekView, type Block } from '@/timetable/WeekView';
import { courseEmoji } from '@/ui/CourseThumb';
import { useTeacher } from './TeacherData';

/** 주차별 전체 일정: 고정 일정 + 그날 열리는 강좌 전부. 내 담당 강좌는 강조. */
export default function TeacherTimetablePage() {
  const { timetable, courses, tid, openCourse } = useTeacher();
  const [ev, setEv] = useState<FixedEvent | null>(null);

  function blocksFor(date: string): Block[] {
    const out: Block[] = (timetable?.fixedEvents ?? [])
      .filter((e) => e.date === date)
      .map((e) => ({ key: e.id, start: e.start, end: e.end, title: e.title, sub: e.place, emoji: eventEmoji(e.title), tone: 'fixed', onClick: () => setEv(e) }));
    for (const c of (courses ?? []).filter((x) => x.date === date)) {
      const mine = c.teacherIds?.includes(tid);
      out.push({
        key: c.id,
        start: c.start,
        end: c.end,
        title: c.name,
        sub: `${mine ? '⭐ 내 담당 · ' : ''}${c.place}`,
        emoji: courseEmoji(c.type, c.name),
        tone: mine ? 'mine' : 'course',
        compact: true,
        onClick: () => openCourse(c),
      });
    }
    return out;
  }

  return (
    <main className="px-5 pt-[max(env(safe-area-inset-top),16px)]">
      <p className="pt-2 text-[14px] font-semibold text-sub">🗓️ 시간표</p>
      <h1 className="text-[24px] font-extrabold tracking-tight">전체 일정</h1>
      <div className="mt-2">
        {timetable === undefined || !courses ? (
          <div className="mt-4 h-64 animate-pulse rounded-[28px] bg-soft" />
        ) : (
          <WeekView blocksFor={blocksFor} notes={timetable?.dayNotes ?? []} />
        )}
      </div>
      <FixedEventSheet ev={ev} onClose={() => setEv(null)} />
    </main>
  );
}
