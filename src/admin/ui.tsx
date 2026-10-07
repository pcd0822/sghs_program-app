// 대시보드 공용 부품: 제목, 입력칸, 카드, 표

import { ChevronDown, Search, type LucideIcon } from 'lucide-react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { EmptyArt, IconTile, type GlyphTone } from '@/ui/Glyph';

export function PageHead({ icon, tone = 'violet', title, desc, actions }: { icon: LucideIcon; tone?: GlyphTone; title: string; desc?: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end gap-3">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <IconTile icon={icon} tone={tone} size={44} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <h1 className="text-[24px] leading-tight font-extrabold tracking-tight lg:text-[28px]">{title}</h1>
          {desc && <p className="mt-1 text-[14px] text-sub">{desc}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl bg-white p-4 ring-1 ring-line lg:p-5 ${className}`}>{children}</section>;
}

export function SmallButton({
  children,
  tone = 'default',
  className = '',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'default' | 'brand' | 'danger' | 'dark' }) {
  const tones = {
    default: 'bg-soft text-ink hover:bg-line',
    brand: 'bg-brand-600 text-white hover:bg-brand-700',
    danger: 'bg-rose-50 text-rose-600 hover:bg-rose-100',
    dark: 'bg-ink text-white hover:bg-black',
  };
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full px-4 text-[14px] font-semibold whitespace-nowrap transition active:scale-[0.98] disabled:opacity-40 ${tones[tone]} ${className}`}
    >
      {children}
    </button>
  );
}

const inputCls =
  'mt-1 block h-11 w-full rounded-xl border border-line bg-soft px-3 text-[15px] outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100 disabled:opacity-50';

export function Field({ label, hint, className = '', ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[13px] font-semibold text-sub">{label}</span>
      <input {...rest} className={inputCls} />
      {hint && <span className="mt-0.5 block text-[12px] text-sub">{hint}</span>}
    </label>
  );
}

export function Area({ label, className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[13px] font-semibold text-sub">{label}</span>
      <textarea {...rest} className={`${inputCls} h-auto min-h-24 py-2 leading-relaxed`} />
    </label>
  );
}

export function Select({ label, children, className = '', ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[13px] font-semibold text-sub">{label}</span>
      <select {...rest} className={inputCls}>
        {children}
      </select>
    </label>
  );
}

export function Toggle({ label, checked, onChange, desc }: { label: string; checked: boolean; onChange(v: boolean): void; desc?: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span className="relative h-7 w-12 shrink-0 rounded-full bg-zinc-300 transition peer-checked:bg-brand-600 peer-focus-visible:ring-4 peer-focus-visible:ring-brand-100 after:absolute after:top-1 after:left-1 after:size-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5" />
      <span>
        <span className="block text-[15px] font-semibold">{label}</span>
        {desc && <span className="block text-[12px] text-sub">{desc}</span>}
      </span>
    </label>
  );
}

export function Stat({ label, value, tone = 'default', sub }: { label: string; value: ReactNode; tone?: 'default' | 'green' | 'orange' | 'red' | 'purple'; sub?: ReactNode }) {
  const tones = {
    default: 'bg-soft',
    green: 'bg-emerald-50 text-emerald-800',
    orange: 'bg-orange-50 text-orange-800',
    red: 'bg-rose-50 text-rose-700',
    purple: 'bg-brand-50 text-brand-700',
  };
  return (
    <div className={`rounded-3xl p-4 ${tones[tone]}`}>
      <p className="text-[13px] font-semibold opacity-80">{label}</p>
      <p className="mt-1 text-[28px] leading-none font-extrabold tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-[12px] opacity-80">{sub}</p>}
    </div>
  );
}

/** 넓은 화면에서는 표, 좁은 화면에서는 가로 스크롤 */
export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <table className="w-full min-w-max border-separate border-spacing-0 text-left text-[14px] [&_td]:border-b [&_td]:border-line [&_td]:px-2 [&_td]:py-2 [&_th]:sticky [&_th]:top-0 [&_th]:border-b [&_th]:border-line [&_th]:bg-white [&_th]:px-2 [&_th]:py-2 [&_th]:text-[12px] [&_th]:font-semibold [&_th]:text-sub">
        {children}
      </table>
    </div>
  );
}

export function Empty({ icon, tone, text }: { icon: LucideIcon; tone?: GlyphTone; text: string }) {
  return (
    <div className="py-12 text-center text-sub">
      <EmptyArt icon={icon} tone={tone} />
      <p className="mt-3">{text}</p>
    </div>
  );
}

/** 돋보기 아이콘이 든 검색 칸 */
export function SearchBox({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <span className={`relative inline-flex w-full sm:w-64 ${className}`}>
      <Search className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sub" size={17} aria-hidden />
      <input type="search" {...rest} className="h-10 w-full rounded-full border border-line bg-white pr-4 pl-10 text-[14px] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" />
    </span>
  );
}

/** 알약 모양 고르기 칸. 글자 길이와 상관없이 오른쪽 화살표 자리를 따로 비워 둔다. */
export function PillSelect({ className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={`relative inline-flex ${className}`}>
      <select
        {...rest}
        className="h-10 w-full min-w-0 cursor-pointer appearance-none truncate rounded-full border border-line bg-white pr-10 pl-4 text-[14px] font-semibold outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-sub" size={18} aria-hidden />
    </span>
  );
}

/** 저장 전 변경 표시 점 */
export const DirtyDot = () => <span className="inline-block size-2 rounded-full bg-orange-500 align-middle" title="저장하지 않은 변경" aria-label="저장하지 않은 변경" />;
