import React from 'react';
import LearningItemIcon from './LearningItemIcon';

/**
 * Reusable LearningItem row component
 */
export default function LearningItem({
  title,
  type = 'TEXT',
  duration,
  status = 'DEFAULT',
  isActive = false,
  isLocked = false,
  onClick,
  action,
  subtitle,
  className = '',
}) {
  const effectiveStatus = isLocked ? 'LOCKED' : status;

  return (
    <div
      className={`lms-learning-item${isActive ? ' active' : ''}${isLocked ? ' locked' : ''} ${className}`}
      onClick={!isLocked && onClick ? onClick : undefined}
      role={onClick && !isLocked ? 'button' : undefined}
      tabIndex={onClick && !isLocked ? 0 : undefined}
      style={{ cursor: isLocked ? 'not-allowed' : onClick ? 'pointer' : 'default' }}
    >
      <LearningItemIcon type={type} status={effectiveStatus} size="md" />

      <div className="lms-item-details">
        <div className="lms-item-title-row">
          <span className="lms-item-title">{title}</span>
          {effectiveStatus === 'COMPLETED' && (
            <span className="lms-badge completed">Completed</span>
          )}
          {isActive && (
            <span className="lms-badge active">Current</span>
          )}
          {effectiveStatus === 'LOCKED' && (
            <span className="lms-badge locked">Locked</span>
          )}
        </div>

        {(duration || subtitle) && (
          <div className="lms-item-meta">
            {duration && <span className="lms-meta-tag">⏱ {duration}</span>}
            {subtitle && <span className="lms-meta-tag">{subtitle}</span>}
          </div>
        )}
      </div>

      {action && <div className="lms-item-action">{action}</div>}
    </div>
  );
}
