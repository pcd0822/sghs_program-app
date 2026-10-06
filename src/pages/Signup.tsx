// 회원가입 신청(명단에 없는 학생). 승인되면 학생 명단에 등록되어 로그인할 수 있다.

import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { call } from '@/lib/call';
import { deviceId } from '@/lib/device';
import { Button } from '@/ui/Button';
import { useToast } from '@/ui/Toast';

export function Signup() {
  const nav = useNavigate();
  const toast = useToast();
  const [sid, setSid] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const ready = /^\d{5}$/.test(sid) && name.trim() !== '' && phone.replace(/\D/g, '').length >= 10;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    try {
      await call('requestSignup', { sid, name, phone, deviceId: deviceId() });
      setDone(true);
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const field = 'mt-1.5 block h-14 w-full rounded-2xl border border-line bg-soft px-4 text-[17px] outline-none focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100';

  if (done) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="text-6xl">⏳</div>
        <h1 className="text-[26px] font-extrabold">가입 신청을 보냈어요</h1>
        <p className="text-sub">관리자가 승인하면 같은 학번·이름·연락처로 로그인할 수 있어요.</p>
        <Link to="/" className="mt-6 w-full">
          <Button>처음 화면으로</Button>
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-[max(env(safe-area-inset-top),12px)] pb-[max(env(safe-area-inset-bottom),24px)]">
      <button type="button" onClick={() => nav('/login/student')} className="-ml-3 grid size-11 place-items-center rounded-full text-2xl hover:bg-soft" aria-label="뒤로">
        ‹
      </button>
      <div className="mt-6 text-4xl">📝</div>
      <h1 className="mt-3 text-[28px] font-extrabold tracking-tight">회원가입 신청</h1>
      <p className="mt-1 text-[15px] text-sub">학생 명단에 없을 때만 신청해 주세요. 관리자가 승인하면 로그인할 수 있어요.</p>
      <form onSubmit={submit} className="mt-8 flex flex-1 flex-col gap-4">
        <label className="block">
          <span className="text-sm font-semibold text-sub">학번</span>
          <input inputMode="numeric" maxLength={5} placeholder="예: 30501" value={sid} onChange={(e) => setSid(e.target.value.replace(/\D/g, ''))} className={field} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-sub">이름</span>
          <input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={field} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-sub">연락처</span>
          <input type="tel" inputMode="tel" placeholder="010-1234-5678" value={phone} onChange={(e) => setPhone(e.target.value)} className={field} />
        </label>
        <div className="mt-auto pt-6">
          <Button type="submit" variant="brand" loading={busy} disabled={!ready}>
            가입 신청하기
          </Button>
        </div>
      </form>
    </main>
  );
}
