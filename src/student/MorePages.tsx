// 학생 프로필: 사진·연락처 수정(교사 화면에 바로 반영)

import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { call } from '@/lib/call';
import { db } from '@/lib/firebase';
import { PhotoEditor } from '@/profile/PhotoEditor';
import { Button } from '@/ui/Button';
import { Modal } from '@/ui/Modal';
import { useToast } from '@/ui/Toast';
import { useStudent } from './StudentData';

const fmt = (p: string) => p.replace(/^(\d{3})(\d{3,4})(\d{4})$/, '$1-$2-$3');

export function StudentProfilePage() {
  const { logout } = useAuth();
  const { me, sid } = useStudent();
  const toast = useToast();
  const [phone, setPhone] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  // 내 연락처(본인만 읽을 수 있음)
  useEffect(
    () =>
      onSnapshot(doc(db, 'studentSecrets', sid), (s) => {
        const p = String(s.get('phone') ?? '');
        setPhone(p);
        setInput(fmt(p));
      }),
    [sid],
  );
  const digits = input.replace(/\D/g, '');
  const changed = phone !== null && digits !== phone;

  async function savePhone() {
    setConfirm(false);
    setBusy(true);
    try {
      await call('updateProfile', { phone: digits });
      toast('연락처를 바꿨어요. 다음 로그인부터 새 연락처로 들어와요.', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="px-5 pt-[max(env(safe-area-inset-top),16px)]">
      <p className="pt-2 text-[14px] font-semibold text-sub">👤 프로필</p>
      <h1 className="text-[24px] font-extrabold">{me?.name ?? ''}</h1>
      <p className="text-sub">
        {sid} · {me ? `${me.classNo}반 ${me.number}번` : ''}
      </p>

      <section className="mt-6 rounded-3xl p-4 ring-1 ring-line">
        <h2 className="mb-3 text-[15px] font-bold">프로필 사진</h2>
        <PhotoEditor url={me?.photoUrl} name={me?.name ?? ''} />
        <p className="mt-3 text-[13px] text-sub">선생님 출석부에 보여요. 얼굴이 잘 보이는 사진이면 좋아요.</p>
      </section>

      <section className="mt-4 rounded-3xl p-4 ring-1 ring-line">
        <h2 className="text-[15px] font-bold">연락처</h2>
        <p className="mt-0.5 text-[13px] text-sub">로그인할 때 쓰는 연락처예요. 바꾸면 다음 로그인부터 새 번호를 입력해야 해요.</p>
        <div className="mt-3 flex gap-2">
          <input
            type="tel"
            inputMode="tel"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            aria-label="연락처"
            className="h-12 min-w-0 flex-1 rounded-2xl border border-line bg-soft px-4 text-[17px] tabular-nums outline-none focus:border-brand-500 focus:bg-white"
          />
          <button
            type="button"
            disabled={!changed || busy || digits.length < 10}
            onClick={() => setConfirm(true)}
            className="min-h-12 shrink-0 rounded-2xl bg-ink px-5 font-bold text-white disabled:opacity-30"
          >
            저장
          </button>
        </div>
      </section>

      <div className="mt-8">
        <Button variant="ghost" onClick={() => logout()}>
          로그아웃
        </Button>
      </div>

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        emoji="📱"
        title="연락처를 바꿀까요?"
        actions={
          <>
            <Button onClick={savePhone}>바꿀게요</Button>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              취소
            </Button>
          </>
        }
      >
        새 번호 <b>{fmt(digits)}</b>
        <br />
        다음에 로그인할 때 이 번호를 입력해야 해요.
      </Modal>
    </main>
  );
}
