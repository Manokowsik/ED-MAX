import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import StudentLayout from '../../layouts/StudentLayout';
import { useAuth } from '../../context/AuthContext';
import { getStudentCourses } from '../../services/api';
import { LoadingPage, Alert, EmptyState } from '../../components/ui';

const THUMB_GRADIENTS = [
  { bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', icon: '📚' },
  { bg: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', icon: '🚀' },
  { bg: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', icon: '📊' },
  { bg: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', icon: '🎓' },
  { bg: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)', icon: '🔬' },
  { bg: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)', icon: '💡' },
  { bg: 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)', icon: '🏛️' },
  { bg: 'linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)', icon: '🌿' },
];

export default function StudentCourses() {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError('');
    try {
      const res = await getStudentCourses(user.id);
      setCourses(res.courses ?? []);
    } catch (err) {
      setError(err.message || 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  // Filtered courses
  const filtered = courses.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.title.toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q);
    const matchStatus =
      statusFilter === 'all' ||
      (statusFilter === 'completed' && c.progress_percentage === 100) ||
      (statusFilter === 'progress' && c.progress_percentage > 0 && c.progress_percentage < 100) ||
      (statusFilter === 'notstarted' && c.progress_percentage === 0);
    return matchSearch && matchStatus;
  });

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
      <div className="sm-courses-header">
        <div>
          <h1 className="sm-page-title">My Courses</h1>
          <p className="sm-page-subtitle">
            {courses.length} course{courses.length !== 1 ? 's' : ''} assigned to you
          </p>
        </div>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      {/* Search + Filters */}
      <div className="sm-search-filter-row">
        <div className="sm-search-box">
          <span className="sm-search-box-icon">🔍</span>
          <input
            type="search"
            className="sm-search-input"
            placeholder="Search your courses…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            id="course-search"
          />
        </div>
        {['all', 'progress', 'completed', 'notstarted'].map((key) => {
          const labels = { all: 'All Courses', progress: 'In Progress', completed: 'Completed', notstarted: 'Not Started' };
          const active = statusFilter === key;
          return (
            <button
              key={key}
              className="sm-filter-chip"
              onClick={() => setStatusFilter(key)}
              style={active ? { borderColor: '#4f46e5', color: '#4f46e5', background: '#eef2ff' } : {}}
            >
              {labels[key]}
            </button>
          );
        })}
      </div>

      {/* Course Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="📚"
          title={search ? `No results for "${search}"` : 'No courses here'}
          text={search ? 'Try a different search term.' : 'Your administrator has not assigned any courses to you yet.'}
        />
      ) : (
        <div className="sm-course-grid-v2">
          {filtered.map((c, i) => {
            const thumb = THUMB_GRADIENTS[i % THUMB_GRADIENTS.length];
            const pct = c.progress_percentage ?? 0;
            const isComplete = pct === 100;
            const isStarted = pct > 0;
            const ctaLabel = isComplete ? 'Review' : isStarted ? 'Continue' : 'Start';
            const statusLabel = isComplete ? 'Completed' : isStarted ? 'In Progress' : 'Not Started';
            const statusCls = isComplete ? 'completed' : isStarted ? 'progress' : 'enrolled';

            return (
              <div key={c.course_id} className="sm-course-card-v2" id={`course-card-${c.course_id}`}>
                {/* Thumbnail */}
                <div className="sm-course-thumb" style={{ background: thumb.bg }}>
                  <div className="sm-course-thumb-inner">
                    <svg viewBox="0 0 200 140" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                      <circle cx="160" cy="20" r="60" fill="rgba(255,255,255,0.08)" />
                      <circle cx="30" cy="110" r="50" fill="rgba(255,255,255,0.06)" />
                    </svg>
                    <span className="sm-course-thumb-icon">{thumb.icon}</span>
                  </div>
                  <span className={`sm-course-status-badge ${statusCls}`}>{statusLabel}</span>
                </div>

                {/* Body */}
                <div className="sm-course-body">
                  <div className="sm-course-category">Training Module</div>
                  <div className="sm-course-title-v2">{c.title}</div>
                  {c.description && (
                    <div className="sm-course-desc">{c.description}</div>
                  )}

                  {/* Progress */}
                  <div className="sm-course-progress">
                    <div className="sm-course-progress-label">
                      <span>Progress</span>
                      <span style={{ fontWeight: 700 }}>{pct}%</span>
                    </div>
                    <div className="sm-progress-track">
                      <div
                        className={`sm-progress-fill${isComplete ? ' complete' : ''}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="sm-course-meta-row" style={{ marginTop: '0.75rem' }}>
                    <span className="sm-course-enrolled">
                      📖 {c.completed_modules}/{c.total_modules} modules
                    </span>
                    <Link
                      to={`/student/courses/${c.course_id}`}
                      className="btn btn-primary btn-sm"
                      id={`open-course-${c.course_id}`}
                    >
                      {ctaLabel}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </StudentLayout>
  );
}
