import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import {
  getStudents,
  createStudent,
  activateStudent,
  deactivateStudent,
} from '../../services/api';
import {
  LoadingPage, Alert, Badge, EmptyState,
  Modal, ConfirmModal, Spinner,
} from '../../components/ui';

function validateStudent(name, email) {
  if (!name.trim()) return 'Name is required.';
  if (!email.trim()) return 'Email is required.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Please enter a valid email.';
  return null;
}


export default function AdminStudents() {
  const [students, setStudents] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Create student form
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', email: '' });
  const [formError, setFormError] = useState('');
  const [creating, setCreating] = useState(false);

  // Activate/Deactivate confirm
  const [confirm, setConfirm] = useState(null); // { student, action }
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getStudents();
      setStudents(res.students ?? []);
    } catch (err) {
      setError(err.message || 'Failed to load students');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      students.filter(s =>
        s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
      )
    );
  }, [search, students]);

  async function handleCreate(e) {
    e.preventDefault();
    setFormError('');
    const err = validateStudent(form.name, form.email);
    if (err) { setFormError(err); return; }

    setCreating(true);
    try {
      await createStudent(form.name.trim(), form.email.trim());
      setShowCreate(false);
      setForm({ name: '', email: '' });
      setSuccess('Student created successfully. An activation email has been sent.');
      await load();
    } catch (err) {
      setFormError(err.message || 'Failed to create student');
    } finally {
      setCreating(false);
    }
  }

  async function handleStatusChange() {
    if (!confirm) return;
    setActionLoading(true);
    try {
      if (confirm.action === 'activate') {
        await activateStudent(confirm.student.id);
        setSuccess(`${confirm.student.name} has been activated.`);
      } else {
        await deactivateStudent(confirm.student.id);
        setSuccess(`${confirm.student.name} has been deactivated.`);
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
        <div className="page-container"><LoadingPage message="Loading students…" /></div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="page-container">
        {/* Header */}
        <div className="page-header-row mb-6">
          <div>
            <h1 className="page-title">Students</h1>
            <p className="page-subtitle">{students.length} student{students.length !== 1 ? 's' : ''} registered</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)} id="create-student-btn">
            + Add Student
          </button>
        </div>

        {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}
        {success && <Alert type="success" onClose={() => setSuccess('')}>{success}</Alert>}

        {/* Search */}
        <div className="mb-4">
          <input
            type="search"
            className="search-input"
            placeholder="Search by name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            id="student-search"
          />
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <EmptyState
            icon="👥"
            title="No students found"
            text={search ? `No results for "${search}". Try a different search.` : 'Add your first student to get started.'}
            action={!search && (
              <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                Add Student
              </button>
            )}
          />
        ) : (
          <div className="card">
            <div className="table-wrapper" style={{ border: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => (
                    <tr key={s.id}>
                      <td>
                        <Link
                          to={`/admin/students/${s.id}`}
                          style={{ color: 'var(--primary)', fontWeight: 500 }}
                          id={`student-row-${s.id}`}
                        >
                          {s.name}
                        </Link>
                      </td>
                      <td className="text-gray">{s.email}</td>
                      <td>
                        <Badge variant={s.is_active ? 'success' : 'gray'}>
                          {s.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td>
                        <div className="td-actions">
                          <Link to={`/admin/students/${s.id}`} className="btn btn-outline btn-sm">
                            View
                          </Link>
                          {s.is_active ? (
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => setConfirm({ student: s, action: 'deactivate' })}
                              id={`deactivate-student-${s.id}`}
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => setConfirm({ student: s, action: 'activate' })}
                              id={`activate-student-${s.id}`}
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
            title="Add New Student"
            onClose={() => { setShowCreate(false); setFormError(''); setForm({ name: '', email: '' }); }}
            footer={
              <>
                <button className="btn btn-outline" onClick={() => setShowCreate(false)} disabled={creating}>Cancel</button>
                <button className="btn btn-primary" form="create-student-form" type="submit" disabled={creating} id="submit-create-student">
                  {creating ? <Spinner /> : 'Create Student'}
                </button>
              </>
            }
          >
            {formError && <Alert type="error">{formError}</Alert>}
            <form id="create-student-form" onSubmit={handleCreate} noValidate>
              <p style={{ fontSize: '0.875rem', color: 'var(--gray-600)', marginBottom: '1rem' }}>
                An invitation email with an activation link will be sent to the student. They will set their own password during activation.
              </p>
              <div className="form-group">
                <label className="form-label" htmlFor="s-name">Full Name</label>
                <input id="s-name" type="text" className="form-input" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Jane Smith" required />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="s-email">Email</label>
                <input id="s-email" type="email" className="form-input" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@example.com" required />
              </div>
            </form>

          </Modal>
        )}

        {/* Confirm action */}
        {confirm && (
          <ConfirmModal
            title={confirm.action === 'activate' ? 'Activate Student' : 'Deactivate Student'}
            message={
              confirm.action === 'activate'
                ? `Activate ${confirm.student.name}? They will be able to log in and access their courses.`
                : `Deactivate ${confirm.student.name}? They will no longer be able to log in.`
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
