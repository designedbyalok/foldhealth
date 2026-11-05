import { useState } from 'react';
import { useNativeDialog } from '../../hooks/useNativeDialog';
import { Icon } from '../Icon/Icon';
import { FilePreview } from '../FilePreview/FilePreview';
import { resolveFileKind } from '../FilePreview/FilePreview.utils';
import { parseStorageUrl, signStorageUrl } from '../../lib/storageUrl';
import styles from './ImagePreviewOverlay.module.css';

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.25;

/**
 * Full-bleed lightbox for a document: dark toolbar (filename, zoom,
 * download, close) over an 80% black scrim. Zoom applies to images only
 * (a PDF/docx/fallback render fills the frame on its own via FilePreview).
 *
 * @param {object}      props
 * @param {object}      props.doc      – { name, ext, fileUrl, file }
 * @param {() => void}  props.onClose
 */
export function ImagePreviewOverlay({ doc, onClose }) {
  const dialogRef = useNativeDialog(!!doc);
  const [zoom, setZoom] = useState(1);
  const { name, ext, fileUrl, file } = doc || {};
  const kind = resolveFileKind({ src: fileUrl, name, ext });
  const isImage = kind === 'image';

  const zoomOut = () => setZoom(z => Math.max(ZOOM_MIN, z - ZOOM_STEP));
  const zoomIn = () => setZoom(z => Math.min(ZOOM_MAX, z + ZOOM_STEP));

  const handleDownload = async () => {
    let href = fileUrl || (file ? URL.createObjectURL(file) : null);
    if (!href) return;
    // A private patient file downloads through a signed URL. `download` on
    // the link is ignored cross-origin, so Storage's own download param
    // sets the attachment filename instead.
    if (parseStorageUrl(fileUrl)) {
      try {
        href = `${await signStorageUrl(fileUrl)}&download=${encodeURIComponent(name || 'document')}`;
      } catch (err) {
        console.warn('[ImagePreviewOverlay] could not sign the file URL:', err?.message || err);
        return;
      }
    }
    const a = document.createElement('a');
    a.href = href;
    a.download = name || 'document';
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (!fileUrl) URL.revokeObjectURL(href);
  };

  if (!doc) return null;

  return (
    <dialog
      ref={dialogRef}
      className={styles.backdrop}
      aria-label={name}
      onCancel={(e) => { e.preventDefault(); onClose?.(); }}
    >
      <div className={styles.header} onClick={(e) => e.stopPropagation()}>
        <span className={styles.title}>{name}</span>
        <div className={styles.headerActions}>
          {isImage && (
            <>
              <button type="button" className={styles.iconBtn} onClick={zoomOut} disabled={zoom <= ZOOM_MIN} aria-label="Zoom out">
                <Icon name="solar:magnifer-zoom-out-linear" size={18} color="var(--media-viewer-chrome-fg)" />
              </button>
              <button type="button" className={styles.iconBtn} onClick={zoomIn} disabled={zoom >= ZOOM_MAX} aria-label="Zoom in">
                <Icon name="solar:magnifer-zoom-in-linear" size={18} color="var(--media-viewer-chrome-fg)" />
              </button>
              <span className={styles.divider} />
            </>
          )}
          <button type="button" className={styles.iconBtn} onClick={handleDownload} aria-label="Download">
            <Icon name="solar:download-minimalistic-linear" size={18} color="var(--media-viewer-chrome-fg)" />
          </button>
        </div>
        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close preview">
          <Icon name="solar:close-circle-linear" size={22} color="var(--media-viewer-chrome-fg)" />
        </button>
      </div>
      <div className={styles.body} onClick={(e) => e.stopPropagation()}>
        <div className={styles.mediaWrap} style={isImage ? { transform: `scale(${zoom})` } : undefined}>
          <FilePreview src={fileUrl} file={file} name={name} ext={ext} className={styles.media} />
        </div>
      </div>
    </dialog>
  );
}
