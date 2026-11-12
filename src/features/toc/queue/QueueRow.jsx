import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../../components/Icon/Icon';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { PatientAvatarHover } from '../../../components/PatientHoverCard/PatientAvatarHover';
import { AssigneeChange } from '../../../components/AssigneeChange/AssigneeChange';
import { platformUsersForAssigneePicker } from '../../../lib/worklistAssignee';
import { Badge } from '../../../components/Badge/Badge';
import { laceTone } from '../../../lib/riskTone';
import { Checkbox } from '../../../components/Checkbox/Checkbox';
import { useAppStore } from '../../../store/useAppStore';
import { FoldIdTag } from '../../../components/FoldIdTag/FoldIdTag';
import { Tooltip } from '../../../components/Tooltip/Tooltip';
import { Phq9AssessmentDrawer } from './Phq9AssessmentDrawer/Phq9AssessmentDrawer';
import { LiveCallDuration } from '../worklist/LiveCallDuration';
import { useCallDuration } from '../worklist/useCallDuration';
import rowStyles from '../worklist/WorklistRow.module.css';
import { CoveringNote } from '../../ooo/CoveringNote';
import styles from './QueueRow.module.css';

const LANG_MAP = { en: 'English', es: 'Spanish', zh: 'Chinese', yue: 'Cantonese', ko: 'Korean', vi: 'Vietnamese', hi: 'Hindi', pa: 'Punjabi' };

function computeAgentDueOn(dischargeDate, outreachType) {
  if (!dischargeDate) return null;
  const [m, d, y] = dischargeDate.split('/').map(Number);
  if (!m || !d || !y) return null;
  const base = new Date(y, m - 1, d);
  const offsetMs = outreachType === '7d' ? 7 * 24 * 60 * 60 * 1000 : 48 * 60 * 60 * 1000;
  const due = new Date(base.getTime() + offsetMs);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(due.getMonth() + 1)}/${pad(due.getDate())}/${due.getFullYear()}`;
}

const TOC_STATUS_MAP = {
  enrolled: { variant: 'success', label: 'Enrolled', icon: 'solar:check-circle-linear' },
  engaged: { variant: 'info', label: 'Engaged', icon: 'solar:link-round-linear' },
  attempted: { variant: 'warning', label: 'Attempted', icon: 'solar:history-linear' },
  new: { variant: 'neutral', label: 'New', icon: 'solar:star-linear' },
  oncall: { variant: 'primary', label: 'On Call', icon: 'solar:phone-calling-linear' },
};

function TocStatusBadge({ status }) {
  const cfg = TOC_STATUS_MAP[status] || TOC_STATUS_MAP.new;
  return <Badge size="md" tone={cfg.variant} label={cfg.label} icon={cfg.icon} />;
}

function GoalsTooltipPortal({ goalsDetail, pillRef, visible }) {
  if (!visible || !goalsDetail || !pillRef.current) return null;
  const rect = pillRef.current.getBoundingClientRect();
  const tooltipW = 320;
  let left = rect.left;
  if (left + tooltipW > window.innerWidth - 16) left = window.innerWidth - tooltipW - 16;
  if (left < 16) left = 16;
  return createPortal(
    <div className={styles.goalsTooltipFixed} style={{ top: rect.bottom + 6, left }}>
      <div className={styles.goalsTooltipHeader}>Goals Tracking</div>
      {goalsDetail.map((g, i) => (
        <div key={i} className={styles.goalRow}>
          <Icon name={g.pass ? "solar:check-circle-bold" : "solar:close-circle-bold"} size={14} color={g.pass ? "#059669" : "#DC2626"} />
          <span className={styles.goalRowLabel}>{g.name}</span>
          <span className={`${styles.goalBadge} ${g.pass ? styles.goalPass : styles.goalFail}`}>{g.pass ? 'Pass' : 'Fail'}</span>
        </div>
      ))}
    </div>,
    document.body
  );
}

function StatusCell({ patient: p, voicemailCalls, completedCall }) {
  const { status, goals, scheduledTime } = p;
  const callDuration = useCallDuration(p);
  const goalsDetail = p.goalsDetail || completedCall?.goalsDetail || [];
  const [goalsHover, setGoalsHover] = useState(false);
  const goalsPillRef = useRef(null);
  // Use voicemail call records for attempt history, fallback to patient.attempts
  const attempts = voicemailCalls?.length > 0
    ? voicemailCalls.map((c, i) => ({ time: c.startedAt, outcome: c.outcome }))
    : (p.attempts || []);
  if (status === 'completed') {
    const pct = goals ? Math.round((goals.met / goals.total) * 100) : 0;
    return (
      <div className={styles.statusCompact}>
        <Badge size="md" tone="success" label="Completed" icon="solar:check-circle-linear" />
        {goals && (
          <div
            className={styles.goalsPill}
            ref={goalsPillRef}
            onMouseEnter={() => setGoalsHover(true)}
            onMouseLeave={() => setGoalsHover(false)}
          >
            <div className={styles.goalsFill}>
              <div className={styles.goalsFillInner} style={{ width: `${pct}%` }} />
            </div>
            <span className={styles.goalsText}>{goals.met}/{goals.total}</span>
            <GoalsTooltipPortal goalsDetail={goalsDetail} pillRef={goalsPillRef} visible={goalsHover} />
          </div>
        )}
      </div>
    );
  }
  if (status === 'oncall') {
    const liveGoals = p.liveGoals || [];
    const done = liveGoals.filter(g => g.done).length;
    const total = liveGoals.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return (
      <div className={styles.statusCompact}>
        <Badge size="md"
          tone="success"
          label={callDuration || '00:00'}
          icon="solar:phone-calling-linear"
          dot={false}
        />
        {total > 0 && (
          <div className={styles.liveGoalsMini}>
            <div className={styles.goalsFill}>
              <div className={styles.goalsFillInner} style={{ width: `${pct}%`, background: 'var(--status-success)' }} />
            </div>
            <span className={styles.goalsText}>{done}/{total} goals</span>
          </div>
        )}
      </div>
    );
  }
  if (status === 'scheduled') {
    return (
      <div className={styles.statusCompact}>
        <Badge size="md" tone="info" label="Scheduled" icon="solar:calendar-linear" />
        {scheduledTime && <div className={styles.scheduledSub}>{scheduledTime.split(' ')[0]}</div>}
      </div>
    );
  }
  if (status === 'queued') {
    return (
      <div className={styles.statusCompact}>
        <Badge size="md" tone="warning" label="Queued" icon="solar:clock-circle-linear" />
      </div>
    );
  }
  if (status === 'failed') {
    return (
      <div className={styles.statusCompact}>
        <Badge size="md" tone="danger" label="Failed" icon="solar:close-circle-linear" />
        {attempts?.length > 0 && (
          <div className={styles.attemptsWrapper}>
            <Tooltip
              variant="light"
              placement="bottom"
              maxWidth={400}
              label={(
                <div className={styles.attemptsTooltip}>
                  <div className={styles.attemptsTooltipHeader}>Attempt History</div>
                  {attempts.map((a, i) => (
                    <div key={i} className={styles.attemptRow}>
                      <Icon name="solar:phone-calling-bold" size={16} color="var(--status-error)" />
                      <div className={styles.attemptDetail}>
                        <div className={styles.attemptOutcome}>{a.outcome}</div>
                        <div className={styles.attemptTime}>{a.time}</div>
                      </div>
                      <span className={styles.attemptNumBadge}>#{i + 1}</span>
                    </div>
                  ))}
                </div>
              )}
            >
              <span className={styles.attemptsBadge}>
                <Icon name="solar:history-bold" size={14} />
                {attempts.length} att.
              </span>
            </Tooltip>
          </div>
        )}
      </div>
    );
  }
  if (status === 'review') {
    return <Badge size="md" tone="warning" label="Review" icon="solar:danger-triangle-linear" />;
  }
  return <span style={{ fontSize: 'var(--font-md)', color: 'var(--neutral-200)' }}>-</span>;
}

// Shared status → badge-variant map for the Assessment and Outreach Status
// pills. Values match the enum on public.patients (see
// supabase/toc_queue_assessment_outreach_migration.sql). The Badge component
// already ships DS variants for `pending`, `in-progress`, `completed`, and
// `warning`, so we route each enum value to the closest existing token
// instead of adding new one-off variants.
const STATUS_BADGE = {
  'Not Started': { variant: 'pending',     icon: 'solar:hourglass-linear' },
  'In Progress': { variant: 'in-progress', icon: 'solar:refresh-linear' },
  'Attempted':   { variant: 'warning',     icon: 'solar:phone-calling-linear' },
  'Completed':   { variant: 'completed',   icon: 'solar:check-circle-linear' },
  'Overdue':     { variant: 'error',       icon: 'solar:danger-triangle-linear' },
};

// Clickable status pill used by both Assessment and Outreach Status cells.
// Renders a `-` when the row has no value yet (patients seed only sets
// values for the 10 agent-assigned rows in the current backfill).
function StatusPill({ status, onOpen, ariaLabel }) {
  if (!status) return <span className={rowStyles.dateDash}>-</span>;
  const cfg = STATUS_BADGE[status] || STATUS_BADGE['Not Started'];
  return (
    <button
      type="button"
      className={styles.statusPillBtn}
      onClick={(e) => { e.stopPropagation(); onOpen(); }}
      aria-label={ariaLabel}
    >
      <Badge size="md" tone={cfg.variant} label={status} icon={cfg.icon} />
      <Icon name="solar:alt-arrow-right-linear" size={12} color="var(--neutral-300)" />
    </button>
  );
}

// Agent-owned columns get a tinted background + primary rails on the outer
// edges. The band spans agentStatus (left rail) and agentDueOn (right
// rail); when the user reorders these away from each other via the Show
// Columns popover, the rails still frame just the agent-band cells.
const AGENT_CELL_STYLE = { background: 'var(--agent-col-bg)' };
const AGENT_CELL_LEFT  = { ...AGENT_CELL_STYLE, borderLeft: '2px solid var(--primary-200)' };
const AGENT_CELL_RIGHT = { ...AGENT_CELL_STYLE, borderRight: '2px solid var(--primary-200)' };
const AGENT_TH_STYLE   = { background: 'var(--agent-col-bg)', color: 'var(--primary-300)' };
const agentThLabel = (icon, text) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
    {icon}
    {text}
  </span>
);

/**
 * Middle-column defs for the TOC / TCM agent queue. Each carries `renderCell(patient,
 * ctx)` so the WorklistShell can respect the user's hide/reorder
 * preferences. Sticky checkbox / Members / Actions columns stay hardcoded
 * in QueueRow around this band.
 *
 * ctx shape:
 *   { voicemailCalls, completedCall, openAssessmentDrawer,
 *     openOutreachStatusDrawer }
 */
export function getQueueMiddleColumns(programLabel = 'TOC') {
  return [
  {
    key: 'lace',
    label: 'LACE Acuity',
    tdClassName: rowStyles.td,
    renderCell: (p) => (
      <Badge size="md" tone={laceTone(p.lace)} label={p.lace} />
    ),
  },
  {
    key: 'outreachWindow',
    label: 'Outreach Window',
    tdClassName: rowStyles.td,
    renderCell: (p) => {
      const outreachBadgeVariant = p.outreachType === '48h' ? 'danger' : 'info';
      return (
        <div className={rowStyles.outreachCell}>
          <Badge size="md" tone={outreachBadgeVariant} label={`${programLabel} ${p.outreachType}`} />
          {p.onCall ? (
            <span className={rowStyles.outreachOncall}>
              <Icon name="solar:phone-calling-bold" size={14} />
              On Call: <LiveCallDuration patient={p} />
            </span>
          ) : (
            <span className={rowStyles.outreachTime}>
              <Icon name="solar:clock-circle-linear" size={14} />
              {p.outreachLeft}
            </span>
          )}
        </div>
      );
    },
  },
  {
    key: 'agentStatus',
    // `label` is the plain string shown in the Show Columns popover, the
    // "Agent" prefix disambiguates from the sibling `tocStatus` column and
    // the regular `dueOn` column. `thLabel` is the JSX icon+text cluster
    // shown in the table header so the agent band still reads like a
    // distinct group without repeating "Agent" in the header.
    label: 'Agent Status',
    thLabel: agentThLabel(
      <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 1L8.5 5H13L9.5 7.5L11 11L7 8.5L3 11L4.5 7.5L1 5H5.5L7 1Z" fill="currentColor"/></svg>,
      'Status',
    ),
    tdClassName: styles.agentColTd,
    tdStyle: AGENT_CELL_LEFT,
    thStyle: { ...AGENT_TH_STYLE, borderLeft: '2px solid var(--primary-200)', minWidth: 200 },
    renderCell: (p, ctx) => (
      <StatusCell patient={p} voicemailCalls={ctx.voicemailCalls} completedCall={ctx.completedCall} />
    ),
  },
  {
    key: 'agentDueOn',
    label: 'Agent Due On',
    thLabel: agentThLabel(<Icon name="solar:calendar-linear" size={14} />, 'Due On'),
    tdClassName: styles.agentColTd,
    tdStyle: AGENT_CELL_RIGHT,
    thStyle: { ...AGENT_TH_STYLE, borderRight: '2px solid var(--primary-200)', minWidth: 140 },
    renderCell: (p) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, whiteSpace: 'nowrap' }}>
        <span style={{ fontSize: 'var(--font-base)', color: 'var(--neutral-400)' }}>
          {computeAgentDueOn(p.dischargeDate, p.outreachType) || '-'}
        </span>
        <span style={{ fontSize: 'var(--font-sm)', color: 'var(--neutral-300)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Icon name="solar:clock-circle-linear" size={14} />
          {p.outreachLeft || '-'}
        </span>
      </div>
    ),
  },
  {
    key: 'assessment',
    label: 'AI Assessment',
    tdClassName: rowStyles.td,
    thStyle: { minWidth: 160 },
    renderCell: (p, ctx) => (
      <StatusPill
        status={p.assessmentStatus}
        onOpen={() => ctx.openAssessmentDrawer(p.id)}
        ariaLabel={`Open assessment for ${p.name}`}
      />
    ),
  },
  {
    key: 'outreachStatus',
    label: 'Outreach Status',
    tdClassName: rowStyles.td,
    thStyle: { minWidth: 160 },
    renderCell: (p, ctx) => (
      <StatusPill
        status={p.outreachStatus}
        onOpen={() => ctx.openOutreachStatusDrawer(p.id)}
        ariaLabel={`Open outreach status for ${p.name}`}
      />
    ),
  },
  {
    key: 'tocStatus',
    label: `${programLabel} Status`,
    tdClassName: rowStyles.td,
    renderCell: (p) => <TocStatusBadge status={p.tocStatus} />,
  },
  { key: 'dueOn',         label: 'Due On',         tdClassName: rowStyles.td, renderCell: (p) => p.dueOn || '-' },
  { key: 'nextOutreach',  label: 'Next Outreach',  tdClassName: rowStyles.td, renderCell: (p) => p.nextOutreach || '-' },
  { key: 'startDate',     label: 'Start Date',     tdClassName: rowStyles.td, renderCell: (p) => p.startDate || '-' },
  { key: 'lastAdmission', label: 'Last Admission', tdClassName: rowStyles.td, renderCell: (p) => p.lastAdmission || '-' },
  {
    key: 'assignee',
    label: 'Assignee',
    tdClassName: rowStyles.td,
    renderCell: (p, ctx) => (
      p.assignee ? (
        <AssigneeChange
          name={p.assignee}
          initials={p.assigneeInitials}
          showRole={false}
          users={ctx.assigneePickerUsers}
          onSelect={(u) => ctx.updatePatient?.(p.id, {
            assignee: u.name,
            assigneeInitials: u.initials,
            assigneeRole: u.role,
          })}
          pickerTitle="Change assignee"
        />
      ) : (
        <AssigneeChange
          unassigned
          showRole={false}
          users={ctx.assigneePickerUsers}
          onSelect={(u) => ctx.updatePatient?.(p.id, {
            assignee: u.name,
            assigneeInitials: u.initials,
            assigneeRole: u.role,
          })}
          pickerTitle="Assign user"
        />
      )
    ),
  },
  {
    key: 'readmission',
    label: 'Readmission',
    tdClassName: rowStyles.td,
    renderCell: (p) => (
      p.readmission === 'Yes'
        ? <Badge size="md" tone="danger" label="Yes" />
        : <Badge size="md" label="No" />
    ),
  },
  {
    key: 'tasks',
    label: 'Tasks',
    tdClassName: rowStyles.td,
    renderCell: (p) => (
      <div className={rowStyles.tasksCell}>
        {p.tasks > 0
          ? <span className={rowStyles.taskBadge}>{p.tasks}</span>
          : <span className={rowStyles.dateDash}>-</span>}
      </div>
    ),
  },
  {
    key: 'carePlanStatus',
    label: 'Care Plan Status',
    tdClassName: rowStyles.td,
    renderCell: (p) => (
      p.carePlanStatus === 'updated'
        ? <Badge size="md" tone="success" label="Updated" icon="solar:check-circle-linear" />
        : p.carePlanStatus === 'pending'
          ? <Badge size="md" tone="warning" label="Pending" icon="solar:clock-circle-linear" />
          : <Badge size="md" label="No Care Plan" />
    ),
  },
];
}

export const QUEUE_MIDDLE_COLUMNS = getQueueMiddleColumns('TCM');

// `voicemailCalls`, `completedCall`, and `ongoingCall` are indexed at the
// table level (see QueueTable's `callsByPatient` memo) and passed in so this
// row doesn't have to scan the entire callDetails array on every render.
export function QueueRow({ patient, columns, hiddenSet, isSelected, onSelect, voicemailCalls, completedCall, ongoingCall, coveringFor }) {
  const openQuickView = useAppStore(s => s.openQuickView);
  const openCallPopover = useAppStore(s => s.openCallPopover);
  const openLiveDrawer = useAppStore(s => s.openLiveDrawer);
  const openAssessmentDrawer = useAppStore(s => s.openAssessmentDrawer);
  const openOutreachStatusDrawer = useAppStore(s => s.openOutreachStatusDrawer);
  const openAiTasksDrawer = useAppStore(s => s.openAiTasksDrawer);
  const showToast = useAppStore(s => s.showToast);
  const allowLiveDrawer = useAppStore(s => s.activeSubnavList !== 'TOC IP');
  const platformUsers = useAppStore(s => s.platformUsers);
  const updatePatient = useAppStore(s => s.updatePatient);
  const callBtnRef = useRef(null);

  const p = patient;
  const openDetail = useAppStore(s => s.openDetail);
  const openPatientQuickView = () => openQuickView({
    id: p.id, name: p.name, initials: p.initials, gender: p.gender,
    age: p.age, memberId: p.memberId, language: p.language, lace: p.lace,
  });
  const handleMemberCellClick = (e) => {
    e.stopPropagation();
    openPatientQuickView();
  };

  const middleCols = (columns || QUEUE_MIDDLE_COLUMNS)
    .filter(c => !c.sticky && !c.showCheckbox && c.renderCell);
  const visibleMiddle = hiddenSet ? middleCols.filter(c => !hiddenSet.has(c.key)) : middleCols;

  const cellCtx = {
    voicemailCalls,
    completedCall,
    openAssessmentDrawer,
    openOutreachStatusDrawer,
    openAiTasksDrawer,
    platformUsers,
    assigneePickerUsers: platformUsersForAssigneePicker(platformUsers),
    updatePatient,
  };
  const [phq9DrawerOpen, setPhq9DrawerOpen] = useState(false);

  const handleRowClick = () => {
    if (p.status === 'completed') {
      openDetail(p.id);
      return;
    }
    if (p.status === 'oncall' && allowLiveDrawer) {
      openLiveDrawer(p.id);
      return;
    }
    openPatientQuickView();
  };
  const handleCallClick = (e) => {
    e.stopPropagation();
    if (p.status === 'oncall' && allowLiveDrawer) {
      openLiveDrawer(p.id);
      return;
    }
    openCallPopover(p.id, callBtnRef);
  };

  return (
    <>
    <tr
      className={[rowStyles.row, isSelected ? rowStyles.rowSelected : ''].filter(Boolean).join(' ')}
      onClick={handleRowClick}
    >
      <td className={`${rowStyles.checkTd} ${rowStyles.stickyLeft}`} style={{ left: 0 }}
        onClick={e => e.stopPropagation()}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onSelect?.(p.id)}
          aria-label={`Select ${p.name}`}
        />
      </td>
      <td
        className={`${rowStyles.membersTd} ${rowStyles.stickyLeft}`}
        style={{ left: 36, cursor: 'pointer' }}
        title="Open patient quick view"
      >
        <div className={rowStyles.patientCell}>
          <PatientAvatarHover patient={{ memberId: p.memberId, id: p.id, name: p.name, initials: p.initials, gender: p.gender, age: p.age, dob: p.dob }} />
          <div>
            <div className={rowStyles.patientName}>
              <button type="button" className={rowStyles.patientNameLink} onClick={handleMemberCellClick}>{p.name}</button>{' '}
              <span className={rowStyles.patientDemo}>({p.gender}•{p.age})</span>
            </div>
            <div className={rowStyles.patientMeta}>
              <span onClick={e => e.stopPropagation()} style={{ display: 'inline-flex' }}>
                <FoldIdTag id={p.memberId} className={rowStyles.foldId} showToast={showToast} />
              </span>{' '}•{' '}
              <Tooltip label={`Preferred Language: ${LANG_MAP[p.language] || 'English'}`} variant="light">
                <button type="button" className={rowStyles.langBadge} onClick={e => e.stopPropagation()}>
                  {(p.language || 'en').toUpperCase()}
                </button>
              </Tooltip>
            </div>
            <CoveringNote people={coveringFor} />
          </div>
        </div>
      </td>

      {visibleMiddle.map(col => (
        <td
          key={col.key}
          data-col-key={col.key}
          className={col.tdClassName || rowStyles.td}
          style={col.tdStyle}
        >
          {col.renderCell(p, cellCtx)}
        </td>
      ))}

      <td className={`${rowStyles.td} ${rowStyles.stickyRight}`}
        onClick={e => e.stopPropagation()}>
        <div className={rowStyles.actionsCell}>
          <ActionButton
            icon="solar:document-text-linear"
            tooltip="View details"
            // Oncall and completed rows keep their own destinations; every
            // other row opens the PHQ-9 review. Quick view stays reachable
            // from the member cell.
            onClick={() => {
              if (p.status === 'oncall' && allowLiveDrawer) openLiveDrawer(p.id);
              else if (p.status === 'completed') openDetail(p.id);
              else setPhq9DrawerOpen(true);
            }}
          />
          <span className={rowStyles.actionDivider} />
          <span style={{ position: 'relative' }}>
            <ActionButton
              ref={callBtnRef}
              icon="solar:phone-linear"
              tooltip={p.status === 'oncall' && allowLiveDrawer ? 'View live call' : 'Call patient'}
              iconColor={p.status === 'oncall' ? '#059669' : undefined}
              className={p.status === 'oncall' ? rowStyles.oncall : p.status === 'queued' ? rowStyles.queuedCall : ''}
              onClick={handleCallClick}
            />
            {p.status === 'oncall' && <span className={rowStyles.callLiveDot} />}
          </span>
          <span className={rowStyles.actionDivider} />
          <ActionButton
            icon="solar:menu-dots-linear"
            tooltip="More options"
            onClick={e => { e.stopPropagation(); showToast('More options – coming soon'); }}
          />
        </div>
      </td>
    </tr>
    {phq9DrawerOpen && (
      <Phq9AssessmentDrawer patient={p} onClose={() => setPhq9DrawerOpen(false)} />
    )}
    </>
  );
}
