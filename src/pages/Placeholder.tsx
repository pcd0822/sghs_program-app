// 아직 만들지 않은 화면 자리. 단계가 진행되면 실제 화면으로 바뀐다.

import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/ui/Button';

export function Signup() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="text-5xl">📝</div>
      <h1 className="text-2xl font-extrabold">회원가입 신청</h1>
      <p className="text-sub">곧 열려요. 지금은 담임 선생님께 문의해 주세요.</p>
      <Link to="/" className="mt-4 font-semibold text-brand-600">
        처음 화면으로
      </Link>
    </main>
  );
}

export function SignedInHome() {
  const { session, logout } = useAuth();
  if (!session) return null;
  const c = session.claims;
  const who =
    c.role === 'student'
      ? `학생 · ${c.sid} (${c.classNo}반)`
      : `교사 · ${c.homeroom === null ? '교과' : c.homeroom === 0 ? '전체 학급 담당' : `${c.homeroom}반 담임`}${c.admin ? ' · admin' : ''}`;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="text-5xl">{c.role === 'student' ? '🎟️' : '🏫'}</div>
      <h1 className="text-2xl font-extrabold">로그인 성공</h1>
      <p className="rounded-full bg-brand-50 px-4 py-1.5 font-semibold text-brand-700">{who}</p>
      <p className="text-sub">다음 단계에서 이 자리에 {c.role === 'student' ? '수강신청' : '교사'} 화면이 들어와요.</p>
      <div className="mt-6 w-full">
        <Button variant="ghost" onClick={() => logout()}>
          로그아웃
        </Button>
      </div>
    </main>
  );
}
