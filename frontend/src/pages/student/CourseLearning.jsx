import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import StudentLayout from '../../layouts/StudentLayout';
import { useAuth } from '../../context/AuthContext';
import {
  getStudentCourse,
  completeModule,
  submitQuiz,
  generateCertificate,
} from '../../services/api';
import {
  LoadingPage,
  Alert,
  Badge,
  Spinner,
  EmptyState,
} from '../../components/ui';
import { parseEmbedUrl } from '../../components/ContentEditor';
import CourseHeader from '../../components/lms/CourseHeader';
import CourseSidebar from '../../components/lms/CourseSidebar';

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const CONTENT_TYPES = Object.freeze({
  TEXT: 'TEXT',
  VIDEO: 'VIDEO',
  EMBED: 'EMBED',
});

const VIEW_MODES = Object.freeze({
  SLIDES: 'slides',
  QUIZ: 'quiz',
});

const MODULE_STATES = Object.freeze({
  COMPLETED: 'COMPLETED',
  LOCKED: 'LOCKED',
  AVAILABLE: 'AVAILABLE',
});

const MESSAGES = Object.freeze({
  LOAD_FAILED: 'Failed to load course details. Please try again.',
  NOT_ENROLLED: 'You are not enrolled in this course.',
  QUIZ_SUBMIT_FAILED: 'Failed to submit quiz.',
  MODULE_COMPLETE_FAILED: 'Failed to complete module.',
  CERTIFICATE_FAILED: 'Failed to generate certificate.',
  QUIZ_INCOMPLETE: (total) => `Please answer all ${total} questions before submitting.`,
  QUIZ_PREREQ: 'You must pass the module quiz before marking this module as complete.',
});

// ============================================================================
// SUB-COMPONENT: Content Slide Renderer
// ============================================================================

const ContentSlideView = React.memo(function ContentSlideView({ contentItem }) {
  if (!contentItem) return null;

  const type = contentItem.content_type;
  const rawContent = contentItem.content || '';

  if (type === CONTENT_TYPES.TEXT) {
    const paragraphs = rawContent.split('\n\n').filter(Boolean);
    return (
      <div style={STYLES.textContent}>
        {paragraphs.map((paragraph, idx) => (
          <p key={idx} style={STYLES.textParagraph}>
            {paragraph}
          </p>
        ))}
      </div>
    );
  }

  const parsed = parseEmbedUrl(rawContent);

  if (parsed.type === 'youtube' || parsed.type === 'vimeo') {
    return (
      <div style={STYLES.videoEmbedWrapper}>
        <iframe
          title="Module Video Content"
          src={parsed.embedUrl}
          style={STYLES.iframe}
          allowFullScreen
        />
      </div>
    );
  }

  if (parsed.type === 'direct_video') {
    return (
      <video
        controls
        src={parsed.embedUrl}
        style={STYLES.directVideoPlayer}
      >
        Your browser does not support this video player.
      </video>
    );
  }

  return (
    <div style={STYLES.externalResourceCard}>
      <div style={STYLES.externalResourceIcon} aria-hidden="true">🔗</div>
      <h4 style={STYLES.externalResourceTitle}>External Resource</h4>
      <p style={STYLES.externalResourceSubtitle}>
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
});

// ============================================================================
// SUB-COMPONENT: Student Quiz Player
// ============================================================================

const StudentQuizPlayer = React.memo(function StudentQuizPlayer({
  quiz,
  onQuizPassed,
}) {
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // { [questionId]: optionLabel }
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(quiz?.last_attempt ?? null);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(Boolean(quiz?.last_attempt));

  const questions = useMemo(() => quiz?.questions ?? [], [quiz?.questions]);
  const currentQuestion = questions[currentQIndex];

  // Sync state if quiz prop changes
  useEffect(() => {
    if (quiz?.last_attempt) {
      setResult(quiz.last_attempt);
      setSubmitted(true);
    }
  }, [quiz?.last_attempt]);

  const handleSelectOption = useCallback((questionId, optionLabel) => {
    if (submitted && result?.passed) return;
    setAnswers((prev) => ({ ...prev, [String(questionId)]: optionLabel }));
  }, [submitted, result?.passed]);

  const handleSubmitQuiz = useCallback(async (e) => {
    e.preventDefault();
    setError('');

    const unanswered = questions.filter((q) => !answers[String(q.id)]);
    if (unanswered.length > 0) {
      setError(MESSAGES.QUIZ_INCOMPLETE(questions.length));
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitQuiz(quiz.id, answers);
      const attemptResult = res?.result;
      if (attemptResult) {
        setResult(attemptResult);
        setSubmitted(true);
        if (attemptResult.passed && onQuizPassed) {
          onQuizPassed(attemptResult);
        }
      }
    } catch (err) {
      setError(err.message || MESSAGES.QUIZ_SUBMIT_FAILED);
    } finally {
      setSubmitting(false);
    }
  }, [questions, answers, quiz?.id, onQuizPassed]);

  const handleRetryQuiz = useCallback(() => {
    setAnswers({});
    setSubmitted(false);
    setResult(null);
    setCurrentQIndex(0);
    setError('');
  }, []);

  if (questions.length === 0) {
    return (
      <div className="alert alert-info" style={STYLES.emptyQuizBox}>
        This quiz has no questions available.
      </div>
    );
  }

  // QUIZ RESULT SCREEN
  if (submitted && result) {
    return (
      <div style={{ ...STYLES.card, marginTop: 'var(--space-6)' }}>
        <div
          style={{
            ...STYLES.resultBanner,
            background: result.passed ? 'var(--success-light)' : 'var(--danger-light)',
            borderColor: result.passed ? '#a7f3d0' : '#fecaca',
          }}
        >
          <div style={STYLES.resultEmoji} aria-hidden="true">
            {result.passed ? '🎉' : '❌'}
          </div>
          <h3
            style={{
              ...STYLES.resultHeading,
              color: result.passed ? 'var(--success-text)' : 'var(--danger-text)',
            }}
          >
            {result.passed ? 'Quiz Passed!' : 'Quiz Failed'}
          </h3>

          <p
            style={{
              ...STYLES.resultScoreText,
              color: result.passed ? 'var(--success-text)' : 'var(--danger-text)',
            }}
          >
            Your Score: <strong>{result.score}%</strong> ({result.correct_answers} of {result.total_questions} correct).
            Passing requirement: <strong>{result.passing_score}%</strong>.
          </p>

          {!result.passed && (
            <div style={STYLES.retryContainer}>
              <p className="text-sm mb-3" style={STYLES.retrySubText}>
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
            <p className="text-sm font-semibold" style={STYLES.passedNotice}>
              ✓ Quiz passed! You can now mark this module as complete below.
            </p>
          )}
        </div>
      </div>
    );
  }

  // QUESTION PLAYBACK SCREEN
  return (
    <div style={{ ...STYLES.card, marginTop: 'var(--space-6)' }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 style={STYLES.quizTitle}>
            📝 {quiz.title}
          </h3>
          <span className="text-xs text-gray">Passing Score: {quiz.passing_score}%</span>
        </div>
        <Badge variant="info">
          Question {currentQIndex + 1} of {questions.length}
        </Badge>
      </div>

      {error && (
        <Alert type="error" onClose={() => setError('')} aria-live="assertive">
          {error}
        </Alert>
      )}

      <div style={STYLES.quizQuestionBox} role="group" aria-labelledby="current-quiz-question">
        <p id="current-quiz-question" style={STYLES.questionText}>
          {currentQIndex + 1}. {currentQuestion.question_text}
        </p>

        <div style={STYLES.optionsList} role="radiogroup" aria-label="Quiz Options">
          {currentQuestion.options?.map((opt) => {
            const isSelected = answers[String(currentQuestion.id)] === opt.option_label;
            return (
              <label
                key={opt.id}
                style={{
                  ...STYLES.quizOptionLabel,
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
                  style={STYLES.radioInput}
                  aria-label={`Option ${opt.option_label}: ${opt.option_text}`}
                />
                <span style={STYLES.optionLabelBadge} aria-hidden="true">
                  {opt.option_label}
                </span>
                <span style={STYLES.optionText}>
                  {opt.option_text}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* QUIZ NAVIGATION & SUBMISSION */}
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
            aria-busy={submitting}
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Spinner /> Submitting Quiz…
              </span>
            ) : (
              'Submit Quiz'
            )}
          </button>
        )}
      </div>
    </div>
  );
});

// ============================================================================
// UTILITIES: Compute Module State Map
// ============================================================================

const computeModuleStates = (modules) => {
  const sorted = [...modules].sort((a, b) => (a.module_order ?? 0) - (b.module_order ?? 0));
  const stateMap = {};
  let encounteredIncomplete = false;

  for (const m of sorted) {
    if (m.completed) {
      stateMap[m.id] = MODULE_STATES.COMPLETED;
    } else if (encounteredIncomplete) {
      stateMap[m.id] = MODULE_STATES.LOCKED;
    } else {
      stateMap[m.id] = MODULE_STATES.AVAILABLE;
      encounteredIncomplete = true;
    }
  }

  return stateMap;
};

// ============================================================================
// MAIN PAGE VIEW COMPONENT: Course Learning Experience
// ============================================================================

export default function CourseLearning() {
  const { courseId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  // Active Navigation States
  const [activeModuleIdx, setActiveModuleIdx] = useState(0);
  const [slideIndex, setSlideIndex] = useState(0);
  const [viewingMode, setViewingMode] = useState(VIEW_MODES.SLIDES);

  // Mutation Feedback States
  const [completingMod, setCompletingMod] = useState(false);
  const [moduleError, setModuleError] = useState('');
  const [moduleSuccess, setModuleSuccess] = useState('');

  const [generatingCert, setGeneratingCert] = useState(false);
  const [certError, setCertError] = useState('');

  // Race condition guard reference
  const loadRequestId = useRef(0);

  const loadCourseData = useCallback(async () => {
    if (!user?.id || !courseId) return;

    const currentReqId = ++loadRequestId.current;
    setLoading(true);
    setPageError('');

    try {
      const res = await getStudentCourse(user.id, Number(courseId));
      if (currentReqId === loadRequestId.current) {
        const fetchedCourse = res?.course;
        setCourse(fetchedCourse);

        // Auto-select first uncompleted module
        const firstIncomplete = fetchedCourse?.modules?.findIndex((m) => !m.completed);
        if (firstIncomplete >= 0) {
          setActiveModuleIdx(firstIncomplete);
        }
      }
    } catch (err) {
      if (currentReqId === loadRequestId.current) {
        if (err.message?.includes('403') || err.status === 403) {
          setPageError(MESSAGES.NOT_ENROLLED);
        } else {
          setPageError(err.message || MESSAGES.LOAD_FAILED);
        }
      }
    } finally {
      if (currentReqId === loadRequestId.current) {
        setLoading(false);
      }
    }
  }, [user?.id, courseId]);

  useEffect(() => {
    loadCourseData();
  }, [loadCourseData]);

  // Reset slide index & errors when active module changes
  useEffect(() => {
    setSlideIndex(0);
    setViewingMode(VIEW_MODES.SLIDES);
    setModuleError('');
    setModuleSuccess('');
  }, [activeModuleIdx]);

  // Action: Complete Module
  const handleCompleteModule = useCallback(async (moduleId) => {
    setCompletingMod(true);
    setModuleError('');
    setModuleSuccess('');

    try {
      await completeModule(moduleId);
      setModuleSuccess('Module completed successfully!');
      await loadCourseData();
    } catch (err) {
      if (err.message?.toLowerCase().includes('quiz') || err.message?.includes('pass')) {
        setModuleError(MESSAGES.QUIZ_PREREQ);
      } else {
        setModuleError(err.message || MESSAGES.MODULE_COMPLETE_FAILED);
      }
    } finally {
      setCompletingMod(false);
    }
  }, [loadCourseData]);

  // Action: Generate Certificate
  const handleGenerateCertificate = useCallback(async () => {
    setGeneratingCert(true);
    setCertError('');

    try {
      await generateCertificate(Number(courseId));
      navigate('/student/certificates');
    } catch (err) {
      setCertError(err.message || MESSAGES.CERTIFICATE_FAILED);
    } finally {
      setGeneratingCert(false);
    }
  }, [courseId, navigate]);

  // Memoized Course Telemetry
  const telemetry = useMemo(() => {
    const modules = course?.modules ?? [];
    const completedCount = modules.filter((m) => m.completed).length;
    const progressPct = modules.length > 0 ? Math.round((completedCount / modules.length) * 100) : 0;
    const isCourseComplete = modules.length > 0 && completedCount === modules.length;
    const moduleStateMap = computeModuleStates(modules);

    const lessonCount = modules.reduce((acc, m) => acc + (m.contents?.length ?? 0), 0);
    const quizCount = modules.reduce((acc, m) => acc + (m.quizzes?.length ?? 0), 0);

    return {
      modules,
      completedCount,
      progressPct,
      isCourseComplete,
      moduleStateMap,
      lessonCount,
      quizCount,
    };
  }, [course?.modules]);

  // Safe navigation bounds
  const safeActiveModuleIdx = useMemo(() => {
    const modules = telemetry.modules;
    if (modules.length === 0) return 0;
    return Math.max(0, Math.min(activeModuleIdx, modules.length - 1));
  }, [telemetry.modules, activeModuleIdx]);

  const activeModule = telemetry.modules[safeActiveModuleIdx];
  const slides = useMemo(() => activeModule?.contents ?? [], [activeModule?.contents]);

  const safeSlideIdx = useMemo(() => {
    if (slides.length === 0) return 0;
    return Math.max(0, Math.min(slideIndex, slides.length - 1));
  }, [slides.length, slideIndex]);

  const activeSlide = slides[safeSlideIdx];
  const hasQuiz = Boolean(activeModule?.quizzes && activeModule.quizzes.length > 0);
  const quiz = hasQuiz ? activeModule.quizzes[0] : null;

  if (loading) {
    return (
      <StudentLayout>
        <div className="page-container">
          <LoadingPage message="Loading learning material…" />
        </div>
      </StudentLayout>
    );
  }

  if (pageError || !course) {
    return (
      <StudentLayout>
        <div className="page-container">
          <nav className="mb-4" aria-label="Breadcrumb">
            <Link to="/student/courses" className="text-gray text-sm">
              ← Back to My Courses
            </Link>
          </nav>
          <Alert type="error" aria-live="assertive">
            {pageError || 'Course not found'}
          </Alert>
        </div>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout>
      <div className="page-container">
        {/* Course Hero Banner Component */}
        <CourseHeader
          title={course.title}
          description={course.description}
          instructor="ED-MAX Training Platform"
          progressPct={telemetry.progressPct}
          completedCount={telemetry.completedCount}
          moduleCount={telemetry.modules.length}
          lessonCount={telemetry.lessonCount}
          quizCount={telemetry.quizCount}
          isCompleted={telemetry.isCourseComplete}
          action={
            telemetry.isCourseComplete && (
              <button
                type="button"
                className="btn btn-success btn-lg"
                onClick={handleGenerateCertificate}
                disabled={generatingCert}
                id="generate-cert-banner-btn"
                aria-busy={generatingCert}
              >
                {generatingCert ? (
                  <span className="flex items-center gap-2">
                    <Spinner /> Generating…
                  </span>
                ) : (
                  '🎓 View Certificate'
                )}
              </button>
            )
          }
        />

        {certError && (
          <Alert type="error" onClose={() => setCertError('')} aria-live="assertive">
            {certError}
          </Alert>
        )}

        {/* LMS Workspace Layout */}
        {telemetry.modules.length === 0 ? (
          <EmptyState
            icon="📦"
            title="No modules available"
            text="This course has no modules created yet."
          />
        ) : (
          <div className="lms-player-layout">
            {/* Sidebar Navigation */}
            <CourseSidebar
              modules={telemetry.modules}
              moduleStateMap={telemetry.moduleStateMap}
              activeModuleIdx={safeActiveModuleIdx}
              activeSlideIdx={safeSlideIdx}
              viewingMode={viewingMode}
              onSelectModule={(mIdx) => setActiveModuleIdx(mIdx)}
              onSelectSlide={(sIdx) => {
                setSlideIndex(sIdx);
                setViewingMode(VIEW_MODES.SLIDES);
              }}
              onSelectQuiz={() => setViewingMode(VIEW_MODES.QUIZ)}
            />

            {/* Main Learning Area */}
            <main className="content-area" aria-label="Course Content Workspace">
              {activeModule && (
                <>
                  {/* Module Breadcrumb & Mode Toggle Bar */}
                  <div style={STYLES.contentHeaderBar}>
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <div style={STYLES.moduleBreadcrumbSub}>
                          Module {activeModule.module_order ?? (safeActiveModuleIdx + 1)} of {telemetry.modules.length} • {activeModule.contents?.length ?? 0} lessons
                        </div>
                        <h2 style={STYLES.activeModuleTitle}>
                          {viewingMode === VIEW_MODES.QUIZ
                            ? `📝 ${quiz?.title || 'Module Quiz'}`
                            : activeSlide?.title || activeModule.title || 'Lesson Content'}
                        </h2>
                        {activeModule.description && viewingMode === VIEW_MODES.SLIDES && (
                          <p className="text-xs text-gray mt-1">{activeModule.description}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {hasQuiz && (
                          <button
                            type="button"
                            className={`btn btn-sm${viewingMode === VIEW_MODES.QUIZ ? ' btn-primary' : ' btn-outline'}`}
                            onClick={() =>
                              setViewingMode((prev) =>
                                prev === VIEW_MODES.QUIZ ? VIEW_MODES.SLIDES : VIEW_MODES.QUIZ
                              )
                            }
                            id="toggle-quiz-view-btn"
                          >
                            {viewingMode === VIEW_MODES.QUIZ ? '📄 Back to Lessons' : '📝 Take Quiz'}
                          </button>
                        )}

                        <Badge variant={activeModule.completed ? 'success' : 'gray'}>
                          {activeModule.completed ? '✓ Completed' : 'In Progress'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Main Display Body */}
                  <div className="content-body">
                    {moduleError && (
                      <Alert type="error" onClose={() => setModuleError('')} aria-live="assertive">
                        {moduleError}
                      </Alert>
                    )}
                    {moduleSuccess && (
                      <Alert type="success" onClose={() => setModuleSuccess('')} aria-live="polite">
                        {moduleSuccess}
                      </Alert>
                    )}

                    {/* VIEW MODE: SLIDES PRESENTATION */}
                    {viewingMode === VIEW_MODES.SLIDES && (
                      <section aria-label="Lesson Slides Presentation">
                        {slides.length === 0 ? (
                          <EmptyState
                            icon="📄"
                            title="No Content Slides"
                            text="This module has no training slides."
                            action={
                              hasQuiz && (
                                <button
                                  type="button"
                                  className="btn btn-primary"
                                  onClick={() => setViewingMode(VIEW_MODES.QUIZ)}
                                >
                                  Go to Quiz
                                </button>
                              )
                            }
                          />
                        ) : (
                          <div>
                            <div style={STYLES.slideCard}>
                              <div style={STYLES.slideCardHeader}>
                                <span className="text-xs font-semibold text-gray">
                                  Lesson {safeSlideIdx + 1} of {slides.length}
                                </span>
                                <Badge variant={activeSlide?.content_type === CONTENT_TYPES.VIDEO ? 'primary' : 'gray'}>
                                  {activeSlide?.content_type === CONTENT_TYPES.VIDEO ? '🎥 Video Lesson' : '📄 Text Lesson'}
                                </Badge>
                              </div>

                              <ContentSlideView contentItem={activeSlide} />
                            </div>

                            {/* Slide Navigation Controls */}
                            <div className="flex items-center justify-between mt-6">
                              <button
                                type="button"
                                className="btn btn-outline"
                                onClick={() => setSlideIndex((i) => Math.max(0, i - 1))}
                                disabled={safeSlideIdx === 0}
                                id="prev-slide-btn"
                              >
                                ← Previous Lesson
                              </button>

                              <span className="text-xs text-gray font-semibold">
                                {safeSlideIdx + 1} / {slides.length}
                              </span>

                              {safeSlideIdx < slides.length - 1 ? (
                                <button
                                  type="button"
                                  className="btn btn-primary"
                                  onClick={() => setSlideIndex((i) => Math.min(slides.length - 1, i + 1))}
                                  id="next-slide-btn"
                                >
                                  Next Lesson →
                                </button>
                              ) : hasQuiz ? (
                                <button
                                  type="button"
                                  className="btn btn-primary btn-lg"
                                  onClick={() => setViewingMode(VIEW_MODES.QUIZ)}
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
                                    aria-busy={completingMod}
                                  >
                                    {completingMod ? (
                                      <span className="flex items-center gap-2">
                                        <Spinner /> Completing…
                                      </span>
                                    ) : (
                                      '✅ Complete Module'
                                    )}
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                        )}
                      </section>
                    )}

                    {/* VIEW MODE: QUIZ PLAYER */}
                    {viewingMode === VIEW_MODES.QUIZ && quiz && (
                      <section aria-label="Module Assessment Quiz">
                        <StudentQuizPlayer
                          quiz={quiz}
                          onQuizPassed={loadCourseData}
                        />
                      </section>
                    )}

                    {viewingMode === VIEW_MODES.QUIZ && !quiz && (
                      <EmptyState
                        icon="📝"
                        title="No Quiz Configured"
                        text="This module does not have a quiz configured yet."
                        action={
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => setViewingMode(VIEW_MODES.SLIDES)}
                          >
                            Back to Lessons
                          </button>
                        }
                      />
                    )}

                    {/* FINAL MODULE COMPLETION BAR (When ready) */}
                    {!activeModule.completed && (hasQuiz ? quiz?.last_attempt?.passed : true) && (
                      <div style={STYLES.finalCompletionBar}>
                        <button
                          type="button"
                          className="btn btn-success btn-lg"
                          onClick={() => handleCompleteModule(activeModule.id)}
                          disabled={completingMod}
                          id="mark-module-complete-final-btn"
                          aria-busy={completingMod}
                        >
                          {completingMod ? (
                            <span className="flex items-center gap-2">
                              <Spinner /> Completing…
                            </span>
                          ) : (
                            '✅ Mark Module as Complete'
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </main>
          </div>
        )}
      </div>
    </StudentLayout>
  );
}

// ============================================================================
// STYLES (Performance tokens frozen in memory)
// ============================================================================

const STYLES = Object.freeze({
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
    minHeight: '280px',
  },
  slideCardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 'var(--space-4)',
    paddingBottom: 'var(--space-2)',
    borderBottom: '1px solid var(--gray-200)',
  },
  textContent: {
    fontSize: 'var(--font-size-base)',
    lineHeight: 1.8,
    color: 'var(--gray-800)',
  },
  textParagraph: {
    marginBottom: 'var(--space-4)',
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
  directVideoPlayer: {
    width: '100%',
    maxHeight: '420px',
    borderRadius: 'var(--radius-lg)',
  },
  externalResourceCard: {
    background: 'var(--info-light)',
    border: '1px solid #bae6fd',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-6)',
    textAlign: 'center',
  },
  externalResourceIcon: {
    fontSize: '2.5rem',
    marginBottom: 'var(--space-2)',
  },
  externalResourceTitle: {
    fontSize: 'var(--font-size-base)',
    fontWeight: 700,
    color: '#075985',
    marginBottom: 'var(--space-2)',
  },
  externalResourceSubtitle: {
    fontSize: 'var(--font-size-sm)',
    color: '#0369a1',
    marginBottom: 'var(--space-4)',
  },
  emptyQuizBox: {
    marginTop: 'var(--space-4)',
  },
  resultBanner: {
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-6)',
    textAlign: 'center',
    borderWidth: '1px',
    borderStyle: 'solid',
  },
  resultEmoji: {
    fontSize: '3.5rem',
  },
  resultHeading: {
    fontSize: 'var(--font-size-2xl)',
    fontWeight: 700,
    margin: 'var(--space-2) 0',
  },
  resultScoreText: {
    fontSize: 'var(--font-size-base)',
  },
  retryContainer: {
    marginTop: 'var(--space-4)',
  },
  retrySubText: {
    color: 'var(--danger-text)',
  },
  passedNotice: {
    marginTop: 'var(--space-4)',
    color: 'var(--success-text)',
  },
  quizTitle: {
    fontSize: 'var(--font-size-lg)',
    fontWeight: 700,
    color: 'var(--gray-900)',
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
  optionsList: {
    marginTop: 'var(--space-4)',
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
  radioInput: {
    accentColor: 'var(--primary)',
    width: '18px',
    height: '18px',
  },
  optionLabelBadge: {
    fontWeight: 700,
    color: 'var(--primary)',
    width: '24px',
  },
  optionText: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--gray-800)',
  },
  contentHeaderBar: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '14px',
    padding: '1.25rem',
    marginBottom: '1.25rem',
  },
  moduleBreadcrumbSub: {
    fontSize: '0.75rem',
    color: '#64748b',
    marginBottom: '0.25rem',
  },
  activeModuleTitle: {
    fontSize: '1.25rem',
    fontWeight: 800,
    color: '#0f172a',
    margin: 0,
  },
  finalCompletionBar: {
    marginTop: 'var(--space-6)',
    paddingTop: 'var(--space-4)',
    borderTop: '1px solid var(--gray-200)',
    textAlign: 'right',
  },
});