// 교사 프로필. 사진 수정은 5단계, 관리자 대시보드는 4단계에서 연결한다.

import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/ui/Button';
import { Pill } from '@/ui/Pill';
import { Avatar } from './attendance';
import { useTeacher } from './TeacherData';

export default function ProfilePage() {
  const { logout } = useAuth();
  const { me, homeroom, isAdmin, myCourses } = useTeacher();
  const role = homeroom === null ? '교과 교사' : homeroom === 0 ? '전체 학급 담당' : `3학년 ${homeroom}반 담임`;
  return (
    <main className="px-5 pt-[max(env(safe-area-inset-top),16px)]">
      <p className="pt-2 text-[14px] font-semibold text-sub">👤 프로필</p>
      <div className="mt-6 flex items-center gap-4">
        <Avatar url={me?.photoUrl} name={me?.name ?? '?'} size={80} />
        <div>
          <p className="text-[22px] font-extrabold">{me?.name ?? ''} 선생님</p>
          <div className="mt-1 flex flex-wrap gap-1">
            <Pill tone="blue">{role}</Pill>
            {isAdmin && <Pill tone="purple">admin</Pill>}
            <Pill tone="gray">담당 강좌 {myCourses.length}개</Pill>
          </div>
        </div>
      </div>
      {isAdmin && (
        <div className="mt-6 rounded-2xl bg-brand-50 px-4 py-3 text-[14px] font-semibold text-brand-700">🛠️ 관리자 대시보드는 다음 단계에서 이 자리에 열려요.</div>
      )}
      <div className="mt-8">
        <Button variant="ghost" onClick={() => logout()}>
          로그아웃
        </Button>
      </div>
    </main>
  );
}
