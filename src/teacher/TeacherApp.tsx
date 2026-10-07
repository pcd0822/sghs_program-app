import { BookOpenCheck, CalendarDays, School, Ticket, UserRound } from 'lucide-react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { BottomNav, type NavItem } from '@/ui/BottomNav';
import ClassPage from './ClassPage';
import CoursesPage from './CoursesPage';
import ProfilePage from './ProfilePage';
import SubjectAttendancePage from './SubjectAttendancePage';
import { TeacherDataProvider, useTeacher } from './TeacherData';
import TeacherTimetablePage from './TeacherTimetablePage';

function Layout() {
  const { homeroom } = useTeacher();
  // 권한이 없는 메뉴는 숨긴다: 담임이 아니면 학급출결 없음
  const nav: NavItem[] = [
    { to: '/t', icon: Ticket, label: '강좌', end: true },
    { to: '/t/timetable', icon: CalendarDays, label: '시간표' },
    ...(homeroom !== null ? [{ to: '/t/class', icon: School, label: '학급출결' }] : []),
    { to: '/t/subject', icon: BookOpenCheck, label: '교과출결' },
    { to: '/t/profile', icon: UserRound, label: '프로필' },
  ];
  return (
    <div className="mx-auto min-h-dvh max-w-lg bg-white pb-28">
      <Outlet />
      <BottomNav items={nav} />
    </div>
  );
}

function ClassRoute() {
  const { homeroom } = useTeacher();
  return homeroom === null ? <Navigate to="/t" replace /> : <ClassPage />;
}

export default function TeacherApp() {
  return (
    <TeacherDataProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<CoursesPage />} />
          <Route path="timetable" element={<TeacherTimetablePage />} />
          <Route path="class" element={<ClassRoute />} />
          <Route path="subject" element={<SubjectAttendancePage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/t" replace />} />
        </Route>
      </Routes>
    </TeacherDataProvider>
  );
}
