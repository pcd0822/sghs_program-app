import { TIME_ZONE } from '@shared/constants';

export { formatDate } from '@shared/text';

const dt = new Intl.DateTimeFormat('ko-KR', {
  timeZone: TIME_ZONE,
  month: 'numeric',
  day: 'numeric',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** ms → "12. 1. (화) 09:00" 형태(한국 시각) */
export function formatDateTime(ms: number): string {
  const p = Object.fromEntries(dt.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return `${p.month}.${p.day}.(${p.weekday}) ${p.hour}:${p.minute}`;
}

/** "10:00"~"12:00" → "10:00~12:00" */
export const timeRange = (c: { start: string; end: string }) => `${c.start}~${c.end}`;

export function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** ms → datetime-local 입력칸 값(한국 시각 기준 "2026-11-23T09:00") */
export function toKstInput(ms: number | null): string {
  if (ms === null) return '';
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(ms))
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** datetime-local 입력칸 값(한국 시각) → ms. 컴퓨터 시간대 설정과 상관없이 한국 시각으로 본다. */
export function fromKstInput(v: string): number | null {
  if (!v) return null;
  const t = Date.parse(`${v}:00+09:00`);
  return Number.isNaN(t) ? null : t;
}
