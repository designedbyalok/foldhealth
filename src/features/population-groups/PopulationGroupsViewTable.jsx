import { Input as FoldInput } from '../../components/Input/Input';
import { Button } from '../../components/Button/Button';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { SearchIconButton } from '../../components/SearchIconButton/SearchIconButton';
import { WorklistShell } from '../../components/WorklistShell/WorklistShell';
import { PopulationGroupsRow } from './PopulationGroupsRow.jsx';
import { BulkSelectIcon } from './PopulationGroupsViewPanels.jsx';
import { ConfirmDialog } from '../../components/ConfirmDialog/ConfirmDialog';
import { FOLD_DB_MAP } from './data/fold-db.js';

/* Export a group's members as CSV — same columns the edit drawer's download
   produces, so a list exported here can be re-uploaded by the create flow. */
function downloadMemberList(group, showToast) {
  const members = (group.memberIds || []).flatMap(id => {
    const p = FOLD_DB_MAP[String(id).toUpperCase()];
    return p ? [p] : [];
  });
  if (members.length === 0) {
    showToast(`${group.name} has no member list to download`);
    return;
  }
  const rows = members.map(m => {
    const [first, ...rest] = (m.name || '').split(' ');
    return [m.id, first || '', rest.join(' '), m.dob || ''].join(',');
  });
  const blob = new Blob([['Patient ID,First Name,Last Name,DOB', ...rows].join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${group.name.replace(/[^\w\s-]/g, '').trim() || 'population-group'}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const Input = (props) => <FoldInput {...props} />;

// WorklistShell column defs — sticky checkbox + Group Name on the left,
// sticky Action column on the right, sortable member counts + dates.
// Same shape TOC / AWV use so the sticky-column scroll behaviour matches.
// Group names are long enough to wrap to the clamped second line, so the name
// column takes the width freed by the member-count columns — those hold 2–3
// digits and only need room for their own headers. Dates are date-only now,
// so they need less than the old timestamp width too.
const POP_COLUMNS = [
  { key: 'select',   showCheckbox: true, sticky: 'left', left: 0, width: 36 },
  { key: 'name',     label: 'Group Name', sticky: 'left', left: 36, width: 420 },
  { key: 'count',    label: 'Active Members',   sortKey: 'count',      sortType: 'number', width: 130 },
  { key: 'inactive', label: 'Inactive Members', sortKey: 'inactive',   sortType: 'number', width: 140 },
  { key: 'type',     label: 'Type', width: 110 },
  { key: 'created',  label: 'Created Date',     sortKey: '_createdTs', sortType: 'date', width: 130 },
  { key: 'updated',  label: 'Updated Date',     sortKey: '_updatedTs', sortType: 'date', width: 130 },
  { key: 'actions',  label: 'Action', sticky: 'right', width: 150 },
];

export function PopulationGroupsViewTable({ vm, onToggleSidebar }) {
  const {
    searchQuery, setSearchQuery, searchOpen, setSearchOpen,
    checkedRows, setCheckedRows,
    setPopPage, popPageSize, setPopPageSize,
    pgSortKey, pgSortDir, pgRequestSort,
    safePg, pagedGroups, totalGroups, popGroupsLoading,
    openEditModal, openNewModal, showToast,
    deleteTargets, setDeleteTargets, deleting, confirmDelete,
  } = vm;

  const selectedIds = [...checkedRows];

  const handleSelectAll = (checked) => {
    setCheckedRows(prev => {
      const next = new Set(prev);
      pagedGroups.forEach(g => { if (checked) next.add(g.id); else next.delete(g.id); });
      return next;
    });
  };

  /* ── Sub-header ── (left padding tuned so the collapse icon's left edge aligns with the table checkbox) */
  const header = (
    <div style={{ padding:'10px 20px 10px 6px', borderBottom:'0.5px solid var(--neutral-150)', display:'flex', alignItems:'center', flexShrink:0 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
        <ActionButton icon="solar:sidebar-minimalistic-linear" size="L" tooltip="Collapse sidebar" iconColor="var(--neutral-300)" onClick={onToggleSidebar} />
        <span style={{ fontSize:16, fontWeight:600, color:'var(--neutral-400)' }}>Population Groups</span>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0, marginLeft:'auto' }}>
        {/* ── Search groups — icon expands to a text field on click (same as app-wide search) ── */}
        {searchOpen ? (
          <Input
            autoFocus
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onBlur={() => { if (!searchQuery.trim()) setSearchOpen(false); }}
            placeholder="Search groups..."
            style={{ width: 220 }}
          />
        ) : (
          <SearchIconButton title="Search groups" onClick={() => setSearchOpen(true)} />
        )}

        <span style={{ width: 1, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />

        {/* ── Create Group — opens the file-upload workflow (error card / all-matched review) ── */}
        <Button variant="secondary" size="L" leadingIcon="solar:add-circle-linear" onClick={openNewModal}>Create Group</Button>

        <span style={{ width: 1, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />

        {/* Import Rule — neutral button, no icon */}
        <Button variant="secondary" size="L">Import Rule</Button>

        <span style={{ width: 1, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />

        {/* Bulk actions icon — matches Settings → Content bulk-select icon (neutral-300) */}
        <ActionButton size="L" tooltip="Bulk actions" style={{ color: 'var(--neutral-300)' }}><BulkSelectIcon /></ActionButton>
      </div>
    </div>
  );

  const deleteCount = deleteTargets.length;

  return (
    <>
    <WorklistShell
      header={header}
      columns={POP_COLUMNS}
      sortKey={pgSortKey}
      sortDir={pgSortDir}
      onSort={pgRequestSort}
      rows={pagedGroups}
      renderRow={(g) => (
        <PopulationGroupsRow
          key={g.id}
          group={g}
          selected={checkedRows.has(g.id)}
          onToggle={() => setCheckedRows(prev => { const n = new Set(prev); if (n.has(g.id)) n.delete(g.id); else n.add(g.id); return n; })}
          onEdit={() => openEditModal(g, { startInEdit: true })}
          onRowClick={g.type === 'Dynamic' ? () => openEditModal(g) : undefined}
          onDelete={() => setDeleteTargets([g])}
          onDownload={() => downloadMemberList(g, showToast)}
        />
      )}
      loading={popGroupsLoading && pagedGroups.length === 0}
      emptyState="No groups match the current filters."
      selectedIds={selectedIds}
      onSelectAll={handleSelectAll}
      onClearSelection={() => setCheckedRows(new Set())}
      bulkActions={[
        { label: 'Run Automation', icon: 'solar:bolt-linear', onClick: () => showToast('Run Automation — coming soon') },
        { label: 'Delete', icon: 'solar:trash-bin-minimalistic-linear', variant: 'destructive', onClick: () => setDeleteTargets(pagedGroups.filter(g => checkedRows.has(g.id))) },
      ]}
      page={safePg}
      perPage={popPageSize}
      totalItems={totalGroups}
      onPageChange={setPopPage}
      onPageSizeChange={(n) => { setPopPageSize(n); setPopPage(1); }}
      minTableWidth={900}
    />

    {deleteCount > 0 && (
      <ConfirmDialog
        variant="destructive"
        title={deleteCount === 1 ? 'Delete this population group?' : `Delete ${deleteCount} population groups?`}
        description={deleteCount === 1
          ? `"${deleteTargets[0].name}" and its member list will be permanently removed. This can't be undone.`
          : `These groups and their member lists will be permanently removed. This can't be undone.`}
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTargets([])}
      />
    )}
    </>
  );
}
