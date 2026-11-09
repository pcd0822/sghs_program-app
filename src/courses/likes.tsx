// 강좌 좋아요(하트) — 낙관적 UI.
// 누르는 즉시 하트와 숫자가 바뀌고, 서버 저장은 잠깐(0.35초) 모았다가 마지막 상태 하나만 보낸다(연타 대비).
// 저장이 실패하면 원래대로 되돌리고 알려 준다. 서버는 "누름=참/거짓"을 받으므로 두 번 세지 않는다.
//
// 숫자 맞추기: 화면 숫자 = 서버 수(courseLikes) + 아직 서버 수에 안 들어온 내 변화(adj).
// 서버 수가 바뀌어 들어오면 그만큼 adj 를 줄인다 → 결국 서버 수와 같아진다.

import { Heart } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { LikeCounts } from '@shared/rules';
import { useCourseLikes, useMyLikes } from '@/data/live';
import { call } from '@/lib/call';
import { useToast } from '@/ui/Toast';

interface LikesValue {
  /** 화면에 보일 강좌별 좋아요 수(내 낙관적 변화 포함) */
  counts: LikeCounts;
  isLiked(courseId: string): boolean;
  /** 학생만. 교사 화면은 없음(숫자만 본다) */
  toggle?: (courseId: string) => void;
}

const Ctx = createContext<LikesValue>({ counts: {}, isLiked: () => false });
export const useLikes = () => useContext(Ctx);

const SEND_DELAY_MS = 350;
/** adj 가 어떤 이유로 서버 수에 흡수되지 않아도 이 시간 뒤엔 서버 수를 믿는다 */
const ADJ_TTL_MS = 10_000;

/** 학생: 내 좋아요 + 누르기 */
export function StudentLikesProvider({ sid, children }: { sid: string; children: ReactNode }) {
  const toast = useToast();
  const server = useCourseLikes();
  const mineDoc = useMyLikes(sid);
  const mine = useMemo(() => mineDoc?.courses ?? {}, [mineDoc]);

  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [adj, setAdj] = useState<Record<string, number>>({});
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const mineRef = useRef(mine);
  mineRef.current = mine;
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const inflight = useRef<Record<string, boolean>>({});
  const adjAt = useRef<Record<string, number>>({});

  // 서버 수가 바뀌어 들어오면 그만큼 내 adj 를 흡수
  const prevServer = useRef<LikeCounts>({});
  useEffect(() => {
    if (!server) return;
    const prev = prevServer.current;
    prevServer.current = server;
    setAdj((a) => {
      let changed = false;
      const next = { ...a };
      for (const id of Object.keys(a)) {
        const d = (server[id] ?? 0) - (prev[id] ?? 0);
        const v = a[id];
        if (d === 0 || v === 0) continue;
        // 같은 방향 변화만큼 줄인다(0 을 넘어가지 않게)
        const take = v > 0 ? Math.min(v, Math.max(0, d)) : Math.max(v, Math.min(0, d));
        if (take !== 0) {
          next[id] = v - take;
          changed = true;
        }
      }
      return changed ? next : a;
    });
  }, [server]);

  // 내 좋아요 문서가 원하는 상태가 되면 pending 정리(보내는 중·대기 중인 건 그대로)
  useEffect(() => {
    setPending((p) => {
      let changed = false;
      const next = { ...p };
      for (const [id, want] of Object.entries(p)) {
        if (!timers.current[id] && !inflight.current[id] && !!mine[id] === want) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : p;
    });
  }, [mine]);

  // 안전망: 오래 남은 adj 는 버리고 서버 수를 믿는다
  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      setAdj((a) => {
        const stale = Object.keys(a).filter((id) => a[id] !== 0 && now - (adjAt.current[id] ?? 0) > ADJ_TTL_MS && !timers.current[id] && !inflight.current[id]);
        if (!stale.length) return a;
        const next = { ...a };
        for (const id of stale) next[id] = 0;
        return next;
      });
    }, 3000);
    return () => clearInterval(t);
  }, []);

  const send = useCallback(
    async (id: string) => {
      delete timers.current[id];
      const want = pendingRef.current[id];
      if (want === undefined) return;
      if (!!mineRef.current[id] === want) {
        // 눌렀다 다시 풀어 원래대로 → 보낼 필요 없음
        setPending((p) => {
          const { [id]: _, ...rest } = p;
          return rest;
        });
        return;
      }
      inflight.current[id] = true;
      try {
        await call('setLike', { courseId: id, liked: want });
      } catch (e) {
        // 실패: 하트·숫자 되돌리기
        setPending((p) => {
          const { [id]: _, ...rest } = p;
          return rest;
        });
        setAdj((a) => ({ ...a, [id]: (a[id] ?? 0) - (want ? 1 : -1) }));
        toast(`좋아요를 저장하지 못했어요. ${(e as Error).message}`, 'error');
      } finally {
        delete inflight.current[id];
        // 그사이 서버 문서가 이미 맞춰졌으면 바로 정리
        setPending((p) => {
          if (p[id] === undefined || timers.current[id] || !!mineRef.current[id] !== p[id]) return p;
          const { [id]: _, ...rest } = p;
          return rest;
        });
      }
    },
    [toast],
  );

  const isLiked = useCallback((id: string) => pending[id] ?? !!mine[id], [pending, mine]);

  const toggle = useCallback(
    (id: string) => {
      const next = !(pendingRef.current[id] ?? !!mineRef.current[id]);
      setPending((p) => ({ ...p, [id]: next }));
      setAdj((a) => ({ ...a, [id]: (a[id] ?? 0) + (next ? 1 : -1) }));
      adjAt.current[id] = Date.now();
      if (timers.current[id]) clearTimeout(timers.current[id]);
      timers.current[id] = setTimeout(() => void send(id), SEND_DELAY_MS);
    },
    [send],
  );

  // 화면을 떠날 때 기다리던 저장은 바로 보낸다
  useEffect(
    () => () => {
      for (const id of Object.keys(timers.current)) {
        clearTimeout(timers.current[id]);
        void send(id);
      }
    },
    [send],
  );

  const counts = useMemo(() => {
    const out: LikeCounts = { ...(server ?? {}) };
    for (const [id, d] of Object.entries(adj)) if (d) out[id] = Math.max(0, (out[id] ?? 0) + d);
    return out;
  }, [server, adj]);

  const value = useMemo<LikesValue>(() => ({ counts, isLiked, toggle }), [counts, isLiked, toggle]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** 교사: 숫자만 */
export function TeacherLikesProvider({ children }: { children: ReactNode }) {
  const server = useCourseLikes();
  const value = useMemo<LikesValue>(() => ({ counts: server ?? {}, isLiked: () => false }), [server]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

type Variant = 'chip' | 'big';

/**
 * 하트 + 숫자.
 * - chip: 썸네일 위에 얹는 작은 유리 알약(누르는 범위는 44px).
 * - big: 강좌 상세의 큰 버튼.
 * 학생은 누를 수 있고, 교사는 숫자만(0이면 숨김).
 */
export function LikeButton({ courseId, variant = 'chip', className = '' }: { courseId: string; variant?: Variant; className?: string }) {
  const { counts, isLiked, toggle } = useLikes();
  const liked = isLiked(courseId);
  const n = counts[courseId] ?? 0;
  // 누를 때마다 톡 튀는 움직임(누른 횟수를 key 로 다시 재생)
  const [pops, setPops] = useState(0);

  const heart = (size: number) => (
    <Heart
      key={pops}
      size={size}
      strokeWidth={2.4}
      className={`shrink-0 transition-colors ${liked ? 'fill-rose-500 text-rose-500' : 'text-ink/55'} ${pops && liked ? 'animate-heart-pop' : ''}`}
      aria-hidden
    />
  );

  if (!toggle) {
    if (n === 0) return null;
    return variant === 'big' ? (
      <span className={`inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1.5 text-[14px] font-bold text-rose-600 ring-1 ring-rose-100 ${className}`}>
        <Heart size={16} className="fill-rose-500 text-rose-500" aria-hidden /> 좋아요 {n}
      </span>
    ) : (
      <span className={`glass-lens pointer-events-none inline-flex h-6 items-center gap-1 rounded-full px-2 text-[12px] font-extrabold text-rose-600 tabular-nums ${className}`}>
        <Heart size={12} className="fill-rose-500 text-rose-500" aria-hidden />
        {n}
      </span>
    );
  }

  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPops((x) => x + 1);
    toggle(courseId);
  };
  const label = `좋아요 ${n}개. ${liked ? '누르면 좋아요를 취소해요' : '누르면 좋아요를 눌러요'}`;

  if (variant === 'big') {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={liked}
        aria-label={label}
        className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-[15px] font-bold ring-1 transition active:scale-95 ${
          liked ? 'bg-rose-50 text-rose-600 ring-rose-200' : 'bg-white/70 text-ink ring-white'
        } ${className}`}
      >
        {heart(18)}
        <span>{liked ? '좋아요' : '좋아요 누르기'}</span>
        <span className="tabular-nums">{n}</span>
      </button>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-pressed={liked} aria-label={label} className={`grid min-h-11 min-w-11 place-items-center ${className}`}>
      <span
        className={`inline-flex h-7 items-center gap-1 rounded-full px-2 text-[12px] font-extrabold tabular-nums shadow-[0_4px_10px_-4px_rgb(17_17_20/0.35)] transition ${
          liked ? 'bg-rose-500 text-white ring-1 ring-rose-400' : 'glass-lens text-ink/70'
        }`}
      >
        <Heart
          key={pops}
          size={14}
          strokeWidth={2.4}
          className={`shrink-0 ${liked ? 'fill-white text-white' : 'text-ink/55'} ${pops && liked ? 'animate-heart-pop' : ''}`}
          aria-hidden
        />
        {n > 0 && n}
      </span>
    </button>
  );
}
