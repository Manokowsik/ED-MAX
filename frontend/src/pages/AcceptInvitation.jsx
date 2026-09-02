import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { validateInvitationToken, acceptInvitation } from '../services/api';
import { Alert, Spinner } from '../components/ui';

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const VIEW_STATES = Object.freeze({
  VALIDATING: 'VALIDATING',
  READY: 'READY',
  ACCEPTING: 'ACCEPTING',
  SUCCESS: 'SUCCESS',
  INVALID_TOKEN: 'INVALID_TOKEN',
});

const MESSAGES = Object.freeze({
  MISSING_OR_INVALID_LINK: 'Invalid or missing invitation link.',
  EXPIRED_OR_USED_LINK: 'Invalid, expired, or already used invitation link.',
  ACCEPT_FAILED: 'Failed to accept invitation. Please try again.',
  SUCCESS_FALLBACK: (orgName) =>
    `You've successfully joined ${orgName || 'the organization'}. You can now sign in.`,
});

// ============================================================================
// CUSTOM HOOK: Invitation Flow Business Logic
// ============================================================================

function useAcceptInvitationLogic() {
  const [searchParams] = useSearchParams();
  const rawToken = searchParams.get('token');
  const token = useMemo(() => (rawToken ? rawToken.trim() : ''), [rawToken]);

  const [viewState, setViewState] = useState(VIEW_STATES.VALIDATING);
  const [invitationInfo, setInvitationInfo] = useState(null);
  const [tokenError, setTokenError] = useState('');
  const [mutationError, setMutationError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const activeRequestId = useRef(0);

  // Validate Token on Mount or Token Change
  useEffect(() => {
    if (!token) {
      setTokenError(MESSAGES.MISSING_OR_INVALID_LINK);
      setViewState(VIEW_STATES.INVALID_TOKEN);
      return;
    }

    const currentRequestId = ++activeRequestId.current;
    setViewState(VIEW_STATES.VALIDATING);
    setTokenError('');

    async function checkToken() {
      try {
        const res = await validateInvitationToken(token);
        if (currentRequestId === activeRequestId.current) {
          setInvitationInfo(res);
          setViewState(VIEW_STATES.READY);
        }
      } catch (err) {
        if (currentRequestId === activeRequestId.current) {
          setTokenError(err.message || MESSAGES.EXPIRED_OR_USED_LINK);
          setViewState(VIEW_STATES.INVALID_TOKEN);
        }
      }
    }

    checkToken();
  }, [token]);

  // Accept Mutation
  const handleAccept = useCallback(async () => {
    if (!token) return;

    setMutationError('');
    setViewState(VIEW_STATES.ACCEPTING);

    try {
      const res = await acceptInvitation(token);
      const orgName = invitationInfo?.organization?.name;
      setSuccessMessage(res?.message || MESSAGES.SUCCESS_FALLBACK(orgName));
      setInvitationInfo(null);
      setViewState(VIEW_STATES.SUCCESS);
    } catch (err) {
      setMutationError(err.message || MESSAGES.ACCEPT_FAILED);
      setViewState(VIEW_STATES.READY);
    }
  }, [token, invitationInfo?.organization?.name]);

  const clearMutationError = useCallback(() => setMutationError(''), []);

  return {
    viewState,
    invitationInfo,
    tokenError,
    mutationError,
    successMessage,
    handleAccept,
    clearMutationError,
  };
}

// ============================================================================
// SUB-COMPONENT: Validating Spinner
// ============================================================================

const ValidatingView = React.memo(function ValidatingView() {
  return (
    <div style={STYLES.centerLoader} role="status" aria-live="polite">
      <Spinner />
      <p style={STYLES.loaderText}>Validating invitation…</p>
    </div>
  );
});

// ============================================================================
// SUB-COMPONENT: Success Screen
// ============================================================================

const SuccessView = React.memo(function SuccessView({ message }) {
  return (
    <div>
      <Alert type="success" aria-live="polite">
        {message}
      </Alert>
      <div style={STYLES.signInActionWrapper}>
        <Link to="/login" className="btn btn-primary btn-full">
          Sign In to Your Account
        </Link>
      </div>
    </div>
  );
});

// ============================================================================
// SUB-COMPONENT: Token Error Screen
// ============================================================================

const TokenErrorView = React.memo(function TokenErrorView({ errorMessage }) {
  return (
    <div>
      <Alert type="error" aria-live="assertive">
        {errorMessage}
      </Alert>
      <p style={STYLES.helpText}>
        This invitation link may have expired or already been used. Please ask your
        organization administrator to resend the invitation.
      </p>
      <div style={STYLES.signInActionWrapper}>
        <Link to="/login" style={STYLES.link}>
          Go to Sign In
        </Link>
      </div>
    </div>
  );
});

// ============================================================================
// SUB-COMPONENT: Invitation Confirmation Form
// ============================================================================

const AcceptFormView = React.memo(function AcceptFormView({
  info,
  isAccepting,
  mutationError,
  onAccept,
  onClearError,
}) {
  const userName = info?.user?.name || 'User';
  const userEmail = info?.user?.email || '';
  const orgName = info?.organization?.name || 'Organization';

  return (
    <div>
      <section style={STYLES.infoBox} aria-label="Invitation Overview">
        <p style={STYLES.welcomeText}>
          Welcome back, <strong>{userName}</strong>!
        </p>
        <p style={STYLES.subText}>
          You have been invited to join <strong>{orgName}</strong> on ED-MAX.
        </p>
        <p style={STYLES.subText}>
          Your existing account (<em>{userEmail}</em>) will be connected to this organization — your password stays unchanged.
        </p>
      </section>

      {mutationError && (
        <Alert type="error" onClose={onClearError} aria-live="assertive">
          {mutationError}
        </Alert>
      )}

      <button
        id="accept-invitation-btn"
        type="button"
        className="btn btn-primary btn-full btn-lg"
        style={STYLES.submitButton}
        onClick={onAccept}
        disabled={isAccepting}
        aria-busy={isAccepting}
      >
        {isAccepting ? (
          <span style={STYLES.spinnerRow}>
            <Spinner /> Accepting…
          </span>
        ) : (
          `Accept Invitation & Join ${orgName}`
        )}
      </button>

      <div style={STYLES.secondaryActionWrapper}>
        <Link to="/login" style={STYLES.link}>
          Go to Sign In instead
        </Link>
      </div>
    </div>
  );
});

// ============================================================================
// MAIN VIEW COMPONENT
// ============================================================================

export default function AcceptInvitation() {
  const {
    viewState,
    invitationInfo,
    tokenError,
    mutationError,
    successMessage,
    handleAccept,
    clearMutationError,
  } = useAcceptInvitationLogic();

  const brandSubtitle = useMemo(() => {
    switch (viewState) {
      case VIEW_STATES.SUCCESS:
        return 'Invitation Accepted';
      case VIEW_STATES.INVALID_TOKEN:
        return 'Invitation Error';
      default:
        return 'Organization Invitation';
    }
  }, [viewState]);

  return (
    <div style={STYLES.page}>
      <main style={STYLES.card}>
        {/* Brand Header */}
        <header style={STYLES.brand}>
          <div style={STYLES.brandLogo} aria-hidden="true">
            🎓
          </div>
          <h1 style={STYLES.brandName}>ED-MAX</h1>
          <p style={STYLES.brandSub}>{brandSubtitle}</p>
        </header>

        {/* View State Router */}
        {viewState === VIEW_STATES.VALIDATING && <ValidatingView />}

        {viewState === VIEW_STATES.SUCCESS && (
          <SuccessView message={successMessage} />
        )}

        {viewState === VIEW_STATES.INVALID_TOKEN && (
          <TokenErrorView errorMessage={tokenError} />
        )}

        {(viewState === VIEW_STATES.READY || viewState === VIEW_STATES.ACCEPTING) && (
          <AcceptFormView
            info={invitationInfo}
            isAccepting={viewState === VIEW_STATES.ACCEPTING}
            mutationError={mutationError}
            onAccept={handleAccept}
            onClearError={clearMutationError}
          />
        )}
      </main>
    </div>
  );
}

// ============================================================================
// STYLES (Performance tokens frozen in memory)
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
  centerLoader: {
    textAlign: 'center',
    padding: '2rem 0',
  },
  loaderText: {
    marginTop: '1rem',
    color: 'var(--gray-600)',
  },
  signInActionWrapper: {
    marginTop: '1.5rem',
    textAlign: 'center',
  },
  secondaryActionWrapper: {
    marginTop: '1rem',
    textAlign: 'center',
  },
  infoBox: {
    background: 'var(--gray-50)',
    padding: '1.25rem',
    borderRadius: '0.5rem',
    border: '1px solid var(--gray-200)',
    marginBottom: '1rem',
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
  submitButton: {
    marginTop: '1.5rem',
  },
  spinnerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    justifyContent: 'center',
  },
  link: {
    color: 'var(--primary)',
    fontWeight: 600,
    textDecoration: 'none',
    fontSize: '0.875rem',
  },
});