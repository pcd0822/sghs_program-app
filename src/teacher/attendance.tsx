// 출결 버튼과 기록 처리. 학급출결(결석)과 교과수업출결(결과)이 같은 기록을 쓴다.
// - 학급출결: 그날 학급 학생 출결. 체크 안 하면 출석(QR 과 무관).
// - 교과수업출결(프로그램): 시작·종료 QR 둘 다 찍어야 출석(shared/attendance.ts). 담임 결석은 여기서도 "결석".

import { Check, Minus, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import { attendMarkOf, statusOf, type AttendMark } from '@shared/attendance';
import { call } from '@/lib/call';
import { formatClock, formatDateTime } from '@/lib/format';
import { useToast } from '@/ui/Toast';

export interface AttendanceDoc {
  date: string;
  sid: string;
  classNo: number;
  absent: boolean;
  /** 마지막으로 바꾼 교사 ID(담임 결석인지 프로그램 결과인지 구분) */
  updatedBy?: string;
  /** 교사가 직접 "출석 인정" */
  present?: boolean;
  updatedByName: string;
  updatedAt: number;
}

/** sid → 출결 문서 */
export function toAttendanceMap(list: AttendanceDoc[] | undefined): Map<string, AttendanceDoc> {
  return new Map((list ?? []).map((a) => [a.sid, a]));
}

/** 출결 값을 바꾸는 동작. 처리 중인 학생은 잠근다. 결과는 실시간 수신으로 화면에 돌아온다. */
export function useAttendanceToggle(date: string) {
  const toast = useToast();
  const [pending, setPending] = useState<Record<string, AttendMark>>({});

  const toggle = useCallback(
    async (sid: string, mark: AttendMark) => {
      setPending((p) => ({ ...p, [sid]: mark }));
      try {
        await call('setAttendance', { date, sid, mark });
      } catch (e) {
        toast((e as Error).message, 'error');
      } finally {
        setPending((p) => {
          const { [sid]: _, ...rest } = p;
          return rest;
        });
      }
    },
    [date, toast],
  );
  return { pending, toggle };
}

interface CheckProps {
  checked: boolean;
  /** 처리 중이면 바꾸려는 값 */
  pending?: boolean;
  /** 체크했을 때 이름: 결석 / 결과 */
  onLabel: string;
  offLabel: string;
  meta?: AttendanceDoc;
  onChange(next: boolean): void;
}

/** 학급출결: 큰 체크 칸 하나(체크 = 결석, 비우면 출석) + 아래 작은 글씨로 마지막 변경자·시각 */
export function AttendCheck({ checked, pending, onLabel, offLabel, meta, onChange }: CheckProps) {
  const busy = pending !== undefined;
  const shown = busy ? pending : checked;
  return (
    <div className="flex shrink-0 flex-col items-end">
      <button
        type="button"
        role="checkbox"
        aria-checked={shown}
        aria-label={`${onLabel} 체크`}
        disabled={busy}
        onClick={() => onChange(!checked)}
        className={`flex min-h-11 min-w-[84px] items-center justify-center gap-1.5 rounded-full px-3 text-[14px] font-bold ring-1 transition active:scale-95 disabled:opacity-60 ${
          shown ? 'bg-rose-50 text-rose-600 ring-rose-200' : 'bg-white/80 text-emerald-700 ring-white shadow-[0_1px_2px_rgb(17_17_20/0.06)]'
        }`}
      >
        <span className={`grid size-5 place-items-center rounded-md ${shown ? 'bg-rose-500 text-white' : 'ring-1 ring-zinc-300'}`} aria-hidden>
          {shown && <X size={14} strokeWidth={3} />}
        </span>
        {shown ? onLabel : offLabel}
      </button>
      {meta?.updatedByName && (
        <span className="mt-0.5 text-[11px] text-[#9a9aa5]">
          {meta.updatedByName} · {formatDateTime(meta.updatedAt)}
        </span>
      )}
    </div>
  );
}

interface ControlProps {
  /** 이 학생이 그날 QR 을 찍어야 하는지(신청 프로그램이 있는지) */
  needsQr: boolean;
  /** 그날 프로그램 QR 을 다 찍었는지 */
  qrDone: boolean;
  /** 처리 중이면 바꾸려는 값 */
  pending?: AttendMark;
  /** 결석 쪽 이름: 결석 / 결과 */
  absentLabel: string;
  /** 결석일 때 이름을 바꿔 보여줄 때(담임 결석 → "결석") */
  absentShownAs?: string;
  absentCaption?: string;
  meta?: AttendanceDoc;
  onChange(next: AttendMark): void;
}

/**
 * 출결 버튼 두 개(결석·출석) + 아래 작은 글씨로 상태와 마지막 변경자.
 * 교과수업출결(프로그램) 전용. 시작·종료 QR 을 다 찍어야 출석. 못 찍었으면 둘 다 꺼진 "QR 미완료"(출석 아님).
 * - 결석: 누르면 결석, 다시 누르면 취소(QR 기준으로 돌아감)
 * - 출석: QR 미완료·결석인 학생을 "출석 인정", 다시 누르면 취소
 */
export function AttendControl({ needsQr, qrDone, pending, absentLabel, absentShownAs, absentCaption, meta, onChange }: ControlProps) {
  const busy = pending !== undefined;
  const mark = busy ? pending : attendMarkOf(meta);
  const status = statusOf(mark, needsQr, qrDone);
  const base = 'flex min-h-11 min-w-[66px] items-center justify-center gap-1 rounded-full px-2.5 text-[14px] font-bold ring-1 transition active:scale-95 disabled:opacity-60';
  const off = 'bg-white/70 text-sub ring-white shadow-[0_1px_2px_rgb(17_17_20/0.06)]';
  const caption =
    status === 'qr' ? '시작·종료 QR 미완료 · 출석 아님' : status === 'absent' ? (busy ? '' : (absentCaption ?? '')) : mark === 'present' ? '출석 인정' : status === 'present' && needsQr ? 'QR 출석' : '';
  return (
    <div className="flex shrink-0 flex-col items-end">
      <div className="flex gap-1" role="group" aria-label="출결">
        <button
          type="button"
          aria-pressed={status === 'absent'}
          disabled={busy}
          onClick={() => onChange(mark === 'absent' ? 'auto' : 'absent')}
          className={`${base} ${status === 'absent' ? 'bg-rose-500 text-white ring-rose-500' : off}`}
        >
          {status === 'absent' && <X size={14} strokeWidth={3} aria-hidden />}
          {status === 'absent' && !busy && absentShownAs ? absentShownAs : absentLabel}
        </button>
        <button
          type="button"
          aria-pressed={status === 'present'}
          disabled={busy}
          onClick={() => {
            if (mark === 'present') onChange('auto');
            else if (status !== 'present') onChange('present');
          }}
          className={`${base} ${status === 'present' ? 'bg-emerald-500 text-white ring-emerald-500' : off}`}
        >
          {status === 'present' && <Check size={14} strokeWidth={3} aria-hidden />}
          출석
        </button>
      </div>
      {caption && <span className={`mt-0.5 text-[11px] font-bold ${status === 'qr' ? 'text-amber-600' : status === 'absent' ? 'text-rose-600' : 'text-emerald-700'}`}>{caption}</span>}
      {meta?.updatedByName && (
        <span className="text-[11px] text-[#9a9aa5]">
          {meta.updatedByName} · {formatDateTime(meta.updatedAt)}
        </span>
      )}
    </div>
  );
}

/** 출석 QR 찍은 상태: 시작 · 종료 각각 시각 또는 미확인 */
export function QrMarks({ start, end, label }: { start?: number; end?: number; label?: string }) {
  const mark = (name: string, at?: number) => (
    <span className={`inline-flex items-center gap-0.5 ${typeof at === 'number' ? 'text-emerald-700' : 'text-zinc-400'}`}>
      {typeof at === 'number' ? <Check size={12} strokeWidth={3} aria-hidden /> : <Minus size={12} aria-hidden />}
      {name} {typeof at === 'number' ? formatClock(at) : '안 찍음'}
    </span>
  );
  return (
    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] font-semibold tabular-nums">
      <span className="text-sub">{label ? `${label} QR` : 'QR'}</span>
      {mark('시작', start)}
      {mark('종료', end)}
    </p>
  );
}

/** 프로필 사진(없으면 이름 첫 글자) */
export function Avatar({ url, name, size = 40 }: { url?: string | null; name: string; size?: number }) {
  return url ? (
    <img src={url} alt="" loading="lazy" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-100 to-orange-100 font-bold text-brand-700"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden
    >
      {name.slice(0, 1)}
    </span>
  );
}
