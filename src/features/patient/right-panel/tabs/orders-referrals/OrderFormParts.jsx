import { Button } from '../../../../../components/Button/Button';
import { RadioButton } from '../../../../../components/RadioButton/RadioButton';
import { ORDER_PRIORITIES } from '../../../data/patientOrders';
import styles from './OrderForms.module.css';

export function PriorityField({ name, value, onChange }) {
  return (
    <div className={styles.field}>
      <span className={styles.label}>Priority</span>
      <div className={styles.radioRow} role="radiogroup" aria-label="Priority">
        {ORDER_PRIORITIES.map(p => (
          <RadioButton key={p} name={name} value={p} label={p} checked={value === p} onChange={() => onChange(p)} />
        ))}
      </div>
    </div>
  );
}

/** Header actions for the New Order drawers: Save as Draft, then the submit button. */
export function DraftSubmitActions({ submitLabel, onDraft, onSubmit, saving, draftReason, submitReason }) {
  return (
    <>
      <Button variant="outline" disabled={saving || !!draftReason} disabledReason={draftReason} onClick={onDraft}>
        Save as Draft
      </Button>
      <Button disabled={saving || !!submitReason} disabledReason={submitReason} onClick={onSubmit}>
        {submitLabel}
      </Button>
      <span className={styles.headerDivider} aria-hidden="true" />
    </>
  );
}
