import React from 'react';
import ModuleAccordion from './ModuleAccordion';
import LearningItem from './LearningItem';

/**
 * Reusable CourseSidebar Navigation Component
 */
export default function CourseSidebar({
  modules = [],
  moduleStateMap = {},
  activeModuleIdx,
  activeSlideIdx,
  viewingMode, // 'slides' | 'quiz'
  onSelectModule,
  onSelectSlide,
  onSelectQuiz,
}) {
  const completedCount = modules.filter((m) => m.completed).length;

  return (
    <div className="lms-course-sidebar">
      <div className="lms-sidebar-top">
        <h3 className="lms-sidebar-header-title">Course Outline</h3>
        <div className="lms-sidebar-progress-sub">
          {completedCount} of {modules.length} modules complete
        </div>
      </div>

      <div className="lms-sidebar-module-list">
        {modules.map((module, mIdx) => {
          const mState = moduleStateMap[module.id] ?? 'AVAILABLE';
          const isLocked = mState === 'LOCKED';
          const isCompleted = mState === 'COMPLETED';
          const isActiveModule = mIdx === activeModuleIdx;

          const contents = module.contents ?? [];
          const quizzes = module.quizzes ?? [];
          const quiz = quizzes.length > 0 ? quizzes[0] : null;

          return (
            <ModuleAccordion
              key={module.id}
              module={module}
              moduleNumber={mIdx + 1}
              defaultExpanded={isActiveModule}
              isLocked={isLocked}
              isCompleted={isCompleted}
            >
              <div className="lms-sidebar-item-group">
                {/* Content Lessons */}
                {contents.map((item, sIdx) => {
                  const isItemActive = isActiveModule && viewingMode === 'slides' && sIdx === activeSlideIdx;
                  return (
                    <LearningItem
                      key={item.id}
                      title={item.title || `Lesson ${sIdx + 1}`}
                      type={item.content_type || 'TEXT'}
                      duration={item.content_type === 'VIDEO' ? '15 min' : '10 min'}
                      status={isCompleted ? 'COMPLETED' : 'DEFAULT'}
                      isActive={isItemActive}
                      isLocked={isLocked}
                      onClick={() => {
                        onSelectModule(mIdx);
                        onSelectSlide(sIdx);
                      }}
                    />
                  );
                })}

                {/* Module Quiz */}
                {quiz && (
                  <LearningItem
                    key={`quiz-${quiz.id}`}
                    title={quiz.title || `Module ${mIdx + 1} Quiz`}
                    type="QUIZ"
                    duration={`${quiz.questions?.length ?? 5} questions`}
                    status={quiz.last_attempt?.passed ? 'COMPLETED' : 'DEFAULT'}
                    isActive={isActiveModule && viewingMode === 'quiz'}
                    isLocked={isLocked}
                    onClick={() => {
                      onSelectModule(mIdx);
                      onSelectQuiz(quiz);
                    }}
                  />
                )}
              </div>
            </ModuleAccordion>
          );
        })}
      </div>
    </div>
  );
}
