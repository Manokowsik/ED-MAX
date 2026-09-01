import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { validateResetToken, resetPassword } from '../services/api';
import { Alert, Spinner } from '../components/ui';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing password reset link.');
      setValidating(false);
      return;
    }

    async function checkToken() {
      try {
        await validateResetToken(token);
        setTokenValid(true);
      } catch (err) {
        setError(err.message || 'Invalid or expired password reset token.');
      } finally {
        setValidating(false);
      }
    }

    checkToken();
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!password) {
      setError('Please enter a new password.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await resetPassword(token, password, confirmPassword);
      setSuccess(res.message || 'Password reset successfully! Redirecting to login…');
      setTimeout(() => {
        navigate('/login', { state: { message: 'Password reset successfully. Please log in with your new password.' } });
      }, 2000);
    } catch (err) {
      setError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (validating) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <Spinner />
            <p style={{ marginTop: '1rem', color: 'var(--gray-600)' }}>Validating reset link…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.brand}>
          <div style={styles.brandLogo}>🎓</div>
          <h1 style={styles.brandName}>ED-MAX</h1>
          <p style={styles.brandSub}>Set New Password</p>
        </div>

        {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}
        {success && <Alert type="success">{success}</Alert>}

        {tokenValid && !success && (
          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="new-password">New password</label>
              <input
                id="new-password"
                type="password"
                className="form-input"
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="confirm-new-password">Confirm new password</label>
              <input
                id="confirm-new-password"
                type="password"
                className="form-input"
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <button
              id="reset-submit-btn"
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              style={{ marginTop: 'var(--space-2)' }}
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2 justify-center">
                  <Spinner /> Resetting password…
                </span>
              ) : 'Reset Password'}
            </button>
          </form>
        )}

        {(!tokenValid || success) && (
          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <Link to="/login" className="btn btn-primary btn-full">
              Go to Sign In
            </Link>
          </div>
        )}
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
    marginBottom: '1.5rem',
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
};
