import { useState } from 'react';
import { Icon } from '../Icon/Icon';
import { ActionButton } from '../ActionButton/ActionButton';
import { Tooltip } from '../Tooltip/Tooltip';
import { Avatar } from '../Avatar/Avatar';
import { Link } from '../Link/Link';
import { Skeleton } from '../Skeleton/Skeleton';
import { CollapsibleContent } from '../Collapsible/Collapsible';
import { EmptyState } from '../EmptyState/EmptyState';
import { initialsOf } from './patientMatch';
import { PatientMeta } from './PatientMeta';
import styles from './SuggestedPatients.module.css';

// AI confidence bands and their notes (Figma 2941:74217).
const LEVELS = [
  { min: 85, key: 'High', note: '85% and above. Strong match between the fax and Patient - safe to accept.' },
  { min: 60, key: 'Medium', note: 'Between 60-84%. Review recommended before accepting.' },
  { min: 0, key: 'Low', note: 'Below 60%. AI is uncertain - verify against the source document before accepting.' },
];
const levelOf = c => LEVELS.find(l => c >= l.min);

/**
 * ConfidenceBadge: an AI confidence score (green ≥85, amber ≥60, red below)
 * with the gauge; hover explains the band and lists the fields that matched.
 */
export function ConfidenceBadge({ confidence, matched = [] }) {
  const l = levelOf(confidence);
  const tip = (
    <span className={styles.tip}>
      <span className={styles.tipHead}>
        <Icon name="custom:ai" size={12} />
        <span>AI Confidence: <span className={styles[`tone${l.key}`]}>{confidence}%•({l.key})</span></span>
      </span>
      <span className={styles.tipNote}>{l.note}</span>
      {matched.length > 0 && <span className={`${styles.tipNote} ${styles.tipFields}`}>Fields Matched: {matched.join(', ')}.</span>}
    </span>
  );
  return (
    <Tooltip variant="card" align="left" maxWidth={222} label={tip}>
      <span className={[styles.badge, styles[`badge${l.key}`]].join(' ')}>
        <Icon name="custom:gauge" size={10} color="currentColor" />
        {confidence}%
      </span>
    </Tooltip>
  );
}

/**
 * SuggestedPatients ("Suggested Members", Figma 2932:39952 / 2916:41416):
 * the patients a document was read as being about. Each row has its AI
 * confidence (hover for the band and the fields that matched) and + to add
 * that patient. Read but matched to nobody, it says No Matches Found.
 *  - In a message: attached under it, a few rows, "View N More" (onMore).
 *  - In a drawer (`boxed`): its own bordered box that folds to the header
 *    with View all / Hide all, easing open and shut.
 *
 * @param {Array<{ patient: object, confidence: number, matched?: string[] }>} props.items – the rows to show
 * @param {(item) => void} props.onAdd
 * @param {string}  [props.title='Suggested Members']
 * @param {number}  [props.moreCount=0]
 * @param {() => void} [props.onMore]
 * @param {boolean} [props.boxed] – bordered and collapsible, for a drawer
 * @param {boolean} [props.loading] – still reading the document
 * @param {React.ReactNode} [props.emptyHint] – under "No Matches Found" when the
 *   document was read but nobody matched (e.g. a link to search instead)
 */
export function SuggestedPatients({ items, onAdd, title = 'Suggested Members', moreCount = 0, onMore, boxed = false, loading = false, emptyHint }) {
  const [open, setOpen] = useState(true);
  const showRows = !boxed || open;

  let action = null;
  if (boxed) {
    action = (
      <button type="button" className={`${styles.link} ${styles.linkPrimary}`} aria-expanded={open} onClick={() => setOpen(o => !o)}>
        {open ? 'Hide all' : 'View all'}
      </button>
    );
  } else if (!loading && moreCount > 0 && onMore) {
    action = (
      <Link
        variant="subtle"
        className={styles.more}
        role="button"
        tabIndex={0}
        onClick={onMore}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onMore(); } }}
      >
        View {moreCount} More
        <Icon name="solar:alt-arrow-right-linear" size={12} color="currentColor" />
      </Link>
    );
  }

  return (
    <div className={[styles.root, boxed ? styles.boxed : ''].join(' ')}>
      <div className={[styles.head, showRows ? styles.headRuled : ''].join(' ')}>
        <Icon name="custom:ai" size={16} className={loading ? styles.spin : undefined} />
        <span className={styles.titleGroup}>
          <span className={`${styles.title} ${styles.aiText}`}>{loading ? 'Reading the fax…' : title}</span>
          {/* In a drawer the box can fold away, so the count says what's inside. */}
          {boxed && !loading && items.length > 0 && <span className={styles.count}>{items.length}</span>}
        </span>
        {action}
      </div>
      {/* In a drawer the rows ease open and shut (View all / Hide all). */}
      <CollapsibleContent open={showRows}>
        {loading ? (
          <div className={styles.row} aria-busy="true">
            <Skeleton className={styles.boneLine} />
            <Skeleton className={`${styles.boneLine} ${styles.boneShort}`} />
          </div>
        ) : items.length === 0 ? (
          <div className={styles.empty}>
            <EmptyState size="xs" icon="solar:users-group-rounded-linear" />
            <span className={styles.emptyText}>
              <span className={styles.emptyTitle}>No Matches Found</span>
              {emptyHint && <span className={styles.emptyHint}>{emptyHint}</span>}
            </span>
          </div>
        ) : items.map(it => (
          <div key={it.patient.id} className={styles.row}>
            <Avatar variant="patient" size="M" initials={initialsOf(it.patient.name)} />
            <span className={styles.text}>
              <span className={styles.nameRow}>
                <span className={styles.name}>{it.patient.name}</span>
                {it.confidence != null && <ConfidenceBadge confidence={it.confidence} matched={it.matched} />}
              </span>
              <PatientMeta className={styles.meta} patient={it.patient} />
            </span>
            <ActionButton icon="custom:add" size="sm" tooltip="Add to Patient Context" onClick={() => onAdd(it)} />
          </div>
        ))}
      </CollapsibleContent>
    </div>
  );
}
