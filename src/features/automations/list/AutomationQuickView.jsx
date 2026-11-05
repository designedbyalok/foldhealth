import { useEffect, useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { Button } from '../../../components/Button/Button';
import { Tooltip } from '../../../components/Tooltip/Tooltip';
import { Icon } from '../../../components/Icon/Icon';
import { AutomationStatsRow } from '../shared/AutomationStatsRow';
import { PreviewModal } from './PreviewModal';
import { fmtDate } from './listUtils';

/**
 * Quick view of one of My Automations (list card or row click): who made it,
 * Edit / Analytics / Duplicate / Run, the stats strip and the flow.
 * Run hands back to the list (`onRun`), which opens the Run drawer once this
 * modal has closed.
 */
export function AutomationQuickView({ automation: a, onRun, onClose }) {
  const fetchAutomationActivity = useAppStore(s => s.fetchAutomationActivity);
  const activity = useAppStore(s => s.automationActivity[a.id]);
  const openAutomationBuilder = useAppStore(s => s.openAutomationBuilder);
  const openAutomationAnalytics = useAppStore(s => s.openAutomationAnalytics);
  const duplicateAutomation = useAppStore(s => s.duplicateAutomation);
  const [duplicating, setDuplicating] = useState(false);

  useEffect(() => { fetchAutomationActivity(a.id); }, [a.id, fetchAutomationActivity]);

  const runs = activity?.runs || [];
  const hasRuns = runs.length > 0;
  const isActive = a.status === 'active';
  const edited = a.updatedAt && a.updatedAt !== a.createdAt;

  const duplicate = async () => {
    setDuplicating(true);
    const copy = await duplicateAutomation(a.id);
    setDuplicating(false);
    if (copy) openAutomationBuilder(copy.id);
  };

  const runButton = (
    <Button leadingIcon="solar:bolt-linear" disabled={!isActive} onClick={() => onRun(a)}>Run</Button>
  );

  return (
    <PreviewModal
      title={a.name}
      meta={(
        <>
          <span>Created by {a.createdBy || 'Unknown'}</span>
          {edited && <span>• Last edited {fmtDate(a.updatedAt)} by {a.updatedBy || a.createdBy || 'Unknown'}</span>}
          {a.status !== 'active' && (
            <Tooltip label={a.status === 'draft' ? 'Not published yet' : 'Turned off: it will not run until you turn it on'}>
              <Icon name="solar:info-circle-linear" size={14} color="var(--neutral-200)" />
            </Tooltip>
          )}
        </>
      )}
      description={a.description}
      actions={(
        <>
          <Button variant="outline" onClick={() => openAutomationBuilder(a.id)}>Edit</Button>
          <Tooltip label={hasRuns ? '' : 'Analytics appear after the first run'}>
            <Button variant="outline" disabled={!hasRuns} onClick={() => openAutomationAnalytics(a.id)}>Analytics</Button>
          </Tooltip>
          <Button variant="outline" disabled={duplicating} onClick={duplicate}>Duplicate</Button>
          {isActive ? runButton : (
            <Tooltip label={a.status === 'draft' ? 'Publish the automation to run it' : 'Turn the automation on to run it'}>
              {runButton}
            </Tooltip>
          )}
        </>
      )}
      stats={<AutomationStatsRow automation={a} runs={runs} members={activity?.members || []} />}
      graph={a.draftGraph || a.graph}
      onClose={onClose}
    />
  );
}
