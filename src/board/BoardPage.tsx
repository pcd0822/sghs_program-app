import { Hourglass, Lock, Megaphone, MessageCircle, MessageCircleReply, PenLine } from 'lucide-react';
import { Eyebrow } from '@/ui/Glyph';
// 문의하기(학생): [공지]는 맨 위 고정·색 구분, 공개 글은 모두, 비밀글은 내 글만 보인다.

import { collection, limit, orderBy, query, where } from 'firebase/firestore';
import { useMemo, useState } from 'react';
import type { Inquiry } from '@shared/types';
import { useSession } from '@/auth/AuthProvider';
import { useQueryDocs } from '@/data/live';
import { call } from '@/lib/call';
import { db } from '@/lib/firebase';
import { formatDateTime } from '@/lib/format';
import { Button } from '@/ui/Button';
import { Pill } from '@/ui/Pill';
import { Sheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { Markdown } from './Markdown';

type Row = Inquiry & { _id: string };

export default function BoardPage() {
  const { claims } = useSession();
  const qa = claims.role === 'student' ? claims.qa : '';
  const toast = useToast();
  // 공개 글(공지 포함) 최근 100개 + 내 글(비밀글 포함)
  const pub = useQueryDocs<Inquiry>('board-public', () => query(collection(db, 'inquiries'), where('secret', '==', false), orderBy('createdAt', 'desc'), limit(100)));
  const mine = useQueryDocs<Inquiry>(qa ? `board-mine-${qa}` : null, () => query(collection(db, 'inquiries'), where('authorAlias', '==', qa), orderBy('createdAt', 'desc'), limit(50)));
  const [open, setOpen] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);
  const [onlyMine, setOnlyMine] = useState(false);

  const { notices, posts } = useMemo(() => {
    const all = new Map<string, Row>();
    for (const x of [...(pub ?? []), ...(mine ?? [])]) all.set(x._id, x as Row);
    const list = [...all.values()].sort((a, b) => b.createdAt - a.createdAt);
    return { notices: list.filter((x) => x.isNotice), posts: list.filter((x) => !x.isNotice && (!onlyMine || x.authorAlias === qa)) };
  }, [pub, mine, onlyMine, qa]);
  const sel = open ? [...notices, ...posts].find((x) => x._id === open) ?? null : null;

  return (
    <main className="px-5 pt-[max(env(safe-area-inset-top),16px)]">
      <Eyebrow icon={MessageCircle} tone="sky">문의하기</Eyebrow>
      <div className="flex items-end justify-between">
        <h1 className="text-[24px] font-extrabold tracking-tight">문의 게시판</h1>
        <button type="button" onClick={() => setWriting(true)} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-ink px-4 text-[15px] font-bold text-white active:scale-95">
          <PenLine size={17} aria-hidden /> 문의 쓰기
        </button>
      </div>
      <p className="mt-1 text-[13px] text-sub">비밀글은 나와 관리자만 볼 수 있어요. 공개 글의 이름은 가려져요.</p>

      {!pub ? (
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-soft" />
          ))}
        </div>
      ) : (
        <>
          <ul className="mt-4 space-y-2">
            {notices.map((n) => (
              <li key={n._id}>
                <button type="button" onClick={() => setOpen(n._id)} className="w-full rounded-2xl bg-gradient-to-r from-brand-50 to-orange-50 p-3.5 text-left ring-1 ring-brand-100 active:scale-[0.99]">
                  <span className="flex items-center gap-1.5">
                    <Pill tone="purple"><Megaphone size={12} aria-hidden /> 공지</Pill>
                    <span className="text-[12px] text-sub">{formatDateTime(n.createdAt)}</span>
                  </span>
                  <span className="mt-1 block text-[16px] font-bold">{n.title}</span>
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex items-center gap-2">
            <h2 className="flex-1 text-[17px] font-extrabold">문의</h2>
            <label className="flex min-h-10 items-center gap-1.5 text-[14px] font-semibold text-sub">
              <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} className="size-5" /> 내 글만
            </label>
          </div>
          {posts.length === 0 ? (
            <p className="mt-6 text-center text-sub">아직 글이 없어요. 궁금한 점을 물어보세요!</p>
          ) : (
            <ul className="mt-1 divide-y divide-line">
              {posts.map((p) => (
                <li key={p._id}>
                  <button type="button" onClick={() => setOpen(p._id)} className="flex w-full items-center gap-3 py-3 text-left">
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        {p.answered ? <Pill tone="green">답변 완료</Pill> : <Pill tone="gray">답변 전</Pill>}
                        {p.secret && <Lock size={14} className="text-sub" aria-label="비밀글" />}
                        {p.authorAlias === qa && <Pill tone="blue">내 글</Pill>}
                      </span>
                      <span className="mt-1 block truncate text-[16px] font-bold">{p.secret && p.authorAlias !== qa ? '비밀글입니다' : p.title}</span>
                      <span className="text-[12px] text-sub">
                        {p.authorMasked} · {formatDateTime(p.createdAt)}
                      </span>
                    </span>
                    <span className="text-sub" aria-hidden>
                      ›
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <Sheet open={!!sel} onClose={() => setOpen(null)} title={sel?.isNotice ? '공지' : '문의'}>
        {sel && (
          <div className="pb-4">
            <h3 className="text-[20px] font-extrabold">{sel.title}</h3>
            <p className="mt-1 text-[13px] text-sub">
              {sel.authorMasked} · {formatDateTime(sel.createdAt)} {sel.secret && '· 비밀글'}
            </p>
            <div className="mt-3">{sel.isNotice ? <Markdown text={sel.body} /> : <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{sel.body}</p>}</div>
            {!sel.isNotice && (
              <div className={`mt-4 rounded-2xl p-4 ${sel.answered ? 'bg-emerald-50' : 'bg-soft'}`}>
                <p className="flex items-center gap-1.5 text-[14px] font-bold">{sel.answered ? <><MessageCircleReply size={16} className="text-emerald-600" aria-hidden /> 관리자 답변 · {sel.answeredAt ? formatDateTime(sel.answeredAt) : ''}</> : <><Hourglass size={16} className="text-sub" aria-hidden /> 아직 답변 전이에요</>}</p>
                {sel.answer && <p className="mt-1 text-[15px] leading-relaxed whitespace-pre-wrap">{sel.answer}</p>}
              </div>
            )}
            {!sel.isNotice && sel.authorAlias === qa && !sel.answered && (
              <button
                type="button"
                className="mt-4 min-h-11 rounded-full bg-rose-50 px-4 text-[14px] font-semibold text-rose-600"
                onClick={async () => {
                  try {
                    await call('deleteInquiry', { id: sel._id });
                    setOpen(null);
                    toast('글을 지웠어요', 'info');
                  } catch (e) {
                    toast((e as Error).message, 'error');
                  }
                }}
              >
                내 글 지우기
              </button>
            )}
          </div>
        )}
      </Sheet>

      {writing && <WriteSheet onClose={() => setWriting(false)} />}
    </main>
  );
}

function WriteSheet({ onClose }: { onClose(): void }) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [secret, setSecret] = useState(true);
  const [busy, setBusy] = useState(false);
  const ok = title.trim() && body.trim();

  return (
    <Sheet
      open
      onClose={onClose}
      title="문의 쓰기"
      footer={
        <Button
          variant="brand"
          loading={busy}
          disabled={!ok}
          onClick={async () => {
            setBusy(true);
            try {
              await call('createInquiry', { title, body, secret });
              toast('문의를 올렸어요', 'success');
              onClose();
            } catch (e) {
              toast((e as Error).message, 'error');
              setBusy(false);
            }
          }}
        >
          올리기
        </Button>
      }
    >
      <div className="space-y-3 pb-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={80}
          placeholder="제목"
          className="h-12 w-full rounded-2xl border border-line bg-soft px-4 font-semibold outline-none focus:border-brand-500 focus:bg-white"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={4000}
          placeholder="궁금한 점을 적어 주세요."
          className="min-h-48 w-full rounded-2xl border border-line bg-soft p-4 leading-relaxed outline-none focus:border-brand-500 focus:bg-white"
        />
        <label className="flex min-h-11 items-center gap-2 rounded-2xl bg-soft px-4">
          <input type="checkbox" checked={secret} onChange={(e) => setSecret(e.target.checked)} className="size-5" />
          <span className="flex items-center gap-1 font-semibold"><Lock size={15} aria-hidden /> 비밀글</span>
          <span className="text-[13px] text-sub">{secret ? '나와 관리자만 볼 수 있어요' : '모든 사용자가 볼 수 있어요(이름은 가려져요)'}</span>
        </label>
      </div>
    </Sheet>
  );
}
