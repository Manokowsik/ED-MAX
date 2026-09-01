import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { validateActivationToken, activateAccount, resendActivation } from '../services/api';
import { Alert, Spinner } from '../components/ui';

export default function ActivateAccount() {
  const { token: paramToken } = useParams();
  const [searchParams] = useSearchParams();

  // Accept token from query param (?token=) or path param (/:token)
  const token = searchParams.get('token') || paramToken || '';

  const [validating, setValidating] = useState(true);
  const [studentInfo, setStudentInfo] = useState(null);
  const [tokenError, setTokenError] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Resend section
  const [resendEmail, setResendEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [resendError, setResendError] = useState('');

  useEffect(() => {
    if (!token) {
      setTokenError('Invalid or missing account activation link.');
      setValidating(false);
      return;
    }

    async function checkToken() {
      try {
        const res = await validateActivationToken(token);
        setStudentInfo(res.user);
      } catch (err) {
        setTokenError(err.message || 'Invalid, expired, or already used activation token.');
      } finally {
        setValidating(false);
      }
    }

    checkToken();
  }, [token]);

  async function handleActivate(e) {
    e.preventDefault();
    setError('');

    if (!password) {
      setError('Please choose a password.');
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
      await activateAccount(token, password, confirmPassword);
      // Do NOT auto-login — spec requires student to sign in manually.
      setSuccess('Account activated successfully. You can now sign in.');
      setStudentInfo(null);
    } catch (err) {
      setError(err.message || 'Account activation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend(e) {
    e.preventDefault();
    setResendError('');
    setResendMessage('');

    if (!resendEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resendEmail.trim())) {
      setResendError('Please enter a valid email address.');
      return;
    }

    setResendLoading(true);
    try {
      const res = await resendActivation(resendEmail.trim());
      setResendMessage(res.message || 'If a pending account exists, a new activation email has been sent.');
    } catch (err) {
      if (err.message && err.message.toLowerCase().includes('wait')) {
        setResendError(err.message);
      } else {
        setResendMessage('If a pending account exists, a new activation email has been sent.');
      }
    } finally {
      setResendLoading(false);
    }
  }

  if (validating) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <Spinner />
            <p style={{ marginTop: '1rem', color: 'var(--gray-600)' }}>Validating invitation link…</p>
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
          <p style={styles.brandSub}>
            {success ? 'Account Activated' : 'Activate Your Account'}
          </p>
        </div>

        {/* ── Success state ── */}
        {success && (
          <div>
            <Alert type="success">{success}</Alert>
            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <Link to="/login" className="btn btn-primary btn-full">
                Go to Login
              </Link>
            </div>
          </div>
        )}

        {/* ── Token invalid / expired state ── */}
        {tokenError && !success && (
          <div>
            <Alert type="error">{tokenError}</Alert>

            <div style={styles.resendBox}>
              <p style={styles.resendTitle}>Didn't receive the email or link expired?</p>
              <p style={styles.resendSub}>
                Enter your email address below and we'll send a new activation link.
              </p>

              {resendMessage && <Alert type="success">{resendMessage}</Alert>}
              {resendError && <Alert type="error" onClose={() => setResendError('')}>{resendError}</Alert>}

              {!resendMessage && (
                <form onSubmit={handleResend} noValidate>
                  <div className="form-group">
                    <label className="form-label" htmlFor="resend-email">Email address</label>
                    <input
                      id="resend-email"
                      type="email"
                      className="form-input"
                      placeholder="you@example.com"
                      value={resendEmail}
                      onChange={e => setResendEmail(e.target.value)}
                      disabled={resendLoading}
                      required
                    />
                  </div>
                  <button
                    id="resend-activation-btn"
                    type="submit"
                    className="btn btn-outline btn-full"
                    disabled={resendLoading}
                  >
                    {resendLoading ? (
                      <span className="flex items-center gap-2 justify-center">
                        <Spinner /> Sending…
                      </span>
                    ) : 'Resend Activation Email'}
                  </button>
                </form>
              )}
            </div>

            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
              <Link to="/login" style={styles.link}>Go to Sign In</Link>
            </div>
          </div>
        )}

        {/* ── Activation form ── */}
        {studentInfo && !success && (
          <div>
            <div style={styles.welcomeBox}>
              <p style={styles.welcomeText}>
                Welcome <strong>{studentInfo.name}</strong>!
              </p>
              <p style={styles.subText}>
                Your account has been created by an administrator. Please set a password to activate your account.
              </p>
            </div>

            {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

            <form onSubmit={handleActivate} noValidate>
              <div className="form-group">
                <label className="form-label" htmlFor="act-email">Email address</label>
                <input
                  id="act-email"
                  type="email"
                  className="form-input"
                  value={studentInfo.email}
                  disabled
                  readOnly
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="act-password">New Password</label>
                <input
                  id="act-password"
                  type="password"
                  className="form-input"
                  placeholder="Minimum 8 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="act-confirm-password">Confirm Password</label>
                <input
                  id="act-confirm-password"
                  type="password"
                  className="form-input"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <button
                id="activate-submit-btn"
                type="submit"
                className="btn btn-primary btn-full btn-lg"
                style={{ marginTop: 'var(--space-2)' }}
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2 justify-center">
                    <Spinner /> Activating Account…
                  </span>
                ) : 'Set Password & Activate Account'}
              </button>
            </form>
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
    maxWidth: '440px',
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
  welcomeBox: {
    background: 'var(--gray-50)',
    padding: '1rem',
    borderRadius: '0.5rem',
    marginBottom: '1.25rem',
    border: '1px solid var(--gray-200)',
  },
  welcomeText: {
    fontSize: '0.9375rem',
    color: 'var(--gray-900)',
    margin: '0 0 0.25rem',
  },
  subText: {
    fontSize: '0.8125rem',
    color: 'var(--gray-600)',
    margin: 0,
    lineHeight: 1.4,
  },
  resendBox: {
    marginTop: '1.5rem',
    padding: '1.25rem',
    background: 'var(--gray-50)',
    borderRadius: '0.5rem',
    border: '1px solid var(--gray-200)',
  },
  resendTitle: {
    fontSize: '0.9375rem',
    fontWeight: 600,
    color: 'var(--gray-900)',
    margin: '0 0 0.25rem',
  },
  resendSub: {
    fontSize: '0.8125rem',
    color: 'var(--gray-600)',
    margin: '0 0 1rem',
    lineHeight: 1.4,
  },
  link: {
    color: 'var(--primary)',
    fontWeight: 600,
    textDecoration: 'none',
    fontSize: '0.875rem',
  },
};
