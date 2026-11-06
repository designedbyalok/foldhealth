import { useEffect, useMemo, useState } from 'react';
import { FilterChip } from '../../../components/FilterChip/FilterChip';
import { useAppStore } from '../../../store/useAppStore';
import { MEASURE_NAMES, MEASURE_ORDER } from '../../pharmacy-worklist/pharmacyWorklist.utils';
import { REPORT_PERIODS, dataQualityReport, outcomesReport, productivityReport, reportMembers } from '../../pharmacy-worklist/pharmacyReports';
import { BarList, KpiGrid, RowList, Section, SectionLoading } from './AnalyticsParts';
import styles from './PharmacyDashboard.module.css';

const pctText = (n) => (n == null ? '-' : `${n}%`);
const uniq = (list) => [...new Set(list.filter(Boolean))].toSorted();

const PROVIDER_ROWS = {
  primary: 'group',
  fields: [['members', 'Members'], ['gaps', 'Gaps'], [r => pctText(r.closureRate), 'Closure Rate'], [r => pctText(r.avgPdc), 'Avg PDC'], ['belowTarget', 'Below 80%'], ['failed', 'Failed for Year']],
};
const COORDINATOR_ROWS = {
  primary: 'coordinator',
  fields: [['outreaches', 'Outreaches'], ['reached', 'Attended'], [r => pctText(r.reachRate), 'Reach Rate'], ['locked', 'Locked Actions'], ['steps', 'Steps'], ['members', 'Members']],
};
const ISSUE_ROWS = {
  primary: 'member',
  secondary: r => [r.code, r.date, r.detail].filter(Boolean).join(' · '),
  status: r => (r.issue === 'Held for review' ? 'amber' : 'red'),
  statusLabel: (st, r) => r.issue,
};

/**
 * Pharmacy Adherence reports on the phone: the same worklist members and
 * report builders as PharmacyReportsView, with its Health Plan, IPA and
 * Measure filters. Outcomes are grouped by measure.
 */
export function PharmacyDashboard() {
  const members = useAppStore(s => s.pharmacyWorklistMembers);
  const loading = useAppStore(s => s.pharmacyWorklistLoading);
  const didFetch = useAppStore(s => s.pharmacyWorklistDidFetch);
  const fetchMembers = useAppStore(s => s.fetchPharmacyWorklistMembers);
  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const [healthPlans, setHealthPlans] = useState([]);
  const [ipas, setIpas] = useState([]);
  const [measures, setMeasures] = useState([]);
  const [period, setPeriod] = useState('Last 30 days');

  const options = useMemo(() => ({ healthPlans: uniq(members.map(m => m.healthPlan)), ipas: uniq(members.map(m => m.ipa)) }), [members]);
  const filtered = useMemo(() => {
    const plans = new Set(healthPlans);
    const ipaSet = new Set(ipas);
    return members.filter(m => (!plans.size || plans.has(m.healthPlan)) && (!ipaSet.size || ipaSet.has(m.ipa)));
  }, [members, healthPlans, ipas]);
  const enriched = useMemo(() => reportMembers(filtered, { measures }), [filtered, measures]);
  const outcomes = useMemo(() => outcomesReport(enriched, 'measure'), [enriched]);
  const providers = useMemo(() => outcomesReport(enriched, 'ipa'), [enriched]);
  const productivity = useMemo(() => productivityReport(filtered, period), [filtered, period]);
  const quality = useMemo(() => dataQualityReport(enriched), [enriched]);
  const cold = loading || (!didFetch && !members.length);
  const t = outcomes.total;

  return (
    <>
      <div className={styles.filters}>
        <FilterChip label="Health Plan" options={options.healthPlans} selected={healthPlans} onChange={setHealthPlans} />
        <FilterChip label="IPA" options={options.ipas} selected={ipas} onChange={setIpas} />
        <FilterChip label="Measure" options={MEASURE_ORDER} selected={measures} onChange={setMeasures} />
      </div>

      <Section title="Outcomes" sub="A gap closes only on a matched Part D claim. Projected fills show as Pending Claim until their claim arrives." plain>
        <KpiGrid loading={cold} count={4} items={[
          { label: 'Gaps Closed', value: t.closedTotal, sub: `${pctText(t.closureRate)} of ${t.gaps - t.excluded} counted gaps` },
          { label: 'Safe for Year', value: t.met, sub: 'Met for Year: PDC stays at or above 80%' },
          { label: 'Failed for Year', value: t.failed, sub: 'Past the absolute fail date' },
          { label: 'Claim Reversals', value: t.reversals, sub: 'Counted fills reversed this cycle' },
          { label: 'Rework Open', value: t.rework, sub: 'Reversed, not matched or non–Part D' },
        ]} />
      </Section>
      <Section title="Closure Rate by Measure" sub="Closed or Met for Year, of gaps not excluded">
        {cold ? <SectionLoading /> : (
          <BarList items={outcomes.rows.map(r => ({
            label: `${r.group} · ${MEASURE_NAMES[r.group] || r.group}`,
            value: `${r.closedTotal} of ${r.gaps - r.excluded} · ${pctText(r.closureRate)}`,
            pct: r.closureRate ?? 0,
          }))} />
        )}
      </Section>
      <Section title="Provider Groups" sub="One row per IPA">
        {cold ? <SectionLoading /> : <RowList rows={providers.rows} spec={PROVIDER_ROWS} />}
      </Section>

      <Section title="Productivity" sub={period} plain>
        <div className={styles.filters}>
          <FilterChip label="Period" options={REPORT_PERIODS} selected={[period]} onChange={(v) => setPeriod(v[0] || 'Last 30 days')} singleSelect noClear />
        </div>
        <KpiGrid loading={cold} items={[
          { label: 'Outreaches', value: productivity.totals.outreaches, sub: period },
          { label: 'Reach Rate', value: pctText(productivity.totals.reachRate), sub: `${productivity.totals.reached} attended` },
          { label: 'Locked Actions', value: productivity.totals.locked, sub: 'Verification calls, one per call' },
          { label: 'Steps Performed', value: productivity.totals.steps, sub: 'Answers logged on locked calls' },
        ]} />
      </Section>
      <Section title="Productivity by Coordinator">
        {cold ? <SectionLoading /> : <RowList rows={productivity.rows} spec={COORDINATOR_ROWS} />}
      </Section>

      <Section title="Data Quality" plain>
        <KpiGrid loading={cold} items={[
          { label: 'Claims Not Matched', value: quality.counts.notMatched, sub: 'Projected fill, no claim by window end' },
          { label: 'Non–Part D Claims', value: quality.counts.nonPartD, sub: 'Billed to other coverage, not counted' },
          { label: 'Rows Held for Review', value: quality.counts.heldForReview, sub: 'Days supply 0 or unlinked negatives' },
          { label: 'Total Issues', value: quality.rows.length, sub: 'Across the filtered members' },
        ]} />
      </Section>
      <Section title="Claim Feed Issues" sub="Newest first">
        {cold ? <SectionLoading /> : <RowList rows={quality.rows} spec={ISSUE_ROWS} />}
      </Section>
    </>
  );
}
