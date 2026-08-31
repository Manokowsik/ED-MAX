import { useState, useEffect } from 'react';
import {
  createQuiz, createQuestion, createOption,
  updateQuiz, deleteQuiz,
  updateQuestion, deleteQuestion,
  updateOption, deleteOption,
} from '../services/api';
import { Alert, Spinner, ConfirmModal } from './ui';

// ============================================================
// QuizBuilder — supports BOTH create and edit modes
//
// Props:
//   moduleId         — required when creating a new quiz
//   quiz             — pass existing quiz object to enter EDIT mode
//   onQuizCreated()  — called after successful create
//   onQuizUpdated()  — called after successful edit (or quiz deleted)
//   onCancel()       — cancel button handler
// ============================================================

export default function QuizBuilder({ moduleId, quiz: existingQuiz, onQuizCreated, onQuizUpdated, onCancel }) {
  const isEditMode = !!existingQuiz;

  // ── Quiz metadata ─────────────────────────────────────────
  const [title, setTitle] = useState(existingQuiz?.title ?? '');
  const [description, setDescription] = useState(existingQuiz?.description ?? '');
  const [passingScore, setPassingScore] = useState(existingQuiz?.passing_score ?? 70);

  // ── Questions state ───────────────────────────────────────
  // In create mode: fully local state.
  // In edit mode:   questions come from existingQuiz; inline edits are staged.
  const [questions, setQuestions] = useState(() => {
    if (existingQuiz?.questions?.length > 0) {
      return existingQuiz.questions.map((q) => ({
        ...q,
        // Ensure id is always present
        id: q.id,
        // mark as persisted so we know to use PUT instead of POST
        _persisted: true,
        options: (q.options ?? []).map((o) => ({ ...o, _persisted: true })),
      }));
    }
    // Create mode default: one blank question
    const now = Date.now();
    return [
      {
        id: now,
        question_text: '',
        question_order: 1,
        _persisted: false,
        options: [
          { id: now + 1, option_label: 'A', option_text: '', is_correct: true, _persisted: false },
          { id: now + 2, option_label: 'B', option_text: '', is_correct: false, _persisted: false },
          { id: now + 3, option_label: 'C', option_text: '', is_correct: false, _persisted: false },
          { id: now + 4, option_label: 'D', option_text: '', is_correct: false, _persisted: false },
        ],
      },
    ];
  });

  // Reset form when existingQuiz prop changes (e.g. after save and reload)
  useEffect(() => {
    if (existingQuiz) {
      setTitle(existingQuiz.title ?? '');
      setDescription(existingQuiz.description ?? '');
      setPassingScore(existingQuiz.passing_score ?? 70);
      setQuestions(
        (existingQuiz.questions ?? []).map((q) => ({
          ...q,
          _persisted: true,
          options: (q.options ?? []).map((o) => ({ ...o, _persisted: true })),
        }))
      );
    }
  }, [existingQuiz?.id]);

  // ── UI state ──────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmDeleteQuiz, setConfirmDeleteQuiz] = useState(false);
  const [deletingQuiz, setDeletingQuiz] = useState(false);

  // ============================================================
  // Question helpers
  // ============================================================

  function handleAddQuestion() {
    const nextOrder = questions.length + 1;
    const now = Date.now();
    setQuestions([
      ...questions,
      {
        id: now,
        question_text: '',
        question_order: nextOrder,
        _persisted: false,
        options: [
          { id: now + 1, option_label: 'A', option_text: '', is_correct: true, _persisted: false },
          { id: now + 2, option_label: 'B', option_text: '', is_correct: false, _persisted: false },
          { id: now + 3, option_label: 'C', option_text: '', is_correct: false, _persisted: false },
          { id: now + 4, option_label: 'D', option_text: '', is_correct: false, _persisted: false },
        ],
      },
    ]);
  }

  function handleRemoveQuestion(qIndex) {
    if (questions.length <= 1) { setError('A quiz must contain at least one question.'); return; }
    setError('');
    const updated = questions.filter((_, i) => i !== qIndex).map((q, i) => ({ ...q, question_order: i + 1 }));
    setQuestions(updated);
  }

  function handleQuestionTextChange(qIndex, text) {
    const updated = [...questions];
    updated[qIndex] = { ...updated[qIndex], question_text: text };
    setQuestions(updated);
  }

  function handleQuestionOrderChange(qIndex, order) {
    const updated = [...questions];
    updated[qIndex] = { ...updated[qIndex], question_order: Number(order) };
    setQuestions(updated);
  }

  // ============================================================
  // Option helpers
  // ============================================================

  function handleAddOption(qIndex) {
    const q = questions[qIndex];
    if (q.options.length >= 4) { setError('Maximum 4 options (A–D) are supported.'); return; }
    setError('');
    const labels = ['A', 'B', 'C', 'D'];
    const nextLabel = labels[q.options.length];
    const updated = [...questions];
    updated[qIndex] = {
      ...updated[qIndex],
      options: [...q.options, { id: Date.now(), option_label: nextLabel, option_text: '', is_correct: false, _persisted: false }],
    };
    setQuestions(updated);
  }

  function handleRemoveOption(qIndex, optIndex) {
    const q = questions[qIndex];
    if (q.options.length <= 2) { setError('Each question must have at least 2 options.'); return; }
    setError('');
    const labels = ['A', 'B', 'C', 'D'];
    let updatedOptions = q.options.filter((_, i) => i !== optIndex)
      .map((opt, i) => ({ ...opt, option_label: labels[i] }));
    if (!updatedOptions.some((o) => o.is_correct)) updatedOptions[0] = { ...updatedOptions[0], is_correct: true };
    const updated = [...questions];
    updated[qIndex] = { ...updated[qIndex], options: updatedOptions };
    setQuestions(updated);
  }

  function handleOptionTextChange(qIndex, optIndex, text) {
    const updated = [...questions];
    updated[qIndex] = {
      ...updated[qIndex],
      options: updated[qIndex].options.map((o, i) => i === optIndex ? { ...o, option_text: text } : o),
    };
    setQuestions(updated);
  }

  function handleSelectCorrectOption(qIndex, optIndex) {
    const updated = [...questions];
    updated[qIndex] = {
      ...updated[qIndex],
      options: updated[qIndex].options.map((o, i) => ({ ...o, is_correct: i === optIndex })),
    };
    setQuestions(updated);
  }

  // ============================================================
  // Validation
  // ============================================================

  function validate() {
    if (!title.trim()) return 'Quiz Title is required.';
    const ps = Number(passingScore);
    if (isNaN(ps) || ps < 0 || ps > 100) return 'Passing Score must be 0–100.';
    if (questions.length === 0) return 'At least one question is required.';
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question_text.trim()) return `Question #${i + 1} text cannot be empty.`;
      if (!q.options || q.options.length < 2) return `Question #${i + 1} must have at least 2 options.`;
      let hasCorrect = false;
      for (const opt of q.options) {
        if (!opt.option_text.trim()) return `Question #${i + 1}, Option ${opt.option_label} cannot be empty.`;
        if (opt.is_correct) hasCorrect = true;
      }
      if (!hasCorrect) return `Question #${i + 1} must have a correct answer selected.`;
    }
    return null;
  }

  // ============================================================
  // CREATE mode — sequential save
  // ============================================================

  async function handleCreateQuiz(e) {
    e.preventDefault();
    setError(''); setSuccess('');
    const err = validate();
    if (err) { setError(err); return; }

    setSaving(true);
    try {
      setSaveProgress('Creating quiz…');
      const quizRes = await createQuiz(moduleId, title.trim(), description.trim(), Number(passingScore));
      const quizId = quizRes.quiz.id;

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        setSaveProgress(`Saving Question ${i + 1} of ${questions.length}…`);
        const qRes = await createQuestion(quizId, q.question_text.trim(), q.question_order);
        const questionId = qRes.question.id;
        for (const opt of q.options) {
          await createOption(questionId, opt.option_label, opt.option_text.trim(), opt.is_correct);
        }
      }

      setSuccess('Quiz created successfully!');
      if (onQuizCreated) onQuizCreated();
    } catch (err) {
      setError(err.message || 'Failed to save quiz.');
    } finally {
      setSaving(false);
      setSaveProgress('');
    }
  }

  // ============================================================
  // EDIT mode — smart diff: only update changed records
  // ============================================================

  async function handleUpdateQuiz(e) {
    e.preventDefault();
    setError(''); setSuccess('');
    const err = validate();
    if (err) { setError(err); return; }

    setSaving(true);
    try {
      // 1. Update quiz metadata if changed
      const metaChanged =
        title.trim() !== existingQuiz.title ||
        description.trim() !== (existingQuiz.description ?? '') ||
        Number(passingScore) !== existingQuiz.passing_score;

      if (metaChanged) {
        setSaveProgress('Updating quiz settings…');
        await updateQuiz(existingQuiz.id, {
          title: title.trim(),
          description: description.trim(),
          passingScore: Number(passingScore),
        });
      }

      // 2. Identify deleted questions (were persisted, now removed from local state)
      const localQuestionIds = new Set(questions.filter((q) => q._persisted).map((q) => q.id));
      for (const orig of existingQuiz.questions ?? []) {
        if (!localQuestionIds.has(orig.id)) {
          setSaveProgress(`Deleting removed question…`);
          await deleteQuestion(orig.id);
        }
      }

      // 3. Process each local question
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        let questionId;

        if (q._persisted) {
          // Find original to check if changed
          const origQ = (existingQuiz.questions ?? []).find((oq) => oq.id === q.id);
          const qChanged = origQ && (
            q.question_text.trim() !== origQ.question_text ||
            q.question_order !== origQ.question_order
          );
          if (qChanged) {
            setSaveProgress(`Updating question ${i + 1}…`);
            await updateQuestion(q.id, { questionText: q.question_text.trim(), questionOrder: q.question_order });
          }
          questionId = q.id;

          // Handle deleted options
          const localOptIds = new Set(q.options.filter((o) => o._persisted).map((o) => o.id));
          for (const origOpt of origQ?.options ?? []) {
            if (!localOptIds.has(origOpt.id)) {
              setSaveProgress(`Deleting removed option…`);
              await deleteOption(questionId, origOpt.id);
            }
          }

          // Handle changed / new options (sort so is_correct=true is updated last)
          const sortedOptions = [...q.options].sort((a, b) => (a.is_correct === b.is_correct ? 0 : a.is_correct ? 1 : -1));
          for (const opt of sortedOptions) {
            if (opt._persisted) {
              const origOpt = (origQ?.options ?? []).find((oo) => oo.id === opt.id);
              const optChanged = origOpt && (
                opt.option_text.trim() !== origOpt.option_text ||
                opt.is_correct !== origOpt.is_correct
              );
              if (optChanged) {
                setSaveProgress(`Updating option ${opt.option_label}…`);
                await updateOption(questionId, opt.id, {
                  optionText: opt.option_text.trim(),
                  isCorrect: opt.is_correct,
                });
              }
            } else {
              setSaveProgress(`Adding new option ${opt.option_label}…`);
              await createOption(questionId, opt.option_label, opt.option_text.trim(), opt.is_correct);
            }
          }
        } else {
          // New question — create it and all its options
          setSaveProgress(`Adding new question ${i + 1}…`);
          const qRes = await createQuestion(existingQuiz.id, q.question_text.trim(), q.question_order);
          questionId = qRes.question.id;
          for (const opt of q.options) {
            await createOption(questionId, opt.option_label, opt.option_text.trim(), opt.is_correct);
          }
        }
      }

      setSuccess('Quiz updated successfully!');
      if (onQuizUpdated) onQuizUpdated();
    } catch (err) {
      setError(err.message || 'Failed to update quiz.');
    } finally {
      setSaving(false);
      setSaveProgress('');
    }
  }

  // ============================================================
  // DELETE entire quiz
  // ============================================================

  async function handleDeleteQuiz() {
    setDeletingQuiz(true);
    try {
      await deleteQuiz(existingQuiz.id);
      if (onQuizUpdated) onQuizUpdated();
    } catch (err) {
      setError(err.message || 'Failed to delete quiz.');
    } finally {
      setDeletingQuiz(false);
      setConfirmDeleteQuiz(false);
    }
  }

  // ============================================================
  // Render
  // ============================================================

  const handleSubmit = isEditMode ? handleUpdateQuiz : handleCreateQuiz;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h3 style={styles.title}>
            {isEditMode ? '✏️ Edit Quiz' : '📝 Create Module Quiz'}
          </h3>
          <p style={styles.subtitle}>
            {isEditMode
              ? 'Edit the quiz title, passing score, questions and options.'
              : 'Define quiz title, passing score, questions, options, and correct answers.'}
          </p>
        </div>
        {isEditMode && (
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() => setConfirmDeleteQuiz(true)}
            disabled={saving || deletingQuiz}
            id="delete-quiz-btn"
          >
            🗑 Delete Quiz
          </button>
        )}
      </div>

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert type="success">{success}</Alert>}

      <form onSubmit={handleSubmit} noValidate>
        {/* QUIZ SETTINGS */}
        <div style={styles.sectionCard}>
          <h4 style={styles.sectionTitle}>Quiz Settings</h4>
          <div className="form-group">
            <label className="form-label" htmlFor="quiz-title">Quiz Title *</label>
            <input
              id="quiz-title"
              type="text"
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Module 1 Knowledge Check"
              required
              disabled={saving}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="quiz-desc">Description</label>
            <textarea
              id="quiz-desc"
              className="form-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Instructions or summary for students"
              disabled={saving}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="quiz-passing-score">Passing Score (%) *</label>
            <input
              id="quiz-passing-score"
              type="number"
              className="form-input"
              value={passingScore}
              onChange={(e) => setPassingScore(e.target.value)}
              min={0}
              max={100}
              style={{ width: 140 }}
              required
              disabled={saving}
            />
            <span className="form-hint">Score required for student to pass module quiz.</span>
          </div>
        </div>

        {/* QUESTIONS LIST */}
        <div style={{ marginTop: 'var(--space-6)' }}>
          <div className="flex items-center justify-between mb-4">
            <h4 style={styles.sectionTitle}>Questions ({questions.length})</h4>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleAddQuestion}
              disabled={saving}
              id="add-question-builder-btn"
            >
              + Add Question
            </button>
          </div>

          {questions.map((q, qIdx) => (
            <div key={q.id} style={styles.questionBox}>
              <div className="flex items-center justify-between mb-3">
                <span style={styles.questionNumber}>
                  Question {qIdx + 1}
                  {q._persisted && <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--gray-400)', marginLeft: 6 }}>(saved)</span>}
                </span>
                <div className="flex items-center gap-3">
                  <label className="text-xs text-gray flex items-center gap-1">
                    Order:
                    <input
                      type="number"
                      className="form-input"
                      value={q.question_order}
                      onChange={(e) => handleQuestionOrderChange(qIdx, e.target.value)}
                      style={{ width: 60, padding: '2px 6px' }}
                      min={1}
                      disabled={saving}
                    />
                  </label>
                  {questions.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => handleRemoveQuestion(qIdx)}
                      disabled={saving}
                      id={`remove-question-btn-${qIdx}`}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              {/* Question Text */}
              <div className="form-group">
                <label className="form-label">Question Text *</label>
                <input
                  type="text"
                  className="form-input"
                  value={q.question_text}
                  onChange={(e) => handleQuestionTextChange(qIdx, e.target.value)}
                  placeholder={`Enter question #${qIdx + 1}`}
                  required
                  disabled={saving}
                />
              </div>

              {/* Options */}
              <div style={styles.optionsContainer}>
                <div className="flex items-center justify-between mb-2">
                  <span style={styles.optionsLabel}>Options (Select 1 Correct Answer):</span>
                  {q.options.length < 4 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleAddOption(qIdx)}
                      disabled={saving}
                    >
                      + Add Option
                    </button>
                  )}
                </div>

                {q.options.map((opt, optIdx) => (
                  <div
                    key={opt.id}
                    style={{
                      ...styles.optionRow,
                      border: opt.is_correct ? '2px solid var(--success)' : '1px solid var(--gray-300)',
                      background: opt.is_correct ? 'var(--success-light)' : '#fff',
                    }}
                  >
                    {/* Correct Radio */}
                    <label style={styles.radioLabel} title="Set as Correct Answer">
                      <input
                        type="radio"
                        name={`correct-answer-q-${q.id}`}
                        checked={opt.is_correct}
                        onChange={() => handleSelectCorrectOption(qIdx, optIdx)}
                        disabled={saving}
                      />
                      <span style={{ fontWeight: 700, color: opt.is_correct ? 'var(--success-text)' : 'var(--primary)' }}>
                        Option {opt.option_label}
                      </span>
                    </label>

                    {/* Option Text */}
                    <input
                      type="text"
                      className="form-input"
                      style={{ flex: 1 }}
                      value={opt.option_text}
                      onChange={(e) => handleOptionTextChange(qIdx, optIdx, e.target.value)}
                      placeholder={`Enter text for option ${opt.option_label}`}
                      required
                      disabled={saving}
                    />

                    {opt.is_correct ? (
                      <span className="badge badge-success">✓ Correct</span>
                    ) : (
                      <span className="badge badge-gray">Incorrect</span>
                    )}

                    {q.options.length > 2 && (
                      <button
                        type="button"
                        style={styles.removeOptBtn}
                        onClick={() => handleRemoveOption(qIdx, optIdx)}
                        title="Remove Option"
                        disabled={saving}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* FOOTER */}
        <div style={styles.footer}>
          {saveProgress && (
            <div className="flex items-center gap-2 text-sm text-gray mr-auto">
              <Spinner />
              <span>{saveProgress}</span>
            </div>
          )}
          <div className="flex items-center gap-3 ml-auto">
            {onCancel && (
              <button type="button" className="btn btn-outline" onClick={onCancel} disabled={saving}>
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={saving}
              id="save-quiz-btn"
            >
              {saving ? <Spinner /> : isEditMode ? '💾 Save Changes' : '💾 Save Quiz'}
            </button>
          </div>
        </div>
      </form>

      {/* Delete quiz confirm */}
      {confirmDeleteQuiz && (
        <ConfirmModal
          title="Delete Quiz"
          message={`Are you sure you want to delete this quiz and all its questions? This cannot be undone. Student attempt records will be preserved.`}
          onConfirm={handleDeleteQuiz}
          onCancel={() => setConfirmDeleteQuiz(false)}
          danger
          loading={deletingQuiz}
        />
      )}
    </div>
  );
}

// ============================================================
// Styles
// ============================================================
const styles = {
  container: {
    background: '#fff',
    border: '1px solid var(--gray-200)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-6)',
    boxShadow: 'var(--shadow-sm)',
    marginBottom: 'var(--space-6)',
  },
  header: {
    marginBottom: 'var(--space-5)',
    borderBottom: '1px solid var(--gray-200)',
    paddingBottom: 'var(--space-4)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 'var(--space-4)',
  },
  title: {
    fontSize: 'var(--font-size-lg)',
    fontWeight: 700,
    color: 'var(--gray-900)',
  },
  subtitle: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--gray-500)',
    marginTop: 'var(--space-1)',
  },
  sectionCard: {
    background: 'var(--gray-50)',
    border: '1px solid var(--gray-200)',
    borderRadius: 'var(--radius)',
    padding: 'var(--space-4)',
  },
  sectionTitle: {
    fontSize: 'var(--font-size-base)',
    fontWeight: 600,
    color: 'var(--gray-800)',
    marginBottom: 'var(--space-3)',
  },
  questionBox: {
    background: 'var(--gray-50)',
    border: '1px solid var(--gray-200)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-5)',
    marginBottom: 'var(--space-4)',
  },
  questionNumber: {
    fontSize: 'var(--font-size-base)',
    fontWeight: 700,
    color: 'var(--primary)',
  },
  optionsContainer: {
    marginTop: 'var(--space-3)',
  },
  optionsLabel: {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 600,
    color: 'var(--gray-700)',
  },
  optionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    padding: 'var(--space-3)',
    borderRadius: 'var(--radius)',
    marginBottom: 'var(--space-2)',
    transition: 'all var(--transition)',
  },
  radioLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    cursor: 'pointer',
    userSelect: 'none',
    minWidth: 100,
  },
  removeOptBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--gray-400)',
    cursor: 'pointer',
    fontSize: '1rem',
    padding: '0 4px',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    marginTop: 'var(--space-6)',
    paddingTop: 'var(--space-4)',
    borderTop: '1px solid var(--gray-200)',
  },
};
