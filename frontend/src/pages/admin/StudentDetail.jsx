import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import {
  getStudentAssignedCourses,
  unassignCourse,
} from '../../services/api';
import { LoadingPage, Alert, Badge, EmptyState, ConfirmModal } from '../../components/ui';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AdminStudentDetail() {
  const { studentId } = useParams();
  const [data, setData] = useState(null); // { student, courses }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirm, setConfirm] = useState(null); // course to unassign
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getStudentAssignedCourses(Number(studentId));
      setData(res);
    } catch (err) {
      setError(err.message || 'Failed to load student details');
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => { load(); }, [load]);

  async function handleUnassign() {
    if (!confirm) return;
    setActionLoading(true);
    try {
      await unassignCourse(confirm.id, Number(studentId));
      setSuccess(`Removed "${confirm.title}" from this student.`);
      setConfirm(null);
      await load();
    } catch (err) {
      setError(err.message || 'Failed to remove assignment');
      setConfirm(null);
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="page-container"><LoadingPage message="Loading student…" /></div>
      </AdminLayout>
    );
  }

  const student = data?.student;
  const courses = data?.courses ?? [];

  return (
    <AdminLayout>
      <div className="page-container">
        {/* Breadcrumb */}
        <div className="mb-4">
          <Link to="/admin/students" className="text-gray text-sm">← Back to Students</Link>
        </div>

        {/* Header */}
        <div className="page-header-row mb-6">
          <div>
            <h1 className="page-title">{student?.name ?? `Student #${studentId}`}</h1>
            <p className="page-subtitle">{student?.email}</p>
          </div>
          <Link to="/admin/assignments" className="btn btn-primary" id="assign-course-link">
            + Assign Course
          </Link>
        </div>

        {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}
        {success && <Alert type="success" onClose={() => setSuccess('')}>{success}</Alert>}

        {/* Assigned Courses */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Assigned Courses</h2>
            <span className="text-xs text-gray">{courses.length} course{courses.length !== 1 ? 's' : ''}</span>
          </div>
          {courses.length === 0 ? (
            <div className="card-body">
              <EmptyState
                icon="📚"
                title="No courses assigned"
                text="This student has no courses assigned yet."
                action={
                  <Link to="/admin/assignments" className="btn btn-primary">
                    Assign a Course
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="table-wrapper" style={{ border: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Status</th>
                    <th>Assigned</th>
                    <th>Completed</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map(c => (
                    <tr key={c.id}>
                      <td>
                        <Link to={`/admin/courses/${c.id}`} style={{ color: 'var(--primary)', fontWeight: 500 }}>
                          {c.title}
                        </Link>
                      </td>
                      <td>
                        <Badge variant={c.status === 'COMPLETED' ? 'success' : c.status === 'ASSIGNED' ? 'primary' : 'gray'}>
                          {c.status}
                        </Badge>
                      </td>
                      <td className="text-gray">{formatDate(c.assigned_at)}</td>
                      <td className="text-gray">{formatDate(c.completed_at)}</td>
                      <td>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => setConfirm(c)}
                          id={`unassign-course-${c.id}`}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Confirm unassign */}
        {confirm && (
          <ConfirmModal
            title="Remove Course Assignment"
            message={`Remove "${confirm.title}" from this student? Their progress data will be lost.`}
            onConfirm={handleUnassign}
            onCancel={() => setConfirm(null)}
            danger
            loading={actionLoading}
          />
        )}
      </div>
    </AdminLayout>
  );
}
