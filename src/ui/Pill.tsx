import type { ReactNode } from 'react';

export type Tone = 'green' | 'gray' | 'orange' | 'purple' | 'red' | 'blue' | 'dark';

const tones: Record<Tone, string> = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  gray: 'bg-zinc-100 text-zinc-500 ring-zinc-200',
  orange: 'bg-orange-50 text-orange-600 ring-orange-200',
  purple: 'bg-brand-50 text-brand-700 ring-brand-100',
  red: 'bg-rose-50 text-rose-600 ring-rose-200',
  blue: 'bg-sky-50 text-sky-700 ring-sky-200',
  dark: 'bg-ink text-white ring-ink',
};

/** 상태를 나타내는 작은 알약 표시 (신청 완료 초록, 마감 회색, 자부담 주황, 필수 보라) */
export function Pill({ tone, children, className = '' }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-[12px] leading-[18px] font-semibold whitespace-nowrap ring-1 ring-inset ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}
