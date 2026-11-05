import { Icon } from '../../../components/Icon/Icon';
import { Tooltip } from '../../../components/Tooltip/Tooltip';
import { nodeDef, triggerDef } from '../lib/catalog';
import { getNode, orderedSteps } from '../lib/graph';
import styles from './FlowIcons.module.css';

/**
 * The trigger icon, a dotted arrow, then the distinct actions an automation
 * takes in run order (list cards, table rows, the content "used by" drawer).
 */
export function FlowIcons({ graph, max = 4 }) {
  const trigger = getNode(graph, 'trigger');
  const tdef = triggerDef(trigger?.type);
  const seen = new Set();
  const actions = [];
  for (const n of orderedSteps(graph)) {
    const def = nodeDef(n.type);
    if (def?.kind !== 'action' || seen.has(n.type)) continue;
    seen.add(n.type);
    actions.push(def);
  }
  const shown = actions.slice(0, max);
  const more = actions.length - shown.length;
  return (
    <span className={styles.flow}>
      <Tooltip label={tdef?.label || 'No trigger yet'}>
        <span className={styles.tile}>
          <Icon name={tdef?.icon || 'solar:bolt-linear'} size={16} />
        </span>
      </Tooltip>
      {shown.length > 0 && <span className={styles.arrow} aria-hidden="true" />}
      {shown.map(def => (
        <Tooltip key={def.type} label={def.nodeLabel}>
          <span className={styles.tile}>
            <Icon name={def.icon} size={16} />
          </span>
        </Tooltip>
      ))}
      {more > 0 && <span className={styles.more}>+{more}</span>}
    </span>
  );
}
