import { useMemo, useState } from 'react';
import { WorklistShell } from './WorklistShell';
import { FilterChip } from '../FilterChip/FilterChip';
import { Avatar } from '../Avatar/Avatar';
import { Badge } from '../Badge/Badge';
import { ActionButton } from '../ActionButton/ActionButton';
import { Checkbox } from '../ShadcnCheckbox/ShadcnCheckbox';
import { Icon } from '../Icon/Icon';
import { useTableSort } from '../SortableHeader/useTableSort';
import styles from './WorklistShell.stories.module.css';

export default {
  title: 'Composed/WorklistShell',
  component: WorklistShell,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The shared outer chrome for every worklist in the app (TOC, HCC, CCM, HEDIS, AWV, …). ' +
          'Bundles the header (active tab title + Search / Filter / History / Export icons), an optional ' +
          'filter chip row, a sticky-column table body, BulkBar, and Pagination. Callers plug in the ' +
          'columns, row renderer, filter chips, and selection / pagination state. ' +
          'Reach for this whenever building a new worklist so all tables share one chrome. ' +
          'Use the `state` control to flip between the populated, loading-skeleton, and empty views.',
      },
    },
  },
  argTypes: {
    state: {
      control: { type: 'select' },
      options: ['default', 'loading', 'empty'],
      description: 'Shell state: populated table, loading skeleton, or empty message.',
    },
  },
  args: { state: 'default' },
};

// ── Sample data — patient-like rows so the story mirrors the real feature ──
const SAMPLE_MEMBERS = [
  { id: 'm-1', initials: 'AB', name: 'Annette Brave',    memberId: '#837261495203', gender: 'M', age: '67y 3m', status: 'New',      assignee: 'Ignacio Beer', startDate: '02/22', mins: 1089 },
  { id: 'm-2', initials: 'DW', name: 'Derek Winslow',    memberId: '#846273915048', gender: 'M', age: '34y 1m', status: 'Engaged',  assignee: 'Ignacio Beer', startDate: '11/11', mins: 1500 },
  { id: 'm-3', initials: 'SL', name: 'Sophie Langley',   memberId: '#675849203716', gender: 'F', age: '29y 6m', status: 'Engaged',  assignee: 'Robin Berg',   startDate: '08/14', mins: 960 },
  { id: 'm-4', initials: 'LH', name: 'Lila Hawthorne',   memberId: '#739218465037', gender: 'M', age: '58y 2m', status: 'New',      assignee: 'You',          startDate: '04/18', mins: 1260 },
  { id: 'm-5', initials: 'VH', name: 'Victor Hargrove',  memberId: '#582374196205', gender: 'F', age: '72y 5m', status: 'Enrolled', assignee: 'Ignacio Beer', startDate: '10/30', mins: 1860 },
  { id: 'm-6', initials: 'NC', name: 'Nina Caldwell',    memberId: '#918273645102', gender: 'M', age: '77y 9m', status: 'Enrolled', assignee: 'Robin Berg',   startDate: '04/25', mins: 840 },
  { id: 'm-7', initials: 'OG', name: 'Oliver Grant',     memberId: '#203948576291', gender: 'M', age: '68y 0m', status: 'Engaged',  assignee: 'You',          startDate: '01/01', mins: 2940 },
];

const STATUS_VARIANT = {
  'New':      { variant: 'toc-new',      label: 'New',      icon: 'solar:star-bold' },
  'Engaged':  { variant: 'toc-engaged',  label: 'Engaged',  icon: 'solar:link-round-bold' },
  'Enrolled': { variant: 'toc-enrolled', label: 'Enrolled', icon: 'solar:check-circle-bold' },
};

const fmtMins = (s) => {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')} mins`;
};

const COLUMNS = [
  { key: 'check',    label: '',              showCheckbox: true, sticky: 'left', left: 0, width: 36 },
  { key: 'members',  label: 'Members',       sortKey: 'name',    sticky: 'left', left: 36 },
  { key: 'status',   label: 'Status',        sortKey: 'status' },
  { key: 'assignee', label: 'Assignee' },
  { key: 'start',    label: 'Start Date',    sortKey: 'startDate' },
  { key: 'mins',     label: 'Billable Mins', sortKey: 'mins' },
  { key: 'actions',  label: 'Actions',       sticky: 'right',    width: 100 },
];

export const Playground = {
  render: ({ state }) => {
    const [rows] = useState(SAMPLE_MEMBERS);
    const [searchValue, setSearchValue] = useState('');
    const [showFilters, setShowFilters] = useState(true);
    const [selectedIds, setSelectedIds] = useState([]);
    const [statusFilter, setStatusFilter] = useState([]);
    const [assigneeFilter, setAssigneeFilter] = useState([]);
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(10);

    // Apply search + filter chips, then sort via the shared hook.
    const filtered = useMemo(() => {
      let list = rows;
      const q = searchValue.trim().toLowerCase();
      if (q) list = list.filter(r => (r.name + r.memberId).toLowerCase().includes(q));
      if (statusFilter.length)   list = list.filter(r => statusFilter.includes(r.status));
      if (assigneeFilter.length) list = list.filter(r => assigneeFilter.includes(r.assignee));
      return list;
    }, [rows, searchValue, statusFilter, assigneeFilter]);

    const { sorted, sortKey, sortDir, requestSort } = useTableSort(filtered, 'name', 'asc');
    const pageRows = sorted.slice((page - 1) * perPage, page * perPage);

    const handleSelectAll = (checked) => {
      const ids = pageRows.map(r => r.id);
      if (checked) setSelectedIds((prev) => [...new Set([...prev, ...ids])]);
      else setSelectedIds((prev) => prev.filter(id => !ids.includes(id)));
    };
    const toggleOne = (id) =>
      setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

    const statusOptions   = [...new Set(rows.map(r => r.status))];
    const assigneeOptions = [...new Set(rows.map(r => r.assignee))];

    const renderRow = (r) => {
      const cfg = STATUS_VARIANT[r.status] || STATUS_VARIANT['New'];
      const selected = selectedIds.includes(r.id);
      return (
        <tr key={r.id} className={styles.row}>
          <td className={`${styles.td} ${styles.stickyLeft}`} style={{ left: 0 }}>
            <Checkbox checked={selected} onCheckedChange={() => toggleOne(r.id)} aria-label={`Select ${r.name}`} />
          </td>
          <td className={`${styles.td} ${styles.stickyLeft} ${styles.memberTd}`} style={{ left: 36 }}>
            <div className={styles.memberCell}>
              <Avatar variant="patient" initials={r.initials} />
              <div>
                <div className={styles.memberName}>
                  {r.name} <span className={styles.memberDemo}>({r.gender} · {r.age})</span>
                </div>
                <div className={styles.memberMeta}>{r.memberId}</div>
              </div>
            </div>
          </td>
          <td className={styles.td}><Badge variant={cfg.variant} label={cfg.label} icon={cfg.icon} /></td>
          <td className={styles.td}>{r.assignee}</td>
          <td className={styles.td}>{r.startDate}</td>
          <td className={styles.td}>{fmtMins(r.mins)}</td>
          <td className={`${styles.td} ${styles.stickyRight}`}>
            <div className={styles.rowActions}>
              <ActionButton icon="solar:document-text-linear" size="L" tooltip="View" />
              <span className={styles.actionDivider} />
              <ActionButton icon="solar:phone-linear" size="L" tooltip="Call" />
              <span className={styles.actionDivider} />
              <ActionButton icon="solar:menu-dots-linear" size="L" tooltip="More" />
            </div>
          </td>
        </tr>
      );
    };

    const emptyState = (
      <div className={styles.empty}>
        <Icon name="solar:magnifer-linear" size={40} color="var(--neutral-200)" />
        <p className={styles.emptyTitle}>No results found</p>
        <p className={styles.emptyText}>No members match your current filters.</p>
      </div>
    );

    // The `state` control swaps between the three shell modes. Branching
    // happens AFTER every hook above so React's hook order stays stable
    // when the control changes.
    if (state === 'loading') {
      return (
        <div style={{ height: '100vh', display: 'flex' }}>
          <WorklistShell title="Sample Worklist" columns={COLUMNS} loading perPage={8} />
        </div>
      );
    }
    if (state === 'empty') {
      return (
        <div style={{ height: '100vh', display: 'flex' }}>
          <WorklistShell
            title="Sample Worklist"
            columns={COLUMNS}
            rows={[]}
            renderRow={() => null}
            emptyState={
              <div style={{ padding: 60, textAlign: 'center', color: 'var(--neutral-300)' }}>
                No members yet. New patients will appear here once enrolled.
              </div>
            }
          />
        </div>
      );
    }

    return (
      <div style={{ height: '100vh', display: 'flex' }}>
        <WorklistShell
          title="Sample Worklist"
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          searchPlaceholder="Search by member name…"
          showFilters={showFilters}
          onToggleFilters={setShowFilters}
          onHistory={() => alert('History — coming soon')}
          onExport={() => alert('Export — coming soon')}
          filters={
            <>
              <FilterChip label="Status"   options={statusOptions}   selected={statusFilter}   onChange={setStatusFilter} />
              <FilterChip label="Assignee" options={assigneeOptions} selected={assigneeFilter} onChange={setAssigneeFilter} />
            </>
          }
          columns={COLUMNS}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={requestSort}
          rows={pageRows}
          renderRow={renderRow}
          emptyState={emptyState}
          selectedIds={selectedIds}
          onSelectAll={handleSelectAll}
          onClearSelection={() => setSelectedIds([])}
          page={page}
          perPage={perPage}
          totalItems={filtered.length}
          onPageChange={setPage}
          onPageSizeChange={(n) => { setPerPage(n); setPage(1); }}
          minTableWidth={900}
        />
      </div>
    );
  },
};
