import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import StudentLayout from '../../layouts/StudentLayout';
import { useAuth } from '../../context/AuthContext';
import { getStudentCourse, completeModule, submitQuiz, generateCertificate } from '../../services/api';
import { LoadingPage, Alert, Badge, ProgressBar, Spinner, EmptyState } from '../../components/ui';
import { parseEmbedUrl } from '../../components/ContentEditor';

// ============================================================
// Video & Embed Render Helper
// ============================================================
function ContentSlideView({ contentItem }) {
  if (!contentItem) return null;

  const type = contentItem.content_type;
  const rawContent = contentItem.content || '';

  if (type === 'TEXT') {
    return (
      <div style={styles.textContent}>
        {rawContent.split('\n\n').map((paragraph, idx) => (
          <p key={idx} style={{ marginBottom: 'var(--space-4)' }}>
            {paragraph}
          </p>
        ))}
      </div>
    );
  }

  // VIDEO or EMBED
  const parsed = parseEmbedUrl(rawContent);

  if (parsed.type === 'youtube' || parsed.type === 'vimeo') {
    return (
      <div style={styles.videoEmbedWrapper}>
        <iframe
          title="Module Video Content"
          src={parsed.embedUrl}
          style={styles.iframe}
          allowFullScreen
        />
      </div>
    );
  }

  if (parsed.type === 'direct_video') {
    return (
      <video controls src={parsed.embedUrl} style={{ width: '100%', maxHeight: 420, borderRadius: 'var(--radius-lg)' }}>
        Your browser does not support this video player.
      </video>
    );
  }

  // External / Non-embeddable link
  return (
    <div style={{ background: 'var(--info-light)', border: '1px solid #bae6fd', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', textAlign: 'center' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-2)' }}>🔗</div>
      <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: '#075985', marginBottom: 'var(--space-2)' }}>
        External Resource
      </h4>
      <p style={{ fontSize: 'var(--font-size-sm)', color: '#0369a1', marginBottom: 'var(--space-4)' }}>
        This content is hosted externally. Click below to open the resource in a new browser tab.
      </p>
      {parsed.embedUrl ? (
        <a
          href={parsed.embedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary"
        >
          Open External Resource ↗
        </a>
      ) : (
        <span className="text-sm text-gray">{rawContent}</span>
      )}
    </div>
  );
}

// ============================================================
// Student Quiz Player & Result Screen
// ============================================================
function StudentQuizPlayer({ quiz, onQuizPassed }) {
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // { question_id: option_label }
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(quiz.last_attempt ?? null);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(!!quiz.last_attempt);

  const questions = quiz.questions ?? [];
  const currentQuestion = questions[currentQIndex];

  function handleSelectOption(questionId, optionLabel) {
    if (submitted && result?.passed) return;
    setAnswers((a) => ({ ...a, [String(questionId)]: optionLabel }));
  }

  async function handleSubmitQuiz(e) {
    e.preventDefault();
    setError('');

    // Check all questions answered
    const unanswered = questions.filter((q) => !answers[String(q.id)]);
    if (unanswered.length > 0) {
      setError(`Please answer all ${questions.length} questions before submitting.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitQuiz(quiz.id, answers);
      setResult(res.result);
      setSubmitted(true);
      if (res.result.passed && onQuizPassed) {
        onQuizPassed(res.result);
      }
    } catch (err) {
      setError(err.message || 'Failed to submit quiz.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleRetryQuiz() {
    setAnswers({});
    setSubmitted(false);
    setResult(null);
    setCurrentQIndex(0);
    setError('');
  }

  if (questions.length === 0) {
    return (
      <div className="alert alert-info" style={{ marginTop: 'var(--space-4)' }}>
        This quiz has no questions available.
      </div>
    );
  }

  // QUIZ RESULT VIEW
  if (submitted && result) {
    return (
      <div style={{ ...styles.card, marginTop: 'var(--space-6)' }}>
        <div
          style={{
            background: result.passed ? 'var(--success-light)' : 'var(--danger-light)',
            border: `1px solid ${result.passed ? '#a7f3d0' : '#fecaca'}`,
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-6)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '3.5rem' }}>{result.passed ? '🎉' : '❌'}</div>
          <h3
            style={{
              fontSize: 'var(--font-size-2xl)',
              fontWeight: 700,
              color: result.passed ? 'var(--success-text)' : 'var(--danger-text)',
              margin: 'var(--space-2) 0',
            }}
          >
            {result.passed ? 'Quiz Passed!' : 'Quiz Failed'}
          </h3>

          <p style={{ fontSize: 'var(--font-size-base)', color: result.passed ? 'var(--success-text)' : 'var(--danger-text)' }}>
            Your Score: <strong>{result.score}%</strong> ({result.correct_answers} of {result.total_questions} correct).
            Passing requirement: <strong>{result.passing_score}%</strong>.
          </p>

          {!result.passed && (
            <div style={{ marginTop: 'var(--space-4)' }}>
              <p className="text-sm mb-3" style={{ color: 'var(--danger-text)' }}>
                You need at least {result.passing_score}% score to complete this module. Try again!
              </p>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleRetryQuiz}
                id="retry-quiz-btn"
              >
                🔄 Retry Quiz
              </button>
            </div>
          )}

          {result.passed && (
            <p className="text-sm font-semibold" style={{ marginTop: 'var(--space-4)', color: 'var(--success-text)' }}>
              ✓ Quiz passed! You can now mark this module as complete below.
            </p>
          )}
        </div>
      </div>
    );
  }

  // QUESTION BY QUESTION PLAYBACK
  return (
    <div style={{ ...styles.card, marginTop: 'var(--space-6)' }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--gray-900)' }}>
            📝 {quiz.title}
          </h3>
          <span className="text-xs text-gray">Passing Score: {quiz.passing_score}%</span>
        </div>
        <Badge variant="info">
          Question {currentQIndex + 1} of {questions.length}
        </Badge>
      </div>

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      <div style={styles.quizQuestionBox}>
        <p style={styles.questionText}>
          {currentQIndex + 1}. {currentQuestion.question_text}
        </p>

        {/* Options */}
        <div style={{ marginTop: 'var(--space-4)' }}>
          {currentQuestion.options?.map((opt) => {
            const isSelected = answers[String(currentQuestion.id)] === opt.option_label;
            return (
              <label
                key={opt.id}
                style={{
                  ...styles.quizOptionLabel,
                  borderColor: isSelected ? 'var(--primary)' : 'var(--gray-300)',
                  background: isSelected ? 'var(--primary-light)' : '#fff',
                }}
              >
                <input
                  type="radio"
                  name={`q-${currentQuestion.id}`}
                  value={opt.option_label}
                  checked={isSelected}
                  onChange={() => handleSelectOption(currentQuestion.id, opt.option_label)}
                  style={{ accentColor: 'var(--primary)', width: 18, height: 18 }}
                />
                <span style={{ fontWeight: 700, color: 'var(--primary)', width: 24 }}>
                  {opt.option_label}
                </span>
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--gray-800)' }}>
                  {opt.option_text}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* QUIZ NAVIGATION & SUBMIT */}
      <div className="flex items-center justify-between mt-6">
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => setCurrentQIndex((i) => Math.max(0, i - 1))}
          disabled={currentQIndex === 0 || submitting}
        >
          ← Previous Question
        </button>

        {currentQIndex < questions.length - 1 ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setCurrentQIndex((i) => Math.min(questions.length - 1, i + 1))}
            disabled={!answers[String(currentQuestion.id)] || submitting}
          >
            Next Question →
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-success btn-lg"
            onClick={handleSubmitQuiz}
            disabled={Object.keys(answers).length < questions.length || submitting}
            id="submit-quiz-btn"
          >
            {submitting ? <><Spinner /> Submitting Quiz…</> : 'Submit Quiz'}
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Compute per-module state: LOCKED | AVAILABLE | COMPLETED
// Rule: A module is LOCKED if any prior module (lower order) is not completed.
// ============================================================
function computeModuleStates(modules) {
  // Sort by module_order to determine lock sequence
  const sorted = [...modules].sort((a, b) => a.module_order - b.module_order);
  const stateMap = {};
  let encounteredIncomplete = false;

  for (const m of sorted) {
    if (m.completed) {
      stateMap[m.id] = 'COMPLETED';
    } else if (encounteredIncomplete) {
      stateMap[m.id] = 'LOCKED';
    } else {
      stateMap[m.id] = 'AVAILABLE';
      encounteredIncomplete = true;
    }
  }

  return stateMap;
}


// ============================================================
// Main Page: Student Learning Experience
// ============================================================
export default function CourseLearning() {
  const { courseId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Module & Slide Navigation
  const [activeModuleIdx, setActiveModuleIdx] = useState(0);
  const [slideIndex, setSlideIndex] = useState(0); // 0-based index of current slide in active module
  const [viewingMode, setViewingMode] = useState('slides'); // 'slides' | 'quiz'

  // Completion & Certificate
  const [completingMod, setCompletingMod] = useState(false);
  const [moduleError, setModuleError] = useState('');
  const [moduleSuccess, setModuleSuccess] = useState('');

  const [generatingCert, setGeneratingCert] = useState(false);
  const [certError, setCertError] = useState('');

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError('');
    try {
      const res = await getStudentCourse(user.id, Number(courseId));
      setCourse(res.course);

      // Default to first uncompleted module
      const firstIncomplete = res.course.modules?.findIndex((m) => !m.completed);
      if (firstIncomplete >= 0) {
        setActiveModuleIdx(firstIncomplete);
      }
    } catch (err) {
      if (err.message?.includes('403')) {
        setError('You are not enrolled in this course.');
      } else {
        setError(err.message || 'Failed to load course details');
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id, courseId]);

  useEffect(() => { load(); }, [load]);

  // Reset slide index when active module changes
  useEffect(() => {
    setSlideIndex(0);
    setViewingMode('slides');
    setModuleError('');
    setModuleSuccess('');
  }, [activeModuleIdx]);

  async function handleCompleteModule(moduleId) {
    setCompletingMod(true);
    setModuleError('');
    setModuleSuccess('');
    try {
      await completeModule(moduleId);
      setModuleSuccess('Module completed successfully!');
      await load();
    } catch (err) {
      if (err.message?.toLowerCase().includes('quiz') || err.message?.includes('pass')) {
        setModuleError('You must pass the module quiz before marking this module as complete.');
      } else {
        setModuleError(err.message || 'Failed to complete module.');
      }
    } finally {
      setCompletingMod(false);
    }
  }

  async function handleGenerateCertificate() {
    setGeneratingCert(true);
    setCertError('');
    try {
      await generateCertificate(Number(courseId));
      navigate('/student/certificates');
    } catch (err) {
      setCertError(err.message || 'Failed to generate certificate.');
    } finally {
      setGeneratingCert(false);
    }
  }

  if (loading) {
    return (
      <StudentLayout>
        <div className="page-container"><LoadingPage message="Loading learning material…" /></div>
      </StudentLayout>
    );
  }

  if (error || !course) {
    return (
      <StudentLayout>
        <div className="page-container">
          <div className="mb-4"><Link to="/student/courses" className="text-gray text-sm">← Back to My Courses</Link></div>
          <Alert type="error">{error || 'Course not found'}</Alert>
        </div>
      </StudentLayout>
    );
  }

  const modules = course.modules ?? [];
  const completedCount = modules.filter((m) => m.completed).length;
  const progressPct = modules.length > 0 ? Math.round((completedCount / modules.length) * 100) : 0;
  const isCourseComplete = modules.length > 0 && completedCount === modules.length;

  // Compute lock states for the full sidebar
  const moduleStateMap = computeModuleStates(modules);

  const activeModule = modules[activeModuleIdx];
  const slides = activeModule?.contents ?? [];
  const activeSlide = slides[slideIndex];
  const hasQuiz = activeModule?.quizzes && activeModule.quizzes.length > 0;
  const quiz = hasQuiz ? activeModule.quizzes[0] : null;

  return (
    <StudentLayout>
      <div className="page-container">
        {/* Breadcrumb */}
        <div className="mb-4">
          <Link to="/student/courses" className="text-gray text-sm">← Back to My Courses</Link>
        </div>

        {/* Course Header Banner */}
        <div className="card mb-6">
          <div className="card-body">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="page-title">{course.title}</h1>
                <p className="page-subtitle">{course.description}</p>
              </div>
              <Badge variant={isCourseComplete ? 'success' : 'primary'}>
                {isCourseComplete ? '✓ Course Completed' : 'In Progress'}
              </Badge>
            </div>

            {/* REAL BACKEND PROGRESS */}
            <div style={{ marginTop: 'var(--space-4)' }}>
              <div className="flex items-center justify-between text-xs text-gray mb-1">
                <span>Course Progress</span>
                <span className="font-semibold">{completedCount} of {modules.length} modules complete ({progressPct}%)</span>
              </div>
              <ProgressBar value={progressPct} max={100} variant={isCourseComplete ? 'success' : 'primary'} />
            </div>

            {/* CERTIFICATE BUTTON */}
            {isCourseComplete && (
              <div style={{ marginTop: 'var(--space-4)' }}>
                {certError && <Alert type="error">{certError}</Alert>}
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={handleGenerateCertificate}
                  disabled={generatingCert}
                  id="generate-cert-banner-btn"
                >
                  {generatingCert ? <><Spinner /> Generating…</> : '🎓 View Certificate'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* LEARNING LAYOUT: SIDEBAR + SLIDE CONTENT */}
        {modules.length === 0 ? (
          <EmptyState icon="📦" title="No modules available" text="This course has no modules created yet." />
        ) : (
          <div className="learning-layout">
            {/* MODULE NAVIGATION SIDEBAR */}
            <div className="module-sidebar">
              <div className="module-sidebar-header">
                <div className="module-sidebar-title">Course Modules</div>
                <div className="module-sidebar-progress">{completedCount}/{modules.length} Complete</div>
              </div>

              {modules.map((m, idx) => {
                const isActive = idx === activeModuleIdx;
                const mState = moduleStateMap[m.id] ?? 'AVAILABLE';
                const isLocked = mState === 'LOCKED';

                return (
                  <div
                    key={m.id}
                    className={`module-item${isActive ? ' active' : ''}${isLocked ? ' locked' : ''}`}
                    onClick={() => !isLocked && setActiveModuleIdx(idx)}
                    id={`sidebar-mod-${m.id}`}
                    title={isLocked ? 'Complete previous modules first' : ''}
                    style={isLocked ? { cursor: 'not-allowed', opacity: 0.55 } : {}}
                  >
                    <div
                      className={`module-item-icon${mState === 'COMPLETED' ? ' completed' : isActive ? ' active' : ''}`}
                    >
                      {mState === 'COMPLETED' ? '✓' : isLocked ? '🔒' : idx + 1}
                    </div>

                    <div className="module-item-text">
                      <div className="module-item-title">
                        Module {m.module_order}: {m.title}
                      </div>
                      <div className="module-item-sub">
                        {mState === 'COMPLETED' ? (
                          <span style={{ color: 'var(--success-text)', fontWeight: 600 }}>✓ Completed</span>
                        ) : isLocked ? (
                          <span style={{ color: 'var(--gray-500)' }}>🔒 Locked • {m.contents?.some(c => c.content_type === 'VIDEO') ? '⏱ 40m • Hybrid' : '⏱ 30m • Text'}</span>
                        ) : (
                          <span>⏱ {m.contents?.length ? m.contents.length * 15 : 30}m • {m.contents?.some(c => c.content_type === 'VIDEO') ? 'Hybrid' : 'Text'}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* MAIN SLIDE / QUIZ CONTENT AREA */}
            <div className="content-area">
              {activeModule && (
                <>
                  {/* Module Header Bar */}
                  <div className="content-header">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--gray-900)' }}>
                          Module {activeModule.module_order}: {activeModule.title}
                        </h2>
                        {activeModule.description && (
                          <p className="text-xs text-gray mt-1">{activeModule.description}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {hasQuiz && (
                          <button
                            type="button"
                            className={`btn btn-sm${viewingMode === 'quiz' ? ' btn-primary' : ' btn-outline'}`}
                            onClick={() => setViewingMode(viewingMode === 'quiz' ? 'slides' : 'quiz')}
                            id="toggle-quiz-view-btn"
                          >
                            {viewingMode === 'quiz' ? '📄 Back to Slides' : '📝 Take Quiz'}
                          </button>
                        )}

                        <Badge variant={activeModule.completed ? 'success' : 'gray'}>
                          {activeModule.completed ? '✓ Completed' : 'In Progress'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="content-body">
                    {moduleError && <Alert type="error" onClose={() => setModuleError('')}>{moduleError}</Alert>}
                    {moduleSuccess && <Alert type="success" onClose={() => setModuleSuccess('')}>{moduleSuccess}</Alert>}

                    {/* MODE 1: SLIDES PRESENTATION */}
                    {viewingMode === 'slides' && (
                      <div>
                        {slides.length === 0 ? (
                          <EmptyState
                            icon="📄"
                            title="No Content Slides"
                            text="This module has no training slides."
                            action={
                              hasQuiz && (
                                <button type="button" className="btn btn-primary" onClick={() => setViewingMode('quiz')}>
                                  Go to Quiz
                                </button>
                              )
                            }
                          />
                        ) : (
                          <div>
                            {/* SLIDE CARD */}
                            <div style={styles.slideCard}>
                              <div className="flex items-center justify-between mb-4 pb-2" style={{ borderBottom: '1px solid var(--gray-200)' }}>
                                <span className="text-xs font-semibold text-gray">
                                  Slide {slideIndex + 1} of {slides.length}
                                </span>
                                <Badge variant={activeSlide?.content_type === 'VIDEO' ? 'primary' : 'gray'}>
                                  {activeSlide?.content_type === 'VIDEO' ? '🎥 Video Slide' : '📄 Text Slide'}
                                </Badge>
                              </div>

                              {/* SLIDE CONTENT */}
                              <ContentSlideView contentItem={activeSlide} />
                            </div>

                            {/* SLIDE NAVIGATION CONTROLS */}
                            <div className="flex items-center justify-between mt-6">
                              <button
                                type="button"
                                className="btn btn-outline"
                                onClick={() => setSlideIndex((i) => Math.max(0, i - 1))}
                                disabled={slideIndex === 0}
                                id="prev-slide-btn"
                              >
                                ← Previous Slide
                              </button>

                              <span className="text-xs text-gray font-semibold">
                                {slideIndex + 1} / {slides.length}
                              </span>

                              {slideIndex < slides.length - 1 ? (
                                <button
                                  type="button"
                                  className="btn btn-primary"
                                  onClick={() => setSlideIndex((i) => Math.min(slides.length - 1, i + 1))}
                                  id="next-slide-btn"
                                >
                                  Next Slide →
                                </button>
                              ) : (
                                hasQuiz ? (
                                  <button
                                    type="button"
                                    className="btn btn-primary btn-lg"
                                    onClick={() => setViewingMode('quiz')}
                                    id="continue-to-quiz-btn"
                                  >
                                    Continue to Quiz →
                                  </button>
                                ) : (
                                  !activeModule.completed && (
                                    <button
                                      type="button"
                                      className="btn btn-success btn-lg"
                                      onClick={() => handleCompleteModule(activeModule.id)}
                                      disabled={completingMod}
                                      id="complete-module-slide-btn"
                                    >
                                      {completingMod ? <><Spinner /> Completing…</> : '✅ Complete Module'}
                                    </button>
                                  )
                                )
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* MODE 2: QUIZ PLAYER */}
                    {viewingMode === 'quiz' && quiz && (
                      <StudentQuizPlayer
                        quiz={quiz}
                        onQuizPassed={() => {
                          load();
                        }}
                      />
                    )}

                    {/* MODULE COMPLETION BUTTON (when slides or quiz done) */}
                    {!activeModule.completed && (hasQuiz ? quiz?.last_attempt?.passed : true) && (
                      <div style={{ marginTop: 'var(--space-6)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--gray-200)', textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-success btn-lg"
                          onClick={() => handleCompleteModule(activeModule.id)}
                          disabled={completingMod}
                          id="mark-module-complete-final-btn"
                        >
                          {completingMod ? <><Spinner /> Completing…</> : '✅ Mark Module as Complete'}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </StudentLayout>
  );
}

const styles = {
  card: {
    background: '#fff',
    border: '1px solid var(--gray-200)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-6)',
    boxShadow: 'var(--shadow-sm)',
  },
  slideCard: {
    background: '#fff',
    border: '1px solid var(--gray-200)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-6)',
    boxShadow: 'var(--shadow-sm)',
    minHeight: 280,
  },
  textContent: {
    fontSize: 'var(--font-size-base)',
    lineHeight: 1.8,
    color: 'var(--gray-800)',
  },
  videoEmbedWrapper: {
    position: 'relative',
    paddingBottom: '56.25%',
    height: 0,
    overflow: 'hidden',
    borderRadius: 'var(--radius-lg)',
    background: 'var(--gray-900)',
  },
  iframe: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    border: 'none',
  },
  quizQuestionBox: {
    background: 'var(--gray-50)',
    border: '1px solid var(--gray-200)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-6)',
  },
  questionText: {
    fontSize: 'var(--font-size-lg)',
    fontWeight: 600,
    color: 'var(--gray-900)',
  },
  quizOptionLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    padding: 'var(--space-4)',
    border: '1px solid var(--gray-300)',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    marginBottom: 'var(--space-3)',
    transition: 'all var(--transition)',
  },
};
