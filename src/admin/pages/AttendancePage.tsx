import { collection, getDocs, query, where } from 'firebase/firestore';
import { Check, ClipboardCheck, Download, Inbox, Minus, PartyPopper, X } from 'lucide-react';
import { classStatus as classStatusFrom, programMarkOf, programStatusOf, qrComplete, type AttendStatus, type QrRecord } from '@shared/attendance';
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
  st: AttendStatus;
  /** 교사가 직접 출석을 눌러 출석인지(아니면 QR 로 출석) */
  manual: boolean;
}

type Enr = QrRecord & { sid: string; date: string; courseId: string };

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
  // 그날 수강 기록(시작·종료 QR 찍은 시각). 수강신청자 명렬표(프로그램)는 QR 을 다 찍어야 출석.
  // 학급 명렬표·결석만 보기는 학급출결 기준(기본 미체크, 담임 출석 체크 또는 그날 QR 다 찍음 → 출석).
  const enr = useQueryDocs<Enr>(`admin-enr-${date}`, () => query(collection(db, 'enrollments'), where('date', '==', date)));
  const enrBySid = useMemo(() => {
    const m = new Map<string, Enr[]>();
    for (const e of enr ?? []) m.set(e.sid, [...(m.get(e.sid) ?? []), e]);
    return m;
  }, [enr]);
  const classStatus = (sid: string): AttendStatus => classStatusFrom(attMap.get(sid), enrBySid.get(sid) ?? []);
  const nameOf = new Map(a.students.map((s) => [s.sid, s.name]));
  const coursesOf = (sid: string, d: string) =>
    Object.values(a.applications.get(sid)?.items ?? {})
      .filter((it) => it.date === d)
      .map((it) => it.name)
      .join(', ');

  const dayCourses = useMemo(() => a.courses.filter((c) => c.date === date), [a.courses, date]);
  const course = dayCourses.find((c) => c.id === courseId) ?? dayCourses[0] ?? null;

  // 지금 보는 명렬표의 줄
  // 학급 명렬표 전체 줄(결석만 보기도 통계는 반 전체로 센다)
  const classRows: Row[] =
    view === 'course'
      ? []
      : a.students
          .filter((s) => cls === 'all' || s.classNo === cls)
          .map((s) => ({ sid: s.sid, name: s.name, courses: coursesOf(s.sid, date), att: attMap.get(s.sid), st: classStatus(s.sid), manual: !!attMap.get(s.sid)?.present }));
  const rows: Row[] = (() => {
    if (view === 'absent') return classRows.filter((r) => r.st === 'absent').sort((x, y) => x.sid.localeCompare(y.sid));
    if (view === 'class') return classRows;
    if (!course) return [];
    return [...a.applications.values()]
      .filter((app) => app.items?.[course.id])
      .sort((x, y) => x.sid.localeCompare(y.sid))
      .map((app) => {
        // 수강신청자 명렬표는 이 강좌 QR 기준
        const e = (enrBySid.get(app.sid) ?? []).filter((x) => x.courseId === course.id);
        const mark = programMarkOf(attMap.get(app.sid), course.teacherIds);
        const st = programStatusOf(mark, !!enr && e.length > 0 && e.every(qrComplete));
        return { sid: app.sid, name: nameOf.get(app.sid) ?? app.name, courses: course.name, att: attMap.get(app.sid), st, manual: mark === 'present' };
      });
  })();

  const pool = view === 'course' ? rows : classRows;
  const count = (st: AttendStatus) => pool.filter((r) => r.st === st).length;
  const [absentCount, qrCount, noneCount, presentCount, total] = [count('absent'), count('qr'), count('none'), count('present'), pool.length];

  async function exportAll() {
    setBusy(true);
    try {
      // 운영 날짜 × 학생 전부. 기록이 없어도 QR 기준 상태를 적는다.
      const [attSnap, enrSnap] = await Promise.all([getDocs(collection(db, 'attendance')), getDocs(collection(db, 'enrollments'))]);
      const attById = new Map(attSnap.docs.map((d) => [d.id, d.data() as AttendanceDoc]));
      const enrById = new Map<string, Enr[]>();
      for (const d of enrSnap.docs) {
        const e = d.data() as Enr;
        const k = `${e.date}__${e.sid}`;
        enrById.set(k, [...(enrById.get(k) ?? []), e]);
      }
      const out: Cell[][] = [['날짜', '학번', '반', '이름', '그날 강좌', '학급출결', '프로그램 QR', '마지막 변경', '변경 시각']];
      const studs = [...a.students].sort((x, y) => x.sid.localeCompare(y.sid));
      for (const d of OPERATING_DATES) {
        for (const s of studs) {
          const k = `${d}__${s.sid}`;
          const x = attById.get(k);
          const es = enrById.get(k) ?? [];
          const qr = es.length ? (es.every(qrComplete) ? '완료' : '미완료') : '';
          const cs = classStatusFrom(x, es);
          const classText = cs === 'absent' ? '결석(결과)' : cs === 'present' ? (x?.present ? '출석' : '출석(QR)') : '미체크';
          out.push([formatDate(d), s.sid, s.classNo, s.name, coursesOf(s.sid, d), classText, qr, x?.updatedByName ?? '', x ? formatDateTime(x.updatedAt) : '']);
        }
      }
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
        desc="담임의 결석 체크와 교과 교사의 결과 체크는 같은 기록이에요. 처음엔 모두 미체크이고, 학급 명렬표는 담임이 출석을 눌렀거나 그날 프로그램 QR을 다 찍으면 출석, 수강신청자 명렬표(프로그램)는 그 강좌 시작·종료 QR을 둘 다 찍었거나 담당 선생님이 출석 인정해야 출석이에요."
        actions={
          <SmallButton onClick={exportAll} disabled={busy}>
            <Download size={16} aria-hidden />
            {busy ? '만드는 중…' : '전체 출결 xlsx'}
          </SmallButton>
        }
      />

      <div className="glass grid grid-cols-3 rounded-full p-1 lg:max-w-xl" role="tablist" aria-label="보기 방식">
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
            className={`min-h-9 shrink-0 rounded-full px-3 text-[13px] font-bold ${d === date ? 'bg-brand-600 text-white' : 'bg-white/60 text-sub ring-1 ring-white/80 hover:bg-white/85'}`}
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:max-w-2xl">
        <Stat label={view === 'course' ? '신청자' : '재적'} value={total} />
        <Stat label="출석" value={presentCount} tone="green" />
        {view === 'course' ? <Stat label="QR 미완료" value={qrCount} tone={qrCount ? 'orange' : 'default'} /> : <Stat label="미체크" value={noneCount} />}
        <Stat label="결석·결과" value={absentCount} tone={absentCount ? 'red' : 'default'} />
      </div>

      <Card>
        {!att || !enr ? (
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
                <tr key={r.sid} className={r.st === 'absent' ? 'bg-rose-50/50' : r.st === 'qr' ? 'bg-amber-50/50' : ''}>
                  <td className="tabular-nums">{r.sid}</td>
                  <td className="font-bold">{r.name}</td>
                  <td>
                    <StatusMark st={r.st} manual={r.manual} />
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

/** 읽기 전용 상태 표시: 출석 · QR 미완료 · 결석·결과 */
function StatusMark({ st, manual }: { st: AttendStatus; manual: boolean }) {
  const look = {
    absent: ['bg-rose-50 text-rose-600 ring-rose-200', 'bg-rose-500', X, '결석·결과'],
    qr: ['bg-amber-50 text-amber-700 ring-amber-200', 'bg-amber-500', Minus, 'QR 미완료'],
    none: ['bg-white/60 text-zinc-500 ring-line', 'bg-zinc-300', Minus, '미체크'],
    present: ['bg-white text-emerald-700 ring-line', 'bg-emerald-500', Check, manual ? '출석(체크)' : '출석(QR)'],
  } as const;
  const [box, dot, Icon, label] = look[st];
  return (
    <span className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-bold ring-1 ${box}`}>
      <span className={`grid size-[18px] place-items-center rounded-md text-white ${dot}`} aria-hidden>
        <Icon size={13} strokeWidth={3} />
      </span>
      {label}
    </span>
  );
}
