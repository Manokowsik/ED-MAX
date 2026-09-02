import { useNavigate, Link } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font, Inter, sans-serif)',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)',
      padding: '2rem',
    }}>
      <div style={{
        maxWidth: '480px',
        width: '100%',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(16px)',
        borderRadius: '1.25rem',
        padding: '3rem 2.5rem',
        textAlign: 'center',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)',
          fontSize: '2.5rem',
          marginBottom: '1.5rem',
          boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.2)',
        }}>
          🔍
        </div>

        <div style={{
          display: 'inline-block',
          padding: '0.25rem 0.75rem',
          borderRadius: '9999px',
          background: '#fee2e2',
          color: '#dc2626',
          fontSize: '0.75rem',
          fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          marginBottom: '1rem',
        }}>
          404 Error • Page Not Found
        </div>

        <h1 style={{
          fontSize: '2rem',
          fontWeight: 800,
          color: '#0f172a',
          margin: '0 0 0.75rem 0',
          letterSpacing: '-0.025em',
        }}>
          This page does not exist
        </h1>

        <p style={{
          color: '#64748b',
          fontSize: '0.95rem',
          lineHeight: 1.6,
          margin: '0 0 2rem 0',
        }}>
          The page or resource you are trying to access could not be found, may have been moved, or does not exist.
        </p>

        <div style={{
          display: 'flex',
          gap: '0.75rem',
          justifyContent: 'center',
          flexWrap: 'wrap',
        }}>
          <button
            className="btn btn-outline"
            onClick={() => navigate(-1)}
            id="go-back-btn"
            style={{ padding: '0.625rem 1.25rem', fontSize: '0.875rem' }}
          >
            ← Go Back
          </button>
          
          <Link
            to="/login"
            className="btn btn-primary"
            id="go-login-btn"
            style={{ padding: '0.625rem 1.25rem', fontSize: '0.875rem', textDecoration: 'none' }}
          >
            Sign In Page
          </Link>
        </div>
      </div>
    </div>
  );
}
