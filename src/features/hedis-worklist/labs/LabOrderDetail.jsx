import { Icon } from '../../../components/Icon/Icon';
import { LabOrderStatusBadge } from './LabStatusBadge';
import { Badge } from '../../../components/Badge/Badge';
import { EvaluationBox, ResultTable } from './CareGapLabsTab';
import { ORDER_FLOW, LAB_ORDER_STATUS, testsOf, diagnosisLabel } from './labRules';
import styles from './CareGapLabs.module.css';

const fmt = (iso) => (iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '-');

/** Read-only order view: details, where it is in the lab's process, and its result. */
export function LabOrderDetail({ order, result, results = [], gapTest }) {
  const cancelled = order.status === LAB_ORDER_STATUS.cancelled;
  const at = ORDER_FLOW.indexOf(order.status);
  return (
    <div className={styles.form}>
      <div className={styles.detailHead}>
        <span className={styles.summaryTitle}>Lab Order • {order.performingLab}</span>
        <LabOrderStatusBadge status={order.status} size="M" />
      </div>
      <ol className={styles.stepper} aria-label="Order progress">
        {ORDER_FLOW.map((step, i) => {
          const done = !cancelled && i <= at;
          return (
            <li key={step} className={[styles.step, done ? styles.stepDone : '', i === at && !cancelled ? styles.stepCurrent : ''].join(' ')}>
              <Icon name={done ? 'solar:check-circle-linear' : 'solar:record-circle-linear'} size={16} color="currentColor" />
              <span>{step}</span>
            </li>
          );
        })}
      </ol>
      {cancelled && (
        <p className={styles.formWarn}>
          <Icon name="solar:close-circle-linear" size={14} color="currentColor" />
          Cancelled {fmt(order.cancelledAt)}{order.cancelReason ? `: ${order.cancelReason}` : ''}. The Care Gap remains open.
        </p>
      )}
      <div className={styles.field}>
        <span className={styles.fieldHint}>Tests</span>
        <div className={styles.tagList}>
          {testsOf(order).map(t => <Badge key={t} tone={t === gapTest ? 'primary' : 'neutral'} size="sm" label={t} />)}
        </div>
      </div>
      <div className={styles.field}>
        <span className={styles.fieldHint}>Diagnoses</span>
        <ul className={styles.dxList}>
          {(order.diagnoses || []).map((d, i) => (
            <li key={d.code || i} className={styles.dxChip}>
              <span className={styles.dxCode}>{d.code}</span>
              <span className={styles.dxTitle}>{d.title}</span>
              {i === 0 && <span className={styles.dxPrimary}>Primary</span>}
            </li>
          ))}
          {!(order.diagnoses || []).length && order.diagnosis && <li className={styles.dxChip}>{diagnosisLabel(order.diagnosis)}</li>}
        </ul>
      </div>
      <dl className={styles.orderGrid}>
        <div><dt>Priority</dt><dd>{order.priority}</dd></div>
        <div><dt>Ordering Provider</dt><dd>{order.orderingProvider || '-'}</dd></div>
        <div><dt>Performing Lab</dt><dd>{order.performingLab || '-'}</dd></div>
        <div><dt>Ordered</dt><dd>{fmt(order.orderedAt)}</dd></div>
        <div><dt>Collected</dt><dd>{fmt(order.collectedAt)}</dd></div>
        <div><dt>Placed By</dt><dd>{order.createdBy || '-'}</dd></div>
        <div><dt>Measurement Year</dt><dd>{order.measurementYear || '-'}</dd></div>
      </dl>
      {results.length > 0 && (
        <>
          <span className={styles.cardTitle}>Results</span>
          <ResultTable results={results} gapTest={gapTest} />
          {result && result.testName === gapTest && <EvaluationBox result={result} />}
        </>
      )}
    </div>
  );
}
