import { Input } from '../../../components/Input/Input';
import { Select } from '../../../components/Select/Select';
import { LOOKBACK_UNITS } from './fieldCatalog';
import styles from './ruleBuilder.module.css';

/**
 * LookbackWindowInput: shared "In the last N {days|weeks|months|years}"
 * temporal window control used by coded-term, observation, and event-count
 * condition editors. Renders a toggle, number input, and unit selector.
 */
export function LookbackWindowInput({ lookback, onChange }) {
  const active = !!lookback?.amount;

  const toggle = () => {
    onChange(active ? null : { amount: 6, unit: 'months' });
  };

  return (
    <div className={styles.lookbackSection}>
      <button type="button" className={styles.lookbackToggle} onClick={toggle}>
        <span className={`${styles.lookbackDot} ${active ? styles.lookbackDotActive : ''}`} />
        <span className={styles.editorSectionLabel}>In the last</span>
      </button>
      {active && (
        <div className={styles.lookbackRow}>
          <Input
            type="number"
            min={1}
            value={lookback.amount}
            onChange={e => onChange({ ...lookback, amount: e.target.value })}
            style={{ width: 80 }}
          />
          <Select
            options={LOOKBACK_UNITS.map(u => ({ value: u.value, label: u.label }))}
            value={lookback.unit || 'months'}
            onValueChange={v => onChange({ ...lookback, unit: v })}
            style={{ width: 120 }}
          />
        </div>
      )}
    </div>
  );
}
