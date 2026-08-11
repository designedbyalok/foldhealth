import { useEffect, useRef, useState } from 'react';
import { Icon } from '../Icon/Icon';
import { Button } from '../Button/Button';
import { CloseButton } from '../CloseButton/CloseButton';
import styles from './DocumentUploader.module.css';

/**
 * Inline document uploader — a reusable, store-agnostic version of the widget
 * first built for the HCC Diagnosis panel (Figma 278:162482).
 *
 * Three-phase flow:
 *   • empty     → dashed drop-zone with "Choose file"
 *   • uploading → file row with name + size + green progress bar + X cancel
 *   • ready     → file row with refresh/X + Caption (pre-filled with the file
 *                 name) + Document Category / Document Status dropdowns
 *
 * The component owns only the pick/upload/form UI. On "Upload" it calls
 * `onSubmit({ file, caption, category, status })`; the caller decides how to
 * persist and list the document. "Cancel" (and the X in an empty state) calls
 * `onCancel`.
 *
 * Props:
 *  - onSubmit    (fn)        Called with { file, caption, category, status }
 *  - onCancel    (fn)        Called when the user cancels
 *  - categories  (string[])  Document Category options
 *  - statuses    ({label,value}[])  Document Status options (value is stored)
 *  - maxBytes    (number)    Reject files larger than this (default 5 MB)
 *  - accept      (string)    File input `accept` attribute
 */
const DEFAULT_ACCEPT = '.pdf,.doc,.docx,.png,.jpg,.csv,.xls,.xlsx';
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_CATEGORIES = ['Discharge Summary', 'Consult Note', 'Lab Report', 'Imaging', 'Chart', 'Physical Therapy'];
const DEFAULT_STATUSES = [
  { label: 'Pass', value: 'Passed' },
  { label: 'Fail', value: 'Failed' },
];

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function extFromName(name = '') {
  const m = name.match(/\.([a-z0-9]+)$/i);
  return (m?.[1] || '').toLowerCase();
}

export function DocumentUploader({
  onSubmit,
  onCancel,
  categories = DEFAULT_CATEGORIES,
  statuses = DEFAULT_STATUSES,
  maxBytes = DEFAULT_MAX_BYTES,
  accept = DEFAULT_ACCEPT,
}) {
  const inputRef = useRef(null);

  // empty | uploading | ready
  const [phase, setPhase] = useState('empty');
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState('');
  const [docStatus, setDocStatus] = useState(statuses[0]?.value);
  const [category, setCategory] = useState(categories[0]);
  const [caption, setCaption] = useState('');

  // Simulated upload — progress 0→100 in ~1.2s, then phase='ready'.
  useEffect(() => {
    if (phase !== 'uploading') return undefined;
    let p = 0;
    const id = setInterval(() => {
      p += 8 + Math.random() * 14;
      setProgress(p >= 100 ? 100 : p);
      if (p >= 100) clearInterval(id);
    }, 80);
    return () => clearInterval(id);
  }, [phase]);

  // The hand-off to 'ready' lives in its own effect so its timer is created and
  // cleared in the same scope — spawned inside the interval callback above, it
  // outlived the effect's cleanup and could fire after unmount.
  useEffect(() => {
    if (phase !== 'uploading' || progress < 100) return undefined;
    const t = setTimeout(() => setPhase('ready'), 120);
    return () => clearTimeout(t);
  }, [phase, progress]);

  const reset = () => {
    setFile(null); setProgress(0); setError(''); setCaption('');
    setDocStatus(statuses[0]?.value); setCategory(categories[0]);
    setPhase('empty');
  };
  const startUpload = (f) => {
    if (!f) return;
    if (f.size > maxBytes) { setError(`File exceeds ${formatBytes(maxBytes)}.`); return; }
    // Pre-fill the caption with the file name — but never clobber a caption
    // the user already typed (swapping files updates an auto-filled one).
    setCaption(prev => (!prev.trim() || prev === file?.name) ? f.name : prev);
    setError(''); setFile(f); setProgress(0); setPhase('uploading');
  };
  const pick = () => inputRef.current?.click();
  const onPicked = (e) => { startUpload(e.target.files?.[0]); e.target.value = ''; };
  const onDrop = (e) => { e.preventDefault(); setDrag(false); startUpload(e.dataTransfer.files?.[0]); };

  const canSubmit = phase === 'ready' && file && caption.trim();
  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit?.({ file, caption: caption.trim(), category, status: docStatus });
    reset();
  };
  const handleCancel = () => { reset(); onCancel?.(); };

  return (
    <div className={styles.uploader}>
      <div className={styles.header}>Upload Document</div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className={styles.dropInput}
        onChange={onPicked}
      />

      {phase === 'empty' && (
        <>
          <label
            className={[styles.dropZone, drag ? styles.dropZoneActive : ''].join(' ')}
            onDragEnter={(e) => { e.preventDefault(); setDrag(true); }}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            onClick={pick}
          >
            <Icon name="solar:upload-minimalistic-linear" size={20} color="var(--neutral-300)" />
            <span className={styles.dropText}>
              Drag and drop file here or{' '}
              <button type="button" className={styles.dropChoose} onClick={(e) => { e.stopPropagation(); pick(); }}>
                Choose file
              </button>
            </span>
          </label>
          <div className={styles.meta}>
            <span>Supported formats: PDF, DOC, DOCX, PNG, JPG, CSV, XLS, XLSX</span>
            <span>Max size: {formatBytes(maxBytes)}</span>
          </div>
        </>
      )}

      {(phase === 'uploading' || phase === 'ready') && (
        <FileRow
          file={file}
          phase={phase}
          progress={progress}
          onRefresh={() => { setProgress(0); setPhase('uploading'); }}
          onRemove={reset}
        />
      )}

      {phase === 'ready' && (
        <div className={styles.form}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>
              Caption <span className={styles.required}>•</span>
            </span>
            <input
              type="text"
              className={styles.input}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Document caption"
            />
          </label>
          <div className={styles.formRow}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Document Category</span>
              <select
                className={styles.select}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {categories.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Document Status</span>
              <select
                className={styles.select}
                value={docStatus}
                onChange={(e) => setDocStatus(e.target.value)}
              >
                {statuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
          </div>
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.actions}>
        <Button variant="primary" size="S" disabled={!canSubmit} onClick={handleSubmit}>
          Upload
        </Button>
        <Button variant="secondary" size="S" onClick={handleCancel}>Cancel</Button>
      </div>
    </div>
  );
}

// File-row sub-component used in both 'uploading' (with progress bar + X) and
// 'ready' (with refresh + X) phases.
function FileRow({ file, phase, progress, onRefresh, onRemove }) {
  if (!file) return null;
  const ext = (extFromName(file.name) || 'doc').toUpperCase().slice(0, 4);
  return (
    <div className={styles.fileRowWrap}>
      <div className={styles.fileRow}>
        <span className={styles.extIcon}>
          <Icon name="solar:file-text-linear" size={14} color="var(--neutral-300)" />
          <span className={styles.extTag}>{ext === 'JPG' || ext === 'PNG' ? 'IMG' : ext}</span>
        </span>
        <div className={styles.fileRowText}>
          <div className={styles.fileRowName}>{file.name}</div>
          <div className={styles.fileRowSize}>{formatBytes(file.size)}</div>
        </div>
        <div className={styles.fileRowActions}>
          {phase === 'ready' && (
            <button type="button" className={styles.fileRowIconBtn} onClick={onRefresh} aria-label="Re-upload">
              <Icon name="solar:refresh-circle-linear" size={16} color="var(--neutral-300)" />
            </button>
          )}
          <span className={styles.fileRowDivider} />
          <CloseButton size={14} onClick={onRemove} className={styles.fileRowIconBtn} label="Remove" />
        </div>
      </div>
      {phase === 'uploading' && (
        <div className={styles.progressTrack}>
          <div className={styles.progressBar} style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}
