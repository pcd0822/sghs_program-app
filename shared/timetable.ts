// 시간표에 보일 날짜와 주차 묶음. 화면(admin·학생·교사)과 서버 검사가 함께 쓴다.
// 기본 운영 기간(OPERATING_DATES) + admin 이 시간표 관리에서 더한 날짜(config/timetable.dates).

import { OPERATING_DATES } from './constants';
import type { TimetableConfig } from './types';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
/** 시간표에 더할 수 있는 날짜 범위(학년말까지) */
export const TIMETABLE_MIN = '2026-11-01';
export const TIMETABLE_MAX = '2027-02-28';

/** 달력에 실제로 있는 날짜이고 허용 범위 안인지 */
export function isTimetableDate(iso: unknown): iso is string {
  if (typeof iso !== 'string' || !ISO.test(iso)) return false;
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso) return false;
  return iso >= TIMETABLE_MIN && iso <= TIMETABLE_MAX;
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 그 날짜가 든 주의 월요일 */
export function mondayOf(iso: string): string {
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay(); // 0=일
  return addDays(iso, day === 0 ? -6 : 1 - day);
}

/** 기본 운영 날짜인지(admin 이 지울 수 없는 날짜) */
export const isBaseDate = (iso: string) => OPERATING_DATES.includes(iso);

/** 시간표에 보일 날짜 전체(정렬, 중복 없음). 고정 일정이 있는 날짜도 빠지지 않게 넣는다. */
export function timetableDates(t: Pick<TimetableConfig, 'dates' | 'fixedEvents'> | null | undefined): string[] {
  const set = new Set<string>(OPERATING_DATES);
  for (const d of t?.dates ?? []) if (isTimetableDate(d)) set.add(d);
  for (const e of t?.fixedEvents ?? []) if (isTimetableDate(e.date)) set.add(e.date);
  return [...set].sort();
}

/** 날짜들을 월~일 한 주씩 묶는다: 1주차, 2주차, … */
export function groupWeeks(dates: string[]): { label: string; dates: string[] }[] {
  const map = new Map<string, string[]>();
  for (const d of [...dates].sort()) {
    const m = mondayOf(d);
    if (!map.has(m)) map.set(m, []);
    map.get(m)!.push(d);
  }
  return [...map.values()].map((ds, i) => ({
    label: `${i + 1}주차`,
    dates: ds,
  }));
}

/** 마지막 날짜 다음 주 월~금 */
export function nextWeekdays(dates: string[]): string[] {
  const last = [...dates].sort().at(-1) ?? OPERATING_DATES[OPERATING_DATES.length - 1];
  const mon = addDays(mondayOf(last), 7);
  return [0, 1, 2, 3, 4].map((i) => addDays(mon, i));
}
