import { claimsPdcNoRefill, daysMissed, gapMpr, pdcToDate } from './fillEvents';

const DAY_MS = 86_400_000;

// SUPD is out of scope for this worklist. Gaps read in this order (by code)
// everywhere they are listed.
export const MEASURE_ORDER = ['MAC', 'MAD', 'MAH'];

export const MEASURE_NAMES = {
  MAC: 'Medication Adherence for Cholesterol (Statins)',
  MAD: 'Medication Adherence for Diabetes',
  MAH: 'Medication Adherence for Hypertension (RAS antagonists)',
};

// A member's measures in MEASURE_ORDER, so lists that render them as stored
// (worklist rows, drawer, tabs) all read the same way.
export const sortMeasures = (measures) => (measures || [])
  .toSorted((a, b) => MEASURE_ORDER.indexOf(a.code) - MEASURE_ORDER.indexOf(b.code));

// PDC to act on: the team's override, else projected from a confirmed
// pickup, else today's PDC (the plan's as of its report date, moved by the
// days covered or missed since: pdcToDate), else the plan's, else ours.
const isPdc = (v) => v != null && v !== '' && Number.isFinite(Number(v));
export const effectivePdc = (x) => (isPdc(x?.pdcManual) ? Number(x.pdcManual) : x?.pdcProjected ?? (x ? pdcToDate(x) : null) ?? x?.pdc ?? x?.calcPdc ?? null);
// Fail date to act on: projected from a fill confirmed in Fold, otherwise the
// plan's. Either way it is the absolute fail date.
// The plan's own status for the gap (Astrana file / API): Open or Closed.
// Fold's Gap Status tracks the steps in between. Until the file sends a
// status, its own adherence flags close the gap; otherwise it is open.
export const PLAN_STATUSES = ['Open', 'Closed'];
export function planGapStatus(x) {
  if (PLAN_STATUSES.includes(x?.planStatus)) return x.planStatus;
  return x?.projectedStatus === 'Already adherent' || x?.oneFillToInvincible ? 'Closed' : 'Open';
}
export const effectiveFailDate = (x) => x?.failDateProjected ?? x?.failDate ?? null;

// Where each headline number comes from: the plan file, our calculation from
// claims, or projected from a fill confirmed in Fold (pending its claim).
export const pdcSource = (x) => (isPdc(x.pdcManual) ? 'Manual' : x.pdcProjected != null ? 'Projected' : pdcToDate(x) != null ? 'To date' : x.pdc != null ? 'Plan' : x.calcPdc != null ? 'Calculated' : null);
export const failDateSource = (x) => (x.failDateProjected != null ? 'Projected' : x.failDate ? 'Plan' : null);
// Next Fill Due is the plan's until Fold recalculates it from fills
// (recomputeMeasure marks `nextFillDueCalculated`).
export const nextFillDueSource = (x) => (!x.nextFillDue ? null : x.pdcProjected != null ? 'Projected' : x.nextFillDueCalculated ? 'Calculated' : 'Plan');
export const FAIL_DATE_HINT = 'Absolute fail date: after this day the member can no longer reach 80% PDC this year';

export const medLabel = (d) => `${d.name} ${d.strength} ${d.unit}`;
export const measureDrugs = (x) => (x.medications || []).map(medLabel).join(', ');

export function parseMdy(s) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s || '');
  return m ? Date.UTC(+m[3], +m[1] - 1, +m[2]) : null;
}

const pad2 = (n) => String(n).padStart(2, '0');
const fmtUtc = (t) => {
  const d = new Date(t);
  return `${pad2(d.getUTCMonth() + 1)}/${pad2(d.getUTCDate())}/${d.getUTCFullYear()}`;
};
export const todayMdy = () => fmtUtc(todayUtc());
export const addDaysMdy = (mdy, days) => fmtUtc(parseMdy(mdy) + days * DAY_MS);

function todayUtc() {
  const d = new Date();
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
}

export function daysFromToday(mdy) {
  const t = parseMdy(mdy);
  return t == null ? null : Math.round((t - todayUtc()) / DAY_MS);
}

// A gap still needs work only while it is Open or In Progress; every other
// status is `done` for the team. Only these drive a row's headline
// numbers and red risk: a picked-up MAD must not paint the row red while MAH
// is the real gap.
export const isActiveGap = (st) => !!st && !st.done;

// Earliest fail date wins; lower PDC breaks ties. Open gaps compete first,
// then non-excluded measures, then everything.
export function mostUrgentMeasure(measures, statuses) {
  const list = measures || [];
  const open = statuses ? list.filter(x => isActiveGap(statuses[x.code])) : [];
  const live = list.filter(x => !x.excluded);
  const pool = open.length ? open : live.length ? live : list;
  return pool.toSorted((a, b) => {
    const fa = parseMdy(effectiveFailDate(a)) ?? Infinity;
    const fb = parseMdy(effectiveFailDate(b)) ?? Infinity;
    if (fa !== fb) return fa - fb;
    return (effectivePdc(a) ?? 101) - (effectivePdc(b) ?? 101);
  })[0] || null;
}

// Priority is a Fold rule, not editable (spec: "P1 = PDC below 80% and a
// refill overdue", confirmed for now). Over the member's open gaps: P1 when
// one gap has both, P2 when a gap has either, P3 otherwise. `reason` says why,
// for the P column's tooltip.
export function memberPriority(openGaps) {
  let p2 = null;
  for (const x of openGaps) {
    const pdc = effectivePdc(x);
    const due = daysFromToday(x.nextFillDue);
    const low = pdc != null && pdc < 80;
    const overdue = due != null && due < 0;
    if (low && overdue) return { priority: 'P1', reason: `${x.code}: PDC ${pdc}% and refill ${-due}d overdue` };
    if (!p2 && (low || overdue)) p2 = { priority: 'P2', reason: low ? `${x.code}: PDC ${pdc}% is below 80%` : `${x.code}: refill ${-due}d overdue` };
  }
  return p2 || { priority: 'P3', reason: 'PDC 80% or higher and no refill overdue' };
}

// Color is reserved for "act now": PDC under the 80% measure threshold and
// fills already overdue. Everything else stays neutral.
export function pdcTone(pdc) {
  return pdc != null && pdc < 80 ? 'error' : null;
}

export function fillDueTone(mdy) {
  const days = daysFromToday(mdy);
  return days != null && days < 0 ? 'error' : null;
}

// ── Claims ──
// Each medication's `refills` holds two kinds of row: plan claims (no
// `source`) and fills confirmed in Fold (`source` set: a pickup confirmed by
// call or verification, a refill approval, or a date entered by hand).
//
// Claim rows carry: claimId, claimStatus (Paid | Pending | Reversed |
// Cancelled | Deleted | Rejected), txnType (Original | Reversal | Rebill),
// claimSeq, claimGroup (the original claim a rebill or reversal belongs to),
// reversesClaimId, reversalDate, processedDate, coverage ('Part D' when
// absent), bin, pcn, rxGroup. Status values, transaction type, sequence,
// BIN/PCN and the negative-value rule are pending Astrana's confirmation.

const VOID_CLAIM_STATUSES = new Set(['Reversed', 'Cancelled', 'Deleted', 'Rejected']);
const hasNegative = (c) => c.qty < 0 || c.daysSupply < 0;
// A negative quantity or days supply linked to a fill is a reversal (pending
// Astrana); unlinked, or with days supply 0, the row is held for review.
const isReversalRow = (c) => c.txnType === 'Reversal' || (hasNegative(c) && !!c.reversesClaimId);
const isInvalidRow = (c) => c.daysSupply === 0 || (hasNegative(c) && !isReversalRow(c));
export const isPartD = (c) => !c.coverage || c.coverage === 'Part D';

// Every claim row with what it means for PDC (`effect`):
//   Counts      the current, paid, Part D version of the fill
//   Reversal    a reversal transaction (it removes another claim)
//   Reversed / Cancelled / Deleted / Rejected   voided; not a fill
//   Superseded  an older version of a resubmitted claim
//   Not Part D  billed to other coverage
//   Pending     not adjudicated yet
//   Invalid     held for review (see isInvalidRow)
// Only the highest claim sequence in a group is current.
export function annotateClaims(refills) {
  const claims = (refills || []).filter(r => !r.source);
  const reversedOn = new Map(claims.filter(isReversalRow).filter(c => c.reversesClaimId).map(c => [c.reversesClaimId, c.reversalDate || c.date]));
  // A reversal belongs to the group of the claim it reverses.
  const groupById = new Map(claims.filter(c => !isReversalRow(c)).map(c => [c.claimId, c.claimGroup || c.claimId || c.date]));
  const claimGroupOf = (c) => c.claimGroup || (isReversalRow(c) && groupById.get(c.reversesClaimId)) || c.claimId || c.date;
  const currentSeq = new Map();
  for (const c of claims) {
    if (isReversalRow(c)) continue;
    const g = claimGroupOf(c);
    currentSeq.set(g, Math.max(currentSeq.get(g) ?? -Infinity, c.claimSeq ?? 1));
  }
  return claims.map(c => {
    const reversal = isReversalRow(c);
    const seq = c.claimSeq ?? 1;
    const current = !reversal && seq === currentSeq.get(claimGroupOf(c));
    const effect = reversal ? 'Reversal'
      : isInvalidRow(c) ? 'Invalid'
      : VOID_CLAIM_STATUSES.has(c.claimStatus) ? c.claimStatus
      : reversedOn.has(c.claimId) ? 'Reversed'
      : !current ? 'Superseded'
      : !isPartD(c) ? 'Not Part D'
      : c.claimStatus === 'Pending' ? 'Pending'
      : 'Counts';
    return {
      ...c,
      txnType: c.txnType || (reversal ? 'Reversal' : seq > 1 ? 'Rebill' : 'Original'),
      claimSeq: seq,
      claimGroup: claimGroupOf(c),
      current,
      voided: VOID_CLAIM_STATUSES.has(effect),
      counts: effect === 'Counts',
      reversedOn: reversedOn.get(c.claimId) || c.reversalDate || null,
      effect,
    };
  });
}

// Claim record status (Claim history), by effect. Feed values the spec does
// not name yet (Pending, Cancelled) show as sent.
const CLAIM_RECORD_STATUS = {
  Counts: 'Paid, current version',
  Superseded: 'Replaced by a newer version',
  Reversed: 'Reversed',
  Reversal: 'Reversed',
  Deleted: 'Deleted',
  Rejected: 'Rejected',
  'Not Part D': 'Non–Part D',
  Invalid: 'Invalid',
};
export const claimRecordStatus = (c) => CLAIM_RECORD_STATUS[c.effect] || c.effect;

// ── Claim match for fills confirmed in Fold ──
// A confirmed fill is the same fill as a claim dated 7 days before to 3 days
// after it. The plan's claim feed lags, so a fill waits for its claim for the
// plan's match window before it is flagged.
export const SAME_FILL_BEFORE_DAYS = 7;
export const SAME_FILL_AFTER_DAYS = 3;

// Timers, per plan once Astrana shares each feed's frequency and lag:
//   matchWindowDays    how long a projected fill waits for its claim
//   reversalWatchDays  a matched claim can still be reversed: about 14 days
//                      on the shelf before return to stock, plus feed lag
//   refillDueDays      the outreach window before Next Fill Due (open
//                      question: 14 days to the fill, or 7 to supply end)
export const CLAIM_MATCH_WINDOW_DAYS = 14;
const RETURN_TO_STOCK_DAYS = 14;
const DEFAULT_FEED_LAG_DAYS = 7;
const REFILL_DUE_DAYS = 14;
// Stand-ins until pharmacy_plan_timers loads (and for the dev mock).
const DEFAULT_PLAN_TIMERS = { 'Humana Gold Plus': { matchWindowDays: 10 }, 'SCAN Classic': { matchWindowDays: 21 } };
let PLAN_TIMERS = DEFAULT_PLAN_TIMERS;
// No rows puts the stand-ins back.
export function setPlanTimers(rows) {
  if (!rows?.length) { PLAN_TIMERS = DEFAULT_PLAN_TIMERS; return; }
  PLAN_TIMERS = Object.fromEntries(rows.map(r => [r.health_plan, {
    matchWindowDays: r.match_window_days,
    feedLagDays: r.feed_lag_days,
    returnToStockDays: r.return_to_stock_days,
    refillDueDays: r.refill_due_days,
  }]));
}
export function planTimers(plan) {
  const p = PLAN_TIMERS[plan] || {};
  const feedLagDays = p.feedLagDays ?? DEFAULT_FEED_LAG_DAYS;
  return {
    matchWindowDays: p.matchWindowDays ?? CLAIM_MATCH_WINDOW_DAYS,
    feedLagDays,
    reversalWatchDays: (p.returnToStockDays ?? RETURN_TO_STOCK_DAYS) + feedLagDays,
    refillDueDays: p.refillDueDays ?? REFILL_DUE_DAYS,
  };
}
export const claimWindowDays = (plan) => planTimers(plan).matchWindowDays;

export const confirmedFills = (d) => (d.refills || []).filter(r => r.source);
export const latestConfirmedFill = (d) => confirmedFills(d)
  .reduce((best, r) => (!best || parseMdy(r.date) > parseMdy(best.date) ? r : best), null);

// One confirmed fill against the medication's claims:
//   kind  verified | voided | other-coverage | pending | no-claim
//   status  Verified | Pending claim | Not matched
export function matchFill(fill, claims, plan) {
  const at = parseMdy(fill.date);
  const near = claims.filter(c => c.effect !== 'Reversal' && c.effect !== 'Superseded' && (() => {
    const t = parseMdy(c.date);
    return t != null && t >= at - SAME_FILL_BEFORE_DAYS * DAY_MS && t <= at + SAME_FILL_AFTER_DAYS * DAY_MS;
  })());
  const verified = near.find(c => c.counts);
  if (verified) return { kind: 'verified', status: 'Verified', claim: verified, detail: `Matched by claim ${verified.claimId || verified.date}` };
  const voided = near.find(c => c.voided);
  if (voided) return { kind: 'voided', status: 'Not matched', claim: voided, detail: `Claim ${voided.claimId || voided.date} ${voided.effect.toLowerCase()}` };
  const other = near.find(c => c.effect === 'Not Part D');
  if (other) return { kind: 'other-coverage', status: 'Not matched', claim: other, detail: `Billed to ${other.coverage}, not Part D` };
  const window = claimWindowDays(plan);
  const waited = -daysFromToday(fill.date);
  if (waited <= window) return { kind: 'pending', status: 'Pending claim', detail: `Waiting for the claim until ${addDaysMdy(fill.date, window)}` };
  return { kind: 'no-claim', status: 'Not matched', detail: `No claim ${waited} days after the fill (window ${window} days)` };
}

const activeMeds = (x) => (x.medications || []).filter(d => d.status !== 'Discontinued');
const FILL_KIND_ORDER = ['voided', 'no-claim', 'other-coverage', 'pending', 'verified'];

// Where one drug's latest fill stands against the claim feed. The latest fill
// is the newest projected fill (matched as in matchFill), unless the feed has
// a newer claim of its own: a claim with no fill logged in Fold is checked
// directly. `date` is the fill date; null when there is nothing to check.
export function drugFillEvent(d, plan) {
  const claims = annotateClaims(d.refills);
  const fill = latestConfirmedFill(d);
  const newest = claims.filter(c => !['Reversal', 'Superseded', 'Invalid', 'Pending'].includes(c.effect))
    .toSorted((a, b) => parseMdy(b.date) - parseMdy(a.date))[0];
  if (newest && (!fill || parseMdy(newest.date) > parseMdy(fill.date) + SAME_FILL_AFTER_DAYS * DAY_MS)) {
    const kind = newest.counts ? 'verified' : newest.voided ? 'voided' : 'other-coverage';
    const detail = kind === 'verified' ? `Claim ${newest.claimId || newest.date} paid`
      : kind === 'voided' ? `Claim ${newest.claimId || newest.date} ${newest.effect.toLowerCase()}`
      : `Billed to ${newest.coverage}, not Part D`;
    return { medId: d.id, medName: d.name, date: newest.date, fill: null, claim: newest, kind, detail };
  }
  return fill ? { medId: d.id, medName: d.name, date: fill.date, fill, ...matchFill(fill, claims, plan) } : null;
}

// Fill events of the gap's active drugs; the gap takes the worst.
export function gapFillEvents(x, plan) {
  const items = activeMeds(x).map(d => drugFillEvent(d, plan)).filter(Boolean);
  if (!items.length) return null;
  const worst = items.toSorted((a, b) => FILL_KIND_ORDER.indexOf(a.kind) - FILL_KIND_ORDER.indexOf(b.kind))[0];
  return { worst, items };
}

// ── Claim reconciliation (worklist column) ──
// Most severe first; a member's row shows its worst measure. Blank when
// there is nothing to reconcile: a claim with no projected fill behind it
// only shows here when it went wrong.
export const RECON_STATUSES = ['Claim reversed', 'Claim not matched', 'Non–Part D claim', 'Awaiting claim', 'Claim matched'];
// These open a rework task.
export const REWORK_RECON_STATUSES = new Set(['Claim reversed', 'Claim not matched', 'Non–Part D claim']);

export const RECON_TONE = {
  'Claim reversed': 'error',
  'Claim not matched': 'error',
  'Non–Part D claim': 'error',
  'Awaiting claim': 'grey',
  'Claim matched': 'success',
};

const RECON_BY_KIND = {
  voided: 'Claim reversed',
  'no-claim': 'Claim not matched',
  'other-coverage': 'Non–Part D claim',
  pending: 'Awaiting claim',
  verified: 'Claim matched',
};

export function reconcileMeasure(x, plan) {
  const worst = gapFillEvents(x, plan)?.worst;
  if (!worst || (worst.kind === 'verified' && !worst.fill)) return null;
  const status = RECON_BY_KIND[worst.kind];
  return {
    status,
    rework: REWORK_RECON_STATUSES.has(status),
    // Days left in the claim match window while a fill awaits its claim.
    daysLeft: worst.kind === 'pending' ? planTimers(plan).matchWindowDays + daysFromToday(worst.date) : null,
    detail: `${worst.medName} fill ${worst.date} · ${worst.detail}`,
    medId: worst.medId,
    fillDate: worst.date,
  };
}

function worstRecon(measures, plan) {
  let worst = null;
  for (const x of measures || []) {
    const r = reconcileMeasure(x, plan);
    if (r && (!worst || RECON_STATUSES.indexOf(r.status) < RECON_STATUSES.indexOf(worst.status))) {
      worst = { ...r, code: x.code };
    }
  }
  return worst;
}

// ── Gap status ──
// One per pharmacy gap; it runs once per fill cycle.
//   Reopened         back to work with no work logged since: a claim was
//                    reversed (`reopenReason` Claim reversal, the alarm) or a
//                    closed gap's next fill came due (New fill due)
//   Open             a fill is due this cycle and no work is logged
//   In Progress      review or outreach started, or a fill needs rework
//   Pending Claim    a fill was logged in Fold (manual date or confirmed
//                    pickup); waiting for a matching Part D claim
//   Closed           a matched Part D claim covers this cycle, until Next
//                    Fill Due enters the outreach window
//   Met for Year     PDC stays at or above 80% through year end with no
//                    further fills, or the plan says so
//   Failed for Year  past the absolute fail date
//   Excluded         excluded by the plan
// Only a matched claim closes a gap; a fill logged in Fold is projected.
// The team can set only Open and In Progress, and only while the gap is in
// one of them: every other status is Fold's.
export const GAP_STATUSES = ['Reopened', 'Open', 'In Progress', 'Pending Claim', 'Closed', 'Met for Year', 'Failed for Year', 'Excluded'];
// Held in the background, never on the worklist or in its filters: First
// Fill until a second fill on a different date, Not Eligible once termed.
export const BACKGROUND_GAP_STATUSES = ['First Fill', 'Not Eligible'];
export const MANUAL_GAP_STATUSES = ['Open', 'In Progress'];
// Gaps the team can set by hand (Reopened is still theirs to take).
export const canSetGapStatus = (st) => MANUAL_GAP_STATUSES.includes(st?.gap) || st?.gap === 'Reopened';
export const GAP_STATUS_TONE = {
  'Reopened': 'danger',
  'Open': 'white',
  'In Progress': 'primary',
  'Pending Claim': 'warning',
  'Closed': 'success',
  'Met for Year': 'info',
  'Failed for Year': 'error',
  'Excluded': 'grey',
  'First Fill': 'disabled',
  'Not Eligible': 'disabled',
};
// A claim-reversal reopen is the alarm: a solid red badge, the row marked
// and pinned to the top. A new fill due reopen is the next cycle, in amber.
export const REOPEN_REASONS = { reversal: 'Claim reversal', newFill: 'New fill due' };
export const isReversalReopen = (st) => st?.gap === 'Reopened' && st.reopenReason === REOPEN_REASONS.reversal;
// A gap status badge's look. A reopen reads "Reopened" either way; its
// color carries the reason (the Next Fill Due and Claim columns say why).
export function gapBadge(st) {
  if (st?.gap !== 'Reopened') return { tone: GAP_STATUS_TONE[st?.gap] || 'neutral', label: st?.gap };
  const reversal = isReversalReopen(st);
  return { tone: reversal ? 'danger' : 'warning', variant: reversal ? 'solid' : undefined, label: 'Reopened' };
}
const CLOSED_GAPS = new Set(['Closed', 'Met for Year']);
// Gaps that leave the Progress count.
const UNCOUNTED_GAPS = new Set(['Excluded', ...BACKGROUND_GAP_STATUSES]);

// Sub-status: the signal line under the gap status. One per gap, the
// highest on this list that is true.
export const SUB_STATUSES = [
  'Claim reversed', 'Claim not matched – rework', 'Non–Part D claim', 'Refill overdue', 'Low PDC',
  'Refill due soon', 'Awaiting claim', 'Reversal watch', 'On track',
];
// The only sub-statuses that call for action; the rest read as plain text.
// A claim reversal reopen's reason line reads the same way.
export const URGENT_SUB_STATUSES = new Set([...SUB_STATUSES.slice(0, 5), REOPEN_REASONS.reversal]);

// Latest pharmacy-verification answers for one measure, if any.
export function latestVerification(callHistory, code) {
  const entry = (callHistory || []).find(e => e.kind === 'pharmacy-verification' && (e.measures || []).includes(code));
  return entry ? { entry, items: (entry.items || []).filter(i => i.measure === code) } : null;
}

function subStatus(x, worst, timers) {
  const rework = (label, detail) => ({ label, detail, medId: worst.medId });
  if (worst?.kind === 'voided') return rework('Claim reversed', `${worst.medName} ${worst.detail}; fill removed from PDC, refill due again`);
  if (worst?.kind === 'no-claim') return rework('Claim not matched – rework', `${worst.medName} fill ${worst.date} · ${worst.detail}`);
  if (worst?.kind === 'other-coverage') return rework('Non–Part D claim', `${worst.medName} fill ${worst.date} · ${worst.detail}`);
  const due = daysFromToday(x.nextFillDue);
  if (due != null && due < 0) return { label: 'Refill overdue', detail: `Next fill ${-due}d overdue` };
  const pdc = effectivePdc(x);
  if (pdc != null && pdc < 80) return { label: 'Low PDC', detail: `${x.pdcProjected != null ? 'Projected PDC' : 'PDC'} ${pdc}% is below 80%` };
  if (due != null && due <= timers.refillDueDays) return { label: 'Refill due soon', detail: `Next fill due ${x.nextFillDue} (${due === 0 ? 'today' : `in ${due}d`})` };
  if (worst?.kind === 'pending') return { label: 'Awaiting claim', detail: `${worst.medName} fill ${worst.date} · ${worst.detail}` };
  if (worst?.kind === 'verified' && -daysFromToday(worst.date) <= timers.reversalWatchDays) {
    return { label: 'Reversal watch', detail: `${worst.detail}; can still be reversed until ${addDaysMdy(worst.date, timers.reversalWatchDays)}` };
  }
  return { label: 'On track', detail: x.nextFillDue ? `Next fill due ${x.nextFillDue}` : 'No fill date on file' };
}

// The fill cycle starts at the gap's latest fill, or at `since` (a reversal
// reopens the cycle).
export const cycleStart = (x, since) => Math.max(...(x.medications || []).map(d => parseMdy(d.lastFill) || 0), parseMdy(since) || 0, 0);

// An open gap still to confirm with the pharmacy: no locked verification
// call covers it since its latest fill (a new fill cycle asks again).
export function needsVerification(x, member) {
  if (!isActiveGap(measureStatus(x, member))) return false;
  const from = cycleStart(x);
  return !(member.callHistory || []).some(e => e.kind === 'pharmacy-verification'
    && (e.measures || []).includes(x.code) && (parseMdy(e.date) || 0) >= from);
}

// Outreach attempts logged on the gap this fill cycle.
export function attemptsThisCycle(x, member) {
  const from = cycleStart(x);
  return (member.callHistory || []).filter(e => (e.measures || []).includes(x.code) && (parseMdy(e.date) || 0) >= from).length;
}

// A measure counts as worked once outreach, a verification call or a barrier
// log touched it this fill cycle.
function workedThisCycle(x, member, since) {
  const from = cycleStart(x, since);
  const touched = (date) => (parseMdy(date) || 0) >= from;
  return (member.callHistory || []).some(e => (e.measures || []).includes(x.code) && touched(e.date))
    || (member.interventionLog || []).some(e => e.measures?.[x.code] && touched(e.date))
    || !!x.pendingPickupSince;
}

// A fill logged in Fold can move the fail date out; when its projection
// already reaches 80% there is no fail date to pass.
function pastFailDate(x) {
  if (x.pdcProjected != null && x.failDateProjected == null) return false;
  const d = daysFromToday(effectiveFailDate(x));
  return d != null && d < 0;
}

// Year-level statuses, set by Fold from any status.
function yearLevelStatus(x, member) {
  if (x.notEligible || member?.eligibilityStatus === 'Termed') return { gap: 'Not Eligible', detail: 'Termed, disenrolled or deceased; the PDC period ends on that date' };
  if (x.excluded) return { gap: 'Excluded', detail: `Excluded from the measure by the plan${x.exclusionType ? ` (${x.exclusionType})` : ''}` };
  if (x.firstFill) return { gap: 'First Fill', detail: 'One fill in the class; enters the measure with a second fill on a different date' };
  if (x.projectedStatus === 'Already adherent') return { gap: 'Met for Year', detail: 'Plan file: already adherent for the year' };
  if (x.oneFillToInvincible) return { gap: 'Met for Year', detail: 'Plan file: one more fill guarantees 80% PDC for the year' };
  // Plan data first: our claims math never declares a gap safe while the
  // plan's own PDC is below 80%.
  if ((x.pdc == null || x.pdc >= 80) && (claimsPdcNoRefill(x) ?? 0) >= 80) {
    return { gap: 'Met for Year', detail: 'PDC stays at or above 80% through year end with no further fills' };
  }
  if (pastFailDate(x)) return { gap: 'Failed for Year', detail: `Past the absolute fail date ${effectiveFailDate(x)}; 80% can no longer be reached this year` };
  return null;
}

// Gap status + sub-status for one measure (see GAP_STATUSES). `done` means
// the team owes nothing on the gap right now. A status set by hand
// (`statusManual`, Open or In Progress) wins only over Open or In Progress.
export function measureStatus(x, member) {
  const auto = autoMeasureStatus(x, member);
  if (!x.statusManual || !MANUAL_GAP_STATUSES.includes(x.status) || !canSetGapStatus(auto)) return auto;
  // A status set by hand covers the cycle it was set in: a fill, claim or
  // reversal dated after it starts a new story, and Fold's status returns.
  if (x.statusManualSince && latestFillEventAt(x) > parseMdy(x.statusManualSince)) return auto;
  return { ...auto, gap: x.status, manual: true };
}

// The newest fill, claim or reversal date on any of the gap's drugs.
function latestFillEventAt(x) {
  let latest = 0;
  for (const d of x.medications || []) {
    for (const r of d.refills || []) latest = Math.max(latest, parseMdy(r.date) || 0, parseMdy(r.reversalDate) || 0);
  }
  return latest;
}

function autoMeasureStatus(x, member) {
  // A reopened gap is work owed, like Open and In Progress.
  const status = (gap, sub) => ({ gap, ...sub, done: gap !== 'Reopened' && !MANUAL_GAP_STATUSES.includes(gap) });
  const year = yearLevelStatus(x, member);
  if (year) return status(year.gap, { label: null, detail: year.detail });

  const timers = planTimers(member?.healthPlan);
  const worst = gapFillEvents(x, member?.healthPlan)?.worst;
  const sub = subStatus(x, worst, timers);
  const worked = (since) => !!member && workedThisCycle(x, member, since);
  // Reopened until the team logs work on it, then In Progress like any gap.
  const reopened = (reason, since) => (worked(since) ? status('In Progress', sub) : status('Reopened', { ...sub, reopenReason: reason }));
  if (worst?.kind === 'voided') return reopened(REOPEN_REASONS.reversal, worst.claim.reversedOn);
  if (worst?.kind === 'no-claim' || worst?.kind === 'other-coverage') return status('In Progress', sub);
  if (worst?.kind === 'pending') return status('Pending Claim', sub);
  const due = daysFromToday(x.nextFillDue);
  if (worst?.kind === 'verified' && due != null && due > timers.refillDueDays) return status('Closed', sub);
  // A matched claim closed the last cycle, so this one is a reopen.
  if (worst?.kind === 'verified') return reopened(REOPEN_REASONS.newFill);
  return status(worked() ? 'In Progress' : 'Open', sub);
}

// ── Medication status (per drug, Medication Review) ──
export const MEDICATION_STATUSES = [
  'On track', 'Refill due', 'Refill overdue', 'Fill projected', 'Filled – claim matched', 'Fill reversed',
  'Not matched – rework', 'Discontinued or switched',
];

export function medicationStatus(d, plan) {
  if (d.status === 'Discontinued') return 'Discontinued or switched';
  const ev = drugFillEvent(d, plan);
  if (ev?.kind === 'voided') return 'Fill reversed';
  if (ev?.kind === 'no-claim' || ev?.kind === 'other-coverage') return 'Not matched – rework';
  if (ev?.kind === 'pending') return 'Fill projected';
  const due = daysFromToday(d.nextFill);
  if (due != null && due < 0) return 'Refill overdue';
  if (due != null && due <= planTimers(plan).refillDueDays) return 'Refill due';
  if (ev?.kind === 'verified' && ev.fill) return 'Filled – claim matched';
  return 'On track';
}

// ── Savability (per gap) ── so the team never works a gap that already
// failed. Rules are a proposal for Monique to confirm.
export const SAVABILITY = ['Safe', 'Savable', 'Not savable'];

// Days the member can still go without medication and reach 80%: from
// today, or from when the current supply runs out, to the fail date.
// Null when a fill logged in Fold already reaches 80% (no fail date left).
export function allowableGapDays(x) {
  if (x.pdcProjected != null && x.failDateProjected == null) return null;
  const fail = parseMdy(effectiveFailDate(x));
  if (fail == null) return null;
  return Math.round((fail - Math.max(todayUtc(), parseMdy(x.nextFillDue) ?? -Infinity)) / DAY_MS);
}

// Follows the gap status, so a gap is never Not savable while Fold still
// works it: Safe is Met for Year, Not savable is Failed for Year.
export function savability(status) {
  if (status.gap === 'Met for Year') return 'Safe';
  if (status.gap === 'Failed for Year') return 'Not savable';
  if (UNCOUNTED_GAPS.has(status.gap)) return null;
  return 'Savable';
}

// Gap start date: from the plan file when it sends one, otherwise the first
// fill of the measure year.
export function gapStartDate(x) {
  if (x.startDate) return x.startDate;
  const year = (x.failDate || '').slice(6);
  const fills = (x.medications || []).flatMap(d => (d.refills || []).map(r => r.date)).filter(d => d?.endsWith(year));
  return fills.toSorted((a, b) => parseMdy(a) - parseMdy(b))[0] || null;
}

// At-a-glance progress across the member's pharmacy gaps. Work under way,
// with or without some gaps closed, is In progress (amber).
export const PROGRESS_LEVELS = ['Not started', 'In progress', 'Complete'];
export const PROGRESS_TONE = { Complete: 'success', 'In progress': 'warning', 'Not started': 'white' };
export function gapProgress(statuses) {
  const gaps = Object.values(statuses).map(s => s.gap).filter(g => !UNCOUNTED_GAPS.has(g));
  // Pending Claim is still waiting for its claim, so it is not closed.
  const closed = gaps.filter(g => CLOSED_GAPS.has(g)).length;
  const label = !gaps.length || closed === gaps.length ? 'Complete'
    : closed > 0 || gaps.some(g => g !== 'Open' && g !== 'Reopened') ? 'In progress'
    : 'Not started';
  return { label, closed, total: gaps.length };
}

// Sources send priority as P1–P3 or High/Medium/Low; the worklist always
// keeps P1–P3 so rows compare at a glance. A priority picked on the worklist
// wins, then the source's, then one derived from the focus measure.
export const PRIORITY_LEVELS = [
  { value: 'P1', icon: 'high', label: 'High' },
  { value: 'P2', icon: 'medium', label: 'Medium' },
  { value: 'P3', icon: 'low', label: 'Low' },
];
const PRIORITY_RANKS = { P1: 0, P2: 1, P3: 2 };
export const priorityRank = (p) => PRIORITY_RANKS[p] ?? 3;

// Fail-date countdown buckets for the Days Left filter (the column is gone).
export function daysLeftBucket(mdy) {
  const d = daysFromToday(mdy);
  if (d == null) return 'No fail date';
  if (d < 0) return 'Past fail date';
  if (d <= 7) return '0–7 days';
  if (d <= 14) return '8–14 days';
  if (d <= 30) return '15–30 days';
  return 'Over 30 days';
}

// Member-level gap status rolled up from its measures: the one that most
// needs the team, worked gaps first.
const ROLLUP_ORDER = ['Reopened', 'In Progress', 'Open', 'Pending Claim', 'Closed', 'Met for Year', 'Failed for Year', 'Excluded', ...BACKGROUND_GAP_STATUSES];
export function rollupGapStatus(statuses) {
  const gaps = new Set(Object.values(statuses).map(s => s.gap));
  return ROLLUP_ORDER.find(g => gaps.has(g)) || 'Open';
}

// One call-history entry's key in the Outreach feed: its id, or (older rows
// saved without one) a key built from what it says. `logIds` holds the feed
// ids of the per-measure lines it was saved from.
export const callKey = (c) => c.id || `ph-${c.date}-${c.time || ''}-${c.by || ''}-${c.outcome || ''}`;
export const callMatchesLog = (c, logId) => callKey(c) === logId || (c.logIds || []).includes(logId);

// ── Outreach ── same shape the other worklists render: last attempt's
// result + date, and one dot per attempt (latest three, oldest first).
// "13:05" (some entries) reads as "01:05 PM", like the rest.
const clockTime = (t) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '').trim());
  if (!m) return t || null;
  const h = Number(m[1]);
  return `${String(h % 12 || 12).padStart(2, '0')}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
};

const ordinal = (n) => {
  const t = n % 100;
  return `${n}${t >= 11 && t <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th')}`;
};

// An outreach's result as a tone: a successful call is green, a note amber,
// anything else (unsuccessful, follow-up) red.
export const outreachTone = (result) => (result === 'success' ? 'success' : result === 'note' ? 'warning' : 'error');
export const OUTREACH_TONE_COLOR = { success: 'var(--status-success)', warning: 'var(--status-warning)', error: 'var(--status-error)' };
const OUTREACH_STATUS = { success: 'Attended', warning: 'Note', error: 'Failed' };

export function outreachSummary(callHistory) {
  const list = callHistory || [];
  if (!list.length) return null;
  const last = list[0];
  const tone = outreachTone(last.result);
  const recent = list.slice(0, 3).reverse().map(c => outreachTone(c.result));
  while (recent.length < 3) recent.push('none');
  return {
    status: OUTREACH_STATUS[tone],
    tone,
    failed: tone === 'error',
    date: last.date,
    contact: last.contact,
    outcome: last.outcome,
    dots: recent,
    attempts: list.length,
    // The last three attempts for the cell's hover card, numbered from the
    // first ever (newest is the Nth outreach). Outcomes stored with a dash
    // separator show as "Side effects: Experienced".
    recent: list.slice(0, 3).map((c, i) => ({
      key: `${c.id || c.date}-${i}`,
      date: String(c.date || '').slice(0, 5),
      time: clockTime(c.time),
      by: c.by || null,
      title: `${c.title || 'Outgoing Call'} (${ordinal(list.length - i)} Outreach)`,
      outcome: c.outcome?.replaceAll(' \u2014 ', ': ') || null,
      tone: outreachTone(c.result),
    })),
  };
}

// Fold ID as the cross-worklist key: '#' stripped, trimmed, lowercased.
export const normMemberId = (v) => String(v ?? '').replace(/^#/, '').trim().toLowerCase();

// `hedisGapsByMember` (normMemberId -> [{ code, name, status }]) supplies the
// member's live HEDIS gaps for Other Care Gaps; the stored `otherCareGaps`
// (plan file) is only the fallback for members with no HEDIS record.
// A gap's newest Barriers & Interventions record, skipping entries that only
// set a result (results aren't part of barrier tracking any more).
export function latestBarrierRecord(log, code) {
  for (const e of log || []) {
    const r = e.measures?.[code];
    if (r && (r.barriers?.length || r.interventions?.length || !r.result)) return { entry: e, rec: r };
  }
  return null;
}

// Barriers still standing for the member: each gap's newest record (its own
// and its drugs' lists) plus each active drug's Reason for Non-Adherence. A
// resolved barrier has left all of these, so it no longer counts.
export function gapActiveBarriers(m, x) {
  const out = new Set();
  const rec = latestBarrierRecord(m.interventionLog, x.code)?.rec;
  (rec?.barriers || []).forEach(b => out.add(b));
  (rec?.medications || []).forEach(d => d.barriers.forEach(b => out.add(b)));
  x.medications.forEach(d => { if (d.status !== 'Discontinued' && d.nonAdherenceReason) out.add(d.nonAdherenceReason); });
  return [...out];
}

export function activeBarriers(m) {
  return [...new Set((m.measures || []).flatMap(x => gapActiveBarriers(m, x)))];
}

export function enrichPharmacyMember(m, { hedisGapsByMember } = {}) {
  const statuses = Object.fromEntries((m.measures || []).map(x => [x.code, measureStatus(x, m)]));
  // First Fill and Not Eligible gaps stay off the worklist, and out of the
  // row's numbers.
  const shown = (m.measures || []).filter(x => !BACKGROUND_GAP_STATUSES.includes(statuses[x.code].gap));
  const measureCodes = MEASURE_ORDER.filter(c => shown.some(x => x.code === c));
  // One focus measure drives priority, PDC, dates and the sub-status, so the
  // row never mixes numbers from different measures.
  const urgent = mostUrgentMeasure(shown, statuses);
  const urgentOpen = isActiveGap(statuses[urgent?.code]);
  const recon = worstRecon(shown, m.healthPlan);
  const outreach = outreachSummary(m.callHistory);
  const { priority, reason: priorityReason } = memberPriority(shown.filter(x => isActiveGap(statuses[x.code])));
  const progress = gapProgress(statuses);
  // Open Care Gaps: the member's non-pharmacy gaps still being worked.
  const otherCareGaps = (hedisGapsByMember?.get(normMemberId(m.memberId || m.id)) ?? m.otherCareGaps ?? [])
    .filter(g => g.status !== 'Completed' && !String(g.status || '').startsWith('Closed'));
  const gaps = measureCodes.map(code => {
    const x = m.measures.find(y => y.code === code);
    return {
      ...x,
      medications: x.medications || [],
      pdc: effectivePdc(x),
      pdcSource: pdcSource(x),
      failDatePlan: x.failDate,
      failDate: effectiveFailDate(x),
      failDateSource: failDateSource(x),
      nextFillDueSource: nextFillDueSource(x),
      startDate: gapStartDate(x),
      status: statuses[code],
      savability: savability(statuses[code]),
      allowableGapDays: allowableGapDays(x),
      daysMissed: daysMissed(x),
      noRefillPdc: claimsPdcNoRefill(x),
      mpr: gapMpr(x),
      attempts: attemptsThisCycle(x, m),
      recon: reconcileMeasure(x, m.healthPlan),
      planStatus: planGapStatus(x),
    };
  });
  return {
    ...m,
    urgent,
    urgentOpen,
    measureCodes,
    gaps,
    progress,
    otherCareGaps,
    otherCareGapsCount: otherCareGaps.length,
    priority,
    priorityReason,
    priorityRank: priorityRank(priority),
    pdc: effectivePdc(urgent),
    failDate: effectiveFailDate(urgent),
    failDateSort: parseMdy(effectiveFailDate(urgent)),
    nextFillDue: urgent?.nextFillDue ?? null,
    nextFillDueSort: parseMdy(urgent?.nextFillDue),
    // Days to Save: the fewest gap days left on a gap that can still be saved,
    // so sorting puts the closest-to-failing work first.
    // A claim reversal reopened a gap: the row is marked and sits on top.
    reopenedByReversal: gaps.some(g => isReversalReopen(g.status)),
    daysToSaveSort: (() => {
      const left = gaps.filter(g => g.savability === 'Savable' && g.allowableGapDays != null).map(g => g.allowableGapDays);
      return left.length ? Math.min(...left) : null;
    })(),
    priorYearNonCompliant: (m.measures || []).some(x => x.priorYearNonCompliant),
    recon,
    reconStatuses: [...new Set(shown.map(x => reconcileMeasure(x, m.healthPlan)?.status).filter(Boolean))],
    reconRank: recon ? RECON_STATUSES.indexOf(recon.status) : RECON_STATUSES.length,
    outreach,
    outreachSort: parseMdy(outreach?.date),
    measureStatuses: statuses,
    progressRank: PROGRESS_LEVELS.indexOf(progress.label),
    // Status is set per gap now; the member's is always the roll-up (an old
    // member-level override has no UI left to clear it).
    status: rollupGapStatus(statuses),
    subStatus: urgent ? { ...statuses[urgent.code], code: urgent.code } : null,
    followUpDueSort: parseMdy(m.followUpDue),
    activeBarriers: activeBarriers(m),
  };
}

// ── Snapshot: prescribers and pharmacies from the member's medications ──
// Every prescriber named for the member: the gap report's (member and drug)
// and the claims', merged by name. Phone and fax come from whichever record
// has them; `drugs` are the member's drugs each one prescribed.
export function prescribersOf(member) {
  const byName = new Map();
  const add = (p, drug) => {
    if (!p?.name) return;
    const cur = byName.get(p.name) || { name: p.name, drugs: [] };
    for (const k of ['phone', 'fax', 'npi', 'address', 'city', 'state', 'zip']) if (!cur[k] && p[k]) cur[k] = p[k];
    if (drug && !cur.drugs.includes(drug)) cur.drugs.push(drug);
    byName.set(p.name, cur);
  };
  add(member?.prescriber);
  for (const x of member?.measures || []) {
    for (const d of x.medications || []) {
      add(d.prescriber, medLabel(d));
      for (const r of d.refills || []) if (r.prescriber) add({ name: r.prescriber, address: r.prescriberAddress }, medLabel(d));
    }
  }
  return [...byName.values()];
}

// Every pharmacy in the fill history, newest first, then any the gap report
// names with no fill. Contact details come from the member's and the
// medications' pharmacy records; fills give the count and last date.
export function pharmaciesUsed(member) {
  const contacts = new Map();
  for (const p of [member?.pharmacy, ...(member?.measures || []).flatMap(x => (x.medications || []).map(d => d.pharmacy))]) {
    if (p?.name && !contacts.has(p.name)) contacts.set(p.name, p);
  }
  const used = new Map();
  for (const x of member?.measures || []) {
    for (const d of x.medications || []) {
      for (const r of d.refills || []) {
        if (!r.pharmacy) continue;
        const cur = used.get(r.pharmacy) || { ...(contacts.get(r.pharmacy) || { name: r.pharmacy }), fills: 0, lastFill: null };
        cur.fills += 1;
        if (!cur.lastFill || parseMdy(r.date) > parseMdy(cur.lastFill)) cur.lastFill = r.date;
        used.set(r.pharmacy, cur);
      }
    }
  }
  // Pharmacies the gap report names with no fill on record still list, last.
  for (const [name, p] of contacts) if (!used.has(name)) used.set(name, { ...p, fills: 0, lastFill: null });
  return [...used.values()].toSorted((a, b) => (parseMdy(b.lastFill) ?? -Infinity) - (parseMdy(a.lastFill) ?? -Infinity));
}

const claimKey = (c) => `${c.claimId}|${c.claimSeq ?? 1}|${c.date}`;

// A drug's fills: claims that count, and fills confirmed in Fold. Reversals,
// voided and other-coverage lines are claims, not fills (Claim History keeps
// them). The count is how many times the drug was filled (Refill History).
export function medFills(med) {
  const counted = new Set(annotateClaims(med?.refills).filter(c => c.counts).map(claimKey));
  return (med?.refills || []).filter(r => r.source || counted.has(claimKey(r)));
}
