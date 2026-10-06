// 주차별 시간표: 교시가 아닌 시간 블록. 학생·교사 화면이 함께 쓴다.

import { useState, type ReactNode } from 'react';
import { TIME_ZONE, WEEKS } from '@shared/constants';
import type { DayNote, FixedEvent } from '@shared/types';
import { formatDate, minutes } from '@/lib/format';
import { CalendarIcon, PinIcon } from '@/ui/Icons';
import { Sheet } from '@/ui/Sheet';

export type BlockTone = 'fixed' | 'mine' | 'course' | 'missing';

export interface Block {
  key: string;
  start: string;
  end: string;
  title: string;
  sub?: string;
  emoji?: string;
  tone: BlockTone;
  onClick?(): void;
}

const toneClass: Record<BlockTone, string> = {
  fixed: 'bg-zinc-50 ring-zinc-200 text-ink',
  mine: 'bg-gradient-to-br from-brand-50 to-orange-50 ring-brand-100 text-ink',
  course: 'bg-white ring-line text-ink',
  missing: 'border-2 border-dashed border-orange-300 bg-orange-50/40 ring-transparent text-orange-700',
};

function todayIso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date());
}

/** 오늘이 들어 있는 주차, 없으면 1주차 */
function initialWeek(): number {
  const t = todayIso();
  const i = WEEKS.findIndex((w) => w.dates[0] <= t && t <= w.dates[w.dates.length - 1]);
  return i < 0 ? 0 : i;
}

interface Props {
  /** 날짜별 블록(시간 있는 것) */
  blocksFor(date: string): Block[];
  /** 날짜별 시간 없는 안내 카드(미신청 등) */
  extrasFor?(date: string): ReactNode;
  notes: DayNote[];
}

export function WeekView({ blocksFor, extrasFor, notes }: Props) {
  const [week, setWeek] = useState(initialWeek);
  const w = WEEKS[week];

  return (
    <div>
      <div className="sticky top-0 z-20 -mx-5 flex items-center justify-between bg-white/90 px-5 py-2 backdrop-blur">
        <button type="button" onClick={() => setWeek((x) => x - 1)} className="grid size-11 place-items-center rounded-full text-2xl hover:bg-soft" aria-label="이전 주">
          ‹
        </button>
        <div className="text-center">
          <p className="text-[17px] font-extrabold">{w ? w.label : '다른 주'}</p>
          <p className="text-[12px] text-sub">{w ? `${formatDate(w.dates[0])} ~ ${formatDate(w.dates[w.dates.length - 1])}` : ' '}</p>
        </div>
        <button type="button" onClick={() => setWeek((x) => x + 1)} className="grid size-11 place-items-center rounded-full text-2xl hover:bg-soft" aria-label="다음 주">
          ›
        </button>
      </div>

      {!w ? (
        <div className="mt-16 text-center">
          <div className="text-5xl">🗂️</div>
          <p className="mt-3 font-semibold text-sub">저장된 시간표 정보가 없습니다</p>
          <button type="button" onClick={() => setWeek(week < 0 ? 0 : WEEKS.length - 1)} className="mt-4 min-h-11 rounded-full bg-soft px-5 font-semibold">
            {week < 0 ? '1주차로' : `${WEEKS.length}주차로`} 돌아가기
          </button>
        </div>
      ) : (
        <div className="mt-2 space-y-5">
          {w.dates.map((d) => (
            <DayCard key={d} date={d} blocks={blocksFor(d)} extras={extrasFor?.(d)} notes={notes.filter((n) => n.dates.includes(d))} today={d === todayIso()} />
          ))}
        </div>
      )}
    </div>
  );
}

function DayCard({ date, blocks, extras, notes, today }: { date: string; blocks: Block[]; extras?: ReactNode; notes: DayNote[]; today: boolean }) {
  const sorted = [...blocks].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
  return (
    <section className={`rounded-[28px] p-4 ring-1 ${today ? 'bg-brand-50/40 ring-brand-100' : 'bg-white ring-line'}`}>
      <div className="flex items-center gap-2">
        <h2 className="text-[18px] font-extrabold">{formatDate(date)}</h2>
        {today && <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-bold text-white">오늘</span>}
      </div>
      {notes.map((n) => (
        <p key={n.id} className="mt-1.5 flex gap-1.5 rounded-xl bg-sky-50 px-3 py-2 text-[13px] font-medium text-sky-800">
          <span aria-hidden>📢</span>
          {n.text}
        </p>
      ))}
      <ol className="mt-3 space-y-2">
        {sorted.map((b) => (
          <li key={b.key} className="flex gap-3">
            <div className="w-11 shrink-0 pt-2 text-right text-[12px] leading-tight font-semibold tabular-nums text-sub">
              {b.start}
              <br />
              <span className="font-normal">{b.end}</span>
            </div>
            <button
              type="button"
              onClick={b.onClick}
              disabled={!b.onClick}
              style={{ minHeight: Math.max(56, (minutes(b.end) - minutes(b.start)) * 0.75) }}
              className={`flex flex-1 flex-col items-start rounded-2xl px-3.5 py-2.5 text-left ring-1 transition enabled:active:scale-[0.99] ${toneClass[b.tone]}`}
            >
              <span className="flex items-center gap-1.5 text-[15px] leading-snug font-bold">
                {b.emoji && <span aria-hidden>{b.emoji}</span>}
                {b.title}
              </span>
              {b.sub && <span className="mt-0.5 text-[13px] text-sub">{b.sub}</span>}
            </button>
          </li>
        ))}
      </ol>
      {extras}
      {sorted.length === 0 && !extras && <p className="mt-3 text-[14px] text-sub">일정이 없어요.</p>}
    </section>
  );
}

/** 고정 일정을 눌렀을 때 상세 */
export function FixedEventSheet({ ev, onClose }: { ev: FixedEvent | null; onClose(): void }) {
  return (
    <Sheet open={!!ev} onClose={onClose} title="학교 일정">
      {ev && (
        <div className="pb-4">
          <div className="grid aspect-[4/3] w-full place-items-center rounded-[28px] bg-gradient-to-br from-zinc-100 to-sky-50 text-7xl" aria-hidden>
            {eventEmoji(ev.title)}
          </div>
          <h3 className="mt-4 text-[22px] font-extrabold">{ev.title}</h3>
          <dl className="mt-3 space-y-2.5 rounded-3xl bg-soft p-4 text-[15px]">
            <div className="flex items-center gap-2">
              <CalendarIcon />
              <dt className="w-16 text-sub">날짜·시간</dt>
              <dd className="font-semibold">
                {formatDate(ev.date)} {ev.start}~{ev.end}
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <PinIcon />
              <dt className="w-16 text-sub">장소</dt>
              <dd className="font-semibold">{ev.place || '-'}</dd>
            </div>
          </dl>
          {ev.description && <p className="mt-3 text-[15px] leading-relaxed text-[#45454f]">{ev.description}</p>}
        </div>
      )}
    </Sheet>
  );
}

export function eventEmoji(title: string): string {
  if (/독서/.test(title)) return '📖';
  if (/점심|식사/.test(title)) return '🍱';
  if (/정리/.test(title)) return '🧹';
  if (/영화/.test(title)) return '🎬';
  if (/줍깅|환경/.test(title)) return '🌿';
  if (/진로/.test(title)) return '🧭';
  if (/성적/.test(title)) return '📄';
  return '🏫';
}
