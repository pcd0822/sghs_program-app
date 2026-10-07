// 첫 화면 배경: 강좌 그림 타일과 도형이 불규칙한 자리에서 톡 나타났다가 사라진다.
// 화면을 칸(3열 × 4행)으로 나누고, 동시에 떠 있는 것끼리는 같은 칸을 쓰지 않게 해서 겹치지 않는다.

import { Brain, Coffee, Cookie, Gamepad2, Gem, Library, Mic, MountainSnow, Music, Palette, PersonStanding, Target, type LucideIcon } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

const COLS = 3;
const ROWS = 4;
const SLOTS = 7;

const TILES: { icon: LucideIcon; from: string; to: string }[] = [
  { icon: Palette, from: '#fbbf24', to: '#f472b6' },
  { icon: Mic, from: '#818cf8', to: '#a855f7' },
  { icon: Music, from: '#f472b6', to: '#fb923c' },
  { icon: MountainSnow, from: '#34d399', to: '#38bdf8' },
  { icon: Target, from: '#fb7185', to: '#f97316' },
  { icon: Coffee, from: '#f59e0b', to: '#b45309' },
  { icon: Cookie, from: '#fdba74', to: '#f472b6' },
  { icon: Library, from: '#38bdf8', to: '#6366f1' },
  { icon: Gamepad2, from: '#a78bfa', to: '#6366f1' },
  { icon: PersonStanding, from: '#6ee7b7', to: '#0ea5a4' },
  { icon: Gem, from: '#c084fc', to: '#fb7185' },
  { icon: Brain, from: '#f9a8d4', to: '#8b5cf6' },
];
const SHAPES = ['ring', 'dot', 'blob', 'squiggle'] as const;
const SHAPE_COLORS = ['#a78bfa', '#fb7185', '#fbbf24', '#38bdf8', '#34d399'];

type Kind = { t: 'tile'; i: number } | { t: 'shape'; s: (typeof SHAPES)[number]; color: string };

interface Pop {
  id: number;
  kind: Kind;
  key: string;
  cell: number;
  /** 칸 안에서의 위치(0~1) */
  jx: number;
  jy: number;
  size: number;
  rot: number;
  dur: number;
  delay: number;
}

let seq = 0;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

function reducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function make(busyCells: Set<number>, recent: Set<string>, firstRound: boolean): Pop {
  const free = [...Array(COLS * ROWS).keys()].filter((c) => !busyCells.has(c));
  const cell = free[Math.floor(Math.random() * free.length)] ?? 0;
  // 셋 중 둘은 강좌 타일, 하나는 도형
  let kind: Kind;
  if (Math.random() < 0.68) {
    const choices = TILES.map((_, i) => i).filter((i) => !recent.has(`t${i}`));
    kind = { t: 'tile', i: pick(choices.length ? choices : TILES.map((_, i) => i)) };
  } else {
    kind = { t: 'shape', s: pick([...SHAPES]), color: pick(SHAPE_COLORS) };
  }
  const isTile = kind.t === 'tile';
  return {
    id: ++seq,
    kind,
    key: kind.t === 'tile' ? `t${kind.i}` : `s${kind.s}`,
    cell,
    jx: rand(0.25, 0.75),
    jy: rand(0.25, 0.75),
    size: Math.round(isTile ? rand(52, 80) : rand(28, 54)),
    rot: Math.round(rand(-16, 16)),
    dur: rand(2.6, 4.2),
    delay: firstRound ? rand(0, 2.4) : rand(0.1, 0.9),
  };
}

export function ShapePops() {
  const still = useMemo(reducedMotion, []);

  const [pops, setPops] = useState<Pop[]>(() => {
    const out: Pop[] = [];
    for (let i = 0; i < SLOTS; i++) out.push(make(new Set(out.map((p) => p.cell)), new Set(out.map((p) => p.key)), true));
    return out;
  });

  const replace = useCallback(
    (id: number) =>
      setPops((list) => {
        const others = list.filter((p) => p.id !== id);
        const next = make(new Set(others.map((p) => p.cell)), new Set(others.map((p) => p.key)), false);
        return list.map((p) => (p.id === id ? next : p));
      }),
    [],
  );

  return (
    <div className="absolute inset-0" aria-hidden>
      {pops.map((p) => {
        const col = p.cell % COLS;
        const row = Math.floor(p.cell / COLS);
        return (
          <span
            key={p.id}
            onAnimationEnd={() => replace(p.id)}
            className="absolute select-none"
            style={{
              left: `${((col + p.jx) / COLS) * 100}%`,
              top: `${((row + p.jy) / ROWS) * 100}%`,
              width: p.size,
              height: p.size,
              translate: '-50% -50%',
              ['--rot' as string]: `${p.rot}deg`,
              ...(still ? { transform: `rotate(${p.rot}deg)` } : { animation: `pop ${p.dur}s cubic-bezier(0.3, 0.7, 0.3, 1) ${p.delay}s both` }),
            }}
          >
            {p.kind.t === 'tile' ? <Tile {...TILES[p.kind.i]} /> : <Shape s={p.kind.s} color={p.kind.color} />}
          </span>
        );
      })}
    </div>
  );
}

function Tile({ icon: Icon, from, to }: { icon: LucideIcon; from: string; to: string }) {
  return (
    <span
      className="relative grid size-full place-items-center overflow-hidden rounded-[30%] text-white shadow-[0_12px_24px_-10px_rgba(76,29,149,0.45)]"
      style={{ backgroundImage: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      <span className="absolute -top-1/4 -left-1/4 size-[80%] rounded-full bg-white/25" />
      <Icon className="relative size-[50%]" strokeWidth={2} />
    </span>
  );
}

function Shape({ s, color }: { s: (typeof SHAPES)[number]; color: string }) {
  return (
    <svg viewBox="0 0 40 40" className="size-full overflow-visible">
      {s === 'ring' && <circle cx="20" cy="20" r="14" fill="none" stroke={color} strokeWidth="6" />}
      {s === 'dot' && <circle cx="20" cy="20" r="11" fill={color} />}
      {s === 'blob' && <path d="M20 4c9 0 16 6 16 15s-6 17-16 17S4 30 4 21 11 4 20 4Z" fill={color} fillOpacity="0.85" />}
      {s === 'squiggle' && <path d="M3 24c5-10 9-10 12 0s7 10 11 0 8-10 11 0" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" />}
    </svg>
  );
}
