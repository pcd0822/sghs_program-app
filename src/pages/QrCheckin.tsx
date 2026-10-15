// 학생이 휴대폰 기본 카메라로 출석 QR 을 찍으면 열리는 화면(/qr/강좌ID/start|end/비밀값).
// 이 브라우저에 로그인된 본인 계정으로만 체크한다. 로그인 전이면 로그인 후 이 주소로 돌아와 이어서 체크한다.

import { CircleCheck, KeyRound, QrCode, TriangleAlert, type LucideIcon } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { Course, QrPhase } from '@shared/types';
import { useAuth } from '@/auth/AuthProvider';
import { call } from '@/lib/call';
import { db } from '@/lib/firebase';
import { formatClock, formatDate, timeRange } from '@/lib/format';
import { Button } from '@/ui/Button';
import { IconTile, type GlyphTone } from '@/ui/Glyph';
import { setPendingQr } from './qrPending';

const phaseText = (p: QrPhase) => (p === 'start' ? '시작' : '종료');

interface Result {
  at: number;
  already: boolean;
  /** 다른 쪽(시작이면 종료) QR 찍은 시각 */
  other: number | null;
}

export default function QrCheckin() {
  const { courseId = '', phase: rawPhase = '', key = '' } = useParams();
  const phase: QrPhase | null = rawPhase === 'start' || rawPhase === 'end' ? rawPhase : null;
  const { session } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [course, setCourse] = useState<Course | null>(null);
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const sent = useRef(false);
  const role = session?.claims.role;

  useEffect(() => {
    if (!/^[\w-]{1,64}$/.test(courseId)) return;
    getDoc(doc(db, 'courses', courseId))
      .then((s) => s.exists() && setCourse({ ...(s.data() as Course), id: s.id }))
      .catch(() => {});
  }, [courseId]);

  useEffect(() => {
    if (role !== 'student' || !phase || sent.current) return;
    sent.current = true;
    setPendingQr(null);
    call<object, Result>('qrCheckin', { courseId, phase, key })
      .then(setRes)
      .catch((e) => setErr((e as Error).message));
  }, [role, phase, courseId, key]);

  const head = course && (
    <div className="mt-5 rounded-3xl bg-soft px-4 py-3">
      <p className="text-[17px] font-bold">{course.name}</p>
      <p className="text-[14px] text-sub">
        {formatDate(course.date)} {timeRange(course)} · {course.place}
      </p>
    </div>
  );

  if (!phase) return <Screen icon={TriangleAlert} tone="rose" title="올바른 출석 QR이 아니에요" desc="선생님 화면의 QR을 다시 찍어 주세요." />;

  if (!session) {
    return (
      <Screen icon={KeyRound} tone="violet" title={`${phaseText(phase)} 출석 체크`} desc="본인 학번으로 로그인하면 바로 출석이 체크돼요. 다른 사람 출석은 대신 찍을 수 없어요.">
        {head}
        <Button
          className="mt-8"
          onClick={() => {
            setPendingQr(loc.pathname);
            nav('/login/student');
          }}
        >
          학생 로그인하고 출석 체크
        </Button>
      </Screen>
    );
  }

  if (role !== 'student') {
    return (
      <Screen icon={QrCode} tone="slate" title="학생 계정으로 찍어 주세요" desc="출석 QR은 학생이 자기 휴대폰(로그인한 앱)으로 찍어야 체크돼요. 교사 계정에서는 체크되지 않아요.">
        <Button variant="ghost" className="mt-8" onClick={() => nav('/', { replace: true })}>
          처음 화면으로
        </Button>
      </Screen>
    );
  }

  if (err) {
    return (
      <Screen icon={TriangleAlert} tone="rose" title="출석 체크가 안 됐어요" desc={err}>
        {head}
        <Button variant="ghost" className="mt-8" onClick={() => nav('/s', { replace: true })}>
          앱으로 가기
        </Button>
      </Screen>
    );
  }

  if (!res) {
    return (
      <Screen icon={QrCode} tone="violet" title="출석 체크하는 중…" desc="잠시만 기다려 주세요.">
        <span className="mx-auto mt-8 block size-8 animate-spin rounded-full border-[3px] border-brand-500 border-r-transparent" aria-busy="true" />
      </Screen>
    );
  }

  const start = phase === 'start' ? res.at : res.other;
  const end = phase === 'end' ? res.at : res.other;
  const complete = start !== null && end !== null;
  return (
    <Screen
      icon={CircleCheck}
      tone="mint"
      title={complete ? '출석 완료!' : `${phaseText(phase)} 출석 체크됐어요`}
      desc={
        complete
          ? '시작과 종료 QR을 모두 찍었어요.'
          : phase === 'start'
            ? '수업이 끝날 때 종료 QR도 꼭 찍어야 출석이 완료돼요.'
            : '시작 QR이 아직 없어요. 시작 QR을 찍지 않았다면 선생님께 말씀드려 주세요.'
      }
    >
      {res.already && <p className="mt-2 text-[14px] font-semibold text-sub">이미 찍은 QR이에요. 처음 찍은 시각으로 남아 있어요.</p>}
      {head}
      <div className="mt-3 grid grid-cols-2 gap-2 text-center">
        {(['start', 'end'] as const).map((p) => {
          const at = p === 'start' ? start : end;
          return (
            <div key={p} className={`rounded-3xl px-3 py-4 ring-1 ${at !== null ? 'bg-emerald-50 ring-emerald-200' : 'bg-white ring-line'}`}>
              <p className="text-[14px] font-semibold text-sub">{phaseText(p)} QR</p>
              <p className={`mt-1 text-[22px] font-extrabold tabular-nums ${at !== null ? 'text-emerald-700' : 'text-zinc-300'}`}>{at !== null ? formatClock(at) : '아직'}</p>
            </div>
          );
        })}
      </div>
      <Button variant="ghost" className="mt-8" onClick={() => nav('/s', { replace: true })}>
        앱으로 가기
      </Button>
    </Screen>
  );
}

function Screen({ icon, tone, title, desc, children }: { icon: LucideIcon; tone: GlyphTone; title: string; desc: string; children?: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-[max(env(safe-area-inset-top),40px)] pb-[max(env(safe-area-inset-bottom),24px)]">
      <IconTile icon={icon} tone={tone} size={64} />
      <h1 className="mt-4 text-[26px] font-extrabold tracking-tight">{title}</h1>
      <p className="mt-1 text-[15px] leading-relaxed text-sub">{desc}</p>
      {children}
    </main>
  );
}
