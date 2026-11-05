import { useMemo } from 'react';
import { Badge } from '../../../components/Badge/Badge';
import { DashboardCard } from '../../../components/DashboardCard/DashboardCard';
import { Icon } from '../../../components/Icon/Icon';
import {
  FAIL_DATE_HINT, gapBadge, MEASURE_NAMES, MEASURE_ORDER, isActiveGap, addDaysMdy, daysFromToday, effectiveFailDate, fillDueTone, measureStatus, parseMdy, pdcTone, reconcileMeasure,
} from '../pharmacyWorklist.utils';
import { MeasureCode, SubStatus } from '../PharmacyCells';
import { usePharmacyProgramMember } from './usePharmacyProgramMember';
import styles from './PharmacyGapClosureStep.module.css';

const TONE_CLASS = { error: styles.toneError };

function Fact({ label, children, tone }) {
  return (
    <div className={styles.fact}>
      <span className={styles.factLabel}>{label}</span>
      <span className={`${styles.factValue} ${TONE_CLASS[tone] || ''}`}>{children ?? '-'}</span>
    </div>
  );
}

const latestDate = (dates) => dates.filter(Boolean).reduce((max, d) => (!max || parseMdy(d) > parseMdy(max) ? d : max), null);

// Recent Fill, per active drug. Read-only here, like every closure field: it
// comes from a confirmed pickup (outreach or verification) or is entered in
// Medication Review, and stays projected until its claim matches.
function RecentFill({ x }) {
  const active = x.medications.filter(d => d.status !== 'Discontinued');
  const hintOf = (d) => (!d.recentFill ? 'Set by a confirmed pickup or in Medication Review'
    : d.recentFillSource?.manual ? `Entered ${d.recentFillSource.date} in Medication Review`
    : d.recentFillSource?.outcome ? `From ${d.recentFillSource.outcome.split(' · ').pop()}`
    : null);
  return (
    <div className={`${styles.fact} ${styles.recentFills}`}>
      <span className={styles.factLabel}>Recent Fill Date</span>
      {active.map(d => (
        <div key={d.id} className={styles.recentFillRow}>
          {active.length > 1 && <span className={styles.factValue}>{d.name} {d.strength} {d.unit}</span>}
          <span className={styles.factValue}>{d.recentFill || '-'}</span>
          {hintOf(d) && <span className={styles.factHint}>{hintOf(d)}</span>}
        </div>
      ))}
    </div>
  );
}

// Each pickup-confirmed verification is one closure cycle for the measure;
// it reopens when that fill's supply runs out (or earlier, on a reversal).
function closureCycles(member, x) {
  const supply = Math.max(0, ...x.medications.map(d => d.daysSupply || 0));
  const cycles = (member.callHistory || [])
    .filter(e => e.kind === 'pharmacy-verification' && (e.items || []).some(i => i.measure === x.code && i.pickedUp))
    .map(e => ({ closed: e.date, reopens: supply ? addDaysMdy(e.date, supply) : null, by: e.by }));
  // A pickup recorded before Fold verification (plan file / earlier call).
  if (x.pickupConfirmed && !cycles.some(c => c.closed === x.pickupConfirmed)) {
    cycles.push({ closed: x.pickupConfirmed, reopens: supply ? addDaysMdy(x.pickupConfirmed, supply) : null, by: null });
  }
  return cycles;
}

// Gap Closure / Outcome step of the Pharmacy program. Closure is per measure
// and repeats every fill, so the open/closed flag matters less than where the
// member sits in the current fill cycle: PDC, next fill and fail date.
export function PharmacyGapClosureStep() {
  const member = usePharmacyProgramMember();
  const measures = useMemo(() => (member?.measures || [])
    .toSorted((a, b) => MEASURE_ORDER.indexOf(a.code) - MEASURE_ORDER.indexOf(b.code)), [member]);

  if (!member) {
    return (
      <div className={styles.empty}>
        <Icon name="solar:pills-linear" size={40} color="var(--neutral-200)" />
        <p>No MAC, MAD or MAH measures on file for this member.</p>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.banner}>
        <Icon name="solar:refresh-circle-linear" size={16} color="var(--status-info)" />
        <span>Closure repeats every fill. A confirmed pickup or a fill date entered in Medication Review makes the gap Pending Claim, but only as a projection: the gap closes when a matching Part D claim arrives, and is flagged for rework if none matches. It reopens when the next fill comes due or the claim reverses.</span>
      </div>

      {measures.map(x => {
        const st = measureStatus(x, member);
        // A fill confirmed in Fold is only projected; the plan sees it once
        // the claim lands, and its report lags 1–4 weeks.
        const planBehind = st.gap === 'Pending Claim';
        const recon = reconcileMeasure(x, member.healthPlan);
        const cycles = closureCycles(member, x);
        const failDate = effectiveFailDate(x);
        const failIn = daysFromToday(failDate);
        // Red only for an open gap's risk; a closed gap's numbers are history.
        const open = isActiveGap(st);
        const risk = (tone) => (open ? tone : null);
        return (
          <DashboardCard
            key={x.code}
            title={<span className={styles.measureTitle}><MeasureCode code={x.code} />{MEASURE_NAMES[x.code]}</span>}
            actions={<Badge size="sm" {...gapBadge(st)} />}
          >
            <div className={styles.body}>
            <div className={styles.detail}><SubStatus label={st.label} /><span>{st.detail}</span></div>

            <div className={styles.facts}>
              <Fact label="PDC (Plan)" tone={risk(pdcTone(x.pdc))}>{x.pdc == null ? 'Not sent' : `${x.pdc}%`}</Fact>
              <Fact label="PDC (Claims)" tone={risk(pdcTone(x.calcPdc))}>{x.calcPdc == null ? null : `${x.calcPdc}%`}</Fact>
              {x.pdcProjected != null && <Fact label="PDC (Projected, with recent fill)" tone={risk(pdcTone(x.pdcProjected))}>{`${x.pdcProjected}%`}</Fact>}
              <Fact label="Next Fill Due" tone={risk(fillDueTone(x.nextFillDue))}>{x.nextFillDue}</Fact>
              <Fact label={x.failDateProjected ? 'Fail Date (Absolute, Projected)' : 'Fail Date (Absolute, Plan)'} tone={risk(failIn != null && failIn <= 14 ? 'error' : null)}>
                <span title={FAIL_DATE_HINT}>{failDate ? `${failDate}${failIn != null ? ` · ${failIn}d` : ''}` : null}</span>
              </Fact>
              <Fact label="Last Fill Date">{latestDate(x.medications.filter(d => d.status !== 'Discontinued').map(d => d.lastFill))}</Fact>
              <RecentFill x={x} />
              <Fact label="Allowable Days Left">{x.daysLeft}</Fact>
              <Fact label="Pickup Confirmed">{x.pickupConfirmed}</Fact>
              <Fact label="Claim Match" tone={recon?.rework ? 'error' : null}>
                {recon?.status ?? null}
              </Fact>
            </div>

            <div className={styles.signals}>
              <span className={styles.signalsLabel}>Plan Signals</span>
              {x.projectedStatus && <Badge size="sm" label={x.projectedStatus} />}
              {x.oneFillToInvincible && <Badge size="sm" label="1 fill left" />}
              {x.excluded && <Badge size="sm" label="Excluded" />}
              {x.priorYearNonCompliant && <Badge size="sm" label="Prior-year non-compliant" />}
              {!x.projectedStatus && !x.oneFillToInvincible && !x.excluded && !x.priorYearNonCompliant && <span className={styles.muted}>None reported</span>}
            </div>

            {planBehind && (
              <div className={styles.note}>
                <Icon name="solar:danger-triangle-linear" size={14} color="currentColor" />
                <span>Fill confirmed in Fold, but no paid Part D claim has matched it yet. The PDC and dates here are projected, and the plan's gap report may still show this measure open (it lags 1–4 weeks).</span>
              </div>
            )}

            <div className={styles.cycles}>
              <span className={styles.signalsLabel}>Pickup History</span>
              {cycles.length === 0
                ? <span className={styles.muted}>No confirmed pickups yet.</span>
                : cycles.map((c, i) => (
                  <div key={`${c.closed}-${i}`} className={styles.cycle}>
                    <Icon name="solar:check-circle-linear" size={14} color="var(--neutral-300)" />
                    <span>Pickup confirmed {c.closed}{c.by ? ` by ${c.by}` : ''}{c.reopens ? ` · supply runs to ${c.reopens}` : ''}</span>
                  </div>
                ))}
            </div>
            </div>
          </DashboardCard>
        );
      })}
    </div>
  );
}
