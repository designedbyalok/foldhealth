import { LEGEND_STATUSES } from './statusSpec';
import { StatusIcon } from './StatusIcon';
import styles from './StatusLegend.module.css';

/**
 * StatusLegend: horizontal bar at the bottom of the HCC worklist that
 * explains the colored status icons in role cells. Icon + color come from
 * `statusSpec.js` so the legend stays in sync with the row cells and the
 * DiagPanel status pill.
 *
 * Layout matches the Figma reference (node 12082-513650): 9 statuses,
 * each as `[icon] label` with icon tinted to the status color.
 */
export function StatusLegend() {
  return (
    <div className={styles.legend}>
      <span className={styles.label}>Legend:</span>
      {LEGEND_STATUSES.map((it) => (
        <span key={it.status} className={styles.item}>
          <StatusIcon status={it.status} size={13} color={it.color} />
          <span style={{ color: it.color }}>{it.label}</span>
        </span>
      ))}
    </div>
  );
}
