import React, { useState, useEffect, useRef } from 'react';
import { Modal, Alert, Spinner } from '../ui';
import { createModule } from '../../services/api';

/**
 * Simple, fast Add Module Modal.
 * Clean, lightweight form for adding modules to a course without any wizard or slide complexity.
 */
export default function ModuleWizardModal({
  isOpen,
  courseId,
  defaultOrder = 1,
  onClose,
  onCreated,
  onNavigateToEditor,
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [moduleOrder, setModuleOrder] = useState(defaultOrder);
  const [isPublished, setIsPublished] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [lastCreatedTitle, setLastCreatedTitle] = useState('');

  const titleInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setDescription('');
      setModuleOrder(defaultOrder);
      setIsPublished(false);
      setError('');
      setLastCreatedTitle('');
      setTimeout(() => titleInputRef.current?.focus(), 100);
    }
  }, [isOpen, defaultOrder]);

  if (!isOpen) return null;

  const handleCreate = async (shouldAddAnother = false) => {
    if (!title.trim()) {
      setError('Module title is required.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await createModule(
        Number(courseId),
        title.trim(),
        description.trim(),
        Number(moduleOrder) || 1,
        { isPublished }
      );

      const createdModule = res.module;
      const createdTitle = title.trim();

      if (shouldAddAnother) {
        setLastCreatedTitle(createdTitle);
        setTitle('');
        setDescription('');
        setModuleOrder((prev) => prev + 1);
        setIsPublished(false);
        if (onCreated) onCreated(createdModule, 'add_another');
        setTimeout(() => titleInputRef.current?.focus(), 50);
      } else {
        if (onCreated) onCreated(createdModule, 'close');
        if (onNavigateToEditor) onNavigateToEditor(createdModule);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to create module.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Add New Module"
      onClose={onClose}
      maxWidth="540px"
      footer={
        <div className="flex items-center justify-between w-full">
          <button
            type="button"
            className="btn btn-outline"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => handleCreate(true)}
              disabled={submitting}
              id="create-add-another-btn"
            >
              {submitting ? <Spinner /> : '+ Create & Add Another'}
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleCreate(false)}
              disabled={submitting}
              id="create-open-editor-btn"
            >
              {submitting ? <Spinner /> : 'Create Module'}
            </button>
          </div>
        </div>
      }
    >
      <p className="text-xs text-gray mb-4">
        Enter the details for this module. You can add lessons, videos, and quizzes after creation.
      </p>

      {lastCreatedTitle && (
        <Alert type="success" onClose={() => setLastCreatedTitle('')}>
          ✓ Created &quot;{lastCreatedTitle}&quot;! You can add another module now.
        </Alert>
      )}

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleCreate(false);
        }}
        noValidate
      >
        <div className="form-group">
          <label className="form-label" htmlFor="quick-m-title">
            Module Title *
          </label>
          <input
            id="quick-m-title"
            ref={titleInputRef}
            type="text"
            className="form-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Introduction to Python"
            required
            disabled={submitting}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="quick-m-desc">
            Description
          </label>
          <textarea
            id="quick-m-desc"
            className="form-textarea"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of module contents..."
            disabled={submitting}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="form-group mb-0" style={{ width: 140 }}>
            <label className="form-label" htmlFor="quick-m-order">
              Module Order #
            </label>
            <input
              id="quick-m-order"
              type="number"
              className="form-input"
              min={1}
              value={moduleOrder}
              onChange={(e) => setModuleOrder(Number(e.target.value))}
              disabled={submitting}
            />
          </div>

          <div className="form-group mb-0 flex items-center mt-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold">
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                disabled={submitting}
              />
              Publish immediately
            </label>
          </div>
        </div>
      </form>
    </Modal>
  );
}
