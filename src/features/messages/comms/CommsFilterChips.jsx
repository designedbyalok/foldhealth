import { FilterChip } from '../../../components/FilterChip/FilterChip';
import { DateRangeFilter } from '../../../components/DateRangeFilter/DateRangeFilter';
import { inboxLabel } from './commsInboxes';
import styles from './Comms.module.css';

const NONE = [];

/**
 * The FilterChip row under a Comms list's tabs (Chat, SMS, Calls, All
 * Conversations, Email, eFax): Date, Inbox (when the list has inboxes),
 * Channel (All Conversations) and Covering for (while I'm covering someone).
 *
 * @param {object}   props.filters         – EMPTY_COMMS_FILTERS shape
 * @param {function} props.onChange        – (patch) => void
 * @param {{ id, name, address }[]} [props.inboxes]
 * @param {string[]} [props.channels]      – channel names to offer
 * @param {string[]} [props.coveringNames] – people I'm covering
 */
export function CommsFilterChips({ filters, onChange, inboxes = NONE, channels = NONE, coveringNames = NONE }) {
  const inboxPicked = inboxes.find(i => i.id === filters.inbox);
  return (
    <div className={styles.filterRow}>
      <DateRangeFilter
        label="Date"
        preset={filters.datePreset}
        range={filters.dateRange}
        onChange={(datePreset, dateRange) => onChange({ datePreset, dateRange: dateRange || [] })}
      />
      {inboxes.length > 0 && (
        <FilterChip
          label="Inbox"
          singleSelect
          options={inboxes.map(inboxLabel)}
          selected={inboxPicked ? [inboxLabel(inboxPicked)] : []}
          onChange={(next) => onChange({ inbox: inboxes.find(i => inboxLabel(i) === next[0])?.id || null })}
        />
      )}
      {channels.length > 0 && <FilterChip label="Channel" options={channels} selected={filters.channels} onChange={v => onChange({ channels: v })} />}
      {coveringNames.length > 0 && (
        <FilterChip
          label="Covering for"
          searchable={coveringNames.length > 8}
          options={coveringNames}
          selected={filters.covering}
          onChange={v => onChange({ covering: v })}
        />
      )}
    </div>
  );
}
