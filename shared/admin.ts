// admin 대시보드 "저장 및 배포" 자료 모양과 검사. 화면(미리 검사)과 서버(최종 검사)가 함께 쓴다.

import { formatDate, parseSid, phoneDigits, timesOverlap } from './text';
import type { Course, FixedEvent, PeriodConfig, Teacher, TimetableConfig } from './types';

/** 대시보드에서 고칠 수 있는 강좌 항목(신청 인원 count 는 서버만 관리) */
export type CourseInput = Omit<Course, 'count'>;

export interface TeacherInput extends Omit<Teacher, 'photoUrl'> {
  code: string;
}

export interface StudentInput {
  sid: string;
  name: string;
  /** 숫자만. 빈 문자열이면 연락처 없음 */
  phone: string;
}

export interface PublishPayload {
  courses?: { upsert: CourseInput[]; remove: string[] };
  teachers?: { upsert: TeacherInput[]; remove: string[] };
  students?: { upsert: StudentInput[]; remove: string[] };
  period?: PeriodConfig;
  timetable?: TimetableConfig;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO = /^2026-(11|12)-\d{2}$/;

export const COURSE_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function validateCourse(c: CourseInput): string | null {
  const label = `강좌 「${c.name || c.id}」`;
  if (!COURSE_ID.test(c.id)) return `${label}: 강좌 ID가 올바르지 않아요`;
  if (!c.name.trim()) return `${label}: 프로그램명을 입력해 주세요`;
  if (!c.code.trim()) return `${label}: 프로그램코드를 입력해 주세요`;
  if (c.category !== '필수' && c.category !== '선택') return `${label}: 분류는 필수/선택 중 하나예요`;
  if (!ISO.test(c.date)) return `${label}: 날짜가 올바르지 않아요`;
  if (!HHMM.test(c.start) || !HHMM.test(c.end) || c.start >= c.end) return `${label}: 시간이 올바르지 않아요(시작 < 끝)`;
  if (c.capacity !== null && (!Number.isInteger(c.capacity) || c.capacity < 1 || c.capacity > 1000)) return `${label}: 정원은 1 이상의 정수예요`;
  if (!Array.isArray(c.teacherIds)) return `${label}: 담당교사 형식 오류`;
  return null;
}

export function validateTeacher(t: TeacherInput): string | null {
  const label = `교사 「${t.name || t.id}」`;
  if (!t.name.trim()) return `${label}: 이름을 입력해 주세요`;
  if (!/^\d{4}$/.test(t.code)) return `${label}: 코드는 4자리 숫자예요`;
  if (t.homeroom !== null && !(Number.isInteger(t.homeroom) && t.homeroom >= 0 && t.homeroom <= 9)) return `${label}: 담당학급은 비우거나 0~9예요`;
  return null;
}

export function validateStudent(s: StudentInput): string | null {
  if (!parseSid(s.sid)) return `학번 ${s.sid}: 5자리 학번이 아니에요`;
  if (!s.name.trim()) return `학번 ${s.sid}: 이름을 입력해 주세요`;
  const p = phoneDigits(s.phone);
  if (p && (p.length < 9 || p.length > 11)) return `학번 ${s.sid}: 연락처 자릿수가 이상해요(${s.phone})`;
  return null;
}

export interface Overlap {
  date: string;
  event: FixedEvent;
  course: Pick<Course, 'id' | 'name' | 'start' | 'end'>;
}

/** 고정 일정과 같은 날짜 강좌 운영 시간이 겹치는 곳 */
export function findOverlaps(courses: Pick<Course, 'id' | 'name' | 'date' | 'start' | 'end'>[], events: FixedEvent[]): Overlap[] {
  const out: Overlap[] = [];
  for (const e of events) {
    for (const c of courses) {
      if (c.date === e.date && timesOverlap(c, e)) out.push({ date: e.date, event: e, course: c });
    }
  }
  return out;
}

export function overlapText(o: Overlap): string {
  return `${formatDate(o.date)} 고정 일정 「${o.event.title}」(${o.event.start}~${o.event.end})이 강좌 「${o.course.name}」(${o.course.start}~${o.course.end})과 겹쳐요`;
}

export function validateTimetable(t: TimetableConfig): string | null {
  for (const e of t.fixedEvents) {
    if (!e.title.trim()) return `${formatDate(e.date)} 고정 일정 이름을 입력해 주세요`;
    if (!ISO.test(e.date) || !HHMM.test(e.start) || !HHMM.test(e.end) || e.start >= e.end) return `고정 일정 「${e.title}」의 날짜·시간이 올바르지 않아요`;
  }
  for (const n of t.dayNotes) {
    if (!n.text.trim()) return '빈 안내 문구가 있어요';
    if (!n.dates.length || n.dates.some((d) => !ISO.test(d))) return `안내 문구 「${n.text}」의 날짜를 골라 주세요`;
  }
  return null;
}

export function validatePeriod(p: PeriodConfig): string | null {
  if (!['auto', 'open', 'closed'].includes(p.mode)) return '신청 상태 값이 올바르지 않아요';
  if (p.openAt !== null && p.closeAt !== null && p.openAt >= p.closeAt) return '마감 일시는 시작 일시보다 늦어야 해요';
  if (p.mode === 'auto' && p.openAt === null) return '"시각대로 열기"를 쓰려면 시작 일시를 정해 주세요';
  return null;
}
