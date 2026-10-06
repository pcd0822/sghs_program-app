import { useEffect, useState } from 'react';
import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { useSession } from '@/auth/AuthProvider';
import { Button } from '@/ui/Button';
import { Modal } from '@/ui/Modal';
import { Sheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { AdminDataProvider, useAdmin } from './AdminData';
import AttendancePage from './pages/AttendancePage';
import DashboardPage from './pages/DashboardPage';
import EnrollmentsPage from './pages/EnrollmentsPage';
import LogsPage from './pages/LogsPage';
import PeriodPage from './pages/PeriodPage';
import ProgramsPage from './pages/ProgramsPage';
import StudentsPage from './pages/StudentsPage';
import TeachersPage from './pages/TeachersPage';
import TimetableAdminPage from './pages/TimetableAdminPage';

const MENU = [
  { to: '/admin', emoji: '📊', label: '현황판', end: true },
  { to: '/admin/period', emoji: '⏰', label: '신청 일정' },
  { to: '/admin/programs', emoji: '🎟️', label: '프로그램·담당교사' },
  { to: '/admin/enrollments', emoji: '📋', label: '수강신청 내역' },
  { to: '/admin/students', emoji: '🎒', label: '학생 관리' },
  { to: '/admin/teachers', emoji: '🧑‍🏫', label: '교사 관리' },
  { to: '/admin/timetable', emoji: '🗓️', label: '시간표 관리' },
  { to: '/admin/attendance', emoji: '✅', label: '출결 조회' },
  { to: '/admin/logs', emoji: '🔐', label: '로그인 실패 기록' },
];

function MenuList({ onPick }: { onPick?(): void }) {
  const { dirtyKeys } = useAdmin();
  const dirtyOf: Record<string, boolean> = {
    '/admin/period': dirtyKeys.period,
    '/admin/programs': dirtyKeys.courses.size > 0,
    '/admin/students': dirtyKeys.students.size > 0,
    '/admin/teachers': dirtyKeys.teachers.size > 0,
    '/admin/timetable': dirtyKeys.timetable,
  };
  return (
    <ul className="space-y-1">
      {MENU.map((m) => (
        <li key={m.to}>
          <NavLink
            to={m.to}
            end={m.end}
            onClick={onPick}
            className={({ isActive }) =>
              `flex min-h-11 items-center gap-2.5 rounded-2xl px-3 text-[15px] font-semibold transition ${isActive ? 'bg-ink text-white' : 'text-[#45454f] hover:bg-soft'}`
            }
          >
            <span aria-hidden>{m.emoji}</span>
            <span className="flex-1">{m.label}</span>
            {dirtyOf[m.to] && <span className="size-2 rounded-full bg-orange-500" aria-label="저장하지 않은 변경" />}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

/** 저장하지 않은 변경 표시 + 저장 및 배포 */
function SaveBar() {
  const { dirty, discard, publish } = useAdmin();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // 페이지를 떠날 때 경고
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  if (!dirty) return null;
  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),12px)] lg:left-[260px]">
        <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-full bg-ink py-2 pr-2 pl-5 text-white shadow-2xl">
          <span className="size-2.5 shrink-0 animate-pulse rounded-full bg-orange-400" aria-hidden />
          <span className="flex-1 text-[14px] font-semibold">저장하지 않은 변경 {dirty}건</span>
          <button type="button" onClick={() => setConfirmDiscard(true)} className="min-h-10 rounded-full px-3 text-[14px] font-semibold text-white/70 hover:text-white">
            되돌리기
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const summary = await publish();
                toast(`저장 및 배포 완료 · ${summary.join(' / ')}`, 'success');
              } catch (e) {
                toast((e as Error).message, 'error');
              } finally {
                setBusy(false);
              }
            }}
            className="min-h-10 rounded-full bg-white px-4 text-[14px] font-bold text-ink disabled:opacity-60"
          >
            {busy ? '저장 중…' : '💾 저장 및 배포'}
          </button>
        </div>
      </div>
      <Modal
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        emoji="↩️"
        title="변경을 모두 되돌릴까요?"
        actions={
          <>
            <Button
              onClick={() => {
                discard();
                setConfirmDiscard(false);
              }}
            >
              되돌리기
            </Button>
            <Button variant="ghost" onClick={() => setConfirmDiscard(false)}>
              취소
            </Button>
          </>
        }
      >
        저장하지 않은 {dirty}건이 사라져요.
      </Modal>
    </>
  );
}

function Layout() {
  const { loading, dirty } = useAdmin();
  const nav = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const leave = () => (dirty ? setLeaving(true) : nav('/t/profile'));

  return (
    <div className="min-h-dvh bg-[#f7f7f9]">
      {/* 컴퓨터: 왼쪽 메뉴 */}
      <aside className="fixed inset-y-0 left-0 hidden w-[260px] flex-col border-r border-line bg-white p-4 lg:flex">
        <p className="px-3 pt-2 pb-4 text-[18px] font-extrabold">
          🛠️ <span className="text-gradient">관리자 대시보드</span>
        </p>
        <MenuList />
        <button type="button" onClick={leave} className="mt-auto min-h-11 rounded-2xl px-3 text-left text-[14px] font-semibold text-sub hover:bg-soft">
          ‹ 교사 화면으로
        </button>
      </aside>

      {/* 휴대폰: 위쪽 막대 + 메뉴 창 */}
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-white/90 px-3 pt-[max(env(safe-area-inset-top),8px)] pb-2 backdrop-blur lg:hidden">
        <button type="button" onClick={leave} className="grid size-11 place-items-center rounded-full text-xl hover:bg-soft" aria-label="교사 화면으로">
          ‹
        </button>
        <p className="flex-1 text-[16px] font-extrabold">🛠️ 관리자 대시보드</p>
        <button type="button" onClick={() => setMenuOpen(true)} className="min-h-11 rounded-full bg-soft px-4 text-[14px] font-bold">
          ☰ 메뉴
        </button>
      </header>
      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="대시보드 메뉴">
        <MenuList onPick={() => setMenuOpen(false)} />
      </Sheet>

      <main className="px-4 pt-4 pb-32 lg:ml-[260px] lg:px-8 lg:pt-8">
        <div className="mx-auto max-w-6xl">
          {loading ? (
            <div className="space-y-3">
              <div className="h-10 w-60 animate-pulse rounded-xl bg-white" />
              <div className="h-40 animate-pulse rounded-3xl bg-white" />
              <div className="h-72 animate-pulse rounded-3xl bg-white" />
            </div>
          ) : (
            <Routes>
              <Route index element={<DashboardPage />} />
              <Route path="period" element={<PeriodPage />} />
              <Route path="programs" element={<ProgramsPage />} />
              <Route path="enrollments" element={<EnrollmentsPage />} />
              <Route path="students" element={<StudentsPage />} />
              <Route path="teachers" element={<TeachersPage />} />
              <Route path="timetable" element={<TimetableAdminPage />} />
              <Route path="attendance" element={<AttendancePage />} />
              <Route path="logs" element={<LogsPage />} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Routes>
          )}
        </div>
      </main>
      <SaveBar />

      <Modal
        open={leaving}
        onClose={() => setLeaving(false)}
        emoji="⚠️"
        title="저장하지 않은 변경이 있어요"
        actions={
          <>
            <Button variant="ghost" onClick={() => setLeaving(false)}>
              대시보드에 남기
            </Button>
            <Button onClick={() => nav('/t/profile')}>저장하지 않고 나가기</Button>
          </>
        }
      >
        나가면 변경 {dirty}건이 사라져요. "저장 및 배포"를 먼저 눌러 주세요.
      </Modal>
    </div>
  );
}

export default function AdminApp() {
  const { claims } = useSession();
  if (claims.role !== 'teacher' || !claims.admin) return <Navigate to="/" replace />;
  return (
    <AdminDataProvider>
      <Layout />
    </AdminDataProvider>
  );
}
