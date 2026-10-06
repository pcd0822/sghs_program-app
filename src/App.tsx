import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import Landing from '@/pages/Landing';
import { StudentLogin, TeacherLogin } from '@/pages/Login';
import { Signup } from '@/pages/Placeholder';
import StudentApp from '@/student/StudentApp';
import TeacherApp from '@/teacher/TeacherApp';
import { ToastProvider } from '@/ui/Toast';

function AppRoutes() {
  const { session } = useAuth();

  if (session === undefined) {
    return (
      <div className="grid min-h-dvh place-items-center" aria-busy="true">
        <span className="size-8 animate-spin rounded-full border-[3px] border-brand-500 border-r-transparent" />
      </div>
    );
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login/student" element={<StudentLogin />} />
        <Route path="/login/teacher" element={<TeacherLogin />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  const home = session.claims.role === 'student' ? '/s' : '/t';
  return (
    <Routes>
      <Route path="/s/*" element={session.claims.role === 'student' ? <StudentApp /> : <Navigate to={home} replace />} />
      <Route path="/t/*" element={session.claims.role === 'teacher' ? <TeacherApp /> : <Navigate to={home} replace />} />
      <Route path="*" element={<Navigate to={home} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
