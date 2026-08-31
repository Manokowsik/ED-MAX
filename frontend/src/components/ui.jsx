// ============================================================
// Spinner
// ============================================================
export function Spinner({ size = 'sm' }) {
  return <div className={`spinner${size === 'lg' ? ' spinner-lg' : ''}`} aria-label="Loading" />;
}

// ============================================================
// LoadingPage
// ============================================================
export function LoadingPage({ message = 'Loading…' }) {
  return (
    <div className="loading-page">
      <Spinner size="lg" />
      <span style={{ color: 'var(--gray-500)', fontSize: 'var(--font-size-sm)' }}>{message}</span>
    </div>
  );
}

// ============================================================
// Alert
// ============================================================
export function Alert({ type = 'error', children, onClose }) {
  const cls = {
    error: 'alert-error',
    success: 'alert-success',
    warning: 'alert-warning',
    info: 'alert-info',
  }[type] ?? 'alert-error';

  return (
    <div className={`alert ${cls}`} role="alert">
      <span style={{ flex: 1 }}>{children}</span>
      {onClose && (
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '1rem', lineHeight: 1, color: 'inherit' }}
          aria-label="Dismiss"
        >
          ✕
        </button>
      )}
    </div>
  );
}

// ============================================================
// Badge
// ============================================================
export function Badge({ variant = 'gray', children }) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}

// ============================================================
// ProgressBar
// ============================================================
export function ProgressBar({ value, max = 100, variant = 'primary' }) {
  const pct = Math.min(100, Math.max(0, Math.round((value / max) * 100)));
  return (
    <div>
      <div className="progress-bar-wrap">
        <div
          className={`progress-bar-fill${variant === 'success' ? ' success' : ''}`}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}

// ============================================================
// EmptyState
// ============================================================
export function EmptyState({ icon = '📭', title, text, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <div className="empty-state-title">{title}</div>
      {text && <div className="empty-state-text">{text}</div>}
      {action}
    </div>
  );
}

// ============================================================
// Modal
// ============================================================
export function Modal({ title, onClose, children, footer }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-header">
          <h2 className="modal-title" id="modal-title">{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

// ============================================================
// ConfirmModal
// ============================================================
export function ConfirmModal({ title, message, onConfirm, onCancel, danger = false, loading = false }) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button className="btn btn-outline" onClick={onCancel} disabled={loading}>Cancel</button>
          <button
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={loading}
            id="confirm-action-btn"
          >
            {loading ? <Spinner /> : 'Confirm'}
          </button>
        </>
      }
    >
      <p style={{ color: 'var(--gray-700)' }}>{message}</p>
    </Modal>
  );
}

// ============================================================
// StatCard
// ============================================================
export function StatCard({ label, value, sub, variant = 'primary' }) {
  return (
    <div className={`stat-card ${variant}`}>
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value">{value ?? '—'}</div>
      {sub && <div className="stat-card-sub">{sub}</div>}
    </div>
  );
}
