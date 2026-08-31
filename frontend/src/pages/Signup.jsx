import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { adminSignup } from '../services/api';
import { Alert, Spinner } from '../components/ui';

export default function Signup() {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // ----------------------------------------------------------
  // Client-side validation
  // ----------------------------------------------------------
  function validate() {
    const errs = {};

    if (!name.trim()) errs.name = 'Full name is required.';
    if (!email.trim()) {
      errs.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Please enter a valid email address.';
    }
    if (!password) {
      errs.password = 'Password is required.';
    } else if (password.length < 8) {
      errs.password = 'Password must be at least 8 characters.';
    }
    if (!confirmPassword) {
      errs.confirmPassword = 'Please confirm your password.';
    } else if (password !== confirmPassword) {
      errs.confirmPassword = 'Passwords do not match.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ----------------------------------------------------------
  // Submit
  // ----------------------------------------------------------
  async function handleSubmit(e) {
    e.preventDefault();
    setServerError('');

    if (!validate()) return;
    if (loading) return; // prevent duplicate submissions

    setLoading(true);
    try {
      await adminSignup(name.trim(), email.trim(), password, confirmPassword);
      setSuccess(true);
    } catch (err) {
      if (err.message?.toLowerCase().includes('already exists')) {
        setServerError('An account with this email already exists.');
      } else if (err.message?.toLowerCase().includes('network') || err.message?.toLowerCase().includes('fetch')) {
        setServerError('Unable to connect to the server. Please check your connection.');
      } else {
        setServerError(err.message || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  // ----------------------------------------------------------
  // Success State
  // ----------------------------------------------------------
  if (success) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.brand}>
            <div style={styles.brandLogo}>🎓</div>
            <h1 style={styles.brandName}>ED-MAX</h1>
            <p style={styles.brandSub}>Employee Training &amp; Learning Platform</p>
          </div>

          <div style={styles.successBox}>
            <div style={styles.successIcon}>✓</div>
            <h2 style={styles.successTitle}>Account Created!</h2>
            <p style={styles.successText}>
              Your admin account has been created successfully. You can now sign in with your credentials.
            </p>
            <button
              id="goto-login-btn"
              className="btn btn-primary btn-full btn-lg"
              style={{ marginTop: 'var(--space-4)' }}
              onClick={() => navigate('/login')}
            >
              Go to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------
  // Form
  // ----------------------------------------------------------
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Brand */}
        <div style={styles.brand}>
          <div style={styles.brandLogo}>🎓</div>
          <h1 style={styles.brandName}>ED-MAX</h1>
          <p style={styles.brandSub}>Create Admin Account</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          {serverError && <Alert type="error" onClose={() => setServerError('')}>{serverError}</Alert>}

          {/* Full Name */}
          <div className="form-group">
            <label className="form-label" htmlFor="signup-name">Full name</label>
            <input
              id="signup-name"
              type="text"
              className={`form-input${errors.name ? ' error' : ''}`}
              placeholder="John Doe"
              value={name}
              onChange={e => { setName(e.target.value); if (errors.name) setErrors(p => ({ ...p, name: '' })); }}
              autoComplete="name"
              disabled={loading}
            />
            {errors.name && <div className="form-error">{errors.name}</div>}
          </div>

          {/* Email */}
          <div className="form-group">
            <label className="form-label" htmlFor="signup-email">Email address</label>
            <input
              id="signup-email"
              type="email"
              className={`form-input${errors.email ? ' error' : ''}`}
              placeholder="you@example.com"
              value={email}
              onChange={e => { setEmail(e.target.value); if (errors.email) setErrors(p => ({ ...p, email: '' })); }}
              autoComplete="email"
              disabled={loading}
            />
            {errors.email && <div className="form-error">{errors.email}</div>}
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="form-label" htmlFor="signup-password">Password</label>
            <input
              id="signup-password"
              type="password"
              className={`form-input${errors.password ? ' error' : ''}`}
              placeholder="Min. 8 characters"
              value={password}
              onChange={e => { setPassword(e.target.value); if (errors.password) setErrors(p => ({ ...p, password: '' })); }}
              autoComplete="new-password"
              disabled={loading}
            />
            {errors.password && <div className="form-error">{errors.password}</div>}
          </div>

          {/* Confirm Password */}
          <div className="form-group">
            <label className="form-label" htmlFor="signup-confirm-password">Confirm password</label>
            <input
              id="signup-confirm-password"
              type="password"
              className={`form-input${errors.confirmPassword ? ' error' : ''}`}
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={e => { setConfirmPassword(e.target.value); if (errors.confirmPassword) setErrors(p => ({ ...p, confirmPassword: '' })); }}
              autoComplete="new-password"
              disabled={loading}
            />
            {errors.confirmPassword && <div className="form-error">{errors.confirmPassword}</div>}
          </div>

          <button
            id="signup-btn"
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            style={{ marginTop: 'var(--space-2)' }}
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-2 justify-center">
                <Spinner /> Creating account…
              </span>
            ) : 'Create Account'}
          </button>
        </form>

        <p style={styles.footer}>
          Already have an account?{' '}
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
    fontSize: '0.8125rem',
    color: 'var(--gray-500)',
  },
  link: {
    color: 'var(--primary)',
    fontWeight: 600,
    textDecoration: 'none',
  },
  successBox: {
    textAlign: 'center',
    padding: '1rem 0',
  },
  successIcon: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    background: 'var(--success-light)',
    color: 'var(--success)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.5rem',
    fontWeight: 700,
    marginBottom: '1rem',
  },
  successTitle: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: 'var(--gray-900)',
    margin: '0 0 0.5rem',
  },
  successText: {
    fontSize: '0.875rem',
    color: 'var(--gray-500)',
    lineHeight: 1.6,
    margin: 0,
  },
};
