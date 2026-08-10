import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, Tooltip,
} from '../../components/LazyRecharts/LazyRecharts';
import { Icon } from '../../components/Icon/Icon';
import { CloseIcon } from '../../components/Icon/CloseIcon';
import { CallLogTab, GoalDetailPanel, ResizeDragger } from '../../components/CallQueueDrawer/CallQueueDrawer';
import { useAppStore } from '../../store/useAppStore';
import styles from './AnalyticsPanel.module.css';

/* ── Sub-tab definitions ── */
const SUB_TABS = [
  { id: 'snapshot', label: 'Snapshot' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'billing', label: 'Billing Reports' },
  { id: 'calllog', label: 'Call Log' },
];

/* ── Mock chart data ── */
const DAILY_CALLS = [
  { t: '8am', v: 12 }, { t: '9am', v: 24 }, { t: '10am', v: 18 },
  { t: '11am', v: 30 }, { t: '12pm', v: 22 }, { t: '1pm', v: 28 },
  { t: '2pm', v: 20 }, { t: '3pm', v: 15 }, { t: '4pm', v: 10 },
];

const MONTHLY_CALLS = [
  { t: 'W1', v: 7200 }, { t: 'W2', v: 8100 }, { t: 'W3', v: 7800 },
  { t: 'W4', v: 9356 }, { t: 'W5', v: 6200 }, { t: 'W6', v: 8400 },
  { t: 'W7', v: 7000 }, { t: 'W8', v: 9100 },
];

/* ── 24-Hour Uptime Data (each block = 1 hour) ── */
const UPTIME_HOURS = [
  { hour: '12 AM', status: 'idle', patients: 0, label: 'Idle' },
  { hour: '1 AM', status: 'idle', patients: 0, label: 'Idle' },
  { hour: '2 AM', status: 'idle', patients: 0, label: 'Idle' },
  { hour: '3 AM', status: 'idle', patients: 0, label: 'Idle' },
  { hour: '4 AM', status: 'idle', patients: 0, label: 'Idle' },
  { hour: '5 AM', status: 'idle', patients: 2, label: 'Low Activity' },
  { hour: '6 AM', status: 'active', patients: 12, label: 'Active' },
  { hour: '7 AM', status: 'active', patients: 28, label: 'Active' },
  { hour: '8 AM', status: 'active', patients: 45, label: 'Active' },
  { hour: '9 AM', status: 'peak', patients: 67, label: 'Peak' },
  { hour: '10 AM', status: 'peak', patients: 72, label: 'Peak' },
  { hour: '11 AM', status: 'peak', patients: 68, label: 'Peak' },
  { hour: '12 PM', status: 'active', patients: 54, label: 'Active' },
  { hour: '1 PM', status: 'active', patients: 48, label: 'Active' },
  { hour: '2 PM', status: 'peak', patients: 61, label: 'Peak' },
  { hour: '3 PM', status: 'active', patients: 52, label: 'Active' },
  { hour: '4 PM', status: 'degraded', patients: 31, label: 'Degraded' },
  { hour: '5 PM', status: 'degraded', patients: 24, label: 'Degraded' },
  { hour: '6 PM', status: 'active', patients: 18, label: 'Active' },
  { hour: '7 PM', status: 'active', patients: 14, label: 'Active' },
  { hour: '8 PM', status: 'low', patients: 8, label: 'Low Activity' },
  { hour: '9 PM', status: 'low', patients: 5, label: 'Low Activity' },
  { hour: '10 PM', status: 'idle', patients: 1, label: 'Idle' },
  { hour: '11 PM', status: 'idle', patients: 0, label: 'Idle' },
];

const STATUS_COLORS = {
  peak: '#009B53',
  active: '#4CAF50',
  low: '#8BC34A',
  degraded: '#FFB300',
  idle: '#D0D6E1',
};

/* ── Delta arrow icon — uses filled triangular arrow, not chevron ── */
function DeltaArrow({ direction, color }) {
  const isUp = direction === 'up';
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0 }}>
      {isUp ? (
        <path d="M5 2L8.5 7H1.5L5 2Z" fill={color} />
      ) : (
        <path d="M5 8L1.5 3H8.5L5 8Z" fill={color} />
      )}
    </svg>
  );
}

/* ── StatCard with semantic delta coloring ── */
function StatCard({ label, value, delta, deltaDirection, sentiment, sub }) {
  // sentiment: 'good' (green), 'bad' (red), 'neutral' (gray)
  const colorClass = sentiment === 'good' ? styles.deltaPos : sentiment === 'bad' ? styles.deltaNeg : styles.deltaNeu;
  const arrowColor = sentiment === 'good' ? '#009B53' : sentiment === 'bad' ? '#D72825' : '#6F7A90';

  return (
    <div className={styles.statCard}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}</span>
      {delta && (
        <span className={`${styles.statDelta} ${colorClass}`}>
          {deltaDirection && <DeltaArrow direction={deltaDirection} color={arrowColor} />}
          <span>{delta}</span>
        </span>
      )}
      {sub && <span className={styles.statSub}>{sub}</span>}
    </div>
  );
}

/* ── MiniChart (Recharts) ── */
function MiniChart({ data, color = '#8C5AE2' }) {
  return (
    <div className={styles.chartArea}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`grad-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.2} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="t" hide />
          <YAxis hide />
          <Tooltip
            contentStyle={{ background: '#fff', border: '1px solid #E9ECF1', borderRadius: 6, fontSize: 12, fontFamily: 'Inter' }}
            labelStyle={{ color: '#6F7A90', fontWeight: 500 }}
          />
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#grad-${color.replace('#','')})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── UptimeBlock with tooltip (portal-rendered to avoid layout stretch) ── */
function UptimeBlock({ hour }) {
  const [showTip, setShowTip] = useState(false);
  const [tipPos, setTipPos] = useState({ top: 0, left: 0 });
  const segRef = useRef(null);
  const color = STATUS_COLORS[hour.status] || '#D0D6E1';

  const handleEnter = () => {
    if (segRef.current) {
      const rect = segRef.current.getBoundingClientRect();
      setTipPos({
        top: rect.top - 8,
        left: rect.left + rect.width / 2,
      });
    }
    setShowTip(true);
  };

  return (
    <div
      ref={segRef}
      className={`${styles.uptimeSegment} ${showTip ? styles.uptimeSegmentHover : ''}`}
      style={{ background: color }}
      onMouseEnter={handleEnter}
      onMouseLeave={() => setShowTip(false)}
    >
      {showTip && createPortal(
        <div className={styles.uptimeTooltip} style={{ top: tipPos.top, left: tipPos.left, transform: 'translate(-50%, -100%)' }}>
          <div className={styles.uptimeTooltipTime}>{hour.hour}</div>
          <div className={styles.uptimeTooltipRow}>
            <span className={styles.uptimeTooltipDot} style={{ background: color }} />
            <span>{hour.label}</span>
          </div>
          <div className={styles.uptimeTooltipPatients}>
            {hour.patients} patient{hour.patients !== 1 ? 's' : ''} addressed
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

/* ── Helper: map config keys to display labels ── */
const TONE_LABELS = { professional: 'Professional', warm: 'Warm & Caring', casual: 'Casual', direct: 'Direct' };
const ROLE_LABELS = { coordinator: 'Care Coordinator', navigator: 'Care Navigator', outreach: 'Outreach Specialist', scheduler: 'Scheduling Assistant' };
const VOICE_LABELS = { erica: 'Erica - US Female', james: 'James - US Male', sophia: 'Sophia - US Female', david: 'David - UK Male' };
const MODALITY_LABELS = { voice: 'Voice', text: 'Text', both: 'Voice & Text' };

/* ── Snapshot Tab Content — Beautiful read-only config overview ── */
function SnapshotContent({ agent, showBanner, setShowBanner }) {
  const builderConfig = useAppStore(s => s.builderConfig);
  const goalsData = useAppStore(s => s.goalsData) || [];
  const c = builderConfig || {};

  const selectedGoals = [];
  for (const id of c.goal_ids || []) {
    const goal = goalsData.find(g => String(g.id) === String(id));
    if (goal) selectedGoals.push(goal);
  }
  const languages = (c.languages || ['english']).map(l => l.charAt(0).toUpperCase() + l.slice(1));

  return (
    <>
      {showBanner && (
        <div className={styles.banner}>
          <button className={styles.bannerClose} onClick={() => setShowBanner(false)} aria-label="Dismiss banner">
            <CloseIcon size={16} color="#fff" />
          </button>
          <div className={styles.bannerIcon}>
            <Icon name="solar:cloud-check-bold" size={48} color="rgba(255,255,255,.9)" />
          </div>
          <div className={styles.bannerTitle}>
            <span className={styles.bannerEmoji}>🎉</span>
            Agent Deployed Successfully!
          </div>
          <div className={styles.bannerSub}>Your agent is now live and ready to help patients.</div>
        </div>
      )}

      {/* Status Overview */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Status Overview</span>
        </div>
        <div className={styles.sectionBody}>
          <div className={styles.statusGrid}>
            <div className={styles.statusItem}>
              <span className={styles.statusLabel}>Test Results</span>
              <span className={styles.statusValue}>7/7 Passed</span>
            </div>
            <div className={styles.statusItem}>
              <span className={`${styles.statusLabel} ${styles.statusLabelNeutral}`}>Last Modified</span>
              <span className={styles.statusValue}>{agent?.last_updated || '2 hours ago'}</span>
            </div>
            <div className={styles.statusItem}>
              <span className={`${styles.statusLabel} ${styles.statusLabelNeutral}`}>Created By</span>
              <span className={styles.statusValue}>{agent?.last_updated_by || 'Dr. Sarah Johnson'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Agent Identity */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <Icon name="solar:user-rounded-linear" size={16} color="#6F7A90" />
          <span className={styles.sectionTitle} >Agent Identity</span>
        </div>
        <div className={styles.sectionBody}>
          <div className={styles.snapGrid}>
            <div className={styles.snapField}>
              <span className={styles.snapLabel}>Agent Name</span>
              <span className={styles.snapValue}>{agent?.name || 'Anna'}</span>
            </div>
            <div className={styles.snapField}>
              <span className={styles.snapLabel}>Role</span>
              <span className={styles.snapValue}>{ROLE_LABELS[c.agent_role] || c.agent_role || '—'}</span>
            </div>
            <div className={styles.snapField}>
              <span className={styles.snapLabel}>Use Case</span>
              <span className={styles.snapValue}>{c.use_case_name || agent?.use_case || '—'}</span>
            </div>
            <div className={styles.snapField}>
              <span className={styles.snapLabel}>Version</span>
              <span className={styles.snapValue}>v{agent?.version || '1.0'}</span>
            </div>
          </div>
          {c.description && (
            <div className={styles.snapField} style={{ marginTop: 12 }}>
              <span className={styles.snapLabel}>Description</span>
              <span className={styles.snapDesc}>{c.description}</span>
            </div>
          )}
        </div>
      </div>

      {/* Active Channels & Communication */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <Icon name="solar:phone-calling-rounded-linear" size={16} color="#6F7A90" />
          <span className={styles.sectionTitle} >Communication</span>
        </div>
        <div className={styles.sectionBody}>
          <div className={styles.channelGrid}>
            {(c.modality === 'voice' || c.modality === 'both' || !c.modality) && (
              <div className={styles.channelCard}><Icon name="solar:phone-calling-linear" size={18} color="#009B53" /> Voice</div>
            )}
            {(c.modality === 'text' || c.modality === 'both') && (
              <div className={styles.channelCard}><Icon name="solar:chat-round-dots-linear" size={18} color="#009B53" /> SMS</div>
            )}
            <div className={styles.channelCard}><Icon name="solar:letter-linear" size={18} color="#6F7A90" /> Email & Chat</div>
          </div>
          <div className={styles.snapGrid} style={{ marginTop: 12 }}>
            <div className={styles.snapField}>
              <span className={styles.snapLabel}>Phone</span>
              <span className={styles.snapValue}>{c.phone || '—'}</span>
            </div>
            <div className={styles.snapField}>
              <span className={styles.snapLabel}>Email</span>
              <span className={styles.snapValue}>{c.email || '—'}</span>
            </div>
            <div className={styles.snapField}>
              <span className={styles.snapLabel}>Office Hours</span>
              <span className={styles.snapValue}>{c.office_hours || '—'}</span>
            </div>
            <div className={styles.snapField}>
              <span className={styles.snapLabel}>Languages</span>
              <span className={styles.snapValue}>{languages.join(', ')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Personalization */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <Icon name="solar:magic-stick-3-linear" size={16} color="#6F7A90" />
          <span className={styles.sectionTitle} >Personalization</span>
        </div>
        <div className={styles.sectionBody}>
          <div className={styles.snapGrid}>
            <div className={styles.snapField}>
              <span className={styles.snapLabel}>Tone of Voice</span>
              <span className={styles.snapPill}>{TONE_LABELS[c.tone_of_voice] || 'Professional'}</span>
            </div>
            <div className={styles.snapField}>
              <span className={styles.snapLabel}>Voice</span>
              <span className={styles.snapValue}>{VOICE_LABELS[c.voice] || 'Erica - US Female'}</span>
            </div>
            <div className={styles.snapField}>
              <span className={styles.snapLabel}>Empathy Level</span>
              <div className={styles.snapMeter}>
                <div className={styles.snapMeterFill} style={{ width: `${c.empathy_level || 75}%`, background: '#009B53' }} />
              </div>
              <span className={styles.snapMeterLabel}>{c.empathy_level || 75}%</span>
            </div>
            <div className={styles.snapField}>
              <span className={styles.snapLabel}>Speaking Pace</span>
              <div className={styles.snapMeter}>
                <div className={styles.snapMeterFill} style={{ width: `${c.speaking_pace || 75}%`, background: '#8C5AE2' }} />
              </div>
              <span className={styles.snapMeterLabel}>{c.speaking_pace || 75}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Goals */}
      {selectedGoals.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <Icon name="solar:target-linear" size={16} color="#6F7A90" />
            <span className={styles.sectionTitle} >Assigned Goals ({selectedGoals.length})</span>
          </div>
          <div className={styles.sectionBody}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selectedGoals.map(g => (
                <div key={g.id} className={styles.snapGoalRow}>
                  <div className={styles.snapGoalInfo}>
                    <span className={styles.snapGoalName}>{g.name}</span>
                    <span className={styles.snapGoalMeta}>{g.steps?.length || 0} steps &middot; {g.mode || 'sequential'}</span>
                  </div>
                  <span className={`${styles.snapGoalBadge} ${g.program === 'TCM' ? styles.badgePurple : g.program === 'Outreach' ? styles.badgeBlue : styles.badgeAmber}`}>
                    {g.program}
                  </span>
                  {g.completionRate > 0 && (
                    <span className={styles.snapGoalRate}>{g.completionRate}%</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* System Prompt (collapsed preview) */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <Icon name="solar:document-text-linear" size={16} color="#6F7A90" />
          <span className={styles.sectionTitle} >System Prompt</span>
        </div>
        <div className={styles.sectionBody}>
          <div className={styles.promptPreview}>
            {c.system_prompt || `${agent?.name || 'Agent'} - Virtual Healthcare Outreach Assistant\n\nYou are ${agent?.name || 'an agent'}, an AI-powered voice assistant representing Avergent Collaborative Care.`}
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Analytics Tab Content ── */
function AnalyticsContent() {
  return (
    <>
      {/* Agent Uptime — 24 blocks = 24 hours */}
      <div className={styles.section}>
        <div className={styles.sectionBody}>
          <div className={styles.uptimeHeader}>
            <span className={styles.uptimeTitle}>Agent Uptime</span>
            <span className={styles.uptimeStarted}>Started on: 11/12/2025, 01:23 PM</span>
          </div>
          <div className={styles.uptimeBar}>
            {UPTIME_HOURS.map((h, i) => (
              <UptimeBlock key={i} hour={h} />
            ))}
          </div>
          <div className={styles.uptimeLegend}>
            <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: '#009B53' }} /> Peak</span>
            <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: '#4CAF50' }} /> Active</span>
            <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: '#8BC34A' }} /> Low</span>
            <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: '#FFB300' }} /> Degraded</span>
            <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: '#D0D6E1' }} /> Idle</span>
          </div>
        </div>
      </div>

      {/* Agent Performance — semantic delta colors */}
      <div>
        <div className={styles.sectionTitle} style={{ marginBottom: 12 }}>Agent Performance</div>
        <div className={styles.kpiRow}>
          <StatCard label="Total Calls" value="1,284" delta="+8% vs last week" deltaDirection="up" sentiment="good" />
          <StatCard label="Goal Completion Rate" value="72%" delta="+4% vs last week" deltaDirection="up" sentiment="good" sub="Mandatory goals met" />
          <StatCard label="Escalation Rate" value="18%" delta="-3% vs last week" deltaDirection="down" sentiment="good" sub="Lower is better" />
          <StatCard label="Avg. Handle Time" value="4:32" delta="-12s vs last week" deltaDirection="down" sentiment="good" sub="Minutes per call" />
        </div>
      </div>

      {/* Agent Quality */}
      <div>
        <div className={styles.sectionTitle} style={{ marginBottom: 12 }}>Agent Quality</div>
        <div className={styles.kpiRow3}>
          <StatCard label="Patient Satisfaction" value="4.6/5" delta="+0.2 vs last month" deltaDirection="up" sentiment="good" sub="Post-call survey score" />
          <StatCard label="First Call Resolution" value="68%" delta="+5% vs last month" deltaDirection="up" sentiment="good" sub="Resolved without callback" />
          <StatCard label="Compliance Score" value="98%" delta="No change" sentiment="neutral" sub="HIPAA & protocol adherence" />
        </div>
        <div className={styles.kpiRow3} style={{ marginTop: 12 }}>
          <StatCard label="Appointments Scheduled" value="589" delta="+46% success rate" deltaDirection="up" sentiment="good" sub="From 1,284 total calls" />
          <StatCard label="Medication Reconciled" value="412" delta="32% of calls" sentiment="neutral" sub="Med list confirmed" />
          <StatCard label="Follow-ups Confirmed" value="847" delta="+66% confirmation" deltaDirection="up" sentiment="good" sub="Discharge follow-up" />
        </div>
      </div>

      {/* Real-time Billing Dashboard Preview */}
      <div>
        <div className={styles.sectionTitle} style={{ marginBottom: 12 }}>Real-time Billing Dashboard Preview</div>
        <div className={styles.kpiRow3}>
          <div className={styles.chartCard}>
            <span className={styles.chartLabel}>Today's Calls</span>
            <span className={styles.chartValue}>120 Calls</span>
            <span className={styles.chartSub}>$ 12.00 at $ 0.10/call</span>
            <MiniChart data={DAILY_CALLS} color="#8C5AE2" />
          </div>
          <div className={styles.chartCard}>
            <span className={styles.chartLabel}>This Month</span>
            <span className={styles.chartValue}>32,456 Calls</span>
            <span className={styles.chartSub}>
              $5,314.76 projected
              <span className={`${styles.statDelta} ${styles.deltaPos}`} style={{ marginLeft: 6 }}>
                <DeltaArrow direction="up" color="#009B53" />
                <span>3%</span>
              </span>
            </span>
            <MiniChart data={MONTHLY_CALLS} color="#009B53" />
          </div>
          <div className={styles.chartCard}>
            <span className={styles.chartLabel}>TCM Billable</span>
            <span className={styles.chartValue}>743 Patients</span>
            <span className={styles.chartSub}>Eligible for Billing</span>
            <div style={{ marginTop: 'auto', paddingTop: 12 }}>
              <span className={styles.chartSub}>
                Since last month
                <span className={`${styles.statDelta} ${styles.deltaPos}`} style={{ marginLeft: 6 }}>
                  <DeltaArrow direction="up" color="#009B53" />
                  <span>0.5%</span>
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Call Log Content with split panel ── */
function CallLogContent() {
  const [selectedCall, setSelectedCall] = useState(null);
  const [leftWidth, setLeftWidth] = useState(null);
  const containerRef = useRef(null);

  const handleDrag = useCallback((delta) => {
    setLeftWidth(prev => {
      const containerW = containerRef.current?.offsetWidth || 1200;
      const base = prev || Math.round(containerW * 0.55);
      return Math.max(400, Math.min(containerW - 360, base + delta));
    });
  }, []);

  return (
    <div className={styles.callLogContainer} ref={containerRef}>
      <div className={styles.callLogSplit}>
        <div className={styles.callLogLeft} style={leftWidth ? { width: leftWidth, flex: 'none' } : undefined}>
          <CallLogTab
            onSelectCall={(call) => setSelectedCall(call)}
            selectedCallId={selectedCall?.id || null}
            searchQuery=""
          />
        </div>
        {selectedCall && (
          <>
            <ResizeDragger onDrag={handleDrag} />
            <div className={styles.callLogRight}>
              <div className={styles.callLogRightHeader}>
                <span className={styles.callLogRightTitle}>Goal Summary</span>
                <button className={styles.callLogRightClose} onClick={() => setSelectedCall(null)} aria-label="Close call details">
                  <CloseIcon size={16} />
                </button>
              </div>
              <div className={styles.callLogRightBody}>
                <GoalDetailPanel call={selectedCall} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════ AnalyticsPanel ═══════════════ */
export function AnalyticsPanel({ agent }) {
  const [activeSubTab, setActiveSubTab] = useState('snapshot');
  const [showBanner, setShowBanner] = useState(true);
  const fetchAgentConfig = useAppStore(s => s.fetchAgentConfig);
  const fetchGoals = useAppStore(s => s.fetchGoals);
  const goalsData = useAppStore(s => s.goalsData);

  // Ensure config and goals are loaded for Snapshot tab
  useEffect(() => {
    if (agent?.id) fetchAgentConfig(agent.id);
    if (!goalsData?.length) fetchGoals();
  }, [agent?.id]);

  return (
    <div className={styles.wrapper}>
      {/* Sub-tab bar */}
      <div className={styles.tabBar}>
        <div className={styles.tabBarInner}>
          {SUB_TABS.map(t => (
            <button
              key={t.id}
              className={`${styles.tab} ${activeSubTab === t.id ? styles.tabActive : ''}`}
              onClick={() => setActiveSubTab(t.id)}
              type="button"
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {activeSubTab === 'calllog' ? (
        <CallLogContent />
      ) : (
        <div className={styles.scrollArea}>
          <div className={styles.scrollInner}>
            {activeSubTab === 'snapshot' && (
              <SnapshotContent agent={agent} showBanner={showBanner} setShowBanner={setShowBanner} />
            )}

            {activeSubTab === 'analytics' && <AnalyticsContent />}

            {activeSubTab === 'billing' && (
              <div className={styles.placeholder}>
                <Icon name="solar:bill-list-linear" size={40} color="#D0D6E1" />
                <span className={styles.placeholderTitle}>Billing Reports</span>
                <span className={styles.placeholderDesc}>Billing reports and cost breakdowns will appear here.</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
