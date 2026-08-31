import { useState, useEffect } from 'react';
import { createTrainingContent, updateTrainingContent } from '../services/api';
import { Alert, Spinner } from './ui';

// Utility helper for Video / Embed URL parsing and security validation
export function parseEmbedUrl(url) {
  if (!url || typeof url !== 'string') return { type: 'invalid', embedUrl: null };
  const trimmed = url.trim();

  // YouTube
  const ytMatch = trimmed.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^&\s?#]+)/);
  if (ytMatch && ytMatch[1]) {
    return {
      type: 'youtube',
      embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}`,
      providerName: 'YouTube',
    };
  }

  // Vimeo
  const vimeoMatch = trimmed.match(/(?:vimeo\.com\/(?:video\/)?)([^&\s?#]+)/);
  if (vimeoMatch && vimeoMatch[1] && /^\d+$/.test(vimeoMatch[1])) {
    return {
      type: 'vimeo',
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
      providerName: 'Vimeo',
    };
  }

  // Direct MP4 / WebM / OGG video URL
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(trimmed)) {
    return {
      type: 'direct_video',
      embedUrl: trimmed,
      providerName: 'Direct Video File',
    };
  }

  // Generic HTTP/HTTPS URL
  if (/^https?:\/\//i.test(trimmed)) {
    return {
      type: 'external_link',
      embedUrl: trimmed,
      providerName: 'External Link',
    };
  }

  return { type: 'invalid', embedUrl: null };
}

export default function ContentEditor({ moduleId, existingContent, initialType = 'TEXT', initialOrder = 1, onSaved, onCancel }) {
  const isEditMode = !!existingContent;

  const [title, setTitle] = useState(existingContent?.title ?? '');
  const [contentType, setContentType] = useState(existingContent?.content_type ?? initialType); // TEXT, VIDEO, EMBED
  const [content, setContent] = useState(existingContent?.content ?? '');
  const [contentOrder, setContentOrder] = useState(existingContent?.content_order ?? initialOrder);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (existingContent) {
      setTitle(existingContent.title ?? '');
      setContentType(existingContent.content_type ?? 'TEXT');
      setContent(existingContent.content ?? '');
      setContentOrder(existingContent.content_order ?? initialOrder);
    }
  }, [existingContent?.id]);

  const parsed = parseEmbedUrl(content);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!content.trim()) {
      setError(contentType === 'TEXT' ? 'Lesson text content cannot be empty.' : 'Resource URL cannot be empty.');
      return;
    }

    // Backend accepts content_type as 'TEXT' or 'VIDEO'
    const backendType = contentType === 'TEXT' ? 'TEXT' : 'VIDEO';

    setSaving(true);
    try {
      if (isEditMode) {
        await updateTrainingContent(moduleId, existingContent.id, {
          contentType: backendType,
          title: title.trim(),
          content: content.trim(),
          contentOrder: Number(contentOrder),
        });
      } else {
        await createTrainingContent(
          moduleId,
          backendType,
          title.trim(),
          content.trim(),
          Number(contentOrder)
        );
      }
      if (onSaved) onSaved();
    } catch (err) {
      setError(err.message || 'Failed to save content');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={styles.card}>
      <h4 style={styles.title}>
        {isEditMode ? '✏️ Edit Content Block' : '➕ Add Content Block'}
      </h4>

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label className="form-label" htmlFor="content-title-input">Content Title / Heading</label>
          <input
            id="content-title-input"
            type="text"
            className="form-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Introduction to Control Flow, Demo Video, Reference Docs"
            disabled={saving}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="content-type-select">Content Type</label>
            <select
              id="content-type-select"
              className="form-select"
              value={contentType}
              onChange={(e) => setContentType(e.target.value)}
              disabled={saving}
            >
              <option value="TEXT">📄 Text / Lesson Content</option>
              <option value="VIDEO">🎥 Embedded Video (YouTube / Vimeo / MP4)</option>
              <option value="EMBED">🔗 External Link / Resource</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="content-order-input">Sequence Order</label>
            <input
              id="content-order-input"
              type="number"
              className="form-input"
              value={contentOrder}
              onChange={(e) => setContentOrder(Number(e.target.value))}
              min={1}
              required
              disabled={saving}
            />
          </div>
        </div>

        {/* TEXT TYPE */}
        {contentType === 'TEXT' && (
          <div className="form-group">
            <label className="form-label" htmlFor="text-content-input">Lesson Content (Markdown / Text) *</label>
            <textarea
              id="text-content-input"
              className="form-textarea"
              style={{ minHeight: 160 }}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter lesson text, key concepts, explanations, or code examples..."
              required
              disabled={saving}
            />
            <span className="form-hint">Paragraphs and line breaks will be rendered cleanly for students.</span>
          </div>
        )}

        {/* VIDEO / EMBED TYPE */}
        {(contentType === 'VIDEO' || contentType === 'EMBED') && (
          <div className="form-group">
            <label className="form-label" htmlFor="url-content-input">
              {contentType === 'VIDEO' ? 'Video URL (YouTube, Vimeo, or MP4) *' : 'Resource URL *'}
            </label>
            <input
              id="url-content-input"
              type="url"
              className="form-input"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={contentType === 'VIDEO' ? 'https://www.youtube.com/watch?v=...' : 'https://example.com/docs'}
              required
              disabled={saving}
            />

            {/* LIVE PREVIEW / SECURITY FEEDBACK */}
            {content.trim() && (
              <div style={styles.previewBox}>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--gray-600)', marginBottom: 'var(--space-2)' }}>
                  Live Content Preview:
                </div>

                {parsed.type === 'youtube' || parsed.type === 'vimeo' ? (
                  <div style={styles.videoEmbedWrapper}>
                    <iframe
                      title="Video Preview"
                      src={parsed.embedUrl}
                      style={styles.iframe}
                      allowFullScreen
                    />
                  </div>
                ) : parsed.type === 'direct_video' ? (
                  <video controls src={parsed.embedUrl} style={{ width: '100%', maxHeight: 240, borderRadius: 'var(--radius)' }} />
                ) : parsed.type === 'external_link' ? (
                  <div className="alert alert-info mb-0">
                    ℹ️ External resource link will open safely in a new tab for students.
                  </div>
                ) : (
                  <div className="alert alert-warning mb-0">
                    ⚠️ Please enter a valid HTTP/HTTPS URL.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 justify-end mt-4">
          {onCancel && (
            <button type="button" className="btn btn-outline" onClick={onCancel} disabled={saving}>
              Cancel
            </button>
          )}
          <button type="submit" className="btn btn-primary" disabled={saving} id="save-content-btn">
            {saving ? <Spinner /> : isEditMode ? '💾 Update Block' : '💾 Save Block'}
          </button>
        </div>
      </form>
    </div>
  );
}

const styles = {
  card: {
    background: 'var(--gray-50)',
    border: '1px solid var(--gray-200)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-5)',
    marginBottom: 'var(--space-4)',
  },
  title: {
    fontSize: 'var(--font-size-base)',
    fontWeight: 600,
    color: 'var(--gray-900)',
    marginBottom: 'var(--space-4)',
  },
  previewBox: {
    marginTop: 'var(--space-3)',
    padding: 'var(--space-3)',
    background: '#fff',
    border: '1px solid var(--gray-200)',
    borderRadius: 'var(--radius)',
  },
  videoEmbedWrapper: {
    position: 'relative',
    paddingBottom: '56.25%',
    height: 0,
    overflow: 'hidden',
    borderRadius: 'var(--radius)',
  },
  iframe: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    border: 'none',
  },
};
