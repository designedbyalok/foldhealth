import { useRef, useState } from 'react';
import { useAppStore } from '../../../../../../store/useAppStore';
import { ActionButton } from '../../../../../../components/ActionButton/ActionButton';
import { ConfirmDialog } from '../../../../../../components/ConfirmDialog/ConfirmDialog';
import { MenuPopover } from '../../../../../../components/MenuPopover/MenuPopover';
import { profileCellClass, profileRowClass } from '../../../../../../components/ProfileTable/profileTableClasses';
import { Checkbox } from '../../../../../../components/Checkbox/Checkbox';
import { Tooltip } from '../../../../../../components/Tooltip/Tooltip';
import { KanbanCardContent } from '../../../../../tasks/TasksViewKanban';
import { openSafeUrl } from '../../../../../../lib/openSafeUrl';
import { formatDate } from './noteRows';
import styles from './PatientNotesTab.module.css';

const MENU_ITEMS = [
  { key: 'preview', label: 'Preview', icon: 'solar:eye-linear' },
  { key: 'print', label: 'Print Note', icon: 'solar:printer-linear' },
  { key: 'delete', label: 'Delete Note', icon: 'solar:trash-bin-trash-linear', danger: true },
];

const STATUS_CLASS = { success: styles.statusSuccess, warning: styles.statusWarning, neutral: styles.statusNeutral };

// Hovering shows each linked task as its Tasks-board card; clicking opens the first.
function LinkedTasksButton({ tasks, onOpenTask }) {
  return (
    <Tooltip
      label={(
        <div className={styles.linkedTooltip}>
          {tasks.map(t => <KanbanCardContent key={t.id} task={t} onToggle={() => {}} />)}
        </div>
      )}
      placement="top"
      variant="light"
      maxWidth={460}
    >
      <ActionButton
        icon="solar:link-linear"
        size="sm"
        count={String(tasks.length)}
        aria-label={`Open linked task${tasks.length > 1 ? 's' : ''}`}
        onClick={(e) => { e.stopPropagation(); onOpenTask(tasks[0]); }}
      />
    </Tooltip>
  );
}

function PersonDate({ name, date }) {
  return (
    <>
      <div>{name || '-'}</div>
      <div className={styles.dateText}>{formatDate(date)}</div>
    </>
  );
}

function NoteActions({ note }) {
  const openNotePreview = useAppStore(s => s.openNotePreview);
  const deleteClinicalNote = useAppStore(s => s.deleteClinicalNote);
  const showToast = useAppStore(s => s.showToast);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuBtnRef = useRef(null);

  const onSelect = (key) => {
    if (key === 'preview') openNotePreview?.(note);
    else if (key === 'print') {
      if (note.pdfDataUrl) openSafeUrl(note.pdfDataUrl);
      else showToast?.('No PDF available for this note');
    } else if (key === 'delete') setConfirmDelete(true);
  };
  const handleDelete = async () => {
    setConfirmDelete(false);
    const ok = await deleteClinicalNote?.(note.id);
    showToast?.(ok ? 'Note deleted' : 'Failed to delete note');
  };

  return (
    <>
      <span className={styles.rowKebab}>
        <ActionButton
          ref={menuBtnRef}
          icon="solar:menu-dots-linear"
          size="sm"
          tooltip="Note actions"
          tooltipLeft
          onClick={() => setMenuOpen(v => !v)}
        />
      </span>
      {menuOpen && (
        <MenuPopover
          anchorRef={menuBtnRef}
          items={MENU_ITEMS}
          onSelect={onSelect}
          onClose={() => setMenuOpen(false)}
          width={180}
          align="right"
          ariaLabel="Note actions"
        />
      )}
      {confirmDelete && (
        <ConfirmDialog
          icon="solar:danger-triangle-linear"
          iconColor="var(--status-error)"
          title="Delete this note?"
          description="This will permanently remove the note. This cannot be undone."
          confirmLabel="Delete"
          cancelLabel="Cancel"
          variant="error"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}

export function NoteRow({ note, selected, onToggle, onOpen, onOpenTask }) {
  const stop = e => e.stopPropagation();
  return (
    <tr className={`${profileRowClass} ${styles.row}`} onClick={onOpen}>
      <td className={`${profileCellClass} ${styles.checkCell}`} onClick={stop}>
        <Checkbox checked={selected} onCheckedChange={onToggle} aria-label={`Select ${note.title}`} />
      </td>
      <td className={profileCellClass}>
        <div className={styles.titleCell}>
          <div className={styles.titleText}>
            <div className={styles.noteTitle}>{note.title}</div>
            <div className={styles.muted}>{note.diagnosis || 'No diagnosis reported'}</div>
          </div>
          {note.linkedTasks.length > 0 && <LinkedTasksButton tasks={note.linkedTasks} onOpenTask={onOpenTask} />}
        </div>
      </td>
      <td className={`${profileCellClass} ${STATUS_CLASS[note.statusInfo.tone]}`}>{note.statusInfo.label}</td>
      <td className={`${profileCellClass} ${styles.muted}`}><PersonDate name={note.authorName} date={note.createdAt} /></td>
      <td className={`${profileCellClass} ${styles.muted}`}><PersonDate name={note.updatedByName} date={note.updatedAt || note.createdAt} /></td>
      <td className={`${profileCellClass} ${styles.muted}`}>{note.templateName}</td>
      <td className={`${profileCellClass} ${styles.actionsCell}`} onClick={stop}>
        <NoteActions note={note} />
      </td>
    </tr>
  );
}
