import { useEffect, useRef, useState } from 'react';
import { Icon } from '../Icon/Icon';
import { Dropzone } from '../Dropzone/Dropzone';
import styles from './UploadDropField.module.css';

/**
 * UploadDropField — the shared HCC document upload field with three states:
 *   Dropzone → uploading progress card → uploaded file card.
 *
 * Used by both the Upload Document drawer and the Document Available details
 * drawer so the upload interaction is identical. Calls `onChange(file)` once
 * the (simulated) upload completes and `onChange(null)` while uploading or
 * when the file is cleared. Remount with a new `key` to reset it.
 *
 * When `onPreview` is provided, the uploaded card renders an eye button
 * (and a hairline divider) BEFORE the delete action so callers can open
 * an inline preview of the freshly uploaded file.
 *
 * @param {object}   props
 * @param {(file: File|null) => void} props.onChange
 * @param {(file: File) => void} [props.onPreview]
 */
export function UploadDropField({
  onChange,
  onPreview,
  accept = '.pdf,.doc,.docx,.jpg,.jpeg,.png',
  helperText = 'Supported formats: PDF, DOC, JPG, or PNG',
  secondaryText = 'Max size: 100 MB',
  initialFile = null,
}) {
  const [file, setFile] = useState(null);
  const [proc, setProc] = useState(null); // null | { name, sizeLabel, progress }
  const [done, setDone] = useState(false);

  // Keep the latest onChange without retriggering the progress effect.
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });

  // Host-provided file (e.g. dropped onto the parent surface before the drawer
  // opened). Mirror the normal pick flow so the uploading → uploaded card
  // runs just like a drawer-local pick. Only fires on the initial file.
  const seededRef = useRef(false);
  useEffect(() => {
    if (!initialFile || seededRef.current) return;
    seededRef.current = true;
    setFile(initialFile);
    setDone(false);
    setProc({ name: initialFile.name, sizeLabel: `${(initialFile.size / 1e6).toFixed(1)}MB`, progress: 0 });
  }, [initialFile]);

  // Drive the fake upload progress (0→100), then flip to the uploaded state
  // and hand the file up to the parent.
  useEffect(() => {
    if (!proc) return undefined;
    if (proc.progress < 100) {
      const t = setTimeout(() => setProc(p => (p ? { ...p, progress: Math.min(100, p.progress + 12) } : p)), 100);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => { setProc(null); setDone(true); onChangeRef.current?.(file); }, 250);
    return () => clearTimeout(t);
  }, [proc, file]);

  const onPick = (f) => {
    setFile(f);
    setDone(false);
    onChangeRef.current?.(null);
    setProc({ name: f.name, sizeLabel: `${(f.size / 1e6).toFixed(1)}MB`, progress: 0 });
  };
  const clear = () => { setFile(null); setProc(null); setDone(false); onChangeRef.current?.(null); };

  if (proc) {
    return (
      <div className={styles.procCard}>
        <div className={styles.procRow}>
          <span className={styles.procIcon}>
            <Icon name="custom:pdf-file" size={18} color="var(--neutral-400)" />
          </span>
          <div className={styles.procMeta}>
            <div className={styles.procName}>{proc.name}</div>
            <div className={styles.procSub}>
              <span>{proc.sizeLabel}</span>
              <span>•</span>
              <span className={styles.procStatus}>
                <span className={styles.procSpin}><Icon name="solar:refresh-linear" size={13} /></span>
                Uploading...
              </span>
            </div>
          </div>
          <button type="button" className={styles.procCancel} onClick={clear} aria-label="Cancel upload">
            <Icon name="solar:close-circle-linear" size={16} color="var(--neutral-400)" />
          </button>
        </div>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ transform: `scaleX(${proc.progress / 100})` }} />
        </div>
      </div>
    );
  }

  if (done && file) {
    return (
      <div className={styles.uplCard}>
        <span className={styles.uplIcon}>
          <Icon name="custom:pdf-file" size={18} color="var(--primary-300)" />
        </span>
        <div className={styles.uplMeta}>
          <div className={styles.uplName}>{file.name}</div>
          <div className={styles.uplSub}>
            <span>{`${(file.size / 1e6).toFixed(1)}MB`}</span>
            <span>•</span>
            <span className={styles.uplDone}>
              <Icon name="solar:check-circle-bold" size={12} color="var(--status-success)" /> Uploaded just now
            </span>
          </div>
        </div>
        {onPreview && (
          <>
            <button
              type="button"
              className={styles.uplAction}
              onClick={() => onPreview(file)}
              aria-label="Preview file"
            >
              <Icon name="solar:eye-linear" size={15} color="var(--neutral-400)" />
            </button>
            <span className={styles.uplActionDivider} aria-hidden="true" />
          </>
        )}
        <button type="button" className={styles.uplAction} onClick={clear} aria-label="Remove file">
          <Icon name="solar:trash-bin-trash-linear" size={15} color="var(--neutral-400)" />
        </button>
      </div>
    );
  }

  return (
    <Dropzone
      accept={accept}
      helperText={helperText}
      secondaryText={secondaryText}
      icon="solar:upload-minimalistic-linear"
      onPick={onPick}
    />
  );
}
