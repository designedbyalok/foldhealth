import { useEffect, useMemo } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { Drawer } from '../../../components/Drawer/Drawer';
import { Badge } from '../../../components/Badge/Badge';
import { Icon } from '../../../components/Icon/Icon';
import { EmptyState } from '../../../components/EmptyState/EmptyState';
import { TimelineSkeleton } from '../../../components/TimelineSkeleton/TimelineSkeleton';
import { historyEntries } from '../lib/analytics';
import { fmtDate, plural, runStatus, runTitle } from './listUtils';
import styles from './HistoryLogDrawer.module.css';

/**
 * History Log: edits and runs of one automation, newest first, grouped by
 * day. A failed-members badge opens Analytics on the failed members.
 */
export function HistoryLogDrawer({ automation, onClose }) {
  const fetchAutomationActivity = useAppStore(s => s.fetchAutomationActivity);
  const activity = useAppStore(s => s.automationActivity[automation.id]);
  const setAutomationsView = useAppStore(s => s.setAutomationsView);

  useEffect(() => { fetchAutomationActivity(automation.id); }, [automation.id, fetchAutomationActivity]);

  const groups = useMemo(() => {
    const out = [];
    for (const e of historyEntries(activity?.runs, activity?.editLog)) {
      const day = fmtDate(e.at);
      if (out.at(-1)?.day !== day) out.push({ day, items: [] });
      out.at(-1).items.push(e);
    }
    return out;
  }, [activity]);

  const openFailed = () => {
    setAutomationsView({ screen: 'analytics', id: automation.id, analyticsTab: 'global', runMemberId: null, drawer: 'overview:failed' });
    onClose();
  };

  const loading = !activity || activity.status === 'loading';

  return (
    <Drawer
      title={(
        <span className={styles.titleBlock}>
          <span>History Log</span>
          <span className={styles.subtitle}>{automation.name}</span>
        </span>
      )}
      width={516}
      onClose={onClose}
      bodyClassName={styles.body}
    >
      {loading && <TimelineSkeleton />}
      {!loading && groups.length === 0 && (
        <div className={styles.empty}>
          <EmptyState icon="solar:history-linear" title="No history yet. Edits and runs will show up here." />
        </div>
      )}
      {!loading && groups.length > 0 && (
        <ol className={styles.timeline}>
          {groups.map(g => (
            <li key={g.day} className={styles.day}>
              <div className={styles.dayLabel}>{g.day}</div>
              <ol className={styles.entries}>
                {g.items.map(e => (
                  <li key={e.id} className={styles.entry}>
                    <span className={`${styles.marker} ${e.kind === 'run' ? styles.markerRun : ''}`}>
                      <Icon name={e.kind === 'run' ? 'solar:bolt-linear' : 'solar:pen-linear'} size={16} />
                    </span>
                    <div className={styles.card}>
                      {e.kind === 'edit' ? (
                        <>
                          <span className={styles.by}>By {e.actor || 'Unknown'}</span>
                          <span className={styles.text}>{e.summary}</span>
                        </>
                      ) : (
                        <>
                          <span className={styles.text}>{runTitle(e)}</span>
                          <span className={styles.badges}>
                            {e.success > 0 && <Badge tone="success" size="sm" label={plural(e.success, 'member')} />}
                            {e.inProgress > 0 && <Badge tone="warning" size="sm" label={`${plural(e.inProgress, 'member')} in progress`} />}
                            {e.failed > 0 && (
                              <button type="button" className={styles.badgeButton} onClick={openFailed} aria-label={`View ${plural(e.failed, 'failed member')}`}>
                                <Badge tone="danger" size="sm" label={`${plural(e.failed, 'member')} failed`} trailingIcon="solar:alt-arrow-right-linear" />
                              </button>
                            )}
                          </span>
                          <span className={styles.status}>
                            Status: {runStatus(e)}
                            {e.actor && e.runKind !== 'event' && e.runKind !== 'scheduled' ? ` Run by ${e.actor}.` : ''}
                          </span>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      )}
    </Drawer>
  );
}
