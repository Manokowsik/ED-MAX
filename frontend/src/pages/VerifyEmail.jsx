import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { verifyEmail, resendOtp } from '../services/api';
import { Alert, Spinner } from '../components/ui';

export default function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation();

  const initialEmail = location.state?.email || sessionStorage.getItem('pending_verify_email') || '';
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((c) => c - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  async function handleVerify(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email.trim()) {
      setError('Please provide your email address.');
      return;
    }
    if (!otp.trim() || otp.trim().length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      await verifyEmail(email.trim(), otp.trim());
      sessionStorage.removeItem('pending_verify_email');
      setSuccess('Email verified successfully! Redirecting to login…');
      setTimeout(() => {
        navigate('/login', { state: { message: 'Email verified successfully! You can now log in.' } });
      }, 2000);
    } catch (err) {
      setError(err.message || 'Verification failed. Please check the code and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0 || resending) return;
    setError('');
    setSuccess('');

    if (!email.trim()) {
      setError('Please provide your email address to resend code.');
      return;
    }

    setResending(true);
    try {
      const res = await resendOtp(email.trim());
      setSuccess(res.message || 'A new verification code has been sent.');
      setCooldown(60);
    } catch (err) {
      setError(err.message || 'Failed to resend verification code.');
    } finally {
      setResending(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.brand}>
          <div style={styles.brandLogo}>🎓</div>
          <h1 style={styles.brandName}>ED-MAX</h1>
          <p style={styles.brandSub}>Verify Your Email</p>
        </div>

        <form onSubmit={handleVerify} noValidate>
          {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}
          {success && <Alert type="success" onClose={() => setSuccess('')}>{success}</Alert>}

          <div className="form-group">
            <label className="form-label" htmlFor="verify-email">Email address</label>
            <input
              id="verify-email"
              type="email"
              className="form-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading || resending}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="verify-otp">6-Digit Verification Code</label>
            <input
              id="verify-otp"
              type="text"
              className="form-input"
              placeholder="123456"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              style={{ letterSpacing: '4px', fontSize: '1.25rem', textAlign: 'center', fontWeight: 600 }}
              required
              disabled={loading}
            />
          </div>

          <button
            id="verify-btn"
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            style={{ marginTop: 'var(--space-2)' }}
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-2 justify-center">
                <Spinner /> Verifying…
              </span>
            ) : 'Verify Code'}
          </button>
        </form>

        <div style={styles.resendSection}>
          <p style={styles.resendText}>
            Didn’t receive the code?
          </p>
          <button
            id="resend-btn"
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleResend}
            disabled={cooldown > 0 || resending}
          >
            {resending ? <Spinner /> : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
          </button>
        </div>

        <p style={styles.footer}>
          Back to <Link to="/login" style={styles.link}>Sign in</Link>
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
  resendSection: {
    marginTop: '1.5rem',
    paddingTop: '1rem',
    borderTop: '1px solid var(--gray-200)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resendText: {
    fontSize: '0.8125rem',
    color: 'var(--gray-500)',
    margin: 0,
  },
  footer: {
    marginTop: '1.5rem',
    textAlign: 'center',
    fontSize: '0.8125rem',
    color: 'var(--gray-500)',
  },
  link: {
    color: 'var(--primary)',
    fontWeight: 600,
    textDecoration: 'none',
  },
};
