// 교사 프로필: 사진 수정. admin 은 대시보드로 들어가는 버튼.

import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/ui/Button';
import { Pill } from '@/ui/Pill';
import { PhotoEditor } from '@/profile/PhotoEditor';
import { useTeacher } from './TeacherData';

export default function ProfilePage() {
  const { logout } = useAuth();
  const { me, homeroom, isAdmin, myCourses } = useTeacher();
  const role = homeroom === null ? '교과 교사' : homeroom === 0 ? '전체 학급 담당' : `3학년 ${homeroom}반 담임`;
  return (
    <main className="px-5 pt-[max(env(safe-area-inset-top),16px)]">
      <p className="pt-2 text-[14px] font-semibold text-sub">👤 프로필</p>
      <div className="mt-4">
        <div>
          <p className="text-[22px] font-extrabold">{me?.name ?? ''} 선생님</p>
          <div className="mt-1 flex flex-wrap gap-1">
            <Pill tone="blue">{role}</Pill>
            {isAdmin && <Pill tone="purple">admin</Pill>}
            <Pill tone="gray">담당 강좌 {myCourses.length}개</Pill>
          </div>
        </div>
      </div>
      <section className="mt-5 rounded-3xl p-4 ring-1 ring-line">
        <h2 className="mb-3 text-[15px] font-bold">프로필 사진</h2>
        <PhotoEditor url={me?.photoUrl} name={me?.name ?? ''} />
      </section>
      {isAdmin && (
        <Link
          to="/admin"
          className="mt-6 flex min-h-14 items-center gap-3 rounded-3xl bg-gradient-to-r from-brand-600 to-coral-500 px-5 text-[17px] font-bold text-white shadow-lg active:scale-[0.99]"
        >
          🛠️ <span className="flex-1">관리자 대시보드</span> ›
        </Link>
      )}
      <div className="mt-8">
        <Button variant="ghost" onClick={() => logout()}>
          로그아웃
        </Button>
      </div>
    </main>
  );
}
