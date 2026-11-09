import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'brand' | 'ghost';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}

const styles: Record<Variant, string> = {
  // 진한 버튼은 위쪽에 얇은 빛 반사를 넣어 유리 위에서도 떠 보이게
  primary: 'bg-ink text-white hover:bg-black shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_10px_24px_-12px_rgb(17_17_20/0.6)]',
  brand: 'bg-gradient-to-b from-brand-500 to-brand-600 text-white hover:to-brand-700 shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_10px_24px_-12px_rgb(109_40_217/0.7)]',
  ghost: 'glass text-ink hover:bg-white/75',
};

/** 화면 폭을 채우는 둥근 버튼. 처리 중에는 잠긴다. */
export function Button({ variant = 'primary', loading, disabled, className = '', children, ...rest }: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`flex min-h-13 w-full items-center justify-center gap-2 rounded-full px-5 text-[17px] font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-none disabled:bg-ink/8 disabled:text-ink/35 disabled:shadow-none ${styles[variant]} ${className}`}
    >
      {loading && <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />}
      {children}
    </button>
  );
}
