import React, { useState } from 'react';

/**
 * Modern expandable/collapsible module section component
 */
export default function ModuleAccordion({
  module,
  moduleNumber,
  defaultExpanded = false,
  isLocked = false,
  isCompleted = false,
  activeItemId,
  onSelectItem,
  children,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const contents = module.contents ?? [];
  const quizzes = module.quizzes ?? [];
  const totalItems = contents.length + quizzes.length;

  const estimatedMinutes = contents.length * 15 + quizzes.length * 10;
  const durationText = `${estimatedMinutes} mins`;

  return (
    <div className={`lms-module-accordion${expanded ? ' expanded' : ''}${isLocked ? ' locked' : ''}${isCompleted ? ' completed' : ''}`}>
      {/* Header Bar */}
      <div
        className="lms-module-accordion-header"
        onClick={() => !isLocked && setExpanded(!expanded)}
        style={{ cursor: isLocked ? 'not-allowed' : 'pointer' }}
      >
        <div className="lms-module-header-left">
          <div className={`lms-module-badge-num${isCompleted ? ' completed' : isLocked ? ' locked' : ''}`}>
            {isCompleted ? '✓' : isLocked ? '🔒' : moduleNumber}
          </div>

          <div className="lms-module-header-info">
            <div className="lms-module-title-row">
              <span className="lms-module-order-tag">Module {moduleNumber}</span>
              <h3 className="lms-module-title">{module.title}</h3>
            </div>

            {module.description && (
              <p className="lms-module-desc">{module.description}</p>
            )}

            <div className="lms-module-meta-bar">
              <span className="lms-module-meta-tag">⏱ {durationText}</span>
              <span className="lms-module-meta-tag">📄 {contents.length} {contents.length === 1 ? 'lesson' : 'lessons'}</span>
              {quizzes.length > 0 && (
                <span className="lms-module-meta-tag">📝 {quizzes.length} {quizzes.length === 1 ? 'quiz' : 'quizzes'}</span>
              )}
            </div>
          </div>
        </div>

        <div className="lms-module-header-right">
          {isCompleted ? (
            <span className="lms-badge completed">✓ Completed</span>
          ) : isLocked ? (
            <span className="lms-badge locked">🔒 Locked</span>
          ) : (
            <span className="lms-badge in-progress">In Progress</span>
          )}

          <button
            type="button"
            className="lms-accordion-toggle-btn"
            aria-label={expanded ? 'Collapse module' : 'Expand module'}
          >
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* Expanded Items List */}
      {expanded && !isLocked && (
        <div className="lms-module-accordion-body">
          {children}
        </div>
      )}
    </div>
  );
}
