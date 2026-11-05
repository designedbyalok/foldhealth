import { formatDurationMinutes } from '../lib/analytics';
import { CardStats } from './AutomationCard';
import { plural } from './listUtils';
import styles from './Card.module.css';

/**
 * A template in the Templates grid. `avgMinutes` is the average run time of
 * automations created from it (null when none has run).
 */
export function TemplateCard({ template: t, avgMinutes, onOpen }) {
  return (
    <article
      className={styles.card}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(t)}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(t); }}
    >
      <h3 className={styles.title}>{t.name}</h3>
      <p className={styles.description}>{t.description}</p>
      <CardStats graph={t.graph} third={{ label: 'Used', value: plural(t.usedCount || 0, 'time') }} />
      <div className={styles.avg}>Avg. Execution Time : {formatDurationMinutes(avgMinutes)}</div>
    </article>
  );
}
