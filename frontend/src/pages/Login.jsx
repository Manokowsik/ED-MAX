import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { login } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Alert, Spinner } from '../components/ui';

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  STUDENT: 'STUDENT',
});

const ROUTES = Object.freeze({
  ADMIN_DASHBOARD: '/admin/dashboard',
  STUDENT_DASHBOARD: '/student/dashboard',
  VERIFY_EMAIL: '/verify-email',
  SIGNUP: '/signup',
  FORGOT_PASSWORD: '/forgot-password',
});

const ERROR_MESSAGES = Object.freeze({
  REQUIRED_EMAIL: 'Email is required.',
  REQUIRED_PASSWORD: 'Password is required.',
  ACCOUNT_NOT_FOUND: 'Account does not exist. Please check your email address or contact your administrator.',
  INVALID_CREDENTIALS: 'Invalid password. Please try again.',
  ACCOUNT_INACTIVE: 'Account is inactive or disabled. Please contact your administrator.',
  UNVERIFIED: 'Email not verified. Please verify your email before logging in.',
  NETWORK_ERROR: 'Unable to connect to the server. Please check your connection.',
  UNKNOWN_ROLE: 'Unknown user role. Please contact support.',
  GENERIC: 'Login failed. Please try again.',
});

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Pure function to validate login form.
 * @param {{ email: string, password: string }} data 
 * @returns {Record<string, string>}
 */
const validateLoginForm = (data) => {
  const errors = {};
  if (!data.email.trim()) errors.email = ERROR_MESSAGES.REQUIRED_EMAIL;
  if (!data.password) errors.password = ERROR_MESSAGES.REQUIRED_PASSWORD;
  return errors;
};

/**
 * Maps raw API error messages to standardized UI messages.
 * @param {string} rawMessage 
 * @returns {string}
 */
const parseApiError = (rawMessage) => {
  const lowerMsg = (rawMessage || '').toLowerCase();
  
  if (/(account does not exist|user not found|not found|does not exist|no account)/.test(lowerMsg)) {
    return ERROR_MESSAGES.ACCOUNT_NOT_FOUND;
  }
  if (/(invalid password|incorrect password)/.test(lowerMsg)) {
    return ERROR_MESSAGES.INVALID_CREDENTIALS;
  }
  if (/(inactive|disabled)/.test(lowerMsg)) {
    return ERROR_MESSAGES.ACCOUNT_INACTIVE;
  }
  if (/not verified/.test(lowerMsg)) {
    return ERROR_MESSAGES.UNVERIFIED;
  }
  if (/(network|fetch)/.test(lowerMsg)) {
    return ERROR_MESSAGES.NETWORK_ERROR;
  }
  return rawMessage || ERROR_MESSAGES.GENERIC;
};

// ============================================================================
// CUSTOM HOOK: Business Logic
// ============================================================================

function useLoginLogic() {
  const { loginSuccess } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [formErrors, setFormErrors] = useState({});
  const [globalError, setGlobalError] = useState(() => sessionStorage.getItem('auth_error') || '');
  const [loading, setLoading] = useState(false);

  // Clean up session storage safely outside of the render cycle
  useEffect(() => {
    if (sessionStorage.getItem('auth_error')) {
      sessionStorage.removeItem('auth_error');
    }
  }, []);

  const infoMessage = location.state?.message || '';
  const from = location.state?.from?.pathname;

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: '' }));
    }
  }, [formErrors]);

  const handleLogin = useCallback(async (e) => {
    e.preventDefault();
    setGlobalError('');
    setFormErrors({});

    const validationErrors = validateLoginForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setFormErrors(validationErrors);
      return;
    }

    if (loading) return;
    setLoading(true);

    try {
      const result = await login(formData.email.trim(), formData.password);
      loginSuccess(result.access_token, result.user);

      // Determine routing strategy
      if (from && !from.startsWith('/login')) {
        navigate(from, { replace: true });
      } else if (result.user.role === ROLES.ADMIN) {
        navigate(ROUTES.ADMIN_DASHBOARD, { replace: true });
      } else if (result.user.role === ROLES.STUDENT) {
        navigate(ROUTES.STUDENT_DASHBOARD, { replace: true });
      } else {
        setGlobalError(ERROR_MESSAGES.UNKNOWN_ROLE);
      }
    } catch (err) {
      setGlobalError(parseApiError(err.message));
    } finally {
      setLoading(false);
    }
  }, [formData, loading, from, navigate, loginSuccess]);

  const clearGlobalError = useCallback(() => setGlobalError(''), []);

  // Derived state for specific error UI renders
  const isUnverifiedError = globalError === ERROR_MESSAGES.UNVERIFIED;
  const isNotExistError = globalError === ERROR_MESSAGES.ACCOUNT_NOT_FOUND;

  return {
    formData,
    formErrors,
    globalError,
    infoMessage,
    loading,
    isUnverifiedError,
    isNotExistError,
    handleChange,
    handleLogin,
    clearGlobalError,
    navigate,
  };
}

// ============================================================================
// MAIN COMPONENT (UI Layer only)
// ============================================================================

export default function Login() {
  const {
    formData,
    formErrors,
    globalError,
    infoMessage,
    loading,
    isUnverifiedError,
    isNotExistError,
    handleChange,
    handleLogin,
    clearGlobalError,
    navigate,
  } = useLoginLogic();

  return (
    <div className="login-page">
      <div className="login-card" style={STYLES.card}>
        
        {/* Brand Header */}
        <header style={STYLES.brand}>
          <div className="login-brand-icon">
            ⚡
          </div>
          <h1 style={STYLES.brandName}>ED-MAX</h1>
          <p style={STYLES.brandSub}>Employee Training &amp; Learning Platform</p>
        </header>

        {/* Form Container */}
        <form onSubmit={handleLogin} noValidate>
          
          {/* Notifications */}
          {infoMessage && <Alert type="success" aria-live="polite">{infoMessage}</Alert>}
          {globalError && (
            <Alert type="error" onClose={clearGlobalError} aria-live="assertive">
              {globalError}
            </Alert>
          )}

          {/* Conditional Action Buttons based on Error Type */}
          {isUnverifiedError && (
            <div style={STYLES.actionBox}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => navigate(ROUTES.VERIFY_EMAIL, { state: { email: formData.email.trim() } })}
              >
                Verify your email now →
              </button>
            </div>
          )}

          {isNotExistError && (
            <div style={STYLES.actionBox}>
              <Link to={ROUTES.SIGNUP} className="btn btn-outline btn-sm" style={STYLES.inlineLinkBlock}>
                Create an admin account →
              </Link>
            </div>
          )}

          {/* Email Input */}
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              className={`form-input ${formErrors.email ? 'error' : ''}`}
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleChange}
              autoComplete="email"
              required
              disabled={loading}
              aria-invalid={!!formErrors.email}
              aria-describedby={formErrors.email ? "email-error" : undefined}
            />
            {formErrors.email && <div id="email-error" className="form-error" role="alert">{formErrors.email}</div>}
          </div>

          {/* Password Input */}
          <div className="form-group">
            <div className="flex justify-between items-center mb-1">
              <label className="form-label" htmlFor="password" style={{ margin: 0 }}>Password</label>
              <Link to={ROUTES.FORGOT_PASSWORD} style={STYLES.forgotPasswordLink}>
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              className={`form-input ${formErrors.password ? 'error' : ''}`}
              placeholder="Enter your password"
              value={formData.password}
              onChange={handleChange}
              autoComplete="current-password"
              required
              disabled={loading}
              aria-invalid={!!formErrors.password}
              aria-describedby={formErrors.password ? "password-error" : undefined}
            />
            {formErrors.password && <div id="password-error" className="form-error" role="alert">{formErrors.password}</div>}
          </div>

          {/* Submit Button */}
          <button
            id="login-btn"
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            style={{ marginTop: 'var(--space-2)' }}
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? (
              <span className="flex items-center gap-2 justify-center">
                <Spinner /> Signing in…
              </span>
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        {/* Footer */}
        <footer style={STYLES.footerContainer}>
          <p style={STYLES.footerText}>
            Your credentials are provided by your administrator.
          </p>
          <p style={STYLES.signupLink}>
            Need an admin account?{' '}
            <Link to={ROUTES.SIGNUP} style={STYLES.primaryBoldLink}>Sign up</Link>
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
    minHeight: '100dvh',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'clamp(1rem, 4vw, 2rem)',
    width: '100%',
    boxSizing: 'border-box',
  },
  card: {
    width: '100%',
    maxWidth: '420px',
    margin: 'auto',
    background: '#ffffff',
    padding: 'clamp(1.5rem, 5vw, 2.5rem)',
    borderRadius: '1.25rem',
    border: '1px solid rgba(226, 232, 240, 0.8)',
    boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35), 0 10px 20px -5px rgba(0, 0, 0, 0.04)',
    boxSizing: 'border-box',
  },
  brand: {
    textAlign: 'center',
    marginBottom: '1.75rem',
  },
  brandName: {
    fontSize: '1.75rem',
    fontWeight: 800,
    color: '#0f172a',
    letterSpacing: '-0.03em',
    margin: 0,
  },
  brandSub: {
    fontSize: '0.875rem',
    color: '#64748b',
    margin: '0.35rem 0 0',
    fontWeight: 500,
  },
  actionBox: {
    marginBottom: '1rem',
    textAlign: 'center',
  },
  inlineLinkBlock: {
    textDecoration: 'none',
    display: 'inline-block',
  },
  forgotPasswordLink: {
    fontSize: '0.8125rem',
    color: 'var(--primary)',
    fontWeight: 600,
    textDecoration: 'none',
    transition: 'color 0.15s ease',
  },
  footerContainer: {
    marginTop: '1.75rem',
    paddingTop: '1.25rem',
    borderTop: '1px solid #f1f5f9',
  },
  footerText: {
    textAlign: 'center',
    fontSize: '0.75rem',
    color: '#94a3b8',
    margin: 0,
  },
  signupLink: {
    marginTop: '0.75rem',
    textAlign: 'center',
    fontSize: '0.8125rem',
    color: '#64748b',
    margin: '0.65rem 0 0',
  },
  primaryBoldLink: {
    color: 'var(--primary)',
    fontWeight: 700,
  },
});