import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import StudentLayout from '../../layouts/StudentLayout';
import { useAuth } from '../../context/AuthContext';
import { getStudentCourses } from '../../services/api';
import { LoadingPage, Alert, EmptyState, Badge, ProgressBar } from '../../components/ui';

export default function StudentCourses() {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
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

  if (loading) {
    return (
      <StudentLayout>
        <div className="page-container"><LoadingPage message="Loading your courses…" /></div>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout>
      <div className="page-container">
        <div className="page-header mb-6">
          <h1 className="page-title">My Courses</h1>
          <p className="page-subtitle">{courses.length} course{courses.length !== 1 ? 's' : ''} assigned to you</p>
        </div>

        {error && <Alert type="error">{error}</Alert>}

        {courses.length === 0 ? (
          <EmptyState
            icon="📚"
            title="No courses yet"
            text="Your administrator has not assigned any courses to you. Please contact them to get started."
          />
        ) : (
          <div className="course-grid">
            {courses.map(c => (
              <div key={c.course_id} className="course-card" id={`course-card-${c.course_id}`}>
                <div className="course-card-header">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h2 className="course-card-title">{c.title}</h2>
                    <Badge variant={c.status === 'COMPLETED' ? 'success' : 'primary'} style={{ flexShrink: 0 }}>
                      {c.status}
                    </Badge>
                  </div>
                  <p className="course-card-desc">{c.description || 'No description available.'}</p>
                </div>

                <div className="course-card-body">
                  {/* Progress */}
                  <div style={{ marginBottom: 'var(--space-2)' }}>
                    <div className="flex items-center justify-between text-xs text-gray mb-1">
                      <span>Progress</span>
                      <span>{c.progress_percentage}%</span>
                    </div>
                    <ProgressBar
                      value={c.progress_percentage}
                      max={100}
                      variant={c.progress_percentage === 100 ? 'success' : 'primary'}
                    />
                  </div>
                  <div className="text-xs text-gray">
                    {c.completed_modules} of {c.total_modules} modules completed
                  </div>
                </div>

                <div className="course-card-footer">
                  <span className="text-xs text-gray">
                    {c.progress_percentage === 100 ? '✅ Complete' : c.progress_percentage > 0 ? '⏳ In Progress' : '🆕 Not started'}
                  </span>
                  <Link
                    to={`/student/courses/${c.course_id}`}
                    className="btn btn-primary btn-sm"
                    id={`open-course-${c.course_id}`}
                  >
                    {c.progress_percentage === 100 ? 'Review' : c.progress_percentage > 0 ? 'Continue' : 'Start'}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </StudentLayout>
  );
}
