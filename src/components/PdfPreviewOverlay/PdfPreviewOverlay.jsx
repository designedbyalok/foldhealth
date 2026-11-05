import { useEffect, useState } from 'react';
import { useNativeDialog } from '../../hooks/useNativeDialog';
import { Icon } from '../Icon/Icon';
import styles from './PdfPreviewOverlay.module.css';

/**
 * Full-screen overlay that previews a PDF Blob in an iframe.
 *
 * The browser renders the PDF natively via a blob: URL, no pdfjs-dist
 * canvas rendering needed for a basic viewer. Download button is provided
 * for users who want a local copy.
 *
 * @param {object}      props
 * @param {Blob}        props.blob      – PDF blob to display
 * @param {string}      [props.filename]– Filename shown in header + download
 * @param {() => void}  props.onClose   – Called when the user dismisses the overlay
 */
export function PdfPreviewOverlay({ blob, filename = 'document.pdf', onClose }) {
  const dialogRef = useNativeDialog();
  const [url, setUrl] = useState(null);

  // Manage the blob URL lifecycle. createObjectURL leaks if not revoked.
  useEffect(() => {
    if (!blob) return;
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);

  const handleDownload = () => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <dialog
      ref={dialogRef}
      className={styles.backdrop}
      aria-label={filename}
      onCancel={(e) => { e.preventDefault(); onClose?.(); }}
    >
      <div className={styles.frame} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <Icon name="solar:document-linear" size={16} color="var(--neutral-300)" />
          <span className={styles.title}>{filename}</span>
          <div className={styles.headerActions}>
            <button type="button" className={styles.iconBtn} onClick={handleDownload} aria-label="Download PDF">
              <Icon name="solar:download-minimalistic-linear" size={16} color="var(--neutral-400)" />
            </button>
            <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Close preview">
              <Icon name="solar:close-linear" size={16} color="var(--neutral-400)" />
            </button>
          </div>
        </div>
        {url ? (
          <iframe className={styles.iframe} src={url} title={filename} />
        ) : (
          <div className={styles.empty}>Loading preview…</div>
        )}
      </div>
    </dialog>
  );
}
