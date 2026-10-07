import { CalendarDays, Puzzle, Ticket } from 'lucide-react';
import { Eyebrow } from '@/ui/Glyph';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FixedEvent } from '@shared/types';
import { eventIcon, FixedEventSheet, WeekView, type Block } from '@/timetable/WeekView';
import { useStudent } from './StudentData';

export default function TimetablePage() {
  const { timetable, items, byId, courses, prog, openCourse } = useStudent();
  const nav = useNavigate();
  const [ev, setEv] = useState<FixedEvent | null>(null);
  const fixed = timetable?.fixedEvents ?? [];

  function blocksFor(date: string): Block[] {
    const out: Block[] = fixed
      .filter((e) => e.date === date)
      .map((e) => ({
        key: e.id,
        start: e.start,
        end: e.end,
        title: e.title,
        sub: e.place,
        icon: eventIcon(e.title),
        tone: 'fixed',
        onClick: () => setEv(e),
      }));
    for (const [id, it] of Object.entries(items)) {
      const c = byId.get(id);
      if (!c || it.date !== date) continue;
      out.push({
        key: id,
        start: c.start,
        end: c.end,
        title: c.name,
        sub: `${it.category === '필수' ? '필수' : '선택'} · ${c.place}`,
        icon: Ticket,
        tone: 'mine',
        onClick: () => openCourse(c),
      });
    }
    // 아직 신청하지 않은 칸도 그 강좌들이 열리는 시간 자리에 끼워 넣는다.
    for (const m of (prog?.missing ?? []).filter((x) => x.date === date)) {
      let start = m.course?.start ?? '';
      let end = m.course?.end ?? '';
      if (m.kind === 'selective') {
        const sel = (courses ?? []).filter((c) => c.date === date && c.category === '선택');
        start = sel.reduce((v, c) => (c.start < v ? c.start : v), '99:99');
        end = sel.reduce((v, c) => (c.end > v ? c.end : v), '00:00');
      }
      out.push({
        key: `missing-${m.kind}-${m.course?.id ?? date}`,
        start,
        end,
        title: '아직 신청하지 않았어요',
        sub: m.kind === 'required' ? `필수 「${m.course?.name}」 · 눌러서 신청하러 가기` : '선택 강좌 1개 고르기 · 눌러서 신청하러 가기',
        icon: Puzzle,
        tone: 'missing',
        onClick: () => nav(`/s#d-${date}`),
      });
    }
    return out;
  }

  return (
    <main className="px-5 pt-[max(env(safe-area-inset-top),16px)]">
      <Eyebrow icon={CalendarDays} tone="amber">시간표</Eyebrow>
      <h1 className="text-[24px] font-extrabold tracking-tight">나의 2주 일정</h1>
      <div className="mt-2">
        {timetable === undefined ? (
          <div className="mt-4 space-y-4">
            {[0, 1].map((i) => (
              <div key={i} className="h-48 animate-pulse rounded-[28px] bg-soft" />
            ))}
          </div>
        ) : (
          <WeekView blocksFor={blocksFor} notes={timetable?.dayNotes ?? []} />
        )}
      </div>
      <FixedEventSheet ev={ev} onClose={() => setEv(null)} />
    </main>
  );
}
