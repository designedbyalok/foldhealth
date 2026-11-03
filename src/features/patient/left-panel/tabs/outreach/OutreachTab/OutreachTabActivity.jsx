import { useMemo, useState } from 'react';
import { ActionButton } from '../../../../../../components/ActionButton/ActionButton';
import { SearchBar } from '../../../../../../components/SearchBar/SearchBar';
import { FilterChip } from '../../../../../../components/FilterChip/FilterChip';
import { Icon } from '../../../../../../components/Icon/Icon';
import { ActivityLog } from '../../../../../../components/ActivityLog/ActivityLog';
import { outreachActivityEntries } from './OutreachTabLog';
import { ACTIVITY_FILTERS } from './OutreachTab.utils';
import styles from './OutreachTab.module.css';

const DATE_RANGES = [
  { label: 'Today', days: 0 },
  { label: 'Last 7 Days', days: 7 },
  { label: 'Last 30 Days', days: 30 },
  { label: 'Last 90 Days', days: 90 },
  { label: 'Last 12 Months', days: 365 },
];
const SOURCE_OPTIONS = ['Via Astrana', 'On Fold', 'From Campaign'];
const EMPTY_CHIP_FILTERS = { recordedBy: [], programs: [], date: [], type: [], source: [], outcome: [] };

const recordedByOf = (log) => String(log.author || '').split(' (')[0].trim();
const sourceOf = (log) => {
  if (log.outreachSource === 'Astrana') return 'Via Astrana';
  if (log.outreachSource === 'Campaign' || log.campaignId || log.campaign) return 'From Campaign';
  return 'On Fold';
};
// Logs carry "MM/DD"; the year comes from the month group ("Jan 2025").
const logDate = (log, group) => {
  const [mm, dd] = String(log.date || '').split('/').map(Number);
  const year = Number((/(\d{4})/.exec(`${group.label || ''} ${group.id || ''}`) || [])[1]);
  if (!mm || !dd || !year) return null;
  return new Date(year, mm - 1, dd);
};
const uniqueSorted = (values) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));

export function OutreachTabActivity({
  activityFilter,
  setActivityFilter,
  activitySearchOpen,
  setActivitySearchOpen,
  activitySearchText,
  setActivitySearchText,
  logGroups,
  filteredLogGroups,
  onEdit,
  onDelete,
}) {
  // Filter chips: the toolbar filter icon toggles the chip row. They narrow
  // the list on top of the status tabs and search above.
  const [chipsOpen, setChipsOpen] = useState(false);
  const [chipFilters, setChipFilters] = useState(EMPTY_CHIP_FILTERS);
  const setChip = (key) => (vals) => setChipFilters(f => ({ ...f, [key]: vals }));
  const anyChipActive = Object.values(chipFilters).some(v => v.length > 0);

  const allLogs = useMemo(() => logGroups.flatMap(g => g.logs), [logGroups]);
  const options = useMemo(() => ({
    recordedBy: uniqueSorted(allLogs.map(recordedByOf)),
    programs: uniqueSorted(allLogs.flatMap(l => l.programs || [])),
    type: uniqueSorted(allLogs.map(l => l.type)),
    outcome: uniqueSorted(allLogs.map(l => l.outcome)),
  }), [allLogs]);

  const visibleGroups = useMemo(() => {
    if (!anyChipActive) return filteredLogGroups;
    const range = DATE_RANGES.find(r => r.label === chipFilters.date[0]);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const keep = (log, group) => {
      if (chipFilters.recordedBy.length && !chipFilters.recordedBy.includes(recordedByOf(log))) return false;
      if (chipFilters.programs.length && !(log.programs || []).some(p => chipFilters.programs.includes(p))) return false;
      if (chipFilters.type.length && !chipFilters.type.includes(log.type)) return false;
      if (chipFilters.source.length && !chipFilters.source.includes(sourceOf(log))) return false;
      if (chipFilters.outcome.length && !chipFilters.outcome.includes(log.outcome)) return false;
      if (range) {
        const d = logDate(log, group);
        if (!d) return false;
        const from = new Date(today);
        from.setDate(from.getDate() - range.days);
        if (d < from) return false;
      }
      return true;
    };
    return filteredLogGroups
      .map(g => ({ ...g, logs: g.logs.filter(l => keep(l, g)) }))
      .filter(g => g.logs.length > 0);
  }, [filteredLogGroups, chipFilters, anyChipActive]);

  return (
    <>
      <div className={styles.activityHeader}>
        <span className={styles.activityLabel}>Outreach Activity</span>
      </div>

      <div className={styles.activityFilterBar}>
        <div className={styles.activityFilterTabs}>
          {ACTIVITY_FILTERS.map(({ key, dot }) => (
            <button
              key={key}
              type="button"
              className={`${styles.activityFilterTab} ${activityFilter === key ? styles.activityFilterTabActive : ''}`}
              onClick={() => setActivityFilter(key)}
            >
              {dot && <span className={styles.activityFilterDot} style={{ background: dot }} />}
              {key}
            </button>
          ))}
        </div>
        <div className={styles.activityFilterActions}>
          {activitySearchOpen ? (
            <SearchBar
              className={styles.activitySearchBar}
              placeholder="Search activity"
              value={activitySearchText}
              onChange={e => setActivitySearchText(e.target.value)}
              onClose={() => { setActivitySearchOpen(false); setActivitySearchText(''); }}
            />
          ) : (
            <ActionButton size="sm" icon="solar:magnifer-linear" tooltip="Search" onClick={() => setActivitySearchOpen(true)} />
          )}
          <span className={styles.activityFilterDivider} />
          <ActionButton
            size="sm"
            icon="custom:filter"
            tooltip={chipsOpen ? 'Hide filters' : 'Filter'}
            iconColor={chipsOpen || anyChipActive ? 'var(--primary-300)' : undefined}
            onClick={() => setChipsOpen(v => !v)}
          />
        </div>
      </div>

      {chipsOpen && (
        <div className={styles.activityFilterChips}>
          <FilterChip size="S" label="Recorded By" options={options.recordedBy} selected={chipFilters.recordedBy} onChange={setChip('recordedBy')} searchable />
          <FilterChip size="S" label="Program / Gaps" options={options.programs} selected={chipFilters.programs} onChange={setChip('programs')} />
          <FilterChip size="S" label="Outreach Date" options={DATE_RANGES.map(r => r.label)} selected={chipFilters.date} onChange={setChip('date')} singleSelect />
          <FilterChip size="S" label="Outreach Type" options={options.type} selected={chipFilters.type} onChange={setChip('type')} />
          <FilterChip size="S" label="Outreach Source" options={SOURCE_OPTIONS} selected={chipFilters.source} onChange={setChip('source')} />
          <FilterChip size="S" label="Outcome" options={options.outcome} selected={chipFilters.outcome} onChange={setChip('outcome')} searchable />
          {/* Same "Clear All" link the worklist FilterBar shows once a filter is set. */}
          {anyChipActive && (
            <button type="button" className={styles.activityFilterClearAll} onClick={() => setChipFilters(EMPTY_CHIP_FILTERS)}>
              <Icon name="solar:close-circle-linear" size={14} color="currentColor" />
              Clear All
            </button>
          )}
        </div>
      )}

      <ActivityLog
        entries={outreachActivityEntries(visibleGroups, { onEdit, onDelete })}
        emptyLabel="No outreach logged yet."
        flushTop
      />

    </>
  );
}
