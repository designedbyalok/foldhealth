import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../../../../../store/useAppStore';
import { DashboardCardSkeleton } from '../../../../../../components/DashboardCard/DashboardCard';
import { ScheduleDrawer } from '../../../../../../components/ScheduleDrawer/ScheduleDrawer';
import { AddTaskDrawer } from '../../../../../tasks/AddTaskDrawer';
import { NonVisitNoteDrawer } from '../../notes/PatientNotesTab/NonVisitNoteDrawer';
import { OverviewCustomizeDrawer } from '../OverviewCustomizeDrawer/OverviewCustomizeDrawer';
import { SynopsisCard } from '../cards/SynopsisCard';
import { HealthChartCard } from '../cards/HealthChartCard';
import { HighlightsCard } from '../cards/HighlightsCard';
import { SuggestedActionsCard } from '../cards/SuggestedActionsCard';
import { CarePlanCard } from '../cards/CarePlanCard';
import { CareProgramsCard } from '../cards/CareProgramsCard';
import { GapsCard } from '../cards/GapsCard';
import { RecentNotesCard } from '../cards/RecentNotesCard';
import { QuickActionsCard } from '../cards/QuickActionsCard';
import { AppointmentsCard } from '../cards/AppointmentsCard';
import { TasksCard } from '../cards/TasksCard';
import { RemindersCard } from '../cards/RemindersCard';
import { VitalsCard } from '../cards/VitalsCard';
import {
  CaregiversCard, CareTeamCard, ConditionsCard, ContactCard, MedicationsCard,
} from '../cards/ProfileCards';
import { ProgramProgressCard, SinceLastTouchCard } from '../cards/MonitoringCards';
import { AwaitingReplyCard } from '../cards/AwaitingReplyCard';
import { SummaryWidgetCard } from '../cards/SummaryWidgetCard';
import { RecapButton } from '../attention/RecapDialog';
import { useAttentionSignals } from '../attention/useAttentionSignals';
import { signalsByWidget } from '../attention/widgetInsights';
import { OverviewInsightsContext, OverviewWidgetKeyContext } from '../attention/OverviewInsightsContext';
import {
  OVERVIEW_COLUMN_TEMPLATE, OVERVIEW_LAYOUT_REVISION, OVERVIEW_WIDGETS, normalizeOverviewLayout, overviewColumnCount, overviewColumns,
} from './overviewLayout';
import styles from './OverviewTab.module.css';

const AddMedicationsDrawer = lazy(() => import('../../../../left-panel/tabs/pami-hx/AddMedicationsDrawer/AddMedicationsDrawer').then(m => ({ default: m.AddMedicationsDrawer })));

// Per-user arrangement, saved with the other panel layouts (user_panel_layouts).
const LAYOUT_KEY = 'patientOverviewLayout';

// The left panel Summary tab's widgets, reused in a card frame.
const SUMMARY_WIDGETS = new Set(OVERVIEW_WIDGETS.filter(w => w.sample).map(w => w.key));

// Cards fed by the patient_overview row show their real header while it loads.
const OVERVIEW_SKELETONS = {
  synopsis: ['custom:ai', 'Patient Synopsis'],
  healthChart: ['solar:radar-2-linear', 'Health Chart'],
  highlights: ['solar:lightbulb-minimalistic-linear', 'Highlights'],
  suggestedActions: ['custom:ai', 'Suggested Actions'],
  gaps: ['solar:danger-triangle-linear', 'Gaps'],
  vitals: ['solar:heart-pulse-linear', 'Vitals'],
};

// Marks a lane's scroll edges (data-at-top / data-at-end) so CSS can fade
// only the edge where content continues. Re-checks on scroll and whenever a
// card in the lane changes size (data landing, a strip opening). Used as a
// ref callback; React 19 runs the returned cleanup on unmount.
function trackScrollEdges(el) {
  if (!el) return undefined;
  const mark = () => {
    el.dataset.atTop = String(el.scrollTop <= 1);
    el.dataset.atEnd = String(el.scrollTop + el.clientHeight >= el.scrollHeight - 1);
  };
  mark();
  el.addEventListener('scroll', mark, { passive: true });
  const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(mark);
  if (ro) { ro.observe(el); [...el.children].forEach(c => ro.observe(c)); }
  return () => { el.removeEventListener('scroll', mark); ro?.disconnect(); };
}

function useElementWidth(ref) {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

// `customizing` / `onCustomizeClose`: the Customize drawer is opened from the
// profile tab bar (PatientDetailView), not from inside the tab.
export function OverviewTab({ patient, leftPanelOpen = true, customizing = false, onCustomizeClose }) {
  const gridRef = useRef(null);
  const width = useElementWidth(gridRef);
  const columnCount = width ? overviewColumnCount(width, { leftPanelOpen }) : 1;

  const memberId = patient?.memberId ? String(patient.memberId) : null;
  const overview = useAppStore(s => (memberId ? s.patientOverview[memberId] : undefined));
  const fetchPatientOverview = useAppStore(s => s.fetchPatientOverview);
  const setPatientProfileTab = useAppStore(s => s.setPatientProfileTab);
  const setCareManagementTab = useAppStore(s => s.setCareManagementTab);
  const savedLayout = useAppStore(s => s.panelLayouts[LAYOUT_KEY]);
  const fetchPanelLayouts = useAppStore(s => s.fetchPanelLayouts);
  const savePanelLayout = useAppStore(s => s.savePanelLayout);
  const goToComms = useAppStore(s => s.goToComms);
  const setPatientSignalReviewed = useAppStore(s => s.setPatientSignalReviewed);
  const layout = useMemo(() => normalizeOverviewLayout(savedLayout), [savedLayout]);

  useEffect(() => { if (memberId) fetchPatientOverview(memberId); }, [memberId, fetchPatientOverview]);
  useEffect(() => { fetchPanelLayouts(); }, [fetchPanelLayouts]);

  // One open drawer at a time; `onSaved` lets a suggested action mark itself
  // accepted once the appointment is actually booked.
  const [drawer, setDrawer] = useState(null);
  const closeDrawer = useCallback(() => setDrawer(null), []);
  const actions = useMemo(() => ({
    addNote: () => setDrawer({ kind: 'note' }),
    addTask: () => setDrawer({ kind: 'task' }),
    schedule: (opts = {}) => setDrawer({ kind: 'schedule', onSaved: opts.onSaved }),
    openCarePlan: () => {
      setPatientProfileTab('Care Management');
      setCareManagementTab('Comprehensive Care Plan');
    },
  }), [setPatientProfileTab, setCareManagementTab]);

  // What changed and what is still open: shown on each widget it belongs to
  // (CardInsights) and walked through from the Recap pill.
  const attention = useAttentionSignals(patient, overview);
  const attentionMemberId = attention.memberId;
  const runSignal = useCallback((s) => {
    switch (s.action?.key) {
      case 'schedule': actions.schedule(); break;
      case 'addTask': actions.addTask(); break;
      case 'reviewMeds': setDrawer({ kind: 'meds' }); break;
      case 'openTasks': setPatientProfileTab('Tasks'); break;
      case 'reply': goToComms({ channel: s.conversation?.channel, conversationId: s.conversation?.id }); break;
      default: break;
    }
  }, [actions, setPatientProfileTab, goToComms]);
  const reviewSignal = useCallback(
    (s, reviewed) => setPatientSignalReviewed(attentionMemberId, s.id, reviewed),
    [setPatientSignalReviewed, attentionMemberId],
  );
  const insights = useMemo(() => ({
    byWidget: signalsByWidget(attention.open),
    run: runSignal,
    review: reviewSignal,
  }), [attention.open, runSignal, reviewSignal]);

  if (!patient) return null;

  const overviewLoading = overview === undefined;
  const recap = (
    <RecapButton
      patient={patient}
      overview={overview}
      attention={attention}
      run={runSignal}
      review={reviewSignal}
      onOpenTimeline={() => setPatientProfileTab('Timeline')}
    />
  );
  // The Recap lives in the Synopsis header; with Synopsis hidden it keeps a row of its own.
  const synopsisShown = !layout.hidden.includes('synopsis');
  const card = (key) => {
    if (overviewLoading && OVERVIEW_SKELETONS[key]) {
      const [icon, title] = OVERVIEW_SKELETONS[key];
      return <DashboardCardSkeleton key={key} icon={icon} title={title} />;
    }
    if (SUMMARY_WIDGETS.has(key)) return <SummaryWidgetCard key={key} widget={key} />;
    switch (key) {
      case 'synopsis': return <SynopsisCard key={key} overview={overview} action={recap} />;
      case 'healthChart': return <HealthChartCard key={key} overview={overview} />;
      case 'highlights': return <HighlightsCard key={key} patient={patient} patientId={patient.id} overview={overview} />;
      case 'suggestedActions': return <SuggestedActionsCard key={key} memberId={memberId} patientId={patient.id} overview={overview} actions={actions} />;
      case 'carePlan': return <CarePlanCard key={key} patientId={patient.id} actions={actions} />;
      case 'carePrograms': return <CareProgramsCard key={key} patientId={patient.id} />;
      case 'gaps': return <GapsCard key={key} patient={patient} overview={overview} actions={actions} />;
      case 'notes': return <RecentNotesCard key={key} patientId={patient.id} actions={actions} />;
      case 'quickActions': return <QuickActionsCard key={key} overview={overview} actions={actions} />;
      case 'appointments': return <AppointmentsCard key={key} patientId={patient.id} patient={patient} />;
      case 'tasks': return <TasksCard key={key} patient={patient} actions={actions} />;
      case 'reminders': return <RemindersCard key={key} patient={patient} />;
      case 'awaitingReply': return <AwaitingReplyCard key={key} patient={patient} />;
      case 'vitals': return <VitalsCard key={key} memberId={memberId} patientId={patient.id} overview={overview} />;
      case 'contact': return <ContactCard key={key} patientId={patient.id} />;
      case 'careTeam': return <CareTeamCard key={key} patientId={patient.id} />;
      case 'caregivers': return <CaregiversCard key={key} patientId={patient.id} />;
      case 'medications': return <MedicationsCard key={key} patientId={patient.id} />;
      case 'conditions': return <ConditionsCard key={key} patientId={patient.id} patient={patient} />;
      case 'sinceLastTouch': return <SinceLastTouchCard key={key} memberId={memberId} />;
      case 'programProgress': return <ProgramProgressCard key={key} memberId={memberId} patientId={patient.id} />;
      default: return null;
    }
  };

  const columns = overviewColumns(layout, columnCount);

  return (
    <OverviewInsightsContext.Provider value={insights}>
    <div className={styles.overview}>
      {!synopsisShown && <div className={styles.toolbar}>{recap}</div>}
      <div ref={gridRef} className={styles.grid} style={{ gridTemplateColumns: OVERVIEW_COLUMN_TEMPLATE[columnCount] }}>
        {columns.map((column, i) => (
          // Each column scrolls on its own, so a long middle column never
          // drags the narrow ones out of view.
          <div key={i} ref={trackScrollEdges} className={styles.column}>
            {column.map(key => (
              <OverviewWidgetKeyContext.Provider key={key} value={key}>{card(key)}</OverviewWidgetKeyContext.Provider>
            ))}
          </div>
        ))}
      </div>

      {customizing && (
        <OverviewCustomizeDrawer
          layout={layout}
          onSave={next => savePanelLayout(LAYOUT_KEY, { ...next, revision: OVERVIEW_LAYOUT_REVISION })}
          onClose={() => onCustomizeClose?.()}
        />
      )}
      {drawer?.kind === 'note' && <NonVisitNoteDrawer patient={patient} onClose={closeDrawer} />}
      {drawer?.kind === 'meds' && (
        <Suspense fallback={null}>
          <AddMedicationsDrawer patientId={patient.id} onClose={closeDrawer} />
        </Suspense>
      )}
      {drawer?.kind === 'task' && (
        <AddTaskDrawer initialMember={patient.name} onClose={closeDrawer} onTaskCreated={closeDrawer} />
      )}
      {drawer?.kind === 'schedule' && (
        <ScheduleDrawer
          initialPatientId={patient.id}
          source="patient_overview"
          onClose={closeDrawer}
          onSave={(row) => { if (row) drawer.onSaved?.(); }}
        />
      )}
    </div>
    </OverviewInsightsContext.Provider>
  );
}
