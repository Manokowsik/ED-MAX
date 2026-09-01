import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { validateInvitationToken, acceptInvitation } from '../services/api';
import { Alert, Spinner } from '../components/ui';

/**
 * AcceptInvitation page — /accept-invitation?token=...
 *
 * Handles the "existing user added to a new org" flow.
 * The user already has an account and password; they only need to click "Accept".
 */
export default function AcceptInvitation() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [validating, setValidating] = useState(true);
  const [info, setInfo] = useState(null);         // { user, organization }
  const [tokenError, setTokenError] = useState('');

  const [accepting, setAccepting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setTokenError('Invalid or missing invitation link.');
      setValidating(false);
      return;
    }

    async function checkToken() {
      try {
        const res = await validateInvitationToken(token);
        setInfo(res);
      } catch (err) {
        setTokenError(err.message || 'Invalid, expired, or already used invitation link.');
      } finally {
        setValidating(false);
      }
    }

    checkToken();
  }, [token]);

  async function handleAccept() {
    setError('');
    setAccepting(true);
    try {
      const res = await acceptInvitation(token);
      setSuccess(res.message || `You've successfully joined ${info?.organization?.name || 'the organization'}. You can now sign in.`);
      setInfo(null);
    } catch (err) {
      setError(err.message || 'Failed to accept invitation. Please try again.');
    } finally {
      setAccepting(false);
    }
  }

  if (validating) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <Spinner />
            <p style={{ marginTop: '1rem', color: 'var(--gray-600)' }}>Validating invitation…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Brand */}
        <div style={styles.brand}>
          <div style={styles.brandLogo}>🎓</div>
          <h1 style={styles.brandName}>ED-MAX</h1>
          <p style={styles.brandSub}>
            {success ? 'Invitation Accepted' : tokenError ? 'Invitation Error' : 'Organization Invitation'}
          </p>
        </div>

        {/* ── Success state ── */}
        {success && (
          <div>
            <Alert type="success">{success}</Alert>
            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <Link to="/login" className="btn btn-primary btn-full">
                Sign In to Your Account
              </Link>
            </div>
          </div>
        )}

        {/* ── Token invalid / expired state ── */}
        {tokenError && !success && (
          <div>
            <Alert type="error">{tokenError}</Alert>
            <p style={styles.helpText}>
              This invitation link may have expired or already been used. Please ask your administrator to resend the invitation.
            </p>
            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <Link to="/login" style={styles.link}>Go to Sign In</Link>
            </div>
          </div>
        )}

        {/* ── Accept invitation form ── */}
        {info && !success && (
          <div>
            <div style={styles.infoBox}>
              <p style={styles.welcomeText}>
                Welcome back, <strong>{info.user?.name}</strong>!
              </p>
              <p style={styles.subText}>
                You've been invited to join{' '}
                <strong>{info.organization?.name}</strong> on ED-MAX.
              </p>
              <p style={styles.subText}>
                Your existing account (<em>{info.user?.email}</em>) will be added to this organization — your password stays the same.
              </p>
            </div>

            {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

            <button
              id="accept-invitation-btn"
              className="btn btn-primary btn-full btn-lg"
              style={{ marginTop: '1.5rem' }}
              onClick={handleAccept}
              disabled={accepting}
            >
              {accepting ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                  <Spinner /> Accepting…
                </span>
              ) : `Accept Invitation & Join ${info.organization?.name || 'Organization'}`}
            </button>

            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
              <Link to="/login" style={styles.link}>Go to Sign In instead</Link>
            </div>
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
    maxWidth: '460px',
    background: '#fff',
    padding: '2.5rem',
    borderRadius: '1rem',
    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
  },
  brand: {
    textAlign: 'center',
    marginBottom: '1.75rem',
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
  infoBox: {
    background: 'var(--gray-50)',
    padding: '1.25rem',
    borderRadius: '0.5rem',
    border: '1px solid var(--gray-200)',
    marginBottom: '0.25rem',
  },
  welcomeText: {
    fontSize: '0.9375rem',
    color: 'var(--gray-900)',
    margin: '0 0 0.5rem',
  },
  subText: {
    fontSize: '0.8125rem',
    color: 'var(--gray-600)',
    margin: '0 0 0.4rem',
    lineHeight: 1.5,
  },
  helpText: {
    fontSize: '0.875rem',
    color: 'var(--gray-600)',
    marginTop: '1rem',
    lineHeight: 1.5,
    textAlign: 'center',
  },
  link: {
    color: 'var(--primary)',
    fontWeight: 600,
    textDecoration: 'none',
    fontSize: '0.875rem',
  },
};
