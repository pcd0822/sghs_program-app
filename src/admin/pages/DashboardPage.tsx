import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { periodState, progress, requirements } from '@shared/rules';
import type { Course } from '@shared/types';
import { call } from '@/lib/call';
import { formatDate, formatDateTime, timeRange } from '@/lib/format';
import { Pill } from '@/ui/Pill';
import { useToast } from '@/ui/Toast';
import { enrolled, useAdmin } from '../AdminData';
import { Card, PageHead, SmallButton, Stat } from '../ui';

export default function DashboardPage() {
  const a = useAdmin();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const now = Date.now();

  const stats = useMemo(() => {
    let submitted = 0;
    let started = 0;
    let none = 0;
    for (const s of a.students) {
      const app = a.applications.get(s.sid);
      if (app?.submitted) submitted++;
      else if (app && Object.keys(app.items ?? {}).length) started++;
      else none++;
    }
    return { submitted, started, none, total: a.students.length };
  }, [a.students, a.applications]);

  const req = useMemo(() => requirements(a.courses), [a.courses]);
  const dates = useMemo(() => [...new Set([...req.required.map((c) => c.date), ...req.selectiveDates])].sort(), [req]);

  /** 날짜별: 그날 신청을 마친 학생 수 */
  const doneByDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const app of a.applications.values()) {
      const p = progress(a.courses, app.items ?? {});
      for (const d of dates) if (!p.missing.some((x) => x.date === d)) m.set(d, (m.get(d) ?? 0) + 1);
    }
    return m;
  }, [a.applications, a.courses, dates]);

  const underFixed = a.courses.filter((c) => c.fixedSize && c.capacity !== null && enrolled(a, c) < c.capacity);
  const over = a.courses.filter((c) => c.capacity !== null && enrolled(a, c) > c.capacity);
  const state = periodState(a.period, now);
  const stateText = { unset: '일정 미정', before: '열리기 전', open: '신청 진행 중', closed: '마감' }[state];

  async function recount() {
    setBusy(true);
    try {
      const r = await call<object, { fixed: string[] }>('adminRecount', {});
      toast(r.fixed.length ? `인원 수를 고쳤어요: ${r.fixed.join(', ')}` : '인원 수가 모두 맞아요', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHead
        emoji="📊"
        title="현황판"
        desc={`신청 상태: ${stateText}${a.period?.closeAt && a.period.mode === 'auto' ? ` · ${formatDateTime(a.period.closeAt)} 마감` : ''}`}
        actions={
          <SmallButton onClick={recount} disabled={busy}>
            {busy ? '점검 중…' : '🔢 인원 수 점검'}
          </SmallButton>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="전체 학생" value={stats.total} />
        <Stat label="✅ 제출" value={stats.submitted} tone="green" sub={`${stats.total ? Math.round((stats.submitted / stats.total) * 100) : 0}%`} />
        <Stat label="🧩 신청 중(미제출)" value={stats.started} tone="orange" />
        <Stat label="😶 아직 미신청" value={stats.none} tone="red" />
      </div>

      {(underFixed.length > 0 || over.length > 0) && (
        <Card className="ring-2 ring-orange-300">
          <h2 className="text-[17px] font-extrabold">⚠️ 확인이 필요한 강좌</h2>
          <ul className="mt-2 space-y-1.5">
            {over.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-rose-50 px-3 py-2 text-[14px]">
                <Pill tone="red">정원 초과</Pill>
                <b>{c.name}</b>
                <span className="text-sub">{formatDate(c.date)}</span>
                <span className="ml-auto font-bold text-rose-600 tabular-nums">
                  {enrolled(a, c)}/{c.capacity}
                </span>
              </li>
            ))}
            {underFixed.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-orange-50 px-3 py-2 text-[14px]">
                <Pill tone="orange">인원고정 미달</Pill>
                <b>{c.name}</b>
                <span className="text-sub">{formatDate(c.date)}</span>
                <span className="ml-auto font-bold text-orange-700 tabular-nums">
                  {enrolled(a, c)}/{c.capacity} ({(c.capacity ?? 0) - enrolled(a, c)}명 부족)
                </span>
              </li>
            ))}
          </ul>
          <Link to="/admin/enrollments" className="mt-2 inline-block text-[14px] font-semibold text-brand-600">
            수강신청 내역에서 수동 배정하기 ›
          </Link>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {dates.map((d) => {
          const list = a.courses.filter((c) => c.date === d);
          const done = doneByDate.get(d) ?? 0;
          return (
            <Card key={d}>
              <div className="flex items-center gap-2">
                <h2 className="text-[17px] font-extrabold">{formatDate(d)}</h2>
                {list.every((c) => c.category === '필수') ? <Pill tone="purple">필수</Pill> : <Pill tone="blue">선택</Pill>}
                <span className="ml-auto text-[13px] font-semibold text-sub">
                  신청 완료 {done}/{stats.total}명
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-soft">
                <div className="h-full rounded-full bg-brand-500" style={{ width: `${stats.total ? (done / stats.total) * 100 : 0}%` }} />
              </div>
              <ul className="mt-3 space-y-2">
                {list.map((c) => (
                  <CourseBar key={c.id} c={c} n={enrolled(a, c)} />
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function CourseBar({ c, n }: { c: Course; n: number }) {
  const cap = c.capacity;
  const pct = cap ? Math.min(100, (n / cap) * 100) : 100;
  const overCap = cap !== null && n > cap;
  const under = c.fixedSize && cap !== null && n < cap;
  return (
    <li>
      <div className="flex items-center gap-2 text-[14px]">
        <span className="min-w-0 flex-1 truncate font-semibold">{c.name}</span>
        {c.fixedSize && <Pill tone={under ? 'orange' : 'gray'}>인원고정</Pill>}
        <span className={`shrink-0 font-bold tabular-nums ${overCap ? 'text-rose-600' : under ? 'text-orange-600' : ''}`}>
          {n}
          {cap !== null ? `/${cap}` : '명'}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-soft" title={timeRange(c)}>
        <div className={`h-full rounded-full ${overCap ? 'bg-rose-500' : cap === null ? 'bg-brand-300' : n >= cap ? 'bg-zinc-400' : 'bg-emerald-400'}`} style={{ width: `${pct}%` }} />
      </div>
    </li>
  );
}
