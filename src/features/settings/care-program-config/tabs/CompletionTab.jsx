import { Switch } from '../../../../components/Switch/Switch';
import { Input } from '../../../../components/Input/Input';
import { Select } from '../../../../components/Select/Select';
import { COMPLETION_STATUSES, stepCounts } from '../careProgramConfigModel';
import styles from '../CareProgramConfig.module.css';

function SwitchSetting({ label, hint, checked, onChange }) {
  return (
    <div className={styles.switchRow}>
      <span className={styles.switchText}>
        <span className={styles.switchLabel}>{label}</span>
        {hint && <span className={styles.switchHint}>{hint}</span>}
      </span>
      <Switch checked={checked} onChange={onChange} ariaLabel={label} />
    </div>
  );
}

/** A setting with an optional number: empty means "no limit". */
function NumberSetting({ label, hint, value, onChange, unit }) {
  return (
    <div className={styles.switchRow}>
      <span className={styles.switchText}>
        <span className={styles.switchLabel}>{label}</span>
        {hint && <span className={styles.switchHint}>{hint}</span>}
      </span>
      <span className={styles.numberField}>
        <Input
          type="number"
          min={0}
          value={value ?? ''}
          placeholder="Not set"
          trailingText={unit}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === '' ? null : Math.max(0, Math.round(Number(v))));
          }}
          aria-label={label}
        />
      </span>
    </div>
  );
}

/** Completion Criteria: when a patient's program counts as done, and what happens then. */
export function CompletionTab({ draft, patch }) {
  const c = draft.completion;
  const set = p => patch({ completion: { ...c, ...p } });
  const { mandatory } = stepCounts(draft.steps);
  return (
    <>
      <section className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitleBlock}>
            <h3 className={styles.cardTitle}>A program is complete when</h3>
            <p className={styles.cardHint}>Every rule switched on here must be met.</p>
          </div>
        </div>
        <div>
          <SwitchSetting
            label="All mandatory steps are done"
            hint={`${mandatory} mandatory step${mandatory === 1 ? '' : 's'} on the Steps tab must be completed or skipped.`}
            checked={c.requireMandatorySteps}
            onChange={requireMandatorySteps => set({ requireMandatorySteps })}
          />
          <SwitchSetting
            label="The care plan is signed"
            hint="The program's care plan has at least one signed version."
            checked={c.requireCarePlanSigned}
            onChange={requireCarePlanSigned => set({ requireCarePlanSigned })}
          />
          <NumberSetting
            label="Minimum outreach attempts"
            hint="Outreach logged against this program."
            unit="attempts"
            value={c.minOutreachAttempts}
            onChange={minOutreachAttempts => set({ minOutreachAttempts })}
          />
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitleBlock}>
            <h3 className={styles.cardTitle}>Duration and closing</h3>
            <p className={styles.cardHint}>Leave a number empty for no limit.</p>
          </div>
        </div>
        <div>
          <NumberSetting
            label="Program length"
            hint="Days from enrollment until the program is due to end."
            unit="days"
            value={c.maxDurationDays}
            onChange={maxDurationDays => set({ maxDurationDays })}
          />
          <NumberSetting
            label="Close after inactivity"
            hint="Days without activity before the program is closed."
            unit="days"
            value={c.autoCloseInactiveDays}
            onChange={autoCloseInactiveDays => set({ autoCloseInactiveDays })}
          />
          <div className={styles.switchRow}>
            <span className={styles.switchText}>
              <span className={styles.switchLabel}>Status once complete</span>
              <span className={styles.switchHint}>What the program&apos;s status becomes when the rules above are met.</span>
            </span>
            <span className={styles.selectField}>
              <Select
                portal
                options={COMPLETION_STATUSES.map(v => ({ value: v, label: v }))}
                value={c.completionStatus}
                onValueChange={completionStatus => set({ completionStatus })}
              />
            </span>
          </div>
        </div>
      </section>
    </>
  );
}
