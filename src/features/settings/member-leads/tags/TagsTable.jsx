import { useEffect, useState } from 'react';
import { WorklistShell } from '../../../../components/WorklistShell/WorklistShell';
import { Badge } from '../../../../components/Badge/Badge';
import { ActionButton } from '../../../../components/ActionButton/ActionButton';
import { ConfirmDialog } from '../../../../components/ConfirmDialog/ConfirmDialog';
import { TableSkeleton } from '../../../../components/TableSkeleton/TableSkeleton';
import { RingEmptyState } from '../../../../components/RingEmptyState/RingEmptyState';
import { toast } from '../../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../../store/useAppStore';
import { tagBadgeStyle } from './contactTags';
import styles from './Tags.module.css';

const COLUMNS = [
  { key: 'name', label: 'Name', width: 280 },
  { key: 'description', label: 'Description' },
  { key: 'color', label: 'Color', width: 180 },
  { key: 'actions', label: 'Actions', sticky: 'right', width: 96 },
];

/**
 * Settings > Member/Leads > Tags (Figma Settings 516:2137): the practice's
 * member tags, with Edit and Delete in the Actions column.
 *
 * @param {string} props.search
 * @param {(tag: object) => void} props.onEdit
 */
export function TagsTable({ search = '', onEdit }) {
  const tags = useAppStore(s => s.contactTags);
  const loading = useAppStore(s => s.contactTagsLoading);
  const didFetch = useAppStore(s => s.contactTagsDidFetch);
  const fetchContactTags = useAppStore(s => s.fetchContactTags);
  const deleteContactTag = useAppStore(s => s.deleteContactTag);
  useEffect(() => { fetchContactTags(); }, [fetchContactTags]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [deleting, setDeleting] = useState(null);

  const q = search.trim().toLowerCase();
  const filtered = q ? tags.filter(t => `${t.name} ${t.description}`.toLowerCase().includes(q)) : tags;
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / perPage)));
  const paged = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  const renderRow = (t) => (
    <tr key={t.id} className={styles.row}>
      <td className={styles.td}><Badge size="S" label={t.name} style={tagBadgeStyle(t.color)} /></td>
      <td className={`${styles.td} ${styles.desc}`}>{t.description}</td>
      <td className={styles.td}>
        <span className={styles.colorCell}>
          <span className={styles.dot} style={{ background: t.color }} />
          {t.color}
        </span>
      </td>
      <td className={`${styles.td} ${styles.tdActions}`}>
        <span className={styles.actions}>
          <ActionButton icon="solar:pen-linear" size="sm" tooltip="Edit" onClick={() => onEdit(t)} />
          <span className={styles.actionDivider} />
          <ActionButton icon="solar:trash-bin-trash-linear" size="sm" tooltip="Delete" tooltipLeft onClick={() => setDeleting(t)} />
        </span>
      </td>
    </tr>
  );

  if (loading && !didFetch) return <TableSkeleton rows={8} />;
  if (!tags.length) return <RingEmptyState icon="solar:tag-linear" label="Create your first tag" />;

  return (
    <>
      <WorklistShell
        header={null}
        columns={COLUMNS}
        rows={paged}
        renderRow={renderRow}
        page={currentPage}
        perPage={perPage}
        totalItems={filtered.length}
        onPageChange={setPage}
        onPageSizeChange={(n) => { setPerPage(n); setPage(1); }}
        emptyState={<RingEmptyState icon="solar:tag-linear" label={`No tags match "${search}"`} />}
        fixedLayout
        minTableWidth={900}
      />
      {deleting && (
        <ConfirmDialog
          variant="destructive"
          title={`Delete "${deleting.name}"?`}
          description="The tag is removed from every member who has it."
          confirmLabel="Delete Tag"
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            const ok = await deleteContactTag(deleting.id);
            if (ok) toast.success('Tag Deleted Successfully');
            else toast.error('The tag could not be deleted. Try again.');
            setDeleting(null);
          }}
        />
      )}
    </>
  );
}
