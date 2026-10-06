import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import type { Inquiry } from '@shared/types';
import { NoticeEditor } from '@/board/NoticeEditor';
import { useQueryDocs } from '@/data/live';
import { call } from '@/lib/call';
import { db } from '@/lib/firebase';
import { formatDateTime } from '@/lib/format';
import { Button } from '@/ui/Button';
import { Modal } from '@/ui/Modal';
import { Pill } from '@/ui/Pill';
import { Sheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { Card, Empty, PageHead, SmallButton } from '../ui';

type Row = Inquiry & { _id: string };
type Filter = 'todo' | 'done' | 'notice' | 'all';

/** 문의 관리(비밀글 포함 전체) + [공지] 작성 */
export default function BoardAdminPage() {
  const toast = useToast();
  const list = useQueryDocs<Inquiry>('admin-board', () => query(collection(db, 'inquiries'), orderBy('createdAt', 'desc'), limit(300))) as Row[] | undefined;
  const [authors, setAuthors] = useState<Map<string, { sid: string; name: string }>>(new Map());
  const [filter, setFilter] = useState<Filter>('todo');
  const [open, setOpen] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ id: string | null; title: string; body: string } | null>(null);
  const [del, setDel] = useState<Row | null>(null);

  // 실제 작성자(학번·이름) — 글 목록이 바뀔 때 다시 읽는다
  useEffect(() => {
    if (!list) return;
    getDocs(collection(db, 'inquiryAuthors'))
      .then((s) => setAuthors(new Map(s.docs.map((d) => [d.id, d.data() as { sid: string; name: string }]))))
      .catch(() => undefined);
  }, [list?.length]); // 글 수가 바뀔 때만

  const rows = (list ?? []).filter((x) =>
    filter === 'notice' ? x.isNotice : filter === 'todo' ? !x.isNotice && !x.answered : filter === 'done' ? !x.isNotice && x.answered : true,
  );
  const todo = (list ?? []).filter((x) => !x.isNotice && !x.answered).length;
  const sel = open ? list?.find((x) => x._id === open) ?? null : null;

  return (
    <div className="space-y-4">
      <PageHead
        emoji="💬"
        title="문의·공지"
        desc={`답변 전 ${todo}건 · 비밀글을 포함한 모든 문의를 볼 수 있어요.`}
        actions={
          <SmallButton tone="brand" onClick={() => setNotice({ id: null, title: '', body: '' })}>
            📢 공지 쓰기
          </SmallButton>
        }
      />
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ['todo', `답변 전 ${todo}`],
            ['done', '답변 완료'],
            ['notice', '공지'],
            ['all', '전체'],
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
      </div>

      <Card>
        {!list ? (
          <div className="h-40 animate-pulse rounded-2xl bg-soft" />
        ) : rows.length === 0 ? (
          <Empty emoji="📭" text="해당하는 글이 없어요" />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((x) => {
              const a = authors.get(x._id);
              return (
                <li key={x._id}>
                  <button
                    type="button"
                    onClick={() => (x.isNotice ? setNotice({ id: x._id, title: x.title, body: x.body }) : setOpen(x._id))}
                    className="flex w-full items-center gap-3 py-3 text-left hover:bg-soft"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        {x.isNotice ? <Pill tone="purple">📢 공지</Pill> : x.answered ? <Pill tone="green">답변 완료</Pill> : <Pill tone="orange">답변 전</Pill>}
                        {x.secret && <Pill tone="gray">🔒 비밀</Pill>}
                        <span className="text-[12px] text-sub">
                          {a ? `${a.sid} ${a.name}` : x.authorMasked} · {formatDateTime(x.createdAt)}
                        </span>
                      </span>
                      <span className="mt-1 block truncate font-bold">{x.title}</span>
                    </span>
                    <span className="text-sub">›</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {sel && <AnswerSheet row={sel} author={authors.get(sel._id)} onClose={() => setOpen(null)} onDelete={() => setDel(sel)} />}

      {notice && (
        <Sheet
          open
          onClose={() => setNotice(null)}
          title={notice.id ? '공지 수정' : '공지 쓰기'}
          wide
          footer={
            <div className="flex gap-2">
              {notice.id && (
                <Button
                  variant="ghost"
                  className="w-auto! shrink-0 px-5 text-rose-600"
                  onClick={() => {
                    const row = list?.find((x) => x._id === notice.id);
                    if (row) setDel(row);
                  }}
                >
                  삭제
                </Button>
              )}
              <Button
                variant="brand"
                disabled={!notice.title.trim() || !notice.body.trim()}
                onClick={async () => {
                  try {
                    await call('saveNotice', notice);
                    toast('공지를 저장했어요. 학생 문의 게시판 맨 위에 보여요.', 'success');
                    setNotice(null);
                  } catch (e) {
                    toast((e as Error).message, 'error');
                  }
                }}
              >
                공지 저장
              </Button>
            </div>
          }
        >
          <div className="space-y-3 pb-4">
            <input
              value={notice.title}
              onChange={(e) => setNotice({ ...notice, title: e.target.value })}
              placeholder="공지 제목"
              maxLength={80}
              className="h-12 w-full rounded-2xl border border-line bg-soft px-4 font-bold outline-none focus:border-brand-500 focus:bg-white"
            />
            <NoticeEditor value={notice.body} onChange={(body) => setNotice({ ...notice, body })} />
          </div>
        </Sheet>
      )}

      <Modal
        open={!!del}
        onClose={() => setDel(null)}
        emoji="🗑️"
        title="이 글을 삭제할까요?"
        actions={
          <>
            <Button
              onClick={async () => {
                try {
                  await call('deleteInquiry', { id: del!._id });
                  setDel(null);
                  setOpen(null);
                  setNotice(null);
                  toast('삭제했어요', 'info');
                } catch (e) {
                  toast((e as Error).message, 'error');
                }
              }}
            >
              삭제
            </Button>
            <Button variant="ghost" onClick={() => setDel(null)}>
              취소
            </Button>
          </>
        }
      >
        「{del?.title}」 — 되돌릴 수 없어요.
      </Modal>
    </div>
  );
}

function AnswerSheet({ row, author, onClose, onDelete }: { row: Row; author?: { sid: string; name: string }; onClose(): void; onDelete(): void }) {
  const toast = useToast();
  const [answer, setAnswer] = useState(row.answer ?? '');
  const [busy, setBusy] = useState(false);
  return (
    <Sheet
      open
      onClose={onClose}
      title="문의 답변"
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" className="w-auto! shrink-0 px-5 text-rose-600" onClick={onDelete}>
            삭제
          </Button>
          <Button
            variant="brand"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await call('answerInquiry', { id: row._id, answer });
                toast(answer.trim() ? '답변을 저장했어요' : '답변을 지웠어요', 'success');
                onClose();
              } catch (e) {
                toast((e as Error).message, 'error');
                setBusy(false);
              }
            }}
          >
            답변 저장
          </Button>
        </div>
      }
    >
      <div className="space-y-3 pb-4">
        <p className="text-[13px] text-sub">
          {author ? `${author.sid} ${author.name}` : row.authorMasked} · {formatDateTime(row.createdAt)} {row.secret ? '· 🔒 비밀글' : '· 공개 글'}
        </p>
        <h3 className="text-[19px] font-extrabold">{row.title}</h3>
        <div className="rounded-2xl bg-soft p-3 text-[15px] leading-relaxed whitespace-pre-wrap">{row.body}</div>
        <label className="block">
          <span className="text-[13px] font-semibold text-sub">답변</span>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="답변을 입력해 주세요. 비우고 저장하면 답변이 지워져요."
            className="mt-1 min-h-40 w-full rounded-2xl border border-line bg-white p-3 leading-relaxed outline-none focus:border-brand-500"
          />
        </label>
      </div>
    </Sheet>
  );
}
