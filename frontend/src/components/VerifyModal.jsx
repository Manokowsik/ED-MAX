import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { verifyCertificate } from '../services/api';
import { Modal, Spinner, Alert } from './ui';

export default function VerifyModal({ isOpen, onClose }) {
  const [certNumber, setCertNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const navigate = useNavigate();

  async function handleVerify(e) {
    e.preventDefault();
    setError('');
    setResult(null);
    if (!certNumber.trim()) {
      setError('Please enter a certificate number');
      return;
    }

    setLoading(true);
    try {
      const res = await verifyCertificate(certNumber.trim());
      if (res.valid) {
        setResult(res.certificate);
      } else {
        setError('Certificate not found or invalid.');
      }
    } catch (err) {
      setError(err.message || 'Certificate not found. Please check the number.');
    } finally {
      setLoading(false);
    }
  }

  function handleOpenFullPage() {
    if (certNumber) {
      onClose();
      navigate(`/verify/${encodeURIComponent(certNumber.trim())}`);
    }
  }

  if (!isOpen) return null;

  return (
    <Modal
      title="🛡️ Verify Credential"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Close
          </button>
          {result && (
            <button type="button" className="btn btn-primary" onClick={handleOpenFullPage}>
              Open Full Certificate View ↗
            </button>
          )}
        </div>
      }
    >
      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--gray-600)', marginBottom: 'var(--space-4)' }}>
        Enter a certificate number to instantly verify its authenticity against our secure backend registry.
      </p>

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      <form onSubmit={handleVerify} className="mb-4">
        <div className="form-group">
          <label className="form-label" htmlFor="modal-cert-input">Certificate Number</label>
          <div className="flex gap-2">
            <input
              id="modal-cert-input"
              type="text"
              className="form-input"
              placeholder="e.g. CERT-1-2-A1B2C3D4"
              value={certNumber}
              onChange={(e) => setCertNumber(e.target.value)}
              style={{ fontFamily: 'monospace' }}
            />
            <button type="submit" className="btn btn-primary" disabled={loading} id="modal-verify-btn">
              {loading ? <Spinner /> : 'Verify'}
            </button>
          </div>
        </div>
      </form>

      {result && (
        <div
          style={{
            background: 'var(--success-light)',
            border: '1.5px solid var(--success)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '2rem', marginBottom: 'var(--space-1)' }}>✅</div>
          <h4 style={{ fontWeight: 700, color: 'var(--success-text)', fontSize: 'var(--font-size-base)' }}>
            VALID — VERIFIED CREDENTIAL
          </h4>
          <div className="text-sm font-semibold mt-2" style={{ color: 'var(--gray-900)' }}>
            {result.student_name}
          </div>
          <div className="text-xs text-gray">{result.course_title}</div>
          <div className="text-xs font-mono mt-2" style={{ color: 'var(--gray-600)' }}>
            {result.certificate_number}
          </div>
        </div>
      )}
    </Modal>
  );
}
