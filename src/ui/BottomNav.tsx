import type { LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router-dom';

export interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
  end?: boolean;
}

/** 화면 아래에 떠 있는 알약 모양 메뉴. 선택된 메뉴는 옅은 회색 배경. */
export function BottomNav({ items }: { items: NavItem[] }) {
  return (
    <nav
      aria-label="주 메뉴"
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(env(safe-area-inset-bottom),12px)] pointer-events-none"
    >
      <ul className="pointer-events-auto flex gap-1 rounded-full bg-white/90 p-1.5 shadow-[0_8px_30px_-6px_rgba(0,0,0,0.25)] ring-1 ring-black/5 backdrop-blur-md">
        {items.map((it) => (
          <li key={it.to}>
            <NavLink
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                `flex min-h-13 min-w-[58px] flex-col items-center justify-center rounded-full px-2.5 text-[11px] font-semibold transition ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-sub hover:text-ink'
                }`
              }
            >
              <it.icon size={21} strokeWidth={2.1} aria-hidden />
              <span className="mt-1">{it.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
