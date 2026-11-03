import { useState } from 'react';
import { Button } from '../../../components/Button/Button';
import { Icon } from '../../../components/Icon/Icon';
import { Tooltip } from '../../../components/Tooltip/Tooltip';
import { CardSkeleton } from '../../../components/CardSkeleton/CardSkeleton';
import { GapEvaluationBadge, EvidenceStatusBadge, LabOrderStatusBadge } from './LabStatusBadge';
import { LabPrototypeControls } from './LabPrototypeControls';
import { Badge } from '../../../components/Badge/Badge';
import { EVIDENCE_STATUS, GAP_EVALUATION, LAB_ORDER_STATUS, CANCELLABLE_STATUSES, gapReason, interpretResult, testsOf, diagnosisLabel } from './labRules';
import styles from './CareGapLabs.module.css';

const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-');
const valueText = (r) => (r?.value == null || r.value === '' ? 'No value' : `${r.value}${r.unit ? ` ${r.unit}` : ''}`);

/**
 * Care Gap drawer: Orders tab, the lab evidence view for this gap. Order of
 * weight: gap evaluation + why, requirement, latest relevant result, the
 * current order, the next action. Lab order status and gap evaluation are
 * shown side by side and never merged.
 *
 * @param {object}   props
 * @param {object}   props.labs            – from useCareGapLabs()
 * @param {string}   props.measureName
 * @param {function} props.onOrderLab      – opens the Order Lab pane
 * @param {function} props.onViewOrder     – (order) => void
 * @param {function} props.onReviewResult  – (result) => void
 * @param {function} props.onCancelOrder   – (order) => void (confirms first)
 */
export function CareGapLabsTab({ labs, measureName, onOrderLab, onViewOrder, onReviewResult, onCancelOrder }) {
  const [showHistory, setShowHistory] = useState(false);
  if (labs.loading) return <CardSkeleton />;

  const { rule, gap, qualifying, latestResult, activeOrder, latestOrder, orderResults, orderResult, orderCoversGap, action, period, orders, evaluated } = labs;
  const evidenceResult = qualifying || latestResult;
  const runAction = () => {
    if (action.key === 'new') onOrderLab();
    else if (action.key === 'order' && activeOrder) onViewOrder(activeOrder);
    else if (action.key === 'review' && orderResult) onReviewResult(orderResult);
    else if (action.key === 'evidence' && qualifying) onReviewResult(qualifying);
  };
  const shownResult = orderResult || (qualifying && !qualifying.labOrderId ? qualifying : null);
  const olderOrders = orders.filter(o => o.id !== latestOrder?.id);

  return (
    <div className={styles.tab}>
      {/* 1. Gap summary + recommended action */}
      <section className={styles.summary} aria-label="Care Gap summary">
        <div className={styles.summaryHead}>
          <div className={styles.summaryTitleCol}>
            <span className={styles.eyebrow}>Care Gap evaluation</span>
            <span className={styles.summaryTitle}>{measureName}</span>
          </div>
          <GapEvaluationBadge status={gap} size="M" />
        </div>
        <p className={styles.reason}>{gapReason(labs)}</p>
        <dl className={styles.facts}>
          <div>
            <dt>
              Measurement Period
              <Tooltip label="The date range a result must fall in to count for this year's measure.">
                <Icon name="solar:info-circle-linear" size={12} color="var(--neutral-300)" />
              </Tooltip>
            </dt>
            <dd>{period.label}</dd>
          </div>
          <div>
            <dt>Evidence Required</dt>
            <dd>{rule ? rule.test : 'Not lab-based'}</dd>
          </div>
          <div>
            <dt>{qualifying ? 'Qualifying Result' : 'Last Relevant Result'}</dt>
            <dd>{evidenceResult ? `${valueText(evidenceResult)} • ${fmt(evidenceResult.collectedAt)}` : 'None on file'}</dd>
          </div>
        </dl>
        <div className={[styles.action, gap === GAP_EVALUATION.satisfied ? styles.actionDone : ''].join(' ')}>
          <Icon name={gap === GAP_EVALUATION.satisfied ? 'solar:check-circle-linear' : 'solar:lightbulb-bolt-linear'} size={18} color="currentColor" />
          <div className={styles.actionText}>
            <span className={styles.actionLabel}>Recommended Action</span>
            <span>{action.text}</span>
          </div>
          <Button onClick={runAction}>{action.label}</Button>
        </div>
        {rule && <p className={styles.requirement}>{rule.requirement}</p>}
      </section>

      {/* 2. Evidence */}
      <section className={styles.card} aria-label="Evidence">
        <header className={styles.cardHead}>
          <span className={styles.cardTitle}>Evidence</span>
          {evidenceResult && <EvidenceStatusBadge status={evidenceResult.evaluation.status} />}
        </header>
        {evidenceResult ? (
          <>
            <div className={styles.resultRow}>
              <div className={styles.resultMain}>
                <span className={styles.resultTest}>{evidenceResult.testName}</span>
                <span className={styles.resultValue}>{valueText(evidenceResult)}</span>
              </div>
              <dl className={styles.resultFacts}>
                <div><dt>Collected</dt><dd>{fmt(evidenceResult.collectedAt)}</dd></div>
                <div><dt>Source</dt><dd>{evidenceResult.source || '-'}</dd></div>
                <div><dt>Order</dt><dd>{evidenceResult.labOrderId ? 'From this gap' : 'External result'}</dd></div>
              </dl>
            </div>
            <p className={styles.explain}>{evidenceResult.evaluation.reason}</p>
          </>
        ) : (
          <p className={styles.empty}>No {rule?.short || rule?.test || 'lab'} result on file for this patient.</p>
        )}
      </section>

      {/* 3. Lab order */}
      <section className={styles.card} aria-label="Lab order">
        <header className={styles.cardHead}>
          <span className={styles.cardTitle}>Lab Order</span>
          {latestOrder && <LabOrderStatusBadge status={latestOrder.status} />}
        </header>
        {latestOrder ? (
          <>
            <div className={styles.field}>
              <span className={styles.fieldHint}>Tests</span>
              <div className={styles.tagList}>
                {testsOf(latestOrder).map(t => (
                  <Badge key={t} tone={rule && t === rule.test ? 'primary' : 'neutral'} size="sm" label={t} />
                ))}
              </div>
            </div>
            {!orderCoversGap && (
              <p className={styles.formWarn}>
                <Icon name="solar:danger-triangle-linear" size={14} color="currentColor" />
                This order does not include {rule.short || rule.test}, so it cannot close this Care Gap.
              </p>
            )}
            <dl className={styles.orderGrid}>
              <div><dt>Ordered</dt><dd>{fmt(latestOrder.orderedAt)}</dd></div>
              <div><dt>Ordering Provider</dt><dd>{latestOrder.orderingProvider || '-'}</dd></div>
              <div><dt>Performing Lab</dt><dd>{latestOrder.performingLab || '-'}</dd></div>
              <div><dt>Priority</dt><dd>{latestOrder.priority}</dd></div>
              <div><dt>{latestOrder.status === LAB_ORDER_STATUS.cancelled ? 'Cancelled' : 'Collected'}</dt><dd>{fmt(latestOrder.status === LAB_ORDER_STATUS.cancelled ? latestOrder.cancelledAt : latestOrder.collectedAt)}</dd></div>
              <div className={styles.spanAll}>
                <dt>Diagnoses</dt>
                <dd>{(latestOrder.diagnoses || []).map(diagnosisLabel).join('; ') || latestOrder.diagnosis || '-'}</dd>
              </div>
            </dl>
            <div className={styles.cardActions}>
              <Button variant="outline" size="sm" onClick={() => onViewOrder(latestOrder)}>View Order</Button>
              {CANCELLABLE_STATUSES.includes(latestOrder.status) && (
                <Button variant="outline" size="sm" onClick={() => onCancelOrder(latestOrder)}>Cancel Order</Button>
              )}
            </div>
            {latestOrder.status === LAB_ORDER_STATUS.completed && gap !== GAP_EVALUATION.satisfied && (
              <p className={styles.note}>
                <Icon name="solar:info-circle-linear" size={14} color="currentColor" />
                The order is complete, but its result did not satisfy the Care Gap.
              </p>
            )}
          </>
        ) : (
          <div className={styles.emptyRow}>
            <p className={styles.empty}>No lab has been ordered for this gap.</p>
            <Button variant="outline" size="sm" leadingIcon="solar:test-tube-linear" onClick={onOrderLab}>Order Lab</Button>
          </div>
        )}
        {olderOrders.length > 0 && (
          <>
            <button type="button" className={styles.historyToggle} onClick={() => setShowHistory(v => !v)} aria-expanded={showHistory}>
              {showHistory ? 'Hide' : 'Show'} earlier orders ({olderOrders.length})
            </button>
            {showHistory && (
              <ul className={styles.history}>
                {olderOrders.map(o => (
                  <li key={o.id}>
                    <button type="button" className={styles.historyRow} onClick={() => onViewOrder(o)}>
                      <span>{o.testName} • {fmt(o.orderedAt)}</span>
                      <LabOrderStatusBadge status={o.status} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      {/* 4. Lab result + gap evaluation */}
      {shownResult && (
        <section className={styles.card} aria-label="Lab result">
          <header className={styles.cardHead}>
            <span className={styles.cardTitle}>{shownResult.labOrderId ? 'Lab Result' : 'External Lab Result'}</span>
            {shownResult.reviewedAt
              ? <span className={styles.reviewed}>Reviewed {fmt(shownResult.reviewedAt)}</span>
              : <Button variant="outline" size="sm" onClick={() => onReviewResult(shownResult)}>Review Result</Button>}
          </header>
          {shownResult.labOrderId && orderResults.length > 1 ? (
            <ResultTable results={orderResults} gapTest={rule?.test} />
          ) : (
            <div className={styles.resultRow}>
              <div className={styles.resultMain}>
                <span className={styles.resultTest}>{shownResult.testName}</span>
                <span className={styles.resultValue}>{valueText(shownResult)}</span>
              </div>
              <dl className={styles.resultFacts}>
                <div><dt>Collected</dt><dd>{fmt(shownResult.collectedAt)}</dd></div>
                <div><dt>Resulted</dt><dd>{fmt(shownResult.resultedAt)}</dd></div>
                <div><dt>Reference Range</dt><dd>{shownResult.referenceRange || '-'}</dd></div>
                <div>
                  <dt>
                    Flag
                    <Tooltip label="Clinical interpretation of the value. It does not decide whether the gap is satisfied.">
                      <Icon name="solar:info-circle-linear" size={12} color="var(--neutral-300)" />
                    </Tooltip>
                  </dt>
                  <dd>{shownResult.flag || interpretResult(shownResult, rule) || '-'}</dd>
                </div>
                <div><dt>Source</dt><dd>{shownResult.source || '-'}</dd></div>
              </dl>
            </div>
          )}
          {rule && shownResult.testName === rule.test && <EvaluationBox result={shownResult} />}
        </section>
      )}

      <LabPrototypeControls labs={labs} />

      {evaluated.length > 1 && (
        <p className={styles.footnote}>{evaluated.length} {rule?.short || rule?.test || 'lab'} results on file for this patient.</p>
      )}
    </div>
  );
}

// "Care Gap Evaluation" box under a result: evidence decision + why, kept
// apart from the clinical flag above it.
export function EvaluationBox({ result }) {
  const ok = result.evaluation?.status === EVIDENCE_STATUS.qualifying;
  return (
    <div className={[styles.evaluation, ok ? styles.evaluationOk : styles.evaluationNo].join(' ')}>
      <Icon name={ok ? 'solar:check-circle-linear' : 'solar:close-circle-linear'} size={18} color="currentColor" />
      <div>
        <span className={styles.evaluationTitle}>
          Care Gap Evaluation: {ok ? 'Qualifying evidence found' : 'No qualifying evidence'}
        </span>
        <span className={styles.evaluationText}>{result.evaluation?.reason}</span>
      </div>
    </div>
  );
}

/**
 * Every result on one order (one collection). The row for this gap's
 * measure test is highlighted; only that row is evaluated for the gap.
 */
export function ResultTable({ results, gapTest }) {
  return (
    <table className={styles.resultTable}>
      <thead>
        <tr>
          <th>Test</th>
          <th>Value</th>
          <th>Reference Range</th>
          <th>
            Flag
            <Tooltip label="Clinical interpretation of the value. It does not decide whether the gap is satisfied.">
              <Icon name="solar:info-circle-linear" size={12} color="var(--neutral-300)" />
            </Tooltip>
          </th>
          <th>Resulted</th>
        </tr>
      </thead>
      <tbody>
        {results.map(r => (
          <tr key={r.id} className={r.testName === gapTest ? styles.resultGapRow : undefined}>
            <td>
              {r.testName}
              {r.testName === gapTest && <span className={styles.muted}> • This gap</span>}
            </td>
            <td>{valueText(r)}</td>
            <td className={styles.muted}>{r.referenceRange || '-'}</td>
            <td className={r.flag && r.flag !== 'Normal' ? styles.resultFlagHigh : styles.muted}>{r.flag || '-'}</td>
            <td className={styles.muted}>{fmt(r.resultedAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
