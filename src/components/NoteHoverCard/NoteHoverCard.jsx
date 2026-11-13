import { HoverCard } from '../HoverCard/HoverCard';
import { Badge } from '../Badge/Badge';
import { Link } from '../Link/Link';
import { Icon } from '../Icon/Icon';
import styles from './NoteHoverCard.module.css';

function CaretLink({ children, onClick }) {
  return (
    <Link onClick={onClick} className={styles.caretLink} role="button" tabIndex={0}>
      {children}
      <Icon name="solar:alt-arrow-right-linear" size={12} />
    </Link>
  );
}

/**
 * NoteSummaryCard: compact summary of a clinical note (Figma "Tooltips",
 * node 498:57383). Header with the note type and a status badge, the
 * signing status, title and author line, a clamped preview of the note's
 * sections, and links to the full note and to all notes.
 *
 * Props:
 *  - noteType     string: header label, e.g. "SOAP Note"
 *  - badgeLabel   string: e.g. "Completed"
 *  - badgeTone    Badge tone, default 'success'
 *  - statusLabel  string: e.g. "Signed & Saved" (green line above the title)
 *  - title        string: e.g. "Reviewing Diabetic Conditions"
 *  - meta         string: e.g. "Created & Signed by: Ivy League on 10/30/2025"
 *  - sections     [{ label, text }]: preview rows, e.g. Subjective / Objective
 *  - onViewNote   () => void: shows "View Note" when set
 *  - onViewAll    () => void: shows the "View All Notes" footer when set
 */
export function NoteSummaryCard({
  noteType,
  badgeLabel,
  badgeTone = 'success',
  statusLabel,
  title,
  meta,
  sections = [],
  onViewNote,
  onViewAll,
}) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.noteType}>{noteType}</span>
        {badgeLabel && <Badge tone={badgeTone} size="xs" label={badgeLabel} />}
      </div>

      <div className={styles.body}>
        <div className={styles.summary}>
          {statusLabel && <span className={styles.status}>{statusLabel}</span>}
          {title && <span className={styles.title}>{title}</span>}
          {meta && <span className={styles.meta}>{meta}</span>}
        </div>

        {(sections.length > 0 || onViewNote) && (
          <div className={styles.preview}>
            {sections.length > 0 && (
              <div className={styles.sections}>
                {sections.map(s => (
                  <p key={s.label} className={styles.section}>
                    <span className={styles.sectionLabel}>{s.label}:</span>
                    {s.text && <span className={styles.sectionText}>{s.text}</span>}
                  </p>
                ))}
              </div>
            )}
            {onViewNote && <CaretLink onClick={onViewNote}>View Note</CaretLink>}
          </div>
        )}
      </div>

      {onViewAll && (
        <div className={styles.footer}>
          <CaretLink onClick={onViewAll}>View All Notes</CaretLink>
        </div>
      )}
    </div>
  );
}

/**
 * NoteHoverCard: NoteSummaryCard opened from a hover (or click, with
 * `pinOnClick`) on `trigger`. Takes every NoteSummaryCard prop.
 */
export function NoteHoverCard({ trigger, width = 374, pinOnClick = false, className, ...cardProps }) {
  return (
    <HoverCard
      trigger={trigger}
      width={width}
      flush
      pinOnClick={pinOnClick}
      className={className}
      ariaLabel={cardProps.noteType}
    >
      <NoteSummaryCard {...cardProps} />
    </HoverCard>
  );
}
