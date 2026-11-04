import { Icon } from '../../components/Icon/Icon';
import { ClinicalNoteCardActions } from '../activity/ActivityEntries';
import activityStyles from '../../components/ActivityLog/ActivityLog.module.css';
import styles from './ClinicalNotesTab.module.css';

/**
 * ClinicalNotesTab: flat list of Clinical Notes for a member.
 *
 * Rendered inside CareGapDetailDrawer's "Clinical Notes" tab. Matches
 * Figma 1030:78586: column-headed list of note cards (no timeline rail,
 * no month grouping). Each row reuses the shared `ClinicalNoteCardActions`
 * component so eye / pencil / task-arrow behave identically to the
 * Activity Log entries: one source of truth for card affordances.
 */
export function ClinicalNotesTab({ entries, onOpenNote, onOpenTask }) {
  const noteEntries = (entries || []).filter(e => e.t === 'clinical_note');
  if (noteEntries.length === 0) {
    return (
      <div className={styles.empty}>
        <Icon name="solar:notes-linear" size={36} color="var(--neutral-200)" />
        <p className={styles.emptyTitle}>No clinical notes for this member yet.</p>
      </div>
    );
  }
  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <span className={styles.headerNote}>Note Title</span>
        <span className={styles.headerStatus}>Status</span>
        <span className={styles.headerActions} aria-hidden="true" />
      </div>
      <div className={styles.list}>
        {noteEntries.map(entry => (
          <NoteRow key={entry.id} entry={entry} onOpenNote={onOpenNote} onOpenTask={onOpenTask} />
        ))}
      </div>
    </div>
  );
}

function NoteRow({ entry, onOpenNote, onOpenTask }) {
  const dc = entry.detailCard;
  if (!dc) return null;
  // Figma 1030:78586 meta format: `MM/DD/YYYY, HH:MM · Author (Role)`.
  // Comma between date and time; middot separator before author. Time is
  // shown in 24-hour form to match the Figma spec, distinct from the
  // Activity Log's 12-hour presentation.
  const time24 = to24Hour(entry.time);
  const dateTime = [entry.date, time24].filter(Boolean).join(', ');
  const author = entry.by ? `${entry.by}${entry.role ? ` (${entry.role})` : ''}` : null;
  // Per Figma 1030:78586 the meta line reads
  // `<date>, <time> • <author> • <template name>`, the form-type label
  // rides inline as a third bullet-separated segment (dropped from its own
  // sub-meta row inside the card body).
  const metaLine = [dateTime, author, dc.subMeta].filter(Boolean).join(' • ');
  // Strip fields the Clinical Notes tab doesn't render: `subMeta` rides
  // in the meta line above, and the Linked Score Groups link is dropped
  // per the latest Figma spec.
  const dcInline = { ...dc, subMeta: undefined, linkedGroups: false };
  return (
    <div className={`${activityStyles.detailCard} ${styles.cardHost}`}>
      <div className={styles.meta}>{metaLine}</div>
      <ClinicalNoteCardActions dc={dcInline} onOpenNote={onOpenNote} onOpenTask={onOpenTask} />
    </div>
  );
}

// Turn `HH:MM AM/PM` (12h) into `HH:MM` (24h) so the card meta matches the
// Figma spec. Any string that doesn't parse falls through unchanged.
function to24Hour(t) {
  if (!t) return '';
  const m = String(t).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return t;
  let hh = parseInt(m[1], 10);
  const mm = m[2];
  const ampm = m[3].toUpperCase();
  if (ampm === 'AM' && hh === 12) hh = 0;
  else if (ampm === 'PM' && hh < 12) hh += 12;
  return `${String(hh).padStart(2, '0')}:${mm}`;
}
