import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import {
  getCourses,
  getStudents,
  assignCourse,
  unassignCourse,
  getStudentAssignedCourses,
} from '../../services/api';
import { LoadingPage, Alert, EmptyState, Modal, ConfirmModal, Spinner } from '../../components/ui';

export default function AdminAssignments() {
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Assign form
  const [form, setForm] = useState({ courseId: '', studentId: '' });
  const [assigning, setAssigning] = useState(false);
  const [formError, setFormError] = useState('');

  // Preview: selected student's courses
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [studentCourses, setStudentCourses] = useState([]);
  const [loadingStudentCourses, setLoadingStudentCourses] = useState(false);

  // Unassign confirm
  const [confirmUnassign, setConfirmUnassign] = useState(null);
  const [unassigning, setUnassigning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [coursesRes, studentsRes] = await Promise.all([getCourses(), getStudents()]);
      setCourses(coursesRes.courses ?? []);
      setStudents(studentsRes.students ?? []);
    } catch (err) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Load selected student courses preview
  useEffect(() => {
    if (!selectedStudentId) { setStudentCourses([]); return; }
    setLoadingStudentCourses(true);
    getStudentAssignedCourses(Number(selectedStudentId))
      .then(res => setStudentCourses(res.courses ?? []))
      .catch(() => setStudentCourses([]))
      .finally(() => setLoadingStudentCourses(false));
  }, [selectedStudentId]);

  async function handleAssign(e) {
    e.preventDefault();
    setFormError('');
    if (!form.courseId) { setFormError('Please select a course.'); return; }
    if (!form.studentId) { setFormError('Please select a student.'); return; }

    setAssigning(true);
    try {
      await assignCourse(Number(form.courseId), Number(form.studentId));
      setSuccess('Course assigned successfully.');
      setForm({ courseId: '', studentId: '' });
      if (selectedStudentId === form.studentId) {
        // Refresh the student course list
        const res = await getStudentAssignedCourses(Number(form.studentId));
        setStudentCourses(res.courses ?? []);
      }
    } catch (err) {
      setFormError(err.message || 'Failed to assign course');
    } finally {
      setAssigning(false);
    }
  }

  async function handleUnassign() {
    if (!confirmUnassign) return;
    setUnassigning(true);
    try {
      await unassignCourse(confirmUnassign.courseId, confirmUnassign.studentId);
      setSuccess('Assignment removed.');
      setConfirmUnassign(null);
      if (selectedStudentId) {
        const res = await getStudentAssignedCourses(Number(selectedStudentId));
        setStudentCourses(res.courses ?? []);
      }
    } catch (err) {
      setError(err.message || 'Failed to remove assignment');
      setConfirmUnassign(null);
    } finally {
      setUnassigning(false);
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="page-container"><LoadingPage message="Loading…" /></div>
      </AdminLayout>
    );
  }

  const activeCourses = courses.filter(c => c.is_active);
  const activeStudents = students.filter(s => s.is_active);

  return (
    <AdminLayout>
      <div className="page-container">
        <div className="page-header mb-6">
          <h1 className="page-title">Assignments</h1>
          <p className="page-subtitle">Assign and manage course assignments for students</p>
        </div>

        {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}
        {success && <Alert type="success" onClose={() => setSuccess('')}>{success}</Alert>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)', alignItems: 'start' }}>
          {/* Assign Form */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Assign Course to Student</h2>
            </div>
            <div className="card-body">
              {formError && <Alert type="error">{formError}</Alert>}
              <form onSubmit={handleAssign} noValidate>
                <div className="form-group">
                  <label className="form-label" htmlFor="assign-course">Course (active only)</label>
                  <select
                    id="assign-course"
                    className="form-select"
                    value={form.courseId}
                    onChange={e => setForm(f => ({ ...f, courseId: e.target.value }))}
                  >
                    <option value="">Select course…</option>
                    {activeCourses.map(c => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                  {activeCourses.length === 0 && (
                    <span className="form-hint">No active courses. Activate a course first.</span>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="assign-student">Student (active only)</label>
                  <select
                    id="assign-student"
                    className="form-select"
                    value={form.studentId}
                    onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))}
                  >
                    <option value="">Select student…</option>
                    {activeStudents.map(s => (
                      <option key={s.id} value={s.id}>{s.name} — {s.email}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className="btn btn-primary btn-full"
                  disabled={assigning || !form.courseId || !form.studentId}
                  id="submit-assignment-btn"
                >
                  {assigning ? <><Spinner /> Assigning…</> : 'Assign Course'}
                </button>
              </form>
            </div>
          </div>

          {/* Student Course Preview */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Student Course View</h2>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label" htmlFor="preview-student">Select a student to view their assignments</label>
                <select
                  id="preview-student"
                  className="form-select"
                  value={selectedStudentId}
                  onChange={e => setSelectedStudentId(e.target.value)}
                >
                  <option value="">Select student…</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {loadingStudentCourses ? (
                <div className="loading-page" style={{ minHeight: 80 }}><Spinner /></div>
              ) : !selectedStudentId ? (
                <EmptyState icon="👆" title="Select a student" text="Choose a student above to see their assigned courses." />
              ) : studentCourses.length === 0 ? (
                <EmptyState icon="📚" title="No courses assigned" text="This student has no courses yet." />
              ) : (
                <div>
                  {studentCourses.map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3) 0', borderBottom: '1px solid var(--gray-100)' }}>
                      <div>
                        <div className="text-sm font-semibold" style={{ color: 'var(--gray-800)' }}>{c.title}</div>
                        <div className="text-xs text-gray">{c.status}</div>
                      </div>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => setConfirmUnassign({ courseId: c.id, studentId: Number(selectedStudentId), title: c.title })}
                        id={`unassign-preview-${c.id}`}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {confirmUnassign && (
          <ConfirmModal
            title="Remove Assignment"
            message={`Remove "${confirmUnassign.title}" from this student?`}
            onConfirm={handleUnassign}
            onCancel={() => setConfirmUnassign(null)}
            danger
            loading={unassigning}
          />
        )}
      </div>
    </AdminLayout>
  );
}
