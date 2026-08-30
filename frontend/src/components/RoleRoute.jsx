import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * RoleRoute — renders children only if the current user has one of the
 * allowed roles. Otherwise, redirects to the appropriate home.
 *
 * @param {string[]} roles - array of allowed role strings, e.g. ['ADMIN']
 */
export default function RoleRoute({ roles, children }) {
  const { role } = useAuth();

  if (!roles.includes(role)) {
    // Send to appropriate dashboard rather than showing a blank page
    if (role === 'ADMIN') return <Navigate to="/admin/dashboard" replace />;
    if (role === 'STUDENT') return <Navigate to="/student/dashboard" replace />;
    return <Navigate to="/login" replace />;
  }

  return children;
}
