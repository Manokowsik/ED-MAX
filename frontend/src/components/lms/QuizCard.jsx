import React from 'react';

/**
 * Reusable Question Card Component for Admin QuizBuilder
 */
export default function QuizCard({
  question,
  questionNumber,
  totalQuestions,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDelete,
  onAddOption,
  onDeleteOption,
}) {
  const options = question.options ?? [];

  return (
    <div className="lms-quiz-question-card">
      {/* Question Header & Order Controls */}
      <div className="lms-quiz-card-header">
        <div className="lms-quiz-card-number">
          <span className="lms-q-badge">Question {questionNumber}</span>
        </div>

        <div className="lms-quiz-card-controls">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onMoveUp}
            disabled={questionNumber === 1}
            title="Move Question Up"
          >
            ▲ Up
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onMoveDown}
            disabled={questionNumber === totalQuestions}
            title="Move Question Down"
          >
            ▼ Down
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm text-danger"
            onClick={onDelete}
            title="Delete Question"
          >
            🗑️ Delete
          </button>
        </div>
      </div>

      {/* Question Text */}
      <div className="lms-quiz-card-body">
        <h4 className="lms-quiz-question-text">
          {question.question_text}
        </h4>

        {/* Options List */}
        <div className="lms-quiz-options-list">
          {options.length === 0 ? (
            <p className="text-xs text-gray italic">No options configured for this question.</p>
          ) : (
            options.map((opt) => (
              <div
                key={opt.id || opt.option_label}
                className={`lms-quiz-option-row${opt.is_correct ? ' is-correct' : ''}`}
              >
                <div className={`lms-option-chip${opt.is_correct ? ' correct' : ''}`}>
                  {opt.option_label}
                </div>

                <div className="lms-option-text font-medium">
                  {opt.option_text}
                </div>

                {opt.is_correct && (
                  <span className="lms-badge success ml-auto">
                    ✓ Correct Answer
                  </span>
                )}

                {onDeleteOption && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm text-gray"
                    onClick={() => onDeleteOption(opt.id)}
                    title="Delete Option"
                    style={{ padding: '2px 6px', fontSize: '0.75rem' }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
