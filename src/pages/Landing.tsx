import { collection, getDocs } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Course } from '@shared/types';
import { db } from '@/lib/firebase';
import { Button } from '@/ui/Button';
import { courseEmoji } from '@/ui/CourseThumb';
import { Sheet } from '@/ui/Sheet';
import { EmojiPops } from './EmojiPops';

export default function Landing() {
  const [emojis, setEmojis] = useState<string[]>([]);
  const [choose, setChoose] = useState(false);

  useEffect(() => {
    // 강좌에서 이모지 종류만 뽑는다(로그인 전에도 읽을 수 있는 공개 자료).
    getDocs(collection(db, 'courses'))
      .then((snap) => setEmojis([...new Set(snap.docs.map((d) => courseEmoji((d.data() as Course).type, (d.data() as Course).name)))]))
      .catch(() => setEmojis([]));
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

      {/* 이모지가 불규칙하게 나타났다 사라지는 자리 */}
      <div className="relative h-[54dvh] min-h-[320px]">
        <EmojiPops emojis={emojis} />
      </div>

      <section className="relative z-10 mt-auto px-6 pb-[max(env(safe-area-inset-bottom),28px)] text-center">
        <p className="text-sm font-semibold tracking-wide text-sub">2026 · 고3 수능 이후 프로그램</p>
        <h1 className="mt-3 text-[40px] leading-[1.15] font-extrabold tracking-tight">
          수능 끝,
          <br />
          하고 싶은 걸
          <br />
          <span className="text-gradient">Take your pick</span>
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
