import { collection, getDocs, query, where } from 'firebase/firestore';
import { useState } from 'react';
import { OPERATING_DATES, TIME_ZONE } from '@shared/constants';
import { useQueryDocs } from '@/data/live';
import { db } from '@/lib/firebase';
import { formatDate, formatDateTime } from '@/lib/format';
import { downloadXlsx, stamp, type Cell } from '@/lib/xlsx';
import { Pill } from '@/ui/Pill';
import { useToast } from '@/ui/Toast';
import type { AttendanceDoc } from '@/teacher/attendance';
import { useAdmin } from '../AdminData';
import { Card, Empty, PageHead, SmallButton, Stat, TableWrap } from '../ui';

function todayOrFirst(): string {
  const t = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date());
  return OPERATING_DATES.includes(t) ? t : OPERATING_DATES[0];
}

export default function AttendancePage() {
  const a = useAdmin();
  const toast = useToast();
  const [date, setDate] = useState(todayOrFirst);
  const [cls, setCls] = useState<number | 'all'>('all');
  const [busy, setBusy] = useState(false);
  const att = useQueryDocs<AttendanceDoc>(`admin-att-${date}`, () => query(collection(db, 'attendance'), where('date', '==', date)));
  const nameOf = new Map(a.students.map((s) => [s.sid, s.name]));
  const coursesOf = (sid: string, d: string) =>
    Object.values(a.applications.get(sid)?.items ?? {})
      .filter((it) => it.date === d)
      .map((it) => it.name)
      .join(', ');

  const absent = (att ?? []).filter((x) => x.absent && (cls === 'all' || x.classNo === cls)).sort((x, y) => x.sid.localeCompare(y.sid));
  const totalInClass = a.students.filter((s) => cls === 'all' || s.classNo === cls).length;

  async function exportAll() {
    setBusy(true);
    try {
      const snap = await getDocs(collection(db, 'attendance'));
      const rows: Cell[][] = [['날짜', '학번', '반', '이름', '그날 강좌', '상태', '마지막 변경', '변경 시각']];
      snap.docs
        .map((d) => d.data() as AttendanceDoc)
        .sort((x, y) => x.date.localeCompare(y.date) || x.sid.localeCompare(y.sid))
        .forEach((x) => rows.push([formatDate(x.date), x.sid, x.classNo, nameOf.get(x.sid) ?? '', coursesOf(x.sid, x.date), x.absent ? '결석(결과)' : '출석', x.updatedByName, formatDateTime(x.updatedAt)]));
      await downloadXlsx(`출결기록_${stamp()}.xlsx`, [{ name: '출결 기록', rows }]);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHead
        emoji="✅"
        title="출결 조회"
        desc="담임의 결석 체크와 교과 교사의 결과 체크는 같은 기록이에요. 기록이 없으면 출석이에요."
        actions={
          <SmallButton onClick={exportAll} disabled={busy}>
            {busy ? '만드는 중…' : '⬇️ 전체 출결 xlsx'}
          </SmallButton>
        }
      />
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
      <select value={cls} onChange={(e) => setCls(e.target.value === 'all' ? 'all' : Number(e.target.value))} className="h-10 rounded-full border border-line bg-white px-3 text-[14px]">
        <option value="all">전체 반</option>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <option key={n} value={n}>
            {n}반
          </option>
        ))}
      </select>
      <div className="grid grid-cols-2 gap-3 lg:max-w-md">
        <Stat label="재적" value={totalInClass} />
        <Stat label="결석·결과" value={absent.length} tone={absent.length ? 'red' : 'default'} />
      </div>
      <Card>
        {!att ? (
          <div className="h-40 animate-pulse rounded-2xl bg-soft" />
        ) : absent.length === 0 ? (
          <Empty emoji="🎉" text={`${formatDate(date)} 결석·결과 기록이 없어요`} />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th>학번</th>
                <th>이름</th>
                <th>그날 강좌</th>
                <th>상태</th>
                <th>마지막 변경</th>
              </tr>
            </thead>
            <tbody>
              {absent.map((x) => (
                <tr key={x.sid}>
                  <td className="tabular-nums">{x.sid}</td>
                  <td className="font-bold">{nameOf.get(x.sid) ?? ''}</td>
                  <td className="text-[13px]">{coursesOf(x.sid, x.date) || <span className="text-zinc-300">—</span>}</td>
                  <td>
                    <Pill tone="red">결석·결과</Pill>
                  </td>
                  <td className="text-[13px] text-sub whitespace-nowrap">
                    {x.updatedByName} · {formatDateTime(x.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
