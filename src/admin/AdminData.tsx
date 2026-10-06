// admin 대시보드 자료.
// - 서버 자료는 실시간으로 받는다(admin 몇 명만 쓰므로 전체 컬렉션을 받아도 된다).
// - 설정성 자료(강좌·교사·학생·신청 기간·시간표)는 "임시 변경(draft)"에 모았다가 "저장 및 배포"로 한 번에 보낸다.
// - 수동 배정은 정원 계산이 실시간이어야 하므로 누르는 즉시 서버에 반영한다.

import { collection, onSnapshot } from 'firebase/firestore';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CourseInput, PublishPayload, StudentInput, TeacherInput } from '@shared/admin';
import type { Application } from '@shared/rules';
import type { Course, PeriodConfig, Student, Teacher, TimetableConfig } from '@shared/types';
import { useCourses, usePeriod, useTeachers, useTimetable } from '@/data/live';
import { call } from '@/lib/call';
import { db } from '@/lib/firebase';

export interface StudentRow extends Student {
  phone: string;
}
export type TeacherRow = Teacher & { code: string };

interface Drafts {
  courses: Record<string, CourseInput | null>;
  teachers: Record<string, TeacherInput | null>;
  students: Record<string, StudentInput | null>;
  period?: PeriodConfig;
  timetable?: TimetableConfig;
}
const EMPTY: Drafts = { courses: {}, teachers: {}, students: {} };

function useCollection<T>(name: string): (T & { _id: string })[] | undefined {
  const [list, setList] = useState<(T & { _id: string })[]>();
  useEffect(
    () =>
      onSnapshot(
        collection(db, name),
        (s) => setList(s.docs.map((d) => ({ ...(d.data() as T), _id: d.id }))),
        (e) => {
          console.error('[admin]', name, e);
          setList([]);
        },
      ),
    [name],
  );
  return list;
}

interface AdminValue {
  loading: boolean;
  /** 저장 전 변경이 반영된 화면용 자료 */
  courses: Course[];
  teachers: TeacherRow[];
  students: StudentRow[];
  period: PeriodConfig | null;
  timetable: TimetableConfig;
  /** 서버 자료(변경 전) */
  server: { courses: Map<string, Course>; students: Map<string, StudentRow>; teachers: Map<string, TeacherRow> };
  applications: Map<string, Application>;
  /** 강좌별 실제 신청 수(신청 문서 기준) */
  enrolledCount: Map<string, number>;

  dirty: number;
  dirtyKeys: { courses: Set<string>; teachers: Set<string>; students: Set<string>; period: boolean; timetable: boolean };
  setCourse(c: CourseInput): void;
  removeCourse(id: string): void;
  setTeacher(t: TeacherInput): void;
  removeTeacher(id: string): void;
  setStudents(list: StudentInput[]): void;
  removeStudent(sid: string): void;
  setPeriod(p: PeriodConfig): void;
  setTimetable(t: TimetableConfig): void;
  discard(): void;
  publish(): Promise<string[]>;
  assign(sid: string, add: string | null, remove: string | null): Promise<string | null>;
}

const Ctx = createContext<AdminValue | null>(null);

export function AdminDataProvider({ children }: { children: ReactNode }) {
  const serverCourses = useCourses();
  const serverTeachers = useTeachers(true);
  const teacherSecrets = useCollection<{ code: string }>('teacherSecrets');
  const serverStudents = useCollection<Student>('students');
  const secrets = useCollection<{ phone: string }>('studentSecrets');
  const apps = useCollection<Application>('applications');
  const serverPeriod = usePeriod();
  const serverTimetable = useTimetable();
  const [drafts, setDrafts] = useState<Drafts>(EMPTY);

  const loading = !serverCourses || !serverTeachers || !teacherSecrets || !serverStudents || !secrets || !apps || serverPeriod === undefined || serverTimetable === undefined;

  const server = useMemo(() => {
    const codes = new Map((teacherSecrets ?? []).map((s) => [s._id, s.code]));
    const phones = new Map((secrets ?? []).map((s) => [s._id, s.phone]));
    return {
      courses: new Map((serverCourses ?? []).map((c) => [c.id, c])),
      teachers: new Map((serverTeachers ?? []).map((t) => [t.id, { ...t, code: codes.get(t.id) ?? '' }])),
      students: new Map<string, StudentRow>(
        (serverStudents ?? []).map((s) => [
          s._id,
          { sid: s._id, name: s.name, classNo: s.classNo, number: s.number, photoUrl: s.photoUrl ?? null, phone: phones.get(s._id) ?? '' },
        ]),
      ),
    };
  }, [serverCourses, serverTeachers, teacherSecrets, serverStudents, secrets]);

  const applications = useMemo(() => new Map((apps ?? []).map((a) => [a._id, a as Application])), [apps]);
  const enrolledCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of applications.values()) for (const id of Object.keys(a.items ?? {})) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  }, [applications]);

  const courses = useMemo(() => {
    const m = new Map(server.courses);
    for (const [id, d] of Object.entries(drafts.courses)) {
      if (d === null) m.delete(id);
      else m.set(id, { count: server.courses.get(id)?.count ?? 0, ...d });
    }
    return [...m.values()].sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start) || a.order - b.order);
  }, [server.courses, drafts.courses]);

  const teachers = useMemo(() => {
    const m = new Map(server.teachers);
    for (const [id, d] of Object.entries(drafts.teachers)) {
      if (d === null) m.delete(id);
      else m.set(id, { ...d, photoUrl: server.teachers.get(id)?.photoUrl ?? null });
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [server.teachers, drafts.teachers]);

  const students = useMemo(() => {
    const m = new Map(server.students);
    for (const [sid, d] of Object.entries(drafts.students)) {
      if (d === null) m.delete(sid);
      else
        m.set(sid, {
          sid,
          name: d.name,
          phone: d.phone,
          classNo: Number(sid.slice(1, 3)),
          number: Number(sid.slice(3, 5)),
          photoUrl: server.students.get(sid)?.photoUrl ?? null,
        });
    }
    return [...m.values()].sort((a, b) => a.sid.localeCompare(b.sid));
  }, [server.students, drafts.students]);

  const dirtyKeys = {
    courses: new Set(Object.keys(drafts.courses)),
    teachers: new Set(Object.keys(drafts.teachers)),
    students: new Set(Object.keys(drafts.students)),
    period: !!drafts.period,
    timetable: !!drafts.timetable,
  };
  const dirty = dirtyKeys.courses.size + dirtyKeys.teachers.size + dirtyKeys.students.size + (drafts.period ? 1 : 0) + (drafts.timetable ? 1 : 0);

  const setCourse = useCallback((c: CourseInput) => setDrafts((d) => ({ ...d, courses: { ...d.courses, [c.id]: c } })), []);
  const removeCourse = useCallback(
    (id: string) =>
      setDrafts((d) => {
        const next = { ...d.courses };
        // 아직 저장 안 한 새 강좌면 그냥 지운다
        if (!server.courses.has(id)) delete next[id];
        else next[id] = null;
        return { ...d, courses: next };
      }),
    [server.courses],
  );
  const setTeacher = useCallback((t: TeacherInput) => setDrafts((d) => ({ ...d, teachers: { ...d.teachers, [t.id]: t } })), []);
  const removeTeacher = useCallback(
    (id: string) =>
      setDrafts((d) => {
        const next = { ...d.teachers };
        if (!server.teachers.has(id)) delete next[id];
        else next[id] = null;
        // 그 교사를 담당으로 둔 강좌에서도 뺀다(화면에 바로 보이도록)
        const courses = { ...d.courses };
        for (const cid of new Set([...server.courses.keys(), ...Object.keys(courses)])) {
          const cur = cid in courses ? courses[cid] : toCourseInput(server.courses.get(cid)!);
          if (cur && cur.teacherIds.includes(id)) courses[cid] = { ...cur, teacherIds: cur.teacherIds.filter((x) => x !== id) };
        }
        return { ...d, teachers: next, courses };
      }),
    [server.teachers, server.courses],
  );
  const setStudents = useCallback(
    (list: StudentInput[]) => setDrafts((d) => ({ ...d, students: { ...d.students, ...Object.fromEntries(list.map((s) => [s.sid, s])) } })),
    [],
  );
  const removeStudent = useCallback(
    (sid: string) =>
      setDrafts((d) => {
        const next = { ...d.students };
        if (!server.students.has(sid)) delete next[sid];
        else next[sid] = null;
        return { ...d, students: next };
      }),
    [server.students],
  );

  const publish = useCallback(async () => {
    const split = <T,>(rec: Record<string, T | null>) => ({
      upsert: Object.values(rec).filter((v): v is T => v !== null),
      remove: Object.entries(rec)
        .filter(([, v]) => v === null)
        .map(([k]) => k),
    });
    const payload: PublishPayload = {
      ...(Object.keys(drafts.courses).length ? { courses: split(drafts.courses) } : {}),
      ...(Object.keys(drafts.teachers).length ? { teachers: split(drafts.teachers) } : {}),
      ...(Object.keys(drafts.students).length ? { students: split(drafts.students) } : {}),
      ...(drafts.period ? { period: drafts.period } : {}),
      ...(drafts.timetable ? { timetable: drafts.timetable } : {}),
    };
    const res = await call<PublishPayload, { summary: string[] }>('adminPublish', payload, { retries: 0, busyMessage: '저장하는 중 연결이 끊겼어요. 잠시 후 다시 눌러 주세요.' });
    setDrafts(EMPTY);
    return res.summary;
  }, [drafts]);

  const assign = useCallback(async (sid: string, add: string | null, remove: string | null) => {
    const r = await call<object, { warning: string | null }>('adminAssign', { sid, add, remove });
    return r.warning;
  }, []);

  const value: AdminValue = {
    loading,
    courses,
    teachers,
    students,
    period: drafts.period ?? serverPeriod ?? null,
    timetable: drafts.timetable ?? serverTimetable ?? { fixedEvents: [], dayNotes: [] },
    server,
    applications,
    enrolledCount,
    dirty,
    dirtyKeys,
    setCourse,
    removeCourse,
    setTeacher,
    removeTeacher,
    setStudents,
    removeStudent,
    setPeriod: (p) => setDrafts((d) => ({ ...d, period: p })),
    setTimetable: (t) => setDrafts((d) => ({ ...d, timetable: t })),
    discard: () => setDrafts(EMPTY),
    publish,
    assign,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdmin(): AdminValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('AdminDataProvider 밖');
  return v;
}

/** 서버 강좌 → 수정용 입력(신청 인원 count 제외) */
export function toCourseInput(c: Course): CourseInput {
  const { count: _count, ...rest } = c;
  return rest;
}

/** 강좌의 실제 신청 수(정원 없는 강좌 포함) */
export function enrolled(a: AdminValue, c: Course): number {
  return a.enrolledCount.get(c.id) ?? 0;
}
