import { Toggle } from '../../../../../components/Toggle/Toggle';
import { INTERVENTION_KIND_ORDER, KIND_LABELS } from './interventionKinds';
import styles from './InterventionDrawer.module.css';

const LABELS = INTERVENTION_KIND_ORDER.map(k => KIND_LABELS[k]);
const KIND_BY_LABEL = Object.fromEntries(INTERVENTION_KIND_ORDER.map(k => [KIND_LABELS[k], k]));

/**
 * Type switcher for a new intervention, mirroring the category Toggle in
 * Create New Goals. Only rendered while creating: an existing intervention's
 * kind decides which fields it has, so changing it would discard them.
 */
export function InterventionKindToggle({ kind, onKindChange }) {
  if (!onKindChange) return null;
  return (
    <Toggle
      size="sm"
      className={styles.kindToggle}
      items={LABELS}
      value={KIND_LABELS[kind]}
      onValueChange={label => onKindChange(KIND_BY_LABEL[label])}
    />
  );
}
