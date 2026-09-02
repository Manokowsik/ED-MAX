import React from 'react';

/**
 * Modern Course Hero Banner Component for LMS course pages
 */
export default function CourseHeader({
  title,
  description,
  instructor = 'ED-MAX Learning',
  progressPct = 0,
  completedCount = 0,
  moduleCount = 0,
  lessonCount = 0,
  quizCount = 0,
  estimatedHours,
  isCompleted = false,
  action,
}) {
  const estTimeDisplay = estimatedHours
    ? `${estimatedHours} hrs`
    : `${Math.max(1, Math.round((lessonCount * 15 + quizCount * 10) / 60 * 10) / 10)} hrs`;

  return (
    <div className="lms-course-header-hero">
      <div className="lms-hero-top-row">
        <div className="lms-hero-info">
          <div className="lms-hero-breadcrumbs">
            <span>Courses</span>
            <span className="sep">/</span>
            <span className="active">{title}</span>
          </div>

          <h1 className="lms-hero-title">{title}</h1>
          {description && <p className="lms-hero-desc">{description}</p>}

          <div className="lms-hero-meta-bar">
            <span className="lms-hero-meta-item">
              👤 <strong>Instructor:</strong> {instructor}
            </span>
            <span className="lms-hero-meta-item">
              📦 <strong>{moduleCount}</strong> {moduleCount === 1 ? 'Module' : 'Modules'}
            </span>
            <span className="lms-hero-meta-item">
              📄 <strong>{lessonCount}</strong> {lessonCount === 1 ? 'Lesson' : 'Lessons'}
            </span>
            {quizCount > 0 && (
              <span className="lms-hero-meta-item">
                📝 <strong>{quizCount}</strong> {quizCount === 1 ? 'Quiz' : 'Quizzes'}
              </span>
            )}
            <span className="lms-hero-meta-item">
              ⏱ <strong>{estTimeDisplay}</strong> estimated
            </span>
          </div>
        </div>

        {action && <div className="lms-hero-action-slot">{action}</div>}
      </div>

      {/* Progress UX Bar */}
      <div className="lms-hero-progress-container">
        <div className="lms-hero-progress-label">
          <span className="label-text">Course Progress</span>
          <span className="pct-text font-semibold">
            {completedCount} of {moduleCount} modules complete ({progressPct}%)
          </span>
        </div>

        <div className="lms-progress-track">
          <div
            className={`lms-progress-fill${isCompleted ? ' completed' : ''}`}
            style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
          />
        </div>
      </div>
    </div>
  );
}
