// 아직 만들지 않은 화면 자리. 단계가 진행되면 실제 화면으로 바뀐다.

import { Link } from 'react-router-dom';

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
