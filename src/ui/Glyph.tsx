// 이모지 대신 쓰는 그림 부품: 그라데이션 타일 위에 흰 선 아이콘.
// 아이콘은 lucide-react 에서 필요한 것만 불러온다(쓰지 않는 아이콘은 빌드에서 빠진다).

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export type GlyphTone = 'violet' | 'coral' | 'sky' | 'mint' | 'amber' | 'rose' | 'slate';

export const TONE_BG: Record<GlyphTone, string> = {
  violet: 'linear-gradient(135deg, #a78bfa, #7c3aed)',
  coral: 'linear-gradient(135deg, #fda4af, #fb7185 45%, #fb923c)',
  sky: 'linear-gradient(135deg, #7dd3fc, #6366f1)',
  mint: 'linear-gradient(135deg, #6ee7b7, #0ea5a4)',
  amber: 'linear-gradient(135deg, #fcd34d, #f97316)',
  rose: 'linear-gradient(135deg, #fda4af, #e11d48)',
  slate: 'linear-gradient(135deg, #a1a1aa, #3f3f46)',
};

/** 둥근 사각형 타일 + 아이콘. size 는 한 변 px. */
export function IconTile({ icon: Icon, tone = 'violet', size = 40, className = '' }: { icon: LucideIcon; tone?: GlyphTone; size?: number; className?: string }) {
  return (
    <span
      className={`relative inline-grid shrink-0 place-items-center overflow-hidden text-white shadow-[0_6px_16px_-6px_rgba(76,29,149,0.45)] ${className}`}
      style={{ width: size, height: size, borderRadius: size * 0.32, backgroundImage: TONE_BG[tone] }}
      aria-hidden
    >
      {/* 위쪽 빛 반사 */}
      <span className="absolute -top-1/3 -left-1/4 size-[90%] rounded-full bg-white/25 blur-[2px]" />
      <Icon className="relative" size={Math.round(size * 0.52)} strokeWidth={2.2} />
    </span>
  );
}

/** 화면 제목 위 작은 머리글: 작은 타일 + 글자 */
export function Eyebrow({ icon, tone, children, className = 'pt-2' }: { icon: LucideIcon; tone?: GlyphTone; children: ReactNode; className?: string }) {
  return (
    <p className={`flex items-center gap-2 text-[14px] font-semibold text-sub ${className}`}>
      <IconTile icon={icon} tone={tone} size={24} />
      {children}
    </p>
  );
}

/** 빈 화면용 큰 그림: 겹친 원 + 타일 */
export function EmptyArt({ icon, tone = 'violet' }: { icon: LucideIcon; tone?: GlyphTone }) {
  return (
    <span className="relative inline-grid size-24 place-items-center" aria-hidden>
      <span className="absolute inset-0 rounded-full bg-brand-50" />
      <span className="absolute top-1 right-0 size-5 rounded-full bg-orange-100" />
      <span className="absolute bottom-2 left-0 size-3 rounded-full bg-sky-100" />
      <IconTile icon={icon} tone={tone} size={52} />
    </span>
  );
}
