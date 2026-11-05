import { useState } from 'react';
import { Button } from '../../../components/Button/Button';
import { Icon } from '../../../components/Icon/Icon';
import { LAB_ORDER_STATUS } from './labRules';
import styles from './CareGapLabs.module.css';

// Results for ordered tests with no measure rule (e.g. a CBC on a CBP gap).
const GENERIC_PRESETS = [
  { key: 'normal', label: 'Normal result', value: 'Normal' },
  { key: 'rejected', label: 'No Qualifying Result', value: null, note: 'Specimen rejected by the lab.' },
];

/**
 * Prototype-only controls: move the current order through the lab's
 * process, simulate a result arriving, or import an external result. Stand-in
 * for the lab interface; every step still goes through the real workflow
 * actions, so the timeline and evaluation behave as they will in production.
 */
export function LabPrototypeControls({ labs }) {
  const [open, setOpen] = useState(false);
  const order = labs.activeOrder;
  const presets = labs.rule?.simulate || GENERIC_PRESETS;
  const canCollect = order && (order.status === LAB_ORDER_STATUS.awaiting || order.status === LAB_ORDER_STATUS.ordered);
  const canProcess = order?.status === LAB_ORDER_STATUS.collected;
  const canResult = order && (order.status === LAB_ORDER_STATUS.collected || order.status === LAB_ORDER_STATUS.inProcess);

  return (
    <section className={styles.proto} aria-label="Prototype controls">
      <button type="button" className={styles.protoHead} onClick={() => setOpen(v => !v)} aria-expanded={open}>
        <Icon name="solar:widget-5-linear" size={14} color="currentColor" />
        Prototype controls
        <span className={styles.protoHint}>Simulates the lab interface</span>
        <Icon name={open ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'} size={14} color="currentColor" />
      </button>
      {open && (
        <div className={styles.protoBody}>
          <div className={styles.protoRow}>
            <span className={styles.protoLabel}>Lab progress</span>
            <Button variant="outline" size="sm" disabled={!canCollect} onClick={() => labs.simulateCollection(order)}>Simulate Collection</Button>
            <Button variant="outline" size="sm" disabled={!canProcess} onClick={() => labs.simulateProcessing(order)}>Start Processing</Button>
          </div>
          <div className={styles.protoRow}>
            <span className={styles.protoLabel}>Simulate Result</span>
            {presets.map(p => (
              <Button key={p.key} variant="outline" size="sm" disabled={!canResult} onClick={() => labs.simulateResult(order, p)}>{p.label}</Button>
            ))}
          </div>
          <div className={styles.protoRow}>
            <span className={styles.protoLabel}>External feed</span>
            <Button variant="outline" size="sm" disabled={!labs.rule} onClick={() => labs.importExternalResult()}>
              Import External Result{labs.rule ? ` (${labs.rule.external.source})` : ''}
            </Button>
          </div>
          {!order && <p className={styles.protoNote}>Place a lab order to simulate collection and results.</p>}
        </div>
      )}
    </section>
  );
}
