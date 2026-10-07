// 출결 체크 칸과 기록 처리. 학급출결(결석)과 교과수업출결(결과)이 같은 기록을 쓴다.

import { X } from 'lucide-react';
import { useCallback, useState } from 'react';
import { call } from '@/lib/call';
import { formatDateTime } from '@/lib/format';
import { useToast } from '@/ui/Toast';

export interface AttendanceDoc {
  date: string;
  sid: string;
  classNo: number;
  absent: boolean;
  updatedByName: string;
  updatedAt: number;
}

/** sid → 출결 문서 */
export function toAttendanceMap(list: AttendanceDoc[] | undefined): Map<string, AttendanceDoc> {
  return new Map((list ?? []).map((a) => [a.sid, a]));
}

/** 체크를 바꾸는 동작. 처리 중인 학생은 잠근다. 결과는 실시간 수신으로 화면에 돌아온다. */
export function useAttendanceToggle(date: string) {
  const toast = useToast();
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const toggle = useCallback(
    async (sid: string, absent: boolean) => {
      setPending((p) => ({ ...p, [sid]: absent }));
      try {
        await call('setAttendance', { date, sid, absent });
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

/** 큰 체크 칸 + 아래 작은 글씨로 마지막 변경자·시각 */
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
          shown ? 'bg-rose-50 text-rose-600 ring-rose-200' : 'bg-white text-emerald-700 ring-line'
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
