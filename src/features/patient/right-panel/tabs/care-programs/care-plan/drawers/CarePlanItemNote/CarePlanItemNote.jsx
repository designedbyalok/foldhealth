import { forwardRef, useEffect, useMemo, useState } from 'react';
import { Textarea } from '../../../../../../../../components/Textarea/Textarea';
import { Button } from '../../../../../../../../components/Button/Button';
import { ActionButton } from '../../../../../../../../components/ActionButton/ActionButton';
import { useAppStore } from '../../../../../../../../store/useAppStore';
import { itemNoteHistory, latestItemNote } from '../../lib/carePlanNotes';
import { CarePlanNoteChangeLog } from '../CarePlanNoteChangeLog/CarePlanNoteChangeLog';
import styles from './CarePlanItemNote.module.css';

const NOUN = { goal: 'goal', intervention: 'intervention', barrier: 'barrier' };

function fmtStamp(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${date} ${time}`;
}

/**
 * The Note section of a goal, intervention or barrier drawer. One component
 * so all three behave the same: the latest note as a card (click to edit,
 * hover to delete), otherwise the editor with Cancel and Add / Update Note,
 * a toast on each save or delete, and every earlier note in the change log.
 *
 * Notes are append-only audit rows: Update adds a row, Delete logs
 * `note_deleted`, and both stay in the Activity Log.
 *
 * `ids`: every id the item answers to (a barrier can carry legacy clone ids).
 */
export const CarePlanItemNote = forwardRef(function CarePlanItemNote(
  { entityType, itemId, ids, itemTitle, audit, patientId, program },
  ref,
) {
  const addCarePlanNote = useAppStore(s => s.addCarePlanNote);
  const logCarePlanAudit = useAppStore(s => s.logCarePlanAudit);
  const showToast = useAppStore(s => s.showToast);
  const idList = useMemo(() => (ids?.length ? ids : [itemId]), [ids, itemId]);
  const latest = useMemo(() => latestItemNote(audit, idList, entityType), [audit, idList, entityType]);
  const history = useMemo(() => itemNoteHistory(audit, idList, entityType), [audit, idList, entityType]);
  const [note, setNote] = useState(latest?.detail || '');
  const [editing, setEditing] = useState(false);

  // A new latest note (another item opened, or one just saved) re-seeds the
  // editor and shows the card again.
  useEffect(() => {
    setNote(latest?.detail || '');
    setEditing(false);
  }, [latest?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const noun = NOUN[entityType] || 'item';
  const baseline = (latest?.detail || '').trim();
  const current = note.trim();
  const canSave = current.length > 0 && current !== baseline;
  const canDiscard = current !== baseline || editing;

  const save = async () => {
    if (!canSave) return;
    await addCarePlanNote(patientId, program, current, {
      entityType, entityId: itemId, summary: `Note on ${itemTitle || noun}`,
    });
    setEditing(false);
    showToast?.(latest ? 'Note updated' : 'Note added');
  };

  const remove = () => {
    logCarePlanAudit?.(patientId, program, {
      entityType,
      entityId: itemId,
      action: 'note_deleted',
      summary: `Note on ${itemTitle || noun} deleted`,
      detail: latest?.detail || '',
    });
    setNote('');
    setEditing(true);
    showToast?.('Note deleted');
  };

  return (
    <div ref={ref} className={styles.noteEditor}>
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionTitle}>Note</span>
        </div>
        {latest && !editing ? (
          <div className={styles.cardWrap}>
            <button type="button" className={styles.card} onClick={() => setEditing(true)} aria-label="Edit note">
              <p className={styles.body}>{latest.detail}</p>
              <div className={styles.meta}>
                <span>{latest.actor || 'You'}</span>
                <span aria-hidden="true">•</span>
                <span>{fmtStamp(latest.createdAt)}</span>
              </div>
            </button>
            <span className={styles.delete}>
              <ActionButton icon="solar:trash-bin-trash-linear" size="S" tooltip="Delete note" onClick={remove} />
            </span>
          </div>
        ) : (
          <Textarea
            placeholder="Add a note"
            value={note}
            // A plain Textarea passes the change event, an enhanced one the text.
            onChange={(value) => setNote(typeof value === 'string' ? value : (value?.target?.value ?? ''))}
            rows={3}
          />
        )}
      </section>
      {(!latest || editing) && (
        <>
          <div className={styles.actions}>
            <Button
              variant="secondary"
              size="M"
              disabled={!canDiscard}
              onClick={() => { setNote(baseline); if (latest) setEditing(false); }}
            >
              Cancel
            </Button>
            <Button variant="primary" size="M" disabled={!canSave} onClick={save}>
              {latest ? 'Update Note' : 'Add Note'}
            </Button>
          </div>
          <CarePlanNoteChangeLog notes={history} />
        </>
      )}
    </div>
  );
});
