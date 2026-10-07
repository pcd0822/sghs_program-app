import { ClipboardList, Download, Puzzle, Trash2, Wrench } from 'lucide-react';
import { useMemo, useState } from 'react';
import { checkPersonalRules, progress, requirements, type Application } from '@shared/rules';
import { formatDate, formatDateTime, timeRange } from '@/lib/format';
import { downloadXlsx, stamp, type Cell } from '@/lib/xlsx';
import { Button } from '@/ui/Button';
import { Modal } from '@/ui/Modal';
import { Pill } from '@/ui/Pill';
import { Sheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { enrolled, useAdmin, type StudentRow } from '../AdminData';
import { Card, PageHead, SmallButton, TableWrap, SearchBox } from '../ui';

type Filter = 'all' | 'unsubmitted' | 'none';

export default function EnrollmentsPage() {
  const a = useAdmin();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sel, setSel] = useState<string | null>(null);

  const req = useMemo(() => requirements(a.courses), [a.courses]);
  const dates = useMemo(() => [...new Set([...req.required.map((c) => c.date), ...req.selectiveDates])].sort(), [req]);

  const rows = a.students.filter((s) => {
    const app = a.applications.get(s.sid);
    const has = !!app && Object.keys(app.items ?? {}).length > 0;
    if (filter === 'unsubmitted' && (app?.submitted || !has)) return false;
    if (filter === 'none' && has) return false;
    const t = q.trim();
    return !t || s.sid.includes(t) || s.name.includes(t);
  });

  async function exportXlsx() {
    const head: Cell[] = ['학번', '반', '번호', '이름', '제출', '제출 시각', ...dates.map(formatDate)];
    const sheet1: Cell[][] = [head];
    for (const s of a.students) {
      const app = a.applications.get(s.sid);
      const items = Object.values(app?.items ?? {});
      sheet1.push([
        s.sid,
        s.classNo,
        s.number,
        s.name,
        app?.submitted ? '제출' : items.length ? '미제출' : '미신청',
        app?.submittedAt ? formatDateTime(app.submittedAt) : '',
        ...dates.map((d) => items.filter((it) => it.date === d).map((it) => it.name).join(', ')),
      ]);
    }
    const sheet2: Cell[][] = [['날짜', '시간', '강좌ID', '코드', '강좌', '장소', '학번', '이름', '배정']];
    const byCourse: Cell[][] = [['날짜', '분류', '코드', '강좌', '장소', '신청', '정원', '인원고정', '자부담']];
    for (const c of a.courses) {
      byCourse.push([formatDate(c.date), c.category, c.code, c.name, c.place, enrolled(a, c), c.capacity ?? '제한 없음', c.fixedSize ? 'O' : '', c.selfPay ? 'O' : '']);
      for (const app of a.applications.values()) {
        const it = app.items?.[c.id];
        if (it) sheet2.push([formatDate(c.date), timeRange(c), c.id, c.code, c.name, c.place, app.sid, app.name, it.by === 'admin' ? '관리자' : '학생']);
      }
    }
    await downloadXlsx(`수강신청내역_${stamp()}.xlsx`, [
      { name: '학생별 신청', rows: sheet1 },
      { name: '강좌별 명단', rows: sheet2 },
      { name: '강좌별 인원', rows: byCourse },
    ]);
  }

  const student = sel ? a.students.find((s) => s.sid === sel) ?? null : null;

  return (
    <div className="space-y-4">
      <PageHead icon={ClipboardList} tone="sky" title="수강신청 내역" desc="학생을 고르면 신청을 추가·변경·삭제할 수 있어요(누르는 즉시 반영)." actions={<SmallButton onClick={exportXlsx}><Download size={16} aria-hidden /> xlsx 내려받기</SmallButton>} />

      <div className="flex flex-wrap items-center gap-2">
        <SearchBox placeholder="학번 또는 이름" value={q} onChange={(e) => setQ(e.target.value)} />
        {(
          [
            ['all', '전체'],
            ['unsubmitted', '미제출만'],
            ['none', '미신청만'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={`min-h-9 rounded-full px-3 text-[13px] font-bold ${filter === k ? 'bg-ink text-white' : 'bg-white text-sub ring-1 ring-line'}`}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto text-[13px] text-sub">{rows.length}명</span>
      </div>

      <Card>
        <TableWrap>
          <thead>
            <tr>
              <th>학번</th>
              <th>이름</th>
              <th>상태</th>
              {dates.map((d) => (
                <th key={d}>{formatDate(d)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const app = a.applications.get(s.sid);
              const items = Object.values(app?.items ?? {});
              return (
                <tr key={s.sid} onClick={() => setSel(s.sid)} className="cursor-pointer hover:bg-soft">
                  <td className="tabular-nums">{s.sid}</td>
                  <td className="font-bold whitespace-nowrap">{s.name}</td>
                  <td>{app?.submitted ? <Pill tone="green">제출</Pill> : items.length ? <Pill tone="orange">미제출</Pill> : <Pill tone="red">미신청</Pill>}</td>
                  {dates.map((d) => {
                    const its = items.filter((it) => it.date === d);
                    return (
                      <td key={d} className="max-w-[150px] text-[13px]">
                        {its.length ? its.map((it) => <div key={it.code} className="truncate">{it.by === 'admin' && <Wrench size={12} className="mr-1 inline text-brand-600" aria-label="관리자 배정" />}{it.name}</div>) : <span className="text-zinc-300">—</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      </Card>

      {student && <StudentPanel s={student} app={a.applications.get(student.sid)} dates={dates} onClose={() => setSel(null)} />}
    </div>
  );
}

/** 학생 한 명의 신청: 날짜별로 추가·변경·삭제 */
function StudentPanel({ s, app, dates, onClose }: { s: StudentRow; app: Application | undefined; dates: string[]; onClose(): void }) {
  const a = useAdmin();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState<{ date: string; replace: string | null } | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const items = app?.items ?? {};
  const p = progress(a.courses, items);
  const byId = new Map(a.courses.map((c) => [c.id, c]));

  async function run(add: string | null, remove: string | null, okText: string) {
    setBusy(true);
    try {
      const warning = await a.assign(s.sid, add, remove);
      toast(warning ? `${okText} · 주의: ${warning}` : okText, warning ? 'info' : 'success');
      setPicking(null);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Sheet open onClose={onClose} title={`${s.sid} ${s.name}`}>
        <div className="mb-3 flex flex-wrap gap-1.5">
          <Pill tone="purple">
            필수 {p.requiredDone}/{p.requiredTotal}
          </Pill>
          <Pill tone="blue">
            선택 {p.selectiveDone}/{p.selectiveTotal}
          </Pill>
          <Pill tone={app?.submitted ? 'green' : 'gray'}>{app?.submitted ? '제출' : '미제출'}</Pill>
        </div>
        <p className="mb-3 rounded-2xl bg-soft px-3 py-2 text-[13px] text-sub">
          수동 배정은 마감 후에도 할 수 있고 정원을 넘길 수 있어요(경고만 표시). 같은 코드 중복·같은 날 선택 2개는 막혀요.
        </p>
        <ul className="space-y-3 pb-4">
          {dates.map((d) => {
            const mine = Object.entries(items).filter(([, it]) => it.date === d);
            const missing = p.missing.filter((m) => m.date === d);
            return (
              <li key={d} className="rounded-2xl p-3 ring-1 ring-line">
                <p className="text-[15px] font-extrabold">{formatDate(d)}</p>
                {mine.map(([id, it]) => (
                  <div key={id} className="mt-2 flex items-center gap-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">
                        {it.by === 'admin' && <Wrench size={13} className="mr-1 inline text-brand-600" aria-label="관리자 배정" />}
                        {it.name}
                      </span>
                      <span className="text-[12px] text-sub">
                        {it.category} · {byId.get(id) ? timeRange(byId.get(id)!) : ''}
                      </span>
                    </span>
                    <SmallButton disabled={busy} onClick={() => setPicking({ date: d, replace: id })}>
                      변경
                    </SmallButton>
                    <SmallButton tone="danger" disabled={busy} onClick={() => setConfirmDel(id)}>
                      삭제
                    </SmallButton>
                  </div>
                ))}
                {missing.length > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="flex-1 text-[14px] font-semibold text-orange-600"><Puzzle size={15} className="mr-1 inline" aria-hidden />{missing.map((m) => (m.kind === 'required' ? `필수 「${m.course?.name}」` : '선택 1개')).join(', ')} 미신청</span>
                    <SmallButton tone="brand" disabled={busy} onClick={() => setPicking({ date: d, replace: null })}>
                      ＋ 추가
                    </SmallButton>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Sheet>

      {picking && (
        <Sheet open onClose={() => setPicking(null)} title={`${formatDate(picking.date)} 강좌 ${picking.replace ? '변경' : '추가'}`}>
          <ul className="space-y-2 pb-4">
            {a.courses
              .filter((c) => c.date === picking.date && c.id !== picking.replace)
              .map((c) => {
                const others = { ...items };
                if (picking.replace) delete others[picking.replace];
                const rule = checkPersonalRules(c, others);
                const n = enrolled(a, c);
                const full = c.capacity !== null && n >= c.capacity;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      disabled={!!rule || busy}
                      onClick={() => run(c.id, picking.replace, `「${c.name}」 ${picking.replace ? '(으)로 변경' : '배정'}했어요`)}
                      className="flex w-full items-center gap-3 rounded-2xl p-3 text-left ring-1 ring-line hover:bg-soft disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold">{c.name}</span>
                        <span className="block text-[12px] text-sub">
                          {c.category} · {timeRange(c)} · {c.place}
                        </span>
                        {rule && <span className="block text-[12px] font-semibold text-rose-600">{rule.message}</span>}
                      </span>
                      <span className={`shrink-0 text-[13px] font-bold tabular-nums ${full ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {n}/{c.capacity ?? '∞'}
                        {full && <span className="block text-[11px]">정원 초과됨</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
          </ul>
        </Sheet>
      )}

      <Modal
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        icon={Trash2} tone="rose"
        title="이 신청을 삭제할까요?"
        actions={
          <>
            <Button
              onClick={() => {
                const id = confirmDel!;
                setConfirmDel(null);
                void run(null, id, '신청을 삭제했어요');
              }}
            >
              삭제
            </Button>
            <Button variant="ghost" onClick={() => setConfirmDel(null)}>
              취소
            </Button>
          </>
        }
      >
        {confirmDel && `「${items[confirmDel]?.name}」 — 바로 반영돼요. 빠진 것이 생기면 "미제출"로 바뀌어요.`}
      </Modal>
    </>
  );
}
