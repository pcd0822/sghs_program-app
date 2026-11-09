import { Backpack, ChevronLeft, KeyRound, type LucideIcon } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/ui/Button';
import { IconTile, type GlyphTone } from '@/ui/Glyph';
import { nameError, phoneError, sidError, useInlineErrors } from '@/lib/studentInput';
import { FormAlert, FormField } from '@/ui/FormField';
import { useToast } from '@/ui/Toast';

function Shell({ icon, tone, title, desc, children }: { icon: LucideIcon; tone: GlyphTone; title: string; desc: string; children: ReactNode }) {
  const nav = useNavigate();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-[max(env(safe-area-inset-top),12px)] pb-[max(env(safe-area-inset-bottom),24px)]">
      <button
        type="button"
        onClick={() => nav('/')}
        className="-ml-3 grid size-11 place-items-center rounded-full hover:bg-white/60"
        aria-label="처음 화면으로"
      >
        <ChevronLeft size={24} aria-hidden />
      </button>
      <IconTile icon={icon} tone={tone} size={56} className="mt-6" />
      <h1 className="mt-4 text-[28px] font-extrabold tracking-tight">{title}</h1>
      <p className="mt-1 text-[15px] text-sub">{desc}</p>
      {children}
    </main>
  );
}

// 학번·이름·연락처 형식 검사(화면). 모듈 상수라야 useInlineErrors 안 콜백이 매번 새로 안 만들어진다.
const STUDENT_CHECKS = { sid: sidError, name: nameError, phone: phoneError };

export function StudentLogin() {
  const { loginStudent } = useAuth();
  const [sid, setSid] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  /** 서버가 돌려준 오류(명단 불일치·잠김). 어느 칸이 틀렸는지는 서버도 알려주지 않는다. */
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
      await loginStudent({ sid, name, phone });
      // 로그인되면 App 이 알맞은 첫 화면으로 보낸다.
    } catch (err) {
      setFormError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Shell icon={Backpack} tone="coral" title="학생 로그인" desc="등록된 학번 · 이름 · 연락처를 입력해 주세요.">
      <form onSubmit={submit} noValidate className="mt-8 flex flex-1 flex-col gap-3">
        <FormField
          label="학번"
          inputMode="numeric"
          autoComplete="off"
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
          autoComplete="tel"
          placeholder="010-1234-5678"
          value={phone}
          onChange={(e) => edit('phone', e.target.value, setPhone)}
          onBlur={(e) => v.onBlur('phone', e.target.value)}
          {...v.bind('phone')}
        />
        <div className="mt-auto space-y-3 pt-4">
          <FormAlert>{formError}</FormAlert>
          <Button type="submit" loading={busy}>
            로그인
          </Button>
          <p className="mt-1 text-center text-[15px] text-sub">
            명단에 없다고 나오나요?{' '}
            <Link to="/signup" className="font-semibold text-brand-600 underline-offset-4 hover:underline">
              회원가입 신청
            </Link>
          </p>
        </div>
      </form>
    </Shell>
  );
}

export function TeacherLogin() {
  const { loginTeacher } = useAuth();
  const toast = useToast();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (code.length !== 4 || busy) return;
    setBusy(true);
    try {
      await loginTeacher(code);
    } catch (err) {
      toast((err as Error).message, 'error');
      setCode('');
      setBusy(false);
    }
  }

  return (
    <Shell icon={KeyRound} tone="violet" title="관리자(교사) 로그인" desc="안내받은 4자리 코드를 입력해 주세요.">
      <form onSubmit={submit} className="mt-10 flex flex-1 flex-col">
        <label className="relative block">
          <span className="sr-only">4자리 코드</span>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            className="absolute inset-0 opacity-0"
          />
          <div className="pointer-events-none grid grid-cols-4 gap-3" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`grid h-18 place-items-center rounded-2xl border text-3xl font-bold transition ${
                  i === code.length ? 'border-brand-500 bg-white ring-4 ring-brand-100' : 'border-white/80 bg-white/60 backdrop-blur-md'
                }`}
              >
                {code[i] ? '●' : ''}
              </div>
            ))}
          </div>
        </label>
        <div className="mt-auto pt-6">
          <Button type="submit" loading={busy} disabled={code.length !== 4}>
            로그인
          </Button>
        </div>
      </form>
    </Shell>
  );
}
