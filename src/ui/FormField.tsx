// 학생 입력칸(로그인·회원가입): 칸 바로 아래에 오류를 보여 주는 인라인 오류 입력칸과 폼 전체 안내.

import { CircleAlert } from 'lucide-react';
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string | null;
}

const base =
  'mt-1.5 block h-14 w-full rounded-2xl border px-4 text-[17px] shadow-[inset_0_1px_2px_rgb(17_17_20/0.04)] outline-none backdrop-blur-md transition placeholder:text-[#a5a5b0] focus:bg-white focus:ring-4';
const ok = 'border-white/80 bg-white/60 focus:border-brand-500 focus:ring-brand-100';
const bad = 'border-rose-400 bg-rose-50/70 focus:border-rose-500 focus:ring-rose-100';

export const FormField = forwardRef<HTMLInputElement, Props>(function FormField({ label, hint, error, className = '', ...rest }, ref) {
  const id = useId();
  const msgId = `${id}-msg`;
  return (
    <div className={className}>
      <label htmlFor={id} className={`text-sm font-semibold ${error ? 'text-rose-600' : 'text-sub'}`}>
        {label}
      </label>
      <input
        {...rest}
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? msgId : undefined}
        className={`${base} ${error ? bad : ok}`}
      />
      {/* 오류가 있으면 안내(hint) 대신 오류. 화면 읽기 프로그램도 바로 읽도록 aria-live */}
      <p id={msgId} aria-live="polite" className={`mt-1.5 flex items-start gap-1 text-[13px] leading-snug ${error ? 'font-semibold text-rose-600' : 'text-sub'}`}>
        {error ? (
          <>
            <CircleAlert size={15} className="mt-px shrink-0" aria-hidden />
            {error}
          </>
        ) : (
          hint
        )}
      </p>
    </div>
  );
});

/** 서버가 돌려준 오류(명단 불일치·잠김 등): 버튼 위에 남아 있는 안내. 입력을 고치면 사라진다. */
export function FormAlert({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div role="alert" className="animate-fade-in flex items-start gap-2 rounded-2xl bg-rose-50/85 px-4 py-3 text-[14px] leading-snug font-semibold text-rose-700 ring-1 ring-rose-200 backdrop-blur-md">
      <CircleAlert size={18} className="mt-px shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  );
}
