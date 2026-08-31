import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import StudentLayout from '../../layouts/StudentLayout';
import { useAuth } from '../../context/AuthContext';
import { getStudentCertificates } from '../../services/api';
import { LoadingPage, Alert, Badge, EmptyState } from '../../components/ui';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

// ============================================================
// Certificate Card Item
// ============================================================
function CertificateCard({ cert, onView }) {
  return (
    <div
      className="card"
      style={{ cursor: 'pointer', transition: 'box-shadow var(--transition), transform var(--transition)' }}
      onClick={() => onView(cert)}
      id={`cert-card-${cert.id}`}
    >
      <div className="card-body">
        <div className="flex items-start justify-between gap-4">
          <div style={{ fontSize: '2.8rem' }}>🎓</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--gray-900)', marginBottom: 'var(--space-1)' }}>
              {cert.course_title}
            </h3>
            <div className="text-sm text-gray">Student: <strong>{cert.student_name}</strong></div>
            {cert.student_email && (
              <div className="text-sm text-gray">Email: {cert.student_email}</div>
            )}
            <div className="text-sm text-gray">Issued: {formatDate(cert.issued_at)}</div>
            {cert.final_score != null && (
              <div className="text-sm text-gray">Final Score: <strong>{cert.final_score}%</strong></div>
            )}
            <div className="text-xs" style={{ color: 'var(--gray-400)', marginTop: 'var(--space-2)', fontFamily: 'monospace' }}>
              No: {cert.certificate_number}
            </div>
            <div style={{ marginTop: 'var(--space-1)' }}>
              <a
                href={`/verify/${cert.certificate_number}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 'var(--font-size-xs)', color: 'var(--primary)', textDecoration: 'none' }}
                onClick={(e) => e.stopPropagation()}
              >
                🔗 Verify Certificate ↗
              </a>
            </div>
          </div>
          <Badge variant="success">✓ Verified Earned</Badge>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Professional Print-Friendly Certificate Display Modal
// Uses exact clean gold-bordered design from CertificateVerify
// ============================================================
function CertificateDisplayModal({ cert, onClose }) {
  function handlePrint() {
    window.print();
  }

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{ background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', padding: 'var(--space-4)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 800, width: '100%', margin: '0 auto' }}
      >
        {/* CERTIFICATE CANVAS / CONTAINER */}
        <div style={certStyles.certificate} id="printable-certificate">
          {/* Subtle Background Watermark (3% Opacity) */}
          <div style={certStyles.watermark} aria-hidden="true">🎓</div>

          <div style={certStyles.certContent}>
            {/* Header */}
            <div style={certStyles.certLogo}>
              ED-MAX TRAINING PLATFORM
            </div>

            {/* Certificate Title */}
            <div style={certStyles.certHeading}>
              CERTIFICATE OF COMPLETION
            </div>

            <p style={certStyles.certText}>This certifies that</p>

            {/* STUDENT NAME */}
            <div style={certStyles.certStudent}>
              {cert.student_name}
            </div>

            {cert.student_email && (
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--gray-500)', marginTop: '2px' }}>
                Email: {cert.student_email}
              </div>
            )}

            <p style={{ ...certStyles.certText, marginTop: 'var(--space-4)' }}>
              has successfully completed the training course
            </p>

            {/* COURSE TITLE */}
            <div style={certStyles.certCourse}>
              {cert.course_title}
            </div>

            {/* Decorative Divider Line */}
            <div style={certStyles.divider} />

            {/* CERTIFICATE METADATA */}
            <div style={certStyles.certMeta}>
              <div style={certStyles.metaItem}>
                <span style={certStyles.metaLabel}>ISSUED ON</span>
                <span style={certStyles.metaValue}>{formatDate(cert.issued_at)}</span>
              </div>

              {cert.final_score != null && (
                <div style={certStyles.metaItem}>
                  <span style={certStyles.metaLabel}>FINAL SCORE</span>
                  <span style={certStyles.metaValue}>{cert.final_score}%</span>
                </div>
              )}

              <div style={certStyles.metaItem}>
                <span style={certStyles.metaLabel}>CERTIFICATE NO.</span>
                <span style={{ ...certStyles.metaValue, fontFamily: 'monospace', fontSize: 'var(--font-size-xs)' }}>
                  {cert.certificate_number}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* CONTROLS (Hidden during print) */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-4)', marginTop: 'var(--space-6)' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={onClose}
            style={{ background: '#fff' }}
            id="close-cert-btn"
          >
            Close
          </button>
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={handlePrint}
            id="print-cert-btn"
          >
            🖨️ Print Certificate
          </button>
        </div>
      </div>
    </div>
  );
}

// Certificate Modal Inline Styles (Identical to CertificateVerify)
const certStyles = {
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
    minWidth: 240,
  },
  certCourse: {
    fontSize: 'clamp(1rem, 2.5vw, 1.4rem)',
    fontWeight: 700,
    color: 'var(--primary)',
    margin: 'var(--space-2) 0 var(--space-5)',
  },
  divider: {
    height: 2,
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
};

// ============================================================
// Main Page: Student Certificates
// ============================================================
export default function StudentCertificates() {
  const { user } = useAuth();
  const [certs, setCerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCert, setSelectedCert] = useState(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError('');
    try {
      const res = await getStudentCertificates(user.id);
      setCerts(res.certificates ?? []);
    } catch (err) {
      setError(err.message || 'Failed to load certificates.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <StudentLayout>
        <div className="page-container"><LoadingPage message="Loading your certificates…" /></div>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout>
      <div className="page-container">
        <div className="page-header mb-6">
          <h1 className="page-title">My Certificates</h1>
          <p className="page-subtitle">{certs.length} certificate{certs.length !== 1 ? 's' : ''} earned for course completions</p>
        </div>

        {error && <Alert type="error">{error}</Alert>}

        {certs.length === 0 ? (
          <EmptyState
            icon="🎓"
            title="No Certificates Yet"
            text="Complete all modules in an assigned course to earn a certificate."
            action={<Link to="/student/courses" className="btn btn-primary">Go to My Courses</Link>}
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-5)' }}>
            {certs.map((c) => (
              <CertificateCard key={c.id} cert={c} onView={setSelectedCert} />
            ))}
          </div>
        )}

        {/* Certificate Display Modal */}
        {selectedCert && (
          <CertificateDisplayModal cert={selectedCert} onClose={() => setSelectedCert(null)} />
        )}
      </div>
    </StudentLayout>
  );
}
