import { Badge } from '../../../components/Badge/Badge';
import { Button } from '../../../components/Button/Button';
import { Icon } from '../../../components/Icon/Icon';
import { Switch } from '../../../components/Switch/Switch';
import { Tooltip } from '../../../components/Tooltip/Tooltip';
import { graphCounts, formatDurationMinutes } from '../lib/analytics';
import { AutomationMenu } from './AutomationMenu';
import { avgRunMinutes, latestFailures, plural } from './listUtils';
import styles from './Card.module.css';

export function CardStats({ graph, third }) {
  const counts = graphCounts(graph);
  return (
    <div className={styles.stats}>
      <div className={styles.stat}><span className={styles.statLabel}># Conditions</span><span className={styles.statValue}>{counts.conditions}</span></div>
      <div className={styles.stat}><span className={styles.statLabel}># Actions</span><span className={styles.statValue}>{counts.actions}</span></div>
      <div className={styles.stat}><span className={styles.statLabel}>{third.label}</span><span className={styles.statValue}>{third.value}</span></div>
    </div>
  );
}

/** One of "My Automations" in the grid view. `actions` comes from AutomationsList. */
export function AutomationCard({ automation: a, runs, actions }) {
  const failures = latestFailures(a, runs);
  const isDraft = a.status === 'draft';
  const graph = a.draftGraph || a.graph;
  return (
    <article
      className={styles.card}
      role="button"
      tabIndex={0}
      onClick={() => actions.open(a)}
      onKeyDown={(e) => { if (e.key === 'Enter') actions.open(a); }}
    >
      <h3 className={styles.title}>{a.name}</h3>
      <p className={styles.description}>{a.description || 'No description yet.'}</p>
      <CardStats graph={graph} third={{ label: 'Used', value: plural(runs.length, 'time') }} />
      <div className={styles.avg}>Avg. Execution Time : {formatDurationMinutes(avgRunMinutes(runs))}</div>
      <div className={styles.footer} onClick={e => e.stopPropagation()}>
        {isDraft ? (
          <>
            <Badge size="sm" label="Draft" />
            <span className={styles.footerRight}>
              <Button variant="outline" size="sm" leadingIcon="solar:pen-linear" onClick={() => actions.edit(a)}>Continue editing</Button>
              <AutomationMenu hasRuns={runs.length > 0} onSelect={(key) => actions.menu(key, a)} />
            </span>
          </>
        ) : (
          <>
            <Switch
              checked={a.status === 'active'}
              onChange={(on) => actions.toggle(a, on)}
              ariaLabel={a.status === 'active' ? 'Turn off automation' : 'Turn on automation'}
            />
            <span className={styles.footerRight}>
              {failures > 0 && (
                <Tooltip label={`${plural(failures, 'member')} failed in the latest run`}>
                  <button type="button" className={styles.errorLink} onClick={() => actions.errors(a)}>
                    <Icon name="solar:danger-triangle-linear" size={14} />
                    {failures}
                  </button>
                </Tooltip>
              )}
              {a.status === 'active' && (
                <Button variant="outline" size="sm" leadingIcon="solar:play-linear" onClick={() => actions.run(a)}>Run</Button>
              )}
              <AutomationMenu hasRuns={runs.length > 0} onSelect={(key) => actions.menu(key, a)} />
            </span>
          </>
        )}
      </div>
    </article>
  );
}
