import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  open: boolean;
  onClose(): void;
  title?: string;
  children: ReactNode;
  /** 맨 아래 고정 영역(버튼 등) */
  footer?: ReactNode;
  /** 컴퓨터에서 넓게(편집 창) */
  wide?: boolean;
}

/** 아래에서 올라오는 모달창 */
export function Sheet({ open, onClose, title, children, footer, wide }: Props) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    panel.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="animate-fade-in absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`animate-sheet-up relative flex max-h-[92dvh] w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} flex-col rounded-t-[28px] bg-white shadow-2xl outline-none`}
      >
        <div className="flex shrink-0 items-center justify-between px-5 pt-3">
          <span className="mx-auto h-1.5 w-10 rounded-full bg-line" aria-hidden />
        </div>
        <div className="flex shrink-0 items-center justify-between px-5 pb-2 pt-2">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 grid size-11 place-items-center rounded-full text-xl text-sub hover:bg-soft"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <div className="shrink-0 border-t border-line px-5 pt-3 pb-[max(env(safe-area-inset-bottom),16px)]">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
