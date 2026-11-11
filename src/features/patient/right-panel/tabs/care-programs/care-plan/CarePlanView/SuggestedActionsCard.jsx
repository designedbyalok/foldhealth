import { DashboardCard, DashboardCardBody } from '@/components/DashboardCard/DashboardCard';
import { PanelSectionItem } from '@/components/PanelSection/PanelSection';
import { Icon } from '@/components/Icon/Icon';
import { Button } from '@/components/Button/Button';
import { CappedRows } from '../../../overview/cards/CappedRows';
import { describeChange, eventTitle } from '../lib/eventImpact';
import { suggestionsOf } from './suggestedActions';
import styles from './CarePlanFocusPanel.module.css';

/** One suggested change with Dismiss and Accept; `trailing` (e.g. the program) sits at the end. */
export function SuggestedActionRow({ events, impact, change, canEdit, trailing = null }) {
  const d = describeChange(change);
  const label = `${d.action} ${d.subject}${d.from !== undefined ? ` from ${d.from || 'None'} to ${d.to}` : ''}`;
  return (
    <PanelSectionItem
      inset
      alignTop
      wrapTitle
      leading={<Icon name="solar:bolt-linear" size={16} color="var(--primary-300)" />}
      title={label}
      meta={change.rationale || eventTitle(impact.event)}
      trailing={trailing}
    >
      {canEdit && (
        <span className={styles.actions}>
          <Button variant="ghost" size="sm" disabled={events.busy === impact.id} onClick={() => events.run(impact, [change], 'dismissed')}>Dismiss</Button>
          <Button variant="outline" size="sm" disabled={events.busy === impact.id} onClick={() => events.run(impact, [change], 'accepted')}>Accept</Button>
        </span>
      )}
    </PanelSectionItem>
  );
}

/**
 * The plan changes event updates suggest (useEventUpdates), each with Accept
 * and Dismiss. Renders nothing until the updates load, since an empty card
 * would wrongly say there are none. Used by the care plan's side panel and
 * the guided review's Suggested Actions step.
 */
export function SuggestedActionsCard({ events, canEdit, limit = 3 }) {
  if (!events.loaded || events.missing) return null;
  const suggestions = suggestionsOf(events);
  return (
    <DashboardCard icon="solar:lightbulb-minimalistic-linear" title="Suggested Actions" count={suggestions.length || null}>
      <DashboardCardBody className={styles.listBody}>
        {suggestions.length === 0 ? (
          <p className={styles.empty}>No suggestions right now.</p>
        ) : (
          <CappedRows
            items={suggestions}
            limit={limit}
            render={({ impact, change }) => (
              <SuggestedActionRow key={`${impact.id}:${change.id}`} events={events} impact={impact} change={change} canEdit={canEdit} />
            )}
          />
        )}
      </DashboardCardBody>
    </DashboardCard>
  );
}
