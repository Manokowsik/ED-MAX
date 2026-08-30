import { createContext, useContext, useState, useCallback } from 'react';

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

  /**
   * Called after a successful login.
   * Stores token + user in state and localStorage.
   */
  const loginSuccess = useCallback((accessToken, userData) => {
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(accessToken);
    setUser(userData);
  }, []);

  /**
   * Clears all auth state.
   */
  const logout = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  }, []);

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
