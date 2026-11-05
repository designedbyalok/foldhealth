import { useState } from 'react';
import { Drawer } from '../../../components/Drawer/Drawer';
import { ActivityLog } from '../../../components/ActivityLog/ActivityLog';
import { FilterChip } from '../../../components/FilterChip/FilterChip';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { DateRangeFilter } from '../../../components/DateRangeFilter/DateRangeFilter';
import { inDatePreset } from '../../../components/DateRangeFilter/dateRangePresets';
import { toActivityLogEntries } from '../../hedis-worklist/CareGapDetailDrawer.utils';
import { Avatar } from '../../../components/Avatar/Avatar';
import { timerHistoryToLog, initialsOf } from './careProgramBillingData';
import { TimerHistoryBody } from './TimerHistoryBody';
import styles from './CareProgramBilling.module.css';

/**
 * Every change to one program's billing timer access (who changed it, when,
 * and what), month-grouped in the shared ActivityLog, filterable by date
 * range and by who made the change.
 *
 * @param {object}   props.program – { code, name }
 * @param {object}   props.setting – carries `history`, newest first
 * @param {function} props.onClose
 */
export function TimerHistoryDrawer({ program, setting, onClose }) {
  const [datePreset, setDatePreset] = useState(null);
  const [dateRange, setDateRange] = useState([]);
  const [actors, setActors] = useState([]);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const history = setting.history || [];
  const actorOptions = [...new Set(history.map(h => h.actor).filter(Boolean))].sort();
  const inRange = inDatePreset(datePreset, dateRange);
  const actorSet = new Set(actors);
  const shown = history.filter(h => inRange(h.at) && (!actors.length || actorSet.has(h.actor)));
  const activeCount = (datePreset ? 1 : 0) + (actors.length ? 1 : 0);
  const filtered = activeCount > 0;

  const entries = toActivityLogEntries(timerHistoryToLog(shown))
    .map(e => (e.t === 'group' ? e : { ...e, render: (entry) => <TimerHistoryBody entry={entry} /> }));
  return (
    <Drawer
      title={(
        <span className={styles.drawerTitle}>
          Timer Access Settings History
          <span className={styles.drawerSubtitle}>For program: {program.code}</span>
        </span>
      )}
      // Two-line title: let the header grow, with 8px above and below.
      headerStyle={{ height: 'auto', paddingTop: 'var(--space-2)', paddingBottom: 'var(--space-2)' }}
      noCloseDivider
      headerRight={(
        <>
          {/* Shows / hides the filter bar; the count says how many filters are applied (as in SectionTitleBar). */}
          <ActionButton
            icon="custom:filter"
            tooltip="Filter"
            tooltipBelow
            tooltipLeft
            active={filtersOpen}
            notification={activeCount > 0}
            count={activeCount > 0 ? String(activeCount) : undefined}
            onClick={() => setFiltersOpen(o => !o)}
          />
          <span className={styles.headerDivider} />
        </>
      )}
      banner={filtersOpen && (
        <div className={styles.historyFilters}>
          <DateRangeFilter
            preset={datePreset}
            range={dateRange}
            onChange={(preset, range) => { setDatePreset(preset); setDateRange(range); }}
          />
          <FilterChip
            label="Activity By"
            searchable
            options={actorOptions}
            selected={actors}
            onChange={setActors}
            // Each person with their avatar, as in the user pickers; System gets the plain icon avatar.
            renderOptionLeading={(name) => (name === 'System'
              ? <Avatar type="icon" variant="others" iconName="solar:settings-linear" size="S" />
              : <Avatar variant="staff" size="S" initials={initialsOf(name)} userName={name} />)}
          />
        </div>
      )}
      onClose={onClose}
    >
      <div className={styles.historyLog}>
        <ActivityLog entries={entries} emptyLabel={filtered ? 'Nothing matches these filters.' : 'No changes recorded yet.'} />
      </div>
    </Drawer>
  );
}
