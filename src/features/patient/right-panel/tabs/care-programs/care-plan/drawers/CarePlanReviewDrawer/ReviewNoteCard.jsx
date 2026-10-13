import { useState } from 'react';
import { ActionButton } from '../../../../../../../../components/ActionButton/ActionButton';
import { Button } from '../../../../../../../../components/Button/Button';
import { Icon } from '../../../../../../../../components/Icon/Icon';
import { Textarea } from '../../../../../../../../components/Textarea/Textarea';
import { sanitizeRichText } from '../../../../../../../../lib/sanitizeHtml';
import styles from './CarePlanReviewDrawer.module.css';

const KIND = {
  call: { label: 'Call Note', icon: 'solar:phone-calling-linear' },
  plan: { label: 'Care Plan Note', icon: 'solar:notes-linear' },
};

function fmtStamp(iso) {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

// "4m 12s" for a call's length.
function fmtDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;
}

/**
 * One care plan note in the Review drawer's Notes tab: kind, author and time
 * on one line, the note below. Its author can edit it in place. Call notes
 * are rich text; the care plan note is plain.
 */
export function ReviewNoteCard({ note, canEdit, onSave }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.detail || '');
  const [saving, setSaving] = useState(false);
  const kind = KIND[note.kind] || KIND.plan;
  const rich = note.kind === 'call';
  const plain = (rich ? text.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ') : text).trim();

  return (
    <article className={styles.noteCard}>
      <div className={styles.noteHead}>
        <Icon name={kind.icon} size={14} color="var(--neutral-300)" />
        <span className={styles.noteKind}>{kind.label}</span>
        <span className={styles.noteMeta}>
          {note.actor || 'Care team'}
          <span aria-hidden="true"> • </span>
          {fmtStamp(note.createdAt)}
          {note.durationSeconds > 0 && (
            <span className={styles.noteDuration}>
              <Icon name="solar:stopwatch-linear" size={12} color="currentColor" />
              {fmtDuration(note.durationSeconds)}
            </span>
          )}
        </span>
        {canEdit && !editing && (
          <span className={styles.noteEdit}>
            <ActionButton icon="solar:pen-linear" size="S" tooltip="Edit note" tooltipLeft onClick={() => { setText(note.detail || ''); setEditing(true); }} />
          </span>
        )}
      </div>
      {editing ? (
        <div className={styles.noteEditor}>
          <Textarea
            richText={rich}
            value={text}
            onChange={(v) => setText(typeof v === 'string' ? v : (v?.target?.value ?? ''))}
            rows={3}
          />
          <div className={styles.completeActions}>
            <Button variant="secondary" size="S" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
            <Button
              variant="primary"
              size="S"
              disabled={saving || !plain || text === note.detail}
              onClick={async () => {
                setSaving(true);
                try { await onSave(text); setEditing(false); } finally { setSaving(false); }
              }}
            >
              Save
            </Button>
          </div>
        </div>
      ) : rich ? (
        <div className={`${styles.noteBody} ${styles.noteRich}`} dangerouslySetInnerHTML={{ __html: sanitizeRichText(note.detail) }} />
      ) : (
        <p className={styles.noteBody}>{(note.detail || '').trim()}</p>
      )}
    </article>
  );
}
