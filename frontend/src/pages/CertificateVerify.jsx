import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { verifyCertificate } from '../services/api';

// ============================================================
// Helpers
// ============================================================
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

// ============================================================
// Certificate Verify Page — public, no login required
// ============================================================
export default function CertificateVerify() {
  const { certNumber } = useParams();
  const navigate = useNavigate();
  const [inputCode, setInputCode] = useState(certNumber || '');
  const [loading, setLoading] = useState(Boolean(certNumber));
  const [cert, setCert] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleBack() {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/');
  }

  function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: `Certificate of Completion - ${cert?.student_name || 'Student'}`,
        text: `Check out ${cert?.student_name || 'Student'}'s verified certificate for ${cert?.course_title || 'Course'} on ED-MAX!`,
        url: url,
      }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  }

  useEffect(() => {
    if (!certNumber) {
      setLoading(false);
      setCert(null);
      setNotFound(false);
      return;
    }
    setInputCode(certNumber);
    setLoading(true);
    setNotFound(false);
    verifyCertificate(certNumber)
      .then((res) => {
        if (res.valid && res.certificate) {
          setCert(res.certificate);
        } else {
          setCert(null);
          setNotFound(true);
        }
      })
      .catch(() => {
        setCert(null);
        setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [certNumber]);

  function handleSearchSubmit(e) {
    e.preventDefault();
    if (!inputCode.trim()) return;
    navigate(`/verify/${encodeURIComponent(inputCode.trim().toUpperCase())}`);
  }

  // ── Shared page shell ────────────────────────────────────────
  const shell = (content) => (
    <div style={styles.page}>
      {/* Top bar */}
      <div style={styles.topBar}>
        <div style={styles.logo} onClick={() => navigate('/')} style={{ cursor: 'pointer', ...styles.logo }}>ED-MAX</div>
        <button type="button" onClick={handleBack} style={styles.backLink}>
          ← Back
        </button>
      </div>

      {/* Body */}
      <div style={styles.body}>
        {content}
      </div>

      <p style={styles.footer}>
        ED-MAX Training Platform · Certificate Verification System
      </p>
    </div>
  );

  // ── Search Form Component ───────────────────────────────────
  const renderSearchForm = () => (
    <div style={styles.card}>
      <div style={{ fontSize: '3rem', marginBottom: 'var(--space-2)' }}>🎓</div>
      <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: '#1e293b', marginBottom: 'var(--space-2)' }}>
        Verify Credential & Certificate
      </h1>
      <p style={{ color: 'var(--gray-500)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-6)', maxWidth: 500, margin: '0 auto var(--space-6)' }}>
        Enter an official Certificate Number or ID below to verify student completion records and authentic credentials.
      </p>

      <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.75rem', maxWidth: 520, margin: '0 auto', flexWrap: 'wrap', justifyContent: 'center' }}>
        <input
          type="text"
          className="form-input"
          placeholder="Enter Certificate No (e.g. CERT-1-2-ABC12345)"
          value={inputCode}
          onChange={(e) => setInputCode(e.target.value)}
          style={{ flex: 1, minWidth: 260, padding: '0.75rem 1rem', fontSize: '0.95rem', borderRadius: 'var(--radius-lg)' }}
          id="verify-cert-input"
          autoFocus
        />
        <button type="submit" className="btn btn-primary btn-lg" style={{ padding: '0.75rem 1.5rem', fontWeight: 700 }} id="verify-cert-submit-btn">
          Verify Certificate
        </button>
      </form>
    </div>
  );

  // ── No cert parameter provided (Root /verify) ───────────────
  if (!certNumber) {
    return shell(renderSearchForm());
  }

  // ── Loading ──────────────────────────────────────────────────
  if (loading) {
    return shell(
      <div style={styles.card}>
        <div style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
          <div className="spinner spinner-lg" aria-label="Verifying…" />
          <p style={{ marginTop: 'var(--space-4)', color: 'var(--gray-500)' }}>
            Verifying certificate #{certNumber}…
          </p>
        </div>
      </div>
    );
  }

  // ── Not found / Invalid ──────────────────────────────────────
  if (notFound || !cert) {
    return shell(
      <>
        <div style={{ ...styles.card, ...styles.invalidCard }}>
          <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>❌</div>
          <h1 style={{ ...styles.status, color: 'var(--danger-text)' }}>
            Certificate Not Found
          </h1>
          <p style={{ color: 'var(--danger-text)', marginBottom: 'var(--space-4)', fontSize: 'var(--font-size-sm)' }}>
            The certificate number{' '}
            <code style={{ fontFamily: 'monospace', background: '#fee2e2', padding: '2px 6px', borderRadius: 4 }}>
              {certNumber}
            </code>{' '}
            does not match any record in our system.
          </p>
          <p style={{ color: 'var(--gray-500)', fontSize: 'var(--font-size-xs)' }}>
            Please check for typos or enter another certificate number below.
          </p>
        </div>
        {renderSearchForm()}
      </>
    );
  }

  // ── Valid certificate ────────────────────────────────────────
  return shell(
    <>
      {/* Valid badge */}
      <div style={styles.validBanner}>
        <span style={{ fontSize: '1.5rem' }}>✅</span>
        <span style={styles.validText}>VALID — VERIFIED CERTIFICATE</span>
      </div>

      {/* Certificate display */}
      <div style={styles.certificate} id="printable-certificate">
        {/* Watermark */}
        <div style={styles.watermark} aria-hidden="true">🎓</div>

        <div style={styles.certContent}>
          <div style={styles.certLogo}>ED-MAX TRAINING PLATFORM</div>
          <div style={styles.certHeading}>CERTIFICATE OF COMPLETION</div>

          <p style={styles.certText}>This certifies that</p>

          <div style={styles.certStudent}>{cert.student_name}</div>

          <p style={styles.certText}>has successfully completed the training course</p>

          <div style={styles.certCourse}>{cert.course_title}</div>

          <div style={styles.divider} />

          <div style={styles.certMeta}>
            <div style={styles.metaItem}>
              <span style={styles.metaLabel}>ISSUED ON</span>
              <span style={styles.metaValue}>{formatDate(cert.issued_at)}</span>
            </div>
            {cert.final_score != null && (
              <div style={styles.metaItem}>
                <span style={styles.metaLabel}>FINAL SCORE</span>
                <span style={styles.metaValue}>{cert.final_score}%</span>
              </div>
            )}
            <div style={styles.metaItem}>
              <span style={styles.metaLabel}>CERTIFICATE NO.</span>
              <span style={{ ...styles.metaValue, fontFamily: 'monospace', fontSize: 'var(--font-size-xs)' }}>
                {cert.certificate_number}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--space-4)', marginTop: 'var(--space-6)', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-primary btn-lg"
          onClick={() => window.print()}
          id="download-cert-btn"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <span>📥</span> Download Certificate (PDF)
        </button>

        <button
          type="button"
          className="btn btn-outline btn-lg"
          onClick={handleShare}
          id="share-cert-btn"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fff' }}
        >
          <span>{copied ? '✓' : '🔗'}</span> {copied ? 'Link Copied!' : 'Share Certificate'}
        </button>
      </div>
    </>
  );
}

// ============================================================
// Styles
// ============================================================
const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, var(--primary-50, #eff6ff) 0%, #f8fafc 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: 'var(--space-6)',
    fontFamily: 'var(--font-sans, Inter, sans-serif)',
  },
  topBar: {
    width: '100%',
    maxWidth: 860,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 'var(--space-8)',
  },
  logo: {
    fontSize: 'var(--font-size-xl)',
    fontWeight: 800,
    color: 'var(--primary)',
    letterSpacing: '0.05em',
  },
  backLink: {
    border: '1px solid rgba(79, 70, 229, 0.15)',
    background: '#fff',
    color: 'var(--primary)',
    textDecoration: 'none',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 700,
    borderRadius: 999,
    padding: '0.5rem 0.9rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  body: {
    width: '100%',
    maxWidth: 760,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'var(--space-6)',
  },
  card: {
    background: '#fff',
    borderRadius: 'var(--radius-xl, 20px)',
    padding: 'var(--space-10)',
    boxShadow: '0 20px 60px rgba(0,0,0,0.10)',
    width: '100%',
    textAlign: 'center',
  },
  invalidCard: {
    border: '2px solid var(--danger)',
    background: 'var(--danger-light)',
  },
  status: {
    fontSize: 'var(--font-size-2xl)',
    fontWeight: 800,
    marginBottom: 'var(--space-4)',
  },
  validBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    background: 'var(--success-light)',
    border: '2px solid var(--success)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-3) var(--space-6)',
    width: '100%',
  },
  validText: {
    fontWeight: 800,
    color: 'var(--success-text)',
    fontSize: 'var(--font-size-base)',
    letterSpacing: '0.05em',
  },
  certificate: {
    position: 'relative',
    background: 'linear-gradient(145deg, #fdfbf7 0%, #fff 50%, #f8f6f0 100%)',
    border: '3px solid #c9a227',
    borderRadius: 'var(--radius-xl, 20px)',
    padding: 'var(--space-10)',
    boxShadow: '0 4px 32px rgba(201,162,39,0.18), 0 20px 60px rgba(0,0,0,0.10)',
    width: '100%',
    overflow: 'hidden',
    textAlign: 'center',
  },
  watermark: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    fontSize: '18rem',
    opacity: 0.03,
    pointerEvents: 'none',
    userSelect: 'none',
    lineHeight: 1,
  },
  certContent: {
    position: 'relative',
    zIndex: 1,
  },
  certLogo: {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 800,
    color: '#c9a227',
    letterSpacing: '0.2em',
    marginBottom: 'var(--space-3)',
  },
  certHeading: {
    fontSize: 'clamp(1.2rem, 3vw, 2rem)',
    fontWeight: 800,
    color: '#1e293b',
    letterSpacing: '0.15em',
    marginBottom: 'var(--space-6)',
    textTransform: 'uppercase',
  },
  certText: {
    fontSize: 'var(--font-size-sm)',
    color: '#64748b',
    marginBottom: 'var(--space-2)',
  },
  certStudent: {
    fontSize: 'clamp(1.4rem, 4vw, 2.2rem)',
    fontWeight: 700,
    color: '#1e293b',
    fontFamily: 'Georgia, serif',
    margin: 'var(--space-3) 0',
    borderBottom: '2px solid #c9a227',
    paddingBottom: 'var(--space-3)',
    display: 'inline-block',
    minWidth: 240,
  },
  certCourse: {
    fontSize: 'clamp(1rem, 2.5vw, 1.4rem)',
    fontWeight: 700,
    color: 'var(--primary)',
    margin: 'var(--space-3) 0 var(--space-6)',
  },
  divider: {
    height: 2,
    background: 'linear-gradient(90deg, transparent, #c9a227, transparent)',
    margin: 'var(--space-6) auto',
    width: '80%',
  },
  certMeta: {
    display: 'flex',
    justifyContent: 'center',
    gap: 'var(--space-8)',
    flexWrap: 'wrap',
    marginTop: 'var(--space-4)',
  },
  metaItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  metaLabel: {
    fontSize: 'var(--font-size-xs)',
    color: '#94a3b8',
    fontWeight: 700,
    letterSpacing: '0.1em',
  },
  metaValue: {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 700,
    color: '#1e293b',
  },
  footer: {
    marginTop: 'var(--space-8)',
    fontSize: 'var(--font-size-xs)',
    color: 'var(--gray-400)',
  },
};
