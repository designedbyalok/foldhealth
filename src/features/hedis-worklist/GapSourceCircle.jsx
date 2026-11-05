import { gapSourceLabel } from './hedisFilters';
import styles from './GapSourceCircle.module.css';

// A gap's source as a letter in a circle, as on the HCC worklist's DOS:
// M = added in Fold (manual), C = from the health plan gap report (claim).
// Shared by the worklist row and the Care Gap Details instance picker.
export function GapSourceCircle({ gap }) {
  const manual = gapSourceLabel(gap) === 'Manual';
  return (
    <span
      className={`${styles.circle} ${manual ? styles.manual : styles.claim}`}
      aria-label={manual ? 'Manual' : 'Claim'}
    >
      {manual ? 'M' : 'C'}
    </span>
  );
}
