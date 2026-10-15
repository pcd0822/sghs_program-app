import { Download, Expand, QrCode, Radio, TimerOff } from 'lucide-react';
import { collection, query, where } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { QR_OPEN_MS } from '@shared/constants';
import { canUseQr, type QrPhase } from '@shared/types';
import { useCourseQr, useNow, useQueryDocs } from '@/data/live';
import { call } from '@/lib/call';
import { db } from '@/lib/firebase';
import { formatDate, timeRange } from '@/lib/format';
import { downloadQrImage, phaseLabel, qrSvg, qrUrl } from '@/lib/qr';
import { Button } from '@/ui/Button';
import { EmptyArt } from '@/ui/Glyph';
import { useToast } from '@/ui/Toast';
import { useTeacher } from './TeacherData';

interface EnrQr {
  qrStartAt?: number;
  qrEndAt?: number;
}

/** 출석 QR 화면: 교사가 화면(전자칠판·TV)에 띄우고, QR 을 켠 동안만 학생 체크가 통한다. */
export default function QrPage() {
  const { courseId = '' } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { courses, tid, homeroom, isAdmin } = useTeacher();
  const c = courses?.find((x) => x.id === courseId);
  const allowed = !!c && canUseQr({ tid, homeroom, admin: isAdmin }, c.teacherIds);
  const qr = useCourseQr(allowed ? courseId : null);
  const [phase, setPhase] = useState<QrPhase>('start');
  const [svg, setSvg] = useState('');
  const [busy, setBusy] = useState(false);
  const ensured = useRef(false);
  const now = useNow(1000);
  const box = useRef<HTMLDivElement>(null);
  // 이 화면에서 켠 QR. 끄지 않고 화면을 떠나면 자동으로 끈다(다른 선생님이 켠 QR 은 건드리지 않는다).
  const openedHere = useRef(new Set<QrPhase>());
  useEffect(() => {
    const closeAll = () => {
      for (const p of openedHere.current) void call('qrControl', { courseId, action: 'close', phase: p }, { retries: 1 }).catch(() => {});
      openedHere.current.clear();
    };
    // 탭을 닫거나 다른 주소로 나갈 때도 최대한 끈다(못 끄면 30분 뒤 저절로 꺼짐).
    window.addEventListener('pagehide', closeAll);
    return () => {
      window.removeEventListener('pagehide', closeAll);
      closeAll();
    };
  }, [courseId]);

  // 처음 여는 강좌면 서버에서 QR 비밀값을 만든다(한 번만).
  useEffect(() => {
    if (!allowed || qr !== null || ensured.current) return;
    ensured.current = true;
    call('qrControl', { courseId, action: 'ensure' }).catch((e) => toast((e as Error).message, 'error'));
  }, [allowed, qr, courseId, toast]);

  const key = qr ? (phase === 'start' ? qr.startKey : qr.endKey) : null;
  const url = key ? qrUrl(courseId, phase, key) : null;
  useEffect(() => {
    setSvg('');
    if (url) void qrSvg(url).then(setSvg);
  }, [url]);

  // 찍은 인원: 수강생 명단을 읽을 수 있는 교사만(담당 교사 · 전체 학급 · admin). 다른 반 담임은 QR 만 띄운다.
  const assigned = !!c?.teacherIds?.includes(tid);
  const readAll = isAdmin || homeroom === 0;
  const enr = useQueryDocs<EnrQr>(allowed && (assigned || readAll) ? `qr-enr-${courseId}-${assigned}` : null, () =>
    assigned
      ? query(collection(db, 'enrollments'), where('courseId', '==', courseId), where('teacherIds', 'array-contains', tid))
      : query(collection(db, 'enrollments'), where('courseId', '==', courseId)),
  );

  if (courses && !c) return <Blocked text="없어진 강좌예요." onBack={() => nav(-1)} />;
  if (c && !allowed) return <Blocked text="이 강좌의 출석 QR을 열 권한이 없어요. 담임 · 담당 교사 · admin 만 열 수 있어요." onBack={() => nav(-1)} />;

  const openUntil = qr ? (phase === 'start' ? qr.startOpenUntil : qr.endOpenUntil) : null;
  const isOpen = !!openUntil && openUntil > now;
  // 기기 시계가 서버보다 조금 늦으면 30분을 넘게 보이므로 상한을 둔다.
  const left = isOpen ? Math.min(Math.ceil((openUntil - now) / 1000), QR_OPEN_MS / 1000) : 0;
  const scanned = enr?.filter((e) => typeof (phase === 'start' ? e.qrStartAt : e.qrEndAt) === 'number').length ?? 0;
  const done = enr?.filter((e) => typeof e.qrStartAt === 'number' && typeof e.qrEndAt === 'number').length ?? 0;

  async function setOpen(open: boolean) {
    setBusy(true);
    try {
      await call('qrControl', { courseId, action: open ? 'open' : 'close', phase });
      if (open) openedHere.current.add(phase);
      else openedHere.current.delete(phase);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!c || !url) return;
    try {
      await downloadQrImage(c, phase, url);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  const canFullscreen = typeof document.documentElement.requestFullscreen === 'function';

  return (
    <main className="mx-auto min-h-dvh max-w-3xl bg-white px-5 pt-[max(env(safe-area-inset-top),16px)] pb-[max(env(safe-area-inset-bottom),24px)]">
      <button type="button" onClick={() => nav(-1)} className="-ml-3 flex min-h-11 items-center gap-1 rounded-full px-3 text-[15px] font-semibold text-sub hover:bg-soft">
        ‹ 뒤로
      </button>
      <h1 className="mt-1 text-[22px] leading-snug font-extrabold">{c?.name ?? '…'}</h1>
      {c && (
        <p className="mt-0.5 text-[14px] text-sub">
          {formatDate(c.date)} {timeRange(c)} · {c.place}
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 rounded-full bg-soft p-1" role="tablist" aria-label="QR 고르기">
        {(['start', 'end'] as const).map((p) => {
          const o = qr ? (p === 'start' ? qr.startOpenUntil : qr.endOpenUntil) : null;
          return (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={phase === p}
              onClick={() => setPhase(p)}
              className={`flex min-h-11 items-center justify-center gap-1.5 rounded-full text-[15px] font-bold transition ${phase === p ? 'bg-white shadow-sm' : 'text-sub'}`}
            >
              {phaseLabel(p)} QR
              {!!o && o > now && <span className="size-2 rounded-full bg-emerald-500" aria-label="켜짐" />}
            </button>
          );
        })}
      </div>

      <div
        className={`mt-4 flex items-center gap-3 rounded-3xl px-4 py-3 ring-1 ${isOpen ? 'bg-emerald-50 ring-emerald-200' : 'bg-soft ring-line'}`}
        aria-live="polite"
      >
        {isOpen ? <Radio className="shrink-0 text-emerald-600" aria-hidden /> : <TimerOff className="shrink-0 text-sub" aria-hidden />}
        <div className="min-w-0 flex-1">
          <p className={`text-[16px] font-bold ${isOpen ? 'text-emerald-700' : ''}`}>
            {isOpen ? `${phaseLabel(phase)} 출석 QR 켜짐 · ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} 남음` : `${phaseLabel(phase)} 출석 QR 꺼짐`}
          </p>
          <p className="text-[13px] text-sub">
            {isOpen
              ? `${QR_OPEN_MS / 60_000}분이 지나거나 이 화면을 떠나면 저절로 꺼져요.`
              : 'QR을 켜야 학생이 찍었을 때 출석이 돼요. 꺼져 있을 때 찍으면 거부돼요.'}
          </p>
        </div>
      </div>
      <Button className="mt-2" variant={isOpen ? 'primary' : 'brand'} loading={busy} disabled={!qr} onClick={() => setOpen(!isOpen)}>
        {phaseLabel(phase)} 출석 QR {isOpen ? '끄기' : '켜기'}
      </Button>

      <div ref={box} className="mt-4 flex flex-col items-center justify-center rounded-[28px] bg-white p-3 ring-1 ring-line [&:fullscreen]:rounded-none [&:fullscreen]:ring-0">
        <p className="text-[20px] font-extrabold" style={{ color: phase === 'start' ? '#059669' : '#7c3aed' }}>
          {phaseLabel(phase)} 출석 QR
        </p>
        {svg ? (
          <div
            className={`aspect-square w-full max-w-[min(100%,72dvh)] transition [&>svg]:size-full ${isOpen ? '' : 'opacity-35'}`}
            role="img"
            aria-label={`${phaseLabel(phase)} 출석 QR 코드`}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <div className="aspect-square w-full max-w-[min(100%,72dvh)] animate-pulse rounded-2xl bg-soft" />
        )}
        <p className="text-center text-[14px] text-sub">휴대폰 기본 카메라로 찍으세요 · 시작과 종료를 모두 찍어야 출석 완료</p>
      </div>

      {enr && (
        <div className="mt-3 flex flex-wrap gap-2 text-[14px] font-bold">
          <span className="rounded-full bg-soft px-3 py-1.5">수강생 {enr.length}명</span>
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">
            {phaseLabel(phase)} 찍음 {scanned}
          </span>
          <span className="rounded-full bg-brand-50 px-3 py-1.5 text-brand-700">둘 다 완료 {done}</span>
        </div>
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Button variant="ghost" disabled={!url} onClick={save}>
          <Download size={18} aria-hidden /> {phaseLabel(phase)} QR 이미지로 저장
        </Button>
        {canFullscreen && (
          <Button variant="ghost" disabled={!svg} onClick={() => void box.current?.requestFullscreen().catch(() => {})}>
            <Expand size={18} aria-hidden /> 크게 띄우기
          </Button>
        )}
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-sub">
        저장한 이미지도 같은 QR이에요. 이미지를 붙여 두거나 사진으로 돌려도, 이 화면에서 QR을 켠 동안에만 출석이 인정돼요.
      </p>
    </main>
  );
}

function Blocked({ text, onBack }: { text: string; onBack(): void }) {
  return (
    <main className="mx-auto grid min-h-dvh max-w-md place-items-center px-6 text-center">
      <div>
        <EmptyArt icon={QrCode} tone="slate" />
        <p className="mt-3 text-[16px] font-semibold">{text}</p>
        <Button variant="ghost" className="mt-6" onClick={onBack}>
          돌아가기
        </Button>
      </div>
    </main>
  );
}
