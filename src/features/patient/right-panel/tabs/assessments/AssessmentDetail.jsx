import { ActionButton } from '../../../../../components/ActionButton/ActionButton';
import { Button } from '../../../../../components/Button/Button';
import { AssessmentAnswers } from './AssessmentAnswers';
import { AssessmentScoreStrip } from './AssessmentScoreStrip';
import { fmtShortDate, scoreSummary } from './assessmentRows';
import styles from './AssessmentDetail.module.css';

const EMPTY_RESPONSE = { answers: {}, scores: {} };

/**
 * One assessment: the selected response of the form (Previous / Next step
 * through this patient's responses, newest first), read-only.
 */
export function AssessmentDetail({ row, index, onIndex, patientName, full, onToggleFull, onResend, onClose }) {
  const response = row.responses[index] || null;
  const shown = response || EMPTY_RESPONSE;
  const filledAt = response?.completedAt || response?.createdAt;
  const send = row.sends.find(s => !filledAt || new Date(s.sentAt) <= new Date(filledAt)) || row.lastSend;
  const summary = scoreSummary(row.form, shown);
  const meta = [
    send && `Sent by: ${send.sentByName || 'Care team'} on ${fmtShortDate(send.sentAt)}`,
    response
      ? `${response.status === 'completed' ? 'Filled' : 'Started'} by: ${response.filledByName || patientName} on ${fmtShortDate(filledAt)}`
      : 'Not filled yet',
  ].filter(Boolean).join(' • ');
  const count = row.responses.length;

  return (
    <div className={styles.detail}>
      <div className={styles.header}>
        <ActionButton
          icon={full ? 'solar:double-alt-arrow-right-linear' : 'solar:double-alt-arrow-left-linear'}
          tooltip={full ? 'Collapse' : 'Expand'}
          tooltipBelow
          aria-label={full ? 'Collapse assessment' : 'Expand assessment'}
          onClick={onToggleFull}
        />
        <span className={styles.divider} aria-hidden="true" />
        <div className={styles.heading}>
          <span className={styles.title}>{row.name}</span>
          <span className={styles.meta}>{meta}</span>
        </div>
        <div className={styles.actions}>
          <ActionButton icon="solar:alt-arrow-left-linear" tooltip="Previous response" tooltipBelow aria-label="Previous response" disabled={index === 0} onClick={() => onIndex(index - 1)} />
          <ActionButton icon="solar:alt-arrow-right-linear" tooltip="Next response" tooltipBelow aria-label="Next response" disabled={index >= count - 1} onClick={() => onIndex(index + 1)} />
          <span className={styles.divider} aria-hidden="true" />
          <ActionButton icon="solar:printer-linear" tooltip="Print" tooltipBelow aria-label="Print assessment" onClick={() => window.print()} />
          <span className={styles.divider} aria-hidden="true" />
          <Button variant="soft" size="sm" onClick={onResend}>Resend</Button>
          <span className={styles.divider} aria-hidden="true" />
          <ActionButton icon="solar:close-linear" tooltip="Close" tooltipBelow tooltipLeft aria-label="Close assessment" onClick={onClose} />
        </div>
      </div>
      {response && <AssessmentScoreStrip {...summary} />}
      <div className={styles.body}>
        <AssessmentAnswers fields={row.form.schema?.items} answers={shown.answers} />
      </div>
    </div>
  );
}
