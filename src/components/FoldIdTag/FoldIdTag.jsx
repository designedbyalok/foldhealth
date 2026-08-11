import { useEffect, useRef, useState } from 'react';
import { Tooltip } from '../Tooltip/Tooltip';
import { copyFoldId, formatFoldId } from '../../lib/foldId';
import styles from './FoldIdTag.module.css';

const COPIED_LABEL_MS = 1500;

/**
 * FoldIdTag — the clickable "#10070" Member ID shown on every worklist row.
 * Hover shows "Click to copy Member ID"; clicking copies it and swaps the
 * tooltip to "Copied: #10070" for a beat instead of firing a toast, so the
 * confirmation sits right where the user is already looking. The label swap
 * is remounted with a keyed span so it fades in — see FoldIdTag.module.css.
 *
 * `display`/`label` override the shown text or hover copy for the rare case
 * where the visible value isn't the raw id (or the label needs a tweak).
 */
export function FoldIdTag({ id, display, label = 'Click to copy Member ID', className, showToast }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const shown = display ?? formatFoldId(id);

  const handleClick = (e) => {
    e.stopPropagation();
    if (id == null || id === '') return;
    copyFoldId(id).then(ok => {
      if (!ok) {
        showToast?.('Could not copy to clipboard');
        return;
      }
      setCopied(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), COPIED_LABEL_MS);
    });
  };

  const tooltipLabel = (
    <span key={copied ? 'copied' : 'idle'} className={styles.labelFade}>
      {copied ? `Copied: ${shown}` : label}
    </span>
  );

  return (
    <Tooltip label={tooltipLabel}>
      <button
        type="button"
        className={[styles.tag, className].filter(Boolean).join(' ')}
        onClick={handleClick}
      >
        {shown}
      </button>
    </Tooltip>
  );
}
