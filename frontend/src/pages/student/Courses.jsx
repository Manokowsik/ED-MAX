import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import StudentLayout from '../../layouts/StudentLayout';
import { useAuth } from '../../context/AuthContext';
import { getStudentCourses } from '../../services/api';
import { LoadingPage, Alert, EmptyState } from '../../components/ui';

// ============================================================================
// CONSTANTS & DESIGN TOKENS
// ============================================================================

const STATUS_FILTERS = Object.freeze({
  ALL: 'all',
  PROGRESS: 'progress',
  COMPLETED: 'completed',
  NOT_STARTED: 'notstarted',
});

const FILTER_CONFIG = Object.freeze([
  { key: STATUS_FILTERS.ALL, label: 'All Courses' },
  { key: STATUS_FILTERS.PROGRESS, label: 'In Progress' },
  { key: STATUS_FILTERS.COMPLETED, label: 'Completed' },
  { key: STATUS_FILTERS.NOT_STARTED, label: 'Not Started' },
]);

const THUMB_GRADIENTS = Object.freeze([
  { bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', icon: '📚' },
  { bg: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', icon: '🚀' },
  { bg: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', icon: '📊' },
  { bg: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', icon: '🎓' },
  { bg: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)', icon: '🔬' },
  { bg: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)', icon: '💡' },
  { bg: 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)', icon: '🏛️' },
  { bg: 'linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)', icon: '🌿' },
]);

const MESSAGES = Object.freeze({
  LOAD_FAILED: 'Failed to load courses. Please refresh the page.',
  EMPTY_SEARCH: 'Try adjusting your search terms or filters.',
  EMPTY_DEFAULT: 'Your administrator has not assigned any courses to you yet.',
});

// ============================================================================
// SUB-COMPONENT: Filter Chips Group
// ============================================================================

const FilterChipGroup = React.memo(function FilterChipGroup({
  activeFilter,
  onSelectFilter,
}) {
  return (
    <div className="flex gap-2 flex-wrap" role="group" aria-label="Course Status Filters">
      {FILTER_CONFIG.map(({ key, label }) => {
        const isActive = activeFilter === key;
        return (
          <button
            key={key}
            type="button"
            className={`sm-filter-chip${isActive ? ' active' : ''}`}
            onClick={() => onSelectFilter(key)}
            style={isActive ? STYLES.activeChip : undefined}
            aria-pressed={isActive}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
});

// ============================================================================
// SUB-COMPONENT: Student Course Card
// ============================================================================

const StudentCourseCard = React.memo(function StudentCourseCard({
  course,
  index,
}) {
  const thumb = THUMB_GRADIENTS[index % THUMB_GRADIENTS.length];
  const pct = Math.max(0, Math.min(100, Math.round(course.progress_percentage ?? 0)));
  const isComplete = pct === 100;
  const isStarted = pct > 0 && !isComplete;

  const ctaLabel = isComplete ? 'Review' : isStarted ? 'Continue' : 'Start';
  const statusLabel = isComplete ? 'Completed' : isStarted ? 'In Progress' : 'Not Started';
  const statusCls = isComplete ? 'completed' : isStarted ? 'progress' : 'enrolled';

  const completedModules = course.completed_modules ?? 0;
  const totalModules = course.total_modules ?? 0;

  return (
    <article
      className="sm-course-card-v2"
      id={`course-card-${course.course_id}`}
      aria-labelledby={`course-title-${course.course_id}`}
    >
      {/* Visual Thumbnail */}
      <div className="sm-course-thumb" style={{ background: thumb.bg }}>
        <div className="sm-course-thumb-inner">
          <svg
            viewBox="0 0 200 140"
            xmlns="http://www.w3.org/2000/svg"
            style={STYLES.thumbSvg}
            aria-hidden="true"
          >
            <circle cx="160" cy="20" r="60" fill="rgba(255,255,255,0.08)" />
            <circle cx="30" cy="110" r="50" fill="rgba(255,255,255,0.06)" />
          </svg>
          <span className="sm-course-thumb-icon" role="img" aria-hidden="true">
            {thumb.icon}
          </span>
        </div>
        <span className={`sm-course-status-badge ${statusCls}`}>{statusLabel}</span>
      </div>

      {/* Card Body */}
      <div className="sm-course-body">
        <div className="sm-course-category">Training Module</div>
        <h2 id={`course-title-${course.course_id}`} className="sm-course-title-v2">
          {course.title}
        </h2>
        {course.description && (
          <p className="sm-course-desc">{course.description}</p>
        )}

        {/* Accessible Progress Indicator */}
        <div className="sm-course-progress">
          <div className="sm-course-progress-label">
            <span>Progress</span>
            <span style={STYLES.progressPercentageText}>{pct}%</span>
          </div>
          <div
            className="sm-progress-track"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progress for ${course.title}: ${pct}%`}
          >
            <div
              className={`sm-progress-fill${isComplete ? ' complete' : ''}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Footer Metadata & Action */}
        <div className="sm-course-meta-row" style={STYLES.cardMetaRow}>
          <span className="sm-course-enrolled" aria-label={`${completedModules} of ${totalModules} modules completed`}>
            📖 {completedModules}/{totalModules} modules
          </span>
          <Link
            to={`/student/courses/${course.course_id}`}
            className="btn btn-primary btn-sm"
            id={`open-course-${course.course_id}`}
            aria-label={`${ctaLabel} learning course ${course.title}`}
          >
            {ctaLabel}
          </Link>
        </div>
      </div>
    </article>
  );
});

// ============================================================================
// MAIN PAGE COMPONENT: Student Courses
// ============================================================================

export default function StudentCourses() {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(STATUS_FILTERS.ALL);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const activeRequestId = useRef(0);

  const loadCourses = useCallback(async () => {
    if (!user?.id) return;

    const currentReqId = ++activeRequestId.current;
    setLoading(true);
    setError('');

    try {
      const res = await getStudentCourses(user.id);
      if (currentReqId === activeRequestId.current) {
        setCourses(res?.courses ?? []);
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
  }, [user?.id]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  // Pure memoized filtering computation
  const filteredCourses = useMemo(() => {
    const query = search.trim().toLowerCase();

    return courses.filter((c) => {
      const title = (c.title || '').toLowerCase();
      const desc = (c.description || '').toLowerCase();
      const matchesSearch = !query || title.includes(query) || desc.includes(query);

      const progress = c.progress_percentage ?? 0;
      let matchesStatus = true;

      if (statusFilter === STATUS_FILTERS.COMPLETED) {
        matchesStatus = progress === 100;
      } else if (statusFilter === STATUS_FILTERS.PROGRESS) {
        matchesStatus = progress > 0 && progress < 100;
      } else if (statusFilter === STATUS_FILTERS.NOT_STARTED) {
        matchesStatus = progress === 0;
      }

      return matchesSearch && matchesStatus;
    });
  }, [courses, search, statusFilter]);

  const courseCountText = useMemo(() => {
    const total = courses.length;
    return `${total} course${total !== 1 ? 's' : ''} assigned to you`;
  }, [courses.length]);

  if (loading) {
    return (
      <StudentLayout>
        <LoadingPage message="Loading your courses…" />
      </StudentLayout>
    );
  }

  return (
    <StudentLayout>
      {/* Header */}
      <header className="sm-courses-header">
        <div>
          <h1 className="sm-page-title">My Courses</h1>
          <p className="sm-page-subtitle">{courseCountText}</p>
        </div>
      </header>

      {error && (
        <Alert type="error" onClose={() => setError('')} aria-live="assertive">
          {error}
        </Alert>
      )}

      {/* Search & Status Filters */}
      <section className="sm-search-filter-row" aria-label="Course Controls">
        <div className="sm-search-box">
          <span className="sm-search-box-icon" aria-hidden="true">🔍</span>
          <input
            id="course-search"
            type="search"
            className="sm-search-input"
            placeholder="Search your courses…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search your enrolled courses"
          />
        </div>

        <FilterChipGroup
          activeFilter={statusFilter}
          onSelectFilter={setStatusFilter}
        />
      </section>

      {/* Course Grid View */}
      {filteredCourses.length === 0 ? (
        <EmptyState
          icon="📚"
          title={search ? `No results for "${search}"` : 'No courses found'}
          text={search ? MESSAGES.EMPTY_SEARCH : MESSAGES.EMPTY_DEFAULT}
        />
      ) : (
        <main
          className="sm-course-grid-v2"
          role="feed"
          aria-label="Enrolled Courses List"
          style={STYLES.feedGrid}
        >
          {filteredCourses.map((c, i) => (
            <StudentCourseCard
              key={c.course_id}
              course={c}
              index={i}
            />
          ))}
        </main>
      )}
    </StudentLayout>
  );
}

// ============================================================================
// STYLES (Performance tokens frozen in memory)
// ============================================================================

const STYLES = Object.freeze({
  activeChip: {
    borderColor: '#4f46e5',
    color: '#4f46e5',
    background: '#eef2ff',
  },
  thumbSvg: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
  },
  progressPercentageText: {
    fontWeight: 700,
  },
  cardMetaRow: {
    marginTop: '0.75rem',
  },
  feedGrid: {
    alignItems: 'stretch',
  },
});