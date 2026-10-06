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
