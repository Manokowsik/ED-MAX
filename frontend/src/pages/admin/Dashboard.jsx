import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import { getAdminDashboard } from '../../services/api';
import { LoadingPage, Alert, Badge } from '../../components/ui';

function formatDate(iso) {
  if (!iso) return '04:50 PM';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getAdminDashboard();
      setData(res);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <AdminLayout>
        <div className="page-container"><LoadingPage message="Loading dashboard & live analytics…" /></div>
      </AdminLayout>
    );
  }

  const s = data?.summary ?? {};
  const courses = data?.courses ?? [];
  const attempts = data?.recent_quiz_attempts ?? [];

  // Calculate statistics for the 6 cards matching screenshot
  const totalCourses = s.total_courses ?? courses.length;
  const totalStudents = s.total_students ?? 0;
  const totalEnrollments = s.total_enrollments ?? 0;
  
  // Calculate average quiz score
  const avgScore = attempts.length > 0
    ? Math.round(attempts.reduce((acc, curr) => acc + (curr.score || 0), 0) / attempts.length)
    : 0;

  // Completion rate calculation
  const passCount = attempts.filter(a => a.passed).length;
  const completionRate = attempts.length > 0 ? Math.round((passCount / attempts.length) * 100) : 0;
  const totalCerts = s.total_certificates ?? 0;

  return (
    <AdminLayout>
      <div className="page-container">
        {/* TOP SUBHEADER & MAIN HEADER */}
        <div className="dashboard-top-header">
          <div>
            <div className="dashboard-category-badge">
              <span className="icon">📊</span> INSTRUCTOR &amp; ADMIN COMMAND CENTER
            </div>
            <h1 className="dashboard-main-title">Training &amp; Assessment Dashboard</h1>
            <p className="dashboard-main-subtitle">
              Manage course curriculum, video/text modules, quizzes, student user assignments, and monitor real-time completion analytics.
            </p>
          </div>

          <div className="dashboard-header-actions">
            <Link to="/admin/assignments" className="btn btn-outline" id="manage-users-btn">
              👥 Manage Users &amp; Assign
            </Link>
            <Link to="/admin/courses" className="btn btn-primary" id="new-course-btn">
              + New Course
            </Link>
          </div>
        </div>

        {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

        {/* 6 STAT CARDS ROW */}
        <div className="command-stats-grid">
          {/* Card 1: COURSES */}
          <div className="command-stat-card">
            <div className="stat-header">
              <span className="stat-label">COURSES</span>
              <div className="stat-icon-wrap blue">📖</div>
            </div>
            <div className="stat-value">{totalCourses}</div>
            <div className="stat-sub">Curriculum tracks</div>
          </div>

          {/* Card 2: STUDENTS */}
          <div className="command-stat-card">
            <div className="stat-header">
              <span className="stat-label">STUDENTS</span>
              <div className="stat-icon-wrap purple">👥</div>
            </div>
            <div className="stat-value">{totalStudents}</div>
            <div className="stat-sub">Registered learners</div>
          </div>

          {/* Card 3: ASSIGNMENTS */}
          <div className="command-stat-card">
            <div className="stat-header">
              <span className="stat-label">ASSIGNMENTS</span>
              <div className="stat-icon-wrap cyan">📈</div>
            </div>
            <div className="stat-value">{totalEnrollments}</div>
            <div className="stat-sub">Invite-only seats</div>
          </div>

          {/* Card 4: AVG QUIZ SCORE */}
          <div className="command-stat-card">
            <div className="stat-header">
              <span className="stat-label">AVG QUIZ SCORE</span>
              <div className="stat-icon-wrap orange">🏅</div>
            </div>
            <div className="stat-value highlight-orange">{avgScore}%</div>
            <div className="stat-sub">Across all attempts</div>
          </div>

          {/* Card 5: COMPLETION RATE */}
          <div className="command-stat-card">
            <div className="stat-header">
              <span className="stat-label">COMPLETION RATE</span>
              <div className="stat-icon-wrap green">✅</div>
            </div>
            <div className="stat-value highlight-green">{completionRate}%</div>
            <div className="stat-sub">Modules passed</div>
          </div>

          {/* Card 6: CERTIFICATES */}
          <div className="command-stat-card">
            <div className="stat-header">
              <span className="stat-label">CERTIFICATES</span>
              <div className="stat-icon-wrap yellow">🛡️</div>
            </div>
            <div className="stat-value">{totalCerts}</div>
            <div className="stat-sub">Minted credentials</div>
          </div>
        </div>

        {/* SPLIT LAYOUT: COURSES TABLE (LEFT) + LIVE ACTIVITY STREAM (RIGHT) */}
        <div className="dashboard-split-grid">
          {/* LEFT WIDE CARD: Courses & Module Curriculums */}
          <div className="dashboard-card main-table-card">
            <div className="card-header-styled">
              <div>
                <div className="card-title-with-icon">
                  <span>📖</span> Courses &amp; Module Curriculums
                </div>
                <p className="card-subtitle-styled">
                  Configure module content, text/video materials, quiz questions, and passing thresholds.
                </p>
              </div>
              <span className="badge badge-primary">{courses.length} Active Courses</span>
            </div>

            {courses.length === 0 ? (
              <div className="card-body" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                <p className="text-gray text-sm">No active courses configured. <Link to="/admin/courses">Create a course →</Link></p>
              </div>
            ) : (
              <div className="table-responsive-wrap">
                <table className="custom-dashboard-table">
                  <thead>
                    <tr>
                      <th>COURSE TITLE</th>
                      <th>CATEGORY</th>
                      <th>MODULES</th>
                      <th>ACCESS</th>
                      <th>PASS %</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courses.map((c, i) => (
                      <tr key={c.id}>
                        <td>
                          <div className="course-title-cell">
                            <div className="course-cell-icon">
                              {i % 2 === 0 ? '💻' : '🔒'}
                            </div>
                            <div>
                              <Link to={`/admin/courses/${c.id}`} className="course-cell-title">
                                {c.title}
                              </Link>
                              <div className="course-cell-sub">
                                Beginner • {c.total_modules * 4}h
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="pill-tag category">
                            {i % 2 === 0 ? 'Software Engineering' : 'Cybersecurity'}
                          </span>
                        </td>
                        <td>
                          <span className="font-semibold">{c.total_modules}</span>
                        </td>
                        <td>
                          <span className="pill-tag access">Public</span>
                        </td>
                        <td>
                          <span className="font-bold text-primary">70%</span>
                        </td>
                        <td>
                          <div className="action-buttons-group">
                            <Link to={`/admin/courses/${c.id}`} className="action-icon-btn" title="Manage Course">
                              👁️
                            </Link>
                            <Link to={`/admin/courses/${c.id}`} className="action-icon-btn" title="Edit Builder">
                              ✏️
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* RIGHT SIDEBAR CARD: Live Activity Stream */}
          <div className="dashboard-card stream-card">
            <div className="card-header-styled">
              <div className="card-title-with-icon">
                <span>🕒</span> Live Activity Stream
              </div>
            </div>

            <div className="activity-stream-list">
              {attempts.length === 0 ? (
                <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--gray-500)', fontSize: 'var(--font-size-sm)' }}>
                  No recent activity records.
                </div>
              ) : (
                attempts.slice(0, 8).map((a) => (
                  <div key={a.attempt_id} className="stream-item">
                    <div className="stream-item-top">
                      <span className="stream-user-name">{a.student_name}</span>
                      <span className={`stream-score-pill ${a.passed ? 'pass' : 'fail'}`}>
                        {a.score}%
                      </span>
                    </div>

                    <div className="stream-action-text">
                      {a.passed ? 'Completed Quiz & Module' : 'Attempted Quiz'}
                    </div>

                    <div className="stream-quiz-title truncate">
                      {a.quiz_title}
                    </div>

                    <div className="stream-timestamp">
                      {formatDate(a.attempted_at)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
