import { useState } from 'react';
import { BottomSheet } from '../../../../components/BottomSheet/BottomSheet';
import { Button } from '../../../../components/Button/Button';
import { Textarea } from '../../../../components/Textarea/Textarea';
import { toast } from '../../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../../store/useAppStore';
import styles from '../MemberProfileScreen.module.css';

/**
 * Add or edit a patient's sticky note, with the same payload the desktop
 * sticky note sends (PatientProfileTabs: author 'You', Central Profile).
 */
export function StickyNoteSheet({ patientId, note, onClose }) {
  const createStickyNote = useAppStore(s => s.createStickyNote);
  const updateStickyNote = useAppStore(s => s.updateStickyNote);
  const [text, setText] = useState(note?.text || '');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    let ok;
    try {
      if (note?.id) {
        await updateStickyNote(note.id, { text: body, author_name: 'You' }, patientId);
        ok = true;
      } else {
        ok = !!(await createStickyNote({ patient_id: patientId, text: body, author_name: 'You', ehr_profile: 'Central Profile' }));
      }
    } catch {
      ok = false;
    }
    setBusy(false);
    if (ok) onClose();
    else toast.error('Could not save the sticky note.');
  };

  return (
    <BottomSheet title={note?.id ? 'Sticky Note' : 'Add Sticky Note'} onClose={onClose}>
      <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a note about this patient" aria-label="Sticky note" />
      <div className={styles.sheetActions}>
        <Button variant="solid" onClick={save} disabled={!text.trim() || busy}>Save</Button>
      </div>
    </BottomSheet>
  );
}
