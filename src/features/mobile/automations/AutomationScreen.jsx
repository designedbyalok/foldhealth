import { useEffect, useMemo } from 'react';
import { Badge } from '../../../components/Badge/Badge';
import { Button } from '../../../components/Button/Button';
import { DesktopOnlyNote } from '../../../components/DesktopOnlyNote/DesktopOnlyNote';
import { Icon } from '../../../components/Icon/Icon';
import { Switch } from '../../../components/Switch/Switch';
import { useAppStore } from '../../../store/useAppStore';
import { executionTypeOf } from '../../automations/lib/catalog';
import { formatDurationMinutes, graphCounts, historyEntries } from '../../automations/lib/analytics';
import { avgRunMinutes, fmtDate, plural, runStatus, runTitle } from '../../automations/list/listUtils';
import { MobileSubHeader } from '../MobileHeader';
import { MobileEmpty, MobileListSkeleton } from '../MobileParts';
import { useMobileNav } from '../MobileNavContext';
import { GroupedRow, GroupedSection } from '../more/GroupedList';
import common from '../mobile.module.css';
import more from '../more/more.module.css';
import styles from './automations.module.css';

const STATUS_HINT = {
  draft: 'Not published yet. Publish it on a computer to run it.',
  inactive: 'Turned off: it will not run until you turn it on.',
};

/**
 * One automation (desktop quick view + History Log): what it does, its
 * figures, the on/off switch, Run now (active only, as desktop) and the
 * history of edits and runs. The flow itself is edited on a computer.
 */
export function AutomationScreen({ id }) {
  const { push } = useMobileNav();
  const a = useAppStore(s => s.automations.find(x => x.id === id));
  const status = useAppStore(s => s.automationsStatus);
  const activity = useAppStore(s => s.automationActivity[id]);
  const fetchAutomations = useAppStore(s => s.fetchAutomations);
  const fetchAutomationActivity = useAppStore(s => s.fetchAutomationActivity);
  const setAutomationStatus = useAppStore(s => s.setAutomationStatus);

  useEffect(() => { fetchAutomations(); }, [fetchAutomations]);
  useEffect(() => { fetchAutomationActivity(id); }, [id, fetchAutomationActivity]);

  const runs = useMemo(() => activity?.runs || [], [activity]);
  const groups = useMemo(() => {
    const out = [];
    for (const e of historyEntries(activity?.runs, activity?.editLog)) {
      const day = fmtDate(e.at);
      if (out.at(-1)?.day !== day) out.push({ day, items: [] });
      out.at(-1).items.push(e);
    }
    return out;
  }, [activity]);

  if (!a) {
    return (
      <div className={common.screen}>
        <MobileSubHeader title="Automation" />
        <div className={common.body}>
          {status !== 'ready' ? <MobileListSkeleton /> : <MobileEmpty icon="solar:bolt-linear" title="This automation was not found" />}
        </div>
      </div>
    );
  }

  const isActive = a.status === 'active';
  const counts = graphCounts(a.draftGraph || a.graph);
  const loadingHistory = !activity || activity.status === 'loading';

  return (
    <div className={common.screen}>
      <MobileSubHeader title={a.name} />
      <div className={common.body}>
        <div className={more.stack}>
          <div className={styles.hero}>
            {a.description && <p className={styles.description}>{a.description}</p>}
            <p className={styles.by}>
              Created by {a.createdBy || 'Unknown'}
              {a.updatedAt && a.updatedAt !== a.createdAt ? ` · Last edited ${fmtDate(a.updatedAt)} by ${a.updatedBy || a.createdBy || 'Unknown'}` : ''}
            </p>
          </div>

          <GroupedSection footer={STATUS_HINT[a.status]}>
            {a.status === 'draft' ? (
              <GroupedRow icon="solar:power-linear" label="Status" trailing={<Badge label="Draft" />} />
            ) : (
              <GroupedRow
                icon="solar:power-linear"
                label={isActive ? 'On' : 'Off'}
                trailing={(
                  <span className={styles.switch}>
                    <Switch
                      checked={isActive}
                      onChange={(on) => setAutomationStatus(a.id, on ? 'active' : 'inactive')}
                      ariaLabel={isActive ? 'Turn off automation' : 'Turn on automation'}
                    />
                  </span>
                )}
              />
            )}
            <GroupedRow icon="solar:play-circle-linear" label="Execution" detail={executionTypeOf(a.schedule)} />
            <GroupedRow icon="solar:users-group-rounded-linear" label="Population group" detail={a.populationGroupName || 'None'} />
          </GroupedSection>

          <div className={styles.stats}>
            <Stat label="# Conditions" value={counts.conditions} />
            <Stat label="# Actions" value={counts.actions} />
            <Stat label="Used" value={plural(runs.length, 'time')} />
            <Stat label="Avg. execution" value={formatDurationMinutes(avgRunMinutes(runs))} />
          </div>

          <DesktopOnlyNote description="Edit the flow, see analytics or duplicate this automation in Settings > Automations on a computer." />

          <section className={styles.day} aria-label="History log">
            <h2 className={styles.historyLabel}>History log</h2>
            {loadingHistory ? <MobileListSkeleton count={3} /> : groups.length === 0 ? (
              <MobileEmpty icon="solar:history-linear" title="No history yet" description="Edits and runs will show up here." />
            ) : groups.map(g => (
              <GroupedSection key={g.day} label={g.day}>
                {g.items.map(e => <HistoryEntry key={e.id} entry={e} />)}
              </GroupedSection>
            ))}
          </section>
        </div>
      </div>
      <div className={styles.footer}>
        <Button size="lg" leadingIcon="solar:bolt-linear" disabled={!isActive} onClick={() => push('automationRun', { id: a.id })}>
          {isActive ? 'Run now' : a.status === 'draft' ? 'Publish to run' : 'Turn on to run'}
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}</span>
    </div>
  );
}

function HistoryEntry({ entry: e }) {
  const run = e.kind === 'run';
  return (
    <div className={styles.entry}>
      <span className={`${styles.entryIcon} ${run ? styles.entryIconRun : ''}`}>
        <Icon name={run ? 'solar:bolt-linear' : 'solar:pen-linear'} size={16} color="currentColor" />
      </span>
      <span className={styles.entryText}>
        {run ? (
          <>
            <span>{runTitle(e)}</span>
            <span className={styles.badges}>
              {e.success > 0 && <Badge tone="success" size="sm" label={plural(e.success, 'member')} />}
              {e.inProgress > 0 && <Badge tone="warning" size="sm" label={`${plural(e.inProgress, 'member')} in progress`} />}
              {e.failed > 0 && <Badge tone="danger" size="sm" label={`${plural(e.failed, 'member')} failed`} />}
            </span>
            <span className={styles.entrySub}>
              Status: {runStatus(e)}
              {e.actor && e.runKind !== 'event' && e.runKind !== 'scheduled' ? ` Run by ${e.actor}.` : ''}
            </span>
          </>
        ) : (
          <>
            <span className={styles.entrySub}>By {e.actor || 'Unknown'}</span>
            <span>{e.summary}</span>
          </>
        )}
      </span>
    </div>
  );
}
