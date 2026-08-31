import { useState, useEffect, useCallback } from 'react';
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
  LoadingPage, Alert, Badge, EmptyState,
  Modal, ConfirmModal, Spinner,
} from '../../components/ui';
import ContentEditor, { parseEmbedUrl } from '../../components/ContentEditor';
import QuizBuilder from '../../components/QuizBuilder';

// ============================================================
// Preview Slide Renderer for Instructor Module Preview
// ============================================================
function ModulePreviewSlide({ contentItem }) {
  if (!contentItem) return null;
  const type = contentItem.content_type;
  const rawContent = contentItem.content || '';

  if (type === 'TEXT') {
    return (
      <div style={{ fontSize: 'var(--font-size-base)', lineHeight: 1.8, color: 'var(--gray-800)' }}>
        {rawContent.split('\n\n').map((para, idx) => (
          <p key={idx} style={{ marginBottom: 'var(--space-4)' }}>{para}</p>
        ))}
      </div>
    );
  }

  const parsed = parseEmbedUrl(rawContent);
  if (parsed.type === 'youtube' || parsed.type === 'vimeo') {
    return (
      <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: 'var(--radius-lg)', background: '#000' }}>
        <iframe title="Module Video" src={parsed.embedUrl} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }} allowFullScreen />
      </div>
    );
  }

  if (parsed.type === 'direct_video') {
    return (
      <video controls src={parsed.embedUrl} style={{ width: '100%', maxHeight: 400, borderRadius: 'var(--radius-lg)' }} />
    );
  }

  return (
    <div style={{ background: 'var(--info-light)', border: '1px solid #bae6fd', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', textAlign: 'center' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-2)' }}>🔗</div>
      <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: '#075985', marginBottom: 'var(--space-2)' }}>External Resource</h4>
      <p style={{ fontSize: 'var(--font-size-sm)', color: '#0369a1', marginBottom: 'var(--space-4)' }}>
        This resource will open in a new browser tab for students.
      </p>
      {parsed.embedUrl ? (
        <a href={parsed.embedUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">Open Resource ↗</a>
      ) : (
        <span className="text-sm text-gray">{rawContent}</span>
      )}
    </div>
  );
}

// ============================================================
// Main Instructor Module Editor Page
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

  // UI Modes
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [selectedAddType, setSelectedAddType] = useState(null); // 'TEXT' | 'VIDEO' | 'EMBED'
  const [editingContent, setEditingContent] = useState(null);
  const [deletingContentId, setDeletingContentId] = useState(null);

  const [showQuizEditor, setShowQuizEditor] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewSlideIdx, setPreviewSlideIdx] = useState(0);

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

  useEffect(() => { loadData(); }, [loadData]);

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
    const contents = [...(module.contents || [])].sort((a, b) => a.content_order - b.content_order);
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
    if (!title.trim()) { setError('Module title is required.'); return; }

    setSaving(true);
    setError(''); setSuccess('');
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

      setSuccess('Module draft saved successfully.');
      setIsDirty(false);
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to save module draft.');
    } finally {
      setSaving(false);
    }
  }

  // Publish / Unpublish Toggle
  async function handlePublishToggle() {
    if (!isPublished) {
      // Validate publish checklist
      setShowPublishModal(true);
    } else {
      // Direct unpublish
      setPublishing(true);
      try {
        await updateModule(module.id, { isPublished: false });
        setIsPublished(false);
        setSuccess('Module unpublished. It is now saved as a draft.');
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
      setSuccess('🎉 Module published successfully! It is now accessible to learners.');
      setIsDirty(false);
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to publish module.');
    } finally {
      setPublishing(false);
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="page-container"><LoadingPage message="Loading module editor…" /></div>
      </AdminLayout>
    );
  }

  if (error && !module) {
    return (
      <AdminLayout>
        <div className="page-container">
          <div className="mb-4">
            <Link to={`/admin/courses/${courseId}`} className="text-gray text-sm">← Back to Course</Link>
          </div>
          <Alert type="error">{error}</Alert>
        </div>
      </AdminLayout>
    );
  }

  const contents = [...(module?.contents || [])].sort((a, b) => a.content_order - b.content_order);
  const quiz = module?.quizzes && module.quizzes.length > 0 ? module.quizzes[0] : null;

  // Publish Checklist validation rules
  const checklist = [
    { label: 'Module title added', pass: !!title.trim() },
    { label: 'Module description added', pass: !!description.trim() },
    { label: 'Learning objectives defined', pass: objectives.some((o) => o.trim().length > 0) },
    { label: 'Learning content blocks added', pass: contents.length > 0 },
    { label: 'Module assessment / quiz configured', pass: !!quiz && (quiz.questions?.length ?? 0) > 0 },
  ];
  const canPublish = checklist.every((c) => c.pass);

  return (
    <AdminLayout>
      <div className="page-container">
        {/* Unsaved changes notification banner */}
        {isDirty && (
          <div className="unsaved-banner mb-4">
            <span>⚠️ You have unsaved changes in this module.</span>
            <button type="button" className="btn btn-sm btn-primary" onClick={handleSaveDraft} disabled={saving}>
              {saving ? <Spinner /> : 'Save Draft Now'}
            </button>
          </div>
        )}

        {/* Top Header Row */}
        <div className="editor-header">
          <div className="editor-header-left">
            <div className="editor-breadcrumb">
              <Link to="/admin/courses" className="text-gray">Courses</Link>
              <span className="mx-2">/</span>
              <Link to={`/admin/courses/${courseId}`} className="text-gray">{course?.title || 'Course'}</Link>
              <span className="mx-2">/</span>
              <span>Module {moduleOrder} Editor</span>
            </div>

            <div className="flex items-center gap-3 mt-1">
              <h1>Module {moduleOrder}: {title || 'Untitled Module'}</h1>
              <Badge variant={isPublished ? 'success' : 'gray'}>
                {isPublished ? '✓ Published' : 'Draft'}
              </Badge>
            </div>
          </div>

          <div className="editor-header-actions">
            <button
              type="button"
              className={`btn btn-sm ${isPreviewMode ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setIsPreviewMode(!isPreviewMode)}
              id="toggle-preview-btn"
            >
              {isPreviewMode ? '✏️ Exit Preview Mode' : '👁 Preview Module'}
            </button>

            <button
              type="button"
              className="btn btn-sm btn-outline"
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
              {publishing ? <Spinner /> : isPublished ? 'Unpublish' : '🚀 Publish'}
            </button>

            <button
              type="button"
              className="btn btn-sm btn-danger"
              onClick={() => setConfirmDeleteMod(true)}
              id="delete-module-editor-btn"
            >
              🗑
            </button>
          </div>
        </div>

        {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}
        {success && <Alert type="success" onClose={() => setSuccess('')}>{success}</Alert>}

        {/* =====================================================
            PREVIEW MODE VIEW
        ===================================================== */}
        {isPreviewMode ? (
          <div className="card" style={{ maxWidth: 860, margin: '0 auto' }}>
            <div className="preview-banner">
              <span>👁 LEARNER PREVIEW MODE</span>
              <span className="text-xs text-gray">This is how students will view this module</span>
            </div>

            <div className="card-body">
              <h2 className="text-xl font-bold mb-1">{title}</h2>
              {description && <p className="text-sm text-gray mb-4">{description}</p>}

              {/* Objectives Preview */}
              {objectives.filter(Boolean).length > 0 && (
                <div style={{ background: 'var(--primary-light)', borderRadius: 'var(--radius)', padding: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
                  <h4 className="text-xs font-bold text-primary uppercase mb-2">🎯 Learning Objectives</h4>
                  <ul style={{ paddingLeft: 'var(--space-4)', fontSize: 'var(--font-size-sm)', color: 'var(--gray-800)' }}>
                    {objectives.filter(Boolean).map((obj, i) => (
                      <li key={i} style={{ marginBottom: 4 }}>{obj}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Slide Content Preview */}
              {contents.length > 0 ? (
                <div>
                  <div className="flex items-center justify-between text-xs text-gray mb-2">
                    <span>Content Slide {previewSlideIdx + 1} of {contents.length}</span>
                    <Badge variant={contents[previewSlideIdx]?.content_type === 'VIDEO' ? 'primary' : 'gray'}>
                      {contents[previewSlideIdx]?.content_type === 'VIDEO' ? '🎥 Video' : '📄 Text'}
                    </Badge>
                  </div>

                  {contents[previewSlideIdx]?.title && (
                    <h3 className="text-base font-bold mb-3" style={{ color: 'var(--gray-900)' }}>
                      {contents[previewSlideIdx].title}
                    </h3>
                  )}

                  <ModulePreviewSlide contentItem={contents[previewSlideIdx]} />

                  <div className="flex items-center justify-between mt-6">
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setPreviewSlideIdx((i) => Math.max(0, i - 1))}
                      disabled={previewSlideIdx === 0}
                    >
                      ← Previous Slide
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => setPreviewSlideIdx((i) => Math.min(contents.length - 1, i + 1))}
                      disabled={previewSlideIdx === contents.length - 1}
                    >
                      Next Slide →
                    </button>
                  </div>
                </div>
              ) : (
                <EmptyState icon="📄" title="No Content Slides" text="Add learning content in the editor to preview slides." />
              )}

              {/* Key Takeaways Preview */}
              {keyTakeaways.filter(Boolean).length > 0 && (
                <div style={{ marginTop: 'var(--space-6)', borderTop: '1px solid var(--gray-200)', paddingTop: 'var(--space-4)' }}>
                  <h4 className="text-xs font-bold text-gray uppercase mb-2">💡 Key Takeaways</h4>
                  <div className="flex flex-wrap gap-2">
                    {keyTakeaways.filter(Boolean).map((kt, i) => (
                      <span key={i} className="badge badge-gray" style={{ fontSize: 'var(--font-size-xs)' }}>✓ {kt}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Quiz Status Preview */}
              <div style={{ marginTop: 'var(--space-6)' }}>
                <div className="quiz-status-card">
                  <div className="quiz-status-info">
                    <span className="quiz-status-icon">📝</span>
                    <div>
                      <div className="quiz-status-label">{quiz ? quiz.title : 'Module Assessment'}</div>
                      <div className="quiz-status-sub">
                        {quiz ? `${quiz.questions?.length ?? 0} Questions • Pass Score: ${quiz.passing_score}%` : 'Quiz not configured'}
                      </div>
                    </div>
                  </div>
                  <button type="button" className="btn btn-sm btn-primary" disabled>Start Quiz (Preview)</button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* =====================================================
              AUTHORING EDITOR FORM
          ===================================================== */
          <div className="editor-layout" style={{ margin: '0 auto' }}>
            {/* SECTION 1: MODULE INFORMATION */}
            <div className="editor-section">
              <div className="editor-section-header">
                <span className="editor-section-title">📌 1. Module Information</span>
              </div>
              <div className="editor-section-body">
                <div className="form-group">
                  <label className="form-label" htmlFor="mod-title">Module Title *</label>
                  <input
                    id="mod-title"
                    type="text"
                    className="form-input"
                    value={title}
                    onChange={(e) => { setTitle(e.target.value); setIsDirty(true); }}
                    placeholder="e.g. Introduction to Control Flow"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="mod-desc">Description</label>
                  <textarea
                    id="mod-desc"
                    className="form-textarea"
                    value={description}
                    onChange={(e) => { setDescription(e.target.value); setIsDirty(true); }}
                    placeholder="Provide a concise summary of what this module covers..."
                    style={{ minHeight: 90 }}
                  />
                </div>

                <div className="form-group" style={{ maxWidth: 160 }}>
                  <label className="form-label" htmlFor="mod-order">Module Order</label>
                  <input
                    id="mod-order"
                    type="number"
                    className="form-input"
                    value={moduleOrder}
                    onChange={(e) => { setModuleOrder(Number(e.target.value)); setIsDirty(true); }}
                    min={1}
                  />
                </div>
              </div>
            </div>

            {/* SECTION 2: LEARNING OBJECTIVES */}
            <div className="editor-section">
              <div className="editor-section-header">
                <span className="editor-section-title">🎯 2. Learning Objectives</span>
                <button type="button" className="btn btn-sm btn-ghost" onClick={handleAddObjective} id="add-objective-btn">
                  + Add Objective
                </button>
              </div>
              <div className="editor-section-body">
                <p className="text-xs text-gray mb-3">Define measurable outcomes for students completing this module.</p>
                
                {objectives.length === 0 ? (
                  <p className="text-sm text-gray italic mb-2">No learning objectives added yet.</p>
                ) : (
                  <div className="objectives-list">
                    {objectives.map((obj, i) => (
                      <div key={i} className="objective-item">
                        <span className="text-sm text-gray font-bold">•</span>
                        <input
                          type="text"
                          className="form-input"
                          value={obj}
                          onChange={(e) => handleObjectiveChange(i, e.target.value)}
                          placeholder={`e.g. Understand conditional statements (if/else)`}
                        />
                        <button type="button" className="objective-remove-btn" onClick={() => handleRemoveObjective(i)} title="Remove">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* SECTION 3: KEY TAKEAWAYS */}
            <div className="editor-section">
              <div className="editor-section-header">
                <span className="editor-section-title">💡 3. Key Takeaways</span>
                <button type="button" className="btn btn-sm btn-ghost" onClick={handleAddTakeaway} id="add-takeaway-btn">
                  + Add Takeaway
                </button>
              </div>
              <div className="editor-section-body">
                <p className="text-xs text-gray mb-3">Highlight key concepts students should remember.</p>

                {keyTakeaways.length === 0 ? (
                  <p className="text-sm text-gray italic mb-2">No key takeaways added yet.</p>
                ) : (
                  <div className="objectives-list">
                    {keyTakeaways.map((kt, i) => (
                      <div key={i} className="objective-item">
                        <span className="text-sm text-gray font-bold">✓</span>
                        <input
                          type="text"
                          className="form-input"
                          value={kt}
                          onChange={(e) => handleTakeawayChange(i, e.target.value)}
                          placeholder={`e.g. If statements evaluate boolean conditions.`}
                        />
                        <button type="button" className="objective-remove-btn" onClick={() => handleRemoveTakeaway(i)} title="Remove">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* SECTION 4: LEARNING CONTENT BLOCKS */}
            <div className="editor-section">
              <div className="editor-section-header">
                <span className="editor-section-title">📄 4. Learning Content ({contents.length} Blocks)</span>
                {!showTypePicker && !editingContent && (
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => setShowTypePicker(true)} id="add-content-editor-btn">
                    + Add Content Block
                  </button>
                )}
              </div>
              <div className="editor-section-body">
                {/* Content Type Picker Cards */}
                {showTypePicker && !selectedAddType && (
                  <div style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-bold" style={{ color: 'var(--gray-800)' }}>Select Content Type to Add:</span>
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => setShowTypePicker(false)}>Cancel</button>
                    </div>

                    <div className="content-type-picker">
                      <div className="content-type-card" onClick={() => setSelectedAddType('TEXT')} id="select-type-text">
                        <div className="content-type-card-icon">📄</div>
                        <div className="content-type-card-label">Text / Lesson</div>
                        <div className="content-type-card-desc">Markdown or formatted text lesson</div>
                      </div>

                      <div className="content-type-card" onClick={() => setSelectedAddType('VIDEO')} id="select-type-video">
                        <div className="content-type-card-icon">🎥</div>
                        <div className="content-type-card-label">Video / Embed</div>
                        <div className="content-type-card-icon-sub">YouTube, Vimeo, or MP4</div>
                      </div>

                      <div className="content-type-card" onClick={() => setSelectedAddType('EMBED')} id="select-type-link">
                        <div className="content-type-card-icon">🔗</div>
                        <div className="content-type-card-label">Resource / Link</div>
                        <div className="content-type-card-desc">External documentation or link</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Add Content Editor Form */}
                {selectedAddType && (
                  <ContentEditor
                    moduleId={module.id}
                    initialType={selectedAddType}
                    initialOrder={contents.length + 1}
                    onSaved={() => {
                      setSelectedAddType(null);
                      setShowTypePicker(false);
                      loadData();
                    }}
                    onCancel={() => {
                      setSelectedAddType(null);
                      setShowTypePicker(false);
                    }}
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

                {/* Existing Content Item List */}
                {contents.length === 0 && !showTypePicker && !selectedAddType && !editingContent ? (
                  <EmptyState
                    icon="📄"
                    title="No Content Blocks"
                    text="Add text lessons, video embeds, or external resources for students to study."
                    action={
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowTypePicker(true)}>
                        + Add First Content Block
                      </button>
                    }
                  />
                ) : (
                  contents.map((c, idx) => (
                    <div key={c.id} className="content-item-row">
                      <div className="content-item-number">{c.content_order || idx + 1}</div>

                      <div className="content-item-info">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={c.content_type === 'VIDEO' ? 'primary' : 'gray'}>
                            {c.content_type === 'VIDEO' ? '🎥 Video' : '📄 Text'}
                          </Badge>
                          <span className="content-item-title">{c.title || `Block #${idx + 1}`}</span>
                        </div>
                        <div className="content-item-subtitle">{c.content}</div>
                      </div>

                      <div className="content-item-actions">
                        <button
                          type="button"
                          className="content-reorder-btn"
                          onClick={() => handleMoveContent(c, 'up')}
                          disabled={idx === 0}
                          title="Move Up"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          className="content-reorder-btn"
                          onClick={() => handleMoveContent(c, 'down')}
                          disabled={idx === contents.length - 1}
                          title="Move Down"
                        >
                          ▼
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => setEditingContent(c)}
                          id={`edit-content-btn-${c.id}`}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => setDeletingContentId(c.id)}
                          id={`delete-content-btn-${c.id}`}
                        >
                          Delete
                        </button>
                      </div>

                      {deletingContentId === c.id && (
                        <ConfirmModal
                          title="Delete Content Block"
                          message="Are you sure you want to delete this content block? This action cannot be undone."
                          onConfirm={() => handleDeleteContent(c.id)}
                          onCancel={() => setDeletingContentId(null)}
                          danger
                        />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* SECTION 5: MODULE ASSESSMENT / QUIZ */}
            <div className="editor-section">
              <div className="editor-section-header">
                <span className="editor-section-title">📝 5. Module Assessment (Quiz)</span>
              </div>
              <div className="editor-section-body">
                {showQuizEditor ? (
                  <QuizBuilder
                    moduleId={module.id}
                    quiz={quiz}
                    onQuizCreated={() => { setShowQuizEditor(false); loadData(); }}
                    onQuizUpdated={() => { setShowQuizEditor(false); loadData(); }}
                    onCancel={() => setShowQuizEditor(false)}
                  />
                ) : (
                  <div className="quiz-status-card">
                    <div className="quiz-status-info">
                      <span className="quiz-status-icon">{quiz ? '✅' : '⚪'}</span>
                      <div>
                        <div className="quiz-status-label">
                          {quiz ? quiz.title : 'Quiz not configured'}
                        </div>
                        <div className="quiz-status-sub">
                          {quiz
                            ? `${quiz.questions?.length ?? 0} Questions • Pass mark: ${quiz.passing_score}% • Status: Configured`
                            : 'Students complete this module directly without a quiz.'}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => setShowQuizEditor(true)}
                      id="configure-quiz-btn"
                    >
                      {quiz ? '✏️ Edit Quiz' : '+ Create Quiz'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="editor-footer">
              <div className="editor-footer-left">
                <Link to={`/admin/courses/${courseId}`} className="btn btn-outline">← Back to Course</Link>
                <button type="button" className="btn btn-outline" onClick={() => setIsPreviewMode(true)}>👁 Preview</button>
              </div>

              <div className="editor-footer-right">
                <button type="button" className="btn btn-outline" onClick={handleSaveDraft} disabled={saving}>
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
        )}

        {/* Publish Modal Checklist */}
        {showPublishModal && (
          <Modal
            title="Publish Module"
            onClose={() => setShowPublishModal(false)}
            footer={
              <>
                <button type="button" className="btn btn-outline" onClick={() => setShowPublishModal(false)}>Cancel</button>
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
            <p className="text-sm text-gray mb-4">Review the publication requirements before making this module visible to students:</p>

            <div className="publish-checklist">
              {checklist.map((item, idx) => (
                <div key={idx} className={`publish-checklist-item ${item.pass ? 'pass' : 'fail'}`}>
                  <span className="publish-checklist-icon">{item.pass ? '✓' : '⚠️'}</span>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>

            {!canPublish && (
              <Alert type="warning">
                Please complete the missing items before publishing this module.
              </Alert>
            )}
          </Modal>
        )}

        {/* Confirm Delete Module Modal */}
        {confirmDeleteMod && (
          <ConfirmModal
            title="Delete Module"
            message={`Are you sure you want to delete "${title}"? Associated content and quiz must be deleted first.`}
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
