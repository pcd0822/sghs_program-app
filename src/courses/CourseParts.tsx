import { Flame, Sprout, Users, Wallet, type LucideIcon } from 'lucide-react';
import { IconTile, type GlyphTone } from '@/ui/Glyph';
// 강좌 목록·상세·Top 5. 학생과 교사 화면이 함께 쓴다(교사는 신청 버튼 없이).

import type { ReactNode } from 'react';
import { fillRatio, hypeTop, isFull, remaining, roomyTop } from '@shared/rules';
import type { Course } from '@shared/types';
import { formatDate, timeRange } from '@/lib/format';
import { CourseThumb } from '@/ui/CourseThumb';
import { CalendarIcon, ClockIcon, PersonIcon, PinIcon } from '@/ui/Icons';
import { Pill } from '@/ui/Pill';
import { Sheet } from '@/ui/Sheet';

export function seatsText(c: Course): string {
  const r = remaining(c);
  if (r === null) return '전교생 참여';
  return r === 0 ? '마감' : `${r}자리 남음`;
}

/** 강좌명 옆 작은 표시들 */
export function CourseTags({ c }: { c: Course }) {
  return (
    <>
      {c.category === '필수' && <Pill tone="purple">필수</Pill>}
      {c.selfPay && <Pill tone="orange"><Wallet size={12} aria-hidden /> 자부담</Pill>}
    </>
  );
}

interface RowProps {
  c: Course;
  applied?: boolean;
  /** 교사 화면: 내 담당 강좌 강조 */
  highlight?: boolean;
  onOpen(c: Course): void;
}

/** 목록 한 줄: 왼쪽 둥근 정사각형 썸네일 + 겹친 상태 표시, 오른쪽 굵은 강좌명과 시간·장소 */
export function CourseRow({ c, applied, highlight, onOpen }: RowProps) {
  const full = isFull(c);
  const r = remaining(c);
  return (
    <button
      type="button"
      onClick={() => onOpen(c)}
      className={`flex w-full gap-3.5 rounded-3xl px-2 py-3 text-left transition hover:bg-soft active:scale-[0.99] ${highlight ? 'bg-brand-50/60 ring-1 ring-brand-100' : ''}`}
    >
      <div className="relative shrink-0 pb-2">
        <CourseThumb type={c.type} name={c.name} url={c.thumbnailUrl} className={`size-[76px] rounded-2xl ${full && !applied ? 'opacity-50 grayscale' : ''}`} />
        <div className="absolute inset-x-0 bottom-0 flex justify-center">
          {applied ? (
            <Pill tone="green" className="shadow-sm ring-white">✓ 신청</Pill>
          ) : full ? (
            <Pill tone="gray" className="bg-white shadow-sm">마감</Pill>
          ) : r !== null && r <= 5 ? (
            <Pill tone="orange" className="bg-white shadow-sm">{r}자리</Pill>
          ) : null}
        </div>
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-center gap-1 text-[12px] font-semibold text-sub">
          <span>{c.type}</span>
          <CourseTags c={c} />
        </div>
        <p className="mt-0.5 line-clamp-2 text-[16px] leading-snug font-bold">{c.name}</p>
        <p className="mt-1 flex items-center gap-1 text-[13px] text-sub">
          <ClockIcon /> {timeRange(c)}
          <span className={`ml-auto pl-2 font-semibold ${full ? 'text-zinc-400' : r !== null && r <= 5 ? 'text-orange-600' : 'text-emerald-600'}`}>{seatsText(c)}</span>
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-[13px] text-sub">
          <PinIcon /> <span className="truncate">{c.place || '장소 미정'}</span>
        </p>
      </div>
    </button>
  );
}

export function CourseRowSkeleton() {
  return (
    <div className="flex gap-3.5 px-2 py-3" aria-hidden>
      <div className="size-[76px] animate-pulse rounded-2xl bg-soft" />
      <div className="flex-1 space-y-2 pt-1">
        <div className="h-3 w-16 animate-pulse rounded bg-soft" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-soft" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-soft" />
      </div>
    </div>
  );
}

/** Hype / 여유 Top 5 가로 목록 */
export function TopLists({ courses, onOpen }: { courses: Course[]; onOpen(c: Course): void }) {
  const hype = hypeTop(courses);
  const roomy = roomyTop(courses);
  return (
    <div className="space-y-6">
      <TopStrip icon={Flame} tone="coral" title="실시간 Hype 강좌" empty="아직 신청이 시작되지 않았어요" list={hype} onOpen={onOpen} hot />
      <TopStrip icon={Sprout} tone="mint" title="여유 있는 강좌" empty="모든 강좌가 마감됐어요" list={roomy} onOpen={onOpen} />
    </div>
  );
}

function TopStrip({ icon, tone, title, list, empty, onOpen, hot }: { icon: LucideIcon; tone: GlyphTone; title: string; list: Course[]; empty: string; onOpen(c: Course): void; hot?: boolean }) {
  return (
    <section>
      <h2 className="flex items-center gap-2 px-1 text-[17px] font-extrabold"><IconTile icon={icon} tone={tone} size={28} />{title}</h2>
      {list.length === 0 ? (
        <p className="mt-2 rounded-2xl bg-soft px-4 py-3 text-sm text-sub">{empty}</p>
      ) : (
        <ol className="-mx-5 mt-2 flex snap-x gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
          {list.map((c, i) => (
            <li key={c.id} className="w-[148px] shrink-0 snap-start">
              <button type="button" onClick={() => onOpen(c)} className="w-full text-left active:scale-[0.98]">
                <div className="relative">
                  <CourseThumb type={c.type} name={c.name} url={c.thumbnailUrl} className="aspect-square w-full rounded-2xl" />
                  <span className="absolute top-2 left-2 grid size-7 place-items-center rounded-full bg-white/90 text-[13px] font-extrabold shadow-sm">{i + 1}</span>
                </div>
                <p className="mt-1.5 line-clamp-1 text-[14px] font-bold">{c.name}</p>
                <p className="text-[12px] text-sub">{formatDate(c.date)}</p>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-soft">
                  <div
                    className={`h-full rounded-full ${hot ? 'bg-gradient-to-r from-coral-400 to-coral-500' : 'bg-emerald-400'}`}
                    style={{ width: `${Math.min(100, Math.round(fillRatio(c) * 100))}%` }}
                  />
                </div>
                <p className="mt-0.5 text-[12px] font-semibold text-sub">
                  {c.count}/{c.capacity}명 · {seatsText(c)}
                </p>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

interface DetailProps {
  c: Course | null;
  onClose(): void;
  /** 신청 버튼 등 아래 고정 영역 */
  footer?: ReactNode;
  /** 정원 현황 밑 추가 안내 */
  notice?: ReactNode;
}

/** 아래에서 올라오는 강좌 상세 */
export function CourseDetailSheet({ c, onClose, footer, notice }: DetailProps) {
  return (
    <Sheet open={!!c} onClose={onClose} title="강좌 상세" footer={c ? footer : undefined}>
      {c && (
        <div className="pb-2">
          <CourseThumb type={c.type} name={c.name} url={c.thumbnailUrl} className="aspect-[4/3] w-full rounded-[28px]" />
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            <Pill tone="gray">{c.type}</Pill>
            <CourseTags c={c} />
          </div>
          <h3 className="mt-2 text-[22px] leading-snug font-extrabold">{c.name}</h3>
          {c.intro && <p className="mt-2 text-[15px] leading-relaxed text-[#45454f]">{c.intro}</p>}
          <dl className="mt-4 space-y-2.5 rounded-3xl bg-soft p-4 text-[15px]">
            <Info icon={<CalendarIcon />} label="날짜·시간">
              {formatDate(c.date)} {timeRange(c)}
            </Info>
            <Info icon={<PinIcon />} label="장소">
              {c.place || '미정'}
            </Info>
            <Info icon={<PersonIcon />} label="강사">
              {c.instructor || '미정'}
            </Info>
          </dl>
          <Capacity c={c} />
          {notice}
        </div>
      )}
    </Sheet>
  );
}

function Info({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-[3px]">{icon}</span>
      <dt className="w-16 shrink-0 text-sub">{label}</dt>
      <dd className="font-semibold">{children}</dd>
    </div>
  );
}

function Capacity({ c }: { c: Course }) {
  if (c.capacity === null) {
    return <p className="mt-4 px-1 text-[15px] font-semibold text-brand-700"><Users size={17} className="mr-1.5 inline -mt-0.5" aria-hidden />3학년 전체가 함께하는 프로그램이에요</p>;
  }
  const pct = Math.min(100, Math.round(fillRatio(c) * 100));
  const full = isFull(c);
  return (
    <div className="mt-4 px-1">
      <div className="flex items-baseline justify-between">
        <span className="text-[15px] font-bold">정원 현황</span>
        <span className={`text-[15px] font-extrabold ${full ? 'text-zinc-400' : 'text-emerald-600'}`}>{seatsText(c)}</span>
      </div>
      <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-soft">
        <div className={`h-full rounded-full transition-all ${full ? 'bg-zinc-300' : 'bg-gradient-to-r from-brand-500 to-coral-500'}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-[13px] text-sub">
        {c.count} / {c.capacity}명 신청
      </p>
    </div>
  );
}
