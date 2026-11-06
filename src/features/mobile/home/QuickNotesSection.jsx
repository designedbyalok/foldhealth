import { useEffect, useState } from 'react';
import { BottomSheet } from '../../../components/BottomSheet/BottomSheet';
import { Button } from '../../../components/Button/Button';
import { Textarea } from '../../../components/Textarea/Textarea';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
import { dateOf } from '../mobileFormat';
import { HomeSection } from './HomeSection';
import styles from './HomeScreen.module.css';

/** Team-wide quick notes (desktop Home's Quick Notes card). */
export function QuickNotesSection() {
  const notes = useAppStore(s => s.quickNotes);
  const fetchQuickNotes = useAppStore(s => s.fetchQuickNotes);
  const [editing, setEditing] = useState(null); // null | { id?, text }
  useEffect(() => { fetchQuickNotes?.(); }, [fetchQuickNotes]);

  return (
    <HomeSection title="Quick Notes" actionLabel="Add" onAction={() => setEditing({ text: '' })}>
      {(notes || []).length === 0 ? (
        <p className={styles.empty}>No quick notes yet</p>
      ) : (notes || []).slice(0, 3).map(n => (
        <button key={n.id} type="button" className={styles.note} onClick={() => setEditing({ id: n.id, text: n.text })}>
          <span className={styles.noteText}>{n.text}</span>
          <span className={styles.noteMeta}>{[n.author_name, dateOf(n.created_at)].filter(Boolean).join(' • ')}</span>
        </button>
      ))}
      {editing && <QuickNoteSheet note={editing} onClose={() => setEditing(null)} />}
    </HomeSection>
  );
}

export function QuickNoteSheet({ note, onClose }) {
  const createQuickNote = useAppStore(s => s.createQuickNote);
  const updateQuickNote = useAppStore(s => s.updateQuickNote);
  const deleteQuickNote = useAppStore(s => s.deleteQuickNote);
  const [text, setText] = useState(note.text || '');
  const [busy, setBusy] = useState(false);

  // The store actions resolve falsy when Supabase refused the write; keep
  // the sheet (and the text) open so nothing is lost.
  const run = async (action, failure) => {
    setBusy(true);
    let ok;
    try { ok = !!(await action()); } catch { ok = false; }
    setBusy(false);
    if (ok) onClose();
    else toast.error(failure);
  };
  const save = () => {
    const body = text.trim();
    if (!body) return;
    run(() => (note.id ? updateQuickNote(note.id, body) : createQuickNote(body)), 'Could not save the note.');
  };
  const remove = () => run(() => deleteQuickNote(note.id), 'Could not delete the note.');

  return (
    <BottomSheet title={note.id ? 'Quick Note' : 'Add Quick Note'} onClose={onClose}>
      <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a note for the team" aria-label="Note" />
      <div className={styles.sheetActions}>
        {note.id && <Button variant="ghost" tone="danger" onClick={remove} disabled={busy}>Delete</Button>}
        <Button variant="solid" onClick={save} disabled={!text.trim() || busy}>Save</Button>
      </div>
    </BottomSheet>
  );
}
