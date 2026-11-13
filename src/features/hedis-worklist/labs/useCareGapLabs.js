import { useEffect, useMemo } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { priorLabResultsFor } from './labMock';
import {
  LAB_MEASURE_RULES, LAB_ORDER_STATUS, EVIDENCE_STATUS, deriveLabState, evaluateResult, interpretResult,
  measurementPeriod, testsOf, testsLabel,
} from './labRules';

const EMPTY = [];
const uid = (p) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');

/**
 * Care Gap lab workflow for one member + gap: derived state plus the actions
 * the Orders tab, the order / result panes and the prototype controls call.
 * Every state change is written to the gap's Activity timeline.
 */
export function useCareGapLabs({ member, gapCode, year }) {
  const fetchCaregapLabs = useAppStore(s => s.fetchCaregapLabs);
  const loaded = useAppStore(s => s.caregapLabsLoaded);
  const tableMissing = useAppStore(s => s.caregapLabsTableMissing);
  const allOrders = useAppStore(s => s.caregapLabOrders[member?.id]) || EMPTY;
  const allResults = useAppStore(s => s.caregapLabResults[member?.id]) || EMPTY;
  const saveLabOrder = useAppStore(s => s.saveLabOrder);
  const saveLabResult = useAppStore(s => s.saveLabResult);
  const storeLogCareGapActivity = useAppStore(s => s.logCareGapActivity);
  // Logged against this gap unless the entry names its own.
  const logCareGapActivity = (memberId, entry) => storeLogCareGapActivity(memberId, { gapCode, ...entry });
  const currentActorName = useAppStore(s => s.currentActorName);
  const updateGapStatus = useAppStore(s => s.updateGapStatus);
  const showToast = useAppStore(s => s.showToast);

  useEffect(() => { fetchCaregapLabs(); }, [fetchCaregapLabs]);

  const period = useMemo(() => measurementPeriod(year || new Date().getFullYear()), [year]);
  const gapRule = LAB_MEASURE_RULES[gapCode] || null;
  // Evidence is patient-level: an order placed from another gap that
  // includes this measure's test (and its result) counts here too.
  const orders = useMemo(
    () => allOrders.filter(o => o.gapCode === gapCode || (gapRule && testsOf(o).includes(gapRule.test))),
    [allOrders, gapCode, gapRule],
  );
  // Before the migration runs, show the same prior result the seed adds.
  const results = useMemo(() => {
    const own = allResults.filter(r => r.gapCode === gapCode || (gapRule && r.testName === gapRule.test));
    const prior = tableMissing ? priorLabResultsFor(member).filter(r => r.gapCode === gapCode && !own.some(o => o.id === r.id)) : [];
    return [...own, ...prior];
  }, [allResults, gapCode, gapRule, tableMissing, member]);
  const state = useMemo(() => deriveLabState({ gapCode, orders, results, period }), [gapCode, orders, results, period]);

  const log = (title, outcome, tone) => logCareGapActivity(member.id, {
    when: new Date().toISOString(),
    actor: currentActorName(),
    t: 'lab',
    title,
    outcome,
    outcomeColor: tone,
    gapCodes: [gapCode],
  });

  const placeOrder = (values) => {
    const now = new Date().toISOString();
    const order = {
      id: uid('labord'),
      memberId: member.id,
      gapCode,
      measurementYear: Number(year),
      tests: values.tests,
      testName: values.tests.join(', '),
      diagnoses: values.diagnoses,
      priority: values.priority,
      performingLab: values.performingLab,
      orderingProvider: values.orderingProvider,
      // Sent to the lab straight away; the patient still has to be drawn.
      status: LAB_ORDER_STATUS.awaiting,
      orderedAt: now,
      createdBy: currentActorName(),
    };
    saveLabOrder(order);
    log('Lab Order Created', `${order.testName} ordered by ${order.orderingProvider} • ${order.priority} • ${order.performingLab} • Dx ${order.diagnoses.map(d => d.code).join(', ')}`);
    log('Awaiting Collection', `${order.testName}: the patient has not completed collection yet`, 'var(--status-warning)');
    showToast(`Lab order placed (${order.tests.length} test${order.tests.length === 1 ? '' : 's'}). Awaiting collection.`);
    return order;
  };

  const setOrderStatus = (order, status, extra = {}) => saveLabOrder({ ...order, ...extra, status });

  const simulateCollection = (order) => {
    const at = new Date().toISOString();
    setOrderStatus(order, LAB_ORDER_STATUS.collected, { collectedAt: at });
    log('Specimen Collected', `${order.testName} specimen collected`);
  };
  const simulateProcessing = (order) => {
    setOrderStatus(order, LAB_ORDER_STATUS.inProcess);
    log('In Process', `${order.performingLab} is processing the ${order.testName}`);
  };

  // `external`: arrived from an outside feed rather than one of our orders.
  const recordResult = (result, { order = null, external = false } = {}) => {
    const evaluation = evaluateResult(result, state.rule, period);
    const full = { ...result, evidenceStatus: evaluation.status };
    saveLabResult(full);
    if (order) setOrderStatus(order, LAB_ORDER_STATUS.resultAvailable);
    const shown = full.value == null ? 'no reportable value' : `${full.value}${full.unit ? ` ${full.unit}` : ''}`;
    log(external ? 'External Result Imported' : 'Result Received', `${full.testName}: ${shown}${full.source ? ` • ${full.source}` : ''}`);
    // A measure with no lab rule isn't evaluated on lab results.
    if (!state.rule) return full;
    log(
      'Care Gap Evaluated',
      evaluation.status === EVIDENCE_STATUS.qualifying ? 'Result satisfies evidence criteria' : `Result does not satisfy the measure (${evaluation.status})`,
      evaluation.status === EVIDENCE_STATUS.qualifying ? 'var(--status-success)' : 'var(--status-error)',
    );
    if (evaluation.status === EVIDENCE_STATUS.qualifying) log('Care Gap Satisfied', `Qualifying ${full.testName} for ${period.label}`, 'var(--status-success)');
    return full;
  };

  // All of an order's results come back together from one collection. The
  // preset drives this gap's test; any other test on the order gets a
  // routine in-range result.
  const simulateResult = (order, preset) => {
    const now = new Date();
    const base = {
      labOrderId: order.id,
      memberId: member.id,
      gapCode,
      collectedAt: order.collectedAt || now.toISOString(),
      resultedAt: now.toISOString(),
      source: order.performingLab,
    };
    let gapResult = null;
    testsOf(order).forEach(test => {
      const isGapTest = state.rule && test === state.rule.test;
      const testRule = Object.values(LAB_MEASURE_RULES).find(r => r?.test === test) || null;
      const result = {
        ...base,
        id: uid('labres'),
        testName: test,
        value: isGapTest ? preset.value : (testRule?.simulate?.[0]?.value ?? 'Normal'),
        note: isGapTest ? (preset.note || '') : '',
        unit: testRule?.unit || '',
        referenceRange: testRule?.referenceRange || '',
      };
      result.flag = interpretResult(result, testRule);
      const saved = isGapTest || !state.rule ? recordResult(result) : saveOther(result);
      if (isGapTest) gapResult = saved;
    });
    setOrderStatus(order, LAB_ORDER_STATUS.resultAvailable);
    return gapResult;
  };
  // Results for the order's other tests: stored and logged, not evaluated
  // against this gap.
  const saveOther = (result) => {
    saveLabResult(result);
    log('Result Received', `${result.testName}: ${result.value}${result.unit ? ` ${result.unit}` : ''} • ${result.source}`);
    return result;
  };

  // External result (e.g. from a Labcorp feed): no order needed.
  const importExternalResult = () => {
    const rule = state.rule;
    if (!rule) return null;
    const collected = new Date(Math.max(period.start.getTime(), Date.now() - 16 * 86400000));
    const result = {
      id: uid('labres-ext'),
      labOrderId: null,
      memberId: member.id,
      gapCode,
      testName: rule.test,
      value: rule.external.value,
      unit: rule.unit || '',
      referenceRange: rule.referenceRange,
      collectedAt: collected.toISOString(),
      resultedAt: new Date(collected.getTime() + 86400000).toISOString(),
      source: rule.external.source,
    };
    result.flag = interpretResult(result, rule);
    const full = recordResult(result, { external: true });
    showToast(`External ${rule.test} imported from ${rule.external.source}`);
    return full;
  };

  const cancelOrder = (order, reason) => {
    setOrderStatus(order, LAB_ORDER_STATUS.cancelled, { cancelledAt: new Date().toISOString(), cancelReason: reason || '' });
    log('Lab Order Cancelled', `${testsLabel(order)}${reason ? ` • ${reason}` : ''} • Care Gap remains open`, 'var(--status-error)');
    showToast('Lab order cancelled');
  };

  // Reviewing closes the order; the gap's HEDIS status only moves when the
  // reviewer chooses to, and only for qualifying evidence.
  const reviewResult = (result, { closeGap } = {}) => {
    const stamp = { reviewedBy: currentActorName(), reviewedAt: new Date().toISOString() };
    // Reviewing an order's result reviews every result on that order.
    const batch = result.labOrderId ? state.evaluated.filter(r => r.labOrderId === result.labOrderId) : [result];
    batch.forEach(r => {
      const reviewed = { ...r, ...stamp };
      delete reviewed.evaluation;
      saveLabResult(reviewed);
    });
    const order = result.labOrderId ? orders.find(o => o.id === result.labOrderId) : null;
    if (order && order.status !== LAB_ORDER_STATUS.completed) {
      setOrderStatus(order, LAB_ORDER_STATUS.completed);
      log('Lab Order Completed', `${testsLabel(order)} result${testsOf(order).length === 1 ? '' : 's'} reviewed`);
    } else {
      log('Result Reviewed', `${result.testName} reviewed`);
    }
    if (closeGap && result.evaluation?.status === EVIDENCE_STATUS.qualifying) {
      updateGapStatus(member.id, gapCode, 'Completed');
      showToast('Result reviewed. Care Gap marked Completed.');
    } else {
      showToast('Result reviewed');
    }
  };

  return {
    ...state,
    loading: !loaded,
    period,
    orders,
    results,
    fmtDate,
    placeOrder,
    simulateCollection,
    simulateProcessing,
    simulateResult,
    importExternalResult,
    cancelOrder,
    reviewResult,
  };
}
