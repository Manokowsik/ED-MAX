import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import StudentLayout from '../../layouts/StudentLayout';
import { useAuth } from '../../context/AuthContext';
import { getStudentCertificates } from '../../services/api';
import { LoadingPage, Alert, Badge, EmptyState } from '../../components/ui';

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const MESSAGES = Object.freeze({
  LOAD_FAILED: 'Failed to load your certificates. Please refresh the page.',
  EMPTY_TITLE: 'No Certificates Yet',
  EMPTY_DESC: 'Complete all modules in an assigned course to earn a certificate.',
  COPIED_ALERT: 'Link copied to clipboard.',
});

// ============================================================================
// PURE UTILITIES (Unit-Testable)
// ============================================================================

/**
 * Converts an ISO string into standard US Long Date format.
 * @param {string | null | undefined} isoDate 
 * @returns {string}
 */
const formatDate = (isoDate) => {
  if (!isoDate) return '—';
  const timestamp = new Date(isoDate).getTime();
  if (Number.isNaN(timestamp)) return '—';

  return new Date(isoDate).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

// ============================================================================
// SUB-COMPONENT: Certificate Grid Item Card
// ============================================================================

const CertificateCard = React.memo(function CertificateCard({ cert, onView }) {
  const handleVerifyClick = (e) => {
    e.stopPropagation();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className="card cert-interactive-card"
      style={STYLES.cardWrapper}
      onClick={() => onView(cert)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onView(cert);
        }
      }}
      id={`cert-card-${cert.id}`}
      aria-label={`View certificate for ${cert.course_title}`}
    >
      <div className="card-body" style={STYLES.cardBody}>
        {/* Top Header Row: Icon + Badge */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div style={STYLES.cardIcon} aria-hidden="true">🎓</div>
          <Badge variant="success">✓ Verified Earned</Badge>
        </div>

        {/* Content Body */}
        <div style={STYLES.cardContent}>
          <h2 style={STYLES.cardTitle}>
            {cert.course_title}
          </h2>

          <div style={STYLES.cardDetailRow}>
            <span className="text-gray">Student: </span>
            <strong style={{ color: 'var(--gray-900)' }}>{cert.student_name}</strong>
          </div>

          {cert.student_email && (
            <div style={{ ...STYLES.cardDetailRow, wordBreak: 'break-all' }}>
              <span className="text-gray">Email: </span>
              <span style={{ color: 'var(--gray-600)' }}>{cert.student_email}</span>
            </div>
          )}

          <div style={STYLES.cardDetailRow}>
            <span className="text-gray">Issued: </span>
            <span style={{ color: 'var(--gray-700)' }}>{formatDate(cert.issued_at)}</span>
          </div>

          {cert.final_score != null && (
            <div style={STYLES.cardDetailRow}>
              <span className="text-gray">Final Score: </span>
              <strong style={{ color: 'var(--success-text)' }}>{cert.final_score}%</strong>
            </div>
          )}

          <div className="text-xs" style={STYLES.cardCertNumber}>
            No: {cert.certificate_number}
          </div>

          <div style={STYLES.verifyLinkWrapper}>
            <a
              href={`/verify/${cert.certificate_number}`}
              target="_blank"
              rel="noopener noreferrer"
              style={STYLES.verifyLink}
              onClick={handleVerifyClick}
              onKeyDown={(e) => e.stopPropagation()}
              aria-label={`Open public verification link for certificate ${cert.certificate_number}`}
            >
              🔗 Verify Certificate ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
});

// ============================================================================
// SUB-COMPONENT: Print-Friendly Certificate Display Modal
// ============================================================================

const CertificateDisplayModal = React.memo(function CertificateDisplayModal({ cert, onClose }) {
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef(null);

  // Accessible escape key listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, [onClose]);

  const handleShare = useCallback(async () => {
    const verificationUrl = `${window.location.origin}/verify/${cert.certificate_number}`;
    
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Certificate of Completion - ${cert.student_name}`,
          text: `Check out ${cert.student_name}'s verified training certificate for ${cert.course_title} on ED-MAX!`,
          url: verificationUrl,
        });
        return;
      } catch (err) {
        // User aborted share sheet dialog; ignore exception
        if (err.name === 'AbortError') return;
      }
    }

    if (navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(verificationUrl);
        setCopied(true);
        if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
        copyTimerRef.current = setTimeout(() => setCopied(false), 3000);
      } catch {
        // Fallback for clipboard failure
      }
    }
  }, [cert]);

  const handleDownloadPdf = useCallback(() => {
    const element = document.getElementById('printable-certificate');
    if (!element) {
      window.print();
      return;
    }

    import('html2pdf.js')
      .then((module) => {
        const html2pdf = module.default || module;
        const opt = {
          margin: 0.4,
          filename: `Certificate_${cert.certificate_number || 'ED-MAX'}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' },
        };
        html2pdf().set(opt).from(element).save();
      })
      .catch(() => {
        window.print();
      });
  }, [cert]);

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={STYLES.modalOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cert-display-heading"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={STYLES.modalContainer}
      >
        {/* Certificate Container Canvas */}
        <section style={STYLES.certificate} id="printable-certificate">
          {/* Subtle Background Watermark */}
          <div style={STYLES.watermark} aria-hidden="true">🎓</div>

          <div style={STYLES.certContent}>
            <div style={STYLES.certLogo}>
              ED-MAX TRAINING PLATFORM
            </div>

            <h1 id="cert-display-heading" style={STYLES.certHeading}>
              CERTIFICATE OF COMPLETION
            </h1>

            <p style={STYLES.certText}>This certifies that</p>

            <div style={STYLES.certStudent}>
              {cert.student_name}
            </div>

            {cert.student_email && (
              <div style={STYLES.studentEmail}>
                Email: {cert.student_email}
              </div>
            )}

            <p style={STYLES.certTextSubtitle}>
              has successfully completed the training course
            </p>

            <div style={STYLES.certCourse}>
              {cert.course_title}
            </div>

            <div style={STYLES.divider} aria-hidden="true" />

            <div style={STYLES.certMeta}>
              <div style={STYLES.metaItem}>
                <span style={STYLES.metaLabel}>ISSUED ON</span>
                <span style={STYLES.metaValue}>{formatDate(cert.issued_at)}</span>
              </div>

              {cert.final_score != null && (
                <div style={STYLES.metaItem}>
                  <span style={STYLES.metaLabel}>FINAL SCORE</span>
                  <span style={STYLES.metaValue}>{cert.final_score}%</span>
                </div>
              )}

              <div style={STYLES.metaItem}>
                <span style={STYLES.metaLabel}>CERTIFICATE NO.</span>
                <span style={STYLES.metaCertNumber}>
                  {cert.certificate_number}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Action Controls (Suppressed from @media print) */}
        <footer className="no-print" style={STYLES.modalControls}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={onClose}
            style={STYLES.closeBtn}
            id="close-cert-btn"
          >
            Close
          </button>
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={handleDownloadPdf}
            id="download-cert-btn"
            style={STYLES.actionBtn}
          >
            <span aria-hidden="true">📥</span> Download PDF
          </button>
          <button
            type="button"
            className="btn btn-outline btn-lg"
            onClick={handleShare}
            id="share-cert-btn"
            style={STYLES.shareBtn}
            aria-live="polite"
          >
            <span aria-hidden="true">{copied ? '✓' : '🔗'}</span>{' '}
            {copied ? 'Link Copied!' : 'Share Certificate'}
          </button>
        </footer>
      </div>
    </div>
  );
});

// ============================================================================
// MAIN PAGE VIEW COMPONENT
// ============================================================================

export default function StudentCertificates() {
  const { user } = useAuth();
  const [certs, setCerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCert, setSelectedCert] = useState(null);

  const loadCertificates = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError('');
    try {
      const res = await getStudentCertificates(user.id);
      setCerts(res?.certificates ?? []);
    } catch (err) {
      setError(err.message || MESSAGES.LOAD_FAILED);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadCertificates();
  }, [loadCertificates]);

  const certificateCountText = useMemo(() => {
    const count = certs.length;
    return `${count} certificate${count !== 1 ? 's' : ''} earned for course completions`;
  }, [certs.length]);

  if (loading) {
    return (
      <StudentLayout>
        <div className="page-container">
          <LoadingPage message="Loading your certificates…" />
        </div>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout>
      <div className="page-container">
        {/* Header Summary */}
        <header className="page-header mb-6">
          <h1 className="page-title">My Certificates</h1>
          <p className="page-subtitle">{certificateCountText}</p>
        </header>

        {error && (
          <Alert type="error" onClose={() => setError('')} aria-live="assertive">
            {error}
          </Alert>
        )}

        {/* Certificate Display Grid or Empty State */}
        {certs.length === 0 ? (
          <EmptyState
            icon="🎓"
            title={MESSAGES.EMPTY_TITLE}
            text={MESSAGES.EMPTY_DESC}
            action={
              <Link to="/student/courses" className="btn btn-primary">
                Go to My Courses
              </Link>
            }
          />
        ) : (
          <section
            style={STYLES.gridContainer}
            aria-label="Your Earned Certificates Roster"
          >
            {certs.map((c) => (
              <CertificateCard
                key={c.id}
                cert={c}
                onView={setSelectedCert}
              />
            ))}
          </section>
        )}

        {/* Selected Certificate Modal */}
        {selectedCert && (
          <CertificateDisplayModal
            cert={selectedCert}
            onClose={() => setSelectedCert(null)}
          />
        )}
      </div>
    </StudentLayout>
  );
}

// ============================================================================
// STYLES (Performance tokens frozen in memory)
// ============================================================================

const STYLES = Object.freeze({
  gridContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 'var(--space-5)',
  },
  cardWrapper: {
    cursor: 'pointer',
    transition: 'all 150ms ease',
    textAlign: 'left',
    display: 'block',
    width: '100%',
    boxSizing: 'border-box',
  },
  cardBody: {
    padding: '1.25rem',
  },
  cardIcon: {
    fontSize: '2.2rem',
    lineHeight: 1,
  },
  cardContent: {
    width: '100%',
  },
  cardTitle: {
    fontSize: '1.05rem',
    fontWeight: 700,
    color: 'var(--gray-900)',
    marginBottom: '0.6rem',
    lineHeight: 1.35,
    wordBreak: 'break-word',
  },
  cardDetailRow: {
    fontSize: '0.85rem',
    marginBottom: '0.25rem',
    lineHeight: 1.4,
  },
  cardCertNumber: {
    color: 'var(--gray-400)',
    marginTop: '0.5rem',
    fontFamily: 'monospace',
    fontSize: '0.75rem',
    wordBreak: 'break-all',
  },
  verifyLinkWrapper: {
    marginTop: '0.6rem',
  },
  verifyLink: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--primary)',
    textDecoration: 'none',
  },
  modalOverlay: {
    background: 'rgba(15, 23, 42, 0.75)',
    backdropFilter: 'blur(4px)',
    padding: 'var(--space-4)',
  },
  modalContainer: {
    maxWidth: '800px',
    width: '100%',
    margin: '0 auto',
  },
  certificate: {
    position: 'relative',
    background: 'linear-gradient(145deg, #fdfbf7 0%, #ffffff 50%, #f8f6f0 100%)',
    border: '3px solid #c9a227',
    borderRadius: '20px',
    padding: 'var(--space-8) var(--space-10)',
    boxShadow: '0 4px 32px rgba(201,162,39,0.18), 0 20px 60px rgba(0,0,0,0.15)',
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
    fontSize: 'var(--font-size-xs)',
    fontWeight: 800,
    color: '#c9a227',
    letterSpacing: '0.2em',
    marginBottom: 'var(--space-3)',
  },
  certHeading: {
    fontSize: 'clamp(1.2rem, 3vw, 1.8rem)',
    fontWeight: 800,
    color: '#1e293b',
    letterSpacing: '0.15em',
    marginBottom: 'var(--space-4)',
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
    margin: 'var(--space-2) 0',
    borderBottom: '2px solid #c9a227',
    paddingBottom: 'var(--space-2)',
    display: 'inline-block',
    minWidth: '240px',
  },
  studentEmail: {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--gray-500)',
    marginTop: '2px',
  },
  certTextSubtitle: {
    fontSize: 'var(--font-size-sm)',
    color: '#64748b',
    marginBottom: 'var(--space-2)',
    marginTop: 'var(--space-4)',
  },
  certCourse: {
    fontSize: 'clamp(1rem, 2.5vw, 1.4rem)',
    fontWeight: 700,
    color: 'var(--primary)',
    margin: 'var(--space-2) 0 var(--space-5)',
  },
  divider: {
    height: '2px',
    background: 'linear-gradient(90deg, transparent, #c9a227, transparent)',
    margin: 'var(--space-5) auto',
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
    gap: '4px',
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
  metaCertNumber: {
    fontSize: 'var(--font-size-xs)',
    fontWeight: 700,
    color: '#1e293b',
    fontFamily: 'monospace',
  },
  modalControls: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 'var(--space-4)',
    marginTop: 'var(--space-6)',
    flexWrap: 'wrap',
  },
  closeBtn: {
    background: '#fff',
  },
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  shareBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    background: '#fff',
  },
});