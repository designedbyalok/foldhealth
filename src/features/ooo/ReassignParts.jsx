import { useState } from 'react';
import { Avatar } from '../../components/Avatar/Avatar';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Icon } from '../../components/Icon/Icon';
import { CollapsibleContent } from '../../components/Collapsible/Collapsible';
import { FilterChip } from '../../components/FilterChip/FilterChip';
import { DateRangePopover } from '../../components/DateRangePopover/DateRangePopover';
import { initialsOf } from './oooUtils';
import { apptLine } from './reassignUtils';
import styles from './reassign.module.css';

const PAGE = 10;

/**
 * One appointment: patient initials, name, then date, time and type. The
 * leading slot (a checkbox) and the trailing slot (covering provider,
 * status, actions) are the caller's. `subPrefix` leads the date line
 * (e.g. "Was" for a time it has since moved from).
 */
export function ApptRow({ appt, lead, trail, tone, subPrefix, children }) {
  const name = appt.patient_name ?? appt.patientName ?? 'Appointment';
  return (
    <div className={[styles.apptRow, tone ? styles[`tone_${tone}`] : ''].filter(Boolean).join(' ')}>
      <div className={styles.apptMain}>
        {lead}
        <Avatar variant="patient" initials={initialsOf(name)} size="M" />
        <span className={styles.apptText}>
          <span className={styles.apptName}>{name}</span>
          <span className={styles.apptSub}>{subPrefix ? `${subPrefix} ${apptLine(appt)}` : apptLine(appt)}</span>
        </span>
        {trail && <span className={styles.apptTrail}>{trail}</span>}
      </div>
      {children}
    </div>
  );
}

/**
 * A department card: a header (checkbox, name, "N Appointments (…)" that
 * toggles the list, then the caller's controls) over its appointments,
 * ten to a page, with the range and page arrows under them.
 */
export function DeptGroup({ title, count, detail, lead, controls, items, renderItem, defaultOpen = false, tone, noun = 'Appointment' }) {
  const [open, setOpen] = useState(defaultOpen);
  // Collapse All / Expand All changes `defaultOpen`; follow it (animated),
  // while each card can still be opened or shut on its own in between.
  const [seenDefault, setSeenDefault] = useState(defaultOpen);
  if (seenDefault !== defaultOpen) { setSeenDefault(defaultOpen); setOpen(defaultOpen); }
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(items.length / PAGE));
  const pageNow = Math.min(page, pages - 1);
  const shown = items.slice(pageNow * PAGE, pageNow * PAGE + PAGE);
  return (
    <div className={[styles.dept, tone ? styles[`dept_${tone}`] : ''].filter(Boolean).join(' ')}>
      <div className={styles.deptHead}>
        {lead}
        <span className={styles.deptText}>
          <span className={styles.deptName}>{title}</span>
          <button type="button" className={styles.deptCount} onClick={() => setOpen(o => !o)} aria-expanded={open}>
            {count} {noun}{count === 1 ? '' : 's'}
            {detail && <span className={styles.deptDetail}>({detail})</span>}
            <Icon name="solar:alt-arrow-right-linear" size={12} color="var(--neutral-300)" className={open ? `${styles.chevron} ${styles.chevronOpen}` : styles.chevron} />
          </button>
        </span>
        {controls}
      </div>
      <CollapsibleContent open={open}>
        <div className={styles.deptList}>
          {shown.map(renderItem)}
          {items.length > 0 && (
            <div className={styles.pager}>
              <span>{pageNow * PAGE + 1}–{Math.min(items.length, pageNow * PAGE + PAGE)} of {items.length}</span>
              <ActionButton icon="solar:alt-arrow-left-linear" size="sm" tooltip="Previous" disabled={pageNow === 0} onClick={() => pageNow > 0 && setPage(pageNow - 1)} />
              <ActionButton icon="solar:alt-arrow-right-linear" size="sm" tooltip="Next" disabled={pageNow >= pages - 1} onClick={() => pageNow < pages - 1 && setPage(pageNow + 1)} />
            </div>
          )}
        </div>
      </CollapsibleContent>
    </div>
  );
}

// [startISO, endISO] (YYYY-MM-DD) → "MM/DD/YYYY – MM/DD/YYYY".
const rangeText = ([from, to]) => `${from.slice(5, 7)}/${from.slice(8)}/${from.slice(0, 4)} – ${to.slice(5, 7)}/${to.slice(8)}/${to.slice(0, 4)}`;

/** A date-range filter chip with the shared DateRangePopover. */
export function RangeChip({ label, value, onChange }) {
  const on = value.length === 2;
  return (
    <FilterChip
      size="S"
      label={label}
      active={on}
      activeSummary={on ? rangeText(value) : undefined}
      onClear={() => onChange([])}
      renderPopover={({ anchorRect, onClose }) => (
        <DateRangePopover anchorRect={anchorRect} label={label} selected={value} onChange={onChange} onClose={onClose} />
      )}
    />
  );
}
