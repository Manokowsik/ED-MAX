import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import { useAuth } from '../../context/AuthContext';
import { getAdminDashboard } from '../../services/api';
import { LoadingPage, Alert } from '../../components/ui';

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const AVATAR_PALETTE = Object.freeze(['', 'green', 'blue', 'orange', 'pink']);

const COURSE_THUMB_GRADIENTS = Object.freeze([
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
]);

const MESSAGES = Object.freeze({
  LOAD_FAILED: 'Failed to load dashboard metrics. Please refresh.',
});

// ============================================================================
// UTILITIES (Pure, Unit-Testable Functions)
// ============================================================================

/**
 * Extracts initials from a user's full name.
 * @param {string} [name='']
 * @returns {string}
 */
const getInitials = (name = '') => {
  if (!name.trim()) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/**
 * Generates an accessible, humanized relative time string with safety guards.
 * @param {string | null | undefined} isoDate
 * @returns {string}
 */
const formatRelativeTime = (isoDate) => {
  if (!isoDate) return 'just now';
  const timestamp = new Date(isoDate).getTime();
  if (Number.isNaN(timestamp)) return 'just now';

  const diffSeconds = Math.max(0, (Date.now() - timestamp) / 1000);
  if (diffSeconds < 60) return `${Math.round(diffSeconds)}s ago`;

  const diffMinutes = diffSeconds / 60;
  if (diffMinutes < 60) return `${Math.round(diffMinutes)}m ago`;

  const diffHours = diffMinutes / 60;
  if (diffHours < 24) return `${Math.round(diffHours)}h ago`;

  const diffDays = diffHours / 24;
  return `${Math.round(diffDays)}d ago`;
};

// ============================================================================
// SUB-COMPONENT: Metric Stat Card
// ============================================================================

const MetricCard = React.memo(function MetricCard({
  icon,
  iconTheme,
  value,
  label,
  trend,
  trendType = 'neutral',
}) {
  return (
    <article className="sm-stat-card">
      <div className="sm-stat-card-top">
        <div className={`sm-stat-icon ${iconTheme}`} aria-hidden="true">
          {icon}
        </div>
        {trend && (
          <span
            className={`sm-trend-badge ${trendType}`}
            aria-label={`Trend: ${trend}`}
          >
            {trend}
          </span>
        )}
      </div>
      <div className="sm-stat-value">{value}</div>
      <div className="sm-stat-label">{label}</div>
    </article>
  );
});

// ============================================================================
// SUB-COMPONENT: Dashboard Courses Table
// ============================================================================

const DashboardCoursesTable = React.memo(function DashboardCoursesTable({ courses }) {
  if (courses.length === 0) {
    return (
      <div className="sm-card-body" style={STYLES.emptyStateContainer}>
        No courses configured yet.{' '}
        <Link to="/admin/courses" style={STYLES.primaryLink}>
          Create your first course →
        </Link>
      </div>
    );
  }

  return (
    <div style={STYLES.tableScroll}>
      <table className="custom-dashboard-table">
        <thead>
          <tr>
            <th scope="col">COURSE</th>
            <th scope="col">MODULES</th>
            <th scope="col">STATUS</th>
            <th scope="col">ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          {courses.slice(0, 8).map((c, i) => (
            <tr key={c.id}>
              <td>
                <div className="course-title-cell">
                  <div
                    className="course-cell-icon"
                    style={{
                      background: COURSE_THUMB_GRADIENTS[i % COURSE_THUMB_GRADIENTS.length],
                      ...STYLES.courseIconBox,
                    }}
                    aria-hidden="true"
                  >
                    {i % 3 === 0 ? '💻' : i % 3 === 1 ? '🔒' : '📊'}
                  </div>
                  <div>
                    <Link to={`/admin/courses/${c.id}`} className="course-cell-title">
                      {c.title}
                    </Link>
                    <div className="course-cell-sub">
                      {c.is_active ? 'Published' : 'Inactive'}
                    </div>
                  </div>
                </div>
              </td>
              <td>
                <span className="font-semibold">{c.total_modules ?? 0}</span>
              </td>
              <td>
                <span
                  className={`sm-status-indicator ${c.is_active ? 'active' : 'inactive'}`}
                  style={c.is_active ? STYLES.statusActive : STYLES.statusInactive}
                >
                  {c.is_active ? 'Active' : 'Draft'}
                </span>
              </td>
              <td>
                <div className="action-buttons-group">
                  <Link
                    to={`/admin/courses/${c.id}`}
                    className="action-icon-btn"
                    title={`Edit ${c.title}`}
                    aria-label={`Edit ${c.title}`}
                  >
                    ✏️
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

// ============================================================================
// SUB-COMPONENT: Recent Activity Feed
// ============================================================================

const RecentActivityList = React.memo(function RecentActivityList({ attempts }) {
  if (attempts.length === 0) {
    return (
      <div style={STYLES.emptyActivityContainer}>
        No recent activity recorded yet.
      </div>
    );
  }

  return (
    <div className="sm-activity-list" role="feed" aria-label="Recent Learner Activity">
      {attempts.slice(0, 8).map((a, i) => (
        <article key={a.attempt_id} className="sm-activity-item">
          <div
            className={`sm-activity-avatar ${AVATAR_PALETTE[i % AVATAR_PALETTE.length]}`}
            aria-hidden="true"
          >
            {getInitials(a.student_name)}
          </div>
          <div className="sm-activity-content">
            <div className="sm-activity-text">
              <strong>{a.student_name}</strong>{' '}
              {a.passed ? 'passed' : 'attempted'}{' '}
              <span className="sm-activity-link">{a.quiz_title}</span>
              {' '}— scored <strong>{a.score}%</strong>
            </div>
            <time
              className="sm-activity-time"
              dateTime={a.attempted_at}
              title={a.attempted_at ? new Date(a.attempted_at).toLocaleString() : ''}
            >
              {formatRelativeTime(a.attempted_at)}
            </time>
          </div>
        </article>
      ))}
    </div>
  );
});

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function AdminDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getAdminDashboard();
      setData(res);
    } catch (err) {
      setError(err.message || MESSAGES.LOAD_FAILED);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Derived Analytics Computations (Memoized)
  const metrics = useMemo(() => {
    const s = data?.summary ?? {};
    const courses = data?.courses ?? [];
    const attempts = data?.recent_quiz_attempts ?? [];

    const totalCourses = s.total_courses ?? courses.length;
    const totalStudents = s.total_students ?? 0;
    const totalEnrollments = s.total_enrollments ?? 0;
    const totalCertificates = s.total_certificates ?? 0;

    let averageQuizScore = 0;
    let completionRate = 0;

    if (attempts.length > 0) {
      const scoreSum = attempts.reduce((acc, curr) => acc + (Number(curr.score) || 0), 0);
      averageQuizScore = Math.round(scoreSum / attempts.length);

      const passCount = attempts.filter((a) => Boolean(a.passed)).length;
      completionRate = Math.round((passCount / attempts.length) * 100);
    }

    return {
      courses,
      attempts,
      totalCourses,
      totalStudents,
      totalEnrollments,
      totalCertificates,
      averageQuizScore,
      completionRate,
    };
  }, [data]);

  const firstName = useMemo(() => {
    const rawName = user?.name?.trim();
    if (!rawName) return 'Admin';
    return rawName.split(' ')[0];
  }, [user?.name]);

  if (loading) {
    return (
      <AdminLayout>
        <LoadingPage message="Loading operational analytics…" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      {/* Page Header */}
      <header className="sm-page-header">
        <div>
          <h1 className="sm-page-title">Dashboard Overview</h1>
          <p className="sm-page-subtitle">
            Welcome back, <strong>{firstName}</strong>. Here is your enterprise training telemetry.
          </p>
        </div>
        <div className="sm-header-actions">
          <Link
            to="/admin/students"
            className="btn btn-outline"
            id="manage-users-btn"
          >
            👥 User Manager
          </Link>
          <Link
            to="/admin/courses?tab=assign"
            className="btn btn-outline"
            id="assign-courses-btn"
          >
            📋 Assign Courses
          </Link>
          <Link
            to="/admin/courses"
            className="btn btn-primary"
            id="new-course-btn"
          >
            + Manage Courses
          </Link>
        </div>
      </header>

      {error && (
        <Alert type="error" onClose={() => setError('')} aria-live="assertive">
          {error}
        </Alert>
      )}

      {/* Primary Telemetry Metrics Row */}
      <section
        className="sm-stats-row"
        aria-label="High-Level Performance Indicators"
      >
        <MetricCard
          icon="📖"
          iconTheme="blue"
          value={metrics.totalCourses.toLocaleString()}
          label="Total Courses"
        />

        <MetricCard
          icon="👥"
          iconTheme="violet"
          value={metrics.totalStudents.toLocaleString()}
          label="Active Users"
        />

        <MetricCard
          icon="🎯"
          iconTheme="teal"
          value={`${metrics.completionRate}%`}
          label="Quiz Pass Rate"
          trendType={metrics.completionRate >= 70 ? 'up' : 'neutral'}
        />

        <MetricCard
          icon="📈"
          iconTheme="orange"
          value={metrics.totalEnrollments.toLocaleString()}
          label="Total Enrollments"
        />

        <MetricCard
          icon="🏅"
          iconTheme="amber"
          value={`${metrics.averageQuizScore}%`}
          label="Avg. Quiz Score"
          trendType={metrics.averageQuizScore >= 70 ? 'up' : 'down'}
        />

        <MetricCard
          icon="🛡️"
          iconTheme="green"
          value={metrics.totalCertificates.toLocaleString()}
          label="Certificates Issued"
        />
      </section>

      {/* Two Column Layout: Data Grid + Activity Log */}
      <div className="sm-two-col">
        {/* Left Column: Course Inventory */}
        <section className="sm-card" aria-labelledby="courses-heading">
          <header className="sm-card-header">
            <div>
              <h2 id="courses-heading" className="sm-card-title">
                📖 Courses &amp; Curriculums
              </h2>
              <div className="sm-card-subtitle">
                {metrics.courses.length} active courses configured
              </div>
            </div>
            <Link to="/admin/courses" className="btn btn-outline btn-sm">
              View all
            </Link>
          </header>

          <DashboardCoursesTable courses={metrics.courses} />
        </section>

        {/* Right Column: Real-time Learner Stream */}
        <section className="sm-card" aria-labelledby="activity-heading">
          <header className="sm-card-header">
            <div>
              <h2 id="activity-heading" className="sm-card-title">
                Recent Activity
              </h2>
              <div className="sm-card-subtitle">Latest learner events</div>
            </div>
          </header>
          <div className="sm-card-body">
            <RecentActivityList attempts={metrics.attempts} />
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}

// ============================================================================
// STYLES (Frozen Design Tokens & Layout Constants)
// ============================================================================

const STYLES = Object.freeze({
  primaryLink: {
    color: 'var(--primary)',
    fontWeight: 600,
  },
  emptyStateContainer: {
    textAlign: 'center',
    color: 'var(--gray-500)',
    fontSize: 'var(--font-size-sm)',
    padding: '2rem 1rem',
  },
  tableScroll: {
    overflowX: 'auto',
  },
  courseIconBox: {
    color: '#fff',
    fontSize: '0.85rem',
  },
  statusActive: {
    color: 'var(--success, #16a34a)',
    fontWeight: 600,
  },
  statusInactive: {
    color: 'var(--gray-500, #64748b)',
    fontWeight: 500,
  },
  emptyActivityContainer: {
    textAlign: 'center',
    color: 'var(--gray-400)',
    fontSize: 'var(--font-size-sm)',
    padding: '1.5rem 0',
  },
});