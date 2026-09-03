import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import {
  getCourse,
  updateCourse,
  updateModule,
  deleteModule,
} from '../../services/api';
import {
  LoadingPage,
  Alert,
  Badge,
  EmptyState,
  Modal,
  ConfirmModal,
  Spinner,
} from '../../components/ui';
import ModuleWizardModal from '../../components/lms/ModuleWizardModal';

// ============================================================================
// CONSTANTS
// ============================================================================

const TABS = Object.freeze({
  OUTLINE: 'outline',
  STUDENTS: 'students',
});

const MESSAGES = Object.freeze({
  LOAD_FAILED: 'Failed to load course details.',
  COURSE_UPDATED: 'Course details updated successfully.',
  MODULE_DELETED: 'Module deleted successfully.',
  MODULE_REORDER_FAILED: 'Failed to update module order.',
  TITLE_REQUIRED: 'Course title is required.',
});

// ============================================================================
// SUB-COMPONENT: Module Card Item
// ============================================================================

const ModuleCard = function ModuleCard({
  module,
  isFirst,
  isLast,
  courseId,
  onMoveUp,
  onMoveDown,
  onRefresh,
  onError,
}) {
  const navigate = useNavigate();
  const [togglingPublish, setTogglingPublish] = useState(false);
  const [confirmDeleteMod, setConfirmDeleteMod] = useState(false);
  const [deletingMod, setDeletingMod] = useState(false);

  const handleDeleteModule = async () => {
    setDeletingMod(true);
    try {
      await deleteModule(module.id);
      setConfirmDeleteMod(false);
      onRefresh();
    } catch (err) {
      onError(err.message || 'Failed to delete module.');
      setConfirmDeleteMod(false);
    } finally {
      setDeletingMod(false);
    }
  };

  const handleTogglePublish = useCallback(async () => {
    setTogglingPublish(true);
    try {
      await updateModule(module.id, { isPublished: !module.is_published });
      onRefresh();
    } catch (err) {
      onError(err.message || 'Failed to update publish status.');
    } finally {
      setTogglingPublish(false);
    }
  }, [module.id, module.is_published, onRefresh, onError]);

  const contents = module.contents ?? [];
  const textLessonsCount = contents.filter((c) => c.content_type === 'TEXT').length;
  const videoCount = contents.filter((c) => c.content_type === 'VIDEO').length;
  const resourceCount = contents.filter((c) => c.content_type === 'EMBED').length;

  const primaryQuiz = module.quizzes?.[0] ?? null;
  const questionCount = primaryQuiz?.questions?.length ?? 0;

  return (
    <div
      className="card mb-4"
      style={{
        border: '1px solid var(--gray-200)',
        borderRadius: '12px',
        background: '#ffffff',
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
      }}
      id={`module-card-${module.id}`}
    >
      <div className="card-body p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap md:flex-nowrap">
          {/* Left: Reorder & Module Number */}
          <div className="flex items-center gap-3">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 46,
                height: 48,
                background: '#f1f5f9',
                borderRadius: '8px',
                fontWeight: 800,
                color: '#4f46e5',
                fontSize: '1rem',
                flexShrink: 0,
              }}
            >
              #{String(module.module_order).padStart(2, '0')}
            </div>

            <div className="flex flex-col gap-1 flex-shrink-0">
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={onMoveUp}
                disabled={isFirst}
                title="Move Module Up"
                style={{ padding: '0 4px', lineHeight: 1, minHeight: 'auto' }}
              >
                ▲
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={onMoveDown}
                disabled={isLast}
                title="Move Module Down"
                style={{ padding: '0 4px', lineHeight: 1, minHeight: 'auto' }}
              >
                ▼
              </button>
            </div>
          </div>

          {/* Middle: Title, Description, and Breakdown */}
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--gray-900)' }}>
                {module.title}
              </h3>
              <Badge variant={module.is_published ? 'success' : 'gray'}>
                {module.is_published ? '✓ Published' : 'Draft'}
              </Badge>
              <button
                type="button"
                className="btn btn-ghost btn-xs text-xs"
                onClick={handleTogglePublish}
                disabled={togglingPublish}
                style={{ color: module.is_published ? 'var(--gray-600)' : 'var(--success)' }}
              >
                {togglingPublish ? <Spinner /> : module.is_published ? 'Unpublish' : '🚀 Publish'}
              </button>
            </div>

            {module.description ? (
              <p className="text-xs text-gray mb-3" style={{ maxWidth: 640, margin: '4px 0 12px 0' }}>
                {module.description}
              </p>
            ) : (
              <p className="text-xs text-gray mb-3 italic" style={{ margin: '4px 0 12px 0' }}>
                No description provided
              </p>
            )}

            {/* Structure Summary Pills */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="badge badge-gray" style={{ fontWeight: 600 }}>
                📄 {textLessonsCount} Lesson{textLessonsCount !== 1 ? 's' : ''}
              </span>
              {videoCount > 0 && (
                <span className="badge badge-primary" style={{ fontWeight: 600 }}>
                  🎥 {videoCount} Video{videoCount !== 1 ? 's' : ''}
                </span>
              )}
              {resourceCount > 0 && (
                <span className="badge badge-gray" style={{ fontWeight: 600 }}>
                  📁 {resourceCount} Resource{resourceCount !== 1 ? 's' : ''}
                </span>
              )}
              {primaryQuiz ? (
                <span className="badge badge-success" style={{ fontWeight: 600 }}>
                  📝 Quiz ({questionCount} Qs, Pass: {primaryQuiz.passing_score}%)
                </span>
              ) : (
                <span className="badge badge-gray" style={{ fontStyle: 'italic' }}>
                  📝 No Quiz
                </span>
              )}
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2 flex-wrap justify-end flex-shrink-0">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => navigate(`/admin/courses/${courseId}/modules/${module.id}`)}
              id={`edit-module-btn-${module.id}`}
            >
              ✏️ Edit Module
            </button>

            <button
              type="button"
              className="btn btn-outline btn-sm text-danger"
              onClick={() => setConfirmDeleteMod(true)}
              id={`delete-module-btn-${module.id}`}
            >
              🗑
            </button>
          </div>
        </div>
      </div>

      {confirmDeleteMod && (
        <ConfirmModal
          title="Delete Module"
          message={`Are you sure you want to delete "${module.title}"? Note: Dependent content and quizzes will be removed.`}
          onConfirm={handleDeleteModule}
          onCancel={() => setConfirmDeleteMod(false)}
          danger
          loading={deletingMod}
        />
      )}
    </div>
  );
};

// ============================================================================
// SUB-COMPONENT: Edit Course Details Modal
// ============================================================================

const EditCourseModal = function EditCourseModal({
  course,
  isOpen,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState({
    title: course?.title ?? '',
    description: course?.description ?? '',
    isActive: course?.is_active ?? true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (course && isOpen) {
      setForm({
        title: course.title,
        description: course.description ?? '',
        isActive: course.is_active ?? true,
      });
      setError('');
    }
  }, [course, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError(MESSAGES.TITLE_REQUIRED);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await onSave({
        title: form.title.trim(),
        description: form.description.trim(),
        isActive: form.isActive,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update course details.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Edit Course Details"
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="btn btn-outline"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            form="edit-course-form"
            disabled={submitting}
            id="submit-edit-course-btn"
          >
            {submitting ? <Spinner /> : 'Save Changes'}
          </button>
        </>
      }
    >
      {error && <Alert type="error">{error}</Alert>}
      <form id="edit-course-form" onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label className="form-label" htmlFor="edit-c-title">
            Course Title *
          </label>
          <input
            id="edit-c-title"
            type="text"
            className="form-input"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
            disabled={submitting}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="edit-c-desc">
            Description
          </label>
          <textarea
            id="edit-c-desc"
            className="form-textarea"
            rows={4}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            disabled={submitting}
          />
        </div>

        <div className="form-group flex items-center gap-2">
          <input
            id="edit-c-active"
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            disabled={submitting}
          />
          <label className="form-label mb-0 cursor-pointer" htmlFor="edit-c-active">
            Active Course (visible for student assignments)
          </label>
        </div>
      </form>
    </Modal>
  );
};

// ============================================================================
// MAIN PAGE COMPONENT: Central Course Authoring Control Panel
// ============================================================================

export default function AdminCourseDetail() {
  const { courseId } = useParams();
  const navigate = useNavigate();

  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mainTab, setMainTab] = useState(TABS.OUTLINE);

  // Modals Visibility
  const [showEdit, setShowEdit] = useState(false);
  const [showAddModule, setShowAddModule] = useState(false);

  const loadCourse = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getCourse(Number(courseId));
      setCourse(res.course);
    } catch (err) {
      setError(err.message || MESSAGES.LOAD_FAILED);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    loadCourse();
  }, [loadCourse]);

  const sortedModules = useMemo(() => {
    if (!course?.modules) return [];
    return [...course.modules].sort(
      (a, b) => a.module_order - b.module_order || a.id - b.id
    );
  }, [course?.modules]);

  // Aggregate Course Metrics
  const metrics = useMemo(() => {
    const mods = sortedModules;
    const totalMods = mods.length;
    const publishedMods = mods.filter((m) => m.is_published).length;
    let totalLessons = 0;
    mods.forEach((m) => {
      totalLessons += m.contents?.length ?? 0;
    });
    return {
      totalMods,
      publishedMods,
      totalLessons,
      enrolledCount: course?.students?.length ?? 0,
    };
  }, [sortedModules, course?.students]);

  const handleUpdateCourseDetails = useCallback(
    async ({ title, description, isActive }) => {
      await updateCourse(Number(courseId), title, description, isActive);
      setSuccess(MESSAGES.COURSE_UPDATED);
      await loadCourse();
    },
    [courseId, loadCourse]
  );

  const handleMoveModule = useCallback(
    async (moduleItem, direction) => {
      const currIdx = sortedModules.findIndex((m) => m.id === moduleItem.id);
      const targetIdx = direction === 'up' ? currIdx - 1 : currIdx + 1;
      if (targetIdx < 0 || targetIdx >= sortedModules.length) return;

      const targetItem = sortedModules[targetIdx];
      const prevModulesState = [...sortedModules];

      const newCurrOrder = targetItem.module_order;
      const newTargetOrder = moduleItem.module_order;

      setCourse((prev) => {
        if (!prev) return prev;
        const updated = prev.modules.map((m) => {
          if (m.id === moduleItem.id) return { ...m, module_order: newCurrOrder };
          if (m.id === targetItem.id) return { ...m, module_order: newTargetOrder };
          return m;
        });
        return { ...prev, modules: updated };
      });

      try {
        await Promise.all([
          updateModule(moduleItem.id, { moduleOrder: newCurrOrder }),
          updateModule(targetItem.id, { moduleOrder: newTargetOrder }),
        ]);
      } catch (err) {
        setCourse((prev) => (prev ? { ...prev, modules: prevModulesState } : prev));
        setError(err.message || MESSAGES.MODULE_REORDER_FAILED);
      }
    },
    [sortedModules]
  );

  if (loading) {
    return (
      <AdminLayout>
        <div className="page-container">
          <LoadingPage message="Loading course workspace…" />
        </div>
      </AdminLayout>
    );
  }

  if (error && !course) {
    return (
      <AdminLayout>
        <div className="page-container">
          <Alert type="error">{error || 'Course not found'}</Alert>
          <Link to="/admin/courses" className="btn btn-outline mt-4">
            ← Back to Courses
          </Link>
        </div>
      </AdminLayout>
    );
  }

  const enrolledStudents = course.students ?? [];

  return (
    <AdminLayout>
      <div className="page-container" style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Navigation Breadcrumb */}
        <nav className="mb-4" aria-label="Breadcrumb">
          <Link to="/admin/courses" className="text-gray text-sm hover:text-primary">
            ← Back to Courses
          </Link>
        </nav>

        {/* Course Workspace Header Banner */}
        <div
          className="card mb-6"
          style={{
            background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
            color: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 8px 24px rgba(30, 27, 75, 0.25)',
            overflow: 'hidden',
          }}
        >
          <div className="card-body" style={{ padding: '1.75rem 2rem' }}>
            <div className="flex items-start justify-between gap-4 flex-wrap md:flex-nowrap">
              <div>
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffffff', margin: 0, lineHeight: 1.2 }}>
                    {course.title}
                  </h1>
                  <Badge variant={course.is_active ? 'success' : 'gray'}>
                    {course.is_active ? 'Active Course' : 'Inactive'}
                  </Badge>
                </div>
                <p className="text-sm" style={{ color: '#c7d2fe', maxWidth: 680, margin: '6px 0 0 0', lineHeight: 1.5 }}>
                  {course.description || 'No course description provided.'}
                </p>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ background: 'rgba(255,255,255,0.15)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.3)' }}
                  onClick={() => setShowEdit(true)}
                  id="edit-course-details-btn"
                >
                  ✏️ Edit Details
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowAddModule(true)}
                  id="add-module-header-btn"
                >
                  + Add Module
                </button>
              </div>
            </div>

            {/* Clean 4-Column Stat Cards Row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '1rem',
                marginTop: '1.5rem',
                paddingTop: '1.25rem',
                borderTop: '1px solid rgba(255, 255, 255, 0.15)',
              }}
            >
              <div style={{ background: 'rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '0.875rem 1.25rem', border: '1px solid rgba(255, 255, 255, 0.12)' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Total Modules
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff', marginTop: '0.25rem' }}>
                  {metrics.totalMods}
                </div>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '0.875rem 1.25rem', border: '1px solid rgba(255, 255, 255, 0.12)' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Published Status
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff', marginTop: '0.25rem' }}>
                  {metrics.publishedMods} / {metrics.totalMods}
                </div>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '0.875rem 1.25rem', border: '1px solid rgba(255, 255, 255, 0.12)' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Content Lessons
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff', marginTop: '0.25rem' }}>
                  {metrics.totalLessons}
                </div>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '0.875rem 1.25rem', border: '1px solid rgba(255, 255, 255, 0.12)' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Enrolled Learners
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff', marginTop: '0.25rem' }}>
                  {metrics.enrolledCount}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <Alert type="error" onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert type="success" onClose={() => setSuccess('')}>
            {success}
          </Alert>
        )}

        {/* Workspace Tabs */}
        <div className="tabs mb-6" role="tablist" style={{ marginBottom: '1.5rem' }}>
          <button
            type="button"
            role="tab"
            aria-selected={mainTab === TABS.OUTLINE}
            className={`tab-btn${mainTab === TABS.OUTLINE ? ' active' : ''}`}
            onClick={() => setMainTab(TABS.OUTLINE)}
            id="tab-modules-builder"
          >
            📚 Course Outline &amp; Modules ({sortedModules.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mainTab === TABS.STUDENTS}
            className={`tab-btn${mainTab === TABS.STUDENTS ? ' active' : ''}`}
            onClick={() => setMainTab(TABS.STUDENTS)}
            id="tab-enrolled-learners"
          >
            👥 Enrolled Students ({enrolledStudents.length})
          </button>
        </div>

        {/* TAB 1: MODULE OUTLINE */}
        {mainTab === TABS.OUTLINE && (
          <section aria-label="Course Modules Outline">
            <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
              <div>
                <h2 className="text-lg font-bold" style={{ margin: 0, color: 'var(--gray-900)' }}>
                  Course Modules Structure
                </h2>
                <p className="text-xs text-gray" style={{ margin: '2px 0 0 0' }}>
                  Organize and order your modules. Click &quot;Edit Module&quot; to edit content lessons and quizzes.
                </p>
              </div>

              {sortedModules.length > 0 && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowAddModule(true)}
                  id="add-module-outline-btn"
                >
                  + Add Module
                </button>
              )}
            </div>

            {sortedModules.length === 0 ? (
              <EmptyState
                icon="📦"
                title="No Modules in this Course"
                text="Create your first module to structure your course with content lessons and quizzes."
                action={
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setShowAddModule(true)}
                    id="add-first-module-btn"
                  >
                    + Add First Module
                  </button>
                }
              />
            ) : (
              <div className="flex flex-col gap-3">
                {sortedModules.map((module, idx) => (
                  <ModuleCard
                    key={module.id}
                    module={module}
                    isFirst={idx === 0}
                    isLast={idx === sortedModules.length - 1}
                    courseId={courseId}
                    onMoveUp={() => handleMoveModule(module, 'up')}
                    onMoveDown={() => handleMoveModule(module, 'down')}
                    onRefresh={loadCourse}
                    onError={(msg) => setError(msg)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* TAB 2: ENROLLED STUDENTS */}
        {mainTab === TABS.STUDENTS && (
          <section aria-label="Enrolled Students List">
            <div className="card p-6" style={{ background: '#ffffff', borderRadius: '12px' }}>
              <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--gray-900)' }}>
                Enrolled Learners ({enrolledStudents.length})
              </h2>
              <p className="text-xs text-gray mb-4">
                Students currently assigned to study this course.
              </p>

              {enrolledStudents.length === 0 ? (
                <EmptyState
                  icon="👥"
                  title="No Students Enrolled"
                  text="Assign students to this course from the Manage Courses -> Assign tab or Student Manager."
                  action={
                    <Link to="/admin/courses?tab=assign" className="btn btn-outline btn-sm">
                      Assign Students Now
                    </Link>
                  }
                />
              ) : (
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Learner Name</th>
                        <th>Email</th>
                        <th>Status</th>
                        <th>Joined Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {enrolledStudents.map((st) => (
                        <tr key={st.id}>
                          <td className="font-bold text-sm">{st.name}</td>
                          <td className="text-xs text-gray">{st.email}</td>
                          <td>
                            <Badge variant={st.is_active ? 'success' : 'gray'}>
                              {st.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>
                          <td className="text-xs text-gray">
                            {st.created_at ? new Date(st.created_at).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Modals */}
        <EditCourseModal
          course={course}
          isOpen={showEdit}
          onClose={() => setShowEdit(false)}
          onSave={handleUpdateCourseDetails}
        />

        {showAddModule && (
          <ModuleWizardModal
            isOpen={showAddModule}
            courseId={courseId}
            defaultOrder={sortedModules.length + 1}
            onClose={() => setShowAddModule(false)}
            onCreated={() => {
              setSuccess('Module created successfully.');
              loadCourse();
            }}
            onNavigateToEditor={(newMod) => {
              navigate(`/admin/courses/${courseId}/modules/${newMod.id}`);
            }}
          />
        )}
      </div>
    </AdminLayout>
  );
}