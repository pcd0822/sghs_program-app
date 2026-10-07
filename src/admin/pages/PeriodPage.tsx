import { CalendarClock, CircleCheck, Lock, TriangleAlert } from 'lucide-react';
import { validatePeriod } from '@shared/admin';
import { periodState } from '@shared/rules';
import type { PeriodConfig } from '@shared/types';
import { formatDate, formatDateTime, fromKstInput, timeRange, toKstInput } from '@/lib/format';
import { Pill } from '@/ui/Pill';
import { toCourseInput, useAdmin } from '../AdminData';
import { Card, DirtyDot, Field, PageHead, SmallButton, TableWrap } from '../ui';

const MODES: { v: PeriodConfig['mode']; icon: typeof Lock; title: string; desc: string }[] = [
  { v: 'auto', icon: CalendarClock, title: '정한 시각대로', desc: '시작 일시에 열리고 마감 일시에 닫혀요' },
  { v: 'open', icon: CircleCheck, title: '지금 바로 열기', desc: '시각과 상관없이 열어 둬요' },
  { v: 'closed', icon: Lock, title: '지금 바로 닫기', desc: '시각과 상관없이 닫아 둬요' },
];

export default function PeriodPage() {
  const a = useAdmin();
  const p: PeriodConfig = a.period ?? { mode: 'closed', openAt: null, closeAt: null };
  const set = (patch: Partial<PeriodConfig>) => a.setPeriod({ ...p, ...patch });
  const err = validatePeriod(p);
  const state = periodState(p, Date.now());

  return (
    <div className="space-y-5">
      <PageHead icon={CalendarClock} tone="amber" title="신청 일정 관리" desc='바꾼 뒤 "저장 및 배포"를 눌러야 학생 화면에 반영돼요.' />

      <Card>
        <div className="flex items-center gap-2">
          <h2 className="text-[17px] font-extrabold">전체 신청 기간</h2>
          {a.dirtyKeys.period && <DirtyDot />}
          <span className="ml-auto">
            <Pill tone={state === 'open' ? 'green' : state === 'before' ? 'blue' : 'gray'}>
              {{ unset: '일정 미정', before: '열리기 전', open: '진행 중', closed: '마감' }[state]}
            </Pill>
          </span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3" role="radiogroup">
          {MODES.map((m) => (
            <button
              key={m.v}
              type="button"
              role="radio"
              aria-checked={p.mode === m.v}
              onClick={() => set({ mode: m.v })}
              className={`rounded-2xl p-3 text-left ring-1 transition ${p.mode === m.v ? 'bg-brand-50 ring-2 ring-brand-500' : 'ring-line hover:bg-soft'}`}
            >
              <span className="block text-[15px] font-bold">
                <m.icon size={16} className="mr-1 inline -mt-0.5 text-brand-600" aria-hidden />{m.title}
              </span>
              <span className="block text-[12px] text-sub">{m.desc}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="시작 일시(한국 시각)" type="datetime-local" value={toKstInput(p.openAt)} onChange={(e) => set({ openAt: fromKstInput(e.target.value) })} />
          <Field label="마감 일시(한국 시각)" type="datetime-local" value={toKstInput(p.closeAt)} onChange={(e) => set({ closeAt: fromKstInput(e.target.value) })} />
        </div>
        {err && <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-[14px] font-semibold text-rose-600"><TriangleAlert size={15} className="mr-1 inline -mt-0.5" aria-hidden />{err}</p>}
        {p.openAt && p.closeAt && !err && (
          <p className="mt-2 text-[13px] text-sub">
            학생 화면: {formatDateTime(p.openAt)}에 열리고 {formatDateTime(p.closeAt)}에 닫혀요{p.mode !== 'auto' ? ' (지금은 "바로 열기/닫기"가 우선이에요)' : ''}.
          </p>
        )}
      </Card>

      <Card>
        <h2 className="text-[17px] font-extrabold">강좌별 개별 마감</h2>
        <p className="mt-1 text-[13px] text-sub">비워 두면 전체 기간을 따라요. 정한 시각이 지나면 그 강좌만 신청·취소가 막혀요.</p>
        <div className="mt-3">
          <TableWrap>
            <thead>
              <tr>
                <th>날짜</th>
                <th>강좌</th>
                <th>시간</th>
                <th>개별 마감(한국 시각)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {a.courses.map((c) => (
                <tr key={c.id}>
                  <td className="whitespace-nowrap">{formatDate(c.date)}</td>
                  <td className="font-semibold">
                    {c.name} {a.dirtyKeys.courses.has(c.id) && <DirtyDot />}
                  </td>
                  <td className="whitespace-nowrap text-sub">{timeRange(c)}</td>
                  <td>
                    <input
                      type="datetime-local"
                      aria-label={`${c.name} 개별 마감`}
                      value={toKstInput(c.closeAt)}
                      onChange={(e) => a.setCourse({ ...toCourseInput(c), closeAt: fromKstInput(e.target.value) })}
                      className="h-10 rounded-xl border border-line bg-soft px-2 text-[14px]"
                    />
                  </td>
                  <td>
                    {c.closeAt !== null && (
                      <SmallButton onClick={() => a.setCourse({ ...toCourseInput(c), closeAt: null })}>지우기</SmallButton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </div>
      </Card>
    </div>
  );
}
