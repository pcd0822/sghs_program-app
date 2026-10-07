import { ClipboardCheck, ClipboardList, Phone, School } from 'lucide-react';
import { Eyebrow } from '@/ui/Glyph';
import { collection, query, where } from 'firebase/firestore';
import { useMemo, useState } from 'react';
import { OPERATING_DATES, TIME_ZONE } from '@shared/constants';
import { requirements, type Application } from '@shared/rules';
import type { Student } from '@shared/types';
import { useQueryDocs } from '@/data/live';
import { db } from '@/lib/firebase';
import { formatDate, formatDateTime } from '@/lib/format';
import { Pill } from '@/ui/Pill';
import { AttendCheck, Avatar, toAttendanceMap, useAttendanceToggle, type AttendanceDoc } from './attendance';
import { useTeacher } from './TeacherData';

const CLASSES = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function todayOrFirst(): string {
  const t = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date());
  return OPERATING_DATES.includes(t) ? t : OPERATING_DATES[0];
}

/** 학급출결 + 학급 신청 현황(탭). 담임은 자기 반, 담당학급 0 은 반을 골라서. */
export default function ClassPage() {
  const { homeroom } = useTeacher();
  const allClasses = homeroom === 0;
  const [classNo, setClassNo] = useState<number>(allClasses ? 1 : (homeroom ?? 1));
  const [tab, setTab] = useState<'att' | 'status'>('att');

  // 우리 반 학생·신청 내역·연락처를 한 번에 받아 두 탭이 함께 쓴다.
  const students = useQueryDocs<Student>(`stu-${classNo}`, () => query(collection(db, 'students'), where('classNo', '==', classNo)));
  const apps = useQueryDocs<Application>(`app-${classNo}`, () => query(collection(db, 'applications'), where('classNo', '==', classNo)));
  const secrets = useQueryDocs<{ phone: string }>(`sec-${classNo}`, () => query(collection(db, 'studentSecrets'), where('classNo', '==', classNo)));

  const sorted = useMemo(() => [...(students ?? [])].sort((a, b) => a.number - b.number), [students]);
  const appBySid = useMemo(() => new Map((apps ?? []).map((a) => [a.sid, a])), [apps]);
  const phoneBySid = useMemo(() => new Map((secrets ?? []).map((s) => [s._id, s.phone])), [secrets]);

  return (
    <main className="px-5 pt-[max(env(safe-area-inset-top),16px)]">
      <Eyebrow icon={School} tone="mint">학급출결</Eyebrow>
      <h1 className="text-[24px] font-extrabold tracking-tight">3학년 {classNo}반</h1>

      {allClasses && (
        <div className="-mx-5 mt-2 flex gap-1.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none]" role="tablist" aria-label="학급 선택">
          {CLASSES.map((n) => (
            <button
              key={n}
              type="button"
              role="tab"
              aria-selected={n === classNo}
              onClick={() => setClassNo(n)}
              className={`min-h-10 shrink-0 rounded-full px-4 text-[14px] font-bold ${n === classNo ? 'bg-ink text-white' : 'bg-soft text-sub'}`}
            >
              {n}반
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 rounded-full bg-soft p-1" role="tablist">
        {(
          [
            ['att', ClipboardCheck, '출결'],
            ['status', ClipboardList, '신청 현황'],
          ] as const
        ).map(([k, Icon, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`flex min-h-11 items-center justify-center gap-1.5 rounded-full text-[15px] font-bold transition ${tab === k ? 'bg-white shadow-sm' : 'text-sub'}`}
          >
            <Icon size={17} aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {!students ? (
        <div className="mt-4 space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-soft" />
          ))}
        </div>
      ) : tab === 'att' ? (
        <AttendanceTab classNo={classNo} students={sorted} appBySid={appBySid} phoneBySid={phoneBySid} />
      ) : (
        <StatusTab students={sorted} appBySid={appBySid} />
      )}
    </main>
  );
}

function AttendanceTab({
  classNo,
  students,
  appBySid,
  phoneBySid,
}: {
  classNo: number;
  students: Student[];
  appBySid: Map<string, Application>;
  phoneBySid: Map<string, string>;
}) {
  const [date, setDate] = useState(todayOrFirst);
  const att = useQueryDocs<AttendanceDoc>(`catt-${classNo}-${date}`, () =>
    query(collection(db, 'attendance'), where('date', '==', date), where('classNo', '==', classNo)),
  );
  const attMap = toAttendanceMap(att);
  const { pending, toggle } = useAttendanceToggle(date);
  const absent = students.filter((s) => attMap.get(s.sid)?.absent).length;

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-5 bg-white/90 px-5 pt-3 pb-2 backdrop-blur">
        <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 [scrollbar-width:none]" role="tablist" aria-label="날짜 선택">
          {OPERATING_DATES.map((d) => (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={d === date}
              onClick={() => setDate(d)}
              className={`min-h-10 shrink-0 rounded-full px-3.5 text-[14px] font-bold ${d === date ? 'bg-brand-600 text-white' : 'bg-soft text-sub'}`}
            >
              {formatDate(d)}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-2 text-[14px] font-bold">
          <span className="rounded-full bg-soft px-3 py-1">재적 {students.length}</span>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">출석 {students.length - absent}</span>
          <span className="rounded-full bg-rose-50 px-3 py-1 text-rose-600">결석 {absent}</span>
        </div>
      </div>

      <ul className="divide-y divide-line">
        {students.map((s) => {
          const todays = Object.values(appBySid.get(s.sid)?.items ?? {}).filter((it) => it.date === date);
          const phone = phoneBySid.get(s.sid);
          return (
            <li key={s.sid} className="flex items-center gap-3 py-2.5">
              <Avatar url={s.photoUrl} name={s.name} size={44} />
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-bold">
                  <span className="mr-1.5 text-[13px] font-semibold text-sub tabular-nums">{s.number}</span>
                  {s.name}
                </p>
                <p className="truncate text-[13px] text-sub">{todays.length ? todays.map((it) => it.name).join(' · ') : '신청 강좌 없음'}</p>
                {phone && (
                  <a href={`tel:${phone}`} className="inline-flex items-center gap-1 text-[12px] text-brand-600 tabular-nums">
                    <Phone size={12} aria-hidden /> {phone.replace(/^(\d{3})(\d{3,4})(\d{4})$/, '$1-$2-$3')}
                  </a>
                )}
              </div>
              <AttendCheck
                checked={!!attMap.get(s.sid)?.absent}
                pending={pending[s.sid]}
                onLabel="결석"
                offLabel="출석"
                meta={attMap.get(s.sid)}
                onChange={(v) => toggle(s.sid, v)}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** 학급 신청 현황: 날짜별 신청 강좌와 제출 여부. 미제출을 위로. */
function StatusTab({ students, appBySid }: { students: Student[]; appBySid: Map<string, Application> }) {
  const { courses } = useTeacher();
  const dates = useMemo(() => {
    if (!courses) return [];
    const r = requirements(courses);
    return [...new Set([...r.required.map((c) => c.date), ...r.selectiveDates])].sort();
  }, [courses]);

  const rows = [...students].sort((a, b) => {
    const sa = appBySid.get(a.sid)?.submitted ? 1 : 0;
    const sb = appBySid.get(b.sid)?.submitted ? 1 : 0;
    return sa - sb || a.number - b.number;
  });
  const submitted = students.filter((s) => appBySid.get(s.sid)?.submitted).length;

  return (
    <div className="mt-3">
      <div className="flex gap-2 text-[14px] font-bold">
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">제출 {submitted}</span>
        <span className="rounded-full bg-orange-50 px-3 py-1 text-orange-600">미제출 {students.length - submitted}</span>
      </div>
      <div className="-mx-5 mt-2 overflow-x-auto px-5">
        <table className="w-max min-w-full border-separate border-spacing-0 text-left text-[13px]">
          <thead>
            <tr className="text-[12px] text-sub">
              <th className="sticky left-0 z-[1] border-b border-line bg-white py-2 pr-3 font-semibold">번호·이름</th>
              <th className="border-b border-line px-2 py-2 font-semibold">제출</th>
              {dates.map((d) => (
                <th key={d} className="border-b border-line px-2 py-2 font-semibold whitespace-nowrap">
                  {formatDate(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const app = appBySid.get(s.sid);
              const items = Object.values(app?.items ?? {});
              return (
                <tr key={s.sid} className={app?.submitted ? '' : 'bg-orange-50/40'}>
                  <td className="sticky left-0 z-[1] border-b border-line bg-white py-2 pr-3 font-bold whitespace-nowrap">
                    <span className="mr-1 text-sub tabular-nums">{s.number}</span>
                    {s.name}
                  </td>
                  <td className="border-b border-line px-2 py-2 whitespace-nowrap">
                    {app?.submitted ? (
                      <Pill tone="green">제출</Pill>
                    ) : items.length ? (
                      <Pill tone="orange">미제출</Pill>
                    ) : (
                      <Pill tone="red">미신청</Pill>
                    )}
                    {app?.submittedAt && <div className="mt-0.5 text-[10px] text-sub">{formatDateTime(app.submittedAt)}</div>}
                  </td>
                  {dates.map((d) => {
                    const it = items.filter((x) => x.date === d);
                    return (
                      <td key={d} className="max-w-[140px] border-b border-line px-2 py-2 align-top">
                        {it.length ? it.map((x) => <div key={x.code} className="line-clamp-2">{x.name}</div>) : <span className="text-zinc-300">—</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
