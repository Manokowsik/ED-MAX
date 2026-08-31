import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import {
  getCourse,
  updateCourse,
  createModule,
  deleteModule,
} from '../../services/api';
import {
  LoadingPage, Alert, Badge, EmptyState,
  Modal, ConfirmModal, Spinner,
} from '../../components/ui';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ============================================================
// Clean, Professional Module Card Component
// ============================================================
function ModuleCard({ module, courseId, onRefresh, onError, isFirst, isLast, onMoveUp, onMoveDown }) {
  const navigate = useNavigate();
  const [confirmDeleteMod, setConfirmDeleteMod] = useState(false);
  const [deletingMod, setDeletingMod] = useState(false);

  async function handleDeleteModule() {
    setDeletingMod(true);
    try {
      await deleteModule(module.id);
      onRefresh();
    } catch (err) {
      onError(err.message || 'Failed to delete module.');
      setConfirmDeleteMod(false);
    } finally {
      setDeletingMod(false);
    }
  }

  const contentCount = module.contents?.length ?? 0;
  const quiz = module.quizzes && module.quizzes.length > 0 ? module.quizzes[0] : null;
  const questionCount = quiz?.questions?.length ?? 0;

  return (
    <div className="module-card">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <div className="module-card-number">
          {String(module.module_order).padStart(2, '0')}
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          <button
            type="button"
            className="content-reorder-btn"
            onClick={onMoveUp}
            disabled={isFirst}
            title="Move Module Up"
            style={{ fontSize: '0.75rem', padding: '2px 4px' }}
          >
            ▲
          </button>
          <button
            type="button"
            className="content-reorder-btn"
            onClick={onMoveDown}
            disabled={isLast}
            title="Move Module Down"
            style={{ fontSize: '0.75rem', padding: '2px 4px' }}
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
          <p className="text-xs text-gray mt-1 truncate" style={{ maxWidth: 640 }}>
            {module.description}
          </p>
        ) : (
          <p className="text-xs text-gray mt-1 italic">No description provided</p>
        )}

        {/* Structured Meta Indicators */}
        <div className="module-card-meta">
          <span className="module-card-meta-item">
            📄 <strong>{contentCount}</strong> {contentCount === 1 ? 'lesson' : 'lessons'}
          </span>

          <span className="module-card-meta-item">
            📝 {quiz ? (
              <span className="text-primary font-semibold">
                Quiz configured ({questionCount} {questionCount === 1 ? 'question' : 'questions'}, Pass: {quiz.passing_score}%)
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
          message={`Are you sure you want to delete "${module.title}"? Note: Backend requires dependent content and quizzes to be removed first.`}
          onConfirm={handleDeleteModule}
          onCancel={() => setConfirmDeleteMod(false)}
          danger
          loading={deletingMod}
        />
      )}
    </div>
  );
}

// ============================================================
// Main Page: Admin Course Overview & Module Manager
// ============================================================
export default function AdminCourseDetail() {
  const { courseId } = useParams();
  const navigate = useNavigate();

  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Main Navigation Tabs
  const [mainTab, setMainTab] = useState('modules'); // 'modules' | 'students'

  // Edit Course Modal
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', description: '', isActive: true });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  // Add Module Modal
  const [showAddModule, setShowAddModule] = useState(false);
  const [modForm, setModForm] = useState({ title: '', description: '', order: 1 });
  const [addingMod, setAddingMod] = useState(false);
  const [modError, setModError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getCourse(Number(courseId));
      setCourse(res.course);
    } catch (err) {
      setError(err.message || 'Failed to load course details');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (course && showEdit) {
      setEditForm({ title: course.title, description: course.description ?? '', isActive: course.is_active ?? true });
    }
  }, [course, showEdit]);

  async function handleEditCourse(e) {
    e.preventDefault();
    if (!editForm.title.trim()) { setEditError('Course title is required.'); return; }

    setSavingEdit(true);
    setEditError('');
    try {
      await updateCourse(Number(courseId), editForm.title.trim(), editForm.description.trim(), editForm.isActive);
      setShowEdit(false);
      setSuccess('Course details updated successfully.');
      await load();
    } catch (err) {
      setEditError(err.message || 'Failed to update course.');
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleMoveModule(moduleItem, direction) {
    const sorted = [...(course?.modules ?? [])].sort((a, b) => a.module_order - b.module_order || a.id - b.id);
    const currIdx = sorted.findIndex((m) => m.id === moduleItem.id);
    const targetIdx = direction === 'up' ? currIdx - 1 : currIdx + 1;
    if (targetIdx < 0 || targetIdx >= sorted.length) return;

    const targetItem = sorted[targetIdx];
    const currOrder = moduleItem.module_order;
    const targetOrder = targetItem.module_order;
    const newCurrOrder = targetOrder !== currOrder ? targetOrder : (direction === 'up' ? Math.max(1, currOrder - 1) : currOrder + 1);
    const newTargetOrder = targetOrder !== currOrder ? currOrder : (direction === 'up' ? currOrder : Math.max(1, currOrder - 1));

    try {
      await updateModule(moduleItem.id, { moduleOrder: newCurrOrder });
      await updateModule(targetItem.id, { moduleOrder: newTargetOrder });
      await load();
    } catch (err) {
      setError(err.message || 'Failed to reorder module.');
    }
  }

  async function handleAddModule(e) {
    e.preventDefault();
    if (!modForm.title.trim()) { setModError('Module title is required.'); return; }

    setAddingMod(true);
    setModError('');
    try {
      const res = await createModule(
        Number(courseId),
        modForm.title.trim(),
        modForm.description.trim(),
        Number(modForm.order)
      );
      setShowAddModule(false);
      const newModuleId = res.module.id;
      // Navigate directly into the new Module Editor!
      navigate(`/admin/courses/${courseId}/modules/${newModuleId}`);
    } catch (err) {
      setModError(err.message || 'Failed to create module.');
    } finally {
      setAddingMod(false);
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="page-container"><LoadingPage message="Loading course modules…" /></div>
      </AdminLayout>
    );
  }

  if (!course) {
    return (
      <AdminLayout>
        <div className="page-container">
          <Alert type="error">{error || 'Course not found'}</Alert>
          <Link to="/admin/courses" className="btn btn-outline mt-4">← Back to Courses</Link>
        </div>
      </AdminLayout>
    );
  }

  const modules = course.modules ?? [];

  return (
    <AdminLayout>
      <div className="page-container">
        {/* Breadcrumb */}
        <div className="mb-4">
          <Link to="/admin/courses" className="text-gray text-sm">← Back to Courses</Link>
        </div>

        {/* Page Header */}
        <div className="page-header-row mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="page-title">{course.title}</h1>
              <Badge variant={course.is_active ? 'success' : 'gray'}>
                {course.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <p className="page-subtitle">{course.description || 'No course description'}</p>
          </div>

          <div className="flex items-center gap-3">
            <button type="button" className="btn btn-outline" onClick={() => setShowEdit(true)} id="edit-course-details-btn">
              ✏️ Edit Course Details
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setShowAddModule(true);
                setModForm((f) => ({ ...f, order: modules.length + 1 }));
              }}
              id="add-module-header-btn"
            >
              + Add Module
            </button>
          </div>
        </div>

        {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}
        {success && <Alert type="success" onClose={() => setSuccess('')}>{success}</Alert>}

        {/* MAIN NAVIGATION TABS */}
        <div className="tabs">
          <button
            className={`tab-btn${mainTab === 'modules' ? ' active' : ''}`}
            onClick={() => setMainTab('modules')}
            id="tab-modules-builder"
          >
            📦 Course Modules ({modules.length})
          </button>
          <button
            className={`tab-btn${mainTab === 'students' ? ' active' : ''}`}
            onClick={() => setMainTab('students')}
            id="tab-enrolled-students"
          >
            👥 Enrolled Students ({course.students?.length ?? 0})
          </button>
        </div>

        {/* =====================================================
            MODULES TAB — CLEAN CARD LIST VIEW
        ===================================================== */}
        {mainTab === 'modules' && (
          <div>
            {modules.length === 0 ? (
              <EmptyState
                icon="📦"
                title="No Modules in this Course"
                text="Create modules to structure your course with content lessons and quizzes."
                action={
                  <button type="button" className="btn btn-primary" onClick={() => setShowAddModule(true)}>
                    + Add First Module
                  </button>
                }
              />
            ) : (
              <div className="module-card-list">
                {modules.map((m, idx) => (
                  <ModuleCard
                    key={m.id}
                    module={m}
                    courseId={course.id}
                    onRefresh={load}
                    onError={setError}
                    isFirst={idx === 0}
                    isLast={idx === modules.length - 1}
                    onMoveUp={() => handleMoveModule(m, 'up')}
                    onMoveDown={() => handleMoveModule(m, 'down')}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* =====================================================
            ENROLLED STUDENTS TAB
        ===================================================== */}
        {mainTab === 'students' && (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Enrolled Students ({course.students?.length ?? 0})</h2>
              <Link to="/admin/assignments" className="btn btn-outline btn-sm">Assign Students</Link>
            </div>
            {!course.students || course.students.length === 0 ? (
              <div className="card-body">
                <EmptyState
                  icon="👥"
                  title="No Students Enrolled"
                  text="Assign students to this course using the Assignments menu."
                />
              </div>
            ) : (
              <div className="table-wrapper" style={{ border: 'none' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Student Name</th>
                      <th>Email</th>
                      <th>Status</th>
                      <th>Assigned Date</th>
                      <th>Completed Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {course.students.map((s) => (
                      <tr key={s.student_id}>
                        <td>
                          <Link to={`/admin/students/${s.student_id}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>
                            {s.student_name}
                          </Link>
                        </td>
                        <td className="text-gray">{s.email}</td>
                        <td>
                          <Badge variant={s.status === 'COMPLETED' ? 'success' : s.status === 'IN_PROGRESS' ? 'info' : 'gray'}>
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
        )}

        {/* EDIT COURSE MODAL */}
        {showEdit && (
          <Modal
            title="Edit Course Details"
            onClose={() => { setShowEdit(false); setEditError(''); }}
            footer={
              <>
                <button type="button" className="btn btn-outline" onClick={() => setShowEdit(false)} disabled={savingEdit}>Cancel</button>
                <button type="submit" className="btn btn-primary" form="edit-course-form" disabled={savingEdit} id="submit-edit-course-btn">
                  {savingEdit ? <Spinner /> : 'Save Changes'}
                </button>
              </>
            }
          >
            {editError && <Alert type="error">{editError}</Alert>}
            <form id="edit-course-form" onSubmit={handleEditCourse} noValidate>
              <div className="form-group">
                <label className="form-label" htmlFor="edit-c-title">Course Title *</label>
                <input
                  id="edit-c-title"
                  type="text"
                  className="form-input"
                  value={editForm.title}
                  onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-c-desc">Description</label>
                <textarea
                  id="edit-c-desc"
                  className="form-textarea"
                  value={editForm.description}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
                <input
                  id="edit-c-active"
                  type="checkbox"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))}
                  style={{ width: 18, height: 18, cursor: 'pointer' }}
                />
                <label className="form-label" htmlFor="edit-c-active" style={{ marginBottom: 0, cursor: 'pointer' }}>
                  Active Course (available for student assignments)
                </label>
              </div>
            </form>
          </Modal>
        )}

        {/* ADD MODULE MODAL */}
        {showAddModule && (
          <Modal
            title="Add New Module"
            onClose={() => { setShowAddModule(false); setModError(''); }}
            footer={
              <>
                <button type="button" className="btn btn-outline" onClick={() => setShowAddModule(false)} disabled={addingMod}>Cancel</button>
                <button type="submit" className="btn btn-primary" form="add-module-form" disabled={addingMod} id="submit-add-module-btn">
                  {addingMod ? <Spinner /> : 'Create & Edit Module'}
                </button>
              </>
            }
          >
            {modError && <Alert type="error">{modError}</Alert>}
            <form id="add-module-form" onSubmit={handleAddModule} noValidate>
              <div className="form-group">
                <label className="form-label" htmlFor="m-title">Module Title *</label>
                <input
                  id="m-title"
                  type="text"
                  className="form-input"
                  value={modForm.title}
                  onChange={(e) => setModForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Introduction to Python Data Types"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="m-desc">Description</label>
                <textarea
                  id="m-desc"
                  className="form-textarea"
                  value={modForm.description}
                  onChange={(e) => setModForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="m-order">Module Order</label>
                <input
                  id="m-order"
                  type="number"
                  className="form-input"
                  value={modForm.order}
                  onChange={(e) => setModForm((f) => ({ ...f, order: Number(e.target.value) }))}
                  min={1}
                  style={{ width: 100 }}
                  required
                />
              </div>
            </form>
          </Modal>
        )}
      </div>
    </AdminLayout>
  );
}
