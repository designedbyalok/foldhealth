import { ProfileTable } from '../../../../../../components/ProfileTable/ProfileTable';
import { NoteRow } from './NoteRow';
import styles from './PatientNotesTab.module.css';

const COLUMNS = [
  { key: 'select', label: '', showCheckbox: true, width: 36 },
  { key: 'title', label: 'Note Title', sortKey: 'sortTitle', sortType: 'alpha' },
  { key: 'status', label: 'Status', width: 140, sortKey: 'sortStatus', sortType: 'alpha' },
  { key: 'createdBy', label: 'Created By', width: 150, sortKey: 'sortAuthor', sortType: 'alpha' },
  { key: 'updated', label: 'Last Updated', width: 150, sortKey: 'sortUpdated', sortType: 'date' },
  { key: 'template', label: 'Template Name', width: 160, sortKey: 'sortTemplate', sortType: 'alpha' },
  { key: 'actions', label: '', width: 40 },
];

export function NotesTable({ rows, sort, selectedIds, onToggle, onToggleAll, onOpen, onOpenTask, emptyLabel }) {
  const selected = new Set(selectedIds);
  return (
    <ProfileTable
      columns={COLUMNS}
      rows={rows}
      sortKey={sort.sortKey}
      sortDir={sort.sortDir}
      onSort={sort.requestSort}
      selectedIds={selectedIds}
      onSelectAll={onToggleAll}
      emptyState={<span className={styles.muted}>{emptyLabel}</span>}
      renderRow={r => (
        <NoteRow
          key={r.id}
          note={r}
          selected={selected.has(r.id)}
          onToggle={() => onToggle(r.id)}
          onOpen={() => onOpen(r.id)}
          onOpenTask={onOpenTask}
        />
      )}
    />
  );
}
