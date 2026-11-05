import { useRef, useState } from 'react';
import { Icon } from '../Icon/Icon';
import styles from './Dropzone.module.css';

/**
 * Shared file-upload dropzone.
 *
 * Encapsulates: the drag-over visual state, the "Drag and drop file here
 * or **Choose file**" label, the hidden `<input type="file">`, MIME +
 * extension validation, and the supporting-formats helper row below.
 *
 * Pass MIME types via `acceptMime` (Set or array) for the runtime check
 * the browser can't be trusted to enforce; `accept` is the input attr
 * the browser uses to filter the picker.
 *
 * Both `helperText` (left) and `secondaryText` (right) render in a flex
 * row 4px below the drop area. Omit either to hide that side.
 */
export function Dropzone({
  accept,
  acceptMime,
  multiple = false,
  disabled = false,
  icon = 'solar:upload-minimalistic-linear',
  iconSize = 24,
  helperText,
  secondaryText,
  onPick,
  onReject,
  className,
}) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef(null);

  const mimeSet = acceptMime instanceof Set
    ? acceptMime
    : new Set(acceptMime || []);

  const isAccepted = (file) => {
    if (!file) return false;
    if (mimeSet.size === 0) return true;
    if (mimeSet.has(file.type)) return true;
    // Some browsers report an empty MIME for drag-drop from certain sources,
    // fall back to extension matching against the `accept` attr.
    if (!accept) return false;
    const exts = accept.split(',').map(s => s.trim().toLowerCase().replace(/^\./, ''));
    const m = (file.name || '').match(/\.([a-z0-9]+)$/i);
    return !!m && exts.includes(m[1].toLowerCase());
  };

  const handleFiles = (fileList) => {
    if (!fileList || !fileList.length) return;
    const files = multiple ? Array.from(fileList) : [fileList[0]];
    const accepted = files.filter(isAccepted);
    const rejected = files.filter(f => !isAccepted(f));
    if (rejected.length && onReject) onReject(rejected);
    if (!accepted.length) return;
    if (multiple) onPick?.(accepted);
    else onPick?.(accepted[0]);
  };

  return (
    <div className={[styles.block, className || ''].join(' ')}>
      <label
        className={[styles.zone, drag ? styles.zoneActive : '', disabled ? styles.zoneDisabled : ''].join(' ')}
        onDragOver={(e) => { if (!disabled) { e.preventDefault(); setDrag(true); } }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          if (disabled) return;
          e.preventDefault();
          setDrag(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        <Icon name={icon} size={iconSize} color="var(--neutral-300)" />
        <div className={styles.cta}>
          <span className={styles.title}>Drag and drop file here or</span>
          <span className={styles.link}>Choose file</span>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          className={styles.input}
          onChange={(e) => {
            handleFiles(e.target.files);
            // Reset so picking the same file twice still fires onChange.
            if (inputRef.current) inputRef.current.value = '';
          }}
        />
      </label>

      {(helperText || secondaryText) && (
        <div className={styles.formats}>
          {helperText && <span>{helperText}</span>}
          {secondaryText && <span>{secondaryText}</span>}
        </div>
      )}
    </div>
  );
}
