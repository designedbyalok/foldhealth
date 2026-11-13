import { useEffect, useMemo } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { Icon } from '../../../components/Icon/Icon';
import { WorklistShell } from '../../worklists/WorklistShell';
import { useTableSort } from '../../../components/HeaderCell/useTableSort';
import { QueueRow, getQueueMiddleColumns } from './QueueRow';
import { QueueEmptyState } from './QueueEmptyState';
import { TableSkeleton } from '../../../components/TableSkeleton/TableSkeleton';
import { enrichTocRow } from '../tocColumns';
import { useCovering } from '../../ooo/useCovering';
import { COVERING_FILTER_KEY } from '../useTocFilterDefs';

/**
 * Agent-queue table shared by the TCM Agent Queue tab and the standalone
 * TOC worklist. `programLabel` drives the outreach-window + status column
 * copy; `worklistKey` keeps column prefs isolated per list.
 */
export function QueueTable({
  worklistKey = 'tcm-queue',
  programLabel = 'TCM',
  emptyState,
  middleColumns,
} = {}) {
  const patients = useAppStore(s => s.patients);
  const patientsLoading = useAppStore(s => s.patientsLoading);
  const callDetails = useAppStore(s => s.callDetails);
  const fetchPatients = useAppStore(s => s.fetchPatients);
  const fetchCallDetails = useAppStore(s => s.fetchCallDetails);
  const searchQuery = useAppStore(s => s.searchQuery);
  const selectedIds = useAppStore(s => s.selectedIds);
  const selectPatient = useAppStore(s => s.selectPatient);
  const selectAll = useAppStore(s => s.selectAll);
  const clearSelected = useAppStore(s => s.clearSelected);

  const isToc = worklistKey === 'toc';

  // This table reads `patients` and `callDetails` but never fetched either,
  // it relied on SubNav prefetching them for every Population route, which is
  // why `call_details` (101.9 KB) loaded on HCC, CCM, SNP and the rest. SubNav
  // now fetches counts only, so the view that renders the data owns fetching
  // it. Both actions are store-guarded single-fire.
  useEffect(() => {
    fetchPatients();
    fetchCallDetails();
  }, [fetchPatients, fetchCallDetails]);

  const columns = useMemo(() => [
    { key: 'select', showCheckbox: true, sticky: 'left', left: 0, width: 36 },
    {
      key: 'members',
      label: 'Members',
      sticky: 'left',
      left: 36,
      width: 240,
      ...(isToc ? { sortKey: 'name', sortType: 'alpha' } : {}),
      thStyle: { borderRight: '0.5px solid var(--neutral-150)' },
    },
    ...(middleColumns || getQueueMiddleColumns(programLabel)),
    { key: 'actions', label: 'Actions', sticky: 'right', width: 140 },
  ], [programLabel, middleColumns, isToc]);

  const activeFilters = useAppStore(s => s.activeFilters);
  const currentPage = useAppStore(s => s.currentPage);
  const perPage = useAppStore(s => s.perPage);
  const covering = useCovering();
  const coveringPicked = activeFilters[COVERING_FILTER_KEY] || [];

  const filteredQueue = useMemo(() => {
    let result = patients.filter(p => p.agentAssigned)
      .sort((a, b) => (a.priority || 99) - (b.priority || 99));

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.memberId?.toLowerCase().includes(q) ||
        p.initials?.toLowerCase().includes(q)
      );
    }

    for (const [key, value] of Object.entries(activeFilters)) {
      if (key === COVERING_FILTER_KEY) {
        if (value?.length) result = result.filter(p => covering.coveringOn([p.assignee], value).length > 0);
        continue;
      }
      if (value) {
        result = result.filter(p => String(p[key]) === String(value));
      }
    }

    return isToc ? result.map(enrichTocRow) : result;
  }, [patients, searchQuery, activeFilters, isToc, covering]);

  // TOC only: click cycles asc → desc → clear (back to priority order).
  // TCM Agent Queue keeps its fixed priority sort.
  const { sorted, sortKey, sortDir, setSort, clearSort } = useTableSort(filteredQueue);
  const handleSort = (field) => {
    if (sortKey === field) {
      if (sortDir === 'asc') setSort(field, 'desc');
      else if (sortDir === 'desc') clearSort();
      else setSort(field, 'asc');
    } else {
      setSort(field, 'asc');
    }
  };
  const displayQueue = isToc ? sorted : filteredQueue;

  const callsByPatient = useMemo(() => {
    const voicemails = new Map();
    const completed  = new Map();
    const ongoing    = new Map();
    for (const c of callDetails) {
      if (!c.patientId) continue;
      if (c.callType === 'voicemail') {
        const list = voicemails.get(c.patientId);
        if (list) list.push(c);
        else voicemails.set(c.patientId, [c]);
      } else if (c.callType === 'completed') {
        if (!completed.has(c.patientId)) completed.set(c.patientId, c);
      } else if (c.callType === 'ongoing') {
        if (!ongoing.has(c.patientId)) ongoing.set(c.patientId, c);
      }
    }
    return { voicemails, completed, ongoing };
  }, [callDetails]);

  if (patientsLoading) return <TableSkeleton rows={6} />;

  if (!filteredQueue.length) {
    const anyInvoked = patients.some(p => p.agentAssigned);
    if (!anyInvoked) return emptyState || <QueueEmptyState />;
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center', paddingBottom: 64 }}>
          <Icon name="custom:filter" size={40} color="var(--neutral-200)" />
          <div style={{ fontSize: 'var(--font-base)', fontWeight: 500, color: 'var(--neutral-400)' }}>No matching agents</div>
          <div style={{ fontSize: 'var(--font-md)', color: 'var(--neutral-300)', lineHeight: 1.5 }}>
            Active filters hide all queued patients. Try adjusting your filters.
          </div>
        </div>
      </div>
    );
  }

  const startIdx = (currentPage - 1) * perPage;
  const pageRows = displayQueue.slice(startIdx, startIdx + perPage);

  const handleSelectAll = (checked) => {
    if (checked) selectAll([...new Set([...selectedIds, ...pageRows.map(p => p.id)])]);
    else selectAll(selectedIds.filter(id => !pageRows.find(p => p.id === id)));
  };

  return (
    <WorklistShell
      header={<></>}
      worklistKey={worklistKey}
      columns={columns}
      rows={pageRows}
      sortKey={isToc ? sortKey : undefined}
      sortDir={isToc ? sortDir : undefined}
      onSort={isToc ? handleSort : undefined}
      renderRow={(p, _i, ctx) => (
        <QueueRow
          key={p.id}
          patient={p}
          columns={ctx.orderedColumns}
          hiddenSet={ctx.hiddenSet}
          isSelected={selectedIds.includes(p.id)}
          onSelect={selectPatient}
          voicemailCalls={callsByPatient.voicemails.get(p.id)}
          completedCall={callsByPatient.completed.get(p.id)}
          ongoingCall={callsByPatient.ongoing.get(p.id)}
        />
      )}
      selectedIds={selectedIds}
      onSelectAll={handleSelectAll}
      onClearSelection={clearSelected}
      minTableWidth={middleColumns ? 3330 : 1900}
    />
  );
}
