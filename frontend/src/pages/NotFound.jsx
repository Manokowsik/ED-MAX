import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font, Inter, sans-serif)',
      background: 'var(--gray-50, #f9fafb)',
      gap: '1rem',
    }}>
      <div style={{ fontSize: '5rem' }}>🔍</div>
      <h1 style={{ fontSize: '2rem', color: 'var(--gray-900)', margin: 0 }}>Page not found</h1>
      <p style={{ color: 'var(--gray-500)', margin: 0 }}>The page you are looking for does not exist.</p>
      <button
        className="btn btn-primary"
        onClick={() => navigate(-1)}
        style={{ marginTop: '1rem' }}
        id="go-back-btn"
      >
        Go Back
      </button>
    </div>
  );
}
