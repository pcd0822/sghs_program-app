import { ChevronLeft, FilePenLine, Hourglass } from 'lucide-react';
import { EmptyArt, IconTile } from '@/ui/Glyph';
// 회원가입 신청(명단에 없는 학생). 승인되면 학생 명단에 등록되어 로그인할 수 있다.

import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { call } from '@/lib/call';
import { deviceId } from '@/lib/device';
import { Button } from '@/ui/Button';
import { nameError, phoneError, sidError, useInlineErrors } from '@/lib/studentInput';
import { FormAlert, FormField } from '@/ui/FormField';

const STUDENT_CHECKS = { sid: sidError, name: nameError, phone: phoneError };

export function Signup() {
  const nav = useNavigate();
  const [sid, setSid] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const v = useInlineErrors(STUDENT_CHECKS);

  function edit(k: 'sid' | 'name' | 'phone', value: string, set: (x: string) => void) {
    set(value);
    v.onEdit(k, value);
    setFormError(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setFormError(null);
    if (!v.validateAll({ sid, name, phone })) return;
    setBusy(true);
    try {
      await call('requestSignup', { sid, name, phone, deviceId: deviceId() });
      setDone(true);
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <EmptyArt icon={Hourglass} tone="amber" />
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
      <button type="button" onClick={() => nav('/login/student')} className="-ml-3 grid size-11 place-items-center rounded-full hover:bg-white/60" aria-label="뒤로">
        <ChevronLeft size={24} aria-hidden />
      </button>
      <IconTile icon={FilePenLine} tone="sky" size={56} className="mt-6" />
      <h1 className="mt-4 text-[28px] font-extrabold tracking-tight">회원가입 신청</h1>
      <p className="mt-1 text-[15px] text-sub">학생 명단에 없을 때만 신청해 주세요. 관리자가 승인하면 로그인할 수 있어요.</p>
      <form onSubmit={submit} noValidate className="mt-8 flex flex-1 flex-col gap-3">
        <FormField
          label="학번"
          inputMode="numeric"
          maxLength={5}
          placeholder="예: 30501"
          value={sid}
          onChange={(e) => edit('sid', e.target.value.replace(/\D/g, ''), setSid)}
          onBlur={(e) => v.onBlur('sid', e.target.value)}
          hint="학년 1자리 + 반 2자리 + 번호 2자리"
          {...v.bind('sid')}
        />
        <FormField
          label="이름"
          autoComplete="name"
          placeholder="홍길동"
          value={name}
          onChange={(e) => edit('name', e.target.value, setName)}
          onBlur={(e) => v.onBlur('name', e.target.value)}
          {...v.bind('name')}
        />
        <FormField
          label="연락처"
          type="tel"
          inputMode="tel"
          placeholder="010-1234-5678"
          value={phone}
          onChange={(e) => edit('phone', e.target.value, setPhone)}
          onBlur={(e) => v.onBlur('phone', e.target.value)}
          {...v.bind('phone')}
        />
        <div className="mt-auto space-y-3 pt-4">
          <FormAlert>{formError}</FormAlert>
          <Button type="submit" variant="brand" loading={busy}>
            가입 신청하기
          </Button>
        </div>
      </form>
    </main>
  );
}
