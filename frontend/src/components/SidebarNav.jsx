import { useState, useEffect, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../services/api';
import VerifyModal from './VerifyModal';

const COURSE_ICONS = {
  admin: { dashboard: '📊', courses: '📖', students: '👥', verify: '🛡️', settings: '⚙️' },
  student: { dashboard: '🏠', courses: '📚', certificates: '🎓', settings: '⚙️' },
};

export default function SidebarNav() {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const isAdmin = role?.toUpperCase() === 'ADMIN';

  const loadNotifications = useCallback(async () => {
    try {
      const res = await getNotifications(10);
      setNotifications(res.notifications || []);
      setUnreadCount(res.unread_count || 0);
    } catch {
      // Ignore background notification fetch errors
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkAllRead = useCallback(async () => {
    try {
      await markAllNotificationsRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
    } catch {
      // Ignore background errors
    }
  }, []);

  const handleToggleNotifications = useCallback(() => {
    const nextState = !showNotifications;
    setShowNotifications(nextState);
    if (nextState && unreadCount > 0) {
      handleMarkAllRead();
    }
  }, [showNotifications, unreadCount, handleMarkAllRead]);

  const navItems = isAdmin
    ? [
        { to: '/admin/dashboard', label: 'Admin Dashboard', icon: COURSE_ICONS.admin.dashboard },
        { to: '/admin/courses', label: 'Manage Courses', icon: COURSE_ICONS.admin.courses },
        { to: '/admin/students', label: 'User Manager', icon: COURSE_ICONS.admin.students },
        { to: '/admin/settings', label: 'Settings', icon: COURSE_ICONS.admin.settings },
      ]
    : [
        { to: '/student/dashboard', label: 'My Dashboard', icon: COURSE_ICONS.student.dashboard },
        { to: '/student/courses', label: 'My Courses', icon: COURSE_ICONS.student.courses },
        { to: '/student/certificates', label: 'Certificates', icon: COURSE_ICONS.student.certificates },
        { to: '/student/settings', label: 'Settings', icon: COURSE_ICONS.student.settings },
      ];



  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const roleLabel = isAdmin ? 'Administrator' : 'Student';
  const homePath = isAdmin ? '/admin/dashboard' : '/student/dashboard';

  function handleLogout() {
    logout();
    navigate('/login');
  }

  function closeSidebar() {
    setSidebarOpen(false);
  }

  return (
    <>
      {/* === MOBILE TOP BAR (Mobile Only) === */}
      <div className="sv2-mobile-topbar">
        {/* Profile Avatar — LEFT TOP */}
        <div
          className="sv2-user-avatar"
          style={{ width: 34, height: 34, fontSize: '0.78rem', cursor: 'pointer', flexShrink: 0 }}
          onClick={() => navigate(isAdmin ? '/admin/settings' : '/student/settings')}
          title={user?.name ?? 'Account Settings'}
          id="mobile-profile-avatar-btn"
        >
          {initials}
        </div>

        {/* Brand Logo — CENTER */}
        <div className="sv2-mobile-brand" onClick={() => navigate(homePath)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '1.1rem' }}>⚡</span>
          <span className="sv2-mobile-logo">ED-MAX</span>
        </div>

        {/* Right Actions — Notifications & Hamburger Menu — RIGHT TOP */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Notification bell icon */}
          <button
            type="button"
            className="sv2-mobile-icon-btn"
            onClick={handleToggleNotifications}
            aria-label="Notifications"
            title="Notifications"
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.1rem',
              cursor: 'pointer',
              position: 'relative',
              padding: '4px',
            }}
          >
            🔔
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '2px',
                right: '2px',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#ef4444'
              }} />
            )}
          </button>

          {/* Hamburger Menu — RIGHT TOP */}
          <button
            className="sv2-hamburger"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation menu"
            id="sidebar-hamburger-btn"
          >
            ☰
          </button>
        </div>
      </div>

      {/* Notifications Toast Dropdown */}
      {showNotifications && (
        <div style={{
          position: 'fixed',
          top: '55px',
          right: '16px',
          zIndex: 350,
          background: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
          border: '1px solid #e2e8f0',
          padding: '12px 16px',
          width: '300px',
          maxHeight: '380px',
          overflowY: 'auto',
        }}>
          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Notifications {unreadCount > 0 && `(${unreadCount})`}</span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  style={{ background: 'none', border: 'none', fontSize: '0.75rem', color: '#6366f1', fontWeight: 600, cursor: 'pointer' }}
                >
                  Mark all read
                </button>
              )}
              <span style={{ fontSize: '0.75rem', color: '#64748b', cursor: 'pointer' }} onClick={() => setShowNotifications(false)}>Close</span>
            </div>
          </div>
          {notifications.length === 0 ? (
            <div style={{ fontSize: '0.75rem', color: '#64748b', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
              🎉 No new notifications. You are all caught up!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
              {notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={async () => {
                    if (!n.is_read) {
                      await markNotificationRead(n.id);
                      setUnreadCount((c) => Math.max(0, c - 1));
                      setNotifications((prev) => prev.map((item) => item.id === n.id ? { ...item, is_read: true } : item));
                    }
                    if (n.link) {
                      setShowNotifications(false);
                      navigate(n.link);
                    }
                  }}
                  style={{
                    padding: '6px 8px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    background: n.is_read ? 'transparent' : '#eef2ff',
                    fontSize: '0.75rem',
                    borderLeft: n.is_read ? '2px solid transparent' : '2px solid #6366f1',
                  }}
                >
                  <div style={{ fontWeight: n.is_read ? 500 : 700, color: '#1e1b4b' }}>{n.title}</div>
                  <div style={{ color: '#64748b', marginTop: '2px', fontSize: '0.7rem' }}>{n.message}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === OVERLAY (mobile) === */}
      {sidebarOpen && (
        <div className="sv2-overlay" onClick={closeSidebar} id="sidebar-overlay" />
      )}

      {/* === SIDEBAR (Desktop Sticky & Mobile Drawer) === */}
      <aside className={`sidebar-v2${sidebarOpen ? ' open' : ''}`} id="main-sidebar">

        {/* Logo Header */}
        <div
          className="sv2-logo"
          onClick={() => { navigate(homePath); closeSidebar(); }}
          id="sidebar-logo"
        >
          <div className="sv2-logo-icon">⚡</div>
          <div className="sv2-logo-text">
            <div className="sv2-logo-title">
              ED-MAX
              <span className="sv2-logo-badge">LMS V2.6</span>
            </div>
            <div className="sv2-logo-sub">Full-Stack Training Platform</div>
          </div>
        </div>

        {/* User Profile Info Card */}
        <div
          className="sv2-user-block"
          onClick={() => { navigate(isAdmin ? '/admin/settings' : '/student/settings'); closeSidebar(); }}
          style={{ cursor: 'pointer' }}
          title="Account Settings"
        >
          <div className="sv2-user-avatar">{initials}</div>
          <div className="sv2-user-info">
            <div className="sv2-user-name">{user?.name ?? 'User'}</div>
            <div className="sv2-user-role">
              <span className="sv2-online-dot" />
              {roleLabel} · Online
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="sv2-nav" id="sidebar-nav">
          <div className="sv2-nav-section-label">Main Menu</div>

          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `sv2-nav-link${isActive ? ' active' : ''}`
              }
              onClick={closeSidebar}
              id={`sidebar-link-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <span className="sv2-nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}

          {/* Verify Credential (admin only) */}
          {isAdmin && (
            <button
              type="button"
              className="sv2-nav-link"
              onClick={() => { setShowVerifyModal(true); closeSidebar(); }}
              id="sidebar-verify-btn"
            >
              <span className="sv2-nav-icon">🛡️</span>
              Verify Credential
            </button>
          )}
        </nav>

        {/* Footer / Logout */}
        <div className="sv2-footer">
          <button
            type="button"
            className="sv2-footer-btn"
            onClick={handleLogout}
            id="sidebar-logout-btn"
          >
            <span>🚪</span>
            Sign out
          </button>
        </div>
      </aside>



      {/* === VERIFY CREDENTIAL MODAL (admin only) === */}
      {isAdmin && (
        <VerifyModal
          isOpen={showVerifyModal}
          onClose={() => setShowVerifyModal(false)}
        />
      )}
    </>
  );
}

