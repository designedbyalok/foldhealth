import { FilterChip } from '../FilterChip/FilterChip';
import { DateRangePopover } from '../DateRangePopover/DateRangePopover';
import { dobRangeSummary } from '../DateRangePopover/yearSpan';

/**
 * DobFilter: the worklists' DOB filter: the shared FilterChip opening a
 * DateRangePopover with Years | Custom Dates. The value is a [startISO,
 * endISO] range (a year pick is Jan 1 to Dec 31); match rows with
 * `dobInRange` from DateRangePopover/yearSpan.
 *
 * @param {string[]} props.value    – [] or [startISO, endISO]
 * @param {function} props.onChange – (string[]) => void
 * @param {string}   [props.label='DOB']
 */
const NO_VALUE = [];

export function DobFilter({ value = NO_VALUE, onChange, label = 'DOB' }) {
  const active = value.length >= 2;
  return (
    <FilterChip
      label={label}
      active={active}
      activeSummary={active ? dobRangeSummary(value) : undefined}
      onClear={() => onChange([])}
      renderPopover={({ anchorRect, onClose }) => (
        <DateRangePopover anchorRect={anchorRect} label={label} selected={value} onChange={onChange} onClose={onClose} years />
      )}
    />
  );
}
