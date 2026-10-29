import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { BlobImage } from './AttachmentStrip';
import { CloseIcon, PenIcon } from './icons';
import { openModal } from './modal';

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
  const dialog = useRef(null);

  // A click on the backdrop (the dialog itself, outside its content) closes
  // the preview: a mouse shortcut alongside Escape and the close button.
  useEffect(() => {
    const d = dialog.current;
    if (!d) return undefined;
    const onClick = (e) => { if (e.target === d) onClose(); };
    d.addEventListener('click', onClick);
    return () => d.removeEventListener('click', onClick);
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
    // A native modal dialog: focus stays inside and Escape closes it.
    <dialog
      ref={(el) => { dialog.current = el; openModal(el); }}
      className="rk-preview"
      aria-label={labels.preview(name)}
      onClose={onClose}
    >
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
    </dialog>
  );
}
