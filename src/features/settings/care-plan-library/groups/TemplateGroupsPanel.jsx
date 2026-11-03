import { useEffect, useMemo, useState } from 'react';
import { SectionTitleBar } from '../../../../components/SectionTitleBar/SectionTitleBar';
import { WorklistShell } from '../../../../components/WorklistShell/WorklistShell';
import { Badge } from '../../../../components/Badge/Badge';
import { BadgeRow } from '../../../../components/BadgeRow/BadgeRow';
import { ActionButton } from '../../../../components/ActionButton/ActionButton';
import { Alert } from '../../../../components/Alert/Alert';
import { Icon } from '../../../../components/Icon/Icon';
import { TableSkeleton } from '../../../../components/TableSkeleton/TableSkeleton';
import { RingEmptyState } from '../../../../components/RingEmptyState/RingEmptyState';
import { ConfirmDialog } from '../../../../components/ConfirmDialog/ConfirmDialog';
import { useAppStore } from '../../../../store/useAppStore';
import { useCanManageTemplates } from '../lib/useCanManageTemplates';
import { TemplateGroupDrawer } from './TemplateGroupDrawer';
import styles from './TemplateGroups.module.css';

const COLUMNS = [
  { key: 'name', label: 'Group', sticky: 'left', left: 0, width: 280 },
  { key: 'templates', label: 'Templates', width: 420 },
  { key: 'version', label: 'Version', width: 100 },
  { key: 'updated', label: 'Last Update', width: 200 },
  { key: 'actions', label: 'Actions', sticky: 'right', width: 100 },
];

const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '-');

/**
 * Care Plan Library > Template Groups: named bundles of templates a care
 * manager applies to a plan in one click. Supervisors create and edit them;
 * changing a group's members makes a new version.
 *
 * Rendered as one of the library's tabs, so it draws the library's tab strip.
 */
export function TemplateGroupsPanel({ tabs, activeTab, onTabChange }) {
  const groups = useAppStore(s => s.templateGroups);
  const loading = useAppStore(s => s.templateGroupsLoading);
  const didFetch = useAppStore(s => s.templateGroupsDidFetch);
  const missing = useAppStore(s => s.templateGroupsMissing);
  const fetchTemplateGroups = useAppStore(s => s.fetchTemplateGroups);
  const deleteTemplateGroup = useAppStore(s => s.deleteTemplateGroup);
  const templates = useAppStore(s => s.carePlanTemplates);
  const libraryDidFetch = useAppStore(s => s.carePlanLibraryDidFetch);
  const fetchCarePlanLibrary = useAppStore(s => s.fetchCarePlanLibrary);
  const showToast = useAppStore(s => s.showToast);
  const canManage = useCanManageTemplates();
  useEffect(() => { fetchTemplateGroups(); }, [fetchTemplateGroups]);
  useEffect(() => { if (!libraryDidFetch) fetchCarePlanLibrary(); }, [libraryDidFetch, fetchCarePlanLibrary]);

  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | group
  const [deleting, setDeleting] = useState(null);

  const nameOf = useMemo(() => {
    const map = new Map((templates || []).map(t => [String(t.id), t]));
    return id => map.get(id);
  }, [templates]);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (groups || []).filter(g => !q || g.name.toLowerCase().includes(q)
      || g.templateIds.some(id => (nameOf(id)?.name || '').toLowerCase().includes(q)));
  }, [groups, search, nameOf]);

  const renderRow = (g) => {
    const members = g.templateIds.map(nameOf);
    const retired = members.filter(t => t?.status === 'archived').length;
    return (
      <tr key={g.id} className={styles.row}>
        <td className={`${styles.td} ${styles.tdName}`}>
          <span className={styles.nameCell}>
            <button type="button" className={styles.nameLink} onClick={() => setEditing(g)}>{g.name}</button>
            {g.description && <span className={styles.nameSub}>{g.description}</span>}
          </span>
        </td>
        <td className={styles.td}>
          <span className={styles.members}>
            <BadgeRow items={members.map(t => t?.name || 'Deleted template')} maxLines={2} />
            {retired > 0 && <Badge tone="warning" size="sm" label={`${retired} retired`} />}
          </span>
        </td>
        <td className={styles.td}><Badge size="sm" label={`v${g.versionNumber}`} /></td>
        <td className={`${styles.td} ${styles.nowrap}`}>{fmt(g.updatedAt)}{g.updatedBy ? ` · ${g.updatedBy}` : ''}</td>
        <td className={`${styles.td} ${styles.tdActions}`}>
          <span className={styles.actionCell}>
            <ActionButton icon={canManage ? 'solar:pen-linear' : 'solar:eye-linear'} size="sm" tooltip={canManage ? 'Edit' : 'View'} onClick={() => setEditing(g)} />
            {canManage && <ActionButton icon="solar:trash-bin-trash-linear" size="sm" tooltip="Delete" tooltipLeft onClick={() => setDeleting(g)} />}
          </span>
        </td>
      </tr>
    );
  };

  return (
    <div className={styles.wrapper}>
      <SectionTitleBar
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={onTabChange}
        actions={['search']}
        searchPlaceholder="Search groups…"
        searchValue={search}
        onSearchChange={setSearch}
        primaryActionLabel={canManage && !missing ? 'New Group' : undefined}
        onPrimaryAction={() => setEditing('new')}
      />
      {missing && (
        <div className={styles.notice}>
          <Alert tone="info" message="Template groups need supabase/care_plan_template_groups_migration.sql." />
        </div>
      )}
      <div className={styles.content}>
        {loading && !didFetch ? <TableSkeleton rows={6} /> : !missing && (groups || []).length === 0 ? (
          <div className={styles.empty}>
            <RingEmptyState icon="solar:folder-with-files-linear" label="No Template Groups" />
            <p className={styles.emptyHint}>Bundle templates that go together, like Diabetes + Hypertension + SDOH, so a care manager adds them to a plan in one click.</p>
          </div>
        ) : (
          <WorklistShell
            header={null}
            columns={COLUMNS}
            rows={rows}
            renderRow={renderRow}
            emptyState={(
              <div className={styles.emptyState}>
                <Icon name="solar:folder-with-files-linear" size={32} color="var(--neutral-150)" />
                <p>No groups match "<strong>{search.trim()}</strong>".</p>
              </div>
            )}
            minTableWidth={1100}
          />
        )}
      </div>
      {editing && (
        <TemplateGroupDrawer
          group={editing === 'new' ? null : editing}
          readOnly={!canManage}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          variant="destructive"
          title={`Delete "${deleting.name}"?`}
          description="Care managers can no longer apply it. Plans that used it keep their templates."
          confirmLabel="Delete"
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            if (await deleteTemplateGroup(deleting.id)) showToast?.(`"${deleting.name}" deleted`);
            setDeleting(null);
          }}
        />
      )}
    </div>
  );
}
