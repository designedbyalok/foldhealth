import { useMemo, useRef, useState } from 'react';
import { TabStrip } from '../../../../../../../../components/TabStrip/TabStrip';
import { ActionButton } from '../../../../../../../../components/ActionButton/ActionButton';
import { FilterChip } from '../../../../../../../../components/FilterChip/FilterChip';
import { ActivityLog } from '../../../../../../../../components/ActivityLog/ActivityLog';
import styles from './CarePlanActivityBlock.module.css';
import { localDateMs } from '../../../../../../../../lib/localDate';

const DEFAULT_TABS = [
  { key: 'all',   label: 'All' },
  { key: 'since', label: 'Since Last Visit' },
];

// Default filter set covers every action key emitted by the care-plan
// audit slice. Callers can pass a narrower `filters` list when their
// entity type only produces a subset (e.g. barriers don't have a
// progress row).
const DEFAULT_FILTERS = [
  { key: 'all',              label: 'All activity' },
  { key: 'note',             label: 'Notes' },
  { key: 'status_changed',   label: 'Status' },
  { key: 'progress_changed', label: 'Progress' },
  { key: 'value_changed',    label: 'Values' },
  { key: 'goal_linked',      label: 'Goal Linked' },
  { key: 'goal_unlinked',    label: 'Goal Unlinked' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function bucketLabel(iso) {
  if (!iso) return 'Undated';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Undated';
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Shared "Activity Log" surface for the care-plan preview drawers.
 * Renders the same TabStrip (All / Since Last Visit) + Filter chip +
 * grouped ActivityLog trio the Goal preview drawer uses so all three
 * drawers read as one system.
 *
 * @param {object[]} entries      Already-mapped ActivityLog rows, each
 *                                carrying `action` + `createdAt` fields
 *                                (see `mapAuditEntry` in each drawer).
 * @param {string}   [lastVisit]  ISO date; entries older than this are
 *                                dropped when the "Since Last Visit" tab
 *                                is active. Falls back to now-30d.
 * @param {object[]} [filters]    Override the filter menu options.
 * @param {string}   [emptyLabel] Passed through to ActivityLog.
 */
export function CarePlanActivityBlock({ entries, lastVisit, filters = DEFAULT_FILTERS, emptyLabel }) {
  const [tab, setTab] = useState('all');
  const [filter, setFilter] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterBtnRef = useRef(null);

  const bucketed = useMemo(() => {
    const sinceCutoff = (() => {
      if (lastVisit) {
        const t = localDateMs(lastVisit);
        if (!Number.isNaN(t)) return t;
      }
      return Date.now() - 30 * 86400000;
    })();
    const filtered = (entries || []).filter(e => {
      if (tab === 'since' && e.createdAt && new Date(e.createdAt).getTime() < sinceCutoff) return false;
      if (filter !== 'all' && e.action !== filter) return false;
      return true;
    });
    const out = [];
    let currentBucket = null;
    for (const entry of filtered) {
      const b = bucketLabel(entry.createdAt);
      if (b !== currentBucket) {
        out.push({ t: 'group', label: b });
        currentBucket = b;
      }
      out.push(entry);
    }
    return out;
  }, [entries, tab, filter, lastVisit]);

  return (
    <div className={styles.activityBlock}>
      <TabStrip
        items={DEFAULT_TABS}
        activeKey={tab}
        onChange={setTab}
        fullWidth={false}
        size="S"
        trailing={(
          <ActionButton
            ref={filterBtnRef}
            icon="custom:filter"
            size="S"
            tooltip="Filter activity"
            active={filtersOpen || filter !== 'all'}
            onClick={() => setFiltersOpen(v => !v)}
          />
        )}
      />
      {filtersOpen && (() => {
        // Single-select FilterChip (radio popover); picking a value
        // narrows the timeline, the ✕ clears back to All activity.
        const OPTIONS = filters.filter(f => f.key !== 'all').map(f => f.label);
        const keyByLabel = Object.fromEntries(filters.map(f => [f.label, f.key]));
        const activeLabel = filters.find(f => f.key === filter)?.label;
        const selected = filter === 'all' ? [] : (activeLabel ? [activeLabel] : []);
        return (
          <div className={styles.activityFilterBar}>
            <FilterChip
              label="Activity"
              popoverLabel="Filter activity"
              options={OPTIONS}
              selected={selected}
              singleSelect
              size="S"
              onChange={(next) => {
                const pick = Array.isArray(next) ? next[0] : null;
                setFilter(pick ? (keyByLabel[pick] || 'all') : 'all');
              }}
            />
          </div>
        );
      })()}
      <div className={styles.activityLogPad}>
        <ActivityLog entries={bucketed} emptyLabel={emptyLabel} />
      </div>
    </div>
  );
}
