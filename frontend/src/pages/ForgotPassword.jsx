import { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../services/api';
import { Alert, Spinner } from '../components/ui';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await forgotPassword(email.trim());
      setSuccess(res.message || 'If an account with that email exists, password reset instructions have been sent.');
    } catch (err) {
      setError(err.message || 'Failed to submit request. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.brand}>
          <div style={styles.brandLogo}>🎓</div>
          <h1 style={styles.brandName}>ED-MAX</h1>
          <p style={styles.brandSub}>Reset Your Password</p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}
          {success && <Alert type="success">{success}</Alert>}

          {!success && (
            <>
              <p style={styles.instruction}>
                Enter the email address associated with your account and we’ll send you a link to reset your password.
              </p>

              <div className="form-group">
                <label className="form-label" htmlFor="forgot-email">Email address</label>
                <input
                  id="forgot-email"
                  type="email"
                  className="form-input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <button
                id="forgot-submit-btn"
                type="submit"
                className="btn btn-primary btn-full btn-lg"
                style={{ marginTop: 'var(--space-2)' }}
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2 justify-center">
                    <Spinner /> Sending link…
                  </span>
                ) : 'Send Reset Link'}
              </button>
            </>
          )}
        </form>

        <p style={styles.footer}>
          Remembered your password?{' '}
          <Link to="/login" style={styles.link}>Sign in</Link>
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
  instruction: {
    fontSize: '0.875rem',
    color: 'var(--gray-600)',
    lineHeight: 1.5,
    marginBottom: '1.25rem',
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
