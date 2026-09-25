import { useState } from 'react';
import { DownChevronIcon } from '../Icon/DownChevronIcon';
import { Icon } from '../Icon/Icon';
import { Tooltip } from '../Tooltip/Tooltip';
import { CheckboxListPopover } from '../CheckboxListPopover/CheckboxListPopover';
import { RadioListPopover } from '../RadioListPopover/RadioListPopover';
import styles from './FilterChip.module.css';

const EMPTY_SELECTED = [];

/**
 * FilterChip — a labelled filter chip that opens a multi-select popover, the
 * same pattern used by the worklist filter bar. Idle it shows "Label ⌄"; once
 * values are picked it shows "Label | value(s) ✕". The ✕ clears the filter.
 *
 * @param {object}   props
 * @param {string}   props.label
 * @param {string}   [props.popoverLabel] – Header shown INSIDE the popover.
 *                                          Defaults to `label`. Use when the
 *                                          chip trigger text and the popover
 *                                          header should differ (e.g. chip
 *                                          "Documents Available" → popover
 *                                          "Select No. of Documents").
 * @param {string[]} props.options       – available values
 * @param {string[]} [props.selected]    – currently-selected values
 * @param {function} props.onChange      – (string[]) => void
 * @param {boolean}  [props.singleSelect]– Use RadioListPopover instead of the
 *                                         checkbox popover; onChange still
 *                                         receives a (0- or 1-element) array
 *                                         so callers don't need a second
 *                                         shape. Popover auto-closes on pick.
 * @param {boolean}  [props.disabled]    – Read-only: shows the filter and its
 *                                         value but can't be opened or cleared
 *                                         (e.g. a saved report snapshot).
 */
export function FilterChip({
  label,
  popoverLabel,
  options,
  selected = EMPTY_SELECTED,
  onChange,
  singleSelect = false,
  size = 'M',
  // Passthrough to CheckboxListPopover — enables the in-popover search box for
  // long option lists (e.g. Assignee, IPA, HP Code).
  searchable = false,
  // Extended API for filters whose popover isn't a plain list — the caller
  // decides when the chip counts as "active", what to summarize on the
  // pill, how to clear, and renders the popover body itself. When set, the
  // options/selected/onChange trio is ignored and the chip becomes a thin
  // trigger for the custom popover. See TimeFilter for the reference case.
  renderPopover,
  active: activeProp,
  // Optional override for the pill's right-hand value text. Falls back to the
  // built-in summarize() (first two values joined, or "X +N"). Used by the
  // shared FilterChipBar to format date ranges (mm/dd–mm/dd) and decade
  // ranges (X–Y) without re-implementing the whole chip.
  activeSummary,
  onClear,
  // Opt-out of the clear affordance when the field must always carry a
  // value — e.g. Measurement Year in the HEDIS gap drawer, where clearing
  // "2026" doesn't make sense. In that mode the active pill renders the
  // grey down-chevron (same glyph the idle state uses) instead of the
  // primary "✕", and clicks fall through to toggling the popover.
  noClear = false,
  // By default `noClear` also drops the pill into the neutral grey
  // palette (info-display look). Pass `noClearNeutral={false}` to keep
  // the primary active tint even for never-empty pickers — used when
  // the picker is a headline control (e.g. HEDIS worklist Year chip)
  // and should visually match other primary chrome around it.
  noClearNeutral = true,
  // Optional tooltip content shown from a small info icon rendered
  // between the chip value and the trailing glyph. Active state only:
  // idle chips have no value to sit beside. Anything truthy renders
  // the icon + a hairline divider so it visually separates from the
  // chevron / clear glyph.
  info,
  disabled = false,
}) {
  const [rect, setRect] = useState(null);
  const custom = typeof renderPopover === 'function';
  const active = custom ? !!activeProp : selected.length > 0;
  const summary = activeSummary != null
    ? parseActiveSummary(activeSummary)
    : (custom ? { text: '' } : summarize(selected));

  const handleClear = (e) => {
    e.stopPropagation();
    if (custom) onClear?.();
    else onChange([]);
  };

  const iconSize = size === 'S' ? 14 : 16;

  return (
    <>
      <button
        type="button"
        className={[
          styles.chip,
          active ? styles.chipActive : '',
          // Never-empty pickers (`noClear`) get the neutral grey palette
          // even when a value is selected — matches the intent that the
          // pill is an information display, not a clearable filter.
          active && noClear && noClearNeutral ? styles.chipNeutral : '',
          size === 'S' ? styles.sizeS : '',
          disabled ? styles.chipDisabled : '',
        ].filter(Boolean).join(' ')}
        aria-description={info || undefined}
        disabled={disabled}
        onClick={(e) => {
          if (e.target.closest('[data-filter-clear]')) {
            handleClear(e);
            return;
          }
          setRect(rect ? null : e.currentTarget.getBoundingClientRect());
        }}
      >
        {label && <span className={styles.chipLabel}>{label}</span>}
        {active ? (
          <>
            {/* The "Label : Value" divider only makes sense when both
                sides are visible. Callers that pass an empty label
                (e.g. Measurement Year chip in the HEDIS header) get a
                bare-value pill like "2026 ⌄". */}
            {label && <span className={styles.divider} aria-hidden="true">:</span>}
            <span className={styles.chipValue}>{summary.text}</span>
            {summary.extra != null && (
              <span className={styles.chipExtra}>+{summary.extra}</span>
            )}
            {info && (
              <>
                <Tooltip label={info} placement="bottom" maxWidth={280}>
                  <span
                    className={styles.infoIcon}
                    role="img"
                    aria-label="More information"
                  >
                    <Icon name="solar:info-circle-linear" size={iconSize} color="var(--neutral-300)" />
                  </span>
                </Tooltip>
                <span className={styles.infoDivider} aria-hidden="true" />
              </>
            )}
            {disabled ? null : noClear ? (
              // Never-empty filters (e.g. Measurement Year) skip the clear
              // ✕ and reuse the idle chevron so users know clicking the
              // chip re-opens the picker — nothing to clear. The chevron
              // picks up the pill's palette: neutral grey by default,
              // primary purple when the caller opted into the primary
              // active tint via `noClearNeutral={false}`.
              <DownChevronIcon
                size={iconSize}
                color={noClearNeutral ? 'var(--neutral-300)' : 'var(--primary-300)'}
              />
            ) : (
              /* span, not <button>: the chip trigger is already a <button> and
                 nested interactive elements are invalid HTML. */
              <span
                className={styles.clearIcon}
                data-filter-clear
                aria-label={`Clear ${label} filter`}
              >
                <svg width={iconSize} height={iconSize} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M12.495 4.5C12.77 4.22 12.77 3.78 12.495 3.51C12.22 3.23 11.78 3.23 11.505 3.51L12 4L12.495 4.5ZM3.51 11.505C3.23 11.78 3.23 12.22 3.51 12.495C3.78 12.77 4.22 12.77 4.5 12.495L4 12L3.51 11.505ZM4.49 3.51C4.22 3.23 3.78 3.23 3.51 3.51C3.23 3.78 3.23 4.22 3.51 4.49L4 4L4.49 3.51ZM11.505 12.49C11.78 12.77 12.22 12.77 12.49 12.49C12.77 12.22 12.77 11.78 12.49 11.505L12 12L11.505 12.49ZM12 4L11.505 3.51L7.51 7.51L8 8L8.49 8.49L12.495 4.5L12 4ZM8 8L7.51 7.51L3.51 11.505L4 12L4.5 12.495L8.49 8.49L8 8ZM4 4L3.51 4.49L7.51 8.49L8 8L8.49 7.51L4.49 3.51L4 4ZM8 8L7.51 8.49L11.505 12.49L12 12L12.49 11.505L8.49 7.51L8 8Z" fill="var(--primary-300)" />
                </svg>
              </span>
            )}
          </>
        ) : (
          !disabled && <DownChevronIcon size={iconSize} />
        )}
      </button>
      {rect && (custom
        ? renderPopover({ anchorRect: rect, onClose: () => setRect(null) })
        : singleSelect ? (
          <RadioListPopover
            anchorRect={rect}
            label={popoverLabel || label}
            options={options}
            selected={selected}
            onChange={(next) => { onChange(next); setRect(null); }}
            onClose={() => setRect(null)}
            showClear={!noClear}
          />
        ) : (
          <CheckboxListPopover
            anchorRect={rect}
            label={popoverLabel || label}
            options={options}
            selected={selected}
            onChange={onChange}
            onClose={() => setRect(null)}
            searchable={searchable}
          />
        ))}
    </>
  );
}

function summarize(vals) {
  if (vals.length > 2) return { text: vals[0], extra: vals.length - 1 };
  return { text: vals.join(', ') };
}

// Split a caller-provided activeSummary string into `{ text, extra }` so a
// trailing " +N" always renders as the same badge treatment the built-in
// summarize() produces. Anything without a numeric trailer stays a plain
// text summary (e.g. date ranges like "03/12 – 03/19").
function parseActiveSummary(s) {
  if (typeof s !== 'string') return { text: s };
  const m = s.match(/^(.*\S)\s+\+(\d+)$/);
  return m ? { text: m[1], extra: Number(m[2]) } : { text: s };
}
