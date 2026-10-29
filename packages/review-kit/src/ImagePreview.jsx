import { lazy, Suspense, useEffect, useState } from 'react';
import { BlobImage } from './AttachmentStrip';
import { CloseIcon, PenIcon } from './icons';

// The annotator (Konva canvas) is large, so it loads only when
// someone chooses Annotate.
const Annotator = lazy(() => import('./Annotator'));

/**
 * One attachment, full size, over the page. Annotate opens it in an editor
 * (arrows, shapes, pen, text, crop); saving replaces the attachment with the
 * marked-up image.
 */
export function ImagePreview({ attachment, name, labels, onAnnotated, onClose }) {
  const [annotating, setAnnotating] = useState(false);

  useEffect(() => {
    if (annotating) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [annotating, onClose]);

  if (annotating) {
    return (
      <Suspense fallback={<div className="rk-modal-backdrop"><p className="rk-annotator-loading">{labels.annotateLoading}</p></div>}>
        <Annotator
          file={attachment.file}
          name={name}
          labels={labels}
          onCancel={() => setAnnotating(false)}
          onSave={(file) => { onAnnotated(file); setAnnotating(false); }}
        />
      </Suspense>
    );
  }

  return (
    <div className="rk-modal-backdrop" onClick={onClose} role="presentation">
      <div className="rk-preview" role="dialog" aria-modal="true" aria-label={labels.preview(name)} onClick={e => e.stopPropagation()}>
        <header className="rk-preview-header">
          <span className="rk-preview-name" title={name}>{name}</span>
          <button type="button" className="rk-tool rk-preview-annotate" onClick={() => setAnnotating(true)}>
            <PenIcon />
            <span>{labels.annotate}</span>
          </button>
          <button type="button" className="rk-icon-btn" onClick={onClose} aria-label={labels.closePreview} title={labels.closePreview}>
            <CloseIcon />
          </button>
        </header>
        <div className="rk-preview-body">
          <BlobImage file={attachment.file} alt={name} />
        </div>
      </div>
    </div>
  );
}
