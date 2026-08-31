import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import {
  getCourses,
  createCourse,
  activateCourse,
  deactivateCourse,
} from '../../services/api';
import {
  LoadingPage, Alert, Badge, EmptyState,
  Modal, ConfirmModal, Spinner,
} from '../../components/ui';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AdminCourses() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '' });
  const [formError, setFormError] = useState('');
  const [creating, setCreating] = useState(false);

  // Status confirm
  const [confirm, setConfirm] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getCourses();
      setCourses(res.courses ?? []);
    } catch (err) {
      setError(err.message || 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e) {
    e.preventDefault();
    setFormError('');
    if (!form.title.trim()) { setFormError('Course title is required.'); return; }

    setCreating(true);
    try {
      await createCourse(form.title.trim(), form.description.trim());
      setShowCreate(false);
      setForm({ title: '', description: '' });
      setSuccess('Course created successfully.');
      await load();
    } catch (err) {
      setFormError(err.message || 'Failed to create course');
    } finally {
      setCreating(false);
    }
  }

  async function handleStatusChange() {
    if (!confirm) return;
    setActionLoading(true);
    try {
      if (confirm.action === 'activate') {
        await activateCourse(confirm.course.id);
        setSuccess(`"${confirm.course.title}" activated.`);
      } else {
        await deactivateCourse(confirm.course.id);
        setSuccess(`"${confirm.course.title}" deactivated.`);
      }
      setConfirm(null);
      await load();
    } catch (err) {
      setError(err.message || 'Action failed');
      setConfirm(null);
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="page-container"><LoadingPage message="Loading courses…" /></div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="page-container">
        {/* Header */}
        <div className="page-header-row mb-6">
          <div>
            <h1 className="page-title">Courses</h1>
            <p className="page-subtitle">{courses.length} course{courses.length !== 1 ? 's' : ''}</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)} id="create-course-btn">
            + New Course
          </button>
        </div>

        {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}
        {success && <Alert type="success" onClose={() => setSuccess('')}>{success}</Alert>}

        {courses.length === 0 ? (
          <EmptyState
            icon="📚"
            title="No courses yet"
            text="Create your first course to start building training content."
            action={<button className="btn btn-primary" onClick={() => setShowCreate(true)}>Create Course</button>}
          />
        ) : (
          <div className="card">
            <div className="table-wrapper" style={{ border: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map(c => (
                    <tr key={c.id}>
                      <td>
                        <Link
                          to={`/admin/courses/${c.id}`}
                          style={{ color: 'var(--primary)', fontWeight: 600 }}
                          id={`course-link-${c.id}`}
                        >
                          {c.title}
                        </Link>
                        {c.description && (
                          <div className="text-xs text-gray" style={{ marginTop: 2, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.description}
                          </div>
                        )}
                      </td>
                      <td>
                        <Badge variant={c.is_active ? 'success' : 'gray'}>
                          {c.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="text-gray">{formatDate(c.created_at)}</td>
                      <td>
                        <div className="td-actions">
                          <Link to={`/admin/courses/${c.id}`} className="btn btn-outline btn-sm">
                            Manage
                          </Link>
                          {c.is_active ? (
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => setConfirm({ course: c, action: 'deactivate' })}
                              id={`deactivate-course-${c.id}`}
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => setConfirm({ course: c, action: 'activate' })}
                              id={`activate-course-${c.id}`}
                            >
                              Activate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Create Modal */}
        {showCreate && (
          <Modal
            title="Create New Course"
            onClose={() => { setShowCreate(false); setFormError(''); setForm({ title: '', description: '' }); }}
            footer={
              <>
                <button className="btn btn-outline" onClick={() => setShowCreate(false)} disabled={creating}>Cancel</button>
                <button className="btn btn-primary" form="create-course-form" type="submit" disabled={creating} id="submit-create-course">
                  {creating ? <Spinner /> : 'Create Course'}
                </button>
              </>
            }
          >
            {formError && <Alert type="error">{formError}</Alert>}
            <form id="create-course-form" onSubmit={handleCreate} noValidate>
              <div className="form-group">
                <label className="form-label" htmlFor="c-title">Course Title *</label>
                <input id="c-title" type="text" className="form-input" value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Safety & Compliance 2024" required />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="c-desc">Description</label>
                <textarea id="c-desc" className="form-textarea" value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description of this course" />
              </div>
            </form>
          </Modal>
        )}

        {/* Confirm status */}
        {confirm && (
          <ConfirmModal
            title={confirm.action === 'activate' ? 'Activate Course' : 'Deactivate Course'}
            message={
              confirm.action === 'activate'
                ? `Activate "${confirm.course.title}"? Students will be able to be assigned to it.`
                : `Deactivate "${confirm.course.title}"? No new assignments will be possible.`
            }
            onConfirm={handleStatusChange}
            onCancel={() => setConfirm(null)}
            danger={confirm.action === 'deactivate'}
            loading={actionLoading}
          />
        )}
      </div>
    </AdminLayout>
  );
}
