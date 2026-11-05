import { OutreachStatus } from '../../../components/OutreachStatus/OutreachStatus';
import { outreachFromDots } from '../../../components/OutreachStatus/outreachStatusModel';
import styles from '../tocColumns.module.css';
import { hasTocOutreachActivity } from '../tocOutcome';

export function OutreachCell({ patient, onOpen }) {
  // No activity yet: the empty state. Activity without recorded attempts
  // reads as one failed attempt, as before.
  let outreach = { result: null };
  if (hasTocOutreachActivity(patient)) {
    const date = patient.outreachDate || patient.callDate;
    outreach = outreachFromDots(patient.outreachDots, { date, attended: patient.outreachAttended });
    if (!outreach.result) outreach = { type: 'call', result: 'failed', date, attempts: 1 };
  }
  const content = <OutreachStatus {...outreach} />;

  if (!onOpen) return content;

  return (
    <button
      type="button"
      className={styles.outreachBtn}
      onClick={(e) => { e.stopPropagation(); onOpen(); }}
      aria-label={`Open patient outreach for ${patient.name}`}
    >
      {content}
    </button>
  );
}
