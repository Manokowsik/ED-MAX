import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import {
  getCourse,
  updateCourse,
  createModule,
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

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const TABS = Object.freeze({
  MODULES: 'modules',
  STUDENTS: 'students',
});

const MESSAGES = Object.freeze({
  LOAD_FAILED: 'Failed to load course details.',
  COURSE_UPDATED: 'Course details updated successfully.',
  COURSE_UPDATE_FAILED: 'Failed to update course details.',
  MODULE_REORDER_FAILED: 'Failed to update module order. Reverting changes.',
  MODULE_CREATE_FAILED: 'Failed to create module.',
  MODULE_DELETE_FAILED: 'Failed to delete module.',
  TITLE_REQUIRED: 'Course title is required.',
  MODULE_TITLE_REQUIRED: 'Module title is required.',
});

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Pure date formatter with fallback.
 * @param {string | null | undefined} isoDate 
 * @returns {string}
 */
const formatDate = (isoDate) => {
  if (!isoDate) return '—';
  try {
    return new Date(isoDate).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
};

/**
 * Maps student enrollment status to UI Badge variants.
 * @param {string} status 
 * @returns {'success' | 'info' | 'gray'}
 */
const getStatusBadgeVariant = (status) => {
  switch (status) {
    case 'COMPLETED':
      return 'success';
    case 'IN_PROGRESS':
      return 'info';
    default:
      return 'gray';
  }
};

// ============================================================================
// SUB-COMPONENT: Module Card Item
// ============================================================================

const ModuleCard = React.memo(function ModuleCard({
  module,
  courseId,
  onRefresh,
  onError,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
}) {
  const navigate = useNavigate();
  const [confirmDeleteMod, setConfirmDeleteMod] = useState(false);
  const [deletingMod, setDeletingMod] = useState(false);

  const handleDeleteModule = useCallback(async () => {
    setDeletingMod(true);
    try {
      await deleteModule(module.id);
      setConfirmDeleteMod(false);
      onRefresh();
    } catch (err) {
      onError(err.message || MESSAGES.MODULE_DELETE_FAILED);
      setConfirmDeleteMod(false);
    } finally {
      setDeletingMod(false);
    }
  }, [module.id, onRefresh, onError]);

  const contentCount = module.contents?.length ?? 0;
  const primaryQuiz = module.quizzes?.[0] ?? null;
  const questionCount = primaryQuiz?.questions?.length ?? 0;

  return (
    <div className="module-card">
      <div style={STYLES.orderControlColumn}>
        <div className="module-card-number">
          {String(module.module_order).padStart(2, '0')}
        </div>
        <div style={STYLES.orderButtonsRow}>
          <button
            type="button"
            className="content-reorder-btn"
            onClick={onMoveUp}
            disabled={isFirst}
            title="Move Module Up"
            aria-label={`Move ${module.title} up`}
            style={STYLES.reorderButton}
          >
            ▲
          </button>
          <button
            type="button"
            className="content-reorder-btn"
            onClick={onMoveDown}
            disabled={isLast}
            title="Move Module Down"
            aria-label={`Move ${module.title} down`}
            style={STYLES.reorderButton}
          >
            ▼
          </button>
        </div>
      </div>

      <div className="module-card-body">
        <div className="module-card-title-row">
          <span className="module-card-title">{module.title}</span>
          <Badge variant={module.is_published ? 'success' : 'gray'}>
            {module.is_published ? '✓ Published' : 'Draft'}
          </Badge>
        </div>

        {module.description ? (
          <p className="text-xs text-gray mt-1 truncate" style={STYLES.description}>
            {module.description}
          </p>
        ) : (
          <p className="text-xs text-gray mt-1 italic">No description provided</p>
        )}

        <div className="module-card-meta">
          <span className="module-card-meta-item">
            📄 <strong>{contentCount}</strong> {contentCount === 1 ? 'lesson' : 'lessons'}
          </span>

          <span className="module-card-meta-item">
            📝{' '}
            {primaryQuiz ? (
              <span className="text-primary font-semibold">
                Quiz configured ({questionCount}{' '}
                {questionCount === 1 ? 'question' : 'questions'}, Pass:{' '}
                {primaryQuiz.passing_score}%)
              </span>
            ) : (
              <span className="text-gray italic">Quiz not configured</span>
            )}
          </span>

          {module.updated_at && (
            <span className="module-card-meta-item">
              🕒 Updated {formatDate(module.updated_at)}
            </span>
          )}
        </div>
      </div>

      <div className="module-card-actions">
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
          Delete
        </button>
      </div>

      {confirmDeleteMod && (
        <ConfirmModal
          title="Delete Module"
          message={`Are you sure you want to delete "${module.title}"? Note: Dependent content and quizzes must be removed first.`}
          onConfirm={handleDeleteModule}
          onCancel={() => setConfirmDeleteMod(false)}
          danger
          loading={deletingMod}
        />
      )}
    </div>
  );
});

// ============================================================================
// SUB-COMPONENT: Edit Course Modal
// ============================================================================

const EditCourseModal = React.memo(function EditCourseModal({
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
      setError(err.message || MESSAGES.COURSE_UPDATE_FAILED);
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

        <div className="form-group" style={STYLES.checkboxRow}>
          <input
            id="edit-c-active"
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            style={STYLES.checkboxInput}
            disabled={submitting}
          />
          <label
            className="form-label"
            htmlFor="edit-c-active"
            style={STYLES.checkboxLabel}
          >
            Active Course (available for student assignments)
          </label>
        </div>
      </form>
    </Modal>
  );
});

// ============================================================================
// SUB-COMPONENT: Add Module Modal
// ============================================================================

const AddModuleModal = React.memo(function AddModuleModal({
  isOpen,
  defaultOrder,
  onClose,
  onCreate,
}) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    order: defaultOrder,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setForm({ title: '', description: '', order: defaultOrder });
      setError('');
    }
  }, [isOpen, defaultOrder]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError(MESSAGES.MODULE_TITLE_REQUIRED);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await onCreate({
        title: form.title.trim(),
        description: form.description.trim(),
        order: Number(form.order) || 1,
      });
      onClose();
    } catch (err) {
      setError(err.message || MESSAGES.MODULE_CREATE_FAILED);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Add New Module"
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
            form="add-module-form"
            disabled={submitting}
            id="submit-add-module-btn"
          >
            {submitting ? <Spinner /> : 'Create & Edit Module'}
          </button>
        </>
      }
    >
      {error && <Alert type="error">{error}</Alert>}
      <form id="add-module-form" onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label className="form-label" htmlFor="m-title">
            Module Title *
          </label>
          <input
            id="m-title"
            type="text"
            className="form-input"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Introduction to Architecture"
            required
            disabled={submitting}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="m-desc">
            Description
          </label>
          <textarea
            id="m-desc"
            className="form-textarea"
            rows={3}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            disabled={submitting}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="m-order">
            Module Order
          </label>
          <input
            id="m-order"
            type="number"
            className="form-input"
            value={form.order}
            onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))}
            min={1}
            style={STYLES.orderInput}
            required
            disabled={submitting}
          />
        </div>
      </form>
    </Modal>
  );
});

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function AdminCourseDetail() {
  const { courseId } = useParams();
  const navigate = useNavigate();

  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mainTab, setMainTab] = useState(TABS.MODULES);

  // Modals Visibility
  const [showEdit, setShowEdit] = useState(false);
  const [showAddModule, setShowAddModule] = useState(false);

  // Synchronize Course Details
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

  // Memoized Sorted Modules (Prevents inline sorting on every tick)
  const sortedModules = useMemo(() => {
    if (!course?.modules) return [];
    return [...course.modules].sort(
      (a, b) => a.module_order - b.module_order || a.id - b.id
    );
  }, [course?.modules]);

  // Handle Edit Course Update
  const handleUpdateCourseDetails = useCallback(
    async ({ title, description, isActive }) => {
      await updateCourse(Number(courseId), title, description, isActive);
      setSuccess(MESSAGES.COURSE_UPDATED);
      await loadCourse();
    },
    [courseId, loadCourse]
  );

  // Handle Create Module & Navigate
  const handleCreateModule = useCallback(
    async ({ title, description, order }) => {
      const res = await createModule(Number(courseId), title, description, order);
      const newModuleId = res.module.id;
      navigate(`/admin/courses/${courseId}/modules/${newModuleId}`);
    },
    [courseId, navigate]
  );

  // Module Reorder with Optimistic State Swap
  const handleMoveModule = useCallback(
    async (moduleItem, direction) => {
      const currIdx = sortedModules.findIndex((m) => m.id === moduleItem.id);
      const targetIdx = direction === 'up' ? currIdx - 1 : currIdx + 1;
      if (targetIdx < 0 || targetIdx >= sortedModules.length) return;

      const targetItem = sortedModules[targetIdx];
      const prevModulesState = [...sortedModules];

      // Optimistic Swap
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
        // Rollback on failure
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
          <LoadingPage message="Loading course modules…" />
        </div>
      </AdminLayout>
    );
  }

  if (!course) {
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
      <div className="page-container">
        {/* Navigation Breadcrumb */}
        <nav className="mb-4" aria-label="Breadcrumb">
          <Link to="/admin/courses" className="text-gray text-sm">
            ← Back to Courses
          </Link>
        </nav>

        {/* Page Header */}
        <header className="page-header-row mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="page-title">{course.title}</h1>
              <Badge variant={course.is_active ? 'success' : 'gray'}>
                {course.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <p className="page-subtitle">
              {course.description || 'No course description'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setShowEdit(true)}
              id="edit-course-details-btn"
            >
              ✏️ Edit Course Details
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowAddModule(true)}
              id="add-module-header-btn"
            >
              + Add Module
            </button>
          </div>
        </header>

        {/* Dynamic Alerts */}
        {error && (
          <Alert type="error" onClose={() => setError('')} aria-live="assertive">
            {error}
          </Alert>
        )}
        {success && (
          <Alert type="success" onClose={() => setSuccess('')} aria-live="polite">
            {success}
          </Alert>
        )}

        {/* Main Tabs */}
        <div className="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mainTab === TABS.MODULES}
            className={`tab-btn${mainTab === TABS.MODULES ? ' active' : ''}`}
            onClick={() => setMainTab(TABS.MODULES)}
            id="tab-modules-builder"
          >
            📦 Course Modules ({sortedModules.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mainTab === TABS.STUDENTS}
            className={`tab-btn${mainTab === TABS.STUDENTS ? ' active' : ''}`}
            onClick={() => setMainTab(TABS.STUDENTS)}
            id="tab-enrolled-students"
          >
            👥 Enrolled Students ({enrolledStudents.length})
          </button>
        </div>

        {/* Modules Builder View */}
        {mainTab === TABS.MODULES && (
          <section aria-labelledby="tab-modules-builder">
            {sortedModules.length === 0 ? (
              <EmptyState
                icon="📦"
                title="No Modules in this Course"
                text="Create modules to structure your course with content lessons and quizzes."
                action={
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setShowAddModule(true)}
                  >
                    + Add First Module
                  </button>
                }
              />
            ) : (
              <div className="module-card-list">
                {sortedModules.map((moduleItem, idx) => (
                  <ModuleCard
                    key={moduleItem.id}
                    module={moduleItem}
                    courseId={course.id}
                    onRefresh={loadCourse}
                    onError={setError}
                    isFirst={idx === 0}
                    isLast={idx === sortedModules.length - 1}
                    onMoveUp={() => handleMoveModule(moduleItem, 'up')}
                    onMoveDown={() => handleMoveModule(moduleItem, 'down')}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Enrolled Students View */}
        {mainTab === TABS.STUDENTS && (
          <section aria-labelledby="tab-enrolled-students">
            <div className="card">
              <div className="card-header flex justify-between items-center">
                <h2 className="card-title">
                  Enrolled Students ({enrolledStudents.length})
                </h2>
                <Link to="/admin/assignments" className="btn btn-outline btn-sm">
                  Assign Students
                </Link>
              </div>
              {enrolledStudents.length === 0 ? (
                <div className="card-body">
                  <EmptyState
                    icon="👥"
                    title="No Students Enrolled"
                    text="Assign students to this course using the Assignments menu."
                  />
                </div>
              ) : (
                <div className="table-wrapper" style={STYLES.tableWrapper}>
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Student Name</th>
                        <th scope="col">Email</th>
                        <th scope="col">Status</th>
                        <th scope="col">Assigned Date</th>
                        <th scope="col">Completed Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {enrolledStudents.map((s) => (
                        <tr key={s.student_id}>
                          <td>
                            <Link
                              to={`/admin/students/${s.student_id}`}
                              style={STYLES.studentLink}
                            >
                              {s.student_name}
                            </Link>
                          </td>
                          <td className="text-gray">{s.email}</td>
                          <td>
                            <Badge variant={getStatusBadgeVariant(s.status)}>
                              {s.status}
                            </Badge>
                          </td>
                          <td className="text-gray">{formatDate(s.assigned_at)}</td>
                          <td className="text-gray">{formatDate(s.completed_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Edit Modal Component */}
        <EditCourseModal
          course={course}
          isOpen={showEdit}
          onClose={() => setShowEdit(false)}
          onSave={handleUpdateCourseDetails}
        />

        {/* Add Module Modal Component */}
        <AddModuleModal
          isOpen={showAddModule}
          defaultOrder={sortedModules.length + 1}
          onClose={() => setShowAddModule(false)}
          onCreate={handleCreateModule}
        />
      </div>
    </AdminLayout>
  );
}

// ============================================================================
// STYLES (Frozen for performance and memory optimization)
// ============================================================================

const STYLES = Object.freeze({
  orderControlColumn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  orderButtonsRow: {
    display: 'flex',
    gap: '2px',
  },
  reorderButton: {
    fontSize: '0.75rem',
    padding: '2px 4px',
  },
  description: {
    maxWidth: '640px',
  },
  tableWrapper: {
    border: 'none',
  },
  studentLink: {
    color: 'var(--primary)',
    fontWeight: 600,
  },
  checkboxRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginTop: '12px',
  },
  checkboxInput: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
  },
  checkboxLabel: {
    marginBottom: 0,
    cursor: 'pointer',
  },
  orderInput: {
    width: '100px',
  },
});