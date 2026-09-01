import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import { useAuth } from '../../context/AuthContext';
import { getAdminDashboard } from '../../services/api';
import { LoadingPage, Alert } from '../../components/ui';

// Avatar color classes cycle
const AVATAR_COLORS = ['', 'green', 'blue', 'orange', 'pink'];

function getInitials(name = '') {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';
}

function relativeTime(iso) {
  if (!iso) return 'just now';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.round(diff)} secs ago`;
  if (diff < 3600) return `${Math.round(diff / 60)} mins ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)} hours ago`;
  return `${Math.round(diff / 86400)} days ago`;
}

const COURSE_THUMB_GRADIENTS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
];

export default function AdminDashboard() {
  const { user } = useAuth();
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
        <LoadingPage message="Loading dashboard…" />
      </AdminLayout>
    );
  }

  const s = data?.summary ?? {};
  const courses = data?.courses ?? [];
  const attempts = data?.recent_quiz_attempts ?? [];

  const totalCourses = s.total_courses ?? courses.length;
  const totalStudents = s.total_students ?? 0;
  const totalEnrollments = s.total_enrollments ?? 0;
  const avgScore = attempts.length > 0
    ? Math.round(attempts.reduce((acc, curr) => acc + (curr.score || 0), 0) / attempts.length)
    : 0;
  const passCount = attempts.filter(a => a.passed).length;
  const completionRate = attempts.length > 0 ? Math.round((passCount / attempts.length) * 100) : 0;
  const totalCerts = s.total_certificates ?? 0;

  const firstName = user?.name?.split(' ')[0] ?? 'Admin';

  return (
    <AdminLayout>
      {/* Page Header */}
      <div className="sm-page-header">
        <div>
          <h1 className="sm-page-title">Dashboard Overview</h1>
          <p className="sm-page-subtitle">
            Welcome back, <strong>{firstName}</strong>. Here's what's happening today.
          </p>
        </div>
        <div className="sm-header-actions">
          <Link to="/admin/students" className="btn btn-outline" id="manage-users-btn">
            👥 User Manager
          </Link>
          <Link to="/admin/courses?tab=assign" className="btn btn-outline" id="assign-courses-btn">
            📋 Assign Courses
          </Link>
          <Link to="/admin/courses" className="btn btn-primary" id="new-course-btn">
            + Manage Courses
          </Link>
        </div>
      </div>

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      {/* Stat Cards — 3 columns matching reference */}
      <div className="sm-stats-row">
        {/* Total Courses */}
        <div className="sm-stat-card">
          <div className="sm-stat-card-top">
            <div className="sm-stat-icon blue">📖</div>
            <span className="sm-trend-badge up">+12%</span>
          </div>
          <div className="sm-stat-value">{totalCourses.toLocaleString()}</div>
          <div className="sm-stat-label">Total Courses</div>
        </div>

        {/* Active Students */}
        <div className="sm-stat-card">
          <div className="sm-stat-card-top">
            <div className="sm-stat-icon violet">👥</div>
            <span className="sm-trend-badge up">+15.4%</span>
          </div>
          <div className="sm-stat-value">{totalStudents.toLocaleString()}</div>
          <div className="sm-stat-label">Active Users</div>
        </div>

        {/* Avg Completion Rate */}
        <div className="sm-stat-card">
          <div className="sm-stat-card-top">
            <div className="sm-stat-icon teal">🎯</div>
            <span className={`sm-trend-badge ${completionRate > 0 ? 'up' : 'neutral'}`}>
              {completionRate > 0 ? `+${completionRate}%` : '0%'}
            </span>
          </div>
          <div className="sm-stat-value">{completionRate}%</div>
          <div className="sm-stat-label">Avg. Completion Rate</div>
        </div>

        {/* Enrollments */}
        <div className="sm-stat-card">
          <div className="sm-stat-card-top">
            <div className="sm-stat-icon orange">📈</div>
            <span className="sm-trend-badge up">+8%</span>
          </div>
          <div className="sm-stat-value">{totalEnrollments.toLocaleString()}</div>
          <div className="sm-stat-label">Enrollments</div>
        </div>

        {/* Avg Quiz Score */}
        <div className="sm-stat-card">
          <div className="sm-stat-card-top">
            <div className="sm-stat-icon amber">🏅</div>
            <span className={`sm-trend-badge ${avgScore >= 70 ? 'up' : 'down'}`}>
              {avgScore}%
            </span>
          </div>
          <div className="sm-stat-value">{avgScore}%</div>
          <div className="sm-stat-label">Avg. Quiz Score</div>
        </div>

        {/* Certificates */}
        <div className="sm-stat-card">
          <div className="sm-stat-card-top">
            <div className="sm-stat-icon green">🛡️</div>
            <span className="sm-trend-badge up">+{totalCerts > 0 ? Math.ceil(totalCerts * 0.08) : 0}</span>
          </div>
          <div className="sm-stat-value">{totalCerts.toLocaleString()}</div>
          <div className="sm-stat-label">Certificates Issued</div>
        </div>
      </div>

      {/* Two Column: Courses table + Activity Feed */}
      <div className="sm-two-col">
        {/* Left: Courses table */}
        <div className="sm-card">
          <div className="sm-card-header">
            <div>
              <div className="sm-card-title">📖 Courses &amp; Curriculums</div>
              <div className="sm-card-subtitle">{courses.length} active courses configured</div>
            </div>
            <Link to="/admin/courses" className="btn btn-outline btn-sm">View all</Link>
          </div>

          {courses.length === 0 ? (
            <div className="sm-card-body" style={{ textAlign: 'center', color: 'var(--gray-500)', fontSize: 'var(--font-size-sm)' }}>
              No courses yet. <Link to="/admin/courses">Create your first course →</Link>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="custom-dashboard-table">
                <thead>
                  <tr>
                    <th>COURSE</th>
                    <th>MODULES</th>
                    <th>PASS %</th>
                    <th>ACTIONS</th>
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
                              color: '#fff',
                              fontSize: '0.85rem',
                            }}
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
                        <span className="font-semibold">{c.total_modules}</span>
                      </td>
                      <td>
                        <span className="font-bold" style={{ color: 'var(--primary)' }}>70%</span>
                      </td>
                      <td>
                        <div className="action-buttons-group">
                          <Link to={`/admin/courses/${c.id}`} className="action-icon-btn" title="View">
                            👁️
                          </Link>
                          <Link to={`/admin/courses/${c.id}`} className="action-icon-btn" title="Edit">
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

        {/* Right: Recent Activity */}
        <div className="sm-card">
          <div className="sm-card-header">
            <div>
              <div className="sm-card-title">Recent Activity</div>
              <div className="sm-card-subtitle">Latest learner events</div>
            </div>
          </div>
          <div className="sm-card-body">
            {attempts.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--gray-400)', fontSize: 'var(--font-size-sm)', padding: '1.5rem 0' }}>
                No recent activity yet.
              </div>
            ) : (
              <div className="sm-activity-list">
                {attempts.slice(0, 8).map((a, i) => (
                  <div key={a.attempt_id} className="sm-activity-item">
                    <div className={`sm-activity-avatar ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}>
                      {getInitials(a.student_name)}
                    </div>
                    <div className="sm-activity-content">
                      <div className="sm-activity-text">
                        <strong>{a.student_name}</strong>{' '}
                        {a.passed ? 'completed' : 'attempted'}{' '}
                        <span className="sm-activity-link">{a.quiz_title}</span>
                        {' '}— scored <strong>{a.score}%</strong>
                      </div>
                      <div className="sm-activity-time">{relativeTime(a.attempted_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
