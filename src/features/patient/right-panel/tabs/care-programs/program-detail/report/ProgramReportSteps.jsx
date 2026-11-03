import { useRef, useState } from 'react';
import { Select } from '../../../../../../../components/Select/Select';
import { Switch } from '../../../../../../../components/Switch/Switch';
import { Link } from '../../../../../../../components/Link/Link';
import { Badge } from '../../../../../../../components/Badge/Badge';
import { DateRangePopover } from '../../../../../../../components/DateRangePopover/DateRangePopover';
import { OVERVIEW_KEY, RANGE_PRESETS } from './programReportModel';
import styles from './ProgramReportDrawer.module.css';

const STATUS_BADGE = {
  completed: { label: 'Completed', tone: 'success' },
  in_progress: { label: 'In Progress', tone: 'warning' },
  skipped: { label: 'Skipped', tone: 'grey' },
  pending: { label: 'Not Started', tone: 'grey' },
};

function StepRow({ step, on, onToggle, onFocus }) {
  const badge = STATUS_BADGE[step.status] || STATUS_BADGE.pending;
  return (
    <div className={styles.cardRow} onPointerDownCapture={onFocus}>
      <span className={styles.rowText}>{step.name}</span>
      <Badge size="sm" tone={badge.tone} label={badge.label} />
      <Switch checked={on} onChange={onToggle} ariaLabel={`Include ${step.name}`} />
    </div>
  );
}

/**
 * Program report > Program Steps: the date range everything is drawn for,
 * and a switch per step (sections switch all their steps at once).
 */
export function ProgramReportSteps({
  steps, enabled, onToggle, onToggleMany, rangePreset, onRangePreset, customRange, onCustomRange, rangeLabel, onFocus,
}) {
  const rangeRef = useRef(null);
  const [rangeAt, setRangeAt] = useState(null);
  const openCustom = () => setRangeAt(rangeRef.current?.getBoundingClientRect() || null);
  const on = key => enabled.has(key);

  return (
    <div className={styles.cards}>
      <div className={styles.fieldGroup} ref={rangeRef}>
        <Select
          label="Date Range"
          portal
          options={RANGE_PRESETS.map(p => ({ ...p, triggerLabel: p.value === 'custom' && customRange.length === 2 ? `Custom: ${rangeLabel}` : p.label }))}
          value={rangePreset}
          onChange={(v) => { onRangePreset(v); if (v === 'custom') openCustom(); }}
        />
        <span className={styles.coverHint}>
          {rangeLabel}. Steps print what happened in this range.
          {rangePreset === 'custom' && <> <Link onClick={openCustom}>Change dates</Link></>}
        </span>
        {rangeAt && (
          <DateRangePopover
            anchorRect={rangeAt}
            label="Date Range"
            selected={customRange}
            onChange={(r) => { onCustomRange(r); if (r.length !== 2 && rangePreset === 'custom') onRangePreset('enrollment'); }}
            onClose={() => setRangeAt(null)}
          />
        )}
      </div>

      <div className={styles.sectionCard}>
        <div className={styles.cardHead} onPointerDownCapture={() => onFocus(OVERVIEW_KEY)}>
          <span className={styles.cardHeadText}>
            <span className={styles.cardTitle}>Program Overview</span>
            <span className={styles.cardSubtitle}>Status, dates, care manager and progress</span>
          </span>
          <Switch checked={on(OVERVIEW_KEY)} onChange={() => onToggle(OVERVIEW_KEY)} ariaLabel="Include Program Overview" />
        </div>
      </div>

      {steps.map((step) => {
        if (step.type !== 'section') {
          return (
            <div key={step.id} className={styles.sectionCard}>
              <StepRow step={step} on={on(step.id)} onToggle={() => onToggle(step.id)} onFocus={() => onFocus(step.id)} />
            </div>
          );
        }
        const ids = step.children.map(c => c.id);
        const count = ids.filter(on).length;
        return (
          <div key={step.id} className={styles.sectionCard}>
            <div className={styles.cardHead}>
              <span className={styles.cardHeadText}>
                <span className={styles.cardTitle}>{step.name}</span>
                <span className={styles.cardSubtitle}>{count} of {ids.length} steps included</span>
              </span>
              <Switch checked={count > 0} onChange={() => onToggleMany(ids, count === 0)} ariaLabel={`Include ${step.name}`} />
            </div>
            {count > 0 && (
              <div className={styles.cardList}>
                {step.children.map(c => (
                  <StepRow key={c.id} step={c} on={on(c.id)} onToggle={() => onToggle(c.id)} onFocus={() => onFocus(c.id)} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
