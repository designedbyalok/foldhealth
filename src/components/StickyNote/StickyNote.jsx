import { useState, useRef, useEffect } from 'react';
import { Icon } from '../Icon/Icon';
import { ActionButton } from '../ActionButton/ActionButton';
import { StickyNoteIcon } from '../Icon/StickyNoteIcon';
import styles from './StickyNote.module.css';

function formatStickyNoteDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()} • ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
}

/**
 * StickyNote — Reusable sticky note component with multiple states.
 *
 * Notes are paginated by insurance profile (ehr_profile).
 * Chevrons switch between different profile sticky notes.
 * Hover reveals action buttons (audit log, delete, edit).
 * Delete logs the deletion as an activity rather than removing audit history.
 *
 * @param {object[]}  notes         - Array of note objects { id, text, author_name, author_date, ehr_profile }
 * @param {function}  onSave        - (id, text) => void
 * @param {function}  onCreate      - (text) => void
 * @param {function}  onDelete      - (id) => void — soft-delete: logs activity, removes note
 * @param {function}  onAuditLog    - () => void
 * @param {boolean}   collapsedOnly - If true, always show collapsed single-line view
 */
export function StickyNote({ notes = [], onSave, onCreate, onDelete, onAuditLog, collapsedOnly = false, initialExpanded = false }) {
  const [expanded, setExpanded] = useState(initialExpanded);
  const [editing, setEditing] = useState(initialExpanded && notes.length === 0);
  const [editText, setEditText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const textareaRef = useRef(null);

  const note = notes[currentIndex] || null;
  const hasNotes = notes.length > 0;
  const totalPages = notes.length;

  useEffect(() => { if (editing && textareaRef.current) textareaRef.current.focus(); }, [editing]);
  useEffect(() => { if (currentIndex >= notes.length) setCurrentIndex(Math.max(0, notes.length - 1)); }, [notes.length]);

  const handleEdit = () => {
    setEditText(note?.text || '');
    setEditing(true);
    setExpanded(true);
  };

  const handleSaveEdit = async () => {
    if (note && editText.trim()) {
      await onSave?.(note.id, editText.trim());
    } else if (!note && editText.trim()) {
      await onCreate?.(editText.trim());
    }
    setEditing(false);
  };

  const handleCancelEdit = () => { setEditing(false); setEditText(''); };

  const handleDelete = () => {
    if (note) {
      // onDelete should log the deletion as an audit activity before removing
      onDelete?.(note.id);
    }
  };

  const prevNote = () => setCurrentIndex(i => Math.max(0, i - 1));
  const nextNote = () => setCurrentIndex(i => Math.min(totalPages - 1, i + 1));

  const formatDate = formatStickyNoteDate;

  // ── Collapsed: single-line ──
  if (!expanded || collapsedOnly) {
    const handleCollapsedClick = () => {
      if (collapsedOnly) return;
      setExpanded(true);
      if (!hasNotes) { setEditing(true); setEditText(''); }
    };
    return (
      <div className={styles.collapsed} onClick={handleCollapsedClick}>
        <StickyNoteIcon size={16} />
        <span className={styles.collapsedText}>{note?.text || 'Add sticky Note'}</span>
        {/* Actions appear on hover */}
        <div className={styles.collapsedActions}>
          {hasNotes && (
            <>
              <ActionButton icon="solar:clock-circle-linear" size="S" tooltip="Audit Log" onClick={e => { e.stopPropagation(); onAuditLog?.(); }} />
              <ActionButton icon="solar:trash-bin-minimalistic-linear" size="S" tooltip="Delete" onClick={e => { e.stopPropagation(); handleDelete(); }} />
              <ActionButton icon="solar:pen-2-linear" size="S" tooltip="Edit" onClick={e => { e.stopPropagation(); handleEdit(); }} />
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Expanded ──
  return (
    <div className={styles.expanded}>
      {/* Header */}
      <div className={styles.header}>
        <StickyNoteIcon size={16} />
        <span className={styles.headerTitle}>Sticky Note</span>
        <div className={styles.headerActions}>
          <ActionButton icon="solar:clock-circle-linear" size="S" tooltip="Audit Log" onClick={onAuditLog} />
          {editing ? (
            <>
              <button className={styles.cancelBtn} aria-label="Cancel edit" onClick={handleCancelEdit}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--neutral-300)" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
              <button className={styles.saveBtn} aria-label="Save note" onClick={handleSaveEdit}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary-300)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.9l3.143 3.6L15 7.5" /></svg>
              </button>
            </>
          ) : (
            <>
              <ActionButton icon="solar:trash-bin-minimalistic-linear" size="S" tooltip="Delete" onClick={handleDelete} />
              <ActionButton icon="solar:pen-2-linear" size="S" tooltip="Edit" onClick={handleEdit} />
            </>
          )}
        </div>
      </div>

      {/* Body */}
      <div className={styles.body}>
        {editing ? (
          <textarea aria-label="Sticky note text"
            ref={textareaRef}
            className={styles.textarea}
            value={editText}
            onChange={e => setEditText(e.target.value)}
            placeholder="Add sticky Note"
            onKeyDown={e => { if (e.key === 'Escape') handleCancelEdit(); }}
          />
        ) : hasNotes ? (
          <p className={styles.noteText}>{note?.text}</p>
        ) : (
          <p className={styles.placeholder}>Add sticky Note</p>
        )}
      </div>

      {/* Author info (read-only) */}
      {!editing && note?.author_name && (
        <div className={styles.authorRow}>
          <span>{note.author_name} • {formatDate(note.author_date)}</span>
        </div>
      )}

      {/* Footer: EHR profile label + chevron pagination + collapse */}
      <div className={styles.footer}>
        <span className={styles.ehrLabel}>EHR: {note?.ehr_profile || 'Central Profile'}</span>
        {totalPages > 1 && (
          <div className={styles.pagination}>
            <button className={styles.pageBtn} aria-label="Previous note" disabled={currentIndex === 0} onClick={prevNote}>
              <Icon name="solar:alt-arrow-left-linear" size={12} color="var(--neutral-300)" />
            </button>
            <span className={styles.pageInfo}>{currentIndex + 1}/{totalPages}</span>
            <button className={styles.pageBtn} aria-label="Next note" disabled={currentIndex === totalPages - 1} onClick={nextNote}>
              <Icon name="solar:alt-arrow-right-linear" size={12} color="var(--neutral-300)" />
            </button>
          </div>
        )}
        <button className={styles.collapseBtn} aria-label="Collapse note" onClick={() => { setExpanded(false); setEditing(false); }}>
          <Icon name="solar:alt-arrow-up-linear" size={12} color="var(--neutral-300)" />
        </button>
      </div>
    </div>
  );
}
