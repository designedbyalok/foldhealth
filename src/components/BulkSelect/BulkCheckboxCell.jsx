import { Checkbox } from '../ShadcnCheckbox/ShadcnCheckbox';
import styles from './BulkCheckboxCell.module.css';

/**
 * The sticky-left checkbox `<td>` a row renders in bulk-select mode.
 *
 * WorklistShell owns bulk-select state and injects the matching select column,
 * but a row's `<tr>` is opaque to the shell, so the row renders this cell
 * itself — driven by the `ctx.bulk` context the shell passes to renderRow:
 *
 *   renderRow={(row, i, ctx) => (
 *     <tr onClick={() => ctx.bulk?.active ? ctx.bulk.toggle(row.id) : open(row)}>
 *       {ctx.bulk?.active && (
 *         <BulkCheckboxCell
 *           selected={ctx.bulk.isSelected(row.id)}
 *           onToggle={() => ctx.bulk.toggle(row.id)}
 *           label={`Select ${row.name}`}
 *         />
 *       )}
 *       <td style={{ left: ctx.bulk?.active ? 36 : 0 }}>…</td>
 *     </tr>
 *   )}
 *
 * Stops click propagation so ticking the box never also fires the row action.
 */
export function BulkCheckboxCell({ selected, onToggle, label }) {
  return (
    <td
      className={`${styles.checkTd} ${styles.stickyLeft}`}
      style={{ left: 0 }}
      onClick={(e) => e.stopPropagation()}
    >
      <Checkbox checked={selected} onCheckedChange={onToggle} aria-label={label} />
    </td>
  );
}
