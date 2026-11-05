import { DownChevronIcon } from '../../components/Icon/DownChevronIcon';
import { AssigneeChange } from '../../components/AssigneeChange/AssigneeChange';
import { Badge } from '../../components/Badge/Badge';
import { Tooltip } from '../../components/Tooltip/Tooltip';
import { PriorityIcon } from '../../components/PriorityIcon/PriorityIcon';
import { canSetGapStatus, gapBadge, MEASURE_NAMES, PRIORITY_LEVELS, daysFromToday } from './pharmacyWorklist.utils';
import { fillsToStayCompliant } from './fillEvents';
import { OutreachStatusCell } from '../../components/OutreachStatusCell/OutreachStatusCell';
import { ClaimReconCell, Dash, DateWithDays, DaysToSaveValue, DrugsCount, FailDateValue, NextFillDueValue, OpenCareGaps, PriorYearPdc, ProgressCell, SavabilityBadge, SubStatus } from './PharmacyCells';
import { EditablePdc } from './PdcEditor';
import styles from './PharmacyWorklistRow.module.css';


const isOverdue = (mdy) => { const d = daysFromToday(mdy); return d != null && d < 0; };
const PRIOR_YEAR = new Date().getFullYear() - 1;
const numberOrDash = (n, suffix = '') => (n == null ? <Dash /> : <span className={styles.cellText}>{n}{suffix}</span>);

// Gap-level columns stack one item per visible pharmacy gap, HEDIS style
// (the row collapses to 2 with "View More N"); the last one draws the divider
// between per-gap and per-member columns.
const gapTd = (last) => (m, ctx) => [
  styles.tdGap,
  ctx.visibleGaps.length === 1 ? styles.tdGapCenter : '',
  last ? styles.tdGapDivide : '',
].filter(Boolean).join(' ');

// `footer` fills the row under the gaps when some are collapsed; the other
// gap columns leave it empty so every column stays aligned.
const perGap = (render, footer) => (m, ctx) => (
  <div className={styles.gapItems}>
    {ctx.visibleGaps.map(g => <div key={g.code} className={styles.gapItem}>{render(g, m, ctx)}</div>)}
    {ctx.extraCount > 0 && <div className={styles.gapFooter}>{footer?.(ctx)}</div>}
  </div>
);

const viewMoreButton = (ctx) => (
  <button type="button" className={styles.viewMoreBtn} onClick={ctx.toggleExpanded} aria-expanded={ctx.expanded}>
    {ctx.expanded ? 'View Less' : `View More ${ctx.extraCount}`}
    <DownChevronIcon size={12} color="currentColor" className={`${styles.chevron} ${ctx.expanded ? styles.chevronUp : ''}`} />
  </button>
);

/**
 * Middle-column defs: priority, then the per-gap block (one stacked item per
 * gap), then member-level columns. `optional: true` columns start hidden; the
 * Actions header picker shows them.
 */
export const PHARMACY_MIDDLE_COLUMNS = [
  {
    key: 'priority', label: 'P', sortKey: 'priorityRank', sortType: 'number',
    // Divider before the per-gap block, like the one after it.
    getTdClassName: () => `${styles.td} ${styles.tdGapDivide}`,
    // Set by the PDC / refill-overdue rule (memberPriority); not editable.
    renderCell: (m) => {
      const level = PRIORITY_LEVELS.find(l => l.value === m.priority);
      return (
        <Tooltip label={`${level?.label || m.priority} priority · ${m.priorityReason}`} placement="bottom">
          <span className={styles.priorityIcon} aria-label={`Priority ${level?.label || m.priority}: ${m.priorityReason}`}>
            <PriorityIcon priority={level?.icon || 'none'} size={16} />
          </span>
        </Tooltip>
      );
    },
  },
  {
    key: 'gaps', label: 'Pharmacy Gaps', getTdClassName: gapTd(false), stopRowClickPropagation: true,
    renderCell: perGap((g, m, ctx) => (
      <Tooltip label={MEASURE_NAMES[g.code]} placement="bottom">
        <button type="button" className={styles.gapBadgeButton} onClick={() => ctx.openGap(g.code)} aria-label={`Open ${g.code} (${MEASURE_NAMES[g.code]})`}>
          <Badge size="md" label={g.code} />
        </button>
      </Tooltip>
    ), viewMoreButton),
  },
  {
    key: 'drugs', label: 'Drugs', getTdClassName: gapTd(false),
    renderCell: perGap((g) => <DrugsCount meds={g.medications || []} />),
  },
  {
    key: 'gapStatus', label: 'Gap Status', getTdClassName: gapTd(false), stopRowClickPropagation: true,
    // The status badge alone. The team can only move a gap between Open and
    // In Progress (a menu); every other status is Fold's.
    renderCell: perGap((g, m, ctx) => (
      canSetGapStatus(g.status) ? (
        <button
          type="button"
          className={styles.badgeBtn}
          onClick={(e) => ctx.openGapStatusMenu(g.code, e.currentTarget.getBoundingClientRect())}
          aria-haspopup="menu"
          aria-label={`Change ${g.code} status`}
        >
          <Badge size="sm" {...gapBadge(g.status)} trailingIconElement={<DownChevronIcon size={12} color="currentColor" />} />
        </button>
      ) : (
        <Badge size="sm" {...gapBadge(g.status)} />
      )
    )),
  },
  {
    key: 'nextFillDue', label: 'Next Fill Due', sortKey: 'nextFillDueSort', sortType: 'date', getTdClassName: gapTd(false),
    renderCell: perGap((g) => <NextFillDueValue gap={g} />),
  },
  {
    key: 'claimRecon', label: 'Claim Reconciliation', sortKey: 'reconRank', sortType: 'number', getTdClassName: gapTd(false), stopRowClickPropagation: true,
    renderCell: perGap((g, m, ctx) => (g.recon
      ? <ClaimReconCell recon={g.recon} followUpTask={g.claimFollowUpTask} onOpenClaims={() => ctx.openClaimRework(g.code, g.recon.medId)} />
      : <Dash />)),
  },
  {
    key: 'startDate', label: 'Start Date', getTdClassName: gapTd(false),
    renderCell: perGap((g) => (g.startDate ? <span className={styles.dateText}>{g.startDate}</span> : <Dash />)),
  },
  {
    key: 'pdc', label: 'PDC', sortKey: 'pdc', sortType: 'number', getTdClassName: gapTd(false),
    stopRowClickPropagation: true,
    // Click the pencil to set it by hand (Use calculated goes back).
    renderCell: perGap((g, m) => <EditablePdc gap={g} memberId={m.id} />),
  },
  {
    key: 'failDate', label: 'Fail Date (Absolute)', sortKey: 'failDateSort', sortType: 'date', getTdClassName: gapTd(false),
    renderCell: perGap((g) => <FailDateValue gap={g} />),
  },
  // A gap with no days left to save is not worth working: the column says how
  // many are left, or that the gap is already Safe or Not savable.
  {
    key: 'daysToSave', label: 'Days to Save', sortKey: 'daysToSaveSort', sortType: 'number', getTdClassName: gapTd(false),
    renderCell: perGap((g) => <DaysToSaveValue gap={g} />),
  },
  // Proposed (Richard), to confirm with Monique: hidden until then.
  {
    key: 'fillsRemaining', label: 'Fills to Stay Compliant', optional: true, getTdClassName: gapTd(false),
    renderCell: perGap((g) => {
      const n = fillsToStayCompliant(g);
      return n == null ? <Dash /> : (
        <Tooltip label="Fills of the usual days supply still needed to reach 80% PDC by Dec 31" placement="bottom">
          <span className={styles.cellText}>{n === 0 ? 'None needed' : `${n} fill${n === 1 ? '' : 's'}`}</span>
        </Tooltip>
      );
    }),
  },
  // Proposed in the status model spec; hidden until confirmed.
  {
    key: 'savability', label: 'Savability', optional: true, getTdClassName: gapTd(false),
    renderCell: perGap((g) => <SavabilityBadge value={g.savability} />),
  },
  {
    key: 'daysMissed', label: 'Days Missed', optional: true, getTdClassName: gapTd(false),
    renderCell: perGap((g) => numberOrDash(g.daysMissed)),
  },
  {
    key: 'noRefillPdc', label: 'Projected PDC (No Refill)', optional: true, getTdClassName: gapTd(false),
    renderCell: perGap((g) => numberOrDash(g.noRefillPdc, '%')),
  },
  {
    key: 'mpr', label: 'MPR', optional: true, getTdClassName: gapTd(false),
    renderCell: perGap((g) => numberOrDash(g.mpr, '%')),
  },
  {
    key: 'attempts', label: 'Attempts', optional: true, getTdClassName: gapTd(false),
    renderCell: perGap((g) => numberOrDash(g.attempts)),
  },
  {
    key: 'priorYear', label: 'Prior Year PDC', getTdClassName: gapTd(true),
    renderCell: perGap((g) => <PriorYearPdc years={g.priorYearPdc} nonCompliant={g.priorYearNonCompliant} year={PRIOR_YEAR} />),
  },
  {
    key: 'assignee', label: 'Assigned To', sortKey: 'assigneeName', sortType: 'alpha', stopRowClickPropagation: true,
    renderCell: (m, ctx) => (
      m.assigneeName ? (
        <AssigneeChange
          name={m.assigneeName}
          initials={m.assigneeInitials}
          showRole={false}
          users={ctx.eligibleUsers}
          onSelect={(u) => ctx.setPharmacyAssignee(m.id, u)}
          pickerTitle="Change assignee"
        />
      ) : (
        <AssigneeChange
          unassigned
          showRole={false}
          users={ctx.eligibleUsers}
          onSelect={(u) => ctx.setPharmacyAssignee(m.id, u)}
          pickerTitle="Assign coordinator"
        />
      )
    ),
  },
  {
    key: 'followUpDue', label: 'Follow-up Due', sortKey: 'followUpDueSort', sortType: 'date',
    renderCell: (m) => <DateWithDays date={m.followUpDue} alert={isOverdue(m.followUpDue)} />,
  },
  {
    key: 'progress', label: 'Progress', sortKey: 'progressRank', sortType: 'number',
    renderCell: (m) => <ProgressCell progress={m.progress} />,
  },
  {
    key: 'otherCareGaps', label: 'Open Care Gaps', sortKey: 'otherCareGapsCount', sortType: 'number', stopRowClickPropagation: true,
    renderCell: (m, ctx) => <OpenCareGaps gaps={m.otherCareGaps} onOpen={ctx.openCareGap} />,
  },
  {
    key: 'outreach', label: 'Outreach', sortKey: 'outreachSort', sortType: 'date',
    // The hover card's View All opens the drawer; the row must not open too.
    stopRowClickPropagation: true,
    renderCell: (m, ctx) => (
      <OutreachStatusCell
        outreach={m.outreach}
        recent={m.outreach?.recent}
        onViewAll={ctx.openOutreach}
      />
    ),
  },
  {
    key: 'leadNote', label: 'Internal Note',
    renderCell: (m) => (m.leadNote ? <span className={styles.leadNote}>{m.leadNote}</span> : <Dash />),
  },
  // Optional, hidden by default.
  {
    key: 'healthPlan', label: 'Health Plan / IPA', optional: true, sortKey: 'healthPlan', sortType: 'alpha',
    renderCell: (m) => (
      <span className={styles.stack}>
        <span className={styles.cellText}>{m.healthPlan || '-'}</span>
        <span className={styles.subText}>{m.ipa || ''}</span>
      </span>
    ),
  },
  { key: 'language', label: 'Language', optional: true, renderCell: (m) => <span className={styles.cellText}>{(m.language || 'en').toUpperCase()}</span> },
  { key: 'bookOfBusiness', label: 'Book of Business', optional: true, sortKey: 'bookOfBusiness', sortType: 'alpha', renderCell: (m) => <span className={styles.cellText}>{m.bookOfBusiness || '-'}</span> },
  { key: 'barrier', label: 'Barrier', optional: true, renderCell: (m) => (m.activeBarriers?.length ? <span className={styles.cellText}>{m.activeBarriers.join(', ')}</span> : <Dash />) },
  { key: 'daysInQueue', label: 'Days in Queue', optional: true, sortKey: 'daysInQueue', sortType: 'number', renderCell: (m) => <span className={styles.cellText}>{m.daysInQueue ?? '-'}</span> },
  {
    key: 'excluded', label: 'Excluded / Safe for Year', optional: true,
    renderCell: (m) => {
      const codes = (status) => m.gaps.filter(g => g.status.gap === status).map(g => g.code).join(', ');
      const excluded = codes('Excluded');
      const safe = codes('Met for Year');
      if (!excluded && !safe) return <Dash />;
      return (
        <span className={styles.stack}>
          {excluded && <Badge size="sm" label={`Excluded · ${excluded}`} />}
          {safe && <Badge size="sm" tone="info" label={`Safe for year · ${safe}`} />}
        </span>
      );
    },
  },
  { key: 'projectedStatus', label: 'Projected Status', optional: true, renderCell: (m) => (m.urgent?.projectedStatus ? <span className={styles.cellText}>{m.urgent.projectedStatus}</span> : <Dash />) },
  {
    key: 'drugInteraction', label: 'Drug Interaction', optional: true,
    renderCell: (m) => ((m.measures || []).some(x => x.drugInteraction)
      ? <Badge size="sm" tone="danger" icon="solar:danger-triangle-linear" label="Flagged" />
      : <Dash />),
  },
  {
    key: 'lastOutreach', label: 'Last Outreach', optional: true, sortKey: 'outreachSort', sortType: 'date',
    renderCell: (m) => (m.outreach ? (
      <span className={styles.stack}>
        <span className={styles.dateText}>{m.outreach.date}</span>
        <span className={styles.subText}>{[m.outreach.contact, m.outreach.outcome].filter(Boolean).join(': ')}</span>
      </span>
    ) : <Dash />),
  },
  {
    key: 'eligibility', label: 'Eligibility Status', optional: true,
    renderCell: (m) => (
      <span className={styles.stack}>
        <span className={`${styles.cellText} ${m.eligibilityStatus === 'Termed' ? styles.toneError : ''}`}>{m.eligibilityStatus || 'Active'}</span>
        {m.termDate && <span className={styles.subText}>{m.termDate}</span>}
      </span>
    ),
  },
];

export const PHARMACY_HIDDEN_BY_DEFAULT = PHARMACY_MIDDLE_COLUMNS.filter(c => c.optional).map(c => c.key);
