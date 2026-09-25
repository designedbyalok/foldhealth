import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../../components/Icon/Icon';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { WorklistShell } from '../../../components/WorklistShell/WorklistShell';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { useAppStore } from '../../../store/useAppStore';
import { withReportHeader, withReportFooter } from '../../email-builder/reportHeaderComponent';
import styles from './ContentSettings.module.css';

const COMPONENT_COLUMNS = [
  { key: 'name',    label: 'Name',         sticky: 'left', left: 0, width: 360 },
  { key: 'type',    label: 'Type',         width: 180 },
  { key: 'default', label: 'Default',      width: 140 },
  { key: 'updated', label: 'Last Updated', width: 180 },
  { key: 'action',  label: 'Actions',      sticky: 'right', width: 120 },
];
const TYPE_LABEL = { header: 'Header', footer: 'Footer', report_header: 'Report Header', report_footer: 'Report Footer' };

const shortDate = (iso) => {
  if (!iso) return '–';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '–';
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
};

/**
 * Settings → Content → Components: saved headers and footers
 * (email_header_footer_presets). New and Edit open the email builder in
 * component mode, where the name, type and default are set.
 */
export function ComponentsTab({ searchVal }) {
  const headers = useAppStore(s => s.customHeaderPresets);
  const footers = useAppStore(s => s.customFooterPresets);
  const reportHeaders = useAppStore(s => s.customReportHeaderPresets);
  const reportFooters = useAppStore(s => s.customReportFooterPresets);
  const loaded = useAppStore(s => s.customPresetsLoaded);
  const fetchCustomPresets = useAppStore(s => s.fetchCustomPresets);
  const openComponentBuilder = useAppStore(s => s.openComponentBuilder);
  const deleteCustomPreset = useAppStore(s => s.deleteCustomPreset);
  const showToast = useAppStore(s => s.showToast);

  // The page resets to 1 whenever the search changes.
  const [paging, setPaging] = useState({ search: searchVal, page: 1 });
  const page = paging.search === searchVal ? paging.page : 1;
  const setPage = (n) => setPaging({ search: searchVal, page: n });
  const [perPage, setPerPage] = useState(10);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => { fetchCustomPresets(); }, [fetchCustomPresets]);

  const rows = useMemo(() => {
    // The report header and footer show from their local definitions until seeded.
    const all = [...headers, ...footers, ...withReportHeader(reportHeaders), ...withReportFooter(reportFooters)];
    const q = (searchVal || '').trim().toLowerCase();
    return all
      .filter(c => !q || c.label.toLowerCase().includes(q))
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  }, [headers, footers, reportHeaders, reportFooters, searchVal]);
  const pageRows = rows.slice((page - 1) * perPage, page * perPage);

  const renderRow = (c) => (
    <tr key={c.id} className={styles.row}>
      <td className={styles.tdName}>
        <div
          className={styles.nameLink}
          role="button"
          tabIndex={0}
          onClick={() => openComponentBuilder(c)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openComponentBuilder(c); } }}
        >
          <div className={styles.nameLeading}>
            <Icon name={c.role.endsWith('footer') ? 'solar:widget-2-linear' : 'solar:widget-linear'} size={16} color="var(--neutral-300)" />
          </div>
          <div className={styles.nameStack}>
            <span className={styles.nameText}>{c.label}</span>
          </div>
        </div>
      </td>
      <td><span className={styles.cellText}>{TYPE_LABEL[c.role] || c.role}</span></td>
      <td><span className={styles.cellText}>{c.isDefault ? 'Yes' : 'No'}</span></td>
      <td className={styles.tdDate}><span className={styles.cellText}>{shortDate(c.updatedAt)}</span></td>
      <td className={styles.tdAction}>
        <div className={styles.actionCell}>
          <ActionButton icon="solar:pen-linear" size="S" tooltip="Edit component" onClick={() => openComponentBuilder(c)} />
          {!c.isLocal && (
            <>
              <div className={styles.vDivider} />
              <ActionButton icon="solar:trash-bin-trash-linear" size="S" tooltip="Delete component" onClick={() => setDeleteTarget(c)} />
            </>
          )}
        </div>
      </td>
    </tr>
  );

  return (
    <>
      <WorklistShell
        header={null}
        columns={COMPONENT_COLUMNS}
        rows={pageRows}
        renderRow={renderRow}
        loading={!loaded}
        emptyState={
          <div className={styles.emptyState}>
            <Icon name="solar:widget-linear" size={32} color="var(--neutral-150)" />
            <p>No components match your search.</p>
          </div>
        }
        page={page}
        perPage={perPage}
        totalItems={rows.length}
        onPageChange={setPage}
        onPageSizeChange={(n) => { setPerPage(n); setPage(1); }}
        minTableWidth={980}
      />
      {deleteTarget && (
        <ConfirmDialog
          icon="solar:danger-triangle-linear"
          iconColor="var(--status-error)"
          title={`Delete "${deleteTarget.label}"?`}
          description="This permanently removes the component. Emails and reports already made with it keep their copy."
          confirmLabel="Delete"
          cancelLabel="Cancel"
          variant="error"
          onConfirm={async () => {
            const ok = await deleteCustomPreset(deleteTarget.id, deleteTarget.role);
            if (ok) showToast('Component deleted');
            setDeleteTarget(null);
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}
