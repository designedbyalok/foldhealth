import { useEffect, useMemo, useState } from 'react';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { SearchBar } from '../../components/SearchBar/SearchBar';
import { SearchIconButton } from '../../components/SearchIconButton/SearchIconButton';
import { DateRangePopover } from '../../components/DateRangePopover/DateRangePopover';
import { FilterChip } from '../../components/FilterChip/FilterChip';
import { Icon } from '../../components/Icon/Icon';
import { useAppStore } from '../../store/useAppStore';
import { NewButton, RecordsBody } from './OooRecordsParts';
import { useOooRecords } from './useOooRecords';
import { useOooRecordActions } from './useOooRecordActions';
import { formatDate, oooStatus, recordsOnDate, sortRecords } from './oooUtils';
import styles from './ooo.module.css';

const PER_PAGE_DEFAULT = 10;
const HIGHLIGHT_MS = 4000;

/**
 * Everyone's Out of Office records with search, filters (Date Range,
 * Status, User) and New OOO Record, for Settings → Calendar → OOO Records
 * and the calendar's month-view drawer (Figma Eventus 17367:121995,
 * 17414:107368). With `highlightDate`, the records out that day come first,
 * tinted and outlined for a few seconds (17507:108921); with `highlightId`,
 * just that one record is, left in its place in the list: the table opens
 * on its page and scrolls to it.
 *
 * Returns the pieces for the host to place: `tools` (search, filter, New
 * OOO Record, split by hairlines), `filterRow` (null while closed), `body`
 * (the table) and `elements` (the record drawer and delete dialog).
 */
export function useAllOooRecords({ highlightDate, highlightId, embedded = false, oneLineDates = false } = {}) {
  const { records, loading } = useOooRecords();
  const platformUsers = useAppStore(s => (s.platformPeople?.length ? s.platformPeople : s.platformUsers));
  const taskProfiles = useAppStore(s => s.taskProfiles);
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  useEffect(() => { fetchPlatformUsers?.(); }, [fetchPlatformUsers]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dateRange, setDateRange] = useState([]); // [startISO, endISO] or []
  const [status, setStatus] = useState(['All']);
  const [userFilter, setUserFilter] = useState([]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(PER_PAGE_DEFAULT);
  // The day's rows are tinted and outlined for 4s after opening, then fade
  // back; they stay first in the list.
  const [flashing, setFlashing] = useState(!!(highlightDate || highlightId));
  useEffect(() => {
    if (!highlightDate && !highlightId) return undefined;
    const t = window.setTimeout(() => setFlashing(false), HIGHLIGHT_MS);
    return () => window.clearTimeout(t);
  }, [highlightDate, highlightId]);

  const users = useMemo(() => {
    const emails = Object.fromEntries((taskProfiles || []).map(p => [p.name, p.email]));
    return (platformUsers || []).map(u => ({ id: u.id, name: u.name, email: u.email || emails[u.name] }));
  }, [platformUsers, taskProfiles]);
  const actions = useOooRecordActions({ users });

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const [from, to] = dateRange.length === 2
      ? [new Date(`${dateRange[0]}T00:00`).getTime(), new Date(`${dateRange[1]}T00:00`).getTime() + 86400000]
      : [null, null];
    let list = records.filter(r => (!q || String(r.userName || '').toLowerCase().includes(q))
      && (!userFilter.length || userFilter.includes(r.userName))
      && (status[0] === 'All' || oooStatus(r) === status[0])
      && (from == null || (new Date(r.startAt).getTime() < to && new Date(r.endAt).getTime() > from)));
    list = sortRecords(list);
    if (highlightDate && !highlightId) {
      const on = new Set(recordsOnDate(list, highlightDate).map(r => r.id));
      list = [...list.filter(r => on.has(r.id)), ...list.filter(r => !on.has(r.id))];
    }
    return list;
  }, [records, query, userFilter, status, dateRange, highlightDate, highlightId]);
  // Never past the last page: deleting the only row on page 2 falls back to
  // page 1 rather than showing an empty table.
  // Opening on one record: jump to its page once, when it's in the list.
  const [jumped, setJumped] = useState(false);
  const at = highlightId && !jumped ? shown.findIndex(r => r.id === highlightId) : -1;
  if (at >= 0) { setJumped(true); setPage(Math.floor(at / perPage) + 1); }
  const lastPage = Math.max(1, Math.ceil(shown.length / perPage));
  const pageNow = Math.min(page, lastPage);
  const pageRows = shown.slice((pageNow - 1) * perPage, pageNow * perPage);
  const userOptions = useMemo(() => [...new Set(records.map(r => r.userName))].sort(), [records]);

  const filterCount = (dateRange.length === 2 ? 1 : 0) + (status[0] !== 'All' ? 1 : 0) + (userFilter.length ? 1 : 0);
  const resetPage = (fn) => (v) => { fn(v); setPage(1); };
  const clearFilters = () => { setDateRange([]); setStatus(['All']); setUserFilter([]); setPage(1); };

  const tools = (
    <>
      {searchOpen ? (
        <SearchBar
          placeholder="Search By User Name"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          onClose={() => { setSearchOpen(false); setQuery(''); setPage(1); }}
        />
      ) : (
        <SearchIconButton tooltipBelow onClick={() => setSearchOpen(true)} />
      )}
      <span className={styles.actionDivider} aria-hidden="true" />
      <ActionButton
        icon="custom:filter"
        tooltip="Filter"
        tooltipBelow
        notification={filterCount > 0}
        count={filterCount > 0 ? String(filterCount) : undefined}
        className={filtersOpen ? styles.iconActive : undefined}
        aria-expanded={filtersOpen}
        onClick={() => setFiltersOpen(v => !v)}
      />
      <span className={styles.actionDivider} aria-hidden="true" />
      <NewButton onClick={() => actions.openNew()} />
    </>
  );

  const filterRow = filtersOpen && (
    <div className={styles.filterRow}>
      <FilterChip
        label="Date Range"
        active={dateRange.length === 2}
        onClear={() => resetPage(setDateRange)([])}
        activeSummary={dateRange.length === 2 ? `${formatDate(`${dateRange[0]}T00:00`)} - ${formatDate(`${dateRange[1]}T00:00`)}` : undefined}
        renderPopover={({ anchorRect, onClose }) => (
          <DateRangePopover anchorRect={anchorRect} label="Date Range" selected={dateRange} onChange={resetPage(setDateRange)} onClose={onClose} />
        )}
      />
      <FilterChip
        label="Status"
        options={['All', 'Ongoing', 'Upcoming', 'Past']}
        selected={status}
        onChange={(next) => resetPage(setStatus)(next.length ? next : ['All'])}
        singleSelect
        noClear
      />
      <FilterChip label="User" options={userOptions} selected={userFilter} onChange={resetPage(setUserFilter)} searchable />
      {filterCount > 0 && (
        <button type="button" className={styles.clearAll} onClick={clearFilters}>
          <Icon name="solar:close-circle-linear" size={14} color="var(--primary-300)" />
          Clear All
        </button>
      )}
    </div>
  );

  const body = (
      <RecordsBody
        loading={loading}
        records={pageRows}
        emptyLabel={query || filterCount ? 'No Out of Office Records match these filters' : 'No Out of Office Records yet'}
        actions={actions}
        showUser
        oneLineDates={oneLineDates}
        highlightDate={flashing ? highlightDate : undefined}
        highlightId={flashing ? highlightId : undefined}
        embedded={embedded}
        pagination={shown.length > PER_PAGE_DEFAULT ? {
          page: pageNow,
          perPage,
          totalItems: shown.length,
          onPageChange: setPage,
          onPageSizeChange: (n) => { setPerPage(n); setPage(1); },
        } : undefined}
      />
  );

  return { tools, filterRow: filterRow || null, body, elements: actions.elements };
}
