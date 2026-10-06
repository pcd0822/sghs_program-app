// 첫 화면 배경: 강좌 이모지들이 불규칙한 자리에서 톡 나타났다가 사라진다.
// 화면을 칸(3열 × 4행)으로 나누고, 동시에 떠 있는 이모지끼리는 같은 칸을 쓰지 않게 해서 겹치지 않는다.

import { useCallback, useMemo, useRef, useState } from 'react';

const COLS = 3;
const ROWS = 4;
const SLOTS = 7;
const FALLBACK = ['🎨', '🎤', '🎵', '🧗', '🎳', '☕', '🍪', '🌸', '📚', '🎮', '🧘', '💎'];
const EXTRA = ['✨', '🎉'];

interface Pop {
  id: number;
  emoji: string;
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

function reducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function EmojiPops({ emojis }: { emojis: string[] }) {
  const pool = useMemo(() => [...(emojis.length ? emojis : FALLBACK), ...EXTRA], [emojis]);
  const poolRef = useRef(pool);
  poolRef.current = pool; // 강좌 자료가 늦게 와도 다음 차례부터 반영
  const still = useMemo(reducedMotion, []);

  const make = useCallback((busyCells: Set<number>, recent: Set<string>, firstRound: boolean): Pop => {
    const free = [...Array(COLS * ROWS).keys()].filter((c) => !busyCells.has(c));
    const cell = free[Math.floor(Math.random() * free.length)] ?? 0;
    const choices = poolRef.current.filter((e) => !recent.has(e));
    const list = choices.length ? choices : poolRef.current;
    return {
      id: ++seq,
      emoji: list[Math.floor(Math.random() * list.length)],
      cell,
      jx: rand(0.25, 0.75),
      jy: rand(0.25, 0.75),
      size: Math.round(rand(40, 72)),
      rot: Math.round(rand(-16, 16)),
      dur: rand(2.6, 4.2),
      delay: firstRound ? rand(0, 2.4) : rand(0.1, 0.9),
    };
  }, []);

  const [pops, setPops] = useState<Pop[]>(() => {
    const out: Pop[] = [];
    for (let i = 0; i < SLOTS; i++) {
      out.push(make(new Set(out.map((p) => p.cell)), new Set(out.map((p) => p.emoji)), true));
    }
    return out;
  });

  const replace = useCallback(
    (id: number) =>
      setPops((list) => {
        const others = list.filter((p) => p.id !== id);
        const next = make(new Set(others.map((p) => p.cell)), new Set(others.map((p) => p.emoji)), false);
        return list.map((p) => (p.id === id ? next : p));
      }),
    [make],
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
              fontSize: p.size,
              lineHeight: 1,
              translate: '-50% -50%',
              filter: 'drop-shadow(0 8px 14px rgba(0,0,0,0.15))',
              ['--rot' as string]: `${p.rot}deg`,
              ...(still
                ? { transform: `rotate(${p.rot}deg)` }
                : { animation: `pop ${p.dur}s cubic-bezier(0.3, 0.7, 0.3, 1) ${p.delay}s both` }),
            }}
          >
            {p.emoji}
          </span>
        );
      })}
    </div>
  );
}
