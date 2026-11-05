import { Switch } from '../../../../components/Switch/Switch';
import { Input } from '../../../../components/Input/Input';
import { NumberUnitInput } from '../../../../components/NumberUnitInput/NumberUnitInput';
import {
  ACUITY_LEVELS, CADENCE_UNITS, formatInterval,
} from '../../../patient/right-panel/tabs/care-programs/care-plan/lib/cadence';
import styles from '../CareProgramConfig.module.css';

function Row({ label, hint, children }) {
  return (
    <div className={styles.switchRow}>
      <span className={styles.switchText}>
        <span className={styles.switchLabel}>{label}</span>
        {hint && <span className={styles.switchHint}>{hint}</span>}
      </span>
      <span className={styles.cadenceControls}>{children}</span>
    </div>
  );
}

function Interval({ value, onChange }) {
  return (
    <span className={styles.intervalField}>
      <NumberUnitInput
        value={value.every}
        onChange={every => onChange({ ...value, every: every === '' ? '' : Math.max(1, every) })}
        unit={value.unit}
        units={CADENCE_UNITS}
        onUnitChange={unit => onChange({ ...value, unit })}
      />
    </span>
  );
}

/** Cadence: how often a patient's care plan in this program is reviewed. */
export function CadenceTab({ draft, patch }) {
  const c = draft.cadence;
  const set = p => patch({ cadence: { ...c, ...p } });
  const base = { every: c.every, unit: c.unit };
  const pd = c.postDischarge;
  const setPd = p => set({ postDischarge: { ...pd, ...p } });
  const setAcuity = (level, rule) => {
    const byAcuity = { ...c.byAcuity };
    if (rule) byAcuity[level] = rule; else delete byAcuity[level];
    set({ byAcuity });
  };
  return (
    <>
      <section className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitleBlock}>
            <h3 className={styles.cardTitle}>Review cadence</h3>
            <p className={styles.cardHint}>
              How often a patient&apos;s care plan is reviewed. A care manager can override it for one patient from their care plan.
            </p>
          </div>
        </div>
        <div>
          <Row label="Program default" hint={`${formatInterval(base)}, unless an acuity rule below applies.`}>
            <Interval value={base} onChange={v => set(v)} />
          </Row>
          {ACUITY_LEVELS.map((level) => {
            const rule = c.byAcuity?.[level];
            return (
              <Row
                key={level}
                label={`${level} acuity`}
                hint={rule ? `${formatInterval(rule)} for patients enrolled at ${level.toLowerCase()} acuity.` : 'Follows the program default.'}
              >
                {rule && <Interval value={rule} onChange={v => setAcuity(level, v)} />}
                <Switch
                  checked={!!rule}
                  onChange={on => setAcuity(level, on ? { ...base } : null)}
                  ariaLabel={`Own cadence for ${level} acuity`}
                />
              </Row>
            );
          })}
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitleBlock}>
            <h3 className={styles.cardTitle}>Overdue and adjustments</h3>
            <p className={styles.cardHint}>When a missed review is flagged, and how the cadence tightens after a hospital stay.</p>
          </div>
        </div>
        <div>
          <Row label="Flag as overdue after" hint="Days past the review due date before the plan is flagged overdue.">
            <span className={styles.numberField}>
              <Input
                type="number"
                min={0}
                value={c.overdueAfterDays ?? ''}
                trailingText="days"
                onChange={(e) => {
                  const v = e.target.value;
                  set({ overdueAfterDays: v === '' ? 0 : Math.max(0, Math.round(Number(v))) });
                }}
                aria-label="Flag as overdue after"
              />
            </span>
          </Row>
          <Row
            label="Tighten after discharge"
            hint={pd.enabled
              ? `${formatInterval(pd)} for ${pd.days} days after an inpatient discharge, then back to the usual cadence.`
              : 'Discharges don’t change the cadence.'}
          >
            <Switch checked={!!pd.enabled} onChange={enabled => setPd({ enabled })} ariaLabel="Tighten after discharge" />
          </Row>
          {pd.enabled && (
            <>
              <Row label="Cadence after discharge">
                <Interval value={{ every: pd.every, unit: pd.unit }} onChange={v => setPd(v)} />
              </Row>
              <Row label="For" hint="Days from the discharge date.">
                <span className={styles.numberField}>
                  <Input
                    type="number"
                    min={1}
                    value={pd.days ?? ''}
                    trailingText="days"
                    onChange={(e) => {
                      const v = e.target.value;
                      setPd({ days: v === '' ? 1 : Math.max(1, Math.round(Number(v))) });
                    }}
                    aria-label="Days after discharge"
                  />
                </span>
              </Row>
            </>
          )}
        </div>
      </section>
    </>
  );
}
