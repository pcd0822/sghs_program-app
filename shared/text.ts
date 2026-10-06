// 날짜·시간·이름·연락처 문자열 처리. 외부 라이브러리 없이 순수 함수만.

import { PROGRAM_YEAR } from './constants';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** 연락처 비교용: 숫자만 남긴다. */
export function phoneDigits(v: unknown): string {
  return String(v ?? '').replace(/\D/g, '');
}

/** 이름 비교용: 앞뒤·중간 공백 제거. */
export function normalizeName(v: unknown): string {
  return String(v ?? '').replace(/\s+/g, '');
}

/** 학번 5자리(3학년) 검사 후 학급·번호를 꺼낸다. */
export function parseSid(v: unknown): { sid: string; classNo: number; number: number } | null {
  const sid = String(v ?? '').trim();
  if (!/^[1-3]\d{4}$/.test(sid)) return null;
  const classNo = Number(sid.slice(1, 3));
  const number = Number(sid.slice(3, 5));
  if (classNo < 1 || number < 1) return null;
  return { sid, classNo, number };
}

/** 공개 글 작성자 가리기: "박찬들" → "박○○" */
export function maskName(name: string): string {
  const n = normalizeName(name);
  if (n.length <= 1) return n;
  return n[0] + '○'.repeat(n.length - 1);
}

/** 시트 수강일 "12.1.(화)" → "2026-12-01". 요일이 틀리면 오류. */
export function parseSheetDate(v: unknown): string {
  const s = String(v ?? '').trim();
  const m = s.match(/^(\d{1,2})\s*\.\s*(\d{1,2})\s*\.?\s*(?:\(\s*([일월화수목금토])\s*\))?$/);
  if (!m) throw new Error(`수강일 형식이 올바르지 않습니다: "${s}" (예: 12.1.(화))`);
  const month = Number(m[1]);
  const day = Number(m[2]);
  const iso = `${PROGRAM_YEAR}-${pad2(month)}-${pad2(day)}`;
  const d = new Date(`${iso}T00:00:00Z`);
  if (d.getUTCMonth() + 1 !== month || d.getUTCDate() !== day) {
    throw new Error(`없는 날짜입니다: "${s}"`);
  }
  if (m[3] && WEEKDAYS[d.getUTCDay()] !== m[3]) {
    throw new Error(`요일이 맞지 않습니다: "${s}" (${PROGRAM_YEAR}년 ${month}월 ${day}일은 ${WEEKDAYS[d.getUTCDay()]}요일)`);
  }
  return iso;
}

/** "2026-12-01" → "12.1.(화)" */
export function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}.${d.getUTCDate()}.(${WEEKDAYS[d.getUTCDay()]})`;
}

/** "10:00~12:00" → { start, end } */
export function parseTimeRange(v: unknown): { start: string; end: string } {
  const s = String(v ?? '').trim();
  const m = s.match(/^(\d{1,2}):(\d{2})\s*[~\-–]\s*(\d{1,2}):(\d{2})$/);
  if (!m) throw new Error(`시간 형식이 올바르지 않습니다: "${s}" (예: 10:00~12:00)`);
  const start = `${pad2(Number(m[1]))}:${m[2]}`;
  const end = `${pad2(Number(m[3]))}:${m[4]}`;
  if (start >= end) throw new Error(`끝나는 시각이 시작 시각보다 빠릅니다: "${s}"`);
  return { start, end };
}

/** 두 시간 구간이 겹치는지. 끝과 시작이 딱 맞닿는 것(10:00~12:00, 12:00~12:30)은 겹침이 아니다. */
export function timesOverlap(a: { start: string; end: string }, b: { start: string; end: string }): boolean {
  return a.start < b.end && b.start < a.end;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
