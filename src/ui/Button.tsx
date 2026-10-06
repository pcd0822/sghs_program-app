import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'brand' | 'ghost';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}

const styles: Record<Variant, string> = {
  primary: 'bg-ink text-white hover:bg-black',
  brand: 'bg-brand-600 text-white hover:bg-brand-700',
  ghost: 'bg-soft text-ink hover:bg-line',
};

/** 화면 폭을 채우는 둥근 버튼. 처리 중에는 잠긴다. */
export function Button({ variant = 'primary', loading, disabled, className = '', children, ...rest }: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`flex min-h-13 w-full items-center justify-center gap-2 rounded-full px-5 text-[17px] font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
    >
      {loading && <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />}
      {children}
    </button>
  );
}
