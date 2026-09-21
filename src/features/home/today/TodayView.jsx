import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { MenuPopover } from '../../../components/MenuPopover/MenuPopover';
import { Button } from '../../../components/Button/Button';
import { Badge } from '../../../components/Badge/Badge';
import { Icon } from '../../../components/Icon/Icon';
import { Avatar } from '../../../components/Avatar/Avatar';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { TabStrip } from '../../../components/TabStrip/TabStrip';
import { Link } from '../../../components/Link/Link';
import { WorklistShell } from '../../../components/WorklistShell/WorklistShell';
import { FoldIdTag } from '../../../components/FoldIdTag/FoldIdTag';
import { Tooltip } from '../../../components/Tooltip/Tooltip';
import { formatDobDisplay, deriveDob } from '../../../lib/patientDob';
import { toast } from '../../../components/Toast/sonnerToast';
import { NBA_ITEMS, PANEL_TODAY } from './nbaData';
import styles from './TodayView.module.css';

const LANG_MAP = { en: 'English', es: 'Spanish', zh: 'Chinese', yue: 'Cantonese', ko: 'Korean', vi: 'Vietnamese', hi: 'Hindi', pa: 'Punjabi' };

// Member | Programs | Next Best Action | Status | Actions. Member pins left and
// Actions pins right (toc parity) so both stay in view when the table scrolls.
const TODAY_COLUMNS = [
  { key: 'member', label: 'Member', sticky: 'left', width: 288 },
  { key: 'programs', label: 'Programs', width: 168 },
  { key: 'nba', label: 'Next Best Action' },
  { key: 'status', label: 'Status', width: 120, align: 'left' },
  { key: 'actions', label: 'Actions', sticky: 'right', width: 124, align: 'left' },
];

// The four Panel Pulse buckets, in display order. `match` maps a card to the
// feed rows it filters to; `accent` picks the number + border color token.
const PULSE = [
  { key: 'overdue',   title: 'Overdue',               accent: 'overdue',   match: (it) => it.urgency === 'overdue' },
  { key: 'due-today', title: 'Due Today',             accent: 'dueToday',  match: (it) => it.urgency === 'due-today' },
  { key: 'escalated', title: 'Agent-Escalated to Me', accent: 'escalated', match: (it) => it.isAgent },
  { key: 'threshold', title: 'Threshold-Risk',        accent: 'threshold', match: (it) => it.urgency === 'threshold' },
];

const LENS = ['All', 'CCM', 'TCM', 'BHI', 'AWV', 'DM'];
const LENS_TABS = LENS.map((p) => ({ key: p, label: p }));

const RISK_TONE = { High: 'error', Rising: 'warning', Moderate: 'info' };

function initials(name) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

function firstName(name) {
  return name.split(' ').filter(Boolean)[0] || name;
}

// "James Whitfield" → "James W." for the Start next button.
function shortName(name) {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length < 2) return name;
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function showTouchModeSoon(what) {
  toast(`${what} opens in Touch Mode. Coming soon.`);
}

// Bind each clinical scenario to a real patient from all_patients (adults, for
// a plausible care-management panel). Falls back to the scenario's own identity
// only until the patient database loads. `patientId` is the real profile id.
function bindScenarios(scenarios, patients) {
  const pool = (patients || [])
    .filter((p) => (p.age ?? 0) >= 40 && p.name)
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return scenarios.map((sc, i) => {
    const p = pool[i];
    const name = p?.name || sc.fallbackName;
    return {
      ...sc,
      patientId: p?.id || null,
      patientName: name,
      age: p?.age ?? sc.fallbackAge,
      payer: p?.coverageType || sc.fallbackPayer,
      provider: p?.pcp || sc.fallbackProvider,
      // Member-cell identity — mirrors the toc worklist row.
      gender: p?.gender || 'F',
      memberId: p?.memberId || '',
      language: p?.language || 'en',
      dob: p?.dob || null,
      initials: p?.initials || initials(name),
      reason: sc.reason.replace('{first}', firstName(name)),
    };
  });
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function PulseCard({ card, count, active, onClick }) {
  return (
    <button
      type="button"
      className={[styles.pulseCard, active ? styles.pulseActive : ''].filter(Boolean).join(' ')}
      onClick={onClick}
      aria-pressed={active}
    >
      <span className={[styles.pulseNum, styles[`num_${card.accent}`]].join(' ')}>{count}</span>
      <span className={styles.pulseTitleRow}>
        {card.key === 'escalated' && <Icon name="solar:magic-stick-3-linear" size={13} />}
        <span className={styles.pulseTitle}>{card.title}</span>
      </span>
      <span className={styles.pulseCaption}>{PANEL_TODAY.pulse[card.key].caption}</span>
    </button>
  );
}

function AdherenceCard({ onOpen }) {
  const { total, onTrack, slipping, offPlan } = PANEL_TODAY.adherence;
  const pct = (n) => `${(n / total) * 100}%`;
  return (
    <div className={styles.adherence}>
      <div className={styles.adherenceHead}>
        <span className={styles.adherenceTitle}>Panel Adherence</span>
        <span className={styles.adherenceTotal}>{total} patients</span>
      </div>
      <div className={styles.stack} role="img" aria-label={`${onTrack} on track, ${slipping} slipping, ${offPlan} off plan`}>
        <span className={styles.segOnTrack} style={{ width: pct(onTrack) }} />
        <span className={styles.segSlipping} style={{ width: pct(slipping) }} />
        <span className={styles.segOffPlan} style={{ width: pct(offPlan) }} />
      </div>
      <div className={styles.adherenceLegend}>
        <span className={styles.legendItem}><span className={[styles.legendDot, styles.dotOnTrack].join(' ')} />{onTrack} on track</span>
        <span className={styles.legendItem}><span className={[styles.legendDot, styles.dotSlipping].join(' ')} />{slipping} slipping</span>
        <span className={styles.legendItem}><span className={[styles.legendDot, styles.dotOffPlan].join(' ')} />{offPlan} off plan</span>
        <Link className={styles.panelHealthLink} onClick={onOpen}>
          Panel Health <Icon name="solar:arrow-right-linear" size={13} />
        </Link>
      </div>
    </div>
  );
}

// Member cell — identical structure to the toc worklist row (Avatar + name
// link + (gender•age) DOB tooltip + FoldId • language badge), composing the
// shared WorklistRow member-cell classes.
function MemberCell({ item, onOpen, showToast }) {
  const open = (e) => { e.stopPropagation(); onOpen(item); };
  const dobLabel = formatDobDisplay(item.dob) || deriveDob(item.age, item.patientName);
  return (
    <td
      className={`${styles.membersTd} ${styles.stickyLeft}`}
      style={{ left: 0, cursor: 'pointer' }}
      onClick={open}
      title="Open patient"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(e); } }}
    >
      <div className={styles.patientCell}>
        <Avatar variant="patient" initials={item.initials} />
        <div>
          <div className={styles.patientName}>
            <span className={styles.patientNameLink} onClick={open} role="link" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(e); } }}>{item.patientName}</span>{' '}
            <Tooltip label={dobLabel ? `DOB: ${dobLabel}` : ''} placement="bottom">
              <span className={styles.patientDemo}>({item.gender}•{item.age})</span>
            </Tooltip>
          </div>
          <div className={styles.patientMeta}>
            <span onClick={e => e.stopPropagation()} style={{ display: 'inline-flex' }}>
              <FoldIdTag id={item.memberId} className={styles.foldId} showToast={showToast} />
            </span>{' '}•{' '}
            <span className={styles.langBadge} onClick={e => e.stopPropagation()} role="note">
              {(item.language || 'en').toUpperCase()}
              <span className={styles.langTooltip}>Preferred Language: {LANG_MAP[item.language] || 'English'}</span>
            </span>
          </div>
        </div>
      </div>
    </td>
  );
}

const ROW_MENU_ITEMS = [
  { key: 'snooze', icon: 'solar:alarm-linear', label: 'Snooze' },
  { key: 'reassign', icon: 'solar:users-group-rounded-linear', label: 'Reassign' },
];

function TodayRow({ item, onSnooze, onOpen, showToast }) {
  const open = () => onOpen(item);
  const [menuOpen, setMenuOpen] = useState(false);
  const moreRef = useRef(null);
  const onMenuSelect = (key) => { if (key === 'snooze') onSnooze(item); else showTouchModeSoon('Reassign'); };
  return (
    <tr className={styles.row} onClick={open}>
      <MemberCell item={item} onOpen={onOpen} showToast={showToast} />

      <td className={styles.programsTd}>
        <div className={styles.programList}>
          {item.programs.map((p) => <Badge key={p} tone="grey" size="S" label={p} />)}
        </div>
      </td>

      <td className={styles.nbaTd}>
        <div className={styles.nbaStack}>
          {item.isAgent && (
            <div className={styles.agentChip}>
              <span className={styles.agentName}>{item.agentName} · Unity agent</span>
              {item.agentStatus && <span className={styles.agentStatus}>· {item.agentStatus}</span>}
            </div>
          )}
          <span className={styles.reason}>{item.reason}</span>
          <Link className={styles.suggestedLink} onClick={(e) => { e.stopPropagation(); open(); }}>
            {item.suggestedAction}
          </Link>
        </div>
      </td>

      <td className={styles.statusTd}>
        <Badge tone={RISK_TONE[item.riskTier] || 'grey'} size="M" label={item.riskTier} />
      </td>

      <td className={`${styles.actionsTd} ${styles.stickyRight}`} onClick={e => e.stopPropagation()}>
        <div className={styles.actionsCell}>
          <ActionButton size="S" icon="solar:phone-calling-linear" tooltip="Call" onClick={() => showTouchModeSoon('Call')} />
          <span className={styles.actionDivider} />
          <ActionButton size="S" icon="solar:chat-round-linear" tooltip="Text" onClick={() => showTouchModeSoon('Text')} />
          <span className={styles.actionDivider} />
          <span style={{ position: 'relative', display: 'inline-flex' }}>
            <ActionButton ref={moreRef} size="S" icon="solar:menu-dots-linear" tooltip="More" onClick={() => setMenuOpen((v) => !v)} />
            {menuOpen && (
              <MenuPopover
                anchorRef={moreRef}
                items={ROW_MENU_ITEMS}
                onSelect={onMenuSelect}
                onClose={() => setMenuOpen(false)}
                width={176}
                ariaLabel="Row actions"
              />
            )}
          </span>
        </div>
      </td>
    </tr>
  );
}

export function TodayView() {
  const allPatients = useAppStore((s) => s.allPatients);
  const patientsLoading = useAppStore((s) => s.allPatientsLoading);
  const fetchAllPatients = useAppStore((s) => s.fetchAllPatients);
  const navigateToPatient = useAppStore((s) => s.navigateToPatient);
  const showToast = useAppStore((s) => s.showToast);
  const userName = useAppStore((s) => s.currentUserProfile?.name);

  const [pulse, setPulse] = useState(null);   // active Panel Pulse bucket
  const [lens, setLens] = useState('All');     // program lens
  const [dismissed, setDismissed] = useState(() => new Set()); // snoozed row ids
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  useEffect(() => { fetchAllPatients(); }, [fetchAllPatients]);

  const greetName = (userName || '').trim().split(/\s+/)[0] || 'there';
  const dateLabel = useMemo(
    () => new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    [],
  );

  // Bind the clinical scenarios to real patients, then apply the snooze set.
  const rows = useMemo(
    () => bindScenarios(NBA_ITEMS, allPatients).filter((r) => !dismissed.has(r.id)),
    [allPatients, dismissed],
  );

  const filtered = useMemo(() => rows.filter((it) => {
    if (lens !== 'All' && !it.programs.includes(lens)) return false;
    if (pulse) {
      const card = PULSE.find((p) => p.key === pulse);
      if (card && !card.match(it)) return false;
    }
    return true;
  }), [rows, pulse, lens]);

  // Snap back to page 1 whenever the active filter changes the result set.
  useEffect(() => { setPage(1); }, [lens, pulse]);

  const paged = useMemo(
    () => filtered.slice((page - 1) * perPage, page * perPage),
    [filtered, page, perPage],
  );

  const openPatient = (item) => {
    if (item.patientId) navigateToPatient(item.patientId, { profileTab: 'Monitoring' });
    else toast('Patient profile is still loading.');
  };
  const onSnooze = (item) => setDismissed((prev) => new Set(prev).add(item.id));
  const startRow = rows[0];
  const startName = startRow ? shortName(startRow.patientName) : null;
  // Show skeletons only on the very first load, before the patient list arrives.
  const showSkeleton = patientsLoading && allPatients.length === 0;

  return (
    <div className={styles.today}>
      {/* Fixed top region — greeting + Panel Pulse in a bordered container,
          then the full-width tab strip flush to the table. Only the table
          below scrolls. */}
      <div className={styles.headerRegion}>
      {/* Header strip */}
      <div className={styles.header}>
        <div className={styles.greetBlock}>
          <span className={styles.date}>{dateLabel}</span>
          <h1 className={styles.greet}>{greeting()}, {greetName}</h1>
        </div>
        <div className={styles.headSummary}>
          <span><b>{PANEL_TODAY.touchesDone}</b> of {PANEL_TODAY.touchesPlanned} touches</span>
          <span className={styles.headDot} aria-hidden="true">·</span>
          <span><b>{PANEL_TODAY.minutesTotal}</b> min logged today</span>
        </div>
        {startName && (
          <Button variant="primary" onClick={() => openPatient(startRow)}>
            Start next: {startName}
            <Icon name="solar:arrow-right-linear" size={14} />
          </Button>
        )}
      </div>

      {/* Panel Pulse + adherence */}
      <div className={styles.pulse}>
        {PULSE.map((card) => (
          <PulseCard
            key={card.key}
            card={card}
            count={PANEL_TODAY.pulse[card.key].count}
            active={pulse === card.key}
            onClick={() => setPulse((cur) => (cur === card.key ? null : card.key))}
          />
        ))}
        <AdherenceCard onOpen={() => showTouchModeSoon('Panel Health')} />
      </div>
      </div>

      {/* Program lens — full-width tab strip, flush to the table below */}
      <div className={styles.tabBar}>
        <TabStrip items={LENS_TABS} activeKey={lens} onChange={setLens} fullWidth={false} />
      </div>

      {/* Scrolling table — Member | Programs | Next Best Action | Status | Actions */}
      <div className={styles.tableRegion}>
        <WorklistShell
          header={null}
          columns={TODAY_COLUMNS}
          rows={paged}
          loading={showSkeleton}
          minTableWidth={1040}
          page={page}
          perPage={perPage}
          totalItems={filtered.length}
          onPageChange={setPage}
          onPageSizeChange={(n) => { setPerPage(n); setPage(1); }}
          emptyState={(
            <div className={styles.empty}>
              <Icon name="solar:check-circle-linear" size={28} />
              <p className={styles.emptyTitle}>Queue clear.</p>
              <p className={styles.emptyBody}>No actions match this filter right now. Nice work.</p>
            </div>
          )}
          renderRow={(it) => (
            <TodayRow key={it.id} item={it} onSnooze={onSnooze} onOpen={openPatient} showToast={showToast} />
          )}
        />
      </div>
    </div>
  );
}
