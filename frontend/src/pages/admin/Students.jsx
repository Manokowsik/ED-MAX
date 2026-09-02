import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import {
  getStudents,
  getCourses,
  createStudent,
  activateStudent,
  deactivateStudent,
} from '../../services/api';
import {
  LoadingPage,
  Alert,
  Badge,
  EmptyState,
  Modal,
  ConfirmModal,
  Spinner,
} from '../../components/ui';

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const MESSAGES = Object.freeze({
  LOAD_FAILED: 'Failed to load students data. Please refresh.',
  NAME_REQUIRED: 'Name is required.',
  EMAIL_REQUIRED: 'Email is required.',
  INVALID_EMAIL: 'Please enter a valid email address.',
  CREATE_SUCCESS: 'Student saved successfully.',
  CREATE_FAILED: 'Failed to create student.',
  STATUS_FAILED: 'Failed to update student status. Please try again.',
  DEACTIVATE_CONFIRM: (name) => `Deactivate ${name}? They will no longer be able to log in.`,
  ACTIVATE_CONFIRM: (name) => `Activate ${name}? They will be able to log in and access their courses.`,
});

// ============================================================================
// PURE UTILITIES (Unit-testable)
// ============================================================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates student creation input fields.
 * @param {string} name 
 * @param {string} email 
 * @returns {string | null}
 */
const validateStudent = (name, email) => {
  if (!name.trim()) return MESSAGES.NAME_REQUIRED;
  if (!email.trim()) return MESSAGES.EMAIL_REQUIRED;
  if (!EMAIL_REGEX.test(email.trim())) return MESSAGES.INVALID_EMAIL;
  return null;
};

// ============================================================================
// SUB-COMPONENT: Student Table Row
// ============================================================================

const StudentTableRow = React.memo(function StudentTableRow({
  student,
  onInitiateStatusChange,
}) {
  return (
    <tr>
      <td>
        <Link
          to={`/admin/students/${student.id}`}
          style={STYLES.primaryLink}
          id={`student-row-${student.id}`}
        >
          {student.name}
        </Link>
      </td>
      <td className="text-gray">{student.email}</td>
      <td>
        <Badge variant={student.is_active ? 'success' : 'gray'}>
          {student.is_active ? 'Active' : 'Inactive'}
        </Badge>
      </td>
      <td>
        <div className="td-actions">
          <Link
            to={`/admin/students/${student.id}`}
            className="btn btn-outline btn-sm"
            aria-label={`View profile for ${student.name}`}
          >
            View
          </Link>
          {student.is_active ? (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => onInitiateStatusChange(student, 'deactivate')}
              id={`deactivate-student-${student.id}`}
              aria-label={`Deactivate student ${student.name}`}
            >
              Deactivate
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-success btn-sm"
              onClick={() => onInitiateStatusChange(student, 'activate')}
              id={`activate-student-${student.id}`}
              aria-label={`Activate student ${student.name}`}
            >
              Activate
            </button>
          )}
        </div>
      </td>
    </tr>
  );
});

// ============================================================================
// SUB-COMPONENT: Add Student Modal
// ============================================================================

const AddStudentModal = React.memo(function AddStudentModal({
  isOpen,
  courses,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState({ name: '', email: '', courseId: '' });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm({ name: '', email: '', courseId: '' });
      setFormError('');
    }
  }, [isOpen]);

  const activeCourses = useMemo(
    () => courses.filter((c) => c.is_active),
    [courses]
  );

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const validationError = validateStudent(form.name, form.email);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: form.name.trim(),
        email: form.email.trim(),
        courseId: form.courseId ? Number(form.courseId) : null,
      });
      onClose();
    } catch (err) {
      setFormError(err.message || MESSAGES.CREATE_FAILED);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      title="Add New Student"
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="btn btn-outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            form="create-student-form"
            disabled={isSubmitting}
            id="submit-create-student"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Spinner /> Saving…
              </span>
            ) : (
              'Create Student'
            )}
          </button>
        </>
      }
    >
      {formError && (
        <Alert type="error" aria-live="assertive">
          {formError}
        </Alert>
      )}

      <form id="create-student-form" onSubmit={handleSubmit} noValidate>
        <p style={STYLES.modalNotice}>
          An invitation email with an activation link will be sent to the student.
          They will configure their credentials upon activation.
        </p>

        <div className="form-group">
          <label className="form-label" htmlFor="s-name">
            Full Name *
          </label>
          <input
            id="s-name"
            type="text"
            className="form-input"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Jane Smith"
            required
            disabled={isSubmitting}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="s-email">
            Email Address *
          </label>
          <input
            id="s-email"
            type="email"
            className="form-input"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="jane@example.com"
            required
            disabled={isSubmitting}
          />
        </div>

        <div className="form-group" style={STYLES.selectContainer}>
          <label className="form-label" htmlFor="s-course">
            Enroll in Course (Optional)
          </label>
          <select
            id="s-course"
            className="form-select"
            value={form.courseId}
            onChange={(e) => setForm((prev) => ({ ...prev, courseId: e.target.value }))}
            disabled={isSubmitting}
          >
            <option value="">-- None / Select later --</option>
            {activeCourses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <span style={STYLES.hintText}>
            If this student is already registered, selecting a course will immediately
            enroll them and notify them via email.
          </span>
        </div>
      </form>
    </Modal>
  );
});

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function AdminStudents() {
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [notification, setNotification] = useState({ type: '', text: '' });

  // Create Student Modal State
  const [showCreate, setShowCreate] = useState(false);

  // Status Action Modal State
  const [confirmStatus, setConfirmStatus] = useState(null); // { student, action }
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setPageError('');
    try {
      const [stRes, cRes] = await Promise.all([getStudents(), getCourses()]);
      setStudents(stRes.students ?? []);
      setCourses(cRes.courses ?? []);
    } catch (err) {
      setPageError(err.message || MESSAGES.LOAD_FAILED);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Pure memoized search filter (eliminates useEffect state mirroring)
  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return students;
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.email.toLowerCase().includes(query)
    );
  }, [search, students]);

  // Action: Create Student
  const handleCreateStudent = useCallback(
    async ({ name, email, courseId }) => {
      const res = await createStudent(name, email, courseId);
      setNotification({
        type: 'success',
        text: res.message || MESSAGES.CREATE_SUCCESS,
      });
      await loadData();
    },
    [loadData]
  );

  // Action: Status Toggle (Activate/Deactivate)
  const handleStatusChange = useCallback(async () => {
    if (!confirmStatus) return;
    const { student, action } = confirmStatus;

    setActionLoading(true);
    try {
      if (action === 'activate') {
        await activateStudent(student.id);
        setNotification({
          type: 'success',
          text: `${student.name} has been activated.`,
        });
      } else {
        await deactivateStudent(student.id);
        setNotification({
          type: 'success',
          text: `${student.name} has been deactivated.`,
        });
      }
      setConfirmStatus(null);
      await loadData();
    } catch (err) {
      setPageError(err.message || MESSAGES.STATUS_FAILED);
      setConfirmStatus(null);
    } finally {
      setActionLoading(false);
    }
  }, [confirmStatus, loadData]);

  const clearNotification = useCallback(() => {
    setNotification({ type: '', text: '' });
  }, []);

  if (loading) {
    return (
      <AdminLayout>
        <div className="page-container">
          <LoadingPage message="Loading students roster…" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="page-container">
        {/* Page Header */}
        <header className="page-header-row mb-6">
          <div>
            <h1 className="page-title">Students</h1>
            <p className="page-subtitle">
              {students.length} {students.length === 1 ? 'student' : 'students'} registered
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowCreate(true)}
            id="create-student-btn"
          >
            + Add Student
          </button>
        </header>

        {/* Global Notifications */}
        {pageError && (
          <Alert type="error" onClose={() => setPageError('')} aria-live="assertive">
            {pageError}
          </Alert>
        )}
        {notification.text && (
          <Alert
            type={notification.type}
            onClose={clearNotification}
            aria-live="polite"
          >
            {notification.text}
          </Alert>
        )}

        {/* Search Input Box */}
        <div className="mb-4">
          <input
            id="student-search"
            type="search"
            className="search-input"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Filter students by name or email"
          />
        </div>

        {/* Data Table or Empty State View */}
        {filteredStudents.length === 0 ? (
          <EmptyState
            icon="👥"
            title="No students found"
            text={
              search
                ? `No results for "${search}". Try a different search.`
                : 'Add your first student to get started.'
            }
            action={
              !search && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setShowCreate(true)}
                >
                  Add Student
                </button>
              )
            }
          />
        ) : (
          <section className="card" aria-label="Students Directory">
            <div className="table-wrapper" style={STYLES.tableWrapper}>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Email</th>
                    <th scope="col">Status</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((s) => (
                    <StudentTableRow
                      key={s.id}
                      student={s}
                      onInitiateStatusChange={(student, action) =>
                        setConfirmStatus({ student, action })
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Isolated Add Student Modal */}
        <AddStudentModal
          isOpen={showCreate}
          courses={courses}
          onClose={() => setShowCreate(false)}
          onSubmit={handleCreateStudent}
        />

        {/* Status Confirmation Modal */}
        {confirmStatus && (
          <ConfirmModal
            title={confirmStatus.action === 'activate' ? 'Activate Student' : 'Deactivate Student'}
            message={
              confirmStatus.action === 'activate'
                ? MESSAGES.ACTIVATE_CONFIRM(confirmStatus.student.name)
                : MESSAGES.DEACTIVATE_CONFIRM(confirmStatus.student.name)
            }
            onConfirm={handleStatusChange}
            onCancel={() => setConfirmStatus(null)}
            danger={confirmStatus.action === 'deactivate'}
            loading={actionLoading}
          />
        )}
      </div>
    </AdminLayout>
  );
}

// ============================================================================
// STYLES (Frozen layout tokens)
// ============================================================================

const STYLES = Object.freeze({
  primaryLink: {
    color: 'var(--primary)',
    fontWeight: 500,
  },
  tableWrapper: {
    border: 'none',
  },
  modalNotice: {
    fontSize: '0.875rem',
    color: 'var(--gray-600)',
    marginBottom: '1rem',
  },
  selectContainer: {
    marginTop: '1rem',
  },
  hintText: {
    fontSize: '0.75rem',
    color: 'var(--gray-500)',
    marginTop: '0.35rem',
    display: 'block',
  },
});