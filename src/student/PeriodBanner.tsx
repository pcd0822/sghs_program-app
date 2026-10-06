import { formatDateTime } from '@/lib/format';
import { useStudent } from './StudentData';

function countdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}일 ${h}시간 남음`;
  if (h > 0) return `${h}시간 ${m}분 남음`;
  return `${m}분 ${String(sec).padStart(2, '0')}초 남음`;
}

/** 신청 기간 안내: 열리기 전엔 여는 시각, 중엔 마감 시각, 끝나면 마감 안내 */
export function PeriodBanner() {
  const { period, periodNow, now } = useStudent();
  if (period === undefined) return <div className="mt-3 h-12 animate-pulse rounded-2xl bg-soft" />;

  const box = 'mt-3 flex items-center gap-2 rounded-2xl px-4 py-3 text-[14px] font-semibold';
  switch (periodNow) {
    case 'unset':
      return <div className={`${box} bg-soft text-sub`}>📅 수강신청 일정이 곧 안내될 예정이에요.</div>;
    case 'before':
      return (
        <div className={`${box} bg-sky-50 text-sky-800`}>
          ⏰ <span className="flex-1">{formatDateTime(period!.openAt!)}에 열려요</span>
          <span className="tabular-nums">{countdown(period!.openAt! - now)}</span>
        </div>
      );
    case 'open':
      return (
        <div className={`${box} bg-emerald-50 text-emerald-800`}>
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
          </span>
          <span className="flex-1">수강신청 진행 중</span>
          {period?.mode === 'auto' && period.closeAt && <span className="text-[13px]">{formatDateTime(period.closeAt)} 마감</span>}
        </div>
      );
    case 'closed':
      return <div className={`${box} bg-zinc-100 text-zinc-600`}>🔒 수강신청이 마감되었어요. 바꿔야 하면 담임 선생님께 말씀드려 주세요.</div>;
  }
}
