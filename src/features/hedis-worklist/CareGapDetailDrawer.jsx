import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Drawer } from '../../components/Drawer/Drawer';
import { Button } from '../../components/Button/Button';
import { Input } from '../../components/Input/Input';
import { ClinicalNotePanel } from './ClinicalNotePanel';
import { PatientBanner } from '../../components/PatientBanner/PatientBanner';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Avatar } from '../../components/Avatar/Avatar';
import { Icon } from '../../components/Icon/Icon';
import { ActivityLog } from '../../components/ActivityLog/ActivityLog';
import { CardSkeleton } from '../../components/CardSkeleton/CardSkeleton';
import { OutreachTab } from '../patient/components/OutreachTab';
import { OUTREACH_LOG_COUNT } from '../patient/data/outreachLogMock';
import { useAppStore } from '../../store/useAppStore';
import styles from './CareGapDetailDrawer.module.css';

const MEASURE_NAMES = {
  CBP:      'Controlling Blood Pressure',
  COL:      'Colorectal Cancer Screening',
  'COA-FS': 'Care for Older Adults: Functional Status',
  'COA-M':  'Care for Older Adults: Medication Review',
  BCS:      'Breast Cancer Screening',
  DM:       'Diabetes HbA1c Control',
  ABA:      'Adult BMI Assessment',
  FUH:      'Follow-Up After Hospitalization',
  AMR:      'Asthma Medication Ratio',
  OMW:      'Osteoporosis Management in Women',
  KED:      'Kidney Health Evaluation',
  EED:      'Eye Exam for Patients With Diabetes',
  GSD3:     'Glycemic Status Assessment',
};

// Canonical HEDIS gap statuses, grouped by their color band:
//   • Not Started (primary purple) — Open
//   • In Progress (warning yellow) — Engaged / Engaged Requires Follow-Up / Submitted
//   • Done        (success green)  — Completed
//   • Closed      (neutral grey)   — Closed - Do not call / Closed - UTR / Closed - Other
const STATUSES = [
  'Open',
  'Engaged',
  'Engaged Requires Follow-Up',
  'Submitted',
  'Completed',
  'Closed - Do not call',
  'Closed - UTR',
  'Closed - Other',
];

// Per-status color triple (color/bg/border) applied inline on the status
// button so it matches the HCC ChartDetailDrawer's `.actionNeeded` pill
// pattern. Keys map 1:1 to the STATUSES list above; colors follow the four
// canonical status groups.
const STATUS_STYLE = {
  Open:                         { color: 'var(--primary-300)',    bg: 'var(--primary-50)',           border: 'color-mix(in srgb, var(--primary-300) 24%, transparent)' },
  Engaged:                      { color: 'var(--status-warning)', bg: 'var(--status-warning-light)', border: 'color-mix(in srgb, var(--status-warning) 24%, transparent)' },
  'Engaged Requires Follow-Up': { color: 'var(--status-warning)', bg: 'var(--status-warning-light)', border: 'color-mix(in srgb, var(--status-warning) 24%, transparent)' },
  Submitted:                    { color: 'var(--status-warning)', bg: 'var(--status-warning-light)', border: 'color-mix(in srgb, var(--status-warning) 24%, transparent)' },
  Completed:                    { color: 'var(--status-success)', bg: 'var(--status-success-light)', border: 'color-mix(in srgb, var(--status-success) 24%, transparent)' },
  'Closed - Do not call':       { color: 'var(--neutral-300)',    bg: 'var(--neutral-50)',           border: 'color-mix(in srgb, var(--neutral-300) 10%, transparent)' },
  'Closed - UTR':               { color: 'var(--neutral-300)',    bg: 'var(--neutral-50)',           border: 'color-mix(in srgb, var(--neutral-300) 10%, transparent)' },
  'Closed - Other':             { color: 'var(--neutral-300)',    bg: 'var(--neutral-50)',           border: 'color-mix(in srgb, var(--neutral-300) 10%, transparent)' },
};

// Kebab menu actions — matches the design's "More actions" panel (Figma
// New-Care-Gap-Workflow node 1178:58434). `handler` receives the drawer's
// helper bag so items that need to open a subpanel (e.g. Add Clinical Note)
// can hook in without duplicating callback wiring.
const MORE_ACTIONS = [
  { key: 'outreach',    label: 'Add Outreach',       icon: 'solar:phone-calling-linear' },
  { key: 'lab',         label: 'Add Lab Order',      icon: 'solar:test-tube-linear' },
  { key: 'imaging',     label: 'Add Imaging Order',  icon: 'solar:medical-kit-linear' },
  { key: 'referral',    label: 'Send Referral',      icon: 'solar:arrow-right-up-linear' },
  { key: 'appointment', label: 'Schedule Appointment', icon: 'solar:calendar-linear' },
  { key: 'document',    label: 'Add Document',       icon: 'solar:upload-minimalistic-linear' },
  { key: 'reminder',    label: 'Set Reminder',       icon: 'solar:bell-linear' },
  { key: 'task',        label: 'Add Task',           icon: 'solar:clipboard-check-linear' },
  { key: 'clinical-note', label: 'Add Clinical Note', icon: 'solar:notes-linear', openClinicalNote: true },
];


// Tab labels. Counts are derived per-render from what each pane actually
// renders (see `tabCounts` below) — the tabs that are still stubbed
// ("coming soon") deliberately carry no count rather than a fabricated one.
const TABS = [
  { key: 'Activity Log', label: 'Activity Log' },
  { key: 'Outreaches', label: 'Outreaches' },
  { key: 'Referrals', label: 'Referrals' },
  { key: 'Tasks', label: 'Tasks' },
  { key: 'Appt/Reminders', label: 'Appt/Reminders' },
  { key: 'Clinical Notes', label: 'Clinical Notes' },
  { key: 'Orders', label: 'Orders' },
];

// First-letter initials from a full name (max 2 chars). "Donna Harold" → "DH";
// single-word names fall back to the first character. Powers the assignee
// avatar chip next to the gap status.
function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0][0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

// "Nd ago" for the gap-start subtitle. Accepts MM/DD/YYYY (the shape carried
// on the mock gap objects) or any Date-parseable string. Returns '' when the
// date is missing/unparseable so callers can drop the parenthetical.
function daysAgo(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  const days = Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));
  return `${days}d ago`;
}

// Color the outcome text for outreach entries — green for success signals,
// red for failure signals, otherwise neutral. Matches OutreachTab's
// convention so the two feeds read the same.
function outreachOutcomeColor(outcome) {
  const s = String(outcome || '').toLowerCase();
  if (/completed|engaged|enrolled|attended|scheduled/.test(s)) return 'var(--status-success)';
  if (/failed|no answer|voicemail|declined/.test(s))          return 'var(--status-error)';
  return 'var(--neutral-400)';
}

// Map raw HEDIS caregapActivity entries → the shape ActivityLog consumes.
// Enriched fields (`callDetails`, `detailCard`, `commentBody`, `file`,
// `fromAssignee`/`toAssignee`, explicit `t`, `from`/`to`) pass through
// verbatim so each variant renders its own UI. This function only derives
// timing bits (`date` / `time` / `by` / `role`) and injects `t:"group"`
// month headers.
function toActivityLogEntries(rawEntries) {
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const out = [];
  let currentGroup = '';
  const sorted = [...(rawEntries || [])].sort((a, b) =>
    new Date(b.when ?? b.at) - new Date(a.when ?? a.at)
  );
  for (const e of sorted) {
    const d = new Date(e.when ?? e.at);
    const valid = !Number.isNaN(d.getTime());
    const groupLabel = valid ? `${MONTHS[d.getMonth()]} ${d.getFullYear()}` : '';
    if (groupLabel && groupLabel !== currentGroup) {
      out.push({ t: 'group', label: groupLabel });
      currentGroup = groupLabel;
    }
    const mm = valid ? String(d.getMonth() + 1).padStart(2, '0') : '';
    const dd = valid ? String(d.getDate()).padStart(2, '0') : '';
    const yyyy = valid ? d.getFullYear() : '';
    let hh = valid ? d.getHours() : 0;
    const min = valid ? String(d.getMinutes()).padStart(2, '0') : '';
    const ampm = hh >= 12 ? 'PM' : 'AM';
    hh = hh % 12 || 12;
    // Actor may carry the role in parens ("Delores Conn (Co-Ordinator)").
    const actor = e.actor || e.user || 'System';
    const roleMatch = actor.match(/^(.+?)\s*\((.+?)\)\s*$/);
    // Outreach outcome gets a status-tinted color; other variants use their
    // own visual chrome (transition pills, detail card, avatar transition,
    // attachment card) so we don't need to color-code them here.
    const outcomeColor = (e.t === 'outreach' || e.t === 'call' || e.t === 'sms')
      ? outreachOutcomeColor(e.outcome)
      : null;
    out.push({
      ...e,
      date:  valid ? `${mm}/${dd}/${yyyy}` : '',
      time:  valid ? `${hh}:${min} ${ampm}` : '',
      by:    roleMatch ? roleMatch[1] : actor,
      role:  roleMatch ? roleMatch[2] : null,
      outcomeColor: outcomeColor || e.outcomeColor,
    });
  }
  return out;
}

export function CareGapDetailDrawer({ member, gapCode, year, onClose }) {
  const showToast = useAppStore(s => s.showToast);
  const updateGapStatus = useAppStore(s => s.updateGapStatus);
  const updateGapAssignee = useAppStore(s => s.updateGapAssignee);
  const logCareGapActivity = useAppStore(s => s.logCareGapActivity);
  const currentActorName = useAppStore(s => s.currentActorName);
  const activityEntries = useAppStore(s => s.caregapActivity[member?.id]);
  // Assignee picker pulls from the same profiles roster shown in
  // Settings → Account → Users. The store guards against duplicate fetches.
  const platformUsers = useAppStore(s => s.platformUsers);
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  useEffect(() => { fetchPlatformUsers(); }, [fetchPlatformUsers]);
  // Hydrate activity feeds from Supabase (falls back to the local mock when
  // the table is empty/unreachable). Single-fire — the store guards reruns.
  const caregapActivityLoaded = useAppStore(s => s.caregapActivityLoaded);
  const fetchCaregapActivity = useAppStore(s => s.fetchCaregapActivity);
  useEffect(() => { fetchCaregapActivity(); }, [fetchCaregapActivity]);

  // Internal gap selection so the header prev/next arrows can cycle through
  // the member's care gaps without re-opening the drawer.
  const gaps = member?.gaps ?? [];
  const [currentCode, setCurrentCode] = useState(gapCode);
  // Re-sync to the incoming gap when the caller points us at a different gap
  // or member. Adjusted during render rather than in an effect — React drops
  // the in-progress render and retries, so there's no extra commit or flash
  // (https://react.dev/reference/react/useState#storing-information-from-previous-renders).
  const gapKey = `${member?.id ?? ''}|${gapCode ?? ''}`;
  const [prevGapKey, setPrevGapKey] = useState(gapKey);
  if (prevGapKey !== gapKey) {
    setPrevGapKey(gapKey);
    setCurrentCode(gapCode);
  }

  const [statusOpen, setStatusOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  // Assignee popover — anchored to the chip's rect and portalled so it can
  // escape the drawer's scroll container.
  const assigneeBtnRef = useRef(null);
  const [assigneePos, setAssigneePos] = useState(null);
  const [assigneeQuery, setAssigneeQuery] = useState('');
  const openAssignee = () => {
    const r = assigneeBtnRef.current?.getBoundingClientRect();
    if (!r) return;
    setAssigneeQuery('');
    setAssigneePos({ top: r.bottom + 4, right: window.innerWidth - r.right });
  };
  const closeAssignee = () => setAssigneePos(null);
  // Measurement Year scope chip — locally scoped so selecting a different
  // year updates the chip + downstream text (info banner, ClinicalNotePanel)
  // without needing a callback back to the parent worklist filter.
  // Re-sync on a new `year` prop the same way (see the gapKey note above), so
  // changing the worklist's year resets any local override.
  const [selectedYear, setSelectedYear] = useState(year);
  const [prevYear, setPrevYear] = useState(year);
  if (prevYear !== year) {
    setPrevYear(year);
    setSelectedYear(year);
  }
  const [yearOpen, setYearOpen] = useState(false);
  const yearOptions = [year, year - 1, year - 2];
  // Kebab menu (More actions) — anchored to the button's rect so it can
  // escape the drawer body's scroll container.
  const moreBtnRef = useRef(null);
  const [moreMenuRect, setMoreMenuRect] = useState(null);
  const openMoreMenu = () => {
    const r = moreBtnRef.current?.getBoundingClientRect();
    if (r) setMoreMenuRect(r);
  };
  const closeMoreMenu = () => setMoreMenuRect(null);
  const runMoreAction = (a) => {
    closeMoreMenu();
    if (a.openClinicalNote) setShowClinicalNote(true);
    else showToast(`${a.label} — coming soon`);
  };
  const [activeTab, setActiveTab] = useState('Activity Log');
  const [showClinicalNote, setShowClinicalNote] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentExpanded, setCommentExpanded] = useState(false);

  if (!member || gaps.length === 0) return null;

  const idx = Math.max(0, gaps.findIndex(g => g.code === currentCode));
  const gap = gaps[idx] ?? gaps[0];
  const canPrev = idx > 0;
  const canNext = idx < gaps.length - 1;

  const status = gap?.status ?? 'Open';
  const measureName = MEASURE_NAMES[gap.code] ?? gap.code;
  const statusLocked = status === 'Completed';

  // Adapt raw caregapActivity entries to the shape the shared ActivityLog
  // expects — same visual language as the HCC DiagPanel timeline.
  const activityLogEntries = toActivityLogEntries(activityEntries);

  // Counts beside a tab label must equal what that pane renders. Activity Log
  // counts the member's real activity rows (not the month-group headers
  // toActivityLogEntries injects); Outreaches counts the shared feed
  // OutreachTab actually shows. Everything else is a stub, so it gets none.
  const tabCounts = {
    'Activity Log': activityEntries?.length ?? 0,
    Outreaches: OUTREACH_LOG_COUNT,
  };

  const goPrev = () => { if (canPrev) { setCurrentCode(gaps[idx - 1].code); setStatusOpen(false); } };
  const goNext = () => { if (canNext) { setCurrentCode(gaps[idx + 1].code); setStatusOpen(false); } };

  const handleAddComment = () => {
    const text = commentText.trim();
    if (!text) return;
    logCareGapActivity(member.id, {
      when: new Date().toISOString(),
      actor: currentActorName(),
      t: 'comment',
      title: 'Added a Comment',
      commentBody: text,
    });
    setCommentText('');
    setCommentExpanded(false);
  };

  return (
    <>
    {showClinicalNote && (
      <ClinicalNotePanel
        member={member}
        gapCode={gap.code}
        year={selectedYear}
        onClose={() => setShowClinicalNote(false)}
      />
    )}
    <Drawer
      title="Care Gap Details"
      onClose={onClose}
      noCloseDivider
      bodyClassName={styles.drawerBody}
      headerRight={
        <div className={styles.headerNav}>
          <ActionButton
            icon="solar:alt-arrow-left-linear"
            size="L"
            tooltip="Previous gap"
            state={canPrev ? 'active' : 'disabled'}
            onClick={goPrev}
          />
          <ActionButton
            icon="solar:alt-arrow-right-linear"
            size="L"
            tooltip="Next gap"
            state={canNext ? 'active' : 'disabled'}
            onClick={goNext}
          />
          <span className={styles.headerDivider} />
        </div>
      }
      // Banner slot sits between the drawer header and its scrolling body
      // (flex-shrink:0), so the patient banner stays pinned in place while
      // the gap header + activity log scroll under it.
      banner={
        <div className={styles.patientBannerWrap}>
          <PatientBanner
            initials={member.in}
            name={member.name}
            gender={member.gender}
            age={member.age}
            dob={member.dob}
            memberId={member.memberId}
            hidePatientLabel
            onCall={() => showToast('Call — coming soon')}
          />
        </div>
      }
    >
      <div className={styles.contentBody}>
      {/* ── Gap header ── */}
      <div className={styles.gapHeader}>
        {/* Row 1: Measurement Year scope chip on the left, quick actions on
            the right. Status + assignee no longer live here — they moved
            down to the title row where the gap's identity lives. */}
        <div className={styles.gapToolbar}>
          <div className={styles.yearWrap}>
            <button
              type="button"
              className={styles.yearChip}
              onClick={() => setYearOpen(v => !v)}
              aria-haspopup="listbox"
              aria-expanded={yearOpen}
            >
              <span className={styles.yearChipLabel}>Measurement Year</span>
              <span className={styles.yearChipSep}>:</span>
              <span className={styles.yearChipValue}>{selectedYear}</span>
              <Icon name="solar:alt-arrow-down-linear" size={11} color="var(--neutral-300)" />
            </button>
            {yearOpen && (
              <>
                <div className={styles.yearMenuOverlay} onClick={() => setYearOpen(false)} />
                <div className={styles.yearMenu} role="listbox">
                  {yearOptions.map(y => (
                    <button
                      key={y}
                      type="button"
                      role="option"
                      aria-selected={y === selectedYear}
                      className={`${styles.yearMenuItem} ${y === selectedYear ? styles.yearMenuItemActive : ''}`}
                      onClick={() => { setSelectedYear(y); setYearOpen(false); }}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className={styles.gapToolbarRight}>
            {/* tooltipBelow: the toolbar sits at the top of the scrolling body,
                so upward-opening tooltips get clipped by the drawer edge. */}
            <ActionButton icon="solar:clipboard-add-linear" size="L" tooltip="Add Task" tooltipBelow onClick={() => showToast('Add Task — coming soon')} />
            <span className={styles.headerDivider} />
            <ActionButton icon="solar:notes-linear" size="L" tooltip="Add Clinical Note" tooltipBelow onClick={() => setShowClinicalNote(true)} />
            <span className={styles.headerDivider} />
            <ActionButton
              ref={moreBtnRef}
              icon="solar:menu-dots-linear"
              size="L"
              tooltip="More"
              tooltipBelow
              tooltipLeft
              onClick={moreMenuRect ? closeMoreMenu : openMoreMenu}
            />
          </div>
        </div>

        {/* Row 2: title/subtitle on the left, assignee + status on the right.
            Wrapped in .gapTitleWrap to give it side-padding while the toolbar
            above stays edge-to-edge. */}
        <div className={styles.gapTitleWrap}>
        <div className={styles.gapTitleRow}>
          <div className={styles.gapTitleCol}>
            <div className={styles.gapTitle}>
              {gap.code} - {measureName}
            </div>
            <div className={styles.gapSubRow}>
              {gap.startDate && (
                <>
                  <span>{gap.startDate}{daysAgo(gap.startDate) ? ` (${daysAgo(gap.startDate)})` : ''}</span>
                  <span className={styles.gapSubDot}>&bull;</span>
                </>
              )}
              <button className={styles.moreDetailsBtn} onClick={() => setMoreOpen(v => !v)}>
                More Details
                <Icon
                  name="solar:alt-arrow-down-linear"
                  size={13}
                  color="currentColor"
                  className={`${styles.moreChevron} ${moreOpen ? styles.moreChevronOpen : ''}`}
                />
              </button>
            </div>
          </div>

          <div className={styles.gapTitleActions}>
            {gap.assignee ? (
              <button
                ref={assigneeBtnRef}
                type="button"
                className={styles.assigneeChip}
                onClick={() => (assigneePos ? closeAssignee() : openAssignee())}
                title={`Assigned to ${gap.assignee}`}
                aria-label={gap.assignee}
              >
                <span className={styles.assigneeAvatar}>{initialsOf(gap.assignee)}</span>
                <Icon name="solar:alt-arrow-down-linear" size={11} color="var(--secondary-300)" />
              </button>
            ) : (
              <button
                ref={assigneeBtnRef}
                type="button"
                className={styles.assigneeChipEmpty}
                onClick={() => (assigneePos ? closeAssignee() : openAssignee())}
                title="Assign"
                aria-label="Assign"
              >
                <Icon name="solar:user-plus-linear" size={14} color="var(--neutral-300)" />
                <Icon name="solar:alt-arrow-down-linear" size={11} color="var(--neutral-300)" />
              </button>
            )}
            <div className={styles.statusWrap}>
              <button
                className={styles.statusBtn}
                onClick={() => { if (!statusLocked) setStatusOpen(v => !v); }}
                disabled={statusLocked}
                title={statusLocked ? 'Completed gaps are locked' : ''}
                style={{
                  color: STATUS_STYLE[status]?.color,
                  background: STATUS_STYLE[status]?.bg,
                  borderColor: STATUS_STYLE[status]?.border,
                }}
              >
                {status}
                {!statusLocked && (
                  <Icon name="solar:alt-arrow-down-linear" size={12} color="currentColor" />
                )}
              </button>
              {statusOpen && !statusLocked && (
                <>
                  <div className={styles.statusMenuOverlay} onClick={() => setStatusOpen(false)} />
                  <div className={styles.statusMenu} role="menu">
                    <div className={styles.statusMenuHeader}>Change Status</div>
                    <div className={styles.statusMenuItems}>
                      {STATUSES.map(s => {
                        const isSel = s === status;
                        return (
                          <button
                            key={s}
                            type="button"
                            role="menuitemradio"
                            aria-checked={isSel}
                            className={`${styles.statusMenuItem} ${isSel ? styles.statusMenuItemActive : ''}`}
                            onClick={() => { updateGapStatus(member.id, gap.code, s); setStatusOpen(false); }}
                          >
                            <span className={styles.statusMenuItemLabel}>{s}</span>
                            {isSel && (
                              <Icon name="solar:check-read-linear" size={12} color="var(--primary-300)" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        </div>
        {/* More Details expansion — Measure Requirements + Instructions live here */}
        <div className={`${styles.moreDetails} ${moreOpen ? styles.moreDetailsOpen : ''}`} style={{ padding: '0 16px' }}>
          <div className={styles.moreDetailsInner}>
            <div className={styles.moreDetailsBody}>
              <div className={styles.infoBanner}>
                <span className={styles.infoBannerIcon}>
                  <Icon name="solar:info-circle-linear" size={15} color="var(--status-info, #145ECC)" />
                </span>
                <span>
                  Evidence uploaded will be recorded for measurement year {selectedYear}. The measurement year filter is displayed above for your reference.
                </span>
              </div>

              <div className={styles.accordionSection}>
                <button className={styles.accordionBtn} onClick={() => showToast('Measure Requirements — coming soon')}>
                  <Icon name="solar:alt-arrow-down-linear" size={13} />
                  Measure Requirements
                </button>
              </div>
              <div className={styles.accordionSection}>
                <button className={styles.accordionBtn} onClick={() => showToast('Measure Instructions — coming soon')}>
                  <Icon name="solar:alt-arrow-down-linear" size={13} />
                  Measure Instructions
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Suggested actions ── */}
      <div className={styles.suggestSection}>
      <div className={styles.suggestRow}>
        <Icon name="solar:magic-stick-3-bold" size={14} color="var(--primary-300)" />
        Suggested Actions
      </div>
      <div className={styles.suggestActions}>
        <Button variant="primary" size="L" onClick={() => showToast('Schedule with Specialist — coming soon')}>
          Schedule with Specialist
        </Button>
        <Button variant="tertiary" size="L" onClick={() => showToast('Add MRC Task — coming soon')}>
          Add MRC Task
        </Button>
        <Button variant="secondary" size="L" onClick={() => showToast('Add Outreach — coming soon')}>
          Add Outreach
        </Button>
        <Button variant="secondary" size="L" onClick={() => showToast('Set Reminder — coming soon')}>
          Set Reminder
        </Button>
      </div>
      </div>

      {/* ── Tabs ── Full-bleed row so its bottom border spans edge-to-edge;
          horizontal padding on the row itself indents the tab labels. */}
      <div className={styles.tabBar}>
        <div className={styles.tabsScroll}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              {tabCounts[tab.key] != null && (
                <span className={styles.tabCount}>({tabCounts[tab.key]})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className={styles.tabContentWrap}>
      {activeTab === 'Activity Log' ? (
        <div className={styles.activityLog}>
          <div className={styles.commentInput}>
            {commentExpanded ? (
              <textarea
                autoFocus
                className={styles.commentTextarea}
                placeholder="Add a comment, use @ to mention someone"
                rows={3}
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') { setCommentExpanded(false); setCommentText(''); } }}
              />
            ) : (
              <Input
                placeholder="Add a comment"
                onFocus={() => setCommentExpanded(true)}
                style={{ cursor: 'text', width: '100%' }}
              />
            )}
            {commentExpanded && (
              <div className={styles.commentActions}>
                <Button variant="primary" size="S" disabled={!commentText.trim()} onClick={handleAddComment}>Comment</Button>
                <Button variant="secondary" size="S" onClick={() => { setCommentExpanded(false); setCommentText(''); }}>Cancel</Button>
              </div>
            )}
          </div>
          {caregapActivityLoaded
            ? <ActivityLog entries={activityLogEntries} emptyLabel="No activity yet for this care gap." />
            : <CardSkeleton />}
        </div>
      ) : activeTab === 'Outreaches' ? (
        // Reuse the patient-profile Outreach experience — same log form,
        // activity feed, and filter chrome. `defaultPrograms=[gap.code]`
        // preselects this gap in the form; the activity feed itself renders
        // the same shared entries as the patient profile Quick View, since
        // scoping by a HEDIS gap code (no matching entries in the mock)
        // would otherwise show an empty feed.
        <OutreachTab
          defaultPrograms={[gap.code]}
          defaultLogFor="care-program"
          hideLogForRow
        />
      ) : (
        <div className={styles.emptyTab}>
          <Icon name="solar:hourglass-line-linear" size={36} color="var(--neutral-200)" />
          <p className={styles.emptyTabTitle}>{activeTab} — coming soon</p>
        </div>
      )}
      </div>
      </div>
    </Drawer>
    {assigneePos && createPortal(
      <>
        <div className={styles.assigneeMenuOverlay} onClick={closeAssignee} />
        <div
          className={styles.assigneeMenu}
          style={{ top: assigneePos.top, right: assigneePos.right }}
          role="menu"
        >
          <div className={styles.assigneeMenuHeader}>{gap.assignee ? 'Change Assignee' : 'Assign to'}</div>
          <div className={styles.assigneeMenuSearch}>
            <Icon name="solar:magnifer-linear" size={14} color="var(--neutral-300)" />
            <input
              autoFocus
              type="text"
              className={styles.assigneeMenuInput}
              placeholder="Search users…"
              value={assigneeQuery}
              onChange={(e) => setAssigneeQuery(e.target.value)}
            />
          </div>
          <div className={styles.assigneeMenuList}>
            {(() => {
              const q = assigneeQuery.trim().toLowerCase();
              const list = q
                ? platformUsers.filter(u => u.name.toLowerCase().includes(q))
                : platformUsers;
              if (list.length === 0) {
                return (
                  <div className={styles.assigneeMenuEmpty}>
                    {q ? 'No users match your search.' : 'No users found.'}
                  </div>
                );
              }
              return list.map(u => {
                const isSel = gap.assignee === u.name;
                return (
                  <button
                    key={u.id}
                    type="button"
                    className={`${styles.assigneeMenuItem} ${isSel ? styles.assigneeMenuItemActive : ''}`}
                    onClick={() => {
                      updateGapAssignee(member.id, gap.code, u.name);
                      closeAssignee();
                    }}
                  >
                    <Avatar variant="assignee" initials={u.initials} />
                    <span className={styles.assigneeMenuName}>{u.name}</span>
                    {isSel && (
                      <Icon name="solar:check-read-linear" size={12} color="var(--primary-300)" />
                    )}
                  </button>
                );
              });
            })()}
          </div>
          {gap.assignee && (
            <button
              type="button"
              className={styles.assigneeMenuClear}
              onClick={() => { updateGapAssignee(member.id, gap.code, null); closeAssignee(); }}
            >
              <Icon name="solar:user-cross-linear" size={14} color="var(--status-error)" />
              Unassign
            </button>
          )}
        </div>
      </>,
      document.body,
    )}
    {moreMenuRect && createPortal(
      <>
        <div className={styles.moreMenuOverlay} onClick={closeMoreMenu} />
        <div
          className={styles.moreMenu}
          style={{
            top: moreMenuRect.bottom + 6,
            left: Math.min(moreMenuRect.right - 220, window.innerWidth - 220 - 8),
          }}
        >
          {MORE_ACTIONS.map(a => (
            <button
              key={a.key}
              type="button"
              className={styles.moreMenuItem}
              onClick={() => runMoreAction(a)}
            >
              <Icon name={a.icon} size={16} color="var(--neutral-300)" />
              {a.label}
            </button>
          ))}
        </div>
      </>,
      document.body,
    )}
    </>
  );
}
