import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { WorklistRow, WORKLIST_MIDDLE_COLUMNS } from './WorklistRow';
import { BulkBar } from '../../../components/BulkBar/BulkBar';
import { TableSkeleton } from '../../../components/TableSkeleton/TableSkeleton';
import { EmptyState } from '../../../components/EmptyState/EmptyState';
import { Button } from '../../../components/Button/Button';
import { Icon } from '../../../components/Icon/Icon';
import { Checkbox } from '../../../components/Checkbox/Checkbox';
import { HeaderCell } from '../../../components/HeaderCell/HeaderCell';
import { ColumnsHeaderButton } from '../../../components/WorklistColumns/ColumnsHeaderButton';
import { useWorklistColumns } from '../../worklists/useWorklistColumns';

function EmptySearch() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '64px 24px', gap: 12, color: 'var(--neutral-300)',
    }}>
      <Icon name="solar:magnifer-linear" size={40} color="var(--neutral-200)" />
      <p style={{ fontSize: 'var(--font-lg)', fontWeight: 500, color: 'var(--neutral-400)', margin: 0 }}>
        No results found
      </p>
      <p style={{ fontSize: 'var(--font-base)', margin: 0, textAlign: 'center', maxWidth: 320 }}>
        No members match your current filters. Try adjusting the filters or clearing them.
      </p>
    </div>
  );
}

function parseTimeLeft(str) {
  if (!str) return Infinity;
  let mins = 0;
  const d = str.match(/(\d+)d/);
  const h = str.match(/(\d+)h/);
  const m = str.match(/(\d+)m/);
  if (d) mins += parseInt(d[1]) * 1440;
  if (h) mins += parseInt(h[1]) * 60;
  if (m) mins += parseInt(m[1]);
  return mins;
}

const STATUS_SECTIONS = [
  { key: 'oncall', label: 'Ongoing Call', icon: 'solar:phone-calling-bold', color: '#059669', dot: true },
  { key: 'queued', label: 'In Queue', icon: 'solar:clock-circle-bold', color: '#8B5CF6', dot: true },
  { key: 'scheduled', label: 'Scheduled', icon: 'solar:calendar-bold', color: '#2563EB', dot: true },
  { key: 'attention', label: 'Needs Attention', icon: 'solar:danger-triangle-bold', color: '#D97706', dot: false },
  { key: 'enrolled', label: 'Enrolled', icon: 'solar:verified-check-bold', color: '#059669', dot: false },
];

const SECTION_ORDER = { oncall: 0, queued: 1, scheduled: 2, attention: 3, enrolled: 4 };

function getStatusSection(patient) {
  if (patient.status === 'oncall') return 'oncall';
  if (patient.status === 'queued') return 'queued';
  if (patient.status === 'failed' || patient.status === 'review') return 'attention';
  if (patient.status === 'completed') return 'enrolled';
  if (patient.tocStatus === 'enrolled') return 'enrolled';
  return 'scheduled';
}

const DEFAULT_VISIBLE = 3;

const HEADER_STICKY_STYLE = {
  borderBottom: '1px solid var(--neutral-150)',
  position: 'sticky',
  top: 0,
  zIndex: 2,
};

function SectionHeader({ section, count, colSpan, isExpanded, onToggle, hasMore }) {
  return (
    <tr>
      <td colSpan={colSpan} style={{
        padding: '10px 14px',
        background: 'var(--neutral-25, #FAFAFA)',
        borderBottom: '1px solid var(--neutral-150)',
        borderTop: '1px solid var(--neutral-150)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 'var(--font-md)', fontWeight: 500, color: section.color,
          fontFamily: "'Inter', sans-serif",
        }}>
          {section.dot ? (
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: section.color, flexShrink: 0,
            }} />
          ) : (
            <Icon name={section.icon} size={15} color={section.color} />
          )}
          {section.label}
          <span style={{
            fontSize: 'var(--font-xs)', fontWeight: 500, color: 'var(--neutral-300)',
            background: 'var(--neutral-100)', padding: '1px 6px',
            borderRadius: 4, marginLeft: 2,
          }}>
            {count}
          </span>
          {hasMore && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
              style={{
                marginLeft: 'auto', background: 'none', border: 'none',
                fontSize: 'var(--font-sm)', fontWeight: 500, color: 'var(--primary-300)',
                cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}
            >
              {isExpanded ? 'Show less' : `Show all ${count}`}
              <Icon name={isExpanded ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'} size={14} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

export function WorklistTable() {
  const patients = useAppStore(s => s.patients);
  const patientsLoading = useAppStore(s => s.patientsLoading);
  const patientsError = useAppStore(s => s.patientsError);
  const fetchPatients = useAppStore(s => s.fetchPatients);
  // `fetchPatients` was only wired to the error state's retry, the initial load
  // came from SubNav prefetching `patients` on every Population route. SubNav
  // fetches counts only now, so this table owns its own data. Store-guarded
  // single-fire, so the retry path still works and costs nothing extra.
  useEffect(() => { fetchPatients(); }, [fetchPatients]);
  const selectedIds = useAppStore(s => s.selectedIds);
  const selectPatient = useAppStore(s => s.selectPatient);
  const selectAll = useAppStore(s => s.selectAll);
  const clearSelected = useAppStore(s => s.clearSelected);
  const viewBy = useAppStore(s => s.viewBy);
  const currentPage = useAppStore(s => s.currentPage);
  const perPage = useAppStore(s => s.perPage);
  const searchQuery = useAppStore(s => s.searchQuery);
  const activeFilters = useAppStore(s => s.activeFilters);
  const [expandedSections, setExpandedSections] = useState({});

  // Patients are fetched once by SubNav on mount, no per-tab fetch effect
  // here (the store's `patientsDidFetch` guard would short-circuit anyway,
  // but skipping the call avoids the effect-churn entirely).
  const toggleExpand = (key) => setExpandedSections(s => ({ ...s, [key]: !s[key] }));

  const filteredPatients = useMemo(() => {
    let result = patients;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.memberId?.toLowerCase().includes(q) ||
        p.initials?.toLowerCase().includes(q)
      );
    }

    for (const [key, value] of Object.entries(activeFilters)) {
      if (value) {
        result = result.filter(p => String(p[key]) === String(value));
      }
    }

    if (viewBy === 'window') {
      result = result.toSorted((a, b) => parseTimeLeft(a.outreachLeft) - parseTimeLeft(b.outreachLeft));
    } else {
      result = result.toSorted((a, b) => {
        const sa = SECTION_ORDER[getStatusSection(a)] ?? 5;
        const sb = SECTION_ORDER[getStatusSection(b)] ?? 5;
        if (sa !== sb) return sa - sb;
        return parseTimeLeft(a.outreachLeft) - parseTimeLeft(b.outreachLeft);
      });
    }

    return result;
  }, [patients, searchQuery, activeFilters, viewBy]);

  // For window view, paginate normally
  const startIdx = (currentPage - 1) * perPage;
  const paginatedPatients = filteredPatients.slice(startIdx, startIdx + perPage);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const visiblePatients = viewBy === 'status' ? filteredPatients : paginatedPatients;
  const allIds = visiblePatients.map(p => p.id);
  const allSelected = allIds.length > 0 && allIds.every(id => selectedIdSet.has(id));
  const someSelected = selectedIds.length > 0 && !allSelected;

  const handleSelectAll = (checked) => {
    if (checked) selectAll(allIds);
    else clearSelected();
  };

  // Column prefs: WorklistTable is bespoke (doesn't ride WorklistShell), so
  // we call useWorklistColumns directly for the middle-column band. The
  // sticky checkbox / Members / Actions columns bracket it.
  const columnPrefs = useWorklistColumns('tcm-worklist', WORKLIST_MIDDLE_COLUMNS);
  const visibleMiddle = columnPrefs.visibleColumns;
  const orderedColumnsForRow = useMemo(() => (
    [{ key: 'select', showCheckbox: true, sticky: 'left' },
     { key: 'members', label: 'Members', sticky: 'left' },
     ...columnPrefs.orderedColumns,
     { key: 'actions', label: 'Actions', sticky: 'right' }]
  ), [columnPrefs.orderedColumns]);
  // colCount = checkbox + members + visible middle + actions
  const colCount = 2 + visibleMiddle.length + 1;

  if (patientsLoading) return <TableSkeleton rows={perPage} />;
  if (patientsError) {
    return (
      <EmptyState
        tone="danger"
        icon="solar:danger-triangle-linear"
        title="Failed to load patients"
        description={patientsError}
        action={<Button variant="soft" leadingIcon="solar:refresh-linear" onClick={fetchPatients}>Try Again</Button>}
      />
    );
  }

  const buildStatusGroupedRows = () => {
    const rows = [];
    const groups = {};
    for (const p of filteredPatients) {
      const sec = getStatusSection(p);
      if (!groups[sec]) groups[sec] = [];
      groups[sec].push(p);
    }

    for (const section of STATUS_SECTIONS) {
      const sectionPatients = groups[section.key];
      if (!sectionPatients?.length) continue;

      const isExpanded = expandedSections[section.key];
      const hasMore = sectionPatients.length > DEFAULT_VISIBLE;
      const visible = isExpanded ? sectionPatients : sectionPatients.slice(0, DEFAULT_VISIBLE);

      rows.push(
        <SectionHeader
          key={`section-${section.key}`}
          section={section}
          count={sectionPatients.length}
          colSpan={colCount}
          isExpanded={isExpanded}
          onToggle={() => toggleExpand(section.key)}
          hasMore={hasMore}
        />
      );

      for (const p of visible) {
        rows.push(
          <WorklistRow
            key={p.id}
            patient={p}
            columns={orderedColumnsForRow}
            hiddenSet={columnPrefs.hiddenSet}
            isSelected={selectedIdSet.has(p.id)}
            onSelect={selectPatient}
          />
        );
      }
    }
    return rows;
  };

  return (
    <div style={{ flex: 1, overflow: 'auto', background: 'var(--neutral-0)', position: 'relative', overscrollBehavior: 'none' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Inter', sans-serif", minWidth: 900 }}>
        <thead>
          <tr>
            <th style={{
              padding: '8px 10px', fontSize: 'var(--font-sm)', fontWeight: 500, color: 'var(--neutral-300)',
              borderBottom: '1px solid var(--neutral-150)', background: 'var(--neutral-0)',
              width: 36, position: 'sticky', top: 0, left: 0, zIndex: 4,
              textAlign: 'left', whiteSpace: 'nowrap', userSelect: 'none',
            }}>
              <Checkbox checked={someSelected ? 'indeterminate' : allSelected} onCheckedChange={handleSelectAll} />
            </th>
            <HeaderCell label="Members" style={{ ...HEADER_STICKY_STYLE, left: 36, zIndex: 4, borderRight: '1px solid var(--neutral-150)' }} />
            {visibleMiddle.map(col => (
              <HeaderCell key={col.key} label={col.label} style={HEADER_STICKY_STYLE} />
            ))}
            <th
              style={{
                ...HEADER_STICKY_STYLE,
                padding: '8px 10px',
                background: 'var(--neutral-0)',
                width: 140,
                right: 0,
                zIndex: 3,
                textAlign: 'left',
                fontSize: 'var(--font-sm)',
                fontWeight: 500,
                color: 'var(--neutral-300)',
              }}
            >
              <ColumnsHeaderButton
                columns={columnPrefs.orderedColumns}
                hiddenSet={columnPrefs.hiddenSet}
                onToggle={columnPrefs.onToggle}
                onReorder={columnPrefs.onReorder}
                onReset={columnPrefs.onReset}
                label="Actions"
              />
            </th>
          </tr>
        </thead>
        <tbody>
          {viewBy === 'status'
            ? buildStatusGroupedRows()
            : paginatedPatients.map(p => (
                <WorklistRow
                  key={p.id}
                  patient={p}
                  columns={orderedColumnsForRow}
                  hiddenSet={columnPrefs.hiddenSet}
                  isSelected={selectedIdSet.has(p.id)}
                  onSelect={selectPatient}
                />
              ))
          }
        </tbody>
      </table>

      {filteredPatients.length === 0 && <EmptySearch />}
      <BulkBar />
    </div>
  );
}
