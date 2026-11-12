import { Suspense, lazy } from 'react';
import { Spinner } from '../../components/Spinner/Spinner';
import { Tabs } from '../../components/Tabs/Tabs';
import { useLiveCall } from './useLiveCall';
import { LiveTranscript } from './LiveTranscript';
import styles from './LiveCallOverlay.module.css';

// The chart views load only when their tab opens, so the expand morph never
// waits on them.
const CallCarePlanTab = lazy(() => import('./CallCarePlanTab').then(m => ({ default: m.CallCarePlanTab })));
const CallStepsTab = lazy(() => import('./CallStepsTab').then(m => ({ default: m.CallStepsTab })));
const CallTasksTab = lazy(() => import('./CallTasksTab').then(m => ({ default: m.CallTasksTab })));

/** Main area of the call: live transcript, and the chart views a care manager works in during a call. */
export function CallWorkspace({ script, cmName, patient }) {
  const tab = useLiveCall(s => s.tab);
  const setTab = useLiveCall(s => s.setTab);
  const stepsMarked = useLiveCall(s => Object.keys(s.stepsThisCall).length);
  const items = [
    { key: 'transcript', label: 'Live Transcript' },
    { key: 'plan', label: 'Care Plan' },
    { key: 'steps', label: 'Program Steps', ...(stepsMarked ? { count: stepsMarked } : {}) },
    { key: 'tasks', label: 'Patient Tasks' },
  ];

  return (
    <main className={styles.panel}>
      <div className={styles.workspaceHead}>
        <Tabs items={items} value={tab} onValueChange={setTab} embedded fullWidth={false} aria-label="Call workspace" />
      </div>
      {tab === 'transcript' ? (
        <LiveTranscript script={script} cmName={cmName} />
      ) : (
        <div className={styles.tabBody}>
          <Suspense fallback={<div className={styles.loading}><Spinner size={20} label="Loading" /></div>}>
            {tab === 'plan' && <CallCarePlanTab patient={patient} />}
            {tab === 'steps' && <CallStepsTab patient={patient} />}
            {tab === 'tasks' && <CallTasksTab patient={patient} />}
          </Suspense>
        </div>
      )}
    </main>
  );
}
