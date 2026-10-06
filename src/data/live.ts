// Firestore 실시간 수신. 학생 화면은 강좌 목록 · 신청 기간 · 시간표 설정 · 내 신청 문서만 받는다.

import { collection, doc, onSnapshot, type Query } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import type { Application } from '@shared/rules';
import type { Course, PeriodConfig, Student, Teacher, TimetableConfig } from '@shared/types';
import { byDateTime } from '@shared/rules';
import { db } from '@/lib/firebase';

/** undefined = 불러오는 중 */
export function useCourses(): Course[] | undefined {
  const [list, setList] = useState<Course[]>();
  useEffect(
    () =>
      onSnapshot(
        collection(db, 'courses'),
        (snap) => setList(snap.docs.map((d) => ({ ...(d.data() as Course), id: d.id })).sort(byDateTime)),
        () => setList([]),
      ),
    [],
  );
  return list;
}

function useDoc<T>(path: string | null): T | null | undefined {
  const [v, setV] = useState<T | null>();
  useEffect(() => {
    if (!path) return;
    return onSnapshot(
      doc(db, path),
      (s) => setV(s.exists() ? (s.data() as T) : null),
      () => setV(null),
    );
  }, [path]);
  return v;
}

export const usePeriod = () => useDoc<PeriodConfig>('config/period');
export const useTimetable = () => useDoc<TimetableConfig>('config/timetable');
export const useApplication = (sid: string | null) => useDoc<Application>(sid ? `applications/${sid}` : null);
export const useStudentDoc = (sid: string | null) => useDoc<Student>(sid ? `students/${sid}` : null);

/**
 * 쿼리 실시간 수신. key 가 바뀔 때만 다시 연결한다(쿼리 객체는 매번 새로 만들어지므로).
 * makeQuery 가 null 이면 연결하지 않는다.
 */
export function useQueryDocs<T>(key: string | null, makeQuery: () => Query | null): (T & { _id: string })[] | undefined {
  const [list, setList] = useState<(T & { _id: string })[]>();
  useEffect(() => {
    setList(undefined);
    const q = key ? makeQuery() : null;
    if (!q) return;
    return onSnapshot(
      q,
      (snap) => setList(snap.docs.map((d) => ({ ...(d.data() as T), _id: d.id }))),
      (e) => {
        console.error('[live]', key, e);
        setList([]);
      },
    );
  }, [key]); // makeQuery 는 매번 새로 만들어지므로 key 로만 판단
  return list;
}

export function useTeachers(enabled: boolean): Teacher[] | undefined {
  const [list, setList] = useState<Teacher[]>();
  useEffect(() => {
    if (!enabled) return;
    return onSnapshot(
      collection(db, 'teachers'),
      (snap) => setList(snap.docs.map((d) => ({ ...(d.data() as Teacher), id: d.id })).sort((a, b) => a.name.localeCompare(b.name, 'ko'))),
      () => setList([]),
    );
  }, [enabled]);
  return list;
}

export const useTeacherDoc = (tid: string | null) => useDoc<Teacher>(tid ? `teachers/${tid}` : null);

/** 매 초(또는 지정 간격) 바뀌는 현재 시각 — 신청 시작 카운트다운용 */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
