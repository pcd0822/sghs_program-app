// 문의하기 · 프로필은 5단계에서 채운다. 지금은 자리와 로그아웃만.

import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/ui/Button';
import { useStudent } from './StudentData';

export function StudentQnaPage() {
  return (
    <main className="px-5 pt-[max(env(safe-area-inset-top),16px)]">
      <p className="pt-2 text-[14px] font-semibold text-sub">💬 문의하기</p>
      <h1 className="text-[24px] font-extrabold">문의 게시판</h1>
      <div className="mt-16 text-center text-sub">
        <div className="text-5xl">🛠️</div>
        <p className="mt-3">곧 열려요. 지금은 담임 선생님께 문의해 주세요.</p>
      </div>
    </main>
  );
}

export function StudentProfilePage() {
  const { logout } = useAuth();
  const { me, sid } = useStudent();
  return (
    <main className="px-5 pt-[max(env(safe-area-inset-top),16px)]">
      <p className="pt-2 text-[14px] font-semibold text-sub">👤 프로필</p>
      <div className="mt-6 flex items-center gap-4">
        <div className="grid size-20 place-items-center rounded-full bg-gradient-to-br from-brand-100 to-orange-100 text-4xl">🙂</div>
        <div>
          <p className="text-[22px] font-extrabold">{me?.name ?? ''}</p>
          <p className="text-sub">
            {sid} · {me ? `${me.classNo}반 ${me.number}번` : ''}
          </p>
        </div>
      </div>
      <p className="mt-6 rounded-2xl bg-soft px-4 py-3 text-[14px] text-sub">프로필 사진·연락처 수정은 곧 열려요.</p>
      <div className="mt-8">
        <Button variant="ghost" onClick={() => logout()}>
          로그아웃
        </Button>
      </div>
    </main>
  );
}
