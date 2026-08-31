import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { scheduleAccessTokenRefresh, clearAuthState } from '../services/api';

const AuthContext = createContext(null);

/**
 * Reads the persisted auth state from localStorage on startup.
 */
function readPersistedAuth() {
  try {
    const token = localStorage.getItem('access_token');
    const raw = localStorage.getItem('user');
    if (token && raw) {
      const user = JSON.parse(raw);
      return { token, user };
    }
  } catch {
    // corrupt storage — ignore
  }
  return { token: null, user: null };
}

export function AuthProvider({ children }) {
  const persisted = readPersistedAuth();

  const [token, setToken] = useState(persisted.token);
  const [user, setUser] = useState(persisted.user);

  const loginSuccess = useCallback((accessToken, userData) => {
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(accessToken);
    setUser(userData);
    scheduleAccessTokenRefresh();
  }, []);

  const logout = useCallback(() => {
    clearAuthState('');
    sessionStorage.removeItem('auth_error');
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    if (token) {
      scheduleAccessTokenRefresh();
    }
  }, [token]);

  const value = {
    token,
    user,
    role: user?.role ?? null,
    isAuthenticated: !!token,
    isAdmin: user?.role === 'ADMIN',
    isStudent: user?.role === 'STUDENT',
    loginSuccess,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
