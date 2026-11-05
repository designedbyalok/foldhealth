import { useState } from 'react';

const escapeHtml = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Care plan header note drawer: open/close with unsaved guard. The note box
 * is rich text, so `noteText` is HTML; `notePlain` is what gets saved as the
 * note, with @mentions and "/" links read as text.
 */
export function useCarePlanNoteDrawer(latestPlanNote) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [notePlain, setNotePlain] = useState('');
  const [noteBaseline, setNoteBaseline] = useState('');
  const [noteDiscardOpen, setNoteDiscardOpen] = useState(false);
  const [noteDeleteOpen, setNoteDeleteOpen] = useState(false);

  const noteDirty = noteText.trim() !== (noteBaseline || '').trim();

  const openNoteDrawer = () => {
    // Notes saved before the rich note box are plain text.
    const seed = latestPlanNote?.meta?.html || escapeHtml(latestPlanNote?.detail || '');
    setNoteText(seed);
    setNotePlain(latestPlanNote?.detail || '');
    setNoteBaseline(seed);
    setNoteOpen(true);
  };

  const closeNoteDrawer = ({ force = false } = {}) => {
    if (!force && noteDirty) {
      setNoteDiscardOpen(true);
      return;
    }
    setNoteOpen(false);
    setNoteText('');
    setNotePlain('');
    setNoteBaseline('');
  };

  return {
    noteOpen,
    setNoteOpen,
    noteText,
    setNoteText,
    notePlain,
    setNotePlain,
    noteBaseline,
    noteDiscardOpen,
    setNoteDiscardOpen,
    noteDeleteOpen,
    setNoteDeleteOpen,
    noteDirty,
    openNoteDrawer,
    closeNoteDrawer,
  };
}
