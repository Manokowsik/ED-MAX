import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import StudentLayout from '../../layouts/StudentLayout';
import { useAuth } from '../../context/AuthContext';
import { getStudentDashboard } from '../../services/api';
import { LoadingPage, Alert } from '../../components/ui';

// Gradient definitions for learning icons
const LEARNING_ICONS = [
  { bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', icon: '📊' },
  { bg: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', icon: '📚' },
  { bg: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', icon: '🚀' },
  { bg: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', icon: '🎓' },
  { bg: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)', icon: '🔬' },
];

const FEATURED_GRADIENTS = [
  'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
  'linear-gradient(135deg, #2c3e50 0%, #3498db 100%)',
  'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
];

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getStatusLabel(progress) {
  if (progress === 100) return { label: 'Completed', cls: 'completed' };
  if (progress > 0) return { label: 'In Progress', cls: 'progress' };
  return { label: 'Not Started', cls: 'enrolled' };
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError('');
    try {
      const res = await getStudentDashboard(user.id);
      setData(res);
    } catch (err) {
      if (err.message?.includes('403')) {
        setError('Access denied. You can only view your own dashboard.');
      } else {
        setError(err.message || 'Failed to load dashboard');
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <StudentLayout>
        <LoadingPage message="Loading your dashboard…" />
      </StudentLayout>
    );
  }

  const stats = data?.statistics ?? {};
  const courses = data?.courses ?? [];
  const recentAttempts = data?.recent_quiz_attempts ?? [];

  const totalAssigned = stats.total_courses ?? courses.length;
  const totalCompleted = stats.completed_courses ?? courses.filter(c => c.progress_percentage === 100).length;
  const inProgress = stats.in_progress ?? courses.filter(c => c.progress_percentage > 0 && c.progress_percentage < 100).length;
  const certs = stats.certificates ?? 0;

  const firstName = user?.name?.split(' ')[0] ?? 'Student';

  // Courses currently in progress (for "My Learning")
  const activeCourses = courses.filter(c => c.progress_percentage > 0 && c.progress_percentage < 100);
  // Not started courses (for "Available Courses" featured section)
  const availableCourses = courses.filter(c => c.progress_percentage === 0);

  return (
    <StudentLayout>
      {/* Page Header */}
      <div className="sm-page-header">
        <div>
          <h1 className="sm-page-title">My Learning</h1>
          <p className="sm-page-subtitle">
            Welcome back, <strong>{firstName}</strong>. Continue where you left off.
          </p>
        </div>
        <Link to="/student/courses" className="btn btn-outline" id="view-all-courses-btn">
          View All
        </Link>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      {/* Stat Cards */}
      <div className="sm-stats-row">
        <div className="sm-stat-card">
          <div className="sm-stat-card-top">
            <div className="sm-stat-icon blue">📚</div>
            <span className="sm-trend-badge neutral">Assigned</span>
          </div>
          <div className="sm-stat-value">{totalAssigned}</div>
          <div className="sm-stat-label">My Courses</div>
        </div>

        <div className="sm-stat-card">
          <div className="sm-stat-card-top">
            <div className="sm-stat-icon green">✅</div>
            <span className="sm-trend-badge up">{totalCompleted > 0 ? `${totalCompleted} done` : '0'}</span>
          </div>
          <div className="sm-stat-value">{totalCompleted}</div>
          <div className="sm-stat-label">Completed</div>
        </div>

        <div className="sm-stat-card">
          <div className="sm-stat-card-top">
            <div className="sm-stat-icon amber">🎓</div>
            <span className="sm-trend-badge up">{certs > 0 ? `+${certs}` : '0'}</span>
          </div>
          <div className="sm-stat-value">{certs}</div>
          <div className="sm-stat-label">Certificates</div>
        </div>
      </div>

      {/* My Learning — In Progress */}
      {activeCourses.length > 0 && (
        <div className="sm-card" style={{ marginBottom: '1.5rem' }}>
          <div className="sm-card-header">
            <div>
              <div className="sm-card-title">📖 Continue Learning</div>
              <div className="sm-card-subtitle">Pick up where you left off</div>
            </div>
            <Link to="/student/courses" className="sm-section-view-all">View All</Link>
          </div>
          <div className="sm-card-body">
            <div className="sm-my-learning-list">
              {activeCourses.slice(0, 4).map((c, i) => {
                const ic = LEARNING_ICONS[i % LEARNING_ICONS.length];
                const ctaLabel = c.progress_percentage > 0 ? 'Continue' : 'Start';
                return (
                  <div key={c.course_id} className="sm-learning-item">
                    <div
                      className="sm-learning-icon"
                      style={{ background: ic.bg }}
                    >
                      {ic.icon}
                    </div>
                    <div className="sm-learning-content">
                      <div className="sm-learning-title">{c.title}</div>
                      <div className="sm-learning-sub">
                        Module {c.completed_modules + 1} of {c.total_modules}
                      </div>
                      <div className="sm-learning-progress-row">
                        <div className="sm-learning-track">
                          <div
                            className="sm-learning-fill"
                            style={{ width: `${c.progress_percentage}%` }}
                          />
                        </div>
                        <span className="sm-learning-pct">{c.progress_percentage}%</span>
                      </div>
                    </div>
                    <Link
                      to={`/student/courses/${c.course_id}`}
                      className="sm-learning-cta"
                      id={`continue-course-${c.course_id}`}
                    >
                      {ctaLabel}
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Available Courses — Not Started */}
      {availableCourses.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div className="sm-section-title">
            Available Courses
            <Link to="/student/courses" className="sm-section-view-all">View All</Link>
          </div>
          <div className="sm-course-grid-v2">
            {availableCourses.slice(0, 3).map((c, i) => {
              const grad = FEATURED_GRADIENTS[i % FEATURED_GRADIENTS.length];
              const ic = LEARNING_ICONS[i % LEARNING_ICONS.length];
              return (
                <div key={c.course_id} className="sm-course-card-v2" id={`avail-course-${c.course_id}`}>
                  <div className="sm-course-thumb" style={{ background: grad }}>
                    <div className="sm-course-thumb-inner">
                      <svg viewBox="0 0 200 140" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                        <circle cx="160" cy="20" r="60" fill="rgba(255,255,255,0.06)" />
                        <circle cx="30" cy="110" r="50" fill="rgba(255,255,255,0.04)" />
                      </svg>
                      <span className="sm-course-thumb-icon">{ic.icon}</span>
                    </div>
                    <span className="sm-course-status-badge enrolled">Available</span>
                  </div>
                  <div className="sm-course-body">
                    <div className="sm-course-category">Training Module</div>
                    <div className="sm-course-title-v2">{c.title}</div>
                    {c.description && (
                      <div className="sm-course-desc">{c.description}</div>
                    )}
                    <div className="sm-course-meta-row" style={{ marginTop: '0.75rem' }}>
                      <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        📖 {c.total_modules} modules
                      </span>
                      <Link
                        to={`/student/courses/${c.course_id}`}
                        className="btn btn-primary btn-sm"
                        id={`start-course-${c.course_id}`}
                      >
                        Start
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* All courses if nothing in progress */}
      {activeCourses.length === 0 && availableCourses.length === 0 && courses.length > 0 && (
        <div className="sm-card">
          <div className="sm-card-header">
            <div className="sm-card-title">My Courses</div>
            <Link to="/student/courses" className="sm-section-view-all">View all</Link>
          </div>
          <div className="sm-card-body">
            <div className="sm-my-learning-list">
              {courses.slice(0, 5).map((c, i) => {
                const ic = LEARNING_ICONS[i % LEARNING_ICONS.length];
                const ctaLabel = c.progress_percentage === 100 ? 'Review' : c.progress_percentage > 0 ? 'Continue' : 'Start';
                return (
                  <div key={c.course_id} className="sm-learning-item">
                    <div className="sm-learning-icon" style={{ background: ic.bg }}>
                      {ic.icon}
                    </div>
                    <div className="sm-learning-content">
                      <div className="sm-learning-title">{c.title}</div>
                      <div className="sm-learning-sub">
                        {c.completed_modules}/{c.total_modules} modules completed
                      </div>
                      <div className="sm-learning-progress-row">
                        <div className="sm-learning-track">
                          <div
                            className={`sm-learning-fill${c.progress_percentage === 100 ? '' : ''}`}
                            style={{
                              width: `${c.progress_percentage}%`,
                              background: c.progress_percentage === 100
                                ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                                : 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                            }}
                          />
                        </div>
                        <span className="sm-learning-pct">{c.progress_percentage}%</span>
                      </div>
                    </div>
                    <Link
                      to={`/student/courses/${c.course_id}`}
                      className="sm-learning-cta"
                      id={`dashboard-course-${c.course_id}`}
                    >
                      {ctaLabel}
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {courses.length === 0 && (
        <div className="sm-card">
          <div className="sm-card-body" style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📚</div>
            <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>No courses assigned yet</div>
            <div style={{ fontSize: '0.875rem' }}>Your administrator will assign courses to you. Check back later.</div>
          </div>
        </div>
      )}

      {/* Recent Quiz Attempts */}
      {recentAttempts.length > 0 && (
        <div className="sm-card" style={{ marginTop: '1.5rem' }}>
          <div className="sm-card-header">
            <div className="sm-card-title">🏅 Recent Quiz Attempts</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="custom-dashboard-table">
              <thead>
                <tr>
                  <th>QUIZ</th>
                  <th>SCORE</th>
                  <th>RESULT</th>
                  <th>DATE</th>
                </tr>
              </thead>
              <tbody>
                {recentAttempts.slice(0, 6).map((a, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 500 }}>{a.quiz_title ?? 'Quiz'}</td>
                    <td><strong>{a.score}%</strong></td>
                    <td>
                      <span className={`sm-course-status-badge ${a.passed ? 'published' : 'inactive'}`}
                        style={{ position: 'static', fontSize: '0.7rem' }}>
                        {a.passed ? '✓ Passed' : '✗ Failed'}
                      </span>
                    </td>
                    <td style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{formatDate(a.attempted_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </StudentLayout>
  );
}
