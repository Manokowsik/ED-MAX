import React from 'react';

/**
 * Standardized icon renderer for LMS content items
 * @param {string} type - 'TEXT' | 'VIDEO' | 'DOCUMENT' | 'RESOURCE' | 'QUIZ' | 'ASSIGNMENT'
 * @param {string} status - 'COMPLETED' | 'LOCKED' | 'ACTIVE' | 'DEFAULT'
 * @param {string} size - 'sm' | 'md' | 'lg'
 */
export default function LearningItemIcon({ type, status, size = 'md' }) {
  if (status === 'COMPLETED') {
    return (
      <div className={`lms-item-icon status-completed size-${size}`} title="Completed">
        ✓
      </div>
    );
  }

  if (status === 'LOCKED') {
    return (
      <div className={`lms-item-icon status-locked size-${size}`} title="Locked">
        🔒
      </div>
    );
  }

  const normalizedType = (type || 'TEXT').toUpperCase();

  switch (normalizedType) {
    case 'VIDEO':
      return (
        <div className={`lms-item-icon type-video size-${size}`} title="Video Lesson">
          🎥
        </div>
      );
    case 'DOCUMENT':
      return (
        <div className={`lms-item-icon type-document size-${size}`} title="Document / PDF">
          📑
        </div>
      );
    case 'RESOURCE':
      return (
        <div className={`lms-item-icon type-resource size-${size}`} title="External Resource">
          🔗
        </div>
      );
    case 'QUIZ':
      return (
        <div className={`lms-item-icon type-quiz size-${size}`} title="Module Quiz">
          📝
        </div>
      );
    case 'ASSIGNMENT':
      return (
        <div className={`lms-item-icon type-assignment size-${size}`} title="Assignment">
          📋
        </div>
      );
    case 'TEXT':
    default:
      return (
        <div className={`lms-item-icon type-text size-${size}`} title="Text Lesson">
          📄
        </div>
      );
  }
}
