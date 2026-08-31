import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import StudentLayout from '../../layouts/StudentLayout';
import { useAuth } from '../../context/AuthContext';
import { getStudentDashboard } from '../../services/api';
import { LoadingPage, Alert, StatCard, Badge, ProgressBar, EmptyState } from '../../components/ui';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
        <div className="page-container"><LoadingPage message="Loading your dashboard…" /></div>
      </StudentLayout>
    );
  }

  const stats = data?.statistics ?? {};
  const courses = data?.courses ?? [];

  // Recent quiz attempts
  const recentAttempts = data?.recent_quiz_attempts ?? [];

  return (
    <StudentLayout>
      <div className="page-container">
        {/* Header */}
        <div className="page-header mb-6">
          <h1 className="page-title">Welcome back, {user?.name?.split(' ')[0] ?? 'Student'}!</h1>
          <p className="page-subtitle">Track your learning progress and continue your training.</p>
        </div>

        {error && <Alert type="error">{error}</Alert>}

        {/* Stats */}
        <div className="stats-grid">
          <StatCard label="Assigned Courses" value={stats.total_courses ?? courses.length} variant="primary" />
          <StatCard label="Completed" value={stats.completed_courses ?? courses.filter(c => c.progress_percentage === 100).length} variant="success" />
          <StatCard label="In Progress" value={stats.in_progress ?? courses.filter(c => c.progress_percentage > 0 && c.progress_percentage < 100).length} variant="info" />
          <StatCard label="Certificates" value={stats.certificates ?? 0} variant="warning" />
        </div>

        {/* Courses */}
        <div className="card mb-6">
          <div className="card-header">
            <h2 className="card-title">My Courses</h2>
            <Link to="/student/courses" className="btn btn-outline btn-sm">View all</Link>
          </div>

          {courses.length === 0 ? (
            <div className="card-body">
              <EmptyState
                icon="📚"
                title="No courses assigned"
                text="Your administrator will assign courses to you. Check back later."
              />
            </div>
          ) : (
            <div className="card-body" style={{ paddingTop: 0 }}>
              {courses.slice(0, 5).map(c => (
                <div
                  key={c.course_id}
                  style={{
                    padding: 'var(--space-4) 0',
                    borderBottom: '1px solid var(--gray-100)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-4)',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center gap-2 mb-1">
                      <Link
                        to={`/student/courses/${c.course_id}`}
                        style={{ fontWeight: 600, color: 'var(--gray-800)', fontSize: 'var(--font-size-sm)' }}
                        id={`dashboard-course-${c.course_id}`}
                      >
                        {c.title}
                      </Link>
                      <Badge variant={c.status === 'COMPLETED' ? 'success' : 'primary'}>{c.status}</Badge>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      <div style={{ flex: 1 }}>
                        <ProgressBar value={c.progress_percentage} max={100} variant={c.progress_percentage === 100 ? 'success' : 'primary'} />
                      </div>
                      <span className="text-xs text-gray">{c.progress_percentage}%</span>
                    </div>
                    <div className="text-xs text-gray mt-1">
                      {c.completed_modules}/{c.total_modules} modules completed
                    </div>
                  </div>
                  <Link to={`/student/courses/${c.course_id}`} className="btn btn-primary btn-sm" style={{ flexShrink: 0 }}>
                    {c.progress_percentage === 100 ? 'Review' : c.progress_percentage > 0 ? 'Continue' : 'Start'}
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Quiz Attempts */}
        {recentAttempts.length > 0 && (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Recent Quiz Attempts</h2>
            </div>
            <div className="table-wrapper" style={{ border: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th>Quiz</th>
                    <th>Score</th>
                    <th>Result</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAttempts.slice(0, 10).map((a, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 500 }}>{a.quiz_title ?? 'Quiz'}</td>
                      <td><strong>{a.score}%</strong></td>
                      <td>
                        <Badge variant={a.passed ? 'success' : 'danger'}>
                          {a.passed ? 'Passed' : 'Failed'}
                        </Badge>
                      </td>
                      <td className="text-gray">{formatDate(a.attempted_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </StudentLayout>
  );
}
