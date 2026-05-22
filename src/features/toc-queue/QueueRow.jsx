import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../components/Icon/Icon';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Avatar } from '../../components/Avatar/Avatar';
import { Badge } from '../../components/Badge/Badge';
import { Checkbox } from '../../components/ui/checkbox';
import { useAppStore } from '../../store/useAppStore';
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

const AI_VARIANT_MAP = {
  'ai-tag-risk': 'ai-risk',
  'ai-tag-care': 'ai-care',
  'ai-tag-social': 'ai-social',
  'ai-tag-med': 'ai-med',
  'ai-tag-neutral': 'ai-neutral',
};

function TocStatusBadge({ status }) {
  const MAP = {
    enrolled: { variant: 'toc-enrolled', label: 'Enrolled', icon: 'solar:check-circle-bold' },
    engaged: { variant: 'toc-engaged', label: 'Engaged', icon: 'solar:link-round-bold' },
    attempted: { variant: 'toc-attempted', label: 'Attempted', icon: 'solar:history-bold' },
    new: { variant: 'toc-new', label: 'New', icon: 'solar:star-bold' },
    oncall: { variant: 'toc-oncall', label: 'On Call', icon: 'solar:phone-calling-bold' },
  };
  const cfg = MAP[status] || MAP.new;
  return <Badge variant={cfg.variant} label={cfg.label} icon={cfg.icon} />;
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
        <Badge variant="status-completed" label="Completed" icon="solar:check-circle-bold" />
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
        <Badge
          variant="status-oncall"
          label={callDuration || '00:00'}
          icon="solar:phone-calling-bold"
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
        <Badge variant="status-scheduled" label="Scheduled" icon="solar:calendar-bold" />
        {scheduledTime && <div className={styles.scheduledSub}>{scheduledTime.split(' ')[0]}</div>}
      </div>
    );
  }
  if (status === 'queued') {
    return (
      <div className={styles.statusCompact}>
        <Badge variant="status-queued" label="Queued" icon="solar:clock-circle-bold" />
      </div>
    );
  }
  if (status === 'failed') {
    return (
      <div className={styles.statusCompact}>
        <Badge variant="status-failed" label="Failed" icon="solar:close-circle-bold" />
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
                  <Icon name="solar:phone-calling-bold" size={16} color="#DC2626" />
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
    return <Badge variant="status-review" label="Review" icon="solar:danger-triangle-bold" />;
  }
  return <span style={{ fontSize: 13, color: 'var(--neutral-200)' }}>—</span>;
}

function LiveTranscriptSnippet({ transcript }) {
  if (!transcript?.length) return null;
  const last = transcript[transcript.length - 1];
  const prev = transcript.length > 1 ? transcript[transcript.length - 2] : null;
  return (
    <div className={styles.liveSnippet}>
      {prev && (
        <div className={styles.snippetLine}>
          <span className={styles.snippetSender}>{prev.sender === 'agent' ? prev.name : prev.name?.split(' ')[0]}:</span>
          <span className={styles.snippetText}>{prev.text.length > 60 ? prev.text.slice(0, 60) + '…' : prev.text}</span>
        </div>
      )}
      <div className={`${styles.snippetLine} ${styles.snippetLatest}`}>
        <span className={styles.snippetSender}>{last.sender === 'agent' ? last.name : last.name?.split(' ')[0]}:</span>
        <span className={styles.snippetText}>{last.text.length > 60 ? last.text.slice(0, 60) + '…' : last.text}</span>
      </div>
    </div>
  );
}

function NextActionCell({ patient: p, ongoingCall }) {
  const showToast = useAppStore(s => s.showToast);
  if (p.status === 'oncall') {
    const transcript = ongoingCall?.liveTranscript || p.liveTranscript || [];
    if (transcript.length > 0) {
      return <LiveTranscriptSnippet transcript={transcript} />;
    }
    return <div className={styles.nextAction}>{p.nextAction || 'Live outreach in progress'}</div>;
  }
  if (p.nextAction === '__MED_REVIEW__') {
    return (
      <div>
        <div className={styles.medDone}>
          <Icon name="solar:check-circle-bold" size={13} /> Agent tasks done
        </div>
        <a className={styles.medLink} onClick={() => showToast('Opening Medication Reconciliation…')}>
          <Icon name="solar:pill-bold" size={12} /> Review Med. Reconciliation →
        </a>
      </div>
    );
  }
  return <div className={styles.nextAction}>{p.nextAction || '—'}</div>;
}

function AiInsightsCell({ insights }) {
  if (!insights?.length) return <span style={{ color: 'var(--neutral-200)' }}>—</span>;
  const MAX_VISIBLE = 2;
  const visible = insights.slice(0, MAX_VISIBLE);
  const overflow = insights.slice(MAX_VISIBLE);
  return (
    <div className={styles.aiCell}>
      {visible.map((t, i) => (
        <Badge key={i} variant={AI_VARIANT_MAP[t.cls] || 'ai-neutral'} label={t.label} icon={t.icon} />
      ))}
      {overflow.length > 0 && (
        <div className={styles.aiOverflowWrap}>
          <span className={styles.aiOverflowBadge}>+{overflow.length}</span>
          <div className={styles.aiOverflowTooltip}>
            {overflow.map((t, i) => (
              <Badge key={i} variant={AI_VARIANT_MAP[t.cls] || 'ai-neutral'} label={t.label} icon={t.icon} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function QueueRow({ patient }) {
  const openWorkflow = useAppStore(s => s.openWorkflow);
  const openCallPopover = useAppStore(s => s.openCallPopover);
  const openLiveDrawer = useAppStore(s => s.openLiveDrawer);
  const showToast = useAppStore(s => s.showToast);
  const callDetails = useAppStore(s => s.callDetails);
  const callBtnRef = useRef(null);

  const p = patient;
  const voicemailCalls = callDetails.filter(c => c.patientId === p.id && c.callType === 'voicemail');
  const completedCall = callDetails.find(c => c.patientId === p.id && c.callType === 'completed');
  const ongoingCall = callDetails.find(c => c.patientId === p.id && c.callType === 'ongoing');
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
    openWorkflow(p.id);
  };
  const handleCallClick = (e) => {
    e.stopPropagation();
    if (p.status === 'oncall') {
      openLiveDrawer(p.id);
      return;
    }
    openCallPopover(p.id, callBtnRef);
  };

  const tdBase = {
    padding: '10px 14px',
    fontSize: 14,
    fontWeight: 400,
    color: 'var(--neutral-400)',
    verticalAlign: 'middle',
  };

  return (
    <tr style={{ borderBottom: '1px solid var(--neutral-150)', transition: 'background .1s', cursor: 'pointer' }}
      onClick={handleRowClick}
      onMouseOver={e => e.currentTarget.style.background = 'var(--primary-25)'}
      onMouseOut={e => e.currentTarget.style.background = ''}
    >
      <td style={{ ...tdBase, width: 36, padding: '8px 10px', position: 'sticky', left: 0, zIndex: 3, background: 'var(--neutral-0)' }}
        onClick={e => e.stopPropagation()}>
        <Checkbox />
      </td>
      <td style={{ ...tdBase, padding: '8px 12px', position: 'sticky', left: 36, zIndex: 3, background: 'var(--neutral-0)', borderRight: '1px solid var(--neutral-150)' }}>
        <div className={rowStyles.patientCell}>
          <Avatar variant="patient" initials={p.initials} />
          <div>
            <div className={rowStyles.patientName}>{p.name} <span className={rowStyles.patientDemo}>({p.gender}•{p.age})</span></div>
            <div className={rowStyles.patientMeta}>
              {p.memberId} •{' '}
              <span className={rowStyles.langBadge}>
                {(p.language || 'en').toUpperCase()}
                <span className={rowStyles.langTooltip}>Preferred Language: {LANG_MAP[p.language] || 'English'}</span>
              </span>
            </div>
          </div>
        </div>
      </td>
      <td style={tdBase}>
        <Badge
          variant={`priority-${p.priority <= 1 ? 'critical' : p.priority <= 2 ? 'high' : p.priority <= 3 ? 'medium' : 'low'}`}
          label={p.priority <= 1 ? 'Critical' : p.priority <= 2 ? 'High' : p.priority <= 3 ? 'Medium' : 'Low'}
          icon={p.priority <= 1 ? 'solar:danger-triangle-bold' : p.priority <= 2 ? 'solar:arrow-up-bold' : p.priority <= 3 ? 'solar:minus-circle-bold' : 'solar:arrow-down-bold'}
        />
      </td>
      <td style={tdBase}>
        <Badge
          variant={`outreach-${p.outreachCategory || 'post-visit'}`}
          label={(p.outreachCategory || 'post-visit').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
        />
      </td>
      <td style={tdBase}><Badge variant={`lace-${p.lace.toLowerCase()}`} label={p.lace} /></td>
      <td style={tdBase}>
        <div className={rowStyles.outreachCell}>
          <Badge variant={outreachBadgeVariant} label={`TOC ${p.outreachType}`} />
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
      <td className={styles.agentColTd} style={{ background: 'var(--agent-col-bg)' }}>
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
      <td className={styles.agentColTd} style={{ background: 'var(--agent-col-bg)' }}>
        <NextActionCell patient={p} ongoingCall={ongoingCall} />
      </td>
      <td className={styles.agentColTd} style={{ background: 'var(--agent-col-bg)', borderRight: '2px solid var(--primary-200)' }}>
        <AiInsightsCell insights={p.aiInsights} />
      </td>
      <td style={tdBase}><TocStatusBadge status={p.tocStatus} /></td>
      <td style={tdBase}><span style={{ fontSize: 14, color: 'var(--neutral-400)', whiteSpace: 'nowrap' }}>{p.dueOn || '—'}</span></td>
      <td style={tdBase}><span style={{ fontSize: 14, color: 'var(--neutral-400)', whiteSpace: 'nowrap' }}>{p.nextOutreach || '—'}</span></td>
      <td style={tdBase}><span style={{ fontSize: 14, color: 'var(--neutral-400)', whiteSpace: 'nowrap' }}>{p.startDate || '—'}</span></td>
      <td style={tdBase}><span style={{ fontSize: 14, color: 'var(--neutral-400)', whiteSpace: 'nowrap' }}>{p.lastAdmission || '—'}</span></td>
      <td style={tdBase}>
        <div className={rowStyles.assigneeCell}>
          <Avatar variant="assignee" initials={p.assigneeInitials} />
          <span style={{ fontSize: 13 }}>{p.assignee}</span>
        </div>
      </td>
      <td style={tdBase}>{p.readmission === 'Yes' ? <Badge variant="yes" label="Yes" /> : <Badge variant="no" label="No" />}</td>
      <td style={tdBase}>
        <div className={rowStyles.tasksCell}>
          {p.tasks > 0 ? <span className={rowStyles.taskBadge}>{p.tasks}</span> : <span className={rowStyles.dateDash}>—</span>}
        </div>
      </td>
      <td style={tdBase}>
        {p.carePlanStatus === 'updated' ? (
          <Badge variant="care-plan-updated" label="Updated" icon="solar:check-circle-bold" />
        ) : p.carePlanStatus === 'pending' ? (
          <Badge variant="care-plan-pending" label="Pending" icon="solar:clock-circle-bold" />
        ) : (
          <Badge variant="care-plan-none" label="No Care Plan" />
        )}
      </td>
      <td style={{ ...tdBase, position: 'sticky', right: 0, background: 'var(--neutral-0)', borderLeft: '1px solid var(--neutral-150)', boxShadow: '-4px 0 8px rgba(0,0,0,.04)' }}
        onClick={e => e.stopPropagation()}>
        <div className={rowStyles.actionsCell}>
          <ActionButton
            icon="solar:document-text-linear"
            size="L"
            tooltip="View details"
            onClick={() => {
              if (p.status === 'oncall') openLiveDrawer(p.id);
              else if (p.status === 'completed') openDetail(p.id);
              else openWorkflow(p.id);
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
