import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import {
  getCourse,
  updateModule,
  deleteModule,
  deleteTrainingContent,
  reorderContent,
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
import ContentEditor from '../../components/ContentEditor';
import QuizBuilder from '../../components/QuizBuilder';

// ============================================================
// Main Admin Module Editor Page — Simple Single-Page Layout
// ============================================================
export default function ModuleEditor() {
  const { courseId, moduleId } = useParams();
  const navigate = useNavigate();

  const [course, setCourse] = useState(null);
  const [module, setModule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [objectives, setObjectives] = useState([]);
  const [keyTakeaways, setKeyTakeaways] = useState([]);
  const [isPublished, setIsPublished] = useState(false);
  const [moduleOrder, setModuleOrder] = useState(1);

  // Unsaved changes tracking
  const [isDirty, setIsDirty] = useState(false);

  // Content Editor state
  const [showAddContent, setShowAddContent] = useState(false);
  const [addContentType, setAddContentType] = useState('TEXT'); // 'TEXT' | 'VIDEO' | 'EMBED'
  const [editingContent, setEditingContent] = useState(null);
  const [deletingContentId, setDeletingContentId] = useState(null);

  // Quiz Editor state
  const [showQuizEditor, setShowQuizEditor] = useState(false);

  // Action States
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [confirmDeleteMod, setConfirmDeleteMod] = useState(false);
  const [deletingMod, setDeletingMod] = useState(false);

  // Load course and find active module
  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getCourse(Number(courseId));
      setCourse(res.course);

      const found = (res.course.modules || []).find((m) => m.id === Number(moduleId));
      if (!found) {
        setError('Module not found in this course.');
      } else {
        setModule(found);
        setTitle(found.title || '');
        setDescription(found.description || '');
        setObjectives(found.objectives || []);
        setKeyTakeaways(found.key_takeaways || []);
        setIsPublished(found.is_published || false);
        setModuleOrder(found.module_order || 1);
        setIsDirty(false);
      }
    } catch (err) {
      setError(err.message || 'Failed to load course and module data.');
    } finally {
      setLoading(false);
    }
  }, [courseId, moduleId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Unsaved changes browser prompt
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Objective Handlers
  function handleAddObjective() {
    setObjectives([...objectives, '']);
    setIsDirty(true);
  }
  function handleObjectiveChange(index, val) {
    const updated = [...objectives];
    updated[index] = val;
    setObjectives(updated);
    setIsDirty(true);
  }
  function handleRemoveObjective(index) {
    setObjectives(objectives.filter((_, i) => i !== index));
    setIsDirty(true);
  }

  // Key Takeaway Handlers
  function handleAddTakeaway() {
    setKeyTakeaways([...keyTakeaways, '']);
    setIsDirty(true);
  }
  function handleTakeawayChange(index, val) {
    const updated = [...keyTakeaways];
    updated[index] = val;
    setKeyTakeaways(updated);
    setIsDirty(true);
  }
  function handleRemoveTakeaway(index) {
    setKeyTakeaways(keyTakeaways.filter((_, i) => i !== index));
    setIsDirty(true);
  }

  // Content Reordering
  async function handleMoveContent(contentItem, direction) {
    const contents = [...(module?.contents || [])].sort((a, b) => a.content_order - b.content_order);
    const currIdx = contents.findIndex((c) => c.id === contentItem.id);
    const targetIdx = direction === 'up' ? currIdx - 1 : currIdx + 1;
    if (targetIdx < 0 || targetIdx >= contents.length) return;

    const targetItem = contents[targetIdx];
    try {
      await reorderContent(module.id, contentItem.id, targetItem.content_order);
      await reorderContent(module.id, targetItem.id, contentItem.content_order);
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to reorder content.');
    }
  }

  // Delete Content
  async function handleDeleteContent(contentId) {
    try {
      await deleteTrainingContent(module.id, contentId);
      setDeletingContentId(null);
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to delete content.');
      setDeletingContentId(null);
    }
  }

  // Delete Module
  async function handleDeleteModule() {
    setDeletingMod(true);
    try {
      await deleteModule(module.id);
      navigate(`/admin/courses/${courseId}`);
    } catch (err) {
      setError(err.message || 'Failed to delete module.');
      setConfirmDeleteMod(false);
    } finally {
      setDeletingMod(false);
    }
  }

  // Save Draft
  async function handleSaveDraft(e) {
    if (e) e.preventDefault();
    if (!title.trim()) {
      setError('Module title is required.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const cleanObjs = objectives.map((o) => o.trim()).filter(Boolean);
      const cleanTakeaways = keyTakeaways.map((t) => t.trim()).filter(Boolean);

      await updateModule(module.id, {
        title: title.trim(),
        description: description.trim(),
        module_order: moduleOrder,
        objectives: cleanObjs,
        keyTakeaways: cleanTakeaways,
        isPublished: isPublished,
      });

      setSuccess('Module details saved successfully.');
      setIsDirty(false);
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to save module details.');
    } finally {
      setSaving(false);
    }
  }

  // Publish / Unpublish Toggle
  async function handlePublishToggle() {
    if (!isPublished) {
      setShowPublishModal(true);
    } else {
      setPublishing(true);
      try {
        await updateModule(module.id, { isPublished: false });
        setIsPublished(false);
        setSuccess('Module unpublished. Saved as draft.');
        await loadData();
      } catch (err) {
        setError(err.message || 'Failed to unpublish module.');
      } finally {
        setPublishing(false);
      }
    }
  }

  async function confirmPublish() {
    setPublishing(true);
    try {
      const cleanObjs = objectives.map((o) => o.trim()).filter(Boolean);
      const cleanTakeaways = keyTakeaways.map((t) => t.trim()).filter(Boolean);

      await updateModule(module.id, {
        title: title.trim(),
        description: description.trim(),
        module_order: moduleOrder,
        objectives: cleanObjs,
        keyTakeaways: cleanTakeaways,
        isPublished: true,
      });

      setIsPublished(true);
      setShowPublishModal(false);
      setSuccess('🚀 Module published successfully! Visible to learners.');
      setIsDirty(false);
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to publish module.');
    } finally {
      setPublishing(false);
    }
  }

  const allContents = useMemo(() => {
    return [...(module?.contents || [])].sort((a, b) => a.content_order - b.content_order);
  }, [module?.contents]);

  const quiz = module?.quizzes && module.quizzes.length > 0 ? module.quizzes[0] : null;

  const checklist = [
    { label: 'Module title specified', pass: !!title.trim() },
    { label: 'Module description added', pass: !!description.trim() },
    { label: 'Learning objectives defined', pass: objectives.some((o) => o.trim().length > 0) },
    { label: 'Learning content blocks added', pass: allContents.length > 0 },
    { label: 'Assessment quiz configured', pass: !!quiz && (quiz.questions?.length ?? 0) > 0 },
  ];
  const canPublish = checklist.every((c) => c.pass);

  if (loading) {
    return (
      <AdminLayout>
        <div className="page-container">
          <LoadingPage message="Loading module editor…" />
        </div>
      </AdminLayout>
    );
  }

  if (error && !module) {
    return (
      <AdminLayout>
        <div className="page-container">
          <div className="mb-4">
            <Link to={`/admin/courses/${courseId}`} className="text-gray text-sm">
              ← Back to Course
            </Link>
          </div>
          <Alert type="error">{error}</Alert>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="page-container" style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Unsaved Changes Banner */}
        {isDirty && (
          <div className="unsaved-banner mb-4">
            <span>⚠️ You have unsaved changes in this module.</span>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={handleSaveDraft}
              disabled={saving}
            >
              {saving ? <Spinner /> : 'Save Draft Now'}
            </button>
          </div>
        )}

        {/* Header Bar */}
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-xs text-gray mb-1">
              <Link to="/admin/courses" className="text-gray hover:text-primary">
                Courses
              </Link>
              <span>/</span>
              <Link to={`/admin/courses/${courseId}`} className="text-gray hover:text-primary font-semibold">
                {course?.title || 'Course'}
              </Link>
              <span>/</span>
              <span className="font-bold text-gray-800">Module #{moduleOrder}</span>
            </div>

            <div className="flex items-center gap-3">
              <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: 'var(--gray-900)' }}>
                Module #{moduleOrder}: {title || 'Untitled Module'}
              </h1>
              <Badge variant={isPublished ? 'success' : 'gray'}>
                {isPublished ? '✓ Published' : 'Draft'}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link to={`/admin/courses/${courseId}`} className="btn btn-outline btn-sm">
              ← Back to Course
            </Link>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleSaveDraft}
              disabled={saving}
              id="save-draft-btn"
            >
              {saving ? <Spinner /> : '💾 Save Draft'}
            </button>
            <button
              type="button"
              className={`btn btn-sm ${isPublished ? 'btn-outline' : 'btn-success'}`}
              onClick={handlePublishToggle}
              disabled={publishing}
              id="publish-module-btn"
            >
              {publishing ? <Spinner /> : isPublished ? 'Unpublish' : '🚀 Publish Module'}
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm text-danger"
              onClick={() => setConfirmDeleteMod(true)}
              id="delete-module-editor-btn"
              title="Delete Module"
            >
              🗑
            </button>
          </div>
        </div>

        {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}
        {success && <Alert type="success" onClose={() => setSuccess('')}>{success}</Alert>}

        {/* EDITOR SECTIONS (SIMPLE STACKED CARDS) */}
        <div className="flex flex-col gap-6">
          {/* SECTION 1: MODULE INFORMATION */}
          <div className="card p-6" style={{ background: '#fff', borderRadius: 'var(--radius-lg)' }}>
            <h3 className="text-base font-bold mb-4 pb-2 border-b" style={{ color: 'var(--gray-900)' }}>
              📌 1. Module Information
            </h3>

            <div className="form-group">
              <label className="form-label text-xs font-bold" htmlFor="mod-title">
                Module Title *
              </label>
              <input
                id="mod-title"
                type="text"
                className="form-input"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setIsDirty(true);
                }}
                placeholder="e.g. Introduction to Control Flow"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label text-xs font-bold" htmlFor="mod-desc">
                Description
              </label>
              <textarea
                id="mod-desc"
                className="form-textarea"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setIsDirty(true);
                }}
                placeholder="Brief summary of what this module covers..."
                rows={3}
              />
            </div>

            <div className="form-group mb-0" style={{ maxWidth: 140 }}>
              <label className="form-label text-xs font-bold" htmlFor="mod-order">
                Module Order #
              </label>
              <input
                id="mod-order"
                type="number"
                className="form-input"
                value={moduleOrder}
                onChange={(e) => {
                  setModuleOrder(Number(e.target.value));
                  setIsDirty(true);
                }}
                min={1}
              />
            </div>
          </div>

          {/* SECTION 2: LEARNING OBJECTIVES */}
          <div className="card p-6" style={{ background: '#fff', borderRadius: 'var(--radius-lg)' }}>
            <div className="flex justify-between items-center mb-4 pb-2 border-b">
              <div>
                <h3 className="text-base font-bold" style={{ margin: 0, color: 'var(--gray-900)' }}>
                  🎯 2. Learning Objectives ({objectives.length})
                </h3>
                <p className="text-xs text-gray">Specify what students will learn in this module.</p>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={handleAddObjective}
                id="add-objective-btn"
              >
                + Add Objective
              </button>
            </div>

            {objectives.length === 0 ? (
              <p className="text-xs text-gray italic">No learning objectives added yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {objectives.map((obj, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray">•</span>
                    <input
                      type="text"
                      className="form-input text-xs"
                      value={obj}
                      onChange={(e) => handleObjectiveChange(i, e.target.value)}
                      placeholder="e.g. Understand conditional statements (if/else)"
                    />
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs text-danger"
                      onClick={() => handleRemoveObjective(i)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 3: KEY TAKEAWAYS */}
          <div className="card p-6" style={{ background: '#fff', borderRadius: 'var(--radius-lg)' }}>
            <div className="flex justify-between items-center mb-4 pb-2 border-b">
              <div>
                <h3 className="text-base font-bold" style={{ margin: 0, color: 'var(--gray-900)' }}>
                  💡 3. Key Takeaways ({keyTakeaways.length})
                </h3>
                <p className="text-xs text-gray">Key points for learners to remember.</p>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={handleAddTakeaway}
                id="add-takeaway-btn"
              >
                + Add Takeaway
              </button>
            </div>

            {keyTakeaways.length === 0 ? (
              <p className="text-xs text-gray italic">No key takeaways added yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {keyTakeaways.map((kt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-success">✓</span>
                    <input
                      type="text"
                      className="form-input text-xs"
                      value={kt}
                      onChange={(e) => handleTakeawayChange(i, e.target.value)}
                      placeholder="e.g. If statements check boolean conditions"
                    />
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs text-danger"
                      onClick={() => handleRemoveTakeaway(i)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 4: LEARNING CONTENT BLOCKS */}
          <div className="card p-6" style={{ background: '#fff', borderRadius: 'var(--radius-lg)' }}>
            <div className="flex justify-between items-center mb-4 pb-2 border-b flex-wrap gap-2">
              <div>
                <h3 className="text-base font-bold" style={{ margin: 0, color: 'var(--gray-900)' }}>
                  📄 4. Learning Content ({allContents.length} Blocks)
                </h3>
                <p className="text-xs text-gray">Add text lessons, video embeds, or external resource links.</p>
              </div>

              {!showAddContent && !editingContent && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setAddContentType('TEXT');
                      setShowAddContent(true);
                    }}
                    id="add-text-lesson-btn"
                  >
                    + Add Text Lesson
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => {
                      setAddContentType('VIDEO');
                      setShowAddContent(true);
                    }}
                    id="add-video-embed-btn"
                  >
                    + Add Video Embed
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => {
                      setAddContentType('EMBED');
                      setShowAddContent(true);
                    }}
                    id="add-resource-link-btn"
                  >
                    + Add Link / Resource
                  </button>
                </div>
              )}
            </div>

            {/* Add Content Inline Form */}
            {showAddContent && (
              <ContentEditor
                moduleId={module.id}
                initialType={addContentType}
                initialOrder={allContents.length + 1}
                onSaved={() => {
                  setShowAddContent(false);
                  loadData();
                }}
                onCancel={() => setShowAddContent(false)}
              />
            )}

            {/* Edit Content Inline Form */}
            {editingContent && (
              <ContentEditor
                moduleId={module.id}
                existingContent={editingContent}
                onSaved={() => {
                  setEditingContent(null);
                  loadData();
                }}
                onCancel={() => setEditingContent(null)}
              />
            )}

            {/* Content Blocks List */}
            {allContents.length === 0 && !showAddContent && !editingContent ? (
              <EmptyState
                icon="📄"
                title="No Content Blocks"
                text="Add text lessons, video embeds, or external links for learners to study."
                action={
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setAddContentType('TEXT');
                      setShowAddContent(true);
                    }}
                  >
                    + Add First Content Block
                  </button>
                }
              />
            ) : (
              <div className="flex flex-col gap-3">
                {allContents.map((c, idx) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-3 border rounded-lg gap-4"
                    style={{ background: 'var(--gray-50)', borderColor: 'var(--gray-200)' }}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: '#fff',
                          border: '1px solid var(--gray-300)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                        }}
                      >
                        {c.content_order || idx + 1}
                      </span>

                      <div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              c.content_type === 'VIDEO'
                                ? 'primary'
                                : c.content_type === 'EMBED'
                                ? 'info'
                                : 'gray'
                            }
                          >
                            {c.content_type === 'VIDEO'
                              ? '🎥 Video'
                              : c.content_type === 'EMBED'
                              ? '🔗 Link'
                              : '📄 Lesson'}
                          </Badge>
                          <span className="font-bold text-sm" style={{ color: 'var(--gray-900)' }}>
                            {c.title || `Block #${idx + 1}`}
                          </span>
                        </div>
                        <p className="text-xs text-gray truncate mt-1" style={{ maxWidth: 460, margin: 0 }}>
                          {c.content}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={() => handleMoveContent(c, 'up')}
                        disabled={idx === 0}
                        title="Move Up"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={() => handleMoveContent(c, 'down')}
                        disabled={idx === allContents.length - 1}
                        title="Move Down"
                      >
                        ▼
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-xs"
                        onClick={() => setEditingContent(c)}
                        id={`edit-content-btn-${c.id}`}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-xs"
                        onClick={() => setDeletingContentId(c.id)}
                        id={`delete-content-btn-${c.id}`}
                      >
                        Delete
                      </button>
                    </div>

                    {deletingContentId === c.id && (
                      <ConfirmModal
                        title="Delete Content Block"
                        message="Are you sure you want to delete this content block?"
                        onConfirm={() => handleDeleteContent(c.id)}
                        onCancel={() => setDeletingContentId(null)}
                        danger
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 5: ASSESSMENT QUIZ */}
          <div className="card p-6" style={{ background: '#fff', borderRadius: 'var(--radius-lg)' }}>
            <div className="flex justify-between items-center mb-4 pb-2 border-b">
              <div>
                <h3 className="text-base font-bold" style={{ margin: 0, color: 'var(--gray-900)' }}>
                  📝 5. Assessment Quiz
                </h3>
                <p className="text-xs text-gray">Configure assessment questions and passing threshold.</p>
              </div>

              {!showQuizEditor && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowQuizEditor(true)}
                  id="configure-quiz-btn"
                >
                  {quiz ? '✏️ Edit Quiz' : '+ Create Quiz'}
                </button>
              )}
            </div>

            {showQuizEditor ? (
              <QuizBuilder
                moduleId={module.id}
                quiz={quiz}
                onQuizCreated={() => {
                  setShowQuizEditor(false);
                  loadData();
                }}
                onQuizUpdated={() => {
                  setShowQuizEditor(false);
                  loadData();
                }}
                onCancel={() => setShowQuizEditor(false)}
              />
            ) : quiz ? (
              <div
                className="p-4 border rounded-lg"
                style={{ background: 'var(--success-light)', borderColor: 'var(--success)' }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span style={{ fontSize: '1.2rem' }}>✅</span>
                      <h4 className="font-bold text-base" style={{ margin: 0, color: 'var(--success-text)' }}>
                        {quiz.title}
                      </h4>
                    </div>
                    <p className="text-xs text-gray mb-3">{quiz.description || 'Module Knowledge Check'}</p>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="font-bold">Passing Score: {quiz.passing_score}%</span>
                      <span>•</span>
                      <span className="font-bold">Questions: {quiz.questions?.length ?? 0}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => setShowQuizEditor(true)}
                  >
                    ✏️ Edit Quiz
                  </button>
                </div>
              </div>
            ) : (
              <EmptyState
                icon="📝"
                title="No Quiz Configured"
                text="Students complete this module directly after reading content lessons unless a quiz is added."
                action={
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => setShowQuizEditor(true)}
                  >
                    + Create Assessment Quiz
                  </button>
                }
              />
            )}
          </div>

          {/* BOTTOM FOOTER ACTIONS */}
          <div className="flex items-center justify-between p-4 bg-white border rounded-lg">
            <Link to={`/admin/courses/${courseId}`} className="btn btn-outline">
              ← Back to Course
            </Link>

            <div className="flex items-center gap-3">
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleSaveDraft}
                disabled={saving}
              >
                {saving ? <Spinner /> : '💾 Save Draft'}
              </button>
              <button
                type="button"
                className={`btn ${isPublished ? 'btn-outline' : 'btn-success'}`}
                onClick={handlePublishToggle}
                disabled={publishing}
              >
                {publishing ? <Spinner /> : isPublished ? 'Unpublish' : '🚀 Publish Module'}
              </button>
            </div>
          </div>
        </div>

        {/* Publish Modal Checklist */}
        {showPublishModal && (
          <Modal
            title="Publish Module"
            onClose={() => setShowPublishModal(false)}
            footer={
              <>
                <button type="button" className="btn btn-outline" onClick={() => setShowPublishModal(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={confirmPublish}
                  disabled={!canPublish || publishing}
                  id="confirm-publish-btn"
                >
                  {publishing ? <Spinner /> : 'Confirm & Publish'}
                </button>
              </>
            }
          >
            <p className="text-sm text-gray mb-4">
              Review publication requirements before making this module visible to students:
            </p>

            <div className="publish-checklist mb-4">
              {checklist.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2 border-b text-xs"
                  style={{ color: item.pass ? 'var(--success-text)' : 'var(--danger-text)' }}
                >
                  <span>{item.pass ? '✓' : '⚠️'}</span>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>

            {!canPublish && (
              <Alert type="warning">
                Please complete missing items before publishing this module.
              </Alert>
            )}
          </Modal>
        )}

        {/* Confirm Delete Module Modal */}
        {confirmDeleteMod && (
          <ConfirmModal
            title="Delete Module"
            message={`Are you sure you want to delete "${title}"? Dependent content and quiz records will be removed.`}
            onConfirm={handleDeleteModule}
            onCancel={() => setConfirmDeleteMod(false)}
            danger
            loading={deletingMod}
          />
        )}
      </div>
    </AdminLayout>
  );
}
