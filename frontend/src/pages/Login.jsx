import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { login } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Alert, Spinner } from '../components/ui';

export default function Login() {
  const { loginSuccess } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const from = location.state?.from?.pathname;

  async function handleLogin(e) {
    e.preventDefault();
    setError('');

    if (!email.trim()) { setError('Email is required.'); return; }
    if (!password) { setError('Password is required.'); return; }

    setLoading(true);
    try {
      const result = await login(email.trim(), password);
      loginSuccess(result.access_token, result.user);

      // Redirect to previous page or role dashboard
      if (from && !from.startsWith('/login')) {
        navigate(from, { replace: true });
      } else if (result.user.role === 'ADMIN') {
        navigate('/admin/dashboard', { replace: true });
      } else if (result.user.role === 'STUDENT') {
        navigate('/student/dashboard', { replace: true });
      } else {
        setError('Unknown user role. Please contact support.');
      }
    } catch (err) {
      if (err.message?.includes('401') || err.message === 'Invalid email or password') {
        setError('Invalid email or password. Please try again.');
      } else if (err.message?.toLowerCase().includes('network') || err.message?.toLowerCase().includes('fetch')) {
        setError('Unable to connect to the server. Please check your connection.');
      } else {
        setError(err.message || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Brand */}
        <div style={styles.brand}>
          <div style={styles.brandLogo}>🎓</div>
          <h1 style={styles.brandName}>ED-MAX</h1>
          <p style={styles.brandSub}>Employee Training &amp; Learning Platform</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} noValidate>
          {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

          <div className="form-group">
            <label className="form-label" htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              className="form-input"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="form-input"
              placeholder="Enter your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              disabled={loading}
            />
          </div>

          <button
            id="login-btn"
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            style={{ marginTop: 'var(--space-2)' }}
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-2 justify-center">
                <Spinner /> Signing in…
              </span>
            ) : 'Sign in'}
          </button>
        </form>

        <p style={styles.footer}>
          Your credentials are provided by your administrator.
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #1e1b4b 0%, #4f46e5 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.5rem',
  },
  card: {
    width: '100%',
    maxWidth: '420px',
    background: '#fff',
    padding: '2.5rem',
    borderRadius: '1rem',
    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
  },
  brand: {
    textAlign: 'center',
    marginBottom: '2rem',
  },
  brandLogo: {
    fontSize: '3rem',
    marginBottom: '0.5rem',
  },
  brandName: {
    fontSize: '1.75rem',
    fontWeight: 700,
    color: 'var(--gray-900)',
    letterSpacing: '-0.025em',
    margin: 0,
  },
  brandSub: {
    fontSize: '0.875rem',
    color: 'var(--gray-500)',
    margin: '0.25rem 0 0',
  },
  footer: {
    marginTop: '1.5rem',
    textAlign: 'center',
    fontSize: '0.75rem',
    color: 'var(--gray-400)',
  },
};