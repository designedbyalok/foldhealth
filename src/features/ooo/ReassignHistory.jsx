import { useEffect, useMemo, useState } from 'react';
import { ActivityLog, MetaLine } from '../../components/ActivityLog/ActivityLog';
import { historyTimelineStyles as htStyles } from '../../components/HistoryTimeline/HistoryTimeline';
import { groupByMonth } from '../../components/Timeline/Timeline.utils';
import { Badge } from '../../components/Badge/Badge';
import { Icon } from '../../components/Icon/Icon';
import { UserSwitchIcon } from '../../components/Icon/UserSwitchIcon';
import { CalendarIcon } from '../../components/Icon/CalendarIcon';
import { Link } from '../../components/Link/Link';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { FilterChip } from '../../components/FilterChip/FilterChip';
import { Input } from '../../components/Input/Input';
import { SearchIconButton } from '../../components/SearchIconButton/SearchIconButton';
import { FilterIcon } from '../../components/Icon/FilterIcon';
import { useAppStore } from '../../store/useAppStore';
import { formatDate, formatDateTime } from './oooUtils';
import { TYPE_LABELS } from './reassignJobs';
import { RangeChip } from './ReassignParts';
import styles from './reassign.module.css';

// Type labels in sentence case: "Out of Office Reassignment" → "Out of office reassignment".
const kindOf = (type) => { const l = TYPE_LABELS[type] || 'Reassignment'; return l[0] + l.slice(1).toLowerCase(); };
// "MM-DD-YYYY" (appointments) and ISO timestamps → "YYYY-MM-DD", to compare with a picked range.
const dayOfAppt = (d) => { const [m, dd, y] = String(d || '').split('-'); return y ? `${y}-${m}-${dd}` : ''; };
const dayOf = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const inRange = (day, [from, to]) => !!day && day >= from && day <= to;

/**
 * The Reassign Appointments drawer's History tab: every reassignment job,
 * whoever it was for, newest first, as an activity log grouped by month.
 * A job still running says so; a finished one shows its conflicts and
 * failures and opens its Appointment Reassignment Summary.
 *
 * Returns `tools` (search and filter, for the tab row; Figma Eventus
 * 17646:114218) and `body` (the filter row, when open, over the log).
 */
export function useReassignHistory() {
  const jobs = useAppStore(s => s.reassignmentJobs);
  const fetchJobs = useAppStore(s => s.fetchReassignmentJobs);
  const openSummary = useAppStore(s => s.openReassignmentSummary);
  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [types, setTypes] = useState([]);
  const [by, setBy] = useState([]);
  const [forWhom, setForWhom] = useState([]);
  const [runRange, setRunRange] = useState([]);
  const [apptRange, setApptRange] = useState([]);
  const filterCount = types.length + by.length + forWhom.length + (runRange.length === 2) + (apptRange.length === 2);
  const clearAll = () => { setTypes([]); setBy([]); setForWhom([]); setRunRange([]); setApptRange([]); };

  const uniq = (list) => [...new Set(list.filter(Boolean))].sort();
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return jobs.filter(j => (!q || [j.fromUser, j.createdBy, kindOf(j.type)].some(v => String(v || '').toLowerCase().includes(q)))
      && (!types.length || types.includes(kindOf(j.type)))
      && (!by.length || by.includes(j.createdBy))
      && (!forWhom.length || forWhom.includes(j.fromUser))
      && (runRange.length !== 2 || inRange(dayOf(j.createdAt), runRange))
      && (apptRange.length !== 2 || j.results.some(r => inRange(dayOfAppt(r.appointment?.date), apptRange))));
  }, [jobs, query, types, by, forWhom, runRange, apptRange]);

  const entries = useMemo(() => groupByMonth(shown).flatMap(month => [
    { t: 'group', label: new Date(month.entries[0].createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) },
    ...month.entries.map((j) => {
      // "01/18/2026, 01:15PM" → date, and "01:15 PM".
      const [date, time = ''] = formatDateTime(j.createdAt).split(', ');
      const running = j.status === 'running';
      const failed = j.status === 'failed';
      const kind = kindOf(j.type);
      return {
        t: 'reassignment',
        id: j.id,
        avatar: <span className={styles.historyTile}><UserSwitchIcon size={14} color="var(--neutral-200)" /></span>,
        render: () => (
          <>
            <MetaLine entry={{ date, time: time.replace(/(AM|PM)$/, ' $1'), by: j.createdBy }} />
            <div className={htStyles.headlineRow}>
              <span className={htStyles.headline}>{kind} for: {j.fromUser}</span>
            </div>
            {failed ? (
              <span className={styles.historyLine}>
                <Badge tone="danger" size="sm" label="Failed" />
              </span>
            ) : running ? (
              <span className={`${styles.historyLine} ${styles.historyRunning}`}>
                <span className={styles.spinner} aria-hidden="true" />
                Reassignment job in progress, Loading details...
              </span>
            ) : (
              <span className={styles.historyLine}>
                {/* The time off it covered, kept as one unit so it never wraps
                    mid-range; Permanent has no end. */}
                {j.windowStart && (
                  <>
                    <span className={styles.historyRange}>
                      <CalendarIcon size={12} color="var(--neutral-300)" />
                      {formatDate(j.windowStart)}
                      <Icon name="solar:arrow-right-linear" size={12} color="var(--neutral-300)" />
                      {j.windowEnd ? formatDate(j.windowEnd) : 'Ongoing'}
                    </span>
                    <span className={styles.historyDot} aria-hidden="true">•</span>
                  </>
                )}
                <Badge size="sm" label={`${j.results.length} Appointment${j.results.length === 1 ? '' : 's'}`} />
                {j.conflictingCount > 0 && <Badge tone="warning" size="sm" label={`${j.conflictingCount} Conflicting`} />}
                {j.failedCount > 0 && <Badge tone="danger" size="sm" label={`${j.failedCount} Failed`} />}
                <span className={styles.historyDot} aria-hidden="true">•</span>
                <Link className={styles.historyLink} role="button" tabIndex={0} onClick={() => openSummary(j.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSummary(j.id); } }}>
                  View Summary
                  <Icon name="solar:alt-arrow-right-linear" size={12} color="currentColor" />
                </Link>
              </span>
            )}
          </>
        ),
      };
    }),
  ]), [shown, openSummary]);

  const tools = (
    <span className={styles.historyTools}>
      {searchOpen ? (
        // The standard 32px search field; clearing it and clicking away folds it back to the icon.
        <Input
          type="search"
          leadingIcon="solar:magnifer-linear"
          placeholder="Search By User or Type"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onBlur={() => { if (!query) setSearchOpen(false); }}
          wrapperClassName={styles.historySearch}
          autoFocus
        />
      ) : (
        <SearchIconButton tooltipBelow onClick={() => setSearchOpen(true)} />
      )}
      <span className={styles.toolDivider} aria-hidden="true" />
      <ActionButton tooltip="Filters" tooltipBelow tooltipLeft count={filterCount || undefined} active={filtersOpen}
        className={filtersOpen ? styles.toolOn : undefined} onClick={() => setFiltersOpen(o => !o)}>
        <FilterIcon size={20} color="var(--neutral-300)" />
      </ActionButton>
    </span>
  );

  const body = (
    <>
      {filtersOpen && (
        <div className={styles.historyFilters}>
          <FilterChip size="S" label="Type" options={uniq(jobs.map(j => kindOf(j.type)))} selected={types} onChange={setTypes} />
          <FilterChip size="S" label="Activity By" options={uniq(jobs.map(j => j.createdBy))} selected={by} onChange={setBy} searchable />
          <FilterChip size="S" label="Activity For" options={uniq(jobs.map(j => j.fromUser))} selected={forWhom} onChange={setForWhom} searchable />
          <RangeChip label="Reassignment Date Range" value={runRange} onChange={setRunRange} />
          <RangeChip label="Appointment Date Range" value={apptRange} onChange={setApptRange} />
          {filterCount > 0 && (
            <Link className={styles.clearAll} role="button" tabIndex={0} onClick={clearAll}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clearAll(); } }}>
              <Icon name="solar:backspace-linear" size={12} color="currentColor" />
              Clear All
            </Link>
          )}
        </div>
      )}
      {!jobs.length
        ? <EmptyState icon="solar:history-linear" title="No reassignments yet" />
        : <ActivityLog entries={entries} emptyLabel="No reassignments match these filters." />}
    </>
  );

  return { tools, body };
}
