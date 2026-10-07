import { Presentation, Users } from 'lucide-react';
// 교사 화면 전체가 함께 쓰는 자료: 강좌·교사 목록·시간표 설정과 강좌 상세(신청 버튼 없음).

import { collection, getDocs } from 'firebase/firestore';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Course, Teacher, TimetableConfig } from '@shared/types';
import { useSession } from '@/auth/AuthProvider';
import { CourseDetailSheet } from '@/courses/CourseParts';
import { useCourses, useTeacherDoc, useTeachers, useTimetable } from '@/data/live';
import { db } from '@/lib/firebase';

interface TeacherValue {
  tid: string;
  /** null: 담임 아님, 0: 전체 학급, 1~9 */
  homeroom: number | null;
  isAdmin: boolean;
  me: Teacher | null | undefined;
  courses: Course[] | undefined;
  /** 나에게 배정된 강좌 */
  myCourses: Course[];
  teachers: Map<string, Teacher>;
  timetable: TimetableConfig | null | undefined;
  openCourse(c: Course): void;
}

const Ctx = createContext<TeacherValue | null>(null);

export function TeacherDataProvider({ children }: { children: ReactNode }) {
  const { claims } = useSession();
  const t = claims.role === 'teacher' ? claims : null;
  const tid = t?.tid ?? '';
  const courses = useCourses();
  const teacherList = useTeachers(true);
  const timetable = useTimetable();
  const me = useTeacherDoc(tid);
  const [selected, setSelected] = useState<string | null>(null);

  const teachers = useMemo(() => new Map((teacherList ?? []).map((x) => [x.id, x])), [teacherList]);
  const myCourses = useMemo(() => (courses ?? []).filter((c) => c.teacherIds?.includes(tid)), [courses, tid]);
  const sel = selected ? (courses ?? []).find((c) => c.id === selected) ?? null : null;

  const value: TeacherValue = {
    tid,
    homeroom: t?.homeroom ?? null,
    isAdmin: t?.admin ?? false,
    me,
    courses,
    myCourses,
    teachers,
    timetable,
    openCourse: (c) => setSelected(c.id),
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      <CourseDetailSheet c={sel} onClose={() => setSelected(null)} notice={sel && <TeacherNotice c={sel} />} />
    </Ctx.Provider>
  );
}

export function useTeacher(): TeacherValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('TeacherDataProvider 밖');
  return v;
}

/** 상세 창 아래: 담당 교사, 정원 없는 강좌의 신청 인원 */
function TeacherNotice({ c }: { c: Course }) {
  const { teachers, tid } = useTeacher();
  const [unlimitedCount, setUnlimitedCount] = useState<number | null>(null);

  useEffect(() => {
    setUnlimitedCount(null);
    if (c.capacity !== null) return;
    // 정원 없는 강좌는 인원을 여러 칸(shard)에 나눠 세므로 열 때 한 번 합산한다.
    getDocs(collection(db, 'courses', c.id, 'shards'))
      .then((s) => setUnlimitedCount(s.docs.reduce((sum, d) => sum + Number(d.get('count') ?? 0), 0)))
      .catch(() => setUnlimitedCount(null));
  }, [c.id, c.capacity]);

  const names = (c.teacherIds ?? []).map((id) => teachers.get(id)?.name ?? '(알 수 없음)');
  return (
    <div className="mt-4 space-y-2">
      {c.capacity === null && unlimitedCount !== null && (
        <p className="flex items-center gap-2 rounded-2xl bg-soft px-4 py-3 text-[15px] font-semibold"><Users size={18} className="shrink-0 text-brand-600" aria-hidden /> 현재 신청 {unlimitedCount}명</p>
      )}
      <p className={`rounded-2xl px-4 py-3 text-[15px] font-semibold ${c.teacherIds?.includes(tid) ? 'bg-brand-50 text-brand-700' : 'bg-soft'}`}>
        <Presentation size={18} className="mr-1.5 inline -mt-0.5" aria-hidden />담당 교사: {names.length ? names.join(', ') : '아직 배정되지 않았어요'}
        {c.teacherIds?.includes(tid) && ' (나)'}
      </p>
    </div>
  );
}
