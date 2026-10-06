import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { BottomNav, type NavItem } from '@/ui/BottomNav';
import ApplyPage from './ApplyPage';
import BoardPage from '@/board/BoardPage';
import { StudentProfilePage } from './MorePages';
import { StudentDataProvider } from './StudentData';
import TimetablePage from './TimetablePage';

const NAV: NavItem[] = [
  { to: '/s', emoji: '🎟️', label: '수강신청', end: true },
  { to: '/s/timetable', emoji: '🗓️', label: '시간표' },
  { to: '/s/qna', emoji: '💬', label: '문의하기' },
  { to: '/s/profile', emoji: '👤', label: '프로필' },
];

function Layout() {
  return (
    <div className="mx-auto min-h-dvh max-w-lg bg-white pb-28">
      <Outlet />
      <BottomNav items={NAV} />
    </div>
  );
}

export default function StudentApp() {
  return (
    <StudentDataProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<ApplyPage />} />
          <Route path="timetable" element={<TimetablePage />} />
          <Route path="qna" element={<BoardPage />} />
          <Route path="profile" element={<StudentProfilePage />} />
          <Route path="*" element={<Navigate to="/s" replace />} />
        </Route>
      </Routes>
    </StudentDataProvider>
  );
}
