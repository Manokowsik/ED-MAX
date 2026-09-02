import React, { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { adminSignup } from '../services/api';
import { Alert, Spinner } from '../components/ui';

// ============================================================================
// CONSTANTS & UTILITIES
// ============================================================================

const INITIAL_FORM_STATE = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
};

const ERROR_MESSAGES = {
  REQUIRED_NAME: 'Full name is required.',
  REQUIRED_EMAIL: 'Email is required.',
  INVALID_EMAIL: 'Please enter a valid email address.',
  REQUIRED_PASSWORD: 'Password is required.',
  SHORT_PASSWORD: 'Password must be at least 8 characters.',
  REQUIRED_CONFIRM: 'Please confirm your password.',
  MISMATCH_PASSWORD: 'Passwords do not match.',
  NETWORK_ERROR: 'Unable to connect to the server. Please check your connection.',
  ACCOUNT_EXISTS: 'An account with this email already exists.',
  GENERIC_ERROR: 'Registration failed. Please try again.',
};

/**
 * Pure function for form validation. Easy to unit test independently.
 * @param {typeof INITIAL_FORM_STATE} data 
 * @returns {Record<string, string>}
 */
const validateSignupForm = (data) => {
  const errors = {};
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!data.name.trim()) errors.name = ERROR_MESSAGES.REQUIRED_NAME;
  
  if (!data.email.trim()) {
    errors.email = ERROR_MESSAGES.REQUIRED_EMAIL;
  } else if (!emailRegex.test(data.email.trim())) {
    errors.email = ERROR_MESSAGES.INVALID_EMAIL;
  }

  if (!data.password) {
    errors.password = ERROR_MESSAGES.REQUIRED_PASSWORD;
  } else if (data.password.length < 8) {
    errors.password = ERROR_MESSAGES.SHORT_PASSWORD;
  }

  if (!data.confirmPassword) {
    errors.confirmPassword = ERROR_MESSAGES.REQUIRED_CONFIRM;
  } else if (data.password !== data.confirmPassword) {
    errors.confirmPassword = ERROR_MESSAGES.MISMATCH_PASSWORD;
  }

  return errors;
};

// ============================================================================
// CUSTOM HOOK: Business Logic Separation
// ============================================================================

function useSignupLogic() {
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Grouped change handler prevents creating multiple inline functions
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Clear specific field error on typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  }, [errors]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setServerError('');
    
    const validationErrors = validateSignupForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    if (loading) return;

    setLoading(true);
    try {
      await adminSignup(
        formData.name.trim(),
        formData.email.trim(),
        formData.password,
        formData.confirmPassword
      );
      setIsSuccess(true);
    } catch (err) {
      const errorMessage = err.message?.toLowerCase() || '';
      if (errorMessage.includes('already exists')) {
        setServerError(ERROR_MESSAGES.ACCOUNT_EXISTS);
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        setServerError(ERROR_MESSAGES.NETWORK_ERROR);
      } else {
        setServerError(err.message || ERROR_MESSAGES.GENERIC_ERROR);
      }
    } finally {
      setLoading(false);
    }
  }, [formData, loading]);

  const clearServerError = useCallback(() => setServerError(''), []);

  return {
    formData,
    errors,
    serverError,
    loading,
    isSuccess,
    handleChange,
    handleSubmit,
    clearServerError,
  };
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const SuccessView = ({ email }) => {
  const navigate = useNavigate();

  return (
    <div style={STYLES.page}>
      <div style={STYLES.card}>
        <div style={STYLES.brand}>
          <div style={STYLES.brandLogo}>🎓</div>
          <h1 style={STYLES.brandName}>ED-MAX</h1>
          <p style={STYLES.brandSub}>Employee Training &amp; Learning Platform</p>
        </div>

        <div style={STYLES.successBox}>
          <div style={STYLES.successIcon}>📧</div>
          <h2 style={STYLES.successTitle}>Account Created!</h2>
          <p style={STYLES.successText}>
            Your admin account has been created. A verification code (OTP) has been sent to <strong>{email}</strong>.
          </p>
          <button
            id="goto-verify-btn"
            className="btn btn-primary btn-full btn-lg"
            style={{ marginTop: 'var(--space-4)' }}
            onClick={() => navigate('/verify-email', { state: { email } })}
          >
            Verify Email Now
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT (UI Layer only)
// ============================================================================

export default function Signup() {
  const {
    formData,
    errors,
    serverError,
    loading,
    isSuccess,
    handleChange,
    handleSubmit,
    clearServerError,
  } = useSignupLogic();

  if (isSuccess) {
    return <SuccessView email={formData.email.trim()} />;
  }

  return (
    <div style={STYLES.page}>
      <div style={STYLES.card}>
        {/* Brand Header */}
        <header style={STYLES.brand}>
          <div style={STYLES.brandLogo}>🎓</div>
          <h1 style={STYLES.brandName}>ED-MAX</h1>
          <p style={STYLES.brandSub}>Create Admin Account</p>
        </header>

        {/* Signup Form */}
        <form onSubmit={handleSubmit} noValidate>
          {serverError && (
            <Alert type="error" onClose={clearServerError} aria-live="assertive">
              {serverError}
            </Alert>
          )}

          {/* Full Name */}
          <div className="form-group">
            <label className="form-label" htmlFor="signup-name">Full name</label>
            <input
              id="signup-name"
              name="name"
              type="text"
              className={`form-input ${errors.name ? 'error' : ''}`}
              placeholder="John Doe"
              value={formData.name}
              onChange={handleChange}
              autoComplete="name"
              disabled={loading}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "name-error" : undefined}
            />
            {errors.name && <div id="name-error" className="form-error" role="alert">{errors.name}</div>}
          </div>

          {/* Email */}
          <div className="form-group">
            <label className="form-label" htmlFor="signup-email">Email address</label>
            <input
              id="signup-email"
              name="email"
              type="email"
              className={`form-input ${errors.email ? 'error' : ''}`}
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleChange}
              autoComplete="email"
              disabled={loading}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email-error" : undefined}
            />
            {errors.email && <div id="email-error" className="form-error" role="alert">{errors.email}</div>}
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="form-label" htmlFor="signup-password">Password</label>
            <input
              id="signup-password"
              name="password"
              type="password"
              className={`form-input ${errors.password ? 'error' : ''}`}
              placeholder="Min. 8 characters"
              value={formData.password}
              onChange={handleChange}
              autoComplete="new-password"
              disabled={loading}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? "password-error" : undefined}
            />
            {errors.password && <div id="password-error" className="form-error" role="alert">{errors.password}</div>}
          </div>

          {/* Confirm Password */}
          <div className="form-group">
            <label className="form-label" htmlFor="signup-confirm-password">Confirm password</label>
            <input
              id="signup-confirm-password"
              name="confirmPassword"
              type="password"
              className={`form-input ${errors.confirmPassword ? 'error' : ''}`}
              placeholder="Re-enter your password"
              value={formData.confirmPassword}
              onChange={handleChange}
              autoComplete="new-password"
              disabled={loading}
              aria-invalid={!!errors.confirmPassword}
              aria-describedby={errors.confirmPassword ? "confirm-password-error" : undefined}
            />
            {errors.confirmPassword && <div id="confirm-password-error" className="form-error" role="alert">{errors.confirmPassword}</div>}
          </div>

          {/* Submit Button */}
          <button
            id="signup-btn"
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            style={{ marginTop: 'var(--space-2)' }}
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? (
              <span className="flex items-center gap-2 justify-center">
                <Spinner /> Creating account…
              </span>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <footer style={STYLES.footer}>
          <p>
            Already have an account?{' '}
            <Link to="/login" style={STYLES.link}>Sign in</Link>
          </p>
        </footer>
      </div>
    </div>
  );
}

// ============================================================================
// STYLES (Frozen to prevent re-creation on render)
// ============================================================================
const STYLES = Object.freeze({
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
});