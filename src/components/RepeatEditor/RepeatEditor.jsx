import { useRef, useState } from 'react';
import { Icon } from '../Icon/Icon';
import { Input } from '../Input/Input';
import { Switch } from '../Switch/Switch';
import { MenuPopover } from '../MenuPopover/MenuPopover';
import { DownChevronIcon } from '../Icon/DownChevronIcon';
import scheduleStyles from '../../features/settings/care-plan-library/interventions/shared/InterventionDrawer.module.css';
import styles from './RepeatEditor.module.css';

// Care-plan cadences today only support Days and Weeks; Months / Years
// were removed because the store, the "next occurrence" calculator, and
// downstream reminders were never wired for the calendar-month math they
// would need. Keep this list in sync with the shape doc below.
const REPEAT_UNITS = ['Days', 'Weeks'];

/**
 * Repeat schedule editor: Figma Care Plan Creation 14599:200235.
 *
 * Layout (stacked, on a grey-50 panel):
 *   [Switch] Repeat
 *   [count input · "time"/"times" trailing]
 *   "time after"
 *   [every input] [unit ▾]
 *   Ends in [ends input] [unit ▾]
 *
 * Value shape:
 *   {
 *     repeat: boolean,
 *     repeatCount: string | number,   // "1", "5", how many times
 *     repeatEvery: string | number,   // "1", "2", interval size
 *     repeatEveryUnit: 'Days' | 'Weeks',
 *     repeatEnds: string | number,    // "0", extra window after the last run
 *     repeatEndsUnit: 'Days' | 'Weeks',
 *   }
 *
 * onChange fires with the FULL next shape (never a partial), so callers
 * can pass it straight to a save action without merging.
 */
export function RepeatEditor({ value, onChange }) {
  const v = value || {};
  const merge = (patch) => onChange?.({
    repeat: !!v.repeat,
    repeatCount: v.repeatCount ?? '1',
    repeatEvery: v.repeatEvery ?? '1',
    repeatEveryUnit: v.repeatEveryUnit || 'Days',
    repeatEnds: v.repeatEnds ?? '0',
    repeatEndsUnit: v.repeatEndsUnit || 'Days',
    ...patch,
  });

  const [everyOpen, setEveryOpen] = useState(false);
  const [endsOpen, setEndsOpen] = useState(false);
  const everyRef = useRef(null);
  const endsRef = useRef(null);

  // Count input: spans the panel width and carries the "time"/
  // "times" static suffix inside its own trailing slot so the noun
  // stays glued to the number, matching the task drawer pattern.
  const countInput = (
    <Input
      value={v.repeatCount ?? '1'}
      onChange={(e) => merge({ repeatCount: e.target.value.replace(/\D/g, '') })}
      inputMode="numeric"
      aria-label="Repeat count"
      wrapperClassName={scheduleStyles.offsetInput}
      trailingTextSegment
      trailingText={(
        <span className={scheduleStyles.offsetTrailing}>
          <span className={scheduleStyles.spinner}>
            <button
              type="button"
              className={scheduleStyles.spinnerBtn}
              aria-label="Increment repeat count"
              onClick={() => merge({ repeatCount: String((Number(v.repeatCount) || 0) + 1) })}
            >
              <Icon name="solar:alt-arrow-up-linear" size={10} color="var(--neutral-300)" />
            </button>
            <button
              type="button"
              className={scheduleStyles.spinnerBtn}
              aria-label="Decrement repeat count"
              onClick={() => merge({ repeatCount: String(Math.max(1, (Number(v.repeatCount) || 0) - 1)) })}
            >
              <Icon name="solar:alt-arrow-down-linear" size={10} color="var(--neutral-300)" />
            </button>
          </span>
          <span className={scheduleStyles.unitStatic}>
            {Number(v.repeatCount) === 1 ? 'time' : 'times'}
          </span>
        </span>
      )}
    />
  );

  // Number + unit-picker pair, shared by "every {n} {unit}" and
  // "ends in {n} {unit}". Uses the same input primitive but adds
  // a MenuPopover unit trigger inside the trailing slot.
  const unitPair = (val, onValueChange, unit, onUnitSelect, open, setOpen, ref, label) => (
    <div className={scheduleStyles.repeatField}>
      <Input
        value={val}
        onChange={(e) => onValueChange(e.target.value.replace(/\D/g, ''))}
        inputMode="numeric"
        aria-label={label}
        wrapperClassName={scheduleStyles.offsetInput}
        trailingTextSegment
        trailingText={(
          <span className={scheduleStyles.offsetTrailing}>
            <span className={scheduleStyles.spinner}>
              <button
                type="button"
                className={scheduleStyles.spinnerBtn}
                aria-label={`Increment ${label.toLowerCase()}`}
                onClick={() => onValueChange(String((Number(val) || 0) + 1))}
              >
                <Icon name="solar:alt-arrow-up-linear" size={10} color="var(--neutral-300)" />
              </button>
              <button
                type="button"
                className={scheduleStyles.spinnerBtn}
                aria-label={`Decrement ${label.toLowerCase()}`}
                onClick={() => onValueChange(String(Math.max(0, (Number(val) || 0) - 1)))}
              >
                <Icon name="solar:alt-arrow-down-linear" size={10} color="var(--neutral-300)" />
              </button>
            </span>
            <button
              ref={ref}
              type="button"
              className={scheduleStyles.unitTrigger}
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
            >
              {unit}
              <DownChevronIcon size={14} color="var(--neutral-300)" />
            </button>
          </span>
        )}
      />
      {open && (
        <MenuPopover
          anchorRef={ref}
          align="right"
          width={140}
          ariaLabel={`${label} unit`}
          items={REPEAT_UNITS.map((u) => ({ key: u, label: u }))}
          onSelect={onUnitSelect}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );

  return (
    <div className={styles.panel}>
      <Switch checked={!!v.repeat} onChange={(next) => merge({ repeat: next })} label="Repeat" size="S" />
      {v.repeat && (
        <>
          <div className={styles.countRow}>
            {countInput}
            <span className={styles.afterLabel}>after</span>
            {unitPair(
              v.repeatEvery ?? '1',
              (n) => merge({ repeatEvery: n }),
              v.repeatEveryUnit || 'Days',
              (unit) => merge({ repeatEveryUnit: unit }),
              everyOpen,
              setEveryOpen,
              everyRef,
              'Repeat every',
            )}
          </div>
          <div className={styles.endsRow}>
            <span className={styles.endsLabel}>Ends in</span>
            {unitPair(
              v.repeatEnds ?? '0',
              (n) => merge({ repeatEnds: n }),
              v.repeatEndsUnit || 'Days',
              (unit) => merge({ repeatEndsUnit: unit }),
              endsOpen,
              setEndsOpen,
              endsRef,
              'Ends in',
            )}
          </div>
        </>
      )}
    </div>
  );
}
