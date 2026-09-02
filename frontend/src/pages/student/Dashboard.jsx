import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import StudentLayout from '../../layouts/StudentLayout';
import { useAuth } from '../../context/AuthContext';
import { getStudentDashboard } from '../../services/api';
import { LoadingPage, Alert } from '../../components/ui';

// ============================================================================
// CONSTANTS & DESIGN TOKENS
// ============================================================================

const LEARNING_ICONS = Object.freeze([
  { bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', icon: '📊' },
  { bg: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', icon: '📚' },
  { bg: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', icon: '🚀' },
  { bg: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', icon: '🎓' },
  { bg: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)', icon: '🔬' },
]);

const FEATURED_GRADIENTS = Object.freeze([
  'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
  'linear-gradient(135deg, #2c3e50 0%, #3498db 100%)',
  'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
]);

const MESSAGES = Object.freeze({
  LOAD_FAILED: 'Failed to load dashboard data. Please try again.',
  FORBIDDEN: 'Access denied. You can only view your own dashboard.',
});

// ============================================================================
// PURE UTILITIES
// ============================================================================

/**
 * Formats an ISO string into US standard short date safely.
 * @param {string | null | undefined} iso 
 * @returns {string}
 */
const formatDate = (iso) => {
  if (!iso) return '—';
  const timestamp = new Date(iso).getTime();
  if (Number.isNaN(timestamp)) return '—';

  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

// ============================================================================
// SUB-COMPONENT: Stat Card
// ============================================================================

const StudentStatCard = React.memo(function StudentStatCard({
  icon,
  iconTheme,
  badgeText,
  badgeType = 'neutral',
  value,
  label,
}) {
  return (
    <article className="sm-stat-card">
      <div className="sm-stat-card-top">
        <div className={`sm-stat-icon ${iconTheme}`} aria-hidden="true">
          {icon}
        </div>
        <span className={`sm-trend-badge ${badgeType}`}>{badgeText}</span>
      </div>
      <div className="sm-stat-value">{value}</div>
      <div className="sm-stat-label">{label}</div>
    </article>
  );
});

// ============================================================================
// SUB-COMPONENT: Continue Learning Item Row
// ============================================================================

const ContinueLearningItem = React.memo(function ContinueLearningItem({
  course,
  index,
}) {
  const iconConfig = LEARNING_ICONS[index % LEARNING_ICONS.length];
  const progressPct = Math.max(0, Math.min(100, Math.round(course.progress_percentage ?? 0)));
  const isCompleted = progressPct === 100;
  const ctaLabel = isCompleted ? 'Review' : progressPct > 0 ? 'Continue' : 'Start';
  const currentModule = (course.completed_modules ?? 0) + 1;
  const totalModules = course.total_modules ?? 0;

  return (
    <div className="sm-learning-item">
      <div
        className="sm-learning-icon"
        style={{ background: iconConfig.bg }}
        aria-hidden="true"
      >
        {iconConfig.icon}
      </div>
      <div className="sm-learning-content">
        <div className="sm-learning-title">{course.title}</div>
        <div className="sm-learning-sub">
          Module {currentModule} of {totalModules}
        </div>
        <div className="sm-learning-progress-row">
          <div
            className="sm-learning-track"
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progress for ${course.title}: ${progressPct}%`}
          >
            <div
              className="sm-learning-fill"
              style={{
                width: `${progressPct}%`,
                background: isCompleted
                  ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                  : 'linear-gradient(90deg, #6366f1, #8b5cf6)',
              }}
            />
          </div>
          <span className="sm-learning-pct">{progressPct}%</span>
        </div>
      </div>
      <Link
        to={`/student/courses/${course.course_id}`}
        className="sm-learning-cta"
        id={`continue-course-${course.course_id}`}
        aria-label={`${ctaLabel} course ${course.title}`}
      >
        {ctaLabel}
      </Link>
    </div>
  );
});

// ============================================================================
// SUB-COMPONENT: Available Course Card
// ============================================================================

const AvailableCourseCard = React.memo(function AvailableCourseCard({
  course,
  index,
}) {
  const gradient = FEATURED_GRADIENTS[index % FEATURED_GRADIENTS.length];
  const iconConfig = LEARNING_ICONS[index % LEARNING_ICONS.length];

  return (
    <article className="sm-course-card-v2" id={`avail-course-${course.course_id}`}>
      <div className="sm-course-thumb" style={{ background: gradient }}>
        <div className="sm-course-thumb-inner">
          <svg
            viewBox="0 0 200 140"
            xmlns="http://www.w3.org/2000/svg"
            style={STYLES.thumbSvg}
            aria-hidden="true"
          >
            <circle cx="160" cy="20" r="60" fill="rgba(255,255,255,0.06)" />
            <circle cx="30" cy="110" r="50" fill="rgba(255,255,255,0.04)" />
          </svg>
          <span className="sm-course-thumb-icon" role="img" aria-hidden="true">
            {iconConfig.icon}
          </span>
        </div>
        <span className="sm-course-status-badge enrolled">Available</span>
      </div>
      <div className="sm-course-body">
        <div className="sm-course-category">Training Module</div>
        <h3 className="sm-course-title-v2">{course.title}</h3>
        {course.description && (
          <p className="sm-course-desc">{course.description}</p>
        )}
        <div className="sm-course-meta-row" style={STYLES.courseMetaRow}>
          <span style={STYLES.moduleCountText}>
            📖 {course.total_modules ?? 0} modules
          </span>
          <Link
            to={`/student/courses/${course.course_id}`}
            className="btn btn-primary btn-sm"
            id={`start-course-${course.course_id}`}
            aria-label={`Start course ${course.title}`}
          >
            Start
          </Link>
        </div>
      </div>
    </article>
  );
});

// ============================================================================
// SUB-COMPONENT: Quiz Attempt Row
// ============================================================================

const QuizAttemptRow = React.memo(function QuizAttemptRow({ attempt }) {
  const isPassed = Boolean(attempt.passed);

  return (
    <tr>
      <td style={STYLES.quizTitleCell}>{attempt.quiz_title ?? 'Quiz'}</td>
      <td><strong>{attempt.score ?? 0}%</strong></td>
      <td>
        <span
          className={`sm-course-status-badge ${isPassed ? 'published' : 'inactive'}`}
          style={STYLES.attemptBadge}
        >
          {isPassed ? '✓ Passed' : '✗ Failed'}
        </span>
      </td>
      <td style={STYLES.dateCell}>{formatDate(attempt.attempted_at)}</td>
    </tr>
  );
});

// ============================================================================
// MAIN COMPONENT: Student Dashboard
// ============================================================================

export default function StudentDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const activeRequestId = useRef(0);

  const loadDashboard = useCallback(async () => {
    if (!user?.id) return;

    const currentReqId = ++activeRequestId.current;
    setLoading(true);
    setError('');

    try {
      const res = await getStudentDashboard(user.id);
      if (currentReqId === activeRequestId.current) {
        setData(res);
      }
    } catch (err) {
      if (currentReqId === activeRequestId.current) {
        if (err.message?.includes('403') || err.status === 403) {
          setError(MESSAGES.FORBIDDEN);
        } else {
          setError(err.message || MESSAGES.LOAD_FAILED);
        }
      }
    } finally {
      if (currentReqId === activeRequestId.current) {
        setLoading(false);
      }
    }
  }, [user?.id]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Single-pass memoized data extraction
  const telemetry = useMemo(() => {
    const stats = data?.statistics ?? {};
    const rawCourses = data?.courses ?? [];
    const attempts = data?.recent_quiz_attempts ?? [];

    const inProgressList = [];
    const availableList = [];
    let completedCount = 0;

    for (const c of rawCourses) {
      const pct = c.progress_percentage ?? 0;
      if (pct === 100) {
        completedCount += 1;
      } else if (pct > 0) {
        inProgressList.push(c);
      } else {
        availableList.push(c);
      }
    }

    return {
      courses: rawCourses,
      activeCourses: inProgressList,
      availableCourses: availableList,
      recentAttempts: attempts,
      totalAssigned: stats.total_courses ?? rawCourses.length,
      totalCompleted: stats.completed_courses ?? completedCount,
      certificatesEarned: stats.certificates ?? 0,
    };
  }, [data]);

  const firstName = useMemo(() => {
    const raw = user?.name?.trim();
    if (!raw) return 'Student';
    return raw.split(' ')[0];
  }, [user?.name]);

  if (loading) {
    return (
      <StudentLayout>
        <LoadingPage message="Loading your dashboard…" />
      </StudentLayout>
    );
  }

  return (
    <StudentLayout>
      {/* Header */}
      <header className="sm-page-header">
        <div>
          <h1 className="sm-page-title">My Learning</h1>
          <p className="sm-page-subtitle">
            Welcome back, <strong>{firstName}</strong>. Continue where you left off.
          </p>
        </div>
        <Link
          to="/student/courses"
          className="btn btn-outline"
          id="view-all-courses-btn"
        >
          View All
        </Link>
      </header>

      {error && (
        <Alert type="error" onClose={() => setError('')} aria-live="assertive">
          {error}
        </Alert>
      )}

      {/* KPI Stats Grid */}
      <section
        className="sm-stats-row"
        aria-label="Student Learning Progress Indicators"
      >
        <StudentStatCard
          icon="📚"
          iconTheme="blue"
          badgeText="Assigned"
          badgeType="neutral"
          value={telemetry.totalAssigned}
          label="My Courses"
        />

        <StudentStatCard
          icon="✅"
          iconTheme="green"
          badgeText={telemetry.totalCompleted > 0 ? `${telemetry.totalCompleted} done` : '0'}
          badgeType={telemetry.totalCompleted > 0 ? 'up' : 'neutral'}
          value={telemetry.totalCompleted}
          label="Completed"
        />

        <StudentStatCard
          icon="🎓"
          iconTheme="amber"
          badgeText={telemetry.certificatesEarned > 0 ? `+${telemetry.certificatesEarned}` : '0'}
          badgeType={telemetry.certificatesEarned > 0 ? 'up' : 'neutral'}
          value={telemetry.certificatesEarned}
          label="Certificates"
        />
      </section>

      {/* In-Progress Section */}
      {telemetry.activeCourses.length > 0 && (
        <section className="sm-card" style={STYLES.sectionCardMargin} aria-labelledby="continue-learning-heading">
          <div className="sm-card-header">
            <div>
              <h2 id="continue-learning-heading" className="sm-card-title">
                📖 Continue Learning
              </h2>
              <div className="sm-card-subtitle">Pick up where you left off</div>
            </div>
            <Link to="/student/courses" className="sm-section-view-all">
              View All
            </Link>
          </div>
          <div className="sm-card-body">
            <div className="sm-my-learning-list" role="list">
              {telemetry.activeCourses.slice(0, 4).map((c, i) => (
                <ContinueLearningItem
                  key={c.course_id}
                  course={c}
                  index={i}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Not Started / Available Section */}
      {telemetry.availableCourses.length > 0 && (
        <section style={STYLES.sectionCardMargin} aria-labelledby="available-courses-heading">
          <div className="sm-section-title">
            <h2 id="available-courses-heading" style={STYLES.inlineHeading}>Available Courses</h2>
            <Link to="/student/courses" className="sm-section-view-all">
              View All
            </Link>
          </div>
          <div className="sm-course-grid-v2">
            {telemetry.availableCourses.slice(0, 3).map((c, i) => (
              <AvailableCourseCard
                key={c.course_id}
                course={c}
                index={i}
              />
            ))}
          </div>
        </section>
      )}

      {/* Fallback View: Everything Completed */}
      {telemetry.activeCourses.length === 0 &&
        telemetry.availableCourses.length === 0 &&
        telemetry.courses.length > 0 && (
          <section className="sm-card" aria-labelledby="all-courses-heading">
            <div className="sm-card-header">
              <h2 id="all-courses-heading" className="sm-card-title">My Courses</h2>
              <Link to="/student/courses" className="sm-section-view-all">
                View all
              </Link>
            </div>
            <div className="sm-card-body">
              <div className="sm-my-learning-list" role="list">
                {telemetry.courses.slice(0, 5).map((c, i) => (
                  <ContinueLearningItem
                    key={c.course_id}
                    course={c}
                    index={i}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

      {/* Empty State: Zero Enrolled Courses */}
      {telemetry.courses.length === 0 && (
        <div className="sm-card">
          <div className="sm-card-body" style={STYLES.emptyStateContainer}>
            <div style={STYLES.emptyStateEmoji} aria-hidden="true">📚</div>
            <h2 style={STYLES.emptyStateTitle}>No courses assigned yet</h2>
            <p style={STYLES.emptyStateDesc}>
              Your administrator will assign courses to you. Check back later.
            </p>
          </div>
        </div>
      )}

      {/* Recent Quiz Attempts Data Table */}
      {telemetry.recentAttempts.length > 0 && (
        <section className="sm-card" style={STYLES.tableCardMargin} aria-labelledby="quiz-attempts-heading">
          <div className="sm-card-header">
            <h2 id="quiz-attempts-heading" className="sm-card-title">
              🏅 Recent Quiz Attempts
            </h2>
          </div>
          <div style={STYLES.tableScrollWrapper}>
            <table className="custom-dashboard-table">
              <thead>
                <tr>
                  <th scope="col">QUIZ</th>
                  <th scope="col">SCORE</th>
                  <th scope="col">RESULT</th>
                  <th scope="col">DATE</th>
                </tr>
              </thead>
              <tbody>
                {telemetry.recentAttempts.slice(0, 6).map((attempt, idx) => (
                  <QuizAttemptRow
                    key={attempt.attempt_id ?? attempt.id ?? idx}
                    attempt={attempt}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </StudentLayout>
  );
}

// ============================================================================
// STYLES (Performance tokens frozen in memory)
// ============================================================================

const STYLES = Object.freeze({
  thumbSvg: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
  },
  sectionCardMargin: {
    marginBottom: '1.5rem',
  },
  tableCardMargin: {
    marginTop: '1.5rem',
  },
  courseMetaRow: {
    marginTop: '0.75rem',
  },
  moduleCountText: {
    fontSize: '0.72rem',
    color: '#64748b',
  },
  quizTitleCell: {
    fontWeight: 500,
  },
  attemptBadge: {
    position: 'static',
    fontSize: '0.7rem',
  },
  dateCell: {
    color: '#94a3b8',
    fontSize: '0.8rem',
  },
  inlineHeading: {
    margin: 0,
    fontSize: 'inherit',
    fontWeight: 'inherit',
    display: 'inline-block',
  },
  emptyStateContainer: {
    textAlign: 'center',
    padding: '3rem',
    color: '#64748b',
  },
  emptyStateEmoji: {
    fontSize: '2.5rem',
    marginBottom: '0.75rem',
  },
  emptyStateTitle: {
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: '0.35rem',
    fontSize: '1.125rem',
  },
  emptyStateDesc: {
    fontSize: '0.875rem',
    margin: 0,
  },
  tableScrollWrapper: {
    overflowX: 'auto',
  },
});