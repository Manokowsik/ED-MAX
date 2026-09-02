import React, { useState, useEffect, useCallback, useMemo } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import {
  getCourses,
  getStudents,
  assignCourse,
  unassignCourse,
  getStudentAssignedCourses,
} from '../../services/api';
import {
  LoadingPage,
  Alert,
  EmptyState,
  ConfirmModal,
  Spinner,
} from '../../components/ui';

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const MESSAGES = Object.freeze({
  LOAD_FAILED: 'Failed to load initial data. Please reload the page.',
  ASSIGN_SUCCESS: 'Course assigned successfully.',
  ASSIGN_FAILED: 'Failed to assign course. Please try again.',
  UNASSIGN_SUCCESS: 'Assignment removed successfully.',
  UNASSIGN_FAILED: 'Failed to remove assignment. Please try again.',
  SELECT_COURSE_ERR: 'Please select a course.',
  SELECT_STUDENT_ERR: 'Please select a student.',
});

// ============================================================================
// CUSTOM HOOK: Data Management & State Orchestration
// ============================================================================

function useAdminAssignments() {
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [notification, setNotification] = useState({ type: '', text: '' });

  // Student Courses Preview State
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [studentCourses, setStudentCourses] = useState([]);
  const [loadingStudentCourses, setLoadingStudentCourses] = useState(false);

  // Unassign Modal Confirmation State
  const [confirmUnassign, setConfirmUnassign] = useState(null);
  const [unassigning, setUnassigning] = useState(false);

  // Initial Data Fetch
  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    setPageError('');
    try {
      const [coursesRes, studentsRes] = await Promise.all([
        getCourses(),
        getStudents(),
      ]);
      setCourses(coursesRes?.courses ?? []);
      setStudents(studentsRes?.students ?? []);
    } catch (err) {
      setPageError(err.message || MESSAGES.LOAD_FAILED);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Synchronize student course preview with race condition protection
  const fetchStudentCourses = useCallback(async (studentId, isCurrentFlag) => {
    if (!studentId) {
      setStudentCourses([]);
      return;
    }

    setLoadingStudentCourses(true);
    try {
      const res = await getStudentAssignedCourses(Number(studentId));
      if (isCurrentFlag.current) {
        setStudentCourses(res?.courses ?? []);
      }
    } catch {
      if (isCurrentFlag.current) {
        setStudentCourses([]);
      }
    } finally {
      if (isCurrentFlag.current) {
        setLoadingStudentCourses(false);
      }
    }
  }, []);

  useEffect(() => {
    const isCurrent = { current: true };
    fetchStudentCourses(selectedStudentId, isCurrent);

    return () => {
      isCurrent.current = false;
    };
  }, [selectedStudentId, fetchStudentCourses]);

  // Memoized Filter Computations
  const activeCourses = useMemo(() => courses.filter((c) => c.is_active), [courses]);
  const activeStudents = useMemo(() => students.filter((s) => s.is_active), [students]);

  // Assignment Mutations
  const executeAssignment = useCallback(
    async (courseId, studentId) => {
      await assignCourse(Number(courseId), Number(studentId));
      setNotification({ type: 'success', text: MESSAGES.ASSIGN_SUCCESS });

      // Refresh preview if the modified student is currently viewed
      if (Number(selectedStudentId) === Number(studentId)) {
        const isCurrent = { current: true };
        fetchStudentCourses(studentId, isCurrent);
      }
    },
    [selectedStudentId, fetchStudentCourses]
  );

  const executeUnassignment = useCallback(async () => {
    if (!confirmUnassign) return;
    setUnassigning(true);

    try {
      await unassignCourse(confirmUnassign.courseId, confirmUnassign.studentId);
      setNotification({ type: 'success', text: MESSAGES.UNASSIGN_SUCCESS });
      setConfirmUnassign(null);

      if (selectedStudentId) {
        const isCurrent = { current: true };
        fetchStudentCourses(selectedStudentId, isCurrent);
      }
    } catch (err) {
      setNotification({
        type: 'error',
        text: err.message || MESSAGES.UNASSIGN_FAILED,
      });
      setConfirmUnassign(null);
    } finally {
      setUnassigning(false);
    }
  }, [confirmUnassign, selectedStudentId, fetchStudentCourses]);

  const clearNotification = useCallback(() => setNotification({ type: '', text: '' }), []);

  return {
    loading,
    pageError,
    setPageError,
    notification,
    clearNotification,
    courses,
    students,
    activeCourses,
    activeStudents,
    selectedStudentId,
    setSelectedStudentId,
    studentCourses,
    loadingStudentCourses,
    confirmUnassign,
    setConfirmUnassign,
    unassigning,
    executeAssignment,
    executeUnassignment,
  };
}

// ============================================================================
// SUB-COMPONENT: Assignment Form Card
// ============================================================================

const AssignCourseCard = React.memo(
  ({ activeCourses, activeStudents, onAssign }) => {
    const [form, setForm] = useState({ courseId: '', studentId: '' });
    const [formError, setFormError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
      e.preventDefault();
      setFormError('');

      if (!form.courseId) {
        setFormError(MESSAGES.SELECT_COURSE_ERR);
        return;
      }
      if (!form.studentId) {
        setFormError(MESSAGES.SELECT_STUDENT_ERR);
        return;
      }

      setSubmitting(true);
      try {
        await onAssign(form.courseId, form.studentId);
        setForm({ courseId: '', studentId: '' });
      } catch (err) {
        setFormError(err.message || MESSAGES.ASSIGN_FAILED);
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Assign Course to Student</h2>
        </div>
        <div className="card-body">
          {formError && (
            <Alert type="error" onClose={() => setFormError('')}>
              {formError}
            </Alert>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="assign-course">
                Course (active only)
              </label>
              <select
                id="assign-course"
                className="form-select"
                value={form.courseId}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, courseId: e.target.value }));
                  if (formError) setFormError('');
                }}
                disabled={submitting}
              >
                <option value="">Select course…</option>
                {activeCourses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
              {activeCourses.length === 0 && (
                <span className="form-hint">
                  No active courses. Activate a course first.
                </span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="assign-student">
                Student (active only)
              </label>
              <select
                id="assign-student"
                className="form-select"
                value={form.studentId}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, studentId: e.target.value }));
                  if (formError) setFormError('');
                }}
                disabled={submitting}
              >
                <option value="">Select student…</option>
                {activeStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.email}
                  </option>
                ))}
              </select>
            </div>

            <button
              id="submit-assignment-btn"
              type="submit"
              className="btn btn-primary btn-full"
              disabled={submitting || !form.courseId || !form.studentId}
              aria-busy={submitting}
            >
              {submitting ? (
                <span className="flex items-center gap-2 justify-center">
                  <Spinner /> Assigning…
                </span>
              ) : (
                'Assign Course'
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }
);
AssignCourseCard.displayName = 'AssignCourseCard';

// ============================================================================
// SUB-COMPONENT: Student Assignments Preview Card
// ============================================================================

const StudentPreviewCard = React.memo(
  ({
    students,
    selectedStudentId,
    onSelectStudent,
    studentCourses,
    loadingCourses,
    onRequestUnassign,
  }) => {
    return (
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Student Course View</h2>
        </div>
        <div className="card-body">
          <div className="form-group">
            <label className="form-label" htmlFor="preview-student">
              Select a student to view their assignments
            </label>
            <select
              id="preview-student"
              className="form-select"
              value={selectedStudentId}
              onChange={(e) => onSelectStudent(e.target.value)}
            >
              <option value="">Select student…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {loadingCourses ? (
            <div style={STYLES.loadingWrapper}>
              <Spinner />
            </div>
          ) : !selectedStudentId ? (
            <EmptyState
              icon="👆"
              title="Select a student"
              text="Choose a student above to see their assigned courses."
            />
          ) : studentCourses.length === 0 ? (
            <EmptyState
              icon="📚"
              title="No courses assigned"
              text="This student has no courses yet."
            />
          ) : (
            <div role="list">
              {studentCourses.map((c) => (
                <div key={c.id} style={STYLES.courseItem} role="listitem">
                  <div>
                    <div className="text-sm font-semibold" style={STYLES.courseTitle}>
                      {c.title}
                    </div>
                    <div className="text-xs text-gray">{c.status}</div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() =>
                      onRequestUnassign({
                        courseId: c.id,
                        studentId: Number(selectedStudentId),
                        title: c.title,
                      })
                    }
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
    );
  }
);
StudentPreviewCard.displayName = 'StudentPreviewCard';

// ============================================================================
// MAIN PAGE VIEW
// ============================================================================

export default function AdminAssignments() {
  const {
    loading,
    pageError,
    setPageError,
    notification,
    clearNotification,
    students,
    activeCourses,
    activeStudents,
    selectedStudentId,
    setSelectedStudentId,
    studentCourses,
    loadingStudentCourses,
    confirmUnassign,
    setConfirmUnassign,
    unassigning,
    executeAssignment,
    executeUnassignment,
  } = useAdminAssignments();

  if (loading) {
    return (
      <AdminLayout>
        <div className="page-container">
          <LoadingPage message="Loading assignment data…" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="page-container">
        <header className="page-header mb-6">
          <h1 className="page-title">Assignments</h1>
          <p className="page-subtitle">
            Assign and manage course assignments for students
          </p>
        </header>

        {/* Global Page Alerts */}
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

        {/* 2-Column Responsive Workspace */}
        <section style={STYLES.gridContainer}>
          <AssignCourseCard
            activeCourses={activeCourses}
            activeStudents={activeStudents}
            onAssign={executeAssignment}
          />
          <StudentPreviewCard
            students={students}
            selectedStudentId={selectedStudentId}
            onSelectStudent={setSelectedStudentId}
            studentCourses={studentCourses}
            loadingCourses={loadingStudentCourses}
            onRequestUnassign={setConfirmUnassign}
          />
        </section>

        {/* Destructive Action Modal */}
        {confirmUnassign && (
          <ConfirmModal
            title="Remove Assignment"
            message={`Are you sure you want to remove "${confirmUnassign.title}" from this student?`}
            onConfirm={executeUnassignment}
            onCancel={() => setConfirmUnassign(null)}
            danger
            loading={unassigning}
          />
        )}
      </div>
    </AdminLayout>
  );
}

// ============================================================================
// STYLES (Frozen to prevent garbage collection strain)
// ============================================================================

const STYLES = Object.freeze({
  gridContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
    gap: 'var(--space-6)',
    alignItems: 'start',
  },
  courseItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 'var(--space-3) 0',
    borderBottom: '1px solid var(--gray-100)',
  },
  courseTitle: {
    color: 'var(--gray-800)',
  },
  loadingWrapper: {
    minHeight: '80px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
});