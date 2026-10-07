import type { LucideIcon } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { IconTile, type GlyphTone } from './Glyph';
import { createPortal } from 'react-dom';

interface Props {
  open: boolean;
  onClose(): void;
  icon?: LucideIcon;
  tone?: GlyphTone;
  title: string;
  children?: ReactNode;
  /** 버튼들. 없으면 "확인" 하나 */
  actions?: ReactNode;
}

/** 화면 가운데 뜨는 안내창(중복 신청 불가, 자부담 확인 등) */
export function Modal({ open, onClose, icon, tone, title, children, actions }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] grid place-items-center px-6">
      <div className="animate-fade-in absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div role="alertdialog" aria-modal="true" aria-label={title} className="animate-fade-in relative w-full max-w-sm rounded-[28px] bg-white p-6 text-center shadow-2xl">
        {icon && <IconTile icon={icon} tone={tone} size={60} />}
        <h2 className="mt-4 text-xl font-extrabold">{title}</h2>
        {children && <div className="mt-2 text-[15px] leading-relaxed text-sub">{children}</div>}
        <div className="mt-6 grid gap-2">
          {actions ?? (
            <button type="button" onClick={onClose} autoFocus className="min-h-13 rounded-full bg-ink text-[17px] font-semibold text-white">
              확인
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
