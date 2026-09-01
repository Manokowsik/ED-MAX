import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import VerifyModal from './VerifyModal';

export default function HeaderNav() {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const isAdmin = role?.toUpperCase() === 'ADMIN';

  const navItems = isAdmin
    ? [
        { to: '/admin/dashboard', label: 'Instructor Dashboard', icon: '📊' },
        { to: '/admin/courses', label: 'Course Catalog', icon: '📖' },
        { to: '/admin/students', label: 'Learners', icon: '👥' },
        { to: '/admin/assignments', label: 'Assignments', icon: '📋' },
      ]
    : [
        { to: '/student/dashboard', label: 'My Dashboard', icon: '📊' },
        { to: '/student/courses', label: 'Course Catalog', icon: '📖' },
        { to: '/student/certificates', label: 'Certificates', icon: '🎓' },
      ];

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <>
      <header className="top-header">
        <div className="top-header-container">
          {/* LOGO — BRANDED AS ED-MAX */}
          <div className="header-logo" onClick={() => navigate(isAdmin ? '/admin/dashboard' : '/student/dashboard')} style={{ cursor: 'pointer' }}>
            <div className="header-logo-icon">
              ⚡
            </div>
            <div className="header-logo-text">
              <div className="header-logo-title">
                ED-MAX <span className="header-version-badge">LMS V2.6</span>
              </div>
              <div className="header-logo-sub">Full-Stack Training &amp; Certification</div>
            </div>
          </div>

          {/* CENTER NAVIGATION TABS */}
          <nav className="header-nav-tabs">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `header-nav-pill${isActive ? ' active' : ''}`
                }
              >
                <span className="header-nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}

            {/* VERIFY CREDENTIAL TAB — ONLY FOR ADMIN */}
            {isAdmin && (
              <button
                type="button"
                className={`header-nav-pill${location.pathname.startsWith('/verify') ? ' active' : ''}`}
                onClick={() => setShowVerifyModal(true)}
                id="verify-credential-nav-btn"
              >
                <span className="header-nav-icon">🛡️</span>
                <span>Verify Credential</span>
              </button>
            )}
          </nav>

          {/* RIGHT PROFILE PILL */}
          <div className="header-profile-wrap">
            <div
              className="header-profile-pill"
              onClick={() => setShowUserMenu(!showUserMenu)}
              id="user-profile-pill"
            >
              <div className="header-profile-avatar">{initials}</div>
              <div className="header-profile-info">
                <div className="header-profile-name">{user?.name ?? 'User'}</div>
                <div className={`header-role-badge ${isAdmin ? 'instructor' : 'student'}`}>
                  {isAdmin ? 'Instructor' : 'Student'}
                </div>
              </div>
              <span className="header-profile-arrow">▾</span>
            </div>

            {showUserMenu && (
              <div className="header-user-dropdown" style={{ minWidth: '220px', padding: '8px' }}>
                <div style={{ padding: '8px 12px' }}>
                  <div style={{ fontWeight: 700, color: 'var(--gray-900)', fontSize: '0.9rem' }}>{user?.name ?? 'User'}</div>
                  <div className="dropdown-user-email" style={{ fontSize: '0.75rem', color: 'var(--gray-500)', wordBreak: 'break-all' }}>{user?.email}</div>
                </div>
                <hr style={{ margin: '4px 0', borderColor: 'var(--gray-200)' }} />
                <button
                  type="button"
                  className="dropdown-item"
                  onClick={() => {
                    setShowUserMenu(false);
                    navigate(isAdmin ? '/admin/settings' : '/student/settings');
                  }}
                  id="dropdown-settings-btn"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: '4px', fontSize: '0.85rem', color: 'var(--gray-700)' }}
                >
                  ⚙️ Account Settings
                </button>
                <hr style={{ margin: '4px 0', borderColor: 'var(--gray-200)' }} />
                <button
                  type="button"
                  className="dropdown-item logout"
                  onClick={handleLogout}
                  id="dropdown-logout-btn"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: '4px', fontSize: '0.85rem', color: 'var(--danger)' }}
                >
                  🚪 Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* VERIFY CREDENTIAL MODAL (ADMIN ONLY) */}
      {isAdmin && (
        <VerifyModal
          isOpen={showVerifyModal}
          onClose={() => setShowVerifyModal(false)}
        />
      )}
    </>
  );
}
