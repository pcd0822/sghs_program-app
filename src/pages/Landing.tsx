import { collection, getDocs } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Course } from '@shared/types';
import { db } from '@/lib/firebase';
import { Button } from '@/ui/Button';
import { CourseThumb } from '@/ui/CourseThumb';
import { Sheet } from '@/ui/Sheet';

/** 떠 있는 썸네일 자리: 위치(%)·크기(px)·기울기(deg)·흔들림 지연(s) */
const SLOTS = [
  { top: 6, left: -6, size: 104, rot: -9, delay: 0 },
  { top: 3, left: 40, size: 92, rot: 7, delay: 1.2 },
  { top: 15, left: 72, size: 112, rot: -5, delay: 0.6 },
  { top: 27, left: 14, size: 120, rot: 6, delay: 2.1 },
  { top: 33, left: 55, size: 98, rot: -10, delay: 1.6 },
  { top: 49, left: -4, size: 96, rot: 10, delay: 0.3 },
  { top: 50, left: 72, size: 104, rot: 8, delay: 2.6 },
  { top: 52, left: 34, size: 84, rot: -4, delay: 1.0 },
];

type Tile = Pick<Course, 'id' | 'type' | 'name' | 'thumbnailUrl'>;

export default function Landing() {
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [choose, setChoose] = useState(false);

  useEffect(() => {
    getDocs(collection(db, 'courses'))
      .then((snap) => {
        // 같은 프로그램은 한 번만, 썸네일 있는 강좌를 앞으로
        const seen = new Set<string>();
        const list = snap.docs
          .map((d) => d.data() as Course)
          .sort((a, b) => Number(!!b.thumbnailUrl) - Number(!!a.thumbnailUrl) || a.order - b.order)
          .filter((c) => !seen.has(c.code) && seen.add(c.code));
        setTiles(list.slice(0, SLOTS.length));
      })
      .catch(() => setTiles([]));
  }, []);

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-lg flex-col overflow-hidden bg-white">
      {/* 파스텔 배경 */}
      <div
        className="absolute inset-x-0 top-0 h-[68%]"
        style={{
          background:
            'radial-gradient(120% 70% at 0% 0%, #fbcfe8 0%, transparent 60%), radial-gradient(90% 70% at 100% 10%, #bae6fd 0%, transparent 60%), radial-gradient(80% 60% at 50% 60%, #fde68a88 0%, transparent 70%)',
        }}
        aria-hidden
      />
      <div className="absolute inset-x-0 top-[48%] h-[22%] bg-gradient-to-b from-transparent to-white" aria-hidden />

      {/* 기울어져 떠 있는 강좌 썸네일 */}
      <div className="relative h-[58dvh] min-h-[340px]" aria-hidden>
        {SLOTS.map((s, i) => {
          const t = tiles[i];
          return (
            <div
              key={i}
              className="animate-float absolute"
              style={{ top: `${s.top}%`, left: `${s.left}%`, animationDelay: `${s.delay}s` }}
            >
              <div
                className="overflow-hidden rounded-[22px] border-[5px] border-white bg-white shadow-[0_12px_30px_-8px_rgba(0,0,0,0.25)]"
                style={{ width: s.size, height: s.size, rotate: `${s.rot}deg` }}
              >
                {t ? (
                  <CourseThumb type={t.type} name={t.name} url={t.thumbnailUrl} className="size-full" emojiClass="text-4xl" />
                ) : (
                  <div className="size-full animate-pulse bg-soft" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <section className="relative z-10 mt-auto px-6 pb-[max(env(safe-area-inset-bottom),28px)] text-center">
        <p className="text-sm font-semibold tracking-wide text-sub">2026 · 고3 수능 이후 프로그램</p>
        <h1 className="mt-3 text-[40px] leading-[1.15] font-extrabold tracking-tight">
          수능 끝,
          <br />
          하고 싶은 걸
          <br />
          <span className="text-gradient">지금 골라요</span>
        </h1>
        <p className="mt-4 text-[15px] text-sub">11.30.(월) ~ 12.11.(금) · 체험 · 특강 · 공연</p>
        <Button className="mt-8" onClick={() => setChoose(true)}>
          로그인
        </Button>
      </section>

      <Sheet open={choose} onClose={() => setChoose(false)} title="누구로 로그인할까요?">
        <div className="grid gap-3 pb-2">
          <ChoiceLink to="/login/student" emoji="🎒" title="학생 로그인" desc="학번 · 이름 · 연락처" />
          <ChoiceLink to="/login/teacher" emoji="🧑‍🏫" title="관리자(교사) 로그인" desc="4자리 코드" />
        </div>
      </Sheet>
    </main>
  );
}

function ChoiceLink({ to, emoji, title, desc }: { to: string; emoji: string; title: string; desc: string }) {
  return (
    <Link to={to} className="flex min-h-18 items-center gap-4 rounded-3xl bg-soft px-5 py-4 transition hover:bg-line active:scale-[0.99]">
      <span className="grid size-12 place-items-center rounded-2xl bg-white text-2xl shadow-sm">{emoji}</span>
      <span className="flex-1">
        <span className="block text-[17px] font-bold">{title}</span>
        <span className="block text-sm text-sub">{desc}</span>
      </span>
      <span className="text-sub" aria-hidden>
        ›
      </span>
    </Link>
  );
}
