import { Badge } from '../../components/Badge/Badge';
import { Icon } from '../../components/Icon/Icon';
import { Tooltip } from '../../components/Tooltip/Tooltip';
import { HoverCard } from '../../components/HoverCard/HoverCard';
import { GAP_STATUS_TONE, MEASURE_NAMES, PROGRESS_TONE, RECON_TONE, URGENT_SUB_STATUSES, daysFromToday, isActiveGap, medLabel, pdcTone } from './pharmacyWorklist.utils';
import { useAppStore } from '../../store/useAppStore';
import { STATUS_BADGE_VARIANT } from '../hedis-worklist/HedisWorklistRow';
import styles from './PharmacyWorklistRow.module.css';

// The measure code (MAD / MAH / MAC) as a neutral chip with its full name on
// hover. One look for the code everywhere in the worklist and program.
export function MeasureCode({ code }) {
  return (
    <Tooltip label={MEASURE_NAMES[code] || code} placement="bottom">
      <span><Badge size="sm" label={code} /></span>
    </Tooltip>
  );
}

export function Dash() {
  return <span className={styles.mutedDash}>-</span>;
}

// The date itself stays neutral; only the countdown turns red, and only
// when the caller says it needs action.
export function DateWithDays({ date, alert = false }) {
  if (!date) return <Dash />;
  const days = daysFromToday(date);
  const rel = days == null ? '' : days < 0 ? `${-days}d overdue` : days === 0 ? 'Today' : `${days}d left`;
  return (
    <span className={styles.stack}>
      <span className={styles.dateText}>{date}</span>
      <span className={`${styles.subText} ${alert ? styles.toneError : ''}`}>{rel}</span>
    </span>
  );
}

// A value that needs explaining is explained (and underlined) on hover:
// `projected` (an estimate until a claim confirms it, never red) or `alert`
// (red: act on it). Anything else is the plain value.
function FlagValue({ className, tone, hint, children }) {
  if (!tone) return <span className={className}>{children}</span>;
  return (
    <Tooltip label={hint} placement="bottom" maxWidth={220}>
      <span className={`${className} ${tone === 'projected' ? styles.projected : styles.alert}`}>{children}</span>
    </Tooltip>
  );
}

// What a projected value rests on: the latest fill confirmed in Fold.
function projectedHint(medications) {
  const fill = (medications || [])
    .filter(d => d.status !== 'Discontinued' && d.recentFill)
    .map(d => ({ date: d.recentFill, how: d.recentFillSource?.outcome }))
    .sort((x, y) => new Date(y.date) - new Date(x.date))[0];
  if (!fill) return 'Projected from a fill confirmed in Fold, pending a matching claim';
  return `Projected from the fill confirmed on ${fill.date}${fill.how ? ` (${fill.how})` : ''}, pending a matching claim`;
}

// A date alone. Projected dates show their evidence; `alertHint` makes it red
// and says why.
export function DateOnly({ date, projected, medications, alertHint }) {
  if (!date) return <Dash />;
  if (projected) return <FlagValue className={styles.dateText} tone="projected" hint={projectedHint(medications)}>{date}</FlagValue>;
  return <FlagValue className={styles.dateText} tone={alertHint ? 'alert' : null} hint={alertHint}>{date}</FlagValue>;
}

const days = (n) => `${n} day${n === 1 ? '' : 's'}`;
const failDateHint = (d) => {
  if (d < 0) return `Passed ${days(-d)} ago: the member can no longer reach 80% PDC this year`;
  if (d === 0) return 'Today is the last day the member can still reach 80% PDC this year';
  return `In ${days(d)}: after this date the member can no longer reach 80% PDC this year`;
};

// "Overdue by N days" for a date in the past, else null.
function overdueHint(mdy) {
  const d = daysFromToday(mdy);
  return d != null && d < 0 ? `Overdue by ${days(-d)}` : null;
}

// A plain date, red with "Overdue by N days" when it has passed and `alert`.
export function DueDate({ date, alert = true }) {
  return <DateOnly date={date} alertHint={alert ? overdueHint(date) : null} />;
}

// A gap's fail date: red within 14 days on an open gap, saying why.
export function FailDateValue({ gap }) {
  const d = daysFromToday(gap.failDate);
  const alert = isActiveGap(gap.status) && d != null && d <= 14;
  return <DateOnly date={gap.failDate} projected={gap.failDateSource === 'Projected'} source={gap.failDateSource} medications={gap.medications} alertHint={alert ? failDateHint(d) : null} />;
}

// A gap's next fill due: red when overdue on an open gap.
// Next Fill Due, as HEDIS shows a due date: the date plain, and on an open
// gap a short line under it once the fill is due within a week (amber) or
// overdue (red). The line is the status, so the date itself stays neutral.
const DUE_SOON_DAYS = 7;
export function NextFillDueValue({ gap }) {
  if (!gap.nextFillDue) return <Dash />;
  const d = daysFromToday(gap.nextFillDue);
  const due = isActiveGap(gap.status) && d != null && d <= DUE_SOON_DAYS
    ? (d < 0 ? { label: `Overdue by ${-d}d`, overdue: true } : { label: d === 0 ? 'Due today' : `Due in ${d}d` })
    : null;
  return (
    <span className={styles.stack}>
      <span className={styles.dateText}>{gap.nextFillDue}</span>
      {due && <span className={`${styles.dueLine} ${due.overdue ? styles.dueOverdue : ''}`}>{due.label}</span>}
    </span>
  );
}

// A count with the full list in a hover card. `label` adds a noun ("3
// gaps"); without it the column header names what's counted.
function CountWithList({ count, label, children }) {
  if (!count) return <Dash />;
  return (
    <Tooltip label={<span className={styles.hoverList}>{children}</span>} placement="bottom" variant="light" maxWidth={320}>
      <span className={styles.countLink}>{count}{label ? ` ${label}${count === 1 ? '' : 's'}` : ''}</span>
    </Tooltip>
  );
}

// One gap's drug count; hover lists its drugs.
export function DrugsCount({ meds }) {
  return (
    <CountWithList count={meds.length}>
      {meds.map(d => (
        <span key={d.id} className={styles.hoverItem}>
          {medLabel(d)}{d.status === 'Discontinued' ? ' (discontinued)' : ''}
        </span>
      ))}
    </CountWithList>
  );
}

// A count of named things ("6 medications"); hover lists the names.
export function NamesCount({ names, label }) {
  return (
    <CountWithList count={names.length} label={label}>
      {names.map(n => <span key={n} className={styles.hoverItem}>{n}</span>)}
    </CountWithList>
  );
}

// Count of the member's open non-pharmacy care gaps. The hover card lists
// them in the Open ICDs popup's layout (header band, code and name, a status
// chip below); a click keeps it open. Each opens its Care Gap Details when
// the member has a HEDIS row.
export function OpenCareGaps({ gaps, onOpen }) {
  if (!gaps.length) return <Dash />;
  return (
    <HoverCard
      ariaLabel="Open care gaps"
      width={360}
      flush
      pinOnClick
      trigger={<span className={styles.countLink}>{gaps.length} gap{gaps.length === 1 ? '' : 's'}</span>}
    >
      {(close) => (
        <span className={styles.gapCard}>
          <span className={styles.gapCardHeader}>Open Care Gaps ({gaps.length}):</span>
          <span className={styles.gapCardList}>
            {gaps.map(g => {
              const body = (
                <>
                  <span className={styles.gapCardName}><b>{g.code}</b> - {g.name || g.code}</span>
                  {/* Same status colors as the HEDIS worklist. Badge centers
                      itself in a flex column; its own span keeps it left. */}
                  {g.status && <span><Badge size="sm" tone={STATUS_BADGE_VARIANT[g.status] || 'neutral'} label={g.status} /></span>}
                </>
              );
              return g.hedisMemberId ? (
                <button
                  key={g.code}
                  type="button"
                  className={`${styles.gapCardRow} ${styles.gapCardLink}`}
                  onClick={() => { close(); onOpen?.(g.hedisMemberId, g.code); }}
                >
                  {body}
                </button>
              ) : (
                <span key={g.code} className={styles.gapCardRow}>{body}</span>
              );
            })}
          </span>
        </span>
      )}
    </HoverCard>
  );
}


export function ProgressCell({ progress }) {
  return (
    <span className={styles.stack}>
      <Badge size="sm" tone={PROGRESS_TONE[progress.label]} label={progress.label} />
      <span className={styles.subText}>{progress.closed} of {progress.total} gap{progress.total === 1 ? '' : 's'} closed</span>
    </span>
  );
}

// Separator between parts of one line (year • PDC, source • Below 80%).
export function Sep() {
  return <span className={styles.sep} aria-hidden="true">•</span>;
}

// PDC of the gap: the number alone. Projected (a fill confirmed in Fold, no
// claim yet) is underlined with its evidence on hover and never red; a
// confirmed PDC below 80% on an open gap is red and underlined, so the
// threshold is said on hover and not only in color.
export function PdcValue({ pdc, open, source, medications }) {
  if (pdc == null) return <span className={styles.subText}>Not sent</span>;
  if (source === 'Projected') {
    return <FlagValue className={styles.pdc} tone="projected" hint={projectedHint(medications)}>{pdc}%</FlagValue>;
  }
  const below = open && pdcTone(pdc) === 'error';
  return <FlagValue className={styles.pdc} tone={below ? 'alert' : null} hint="Below the 80% PDC target">{pdc}%</FlagValue>;
}

// Where the gap's latest fill stands against the claim feed. The badge opens
// that drug's claim history; the days left in the claim window, or a rework
// task once created, show on the line below.
export function ClaimReconCell({ recon, showCode, followUpTask, onOpenClaims }) {
  const openTask = useAppStore(s => s.openTaskFromNotification);
  const windowLeft = recon.status === 'Awaiting claim' && recon.daysLeft != null
    ? (recon.daysLeft > 0 ? `${recon.daysLeft}d left` : 'Window ends today')
    : null;
  return (
    <span className={styles.stack}>
      <Tooltip label={recon.detail} placement="bottom">
        <button type="button" className={styles.badgeBtn} onClick={onOpenClaims} aria-label={`${recon.status}: open claim history`}>
          <Badge size="sm" tone={RECON_TONE[recon.status]} label={showCode ? `${recon.status} · ${recon.code}` : recon.status} />
        </button>
      </Tooltip>
      {windowLeft && <span className={styles.subText}>{windowLeft}</span>}
      {recon.rework && followUpTask?.taskId != null && (
        <button type="button" className={styles.reworkLink} onClick={() => openTask?.(followUpTask.taskId)}>Rework task open</button>
      )}
    </span>
  );
}

// Prior-year PDC per year when the plan sends it; otherwise the plan's
// compliance flag, with its year so both read the same way.
export function PriorYearPdc({ years, nonCompliant, year }) {
  if (!years?.length) {
    return (
      <span className={styles.cellText}>
        <span className={styles.subText}>{year}</span>
        <Sep />
        <span className={nonCompliant ? styles.toneError : ''}>{nonCompliant ? 'Non-compliant' : 'Compliant'}</span>
      </span>
    );
  }
  return (
    <span className={styles.stack}>
      {years.map(y => (
        <span key={y.year} className={styles.cellText}>
          <span className={styles.subText}>{y.year}</span>
          <Sep />
          <span className={pdcTone(y.pdc) === 'error' ? styles.toneError : ''}>{y.pdc}%</span>
        </span>
      ))}
    </span>
  );
}

// Sub-status line shown under a gap status (second line, like other programs).
export function SubStatus({ label, suffix }) {
  if (!label) return null;
  return (
    <span className={`${styles.subStatus} ${URGENT_SUB_STATUSES.has(label) ? styles.toneError : ''}`}>
      {label}{suffix ? <span className={styles.subSuffix}><Sep />{suffix}</span> : null}
    </span>
  );
}

// Gap status badge with its sub-status on the line below. Statuses Fold
// sets say why on hover.
export function GapStatus({ status, size = 'sm' }) {
  if (!status) return <Dash />;
  return (
    <span className={styles.stack}>
      <Tooltip label={status.label ? '' : status.detail} placement="bottom">
        <span><Badge size={size} tone={GAP_STATUS_TONE[status.gap]} label={status.gap} /></span>
      </Tooltip>
      <SubStatus label={status.label} />
    </span>
  );
}

const SAVABILITY_TONE = { Safe: 'success', Savable: 'primary', 'Not savable': 'danger' };
const SAVABILITY_HINT = {
  Safe: 'PDC stays at or above 80% to year end with no further fills',
  Savable: 'Allowable gap days remain: the gap can still reach 80%',
  'Not savable': 'No allowable gap days left: 80% can no longer be reached this year',
};
// Days to Save: a gap still being worked shows the gap days it has left
// (none left reads 0, in red; two weeks or less in amber); a gap that is
// already safe or lost shows that instead, since there is nothing to save.
export function DaysToSaveValue({ gap }) {
  if (gap.savability !== 'Savable') return <SavabilityBadge value={gap.savability} />;
  if (gap.allowableGapDays == null) return <Dash />;
  const days = Math.max(0, gap.allowableGapDays);
  const tone = days === 0 ? styles.daysToSaveOut : days <= 14 ? styles.daysToSaveSoon : '';
  return (
    <Tooltip label="Days the member can still go without medication and reach 80% PDC this year" placement="bottom">
      <span className={`${styles.daysToSave} ${tone}`}>{days} day{days === 1 ? '' : 's'}</span>
    </Tooltip>
  );
}

export function SavabilityBadge({ value }) {
  if (!value) return <Dash />;
  return (
    <Tooltip label={SAVABILITY_HINT[value]} placement="bottom">
      <span><Badge size="sm" tone={SAVABILITY_TONE[value]} label={value} /></span>
    </Tooltip>
  );
}
