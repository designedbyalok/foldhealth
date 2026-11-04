import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { Badge } from '../../../components/Badge/Badge';
import { Button } from '../../../components/Button/Button';
import { CloseButton } from '../../../components/CloseButton/CloseButton';
import { Icon } from '../../../components/Icon/Icon';
import { EmptyState } from '../../../components/EmptyState/EmptyState';
import { Tooltip } from '../../../components/Tooltip/Tooltip';
import { DashboardCardSkeleton } from '../../../components/DashboardCard/DashboardCard';
import { nodeStats } from '../lib/analytics';
import { nodeSummary, orderedSteps } from '../lib/graph';
import { AutomationCanvas } from '../canvas/AutomationCanvas';
import {
  RETRY_HINT, STEP_STATUSES, fmtDateTime, memberStatusDef, outcomeLabel, stepLabel, stepStatusDef, stoppedStep,
} from './analyticsUi';
import styles from './Analytics.module.css';

/**
 * One member's run of an automation: the flow with only this member's path
 * lit (the run's own graph, since the automation may have changed since),
 * and the steps they reached in order with outcomes and errors.
 */
export function MemberTrace({ id, runMemberId }) {
  const automation = useAppStore(s => s.automations.find(a => a.id === id));
  const automationsStatus = useAppStore(s => s.automationsStatus);
  const activity = useAppStore(s => s.automationActivity[id]);
  const automationRuns = useAppStore(s => s.automationRuns);
  const fetchAutomationActivity = useAppStore(s => s.fetchAutomationActivity);
  const retryAutomationMember = useAppStore(s => s.retryAutomationMember);
  const navigateToPatient = useAppStore(s => s.navigateToPatient);
  const openAutomationAnalytics = useAppStore(s => s.openAutomationAnalytics);
  const openAutomationTrace = useAppStore(s => s.openAutomationTrace);
  const openAutomationsList = useAppStore(s => s.openAutomationsList);
  const showToast = useAppStore(s => s.showToast);
  const [busy, setBusy] = useState(false);

  // After the list lands (see AutomationAnalytics): the slice then knows its data source.
  useEffect(() => {
    if (automationsStatus === 'ready') fetchAutomationActivity(id);
  }, [id, automationsStatus, fetchAutomationActivity]);

  const member = activity?.members?.find(m => m.id === runMemberId) || null;
  const graph = useMemo(() => {
    if (!member) return automation?.graph;
    return activity?.runs?.find(r => r.id === member.runId)?.graph
      || automationRuns.find(r => r.id === member.runId)?.graph
      || automation?.graph;
  }, [member, activity, automationRuns, automation]);
  const stats = useMemo(() => (member && graph ? nodeStats([member], graph) : null), [member, graph]);
  const stop = useMemo(() => (member && graph ? stoppedStep(member, graph) : null), [member, graph]);
  const steps = useMemo(() => (member && graph
    ? orderedSteps(graph).filter(n => member.path?.[n.id]).map(n => ({ node: n, step: member.path[n.id] }))
    : []), [member, graph]);

  const close = () => openAutomationAnalytics(id);

  const loading = !automation ? automationsStatus !== 'ready' : (!activity || activity.status === 'loading');
  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.cards}><DashboardCardSkeleton title="Member trace" rows={5} /></div>
      </div>
    );
  }
  if (!automation || !member) {
    return (
      <div className={`${styles.page} ${styles.centered}`}>
        <EmptyState icon="solar:user-cross-rounded-linear" title="This member’s run is older than 90 days or was removed.">
          <Button variant="outline" leadingIcon="solar:arrow-left-linear" onClick={automation ? close : () => openAutomationsList()}>
            {automation ? 'Back to analytics' : 'Back to automations'}
          </Button>
        </EmptyState>
      </div>
    );
  }

  const status = memberStatusDef(member.status);
  const retrigger = async () => {
    setBusy(true);
    const next = await retryAutomationMember(member, 'retrigger');
    setBusy(false);
    if (!next) { showToast?.('Could not re-trigger the automation'); return; }
    showToast?.(`Re-triggered for ${member.patientName}: ${memberStatusDef(next.status).label.toLowerCase()}`);
    openAutomationTrace(id, next.id);
  };

  return (
    <div className={`${styles.page} ${styles.tracePage}`}>
      <header className={styles.header}>
        <p className={styles.meta}>{member.patientName} • Executed on {fmtDateTime(member.startedAt)}</p>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{automation.name}</h1>
          <Badge tone={status.tone} size="sm" label={status.label} />
          <div className={styles.headerActions}>
            <Button variant="outline" leadingIcon="solar:user-id-linear" onClick={() => navigateToPatient(member.patientId)}>View patient profile</Button>
            <Tooltip label={member.status === 'completed' ? 'This member completed the automation.' : RETRY_HINT} maxWidth={260} align="right">
              <Button leadingIcon="solar:restart-linear" disabled={member.status === 'completed'} onClick={retrigger} loading={busy}>
                Re-trigger
              </Button>
            </Tooltip>
            <span className={styles.headerDivider} aria-hidden />
            <CloseButton onClick={close} size={20} label="Back to analytics" />
          </div>
        </div>
      </header>

      <div className={styles.traceBody}>
        <div className={styles.nodeWrap}>
          <div className={styles.nodeLegend}>
            {STEP_STATUSES.map(s => (
              <span key={s.key} className={styles.legendItem}>
                <span className={styles.dot} style={{ background: s.color }} aria-hidden />
                {s.label}
              </span>
            ))}
          </div>
          <div className={styles.canvasBox}>
            <AutomationCanvas graph={graph} mode="stats" stats={stats} focusId={stop?.node?.id || null} />
          </div>
        </div>

        <aside className={styles.timeline} aria-label="Steps this member reached">
          <h2 className={styles.timelineTitle}>Steps</h2>
          {member.failingReason && <p className={styles.errorText}>{member.failingReason}</p>}
          <ol className={styles.steps}>
            {steps.map(({ node, step }) => {
              const s = stepStatusDef(step.status);
              const summary = node.id === 'trigger' ? null : nodeSummary(node);
              const outcome = outcomeLabel(node, step.outcome);
              return (
                <li key={node.id} className={styles.stepItem} data-status={step.status}>
                  <span className={styles.stepIcon} style={{ color: s.color }}>
                    <Icon name={s.icon} size={16} />
                  </span>
                  <div className={styles.stepText}>
                    <div className={styles.stepHead}>
                      <span className={styles.stepLabel}>{stepLabel(node)}</span>
                      {outcome && <Badge size="sm" label={outcome} />}
                    </div>
                    {summary && <span className={styles.stepSummary}>{summary}</span>}
                    <span className={styles.memberMeta}>{fmtDateTime(step.at)}</span>
                    {step.status === 'in_progress' && step.until && <span className={styles.warningText}>Waiting until {fmtDateTime(step.until)}</span>}
                    {step.error && <span className={styles.errorText}>{step.error}</span>}
                    {step.reasons?.length > 0 && (
                      <ul className={styles.reasons}>{step.reasons.map(r => <li key={r}>{r}</li>)}</ul>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </aside>
      </div>
    </div>
  );
}
