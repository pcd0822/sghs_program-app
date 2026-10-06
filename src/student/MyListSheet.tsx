import { checkWindow } from '@shared/rules';
import { formatDate, formatDateTime } from '@/lib/format';
import { Button } from '@/ui/Button';
import { Pill } from '@/ui/Pill';
import { Sheet } from '@/ui/Sheet';
import { useStudent } from './StudentData';

/** "내 신청 목록" — 표 + 강좌별 취소 + 맨 아래 "수강신청 제출" */
export function MyListSheet({ open, onClose }: { open: boolean; onClose(): void }) {
  const { items, byId, prog, app, period, busy, cancel, submit, openCourse } = useStudent();

  const rows = Object.entries(items)
    .map(([id, it]) => ({ id, it, c: byId.get(id) }))
    .sort((a, b) => a.it.date.localeCompare(b.it.date) || (a.c?.start ?? '').localeCompare(b.c?.start ?? ''));
  const missing = prog?.missing ?? [];
  const submitted = !!app?.submitted;
  const closed = !!checkWindow(period, null, Date.now());

  // 신청한 강좌와 빠진 칸을 날짜순으로 섞어서 보여준다
  const lines = [
    ...rows.map(({ id, it, c }) => ({
      date: it.date,
      el: (
        <tr key={id} className="align-top">
          <td className="border-b border-line py-3 pr-1 font-semibold">
            {formatDate(it.date)}
            <div className="mt-1">{it.category === '필수' ? <Pill tone="purple">필수</Pill> : <Pill tone="blue">선택</Pill>}</div>
          </td>
          <td className="border-b border-line py-3 pr-2">
            <button type="button" className="text-left font-bold leading-snug underline-offset-2 hover:underline" onClick={() => c && openCourse(c)}>
              {it.name}
            </button>
            <div className="mt-0.5 text-[12px] text-sub">{c?.place ?? ''}</div>
          </td>
          <td className="border-b border-line py-3 text-[12px] leading-tight text-sub">
            {c ? (
              <>
                {c.start}
                <br />~{c.end}
              </>
            ) : (
              '-'
            )}
          </td>
          <td className="border-b border-line py-2.5 text-right">
            <button
              type="button"
              disabled={!!busy || !c}
              onClick={() => c && cancel(c)}
              className="min-h-10 rounded-full bg-soft px-3 text-[13px] font-semibold text-rose-600 disabled:opacity-40"
            >
              {busy === id ? '…' : '취소'}
            </button>
          </td>
        </tr>
      ),
    })),
    ...missing.map((m) => ({
      date: m.date,
      el: (
        <tr key={`m-${m.kind}-${m.date}-${m.course?.id ?? ''}`}>
          <td className="border-b border-line py-3 font-semibold text-sub">{formatDate(m.date)}</td>
          <td colSpan={3} className="border-b border-line py-3">
            <span className="inline-block rounded-xl border border-dashed border-orange-300 bg-orange-50/50 px-3 py-1.5 text-[13px] font-semibold text-orange-700">
              {m.kind === 'required' ? `필수 「${m.course?.name}」 미신청` : '선택 강좌 미신청'}
            </span>
          </td>
        </tr>
      ),
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="내 신청 목록"
      footer={
        <div>
          {submitted ? (
            <p className="mb-2 text-center text-[14px] font-semibold text-emerald-600">✅ 제출 완료 · {app?.submittedAt ? formatDateTime(app.submittedAt) : ''}</p>
          ) : missing.length > 0 ? (
            <p className="mb-2 text-center text-[14px] font-semibold text-orange-600">🧩 아직 {missing.length}개가 빠졌어요. 모두 채워야 제출할 수 있어요.</p>
          ) : (
            <p className="mb-2 text-center text-[14px] font-semibold text-brand-700">모두 채웠어요! 제출 버튼을 눌러 마무리해 주세요.</p>
          )}
          <Button variant={submitted ? 'ghost' : 'brand'} loading={busy === 'submit'} disabled={submitted || closed || !!busy} onClick={submit}>
            {submitted ? '제출 완료' : closed ? '신청 기간이 아니에요' : '수강신청 제출'}
          </Button>
        </div>
      }
    >
      <div className="mb-3 flex items-center gap-2">
        {prog && (
          <>
            <Pill tone="purple">
              필수 {prog.requiredDone}/{prog.requiredTotal}
            </Pill>
            <Pill tone="blue">
              선택 {prog.selectiveDone}/{prog.selectiveTotal}
            </Pill>
          </>
        )}
        <Pill tone={submitted ? 'green' : 'gray'}>{submitted ? '제출 완료' : '미제출'}</Pill>
      </div>

      <table className="w-full table-fixed border-separate border-spacing-0 text-left text-[14px]">
        <thead>
          <tr className="text-[12px] text-sub">
            <th className="w-[70px] border-b border-line py-2 font-semibold">날짜</th>
            <th className="border-b border-line py-2 font-semibold">강좌 · 장소</th>
            <th className="w-[52px] border-b border-line py-2 font-semibold">시간</th>
            <th className="w-[56px] border-b border-line py-2" />
          </tr>
        </thead>
        <tbody>{lines.map((x) => x.el)}</tbody>
      </table>
      {rows.length === 0 && missing.length === 0 && <p className="py-8 text-center text-sub">아직 신청한 강좌가 없어요.</p>}
    </Sheet>
  );
}
