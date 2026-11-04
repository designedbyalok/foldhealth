import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../../../components/Dialog/Dialog';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { AutomationCanvas } from '../canvas/AutomationCanvas';
import styles from './PreviewModal.module.css';

/**
 * The centered modal shared by the automation quick view and the template
 * preview: title block, action buttons, a stats strip, then the flow on a
 * read-only canvas that can expand to fill the window.
 */
export function PreviewModal({ title, meta, description, actions, stats, graph, onClose }) {
  const [full, setFull] = useState(false);
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className={`${styles.modal} ${full ? styles.full : ''}`}
        hideClose={full}
        onEscapeKeyDown={(e) => { if (full) { e.preventDefault(); setFull(false); } }}
      >
        <div className={styles.head} hidden={full}>
          <DialogTitle className={styles.title}>{title}</DialogTitle>
          {meta && <div className={styles.meta}>{meta}</div>}
          <DialogDescription className={styles.description}>{description || 'No description yet.'}</DialogDescription>
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>
        {!full && stats}
        <div className={styles.canvas}>
          {/* Remount on resize so the flow fits the new frame. */}
          <AutomationCanvas key={full ? 'full' : 'inline'} graph={graph} mode="readonly" />
          <span className={styles.expand}>
            <ActionButton
              icon={full ? 'solar:minimize-square-linear' : 'solar:maximize-square-linear'}
              size="sm"
              tooltip={full ? 'Exit full screen' : 'Full screen'}
              tooltipLeft
              onClick={() => setFull(v => !v)}
            />
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** USED 982 times | EXECUTION TYPE Automatic | ... */
export function PreviewStats({ items }) {
  return (
    <dl className={styles.stats}>
      {items.map(it => (
        <div key={it.label} className={styles.statItem}>
          <dt className={styles.statLabel}>{it.label}</dt>
          <dd className={styles.statValue}>{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
