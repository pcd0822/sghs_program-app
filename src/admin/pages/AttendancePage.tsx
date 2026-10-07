import { collection, getDocs, query, where } from 'firebase/firestore';
import { Check, ClipboardCheck, Download, Inbox, PartyPopper, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { OPERATING_DATES, TIME_ZONE } from '@shared/constants';
import { useQueryDocs } from '@/data/live';
import { db } from '@/lib/firebase';
import { formatDate, formatDateTime, timeRange } from '@/lib/format';
import { downloadXlsx, stamp, type Cell } from '@/lib/xlsx';
import { useToast } from '@/ui/Toast';
import { toAttendanceMap, type AttendanceDoc } from '@/teacher/attendance';
import { useAdmin } from '../AdminData';
import { Card, Empty, PageHead, PillSelect, SmallButton, Stat, TableWrap } from '../ui';

function todayOrFirst(): string {
  const t = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date());
  return OPERATING_DATES.includes(t) ? t : OPERATING_DATES[0];
}

type View = 'absent' | 'class' | 'course';
const VIEWS: [View, string][] = [
  ['absent', '결석·결과만'],
  ['class', '학급 명렬표'],
  ['course', '수강신청자 명렬표'],
];

interface Row {
  sid: string;
  name: string;
  courses: string;
  att?: AttendanceDoc;
}

export default function AttendancePage() {
  const a = useAdmin();
  const toast = useToast();
  const [date, setDate] = useState(todayOrFirst);
  const [view, setView] = useState<View>('class');
  const [cls, setCls] = useState<number | 'all'>(1);
  const [courseId, setCourseId] = useState('');
  const [busy, setBusy] = useState(false);
  const att = useQueryDocs<AttendanceDoc>(`admin-att-${date}`, () => query(collection(db, 'attendance'), where('date', '==', date)));
  const attMap = useMemo(() => toAttendanceMap(att), [att]);
  const nameOf = new Map(a.students.map((s) => [s.sid, s.name]));
  const coursesOf = (sid: string, d: string) =>
    Object.values(a.applications.get(sid)?.items ?? {})
      .filter((it) => it.date === d)
      .map((it) => it.name)
      .join(', ');

  const dayCourses = useMemo(() => a.courses.filter((c) => c.date === date), [a.courses, date]);
  const course = dayCourses.find((c) => c.id === courseId) ?? dayCourses[0] ?? null;

  // 지금 보는 명렬표의 줄
  const rows: Row[] = (() => {
    const inClass = (classNo: number) => cls === 'all' || classNo === cls;
    if (view === 'absent') {
      return (att ?? [])
        .filter((x) => x.absent && inClass(x.classNo))
        .sort((x, y) => x.sid.localeCompare(y.sid))
        .map((x) => ({ sid: x.sid, name: nameOf.get(x.sid) ?? '', courses: coursesOf(x.sid, date), att: x }));
    }
    if (view === 'class') {
      return a.students
        .filter((s) => inClass(s.classNo))
        .map((s) => ({ sid: s.sid, name: s.name, courses: coursesOf(s.sid, date), att: attMap.get(s.sid) }));
    }
    if (!course) return [];
    return [...a.applications.values()]
      .filter((app) => app.items?.[course.id])
      .sort((x, y) => x.sid.localeCompare(y.sid))
      .map((app) => ({ sid: app.sid, name: nameOf.get(app.sid) ?? app.name, courses: course.name, att: attMap.get(app.sid) }));
  })();

  const absentCount = view === 'absent' ? rows.length : rows.filter((r) => r.att?.absent).length;
  const total = view === 'course' ? rows.length : a.students.filter((s) => cls === 'all' || s.classNo === cls).length;

  async function exportAll() {
    setBusy(true);
    try {
      const snap = await getDocs(collection(db, 'attendance'));
      const out: Cell[][] = [['날짜', '학번', '반', '이름', '그날 강좌', '상태', '마지막 변경', '변경 시각']];
      snap.docs
        .map((d) => d.data() as AttendanceDoc)
        .sort((x, y) => x.date.localeCompare(y.date) || x.sid.localeCompare(y.sid))
        .forEach((x) => out.push([formatDate(x.date), x.sid, x.classNo, nameOf.get(x.sid) ?? '', coursesOf(x.sid, x.date), x.absent ? '결석(결과)' : '출석', x.updatedByName, formatDateTime(x.updatedAt)]));
      await downloadXlsx(`출결기록_${stamp()}.xlsx`, [{ name: '출결 기록', rows: out }]);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHead
        icon={ClipboardCheck}
        tone="mint"
        title="출결 조회"
        desc="담임의 결석 체크와 교과 교사의 결과 체크는 같은 기록이에요. 기록이 없으면 출석이에요."
        actions={
          <SmallButton onClick={exportAll} disabled={busy}>
            <Download size={16} aria-hidden />
            {busy ? '만드는 중…' : '전체 출결 xlsx'}
          </SmallButton>
        }
      />

      <div className="grid grid-cols-3 rounded-full bg-white p-1 ring-1 ring-line lg:max-w-xl" role="tablist" aria-label="보기 방식">
        {VIEWS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={view === k}
            onClick={() => setView(k)}
            className={`min-h-10 rounded-full px-2 text-[13px] font-bold transition sm:text-[14px] ${view === k ? 'bg-ink text-white' : 'text-sub hover:text-ink'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0">
        {OPERATING_DATES.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDate(d)}
            className={`min-h-9 shrink-0 rounded-full px-3 text-[13px] font-bold ${d === date ? 'bg-brand-600 text-white' : 'bg-white text-sub ring-1 ring-line'}`}
          >
            {formatDate(d)}
          </button>
        ))}
      </div>

      {view === 'course' ? (
        dayCourses.length > 0 && (
          <PillSelect value={course?.id ?? ''} onChange={(e) => setCourseId(e.target.value)} className="w-full sm:w-[420px]" aria-label="강좌 선택">
            {dayCourses.map((c) => (
              <option key={c.id} value={c.id}>
                {timeRange(c)} {c.name} ({a.enrolledCount.get(c.id) ?? 0}명)
              </option>
            ))}
          </PillSelect>
        )
      ) : (
        <PillSelect value={cls} onChange={(e) => setCls(e.target.value === 'all' ? 'all' : Number(e.target.value))} className="w-36" aria-label="학급 선택">
          <option value="all">전체 반</option>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <option key={n} value={n}>
              {n}반
            </option>
          ))}
        </PillSelect>
      )}

      <div className="grid grid-cols-3 gap-3 lg:max-w-xl">
        <Stat label={view === 'course' ? '신청자' : '재적'} value={total} />
        <Stat label="출석" value={total - absentCount} tone="green" />
        <Stat label="결석·결과" value={absentCount} tone={absentCount ? 'red' : 'default'} />
      </div>

      <Card>
        {!att ? (
          <div className="h-40 animate-pulse rounded-2xl bg-soft" />
        ) : view === 'course' && !course ? (
          <Empty icon={Inbox} tone="slate" text={`${formatDate(date)}에 열리는 강좌가 없어요`} />
        ) : rows.length === 0 ? (
          view === 'absent' ? (
            <Empty icon={PartyPopper} tone="mint" text={`${formatDate(date)} 결석·결과 기록이 없어요`} />
          ) : (
            <Empty icon={Inbox} tone="slate" text={view === 'course' ? '이 강좌를 신청한 학생이 없어요' : '학생이 없어요'} />
          )
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th>학번</th>
                <th>이름</th>
                <th>출결 체크</th>
                {view !== 'course' && <th>그날 강좌</th>}
                <th>마지막 변경</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.sid} className={r.att?.absent ? 'bg-rose-50/50' : ''}>
                  <td className="tabular-nums">{r.sid}</td>
                  <td className="font-bold">{r.name}</td>
                  <td>
                    <AttendMark absent={!!r.att?.absent} />
                  </td>
                  {view !== 'course' && <td className="text-[13px]">{r.courses || <span className="text-zinc-300">—</span>}</td>}
                  <td className="text-[13px] whitespace-nowrap text-sub">{r.att?.updatedByName ? `${r.att.updatedByName} · ${formatDateTime(r.att.updatedAt)}` : <span className="text-zinc-300">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}

/** 읽기 전용 체크 표시: 교사 화면의 체크 칸과 같은 모양 */
function AttendMark({ absent }: { absent: boolean }) {
  return (
    <span
      className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-bold ring-1 ${absent ? 'bg-rose-50 text-rose-600 ring-rose-200' : 'bg-white text-emerald-700 ring-line'}`}
    >
      <span className={`grid size-[18px] place-items-center rounded-md ${absent ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'}`} aria-hidden>
        {absent ? <X size={13} strokeWidth={3} /> : <Check size={13} strokeWidth={3} />}
      </span>
      {absent ? '결석·결과' : '출석'}
    </span>
  );
}
