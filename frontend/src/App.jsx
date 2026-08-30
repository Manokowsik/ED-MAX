import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import RoleRoute from './components/RoleRoute';

// Pages
import Login from './pages/Login';
import NotFound from './pages/NotFound';

// Admin
import AdminDashboard from './pages/admin/Dashboard';
import AdminStudents from './pages/admin/Students';
import AdminStudentDetail from './pages/admin/StudentDetail';
import AdminCourses from './pages/admin/Courses';
import AdminCourseDetail from './pages/admin/CourseDetail';
import AdminAssignments from './pages/admin/Assignments';

// Student
import StudentDashboard from './pages/student/Dashboard';
import StudentCourses from './pages/student/Courses';
import CourseLearning from './pages/student/CourseLearning';
import StudentCertificates from './pages/student/Certificates';

// Public
import CertificateVerify from './pages/CertificateVerify';

function RootRedirect() {
  const { isAuthenticated, isAdmin } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (isAdmin) return <Navigate to="/admin/dashboard" replace />;
  return <Navigate to="/student/dashboard" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Root */}
      <Route path="/" element={<RootRedirect />} />

      {/* Auth */}
      <Route path="/login" element={<Login />} />

      {/* =====================================================
          ADMIN ROUTES
      ===================================================== */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <RoleRoute roles={['ADMIN']}>
              <Navigate to="/admin/dashboard" replace />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute>
            <RoleRoute roles={['ADMIN']}>
              <AdminDashboard />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/students"
        element={
          <ProtectedRoute>
            <RoleRoute roles={['ADMIN']}>
              <AdminStudents />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/students/:studentId"
        element={
          <ProtectedRoute>
            <RoleRoute roles={['ADMIN']}>
              <AdminStudentDetail />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/courses"
        element={
          <ProtectedRoute>
            <RoleRoute roles={['ADMIN']}>
              <AdminCourses />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/courses/:courseId"
        element={
          <ProtectedRoute>
            <RoleRoute roles={['ADMIN']}>
              <AdminCourseDetail />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/assignments"
        element={
          <ProtectedRoute>
            <RoleRoute roles={['ADMIN']}>
              <AdminAssignments />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      {/* =====================================================
          STUDENT ROUTES
      ===================================================== */}
      <Route
        path="/student"
        element={
          <ProtectedRoute>
            <RoleRoute roles={['STUDENT']}>
              <Navigate to="/student/dashboard" replace />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/dashboard"
        element={
          <ProtectedRoute>
            <RoleRoute roles={['STUDENT']}>
              <StudentDashboard />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/courses"
        element={
          <ProtectedRoute>
            <RoleRoute roles={['STUDENT']}>
              <StudentCourses />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/courses/:courseId"
        element={
          <ProtectedRoute>
            <RoleRoute roles={['STUDENT']}>
              <CourseLearning />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/certificates"
        element={
          <ProtectedRoute>
            <RoleRoute roles={['STUDENT']}>
              <StudentCertificates />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      {/* Public — no auth required */}
      <Route path="/verify/:certNumber" element={<CertificateVerify />} />

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;