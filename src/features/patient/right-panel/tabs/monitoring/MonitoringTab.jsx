import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../../../../store/useAppStore';
import { Badge } from '../../../../../components/Badge/Badge';
import { Button } from '../../../../../components/Button/Button';
import { Icon } from '../../../../../components/Icon/Icon';
import { DownChevronIcon } from '../../../../../components/Icon/DownChevronIcon';
import { Link } from '../../../../../components/Link/Link';
import { Toggle } from '../../../../../components/Toggle/Toggle';
import { Alert } from '../../../../../components/Alert/Alert';
import { toast } from '../../../../../components/Toast/sonnerToast';
import { TasksTab } from '../../../left-panel/tabs/tasks/TasksTab/TasksTab';
import { groupTasksForTab } from '../../../left-panel/tabs/tasks/TasksTab/groupTasksForTab';
import { TaskDetailDrawer } from '../../../../tasks/TaskDetailDrawer';
import { ensureMonitoringTasksForPatient, monitoringTasksToTabData } from './monitoringData';
import { MonitoringRailGoals } from './MonitoringRailGoals';
import styles from './MonitoringTab.module.css';

const STORY_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'clinical', label: 'Clinical' },
  { key: 'outreach', label: 'Outreach' },
  { key: 'agent', label: 'Agent' },
  { key: 'plan', label: 'Plan Changes' },
  { key: 'billing', label: 'Billing' },
];

const STORY_CATEGORY = {
  clinical: { label: 'Clinical', tone: 'info', icon: 'solar:heart-pulse-linear', iconTone: 'info' },
  outreach: { label: 'Outreach', tone: 'secondary', icon: 'solar:letter-linear', iconTone: 'secondary' },
  agent: { label: 'Agent', tone: 'primary', icon: 'solar:phone-calling-linear', iconTone: 'primary' },
  plan: { label: 'Plan', tone: 'warning', icon: 'solar:clipboard-list-linear', iconTone: 'warning' },
  billing: { label: 'Billing', tone: 'grey', icon: 'solar:dollar-minimalistic-linear', iconTone: 'grey' },
};

const STORY_ICON_TONE = {
  primary: { bg: 'var(--primary-50)', border: 'color-mix(in srgb, var(--primary-300) 20%, transparent)', color: 'var(--primary-300)' },
  info: { bg: 'var(--status-info-light)', border: 'color-mix(in srgb, var(--status-info) 20%, transparent)', color: 'var(--status-info)' },
  secondary: { bg: 'var(--secondary-50)', border: 'color-mix(in srgb, var(--secondary-300) 20%, transparent)', color: 'var(--secondary-300)' },
  warning: { bg: 'var(--status-warning-light)', border: 'color-mix(in srgb, var(--status-warning) 20%, transparent)', color: 'var(--status-warning)' },
  error: { bg: 'var(--status-error-light)', border: 'color-mix(in srgb, var(--status-error) 20%, transparent)', color: 'var(--status-error)' },
  grey: { bg: 'var(--neutral-50)', border: 'var(--neutral-150)', color: 'var(--neutral-300)' },
};

const DEFAULT_RAIL_WIDTH = 480;
const MIN_RAIL_WIDTH = 280;
const MIN_MAIN_COL_WIDTH = 400;

function adherenceBand(score) {
  if (score == null) return 'unknown';
  if (score >= 80) return 'good';
  if (score >= 60) return 'watch';
  return 'risk';
}

function StepDot({ status }) {
  if (status === 'done') {
    return (
      <span className={styles.dotDone}>
        <Icon name="solar:check-read-linear" size={10} />
      </span>
    );
  }
  return (
    <span className={[styles.dot, status === 'current' ? styles.dotCurrent : styles.dotUpcoming].join(' ')} />
  );
}

function ProgramCard({ program, defaultExpanded, onAction }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const hasSteps = program.steps?.length > 0;

  return (
    <div className={styles.program}>
      <button
        type="button"
        className={styles.programHead}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <Badge tone="info" size="S" label={program.code} />
        <span className={styles.programName}>{program.name}</span>
        <span className={styles.programProgress}>{program.progress}</span>
        <span className={styles.programNext}>
          <Icon name="solar:calendar-linear" size={13} />
          {program.next}
        </span>
        <DownChevronIcon
          size={16}
          className={[styles.programChevron, expanded ? styles.programChevronOpen : ''].filter(Boolean).join(' ')}
        />
      </button>
      {expanded && hasSteps && (
        <div className={styles.steps}>
          {program.steps.map((s, i) => (
            <div key={i} className={[styles.step, styles[`step_${s.status}`]].filter(Boolean).join(' ')}>
              <StepDot status={s.status} />
              <div className={styles.stepBody}>
                <span className={styles.stepLabel}>{s.label}</span>
                {s.sub && <span className={styles.stepSub}>{s.sub}</span>}
              </div>
              {s.meta && <span className={styles.stepMeta}>{s.meta}</span>}
              {s.action && (
                <Button variant="secondary" size="S" onClick={() => onAction(s.action)}>
                  <Icon name={s.action === 'Schedule' ? 'solar:calendar-linear' : 'solar:pen-2-linear'} size={13} />
                  {s.action}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function MonitoringTab({ patient }) {
  const memberId = patient?.memberId ? String(patient.memberId) : null;
  const data = useAppStore((s) => (memberId ? s.patientMonitoring[memberId] : undefined));
  const loading = useAppStore((s) => (memberId ? s.patientMonitoringLoading[memberId] : false));
  const fetchPatientMonitoring = useAppStore((s) => s.fetchPatientMonitoring);
  const setPatientProfileTab = useAppStore((s) => s.setPatientProfileTab);
  const setCareManagementTab = useAppStore((s) => s.setCareManagementTab);
  const allTasks = useAppStore((s) => s.tasks);
  const createTask = useAppStore((s) => s.createTask);
  const fetchTasks = useAppStore((s) => s.fetchTasks);
  const [railWidth, setRailWidth] = useState(DEFAULT_RAIL_WIDTH);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const bodyRowRef = useRef(null);

  const memberTasks = useMemo(() => {
    if (!patient) return [];
    const memberKey = patient.memberId ? String(patient.memberId) : null;
    return (allTasks || []).filter(
      (t) => (memberKey && String(t.patient_id) === memberKey)
        || (patient.id && String(t.patient_id) === String(patient.id))
        || (patient.name && t.member === patient.name)
        || (memberKey && t.source_key?.startsWith(`monitoring-${memberKey}-`)),
    );
  }, [allTasks, patient]);

  const tasksTabData = useMemo(() => {
    if (memberTasks.length > 0) return groupTasksForTab(memberTasks);
    return monitoringTasksToTabData(data?.tasks);
  }, [memberTasks, data?.tasks]);

  const liveSelectedTask = selectedTaskId
    ? (allTasks || []).find((t) => t.id === selectedTaskId) || null
    : null;

  useEffect(() => { if (memberId) fetchPatientMonitoring(memberId); }, [memberId, fetchPatientMonitoring]);
  useEffect(() => { fetchTasks?.(); }, [fetchTasks]);
  useEffect(() => {
    if (!patient?.id || !data?.tasks?.length) return;
    ensureMonitoringTasksForPatient(patient, data.tasks, {
      getState: useAppStore.getState,
      createTask,
    });
  }, [patient, data?.tasks, createTask]);

  const startRailResize = useCallback((e) => {
    e.preventDefault();
    const row = bodyRowRef.current;
    if (!row) return;

    const handle = e.currentTarget;
    const { pointerId } = e;
    try { handle.setPointerCapture(pointerId); } catch { /* ignore */ }

    const rowRect = row.getBoundingClientRect();
    const onMove = (moveEvt) => {
      if (moveEvt.pointerId !== pointerId) return;
      const rawWidth = rowRect.right - moveEvt.clientX;
      const maxWidth = rowRect.width - MIN_MAIN_COL_WIDTH;
      setRailWidth(Math.max(MIN_RAIL_WIDTH, Math.min(rawWidth, maxWidth)));
    };
    const onUp = (upEvt) => {
      if (upEvt.pointerId !== pointerId) return;
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
      try { handle.releasePointerCapture(pointerId); } catch { /* ignore */ }
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  }, []);

  const soon = (what) => toast(`${what} opens in Touch Mode. Coming soon.`);

  const openComprehensiveCarePlan = useCallback(() => {
    setPatientProfileTab('Care Management');
    setCareManagementTab('Comprehensive Care Plan');
  }, [setPatientProfileTab, setCareManagementTab]);

  if (data === undefined && loading) {
    return <div className={styles.state}>Loading monitoring…</div>;
  }
  if (!data) {
    return (
      <div className={styles.state}>
        <Icon name="solar:pulse-linear" size={32} color="var(--neutral-200)" />
        <p className={styles.stateTitle}>No Active Monitoring Episode</p>
        <p className={styles.stateBody}>This patient has no open transition, escalation, or threshold-risk right now.</p>
      </div>
    );
  }

  const band = adherenceBand(data.adherence);

  return (
    <div className={styles.root}>
      <div className={styles.bodyRow} ref={bodyRowRef}>
        <div className={styles.mainCol}>
          {data.bannerText && (
            <div className={styles.alertSlot}>
              <Alert tone="error" message={data.bannerText} meta={data.bannerDue} className={styles.bannerAlert} />
            </div>
          )}

          <div className={styles.mainScroll}>
            <div className={styles.section}>
              <SectionLabel>Snapshot</SectionLabel>
              <div className={styles.tiles}>
                <Tile label="Days Since Discharge" value={data.daysSinceDischarge} sub={data.dischargeLabel} />
                <Tile label="Risk" value={data.riskTier} valueTone="error" sub={`RAF ${data.riskRaf}`} />
                <Tile label="Program Minutes" value={`${data.programMinutes} / ${data.programMinutesThreshold}`} sub={data.thresholdLabel} />
                <Tile label="Open Tasks" value={data.openTasks} sub="Overdue risk · 4h left" subTone="error" />
                {data.adherence != null && (
                  <Tile
                    label="Adherence"
                    value={data.adherence}
                    sub={band === 'good' ? 'On track' : band === 'watch' ? 'Slipping' : 'Off plan'}
                    subTone={band === 'risk' ? 'error' : undefined}
                    leading={<span className={[styles.adhDot, styles[`adh_${band}`]].join(' ')} />}
                  />
                )}
              </div>
            </div>

            <div className={styles.section}>
              <SectionLabel>Programs</SectionLabel>
              <div className={styles.programs}>
                {data.programs.map((p, i) => (
                  <ProgramCard key={p.code} program={p} defaultExpanded={i === 0} onAction={soon} />
                ))}
              </div>
            </div>

            {data.timeline.length > 0 && (
              <div className={styles.section}>
                <div className={styles.timeline}>
                  <div className={styles.timelineHead}>
                    <Icon name="solar:magic-stick-3-linear" size={13} />
                    Since You Last Spoke · last touch 12 days ago
                  </div>
                  {data.timeline.map((t, i) => (
                    <div key={i} className={styles.timelineItem}>
                      <span className={styles.timelineText}>{t.text}</span>
                      {t.source && <span className={styles.timelineSource}>{t.source}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.story?.length > 0 && <StorySection events={data.story} />}
          </div>
        </div>

        <div
          className={styles.resizeHandle}
          onPointerDown={startRailResize}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
        />

        <aside className={styles.rail} style={{ width: railWidth }}>
          <Button variant="primary" onClick={() => soon('Start touch')}>
            <Icon name="solar:phone-calling-linear" size={14} />
            Start touch
          </Button>
          <Button variant="secondary" onClick={openComprehensiveCarePlan}>
            <Icon name="solar:clipboard-list-linear" size={14} />
            Open care plan
          </Button>
          <Link className={styles.railLink} onClick={() => soon('EHR summary')}>
            <Icon name="solar:document-add-linear" size={14} />
            Build EHR summary
          </Link>

          <div className={styles.railGroup}>
            <div className={styles.railGroupLabel}>Open Tasks</div>
            <TasksTab
              hideToolbar
              interactive
              compact
              className={styles.railTasks}
              data={tasksTabData}
              onTaskClick={(task) => { if (task?.id) setSelectedTaskId(task.id); }}
            />
          </div>

          <MonitoringRailGoals patient={patient} />

          <RailGroup label="Care Gaps">
            {data.gaps.map((g, i) => (
              <div key={i} className={styles.railGapRow}>
                <Icon name="solar:checklist-minimalistic-linear" size={14} />
                <span className={styles.railCardTitle}>{g.label}</span>
                <span className={styles.railGapMeta}>{g.meta}</span>
              </div>
            ))}
          </RailGroup>
        </aside>
      </div>
      {liveSelectedTask && (
        <TaskDetailDrawer
          task={liveSelectedTask}
          onClose={() => setSelectedTaskId(null)}
          onSelectTask={(t) => setSelectedTaskId(t?.id ?? null)}
        />
      )}
    </div>
  );
}

function SectionLabel({ children }) {
  return <div className={styles.sectionLabel}>{children}</div>;
}

function Tile({ label, value, sub, valueTone, subTone, leading }) {
  return (
    <div className={styles.tile}>
      <span className={styles.tileLabel}>{label}</span>
      <div className={styles.tileValueRow}>
        {leading}
        <span className={[styles.tileValue, valueTone === 'error' ? styles.tileValueBad : ''].filter(Boolean).join(' ')}>{value}</span>
      </div>
      {sub && <span className={[styles.tileSub, subTone === 'error' ? styles.tileSubBad : ''].filter(Boolean).join(' ')}>{sub}</span>}
    </div>
  );
}

function RailGroup({ label, children }) {
  return (
    <div className={styles.railGroup}>
      <div className={styles.railGroupLabel}>{label}</div>
      {children}
    </div>
  );
}

function RailCard({ children, subTone }) {
  return (
    <div className={[styles.railCard, styles.railCardStack, subTone === 'error' ? styles.railSubError : ''].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}

function storyIconStyle(event) {
  const toneKey = event.iconTone || STORY_CATEGORY[event.category]?.iconTone || 'grey';
  return STORY_ICON_TONE[toneKey] || STORY_ICON_TONE.grey;
}

function StorySection({ events }) {
  const [filter, setFilter] = useState('all');
  const [collapsed, setCollapsed] = useState({});

  const visible = useMemo(
    () => (filter === 'all' ? events : events.filter((e) => e.category === filter)),
    [events, filter],
  );

  return (
    <div className={styles.story}>
      <div className={styles.storyHead}>
        <SectionLabel>Story</SectionLabel>
        <Toggle
          className={styles.storyFilters}
          size="S"
          items={STORY_FILTERS}
          active={filter}
          onChange={setFilter}
        />
      </div>

      {visible.length === 0 ? (
        <p className={styles.storyEmpty}>No story events in this category.</p>
      ) : (
        <div className={styles.storyList}>
          {visible.map((event, rowIndex) => {
            const cat = STORY_CATEGORY[event.category] || STORY_CATEGORY.clinical;
            const iconCfg = storyIconStyle(event);
            const iconName = event.icon || cat.icon;
            const rowKey = `${event.at}-${event.title}`;
            const isCollapsed = collapsed[rowKey] === true;

            return (
              <div key={rowKey} className={styles.storyRow}>
                <time className={styles.storyTime}>{event.at}</time>
                <div className={styles.storySpineCol}>
                  <span className={rowIndex === 0 ? styles.storySpineStart : styles.storySpineLine} />
                  <span
                    className={styles.storyIcon}
                    style={{ background: iconCfg.bg, borderColor: iconCfg.border, color: iconCfg.color }}
                  >
                    <Icon name={iconName} size={14} />
                  </span>
                  <span className={rowIndex === visible.length - 1 ? styles.storySpineEnd : styles.storySpineLineGrow} />
                </div>
                <div className={styles.storyCard}>
                  <div className={styles.storyCardHead}>
                    <span className={styles.storyCardTitle}>{event.title}</span>
                    <Badge tone={cat.tone} size="S" label={cat.label} />
                    <button
                      type="button"
                      className={styles.storyToggle}
                      aria-expanded={!isCollapsed}
                      aria-label={isCollapsed ? 'Expand story event' : 'Collapse story event'}
                      onClick={() => setCollapsed((prev) => ({ ...prev, [rowKey]: !prev[rowKey] }))}
                    >
                      <DownChevronIcon
                        size={14}
                        className={isCollapsed ? styles.storyChevronCollapsed : styles.storyChevron}
                      />
                    </button>
                  </div>
                  {!isCollapsed && event.body && (
                    <p className={styles.storyCardBody}>{event.body}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
