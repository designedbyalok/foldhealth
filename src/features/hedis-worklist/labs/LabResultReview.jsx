import { Checkbox } from '../../../components/Checkbox/Checkbox';
import { Icon } from '../../../components/Icon/Icon';
import { EvidenceStatusBadge } from './LabStatusBadge';
import { EvaluationBox, ResultTable } from './CareGapLabsTab';
import { EVIDENCE_STATUS, interpretResult } from './labRules';
import styles from './CareGapLabs.module.css';

const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-');

/**
 * Review a result: value, clinical flag and the Care Gap evaluation, with an
 * explicit choice to mark the HEDIS gap Completed (qualifying evidence only).
 */
export function LabResultReview({ result, rule, closeGap, onCloseGapChange, orderResults = [] }) {
  const qualifies = result.evaluation?.status === EVIDENCE_STATUS.qualifying;
  const flag = result.flag || interpretResult(result, rule);
  return (
    <div className={styles.form}>
      <div className={styles.detailHead}>
        <span className={styles.summaryTitle}>{result.testName}</span>
        <EvidenceStatusBadge status={result.evaluation?.status} size="M" />
      </div>
      <div className={styles.bigValue}>
        {result.value == null ? 'No reportable value' : `${result.value} ${result.unit || ''}`}
        {flag && <span className={styles.flag}>{flag}</span>}
      </div>
      <dl className={styles.orderGrid}>
        <div><dt>Collected</dt><dd>{fmt(result.collectedAt)}</dd></div>
        <div><dt>Resulted</dt><dd>{fmt(result.resultedAt)}</dd></div>
        <div><dt>Reference Range</dt><dd>{result.referenceRange || '-'}</dd></div>
        <div><dt>Source</dt><dd>{result.source || '-'}{result.labOrderId ? '' : ' (external)'}</dd></div>
      </dl>
      {result.note && <p className={styles.explain}>{result.note}</p>}
      {orderResults.length > 1 && (
        <>
          <span className={styles.cardTitle}>All results on this order</span>
          <ResultTable results={orderResults} gapTest={rule?.test} />
          <p className={styles.fieldHint}>Marking as reviewed reviews every result on the order.</p>
        </>
      )}
      <EvaluationBox result={result} />
      {flag && flag !== 'Normal' && qualifies && (
        <p className={styles.formNote}>
          <Icon name="solar:info-circle-linear" size={14} color="currentColor" />
          The value is {flag.toLowerCase()}, but the test was completed in the measurement period, so it still counts as evidence.
          Follow up on the clinical finding separately.
        </p>
      )}
      {result.reviewedAt ? (
        <p className={styles.reviewed}>Reviewed by {result.reviewedBy} on {fmt(result.reviewedAt)}</p>
      ) : qualifies ? (
        <label className={styles.checkRow}>
          <Checkbox checked={closeGap} onCheckedChange={(v) => onCloseGapChange(!!v)} aria-label="Mark Care Gap Completed" />
          Also mark this Care Gap as Completed
        </label>
      ) : null}
    </div>
  );
}
