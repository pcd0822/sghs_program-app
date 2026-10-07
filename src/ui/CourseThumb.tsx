// 강좌 썸네일. 이미지가 없으면 유형별 색 그라데이션 + 도형 무늬 + 흰 선 아이콘으로 자동 생성한다.

import {
  Amphora,
  Brain,
  BookOpen,
  Bus,
  Coffee,
  Cookie,
  Dumbbell,
  Flower2,
  Gamepad2,
  Gem,
  GraduationCap,
  Hammer,
  Library,
  Mic,
  MountainSnow,
  Music,
  Newspaper,
  Palette,
  PersonStanding,
  PiggyBank,
  ShoppingBag,
  Sparkles,
  Spool,
  Target,
  Trophy,
  Wind,
  type LucideIcon,
} from 'lucide-react';

interface Look {
  icon: LucideIcon;
  from: string;
  to: string;
}

const BY_TYPE: Record<string, Look> = {
  체험: { icon: Palette, from: '#fbbf24', to: '#f472b6' },
  특강: { icon: Mic, from: '#818cf8', to: '#a855f7' },
  공연: { icon: Music, from: '#f472b6', to: '#fb923c' },
  스포츠: { icon: Trophy, from: '#34d399', to: '#38bdf8' },
  견학: { icon: Bus, from: '#38bdf8', to: '#6366f1' },
};
const EXPERIENCE_COLORS = [
  { from: '#fbbf24', to: '#f472b6' },
  { from: '#34d399', to: '#0ea5e9' },
  { from: '#a78bfa', to: '#ec4899' },
  { from: '#fb923c', to: '#ef4444' },
  { from: '#38bdf8', to: '#8b5cf6' },
  { from: '#2dd4bf', to: '#84cc16' },
  { from: '#f9a8d4', to: '#a855f7' },
];
const FALLBACK: Look ={ icon: Sparkles, from: '#c084fc', to: '#fb7185' };

/** 체험 강좌가 대부분이라 유형만 보면 전부 같은 그림이 된다. 이름에 든 낱말로 먼저 고르고, 없으면 유형으로. */
const BY_KEYWORD: [RegExp, LucideIcon][] = [
  [/클라이밍/, MountainSnow],
  [/볼링/, Target],
  [/요가/, PersonStanding],
  [/체육|스포츠대회/, Dumbbell],
  [/e\s?스포츠|PC/i, Gamepad2],
  [/만화|웹툰/, BookOpen],
  [/도서관|미니북|책/, Library],
  [/카페|커피/, Coffee],
  [/향수|조향|디퓨저|트리트먼트/, Flower2],
  [/화과자|과자|푸딩|베이킹/, Cookie],
  [/목공/, Hammer],
  [/도자기/, Amphora],
  [/가죽/, ShoppingBag],
  [/팔찌|매듭/, Wind],
  [/레진|선캐처/, Gem],
  [/지갑|스티치/, Spool],
  [/MBTI|성격/i, Brain],
  [/금융|돈/, PiggyBank],
  [/저널|언론/, Newspaper],
  [/전공|대학/, GraduationCap],
  [/공연|콘서트|음악/, Music],
];

/** 강좌의 그림(아이콘 + 색) */
export function courseLook(type: string, name: string): Look {
  const base = BY_TYPE[type] ?? FALLBACK;
  const icon = BY_KEYWORD.find(([re]) => re.test(name))?.[1] ?? base.icon;
  // 체험은 강좌 수가 많아 한 색이면 구분이 안 된다 → 이름으로 색 묶음을 고른다.
  if (type === '체험') return { ...EXPERIENCE_COLORS[hash(name) % EXPERIENCE_COLORS.length], icon };
  return { ...base, icon };
}

/** 같은 유형이어도 강좌마다 살짝 다른 모양이 나오도록 이름으로 값을 정한다. */
function hash(seed: string): number {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

interface Props {
  type: string;
  name: string;
  url?: string | null;
  className?: string;
}

export function CourseThumb({ type, name, url, className = '' }: Props) {
  if (url) {
    return <img src={url} alt="" loading="lazy" className={`object-cover ${className}`} />;
  }
  return <GraphicCover {...courseLook(type, name)} seed={name} className={className} />;
}

/** 그라데이션 + 도형 무늬 + 흰 아이콘 표지. seed 로 무늬가 조금씩 달라진다. */
export function GraphicCover({ icon: Icon, from, to, seed, className = '' }: Look & { seed: string; className?: string }) {
  const h = hash(seed);
  const angle = 110 + (h % 120);
  const flip = h % 2 === 0;
  return (
    <div
      className={`relative grid place-items-center overflow-hidden ${className}`}
      style={{ backgroundImage: `linear-gradient(${angle}deg, ${from}, ${to})` }}
      aria-hidden
    >
      {/* 도형 무늬: 큰 원, 고리, 점 몇 개 */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" style={flip ? { transform: 'scaleX(-1)' } : undefined}>
        <circle cx="86" cy="88" r="38" fill="white" fillOpacity="0.18" />
        <circle cx="86" cy="14" r="12" fill="none" stroke="white" strokeOpacity="0.35" strokeWidth="3" />
        <circle cx={58 + (h % 12)} cy="12" r="3.2" fill="white" fillOpacity="0.55" />
        <circle cx="22" cy={74 + (h % 12)} r="2.2" fill="white" fillOpacity="0.5" />
        <path d="M-6 58 Q 18 46 36 60 T 80 58" fill="none" stroke="white" strokeOpacity="0.22" strokeWidth="4" strokeLinecap="round" />
      </svg>
      <Icon className="relative size-[44%] text-white drop-shadow-[0_4px_10px_rgba(0,0,0,0.18)]" strokeWidth={1.8} />
    </div>
  );
}
