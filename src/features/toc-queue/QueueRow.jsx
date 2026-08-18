import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../components/Icon/Icon';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Avatar } from '../../components/Avatar/Avatar';
import { Badge } from '../../components/Badge/Badge';
import { Checkbox } from '../../components/ShadcnCheckbox/ShadcnCheckbox';
import { useAppStore } from '../../store/useAppStore';
import { FoldIdTag } from '../../components/FoldIdTag/FoldIdTag';
import rowStyles from '../toc-worklist/WorklistRow.module.css';
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
  enrolled: { variant: 'toc-enrolled', label: 'Enrolled', icon: 'solar:check-circle-linear' },
  engaged: { variant: 'toc-engaged', label: 'Engaged', icon: 'solar:link-round-linear' },
  attempted: { variant: 'toc-attempted', label: 'Attempted', icon: 'solar:history-linear' },
  new: { variant: 'toc-new', label: 'New', icon: 'solar:star-linear' },
  oncall: { variant: 'toc-oncall', label: 'On Call', icon: 'solar:phone-calling-linear' },
};

function TocStatusBadge({ status }) {
  const cfg = TOC_STATUS_MAP[status] || TOC_STATUS_MAP.new;
  return <Badge size="M" variant={cfg.variant} label={cfg.label} icon={cfg.icon} />;
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
  const { status, goals, scheduledTime, callDuration } = p;
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
        <Badge size="M" variant="status-completed" label="Completed" icon="solar:check-circle-linear" />
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
        <Badge size="M"
          variant="status-oncall"
          label={callDuration || '00:00'}
          icon="solar:phone-calling-linear"
          dot={false}
        />
        {total > 0 && (
          <div className={styles.liveGoalsMini}>
            <div className={styles.goalsFill}>
              <div className={styles.goalsFillInner} style={{ width: `${pct}%`, background: '#059669' }} />
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
        <Badge size="M" variant="status-scheduled" label="Scheduled" icon="solar:calendar-linear" />
        {scheduledTime && <div className={styles.scheduledSub}>{scheduledTime.split(' ')[0]}</div>}
      </div>
    );
  }
  if (status === 'queued') {
    return (
      <div className={styles.statusCompact}>
        <Badge size="M" variant="status-queued" label="Queued" icon="solar:clock-circle-linear" />
      </div>
    );
  }
  if (status === 'failed') {
    return (
      <div className={styles.statusCompact}>
        <Badge size="M" variant="status-failed" label="Failed" icon="solar:close-circle-linear" />
        {attempts?.length > 0 && (
          <div className={styles.attemptsWrapper}>
            <span className={styles.attemptsBadge}>
              <Icon name="solar:history-bold" size={14} />
              {attempts.length} att.
            </span>
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
          </div>
        )}
      </div>
    );
  }
  if (status === 'review') {
    return <Badge size="M" variant="status-review" label="Review" icon="solar:danger-triangle-linear" />;
  }
  return <span style={{ fontSize: 13, color: 'var(--neutral-200)' }}>—</span>;
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
// Renders a `—` when the row has no value yet (patients seed only sets
// values for the 10 agent-assigned rows in the current backfill).
function StatusPill({ status, onOpen, ariaLabel }) {
  if (!status) return <span className={rowStyles.dateDash}>—</span>;
  const cfg = STATUS_BADGE[status] || STATUS_BADGE['Not Started'];
  return (
    <button
      type="button"
      className={styles.statusPillBtn}
      onClick={(e) => { e.stopPropagation(); onOpen(); }}
      aria-label={ariaLabel}
    >
      <Badge size="M" variant={cfg.variant} label={status} icon={cfg.icon} />
      <Icon name="solar:alt-arrow-right-linear" size={12} color="var(--neutral-300)" />
    </button>
  );
}

// `voicemailCalls`, `completedCall`, and `ongoingCall` are indexed at the
// table level (see QueueTable's `callsByPatient` memo) and passed in so this
// row doesn't have to scan the entire callDetails array on every render.
export function QueueRow({ patient, isSelected, onSelect, voicemailCalls, completedCall, ongoingCall }) {
  const openQuickView = useAppStore(s => s.openQuickView);
  const openCallPopover = useAppStore(s => s.openCallPopover);
  const openLiveDrawer = useAppStore(s => s.openLiveDrawer);
  const openAssessmentDrawer = useAppStore(s => s.openAssessmentDrawer);
  const openOutreachStatusDrawer = useAppStore(s => s.openOutreachStatusDrawer);
  const showToast = useAppStore(s => s.showToast);
  const callBtnRef = useRef(null);

  const p = patient;
  const outreachBadgeVariant = p.outreachType === '48h' ? 'outreach-48h' : 'outreach-7d';

  const openDetail = useAppStore(s => s.openDetail);

  const handleRowClick = () => {
    if (p.status === 'completed') {
      openDetail(p.id);
      return;
    }
    if (p.status === 'oncall') {
      openLiveDrawer(p.id);
      return;
    }
    openQuickView({ id: p.id, name: p.name, initials: p.initials, gender: p.gender, age: p.age, memberId: p.memberId, language: p.language, lace: p.lace });
  };
  const handleCallClick = (e) => {
    e.stopPropagation();
    if (p.status === 'oncall') {
      openLiveDrawer(p.id);
      return;
    }
    openCallPopover(p.id, callBtnRef);
  };

  return (
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
      <td className={`${rowStyles.membersTd} ${rowStyles.stickyLeft}`} style={{ left: 36 }}>
        <div className={rowStyles.patientCell}>
          <Avatar variant="patient" initials={p.initials} />
          <div>
            <div className={rowStyles.patientName}>
              <button
                type="button"
                className={rowStyles.patientNameLink}
                onClick={(e) => {
                  e.stopPropagation();
                  openQuickView({ id: p.id, name: p.name, initials: p.initials, gender: p.gender, age: p.age, memberId: p.memberId, language: p.language, lace: p.lace });
                }}
              >
                {p.name}
              </button>{' '}
              <span className={rowStyles.patientDemo}>({p.gender}•{p.age})</span>
            </div>
            <div className={rowStyles.patientMeta}>
              <FoldIdTag id={p.memberId} className={rowStyles.foldId} showToast={showToast} />{' '}•{' '}
              <button
                type="button"
                className={rowStyles.langBadge}
                onClick={(e) => e.stopPropagation()}
              >
                {(p.language || 'en').toUpperCase()}
                <span className={rowStyles.langTooltip}>Preferred Language: {LANG_MAP[p.language] || 'English'}</span>
              </button>
            </div>
          </div>
        </div>
      </td>
      <td className={rowStyles.td}><Badge size="M" variant={`lace-${p.lace.toLowerCase()}`} label={p.lace} /></td>
      <td className={rowStyles.td}>
        <div className={rowStyles.outreachCell}>
          <Badge size="M" variant={outreachBadgeVariant} label={`TOC ${p.outreachType}`} />
          {p.onCall ? (
            <span className={rowStyles.outreachOncall}>
              <Icon name="solar:phone-calling-bold" size={14} />
              On Call: {p.callDuration}
            </span>
          ) : (
            <span className={rowStyles.outreachTime}>
              <Icon name="solar:clock-circle-linear" size={14} />
              {p.outreachLeft}
            </span>
          )}
        </div>
      </td>
      {/* Agent columns */}
      <td className={styles.agentColTd} style={{ background: 'var(--agent-col-bg)', borderLeft: '2px solid var(--primary-200)' }}>
        <StatusCell patient={p} voicemailCalls={voicemailCalls} completedCall={completedCall} />
      </td>
      <td className={styles.agentColTd} style={{ background: 'var(--agent-col-bg)', borderRight: '2px solid var(--primary-200)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: 14, color: 'var(--neutral-400)' }}>
            {computeAgentDueOn(p.dischargeDate, p.outreachType) || '—'}
          </span>
          <span style={{ fontSize: 12, color: 'var(--neutral-300)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Icon name="solar:clock-circle-linear" size={14} />
            {p.outreachLeft || '—'}
          </span>
        </div>
      </td>
      <td className={rowStyles.td}>
        <StatusPill
          status={p.assessmentStatus}
          onOpen={() => openAssessmentDrawer(p.id)}
          ariaLabel={`Open assessment for ${p.name}`}
        />
      </td>
      <td className={rowStyles.td}>
        <StatusPill
          status={p.outreachStatus}
          onOpen={() => openOutreachStatusDrawer(p.id)}
          ariaLabel={`Open outreach status for ${p.name}`}
        />
      </td>
      <td className={rowStyles.td}><TocStatusBadge status={p.tocStatus} /></td>
      <td className={rowStyles.td}>{p.dueOn || '—'}</td>
      <td className={rowStyles.td}>{p.nextOutreach || '—'}</td>
      <td className={rowStyles.td}>{p.startDate || '—'}</td>
      <td className={rowStyles.td}>{p.lastAdmission || '—'}</td>
      <td className={rowStyles.td}>
        <div className={rowStyles.assigneeCell}>
          <Avatar variant="assignee" initials={p.assigneeInitials} />
          <span style={{ fontSize: 13 }}>{p.assignee}</span>
        </div>
      </td>
      <td className={rowStyles.td}>{p.readmission === 'Yes' ? <Badge size="M" variant="yes" label="Yes" /> : <Badge size="M" variant="no" label="No" />}</td>
      <td className={rowStyles.td}>
        <div className={rowStyles.tasksCell}>
          {p.tasks > 0 ? <span className={rowStyles.taskBadge}>{p.tasks}</span> : <span className={rowStyles.dateDash}>—</span>}
        </div>
      </td>
      <td className={rowStyles.td}>
        {p.carePlanStatus === 'updated' ? (
          <Badge size="M" variant="care-plan-updated" label="Updated" icon="solar:check-circle-linear" />
        ) : p.carePlanStatus === 'pending' ? (
          <Badge size="M" variant="care-plan-pending" label="Pending" icon="solar:clock-circle-linear" />
        ) : (
          <Badge size="M" variant="care-plan-none" label="No Care Plan" />
        )}
      </td>
      <td className={`${rowStyles.td} ${rowStyles.stickyRight}`}
        onClick={e => e.stopPropagation()}>
        <div className={rowStyles.actionsCell}>
          <ActionButton
            icon="solar:document-text-linear"
            size="L"
            tooltip="View details"
            onClick={() => {
              if (p.status === 'oncall') openLiveDrawer(p.id);
              else if (p.status === 'completed') openDetail(p.id);
              else openQuickView({ id: p.id, name: p.name, initials: p.initials, gender: p.gender, age: p.age, memberId: p.memberId, language: p.language, lace: p.lace });
            }}
          />
          <span className={rowStyles.actionDivider} />
          <span style={{ position: 'relative' }}>
            <ActionButton
              ref={callBtnRef}
              icon="solar:phone-linear"
              size="L"
              tooltip={p.status === 'oncall' ? 'View live call' : 'Call patient'}
              iconColor={p.status === 'oncall' ? '#059669' : undefined}
              className={p.status === 'oncall' ? rowStyles.oncall : p.status === 'queued' ? rowStyles.queuedCall : ''}
              onClick={handleCallClick}
            />
            {p.status === 'oncall' && <span className={rowStyles.callLiveDot} />}
          </span>
          <span className={rowStyles.actionDivider} />
          <ActionButton
            icon="solar:menu-dots-linear"
            size="L"
            tooltip="More options"
            onClick={e => { e.stopPropagation(); showToast('More options – coming soon'); }}
          />
        </div>
      </td>
    </tr>
  );
}
