import { useEffect, useState, useRef } from 'react';
import { Icon } from '../../components/Icon/Icon';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { StickyNoteAuditDrawer } from '../../components/StickyNoteAuditDrawer/StickyNoteAuditDrawer';
import { useAppStore } from '../../store/useAppStore';
import styles from './HomeView.module.css';

function formatStickyNoteDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()} • ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
}

function QuickNoteItem({ note, onSave, onDelete, onAuditLog }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => { if (editing && textareaRef.current) textareaRef.current.focus(); }, [editing]);

  const handleEdit = (e) => {
    e.stopPropagation();
    setEditText(note.text);
    setEditing(true);
    setExpanded(true);
  };

  const handleSave = async () => {
    if (editText.trim()) await onSave(note.id, editText.trim());
    setEditing(false);
  };

  const handleCancel = () => { setEditing(false); setEditText(''); };

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    setConfirmDelete(true);
  };

  const handleConfirmDelete = () => {
    onDelete(note.id);
    setConfirmDelete(false);
  };

  const formatDate = formatStickyNoteDate;

  if (confirmDelete) {
    return (
      <div className={styles.quickNote}>
        <div className={styles.deleteConfirm}>
          <span className={styles.deleteConfirmText}>Delete this note?</span>
          <div className={styles.deleteConfirmActions}>
            <button className={styles.deleteConfirmBtn} onClick={handleConfirmDelete}>Delete</button>
            <button className={styles.deleteConfirmCancelBtn} onClick={() => setConfirmDelete(false)}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  if (expanded) {
    return (
      <div className={styles.quickNote}>
        {editing ? (
          <>
            <textarea aria-label="Quick note"
              ref={textareaRef}
              className={styles.quickNoteTextarea}
              value={editText}
              onChange={e => setEditText(e.target.value)}
              placeholder="Write a note..."
              onKeyDown={e => { if (e.key === 'Escape') handleCancel(); }}
            />
            <div className={styles.quickNoteFooter}>
              <button className={styles.quickNoteSaveBtn} onClick={handleSave}>Save</button>
              <button className={styles.quickNoteCancelBtn} onClick={handleCancel}>Cancel</button>
            </div>
          </>
        ) : (
          <>
            <div className={styles.quickNoteTextFull}>{note.text}</div>
            {note.author_name && (
              <div className={styles.quickNoteMeta}>{note.author_name} • {formatDate(note.created_at)}</div>
            )}
            <div className={styles.quickNoteFooter}>
              <button className={styles.quickNoteActionBtn} onClick={handleEdit} aria-label="Edit">
                <Icon name="solar:pen-2-linear" size={13} color="var(--neutral-300)" />
              </button>
              <button className={styles.quickNoteActionBtn} onClick={handleDeleteClick} aria-label="Delete">
                <Icon name="solar:trash-bin-minimalistic-linear" size={13} color="var(--neutral-300)" />
              </button>
              <button className={styles.quickNoteActionBtn} onClick={(e) => { e.stopPropagation(); onAuditLog(); }} aria-label="Audit Log">
                <Icon name="solar:clock-circle-linear" size={13} color="var(--neutral-300)" />
              </button>
              <button className={styles.quickNoteCollapseBtn} onClick={() => setExpanded(false)} aria-label="Collapse quick notes">
                <Icon name="solar:alt-arrow-up-linear" size={12} color="var(--neutral-300)" />
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={styles.quickNote} onClick={() => setExpanded(true)}>
      <span className={styles.quickNoteText}>{note.text}</span>
      <div className={styles.quickNoteHoverActions}>
        <button className={styles.quickNoteActionBtn} onClick={handleEdit} aria-label="Edit">
          <Icon name="solar:pen-2-linear" size={13} color="var(--neutral-300)" />
        </button>
        <button className={styles.quickNoteActionBtn} onClick={handleDeleteClick} aria-label="Delete">
          <Icon name="solar:trash-bin-minimalistic-linear" size={13} color="var(--neutral-300)" />
        </button>
      </div>
    </div>
  );
}

function NewNoteEditor({ onCreate, onCancel }) {
  const [text, setText] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => { if (textareaRef.current) textareaRef.current.focus(); }, []);

  const handleSave = async () => {
    if (text.trim()) { await onCreate(text.trim()); onCancel(); }
  };

  return (
    <div className={styles.quickNote}>
      <textarea aria-label="Quick note"
        ref={textareaRef}
        className={styles.quickNoteTextarea}
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Write a note..."
        onKeyDown={e => { if (e.key === 'Escape') onCancel(); }}
      />
      <div className={styles.quickNoteFooter}>
        <button className={styles.quickNoteSaveBtn} onClick={handleSave}>Save</button>
        <button className={styles.quickNoteCancelBtn} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export function QuickNotesCard({ dragHandleClassName }) {
  const quickNotes = useAppStore(s => s.quickNotes);
  const fetchQuickNotes = useAppStore(s => s.fetchQuickNotes);
  const createQuickNote = useAppStore(s => s.createQuickNote);
  const updateQuickNote = useAppStore(s => s.updateQuickNote);
  const deleteQuickNote = useAppStore(s => s.deleteQuickNote);
  const [showAuditDrawer, setShowAuditDrawer] = useState(false);
  const [addingNew, setAddingNew] = useState(false);

  useEffect(() => { fetchQuickNotes(); }, []);

  return (
    <div className={styles.card}>
      <div className={[styles.cardHeader, dragHandleClassName].filter(Boolean).join(' ')}>
        <div className={styles.cardTitle}>
          <Icon name="solar:notes-linear" size={14} color="var(--secondary-300)" />
          Quick Notes
        </div>
        <div className={styles.cardActions}>
          <ActionButton icon="solar:add-circle-linear" size="S" tooltip="Add note" onClick={() => setAddingNew(true)} />
        </div>
      </div>
      <div className={styles.quickNotesBody}>
        {addingNew && (
          <NewNoteEditor
            onCreate={createQuickNote}
            onCancel={() => setAddingNew(false)}
          />
        )}
        {quickNotes.map(note => (
          <QuickNoteItem
            key={note.id}
            note={note}
            onSave={updateQuickNote}
            onDelete={deleteQuickNote}
            onAuditLog={() => setShowAuditDrawer(true)}
          />
        ))}
        {!quickNotes.length && !addingNew && (
          <div className={styles.quickNotesEmpty}>
            <Icon name="solar:notes-linear" size={24} color="var(--neutral-200)" />
            <span>No quick notes yet</span>
          </div>
        )}
      </div>
      {showAuditDrawer && (
        <StickyNoteAuditDrawer
          patientId="global"
          note={quickNotes[0]}
          profileOptions={['Quick Note']}
          onClose={() => setShowAuditDrawer(false)}
        />
      )}
    </div>
  );
}
