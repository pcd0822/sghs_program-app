// 수강신청 규칙. 화면(미리 막기)과 서버(최종 판정)가 이 파일 하나를 함께 쓴다.

import type { Course, PeriodConfig } from './types';

/** applications/{학번} 의 강좌 한 칸 */
export interface AppItem {
  /** 강좌명 복사본(안내 문구·학급 현황 표에 쓰려고) */
  name: string;
  code: string;
  date: string;
  category: Course['category'];
  /** ms */
  at: number;
  by: 'student' | 'admin';
}

/** applications/{학번} */
export interface Application {
  sid: string;
  classNo: number;
  number: number;
  name: string;
  items: Record<string, AppItem>;
  submitted: boolean;
  submittedAt: number | null;
  updatedAt: number;
}

export type RuleCode = 'ALREADY' | 'DUP_CODE' | 'SAME_DATE' | 'FULL' | 'NOT_OPEN' | 'CLOSED' | 'SELF_PAY_CONFIRM' | 'NOT_FOUND';

export interface RuleError {
  code: RuleCode;
  message: string;
}

export const DUP_CODE_MESSAGE = '중복 신청 불가 프로그램입니다';

// ───────────── 필수·선택 요건 ─────────────

export interface Requirements {
  /** 분류가 필수인 강좌 전부 */
  required: Course[];
  /** 선택 강좌가 열리는 날짜들(오름차순) */
  selectiveDates: string[];
}

export function requirements(courses: Course[]): Requirements {
  return {
    required: courses.filter((c) => c.category === '필수').sort(byDateTime),
    selectiveDates: [...new Set(courses.filter((c) => c.category === '선택').map((c) => c.date))].sort(),
  };
}

export interface Missing {
  kind: 'required' | 'selective';
  date: string;
  /** 필수 강좌가 빠졌을 때 그 강좌 */
  course?: Course;
}

export interface Progress {
  requiredDone: number;
  requiredTotal: number;
  selectiveDone: number;
  selectiveTotal: number;
  missing: Missing[];
  complete: boolean;
}

export function progress(courses: Course[], items: Record<string, AppItem>): Progress {
  const req = requirements(courses);
  const mine = Object.entries(items);
  const missing: Missing[] = [];

  let requiredDone = 0;
  for (const c of req.required) {
    if (items[c.id]) requiredDone++;
    else missing.push({ kind: 'required', date: c.date, course: c });
  }
  let selectiveDone = 0;
  for (const d of req.selectiveDates) {
    if (mine.some(([, it]) => it.category === '선택' && it.date === d)) selectiveDone++;
    else missing.push({ kind: 'selective', date: d });
  }
  missing.sort((a, b) => a.date.localeCompare(b.date));
  return {
    requiredDone,
    requiredTotal: req.required.length,
    selectiveDone,
    selectiveTotal: req.selectiveDates.length,
    missing,
    complete: missing.length === 0,
  };
}

export function missingText(m: Missing, fmtDate: (iso: string) => string): string {
  return m.kind === 'required' ? `${fmtDate(m.date)} 필수 「${m.course?.name ?? ''}」` : `${fmtDate(m.date)} 선택 강좌 1개`;
}

// ───────────── 신청 가능 여부 ─────────────

/**
 * 학생 본인의 신청 목록 기준 규칙(코드 중복·같은 날 선택). admin 수동 배정에도 똑같이 적용한다.
 * ignoreCourseId: "변경"할 때 빠질 강좌
 */
export function checkPersonalRules(course: Course, items: Record<string, AppItem>, ignoreCourseId?: string): RuleError | null {
  if (items[course.id]) return { code: 'ALREADY', message: '이미 신청한 강좌예요.' };
  for (const [id, it] of Object.entries(items)) {
    if (id === ignoreCourseId) continue;
    if (it.code === course.code) return { code: 'DUP_CODE', message: DUP_CODE_MESSAGE };
  }
  if (course.category === '선택') {
    for (const [id, it] of Object.entries(items)) {
      if (id === ignoreCourseId) continue;
      if (it.category === '선택' && it.date === course.date) {
        return { code: 'SAME_DATE', message: `이 날짜에는 이미 「${it.name}」을(를) 신청했어요. 바꾸려면 먼저 취소해 주세요.` };
      }
    }
  }
  return null;
}

export function isFull(course: Course): boolean {
  return course.capacity !== null && course.count >= course.capacity;
}

export function remaining(course: Course): number | null {
  return course.capacity === null ? null : Math.max(0, course.capacity - course.count);
}

// ───────────── 신청 기간 ─────────────

export type PeriodState = 'unset' | 'before' | 'open' | 'closed';

export function periodState(p: PeriodConfig | null | undefined, now: number): PeriodState {
  if (!p) return 'unset';
  if (p.mode === 'open') return 'open';
  if (p.mode === 'closed') return 'closed';
  if (p.openAt === null) return 'unset';
  if (now < p.openAt) return 'before';
  if (p.closeAt !== null && now >= p.closeAt) return 'closed';
  return 'open';
}

/** 학생이 이 강좌를 지금 신청·취소할 수 있는 기간인지 */
export function checkWindow(p: PeriodConfig | null | undefined, course: Course | null, now: number): RuleError | null {
  const s = periodState(p, now);
  if (s === 'before' || s === 'unset') return { code: 'NOT_OPEN', message: '아직 수강신청 기간이 아니에요.' };
  if (s === 'closed') return { code: 'CLOSED', message: '수강신청이 마감되었어요.' };
  if (course?.closeAt != null && now >= course.closeAt) return { code: 'CLOSED', message: '이 강좌는 신청이 마감되었어요.' };
  return null;
}

// ───────────── 정렬·순위 ─────────────

export function byDateTime(a: Course, b: Course): number {
  return a.date.localeCompare(b.date) || a.start.localeCompare(b.start) || a.order - b.order;
}

/** 정원 대비 신청 비율. 정원 없는 강좌는 순위에서 뺀다. */
export function fillRatio(c: Course): number {
  return c.capacity ? c.count / c.capacity : 0;
}

export function hypeTop(courses: Course[], n = 5): Course[] {
  return courses
    .filter((c) => c.capacity !== null && c.count > 0)
    .sort((a, b) => fillRatio(b) - fillRatio(a) || b.count - a.count)
    .slice(0, n);
}

export function roomyTop(courses: Course[], n = 5): Course[] {
  return courses
    .filter((c) => c.capacity !== null && !isFull(c))
    .sort((a, b) => fillRatio(a) - fillRatio(b) || (remaining(b) ?? 0) - (remaining(a) ?? 0))
    .slice(0, n);
}
