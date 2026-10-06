// 대시보드 공용 부품: 제목, 입력칸, 카드, 표

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

export function PageHead({ emoji, title, desc, actions }: { emoji: string; title: string; desc?: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1">
        <h1 className="text-[24px] font-extrabold tracking-tight lg:text-[28px]">
          <span aria-hidden>{emoji}</span> {title}
        </h1>
        {desc && <p className="mt-1 text-[14px] text-sub">{desc}</p>}
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

export function Empty({ emoji, text }: { emoji: string; text: string }) {
  return (
    <div className="py-12 text-center text-sub">
      <div className="text-4xl">{emoji}</div>
      <p className="mt-2">{text}</p>
    </div>
  );
}

/** 저장 전 변경 표시 점 */
export const DirtyDot = () => <span className="inline-block size-2 rounded-full bg-orange-500 align-middle" title="저장하지 않은 변경" aria-label="저장하지 않은 변경" />;
