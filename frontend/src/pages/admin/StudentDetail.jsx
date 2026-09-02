import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import {
  getStudentAssignedCourses,
  unassignCourse,
} from '../../services/api';
import {
  LoadingPage,
  Alert,
  Badge,
  EmptyState,
  ConfirmModal,
} from '../../components/ui';

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const MESSAGES = Object.freeze({
  LOAD_FAILED: 'Failed to load student details.',
  INVALID_ID: 'Invalid student identifier provided.',
  UNASSIGN_SUCCESS: (title) => `Removed "${title}" from this student.`,
  UNASSIGN_FAILED: 'Failed to remove assignment. Please try again.',
});

const BADGE_VARIANTS = Object.freeze({
  COMPLETED: 'success',
  ASSIGNED: 'primary',
  IN_PROGRESS: 'info',
  DEFAULT: 'gray',
});

// ============================================================================
// UTILITIES (Pure, Isolated Functions)
// ============================================================================

/**
 * Formats an ISO string into standard US date format safely.
 * @param {string | null | undefined} isoDate 
 * @returns {string}
 */
const formatDate = (isoDate) => {
  if (!isoDate) return '—';
  const timestamp = new Date(isoDate).getTime();
  if (Number.isNaN(timestamp)) return '—';

  return new Date(isoDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Resolves badge style variant from status strings.
 * @param {string} status 
 * @returns {string}
 */
const getStatusBadgeVariant = (status) => {
  return BADGE_VARIANTS[status] || BADGE_VARIANTS.DEFAULT;
};

// ============================================================================
// SUB-COMPONENT: Course Row Item
// ============================================================================

const CourseRowItem = React.memo(function CourseRowItem({
  course,
  onInitiateUnassign,
}) {
  return (
    <tr>
      <td>
        <Link
          to={`/admin/courses/${course.id}`}
          style={STYLES.courseLink}
        >
          {course.title}
        </Link>
      </td>
      <td>
        <Badge variant={getStatusBadgeVariant(course.status)}>
          {course.status}
        </Badge>
      </td>
      <td className="text-gray">
        {course.assigned_at ? (
          <time dateTime={course.assigned_at}>{formatDate(course.assigned_at)}</time>
        ) : (
          '—'
        )}
      </td>
      <td className="text-gray">
        {course.completed_at ? (
          <time dateTime={course.completed_at}>{formatDate(course.completed_at)}</time>
        ) : (
          '—'
        )}
      </td>
      <td>
        <button
          type="button"
          className="btn btn-danger btn-sm"
          onClick={() => onInitiateUnassign(course)}
          id={`unassign-course-${course.id}`}
          aria-label={`Remove course ${course.title} from student`}
        >
          Remove
        </button>
      </td>
    </tr>
  );
});

// ============================================================================
// MAIN VIEW COMPONENT
// ============================================================================

export default function AdminStudentDetail() {
  const { studentId } = useParams();
  const parsedStudentId = useMemo(() => Number(studentId), [studentId]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState({ type: '', text: '' });

  // Unassign dialog state
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Guard against out-of-order responses across ID transitions
  const activeRequestId = useRef(0);

  const loadStudentData = useCallback(async () => {
    if (!Number.isFinite(parsedStudentId)) {
      setError(MESSAGES.INVALID_ID);
      setLoading(false);
      return;
    }

    const currentReqId = ++activeRequestId.current;
    setLoading(true);
    setError('');

    try {
      const res = await getStudentAssignedCourses(parsedStudentId);
      if (currentReqId === activeRequestId.current) {
        setData(res);
      }
    } catch (err) {
      if (currentReqId === activeRequestId.current) {
        setError(err.message || MESSAGES.LOAD_FAILED);
      }
    } finally {
      if (currentReqId === activeRequestId.current) {
        setLoading(false);
      }
    }
  }, [parsedStudentId]);

  useEffect(() => {
    loadStudentData();
  }, [loadStudentData]);

  // Unassign Execution (Optimistic UI with Rollback)
  const handleUnassign = useCallback(async () => {
    if (!confirmTarget || !Number.isFinite(parsedStudentId)) return;

    const targetCourse = confirmTarget;
    const previousData = data;

    // Optimistic cache update
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        courses: (prev.courses ?? []).filter((c) => c.id !== targetCourse.id),
      };
    });

    setActionLoading(true);
    setConfirmTarget(null);

    try {
      await unassignCourse(targetCourse.id, parsedStudentId);
      setNotification({
        type: 'success',
        text: MESSAGES.UNASSIGN_SUCCESS(targetCourse.title),
      });
    } catch (err) {
      // Revert optimistic state on failure
      setData(previousData);
      setNotification({
        type: 'error',
        text: err.message || MESSAGES.UNASSIGN_FAILED,
      });
    } finally {
      setActionLoading(false);
    }
  }, [confirmTarget, parsedStudentId, data]);

  const clearNotification = useCallback(() => {
    setNotification({ type: '', text: '' });
  }, []);

  if (loading) {
    return (
      <AdminLayout>
        <div className="page-container">
          <LoadingPage message="Loading student profile…" />
        </div>
      </AdminLayout>
    );
  }

  const student = data?.student;
  const courses = data?.courses ?? [];

  return (
    <AdminLayout>
      <div className="page-container">
        {/* Navigation Breadcrumb */}
        <nav className="mb-4" aria-label="Breadcrumb">
          <Link to="/admin/students" className="text-gray text-sm">
            ← Back to Students
          </Link>
        </nav>

        {/* Profile Header */}
        <header className="page-header-row mb-6">
          <div>
            <h1 className="page-title">
              {student?.name ?? `Student #${studentId}`}
            </h1>
            <p className="page-subtitle">
              {student?.email || 'No email registered'}
            </p>
          </div>
          <Link
            to={`/admin/courses?tab=assign&studentId=${parsedStudentId}`}
            className="btn btn-primary"
            id="assign-course-link"
          >
            + Assign Course
          </Link>
        </header>

        {/* Global Feedback Notifications */}
        {error && (
          <Alert type="error" onClose={() => setError('')} aria-live="assertive">
            {error}
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

        {/* Assigned Courses Section */}
        <section className="card" aria-labelledby="assigned-courses-title">
          <div className="card-header flex justify-between items-center">
            <h2 id="assigned-courses-title" className="card-title">
              Assigned Courses
            </h2>
            <span className="text-xs text-gray">
              {courses.length} {courses.length === 1 ? 'course' : 'courses'}
            </span>
          </div>

          {courses.length === 0 ? (
            <div className="card-body">
              <EmptyState
                icon="📚"
                title="No courses assigned"
                text="This student has no courses assigned yet."
                action={
                  <Link
                    to={`/admin/courses?tab=assign&studentId=${parsedStudentId}`}
                    className="btn btn-primary"
                  >
                    Assign a Course
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="table-wrapper" style={STYLES.tableWrapper}>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Course</th>
                    <th scope="col">Status</th>
                    <th scope="col">Assigned</th>
                    <th scope="col">Completed</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map((course) => (
                    <CourseRowItem
                      key={course.id}
                      course={course}
                      onInitiateUnassign={setConfirmTarget}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Destructive Action Modal */}
        {confirmTarget && (
          <ConfirmModal
            title="Remove Course Assignment"
            message={`Remove "${confirmTarget.title}" from this student? Their progress data will be lost.`}
            onConfirm={handleUnassign}
            onCancel={() => setConfirmTarget(null)}
            danger
            loading={actionLoading}
          />
        )}
      </div>
    </AdminLayout>
  );
}

// ============================================================================
// STYLES (Design tokens frozen for performance)
// ============================================================================

const STYLES = Object.freeze({
  courseLink: {
    color: 'var(--primary)',
    fontWeight: 500,
  },
  tableWrapper: {
    border: 'none',
  },
});