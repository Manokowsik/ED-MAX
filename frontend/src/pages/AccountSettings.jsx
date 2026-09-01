import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AdminLayout from '../layouts/AdminLayout';
import StudentLayout from '../layouts/StudentLayout';
import {
  getProfile,
  updateProfile,
  deleteAccount,
} from '../services/api';
import {
  LoadingPage,
  Alert,
  Badge,
  Modal,
  Spinner,
} from '../components/ui';

export default function AccountSettings() {
  const { user, isAdmin, logout, updateUser } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [pageError, setPageError] = useState('');

  // Profile Edit Form
  const [fullName, setFullName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  // Deletion Modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setPageError('');
    try {
      const res = await getProfile();
      const u = res.user;
      setProfile(u);
      setFullName(u.name || '');
    } catch (err) {
      setPageError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Handle Profile Update
  async function handleSaveProfile(e) {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');

    const trimmed = fullName.trim();
    if (!trimmed) {
      setProfileError('Full name cannot be blank.');
      return;
    }

    setSavingProfile(true);
    try {
      const res = await updateProfile(trimmed);
      setProfile(res.user);
      setFullName(res.user.name);
      updateUser({ name: res.user.name });
      setProfileSuccess('Profile updated successfully.');
    } catch (err) {
      setProfileError(err.message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  }

  // Handle Account Deletion
  async function handleDeleteAccount(e) {
    e.preventDefault();
    setDeleteError('');

    if (deleteConfirmText.trim() !== 'DELETE') {
      setDeleteError('Please type DELETE in capital letters to confirm.');
      return;
    }
    if (!deletePassword) {
      setDeleteError('Please enter your password to confirm account deactivation.');
      return;
    }

    setDeleting(true);
    try {
      await deleteAccount(deleteConfirmText.trim(), deletePassword);
      setShowDeleteModal(false);
      logout();
      navigate('/login', {
        state: { message: 'Your account has been deactivated. You have been signed out.' },
      });
    } catch (err) {
      setDeleteError(err.message || 'Failed to deactivate account.');
    } finally {
      setDeleting(false);
    }
  }

  const Layout = isAdmin ? AdminLayout : StudentLayout;

  if (loading) {
    return (
      <Layout>
        <LoadingPage message="Loading account settings..." />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="account-settings-container" style={{ maxWidth: '860px', margin: '0 auto', paddingBottom: '3rem' }}>
        {/* PAGE HEADER */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--gray-900)', letterSpacing: '-0.02em', marginBottom: '0.35rem' }}>
            Account Settings
          </h1>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.95rem' }}>
            Manage your personal profile and account settings.
          </p>
        </div>

        {pageError && (
          <div style={{ marginBottom: '1.5rem' }}>
            <Alert type="error">{pageError}</Alert>
          </div>
        )}

        {/* SECTION 1: PROFILE DETAILS */}
        <div className="card" style={{ marginBottom: '2rem' }}>
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 className="card-title" style={{ fontSize: '1.15rem' }}>Personal Profile</h2>
              <p style={{ color: 'var(--gray-500)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                Your public identification across courses and certificates.
              </p>
            </div>
            <Badge variant={isAdmin ? 'primary' : 'success'}>
              {isAdmin ? '🛡️ Administrator' : '🎓 Student'}
            </Badge>
          </div>

          <div className="card-body">
            {profileSuccess && (
              <div style={{ marginBottom: '1.25rem' }}>
                <Alert type="success" onClose={() => setProfileSuccess('')}>{profileSuccess}</Alert>
              </div>
            )}
            {profileError && (
              <div style={{ marginBottom: '1.25rem' }}>
                <Alert type="error" onClose={() => setProfileError('')}>{profileError}</Alert>
              </div>
            )}

            <form onSubmit={handleSaveProfile} noValidate>
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" htmlFor="profile-fullname">
                  Full Name <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  id="profile-fullname"
                  type="text"
                  className="form-control"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label className="form-label" htmlFor="profile-email" style={{ marginBottom: 0 }}>
                    Email Address
                  </label>
                  <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)', background: 'var(--gray-100)', padding: '2px 8px', borderRadius: '4px' }}>
                    🔒 Verified &amp; Protected
                  </span>
                </div>
                <input
                  id="profile-email"
                  type="email"
                  className="form-control"
                  value={profile?.email || ''}
                  disabled
                  style={{ backgroundColor: 'var(--gray-100)', cursor: 'not-allowed', color: 'var(--gray-600)' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)', display: 'block', marginTop: '0.35rem' }}>
                  Email changes require secure identity verification by an administrator.
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: 'var(--gray-50)', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid var(--gray-200)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Account Role</span>
                  <div style={{ fontWeight: 600, color: 'var(--gray-800)', marginTop: '0.2rem' }}>
                    {profile?.role === 'ADMIN' ? 'Instructor / Administrator' : 'Learner / Student'}
                  </div>
                </div>

                <div style={{ background: 'var(--gray-50)', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid var(--gray-200)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Account Status</span>
                  <div style={{ fontWeight: 600, color: 'var(--success)', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--success)', display: 'inline-block' }} />
                    Active &amp; Verified
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingProfile}
                  id="save-profile-btn"
                >
                  {savingProfile ? <Spinner size="sm" /> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* SECTION 2: DANGER ZONE / ACCOUNT DELETION */}
        <div className="card" style={{ border: '1px solid #fca5a5', backgroundColor: '#fff5f5' }}>
          <div className="card-header" style={{ borderBottom: '1px solid #fecaca', backgroundColor: 'transparent' }}>
            <h2 className="card-title" style={{ fontSize: '1.15rem', color: 'var(--danger)' }}>
              ⚠️ Danger Zone
            </h2>
            <p style={{ color: 'var(--danger-text)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
              Actions here have irreversible effects on your account access.
            </p>
          </div>

          <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--gray-900)' }}>Deactivate Account</div>
              <p style={{ color: 'var(--gray-600)', fontSize: '0.85rem', maxWidth: '520px', marginTop: '0.25rem' }}>
                Deactivating your account will terminate your active sessions and prevent future sign-ins.
                Historical course enrollments, quiz records, and issued certificates remain preserved for organizational reporting and audit purposes.
              </p>
            </div>

            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                setShowDeleteModal(true);
                setDeleteConfirmText('');
                setDeletePassword('');
                setDeleteError('');
              }}
              id="open-delete-modal-btn"
            >
              Deactivate Account
            </button>
          </div>
        </div>
      </div>

      {/* ACCOUNT DELETION CONFIRMATION MODAL */}
      {showDeleteModal && (
        <Modal
          title="Confirm Account Deactivation"
          onClose={() => {
            if (!deleting) setShowDeleteModal(false);
          }}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', width: '100%' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteAccount}
                disabled={deleting || deleteConfirmText.trim() !== 'DELETE'}
                id="confirm-delete-account-btn"
              >
                {deleting ? <Spinner size="sm" /> : 'Yes, Deactivate My Account'}
              </button>
            </div>
          }
        >
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ padding: '0.85rem', background: '#fee2e2', borderRadius: '8px', color: '#991b1b', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              <strong>Warning:</strong> You will be signed out immediately and blocked from logging in.
              {isAdmin && (
                <div style={{ marginTop: '0.5rem' }}>
                  If you are the sole administrator of your organization, you cannot deactivate this account until another administrator is assigned.
                </div>
              )}
            </div>

            {deleteError && (
              <div style={{ marginBottom: '1rem' }}>
                <Alert type="error">{deleteError}</Alert>
              </div>
            )}

            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label" htmlFor="delete-confirm-input">
                To confirm, type <strong style={{ color: 'var(--danger)' }}>DELETE</strong> below:
              </label>
              <input
                id="delete-confirm-input"
                type="text"
                className="form-control"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE"
                autoComplete="off"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="delete-password-input">
                Enter your current password to authenticate:
              </label>
              <input
                id="delete-password-input"
                type="password"
                className="form-control"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="••••••••••••"
              />
            </div>
          </div>
        </Modal>
      )}
    </Layout>
  );
}
