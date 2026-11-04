import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../../../store/useAppStore';
import { Badge } from '../../../../components/Badge/Badge';
import { FilterChip } from '../../../../components/FilterChip/FilterChip';
import { Tabs } from '../../../../components/Tabs/Tabs';
import { Card, EmptyState, KpiCard, KpiSkeleton, ProgressBar, TableSkeleton } from '../shared';
import { MEASURE_NAMES, MEASURE_ORDER } from '../../../pharmacy-worklist/pharmacyWorklist.utils';
import {
  OUTCOME_GROUP_LABELS, REPORT_PERIODS, dataQualityReport, outcomesReport, productivityReport, reportMembers,
} from '../../../pharmacy-worklist/pharmacyReports';
import s from '../../AnalyticsLayout.module.css';
import local from './PharmacyReportsView.module.css';

const TABS = [
  { key: 'outcomes', label: 'Outcomes' },
  { key: 'providers', label: 'Provider Groups' },
  { key: 'productivity', label: 'Productivity' },
  { key: 'quality', label: 'Data Quality' },
];
const GROUP_BY_OPTIONS = Object.values(OUTCOME_GROUP_LABELS);
const GROUP_BY_KEY = Object.fromEntries(Object.entries(OUTCOME_GROUP_LABELS).map(([k, v]) => [v, k]));
const ISSUE_TONE = { 'Claim not matched': 'danger', 'Non–Part D claim': 'danger', 'Held for review': 'warning' };

const pctText = (n) => (n == null ? '-' : `${n}%`);
const uniq = (list) => [...new Set(list.filter(Boolean))].toSorted();

function Kpis({ items }) {
  return (
    <div className={`${s.kpiGrid} ${items.length === 5 ? s.cols5 : s.cols4}`}>
      {items.map(k => <KpiCard key={k.label} {...k} />)}
    </div>
  );
}

// Gap outcomes by measure, health plan or IPA. Closed counts Closed and Met
// for Year; Excluded gaps leave the closure rate.
function OutcomesTab({ report, groupLabel }) {
  const { rows, total } = report;
  const counted = total.gaps - total.excluded;
  return (
    <>
      <Kpis items={[
        { label: 'Gaps Closed', value: total.closedTotal, sub: `${pctText(total.closureRate)} of ${counted} counted gaps` },
        { label: 'Safe for Year', value: total.met, sub: 'Met for Year: PDC stays at or above 80%' },
        { label: 'Failed for Year', value: total.failed, sub: 'Past the absolute fail date' },
        { label: 'Claim Reversals', value: total.reversals, sub: 'Counted fills reversed this cycle' },
        { label: 'Rework Open', value: total.rework, sub: 'Reversed, not matched or non–Part D' },
      ]} />
      <Card title={`Closure Rate by ${groupLabel}`} sub="Closed or Met for Year, of gaps not excluded">
        {rows.length ? (
          <div className={local.bars}>
            {rows.map(r => (
              <ProgressBar
                key={r.group}
                label={groupLabel === 'Measure' ? `${r.group} · ${MEASURE_NAMES[r.group] || r.group}` : r.group}
                value={`${r.closedTotal} of ${r.gaps - r.excluded} · ${pctText(r.closureRate)}`}
                pct={r.closureRate ?? 0}
              />
            ))}
          </div>
        ) : <EmptyState message="No pharmacy gaps match these filters" icon="solar:pill-linear" />}
      </Card>
      <Card title={`Gap Outcomes by ${groupLabel}`} flush>
        <div className={s.tblWrap}>
          <table className={s.tbl}>
            <thead>
              <tr>
                <th>{groupLabel}</th><th className="r">Members</th><th className="r">Gaps</th><th className="r">Closed</th>
                <th className="r">Met for Year</th><th className="r">Pending Claim</th><th className="r">Open / In Progress</th>
                <th className="r">Failed for Year</th><th className="r">Excluded</th><th className="r">Reversals</th>
                <th className="r">Rework</th><th className="r">Closure Rate</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? [...rows, { ...total, group: 'Total' }].map(r => (
                <tr key={r.group} className={r.group === 'Total' ? local.totalRow : ''}>
                  <td className={local.groupCell}>{r.group}</td>
                  <td className="r">{r.members}</td><td className="r">{r.gaps}</td><td className="r">{r.closed}</td>
                  <td className="r">{r.met}</td><td className="r">{r.pending}</td><td className="r">{r.open}</td>
                  <td className={`r ${r.failed ? local.alert : ''}`}>{r.failed}</td><td className="r">{r.excluded}</td>
                  <td className="r">{r.reversals}</td><td className="r">{r.rework}</td><td className="r">{pctText(r.closureRate)}</td>
                </tr>
              )) : <EmptyState message="No pharmacy gaps match these filters" icon="solar:pill-linear" colSpan={12} />}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

// Per provider group (IPA), as Richard sends to each group today.
function ProvidersTab({ report }) {
  return (
    <Card title="Provider Group Report" sub="One row per IPA" flush>
      <div className={s.tblWrap}>
        <table className={s.tbl}>
          <thead>
            <tr>
              <th>Provider Group</th><th className="r">Members</th><th className="r">Gaps</th><th className="r">Closure Rate</th>
              <th className="r">Avg PDC</th><th className="r">Below 80%</th><th className="r">Failed for Year</th>
              <th className="r">Reversals</th><th className="r">Rework</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.length ? report.rows.map(r => (
              <tr key={r.group}>
                <td className={local.groupCell}>{r.group}</td>
                <td className="r">{r.members}</td><td className="r">{r.gaps}</td><td className="r">{pctText(r.closureRate)}</td>
                <td className={`r ${r.avgPdc != null && r.avgPdc < 80 ? local.alert : ''}`}>{pctText(r.avgPdc)}</td>
                <td className="r">{r.belowTarget}</td><td className={`r ${r.failed ? local.alert : ''}`}>{r.failed}</td>
                <td className="r">{r.reversals}</td><td className="r">{r.rework}</td>
              </tr>
            )) : <EmptyState message="No provider groups match these filters" icon="solar:buildings-2-linear" colSpan={9} />}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ProductivityTab({ report, period }) {
  const { rows, totals } = report;
  return (
    <>
      <Kpis items={[
        { label: 'Outreaches', value: totals.outreaches, sub: period },
        { label: 'Reach Rate', value: pctText(totals.reachRate), sub: `${totals.reached} attended` },
        { label: 'Locked Actions', value: totals.locked, sub: 'Verification calls, one per call' },
        { label: 'Steps Performed', value: totals.steps, sub: 'Answers logged on locked calls' },
      ]} />
      <Card title="Productivity by Coordinator" sub={period} flush>
        <div className={s.tblWrap}>
          <table className={s.tbl}>
            <thead>
              <tr>
                <th>Coordinator</th><th className="r">Outreaches</th><th className="r">Attended</th><th className="r">Reach Rate</th>
                <th className="r">Locked Actions</th><th className="r">Steps Performed</th><th className="r">Members Worked</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? rows.map(r => (
                <tr key={r.coordinator}>
                  <td className={local.groupCell}>{r.coordinator}</td>
                  <td className="r">{r.outreaches}</td><td className="r">{r.reached}</td><td className="r">{pctText(r.reachRate)}</td>
                  <td className="r">{r.locked}</td><td className="r">{r.steps}</td><td className="r">{r.members}</td>
                </tr>
              )) : <EmptyState message={`No outreach logged in the ${period.toLowerCase()}`} icon="solar:phone-linear" colSpan={7} />}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function DataQualityTab({ report }) {
  const { rows, counts } = report;
  return (
    <>
      <Kpis items={[
        { label: 'Claims Not Matched', value: counts.notMatched, sub: 'Projected fill, no claim by window end' },
        { label: 'Non–Part D Claims', value: counts.nonPartD, sub: 'Billed to other coverage, not counted' },
        { label: 'Rows Held for Review', value: counts.heldForReview, sub: 'Days supply 0 or unlinked negatives' },
        { label: 'Total Issues', value: rows.length, sub: 'Across the filtered members' },
      ]} />
      <Card title="Claim Feed Issues" sub="Newest first" flush>
        <div className={s.tblWrap}>
          <table className={s.tbl}>
            <thead>
              <tr><th>Member</th><th>Measure</th><th>Issue</th><th>Date</th><th>Detail</th></tr>
            </thead>
            <tbody>
              {rows.length ? rows.map((r, i) => (
                <tr key={`${r.memberId}-${r.code}-${r.issue}-${i}`}>
                  <td className={local.groupCell}>{r.member}</td>
                  <td>{r.code}</td>
                  <td><Badge size="sm" tone={ISSUE_TONE[r.issue]} label={r.issue} /></td>
                  <td>{r.date || '-'}</td>
                  <td className={local.detail}>{r.detail}</td>
                </tr>
              )) : <EmptyState message="No claim feed issues for these members" icon="solar:check-circle-linear" colSpan={5} />}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

/**
 * Pharmacy Adherence reports (Analytics). Reads the pharmacy worklist members
 * the worklist loads from Supabase, so every number matches the worklist.
 * The workflow feeds reports, not billing.
 */
export function PharmacyReportsView() {
  const members = useAppStore(st => st.pharmacyWorklistMembers);
  const loading = useAppStore(st => st.pharmacyWorklistLoading);
  const didFetch = useAppStore(st => st.pharmacyWorklistDidFetch);
  const fetchMembers = useAppStore(st => st.fetchPharmacyWorklistMembers);
  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const [tab, setTab] = useState('outcomes');
  const [healthPlans, setHealthPlans] = useState([]);
  const [ipas, setIpas] = useState([]);
  const [measures, setMeasures] = useState([]);
  const [period, setPeriod] = useState('Last 30 days');
  const [groupLabel, setGroupLabel] = useState('Measure');

  const options = useMemo(() => ({
    healthPlans: uniq(members.map(m => m.healthPlan)),
    ipas: uniq(members.map(m => m.ipa)),
  }), [members]);
  const filtered = useMemo(() => members.filter(m => (!healthPlans.length || healthPlans.includes(m.healthPlan)) && (!ipas.length || ipas.includes(m.ipa))), [members, healthPlans, ipas]);
  const enriched = useMemo(() => reportMembers(filtered, { measures }), [filtered, measures]);

  const outcomes = useMemo(() => outcomesReport(enriched, GROUP_BY_KEY[groupLabel]), [enriched, groupLabel]);
  const providers = useMemo(() => outcomesReport(enriched, 'ipa'), [enriched]);
  const productivity = useMemo(() => productivityReport(filtered, period), [filtered, period]);
  const quality = useMemo(() => dataQualityReport(enriched), [enriched]);

  const cold = loading || (!didFetch && !members.length);

  return (
    <div>
      <div className={local.filters}>
        <FilterChip label="Health Plan" options={options.healthPlans} selected={healthPlans} onChange={setHealthPlans} />
        <FilterChip label="IPA" options={options.ipas} selected={ipas} onChange={setIpas} />
        <FilterChip label="Measure" options={MEASURE_ORDER} selected={measures} onChange={setMeasures} />
        {(tab === 'outcomes' || tab === 'productivity') && <span className={local.filterDivider} />}
        {tab === 'outcomes' && (
          <FilterChip label="Group by" options={GROUP_BY_OPTIONS} selected={[groupLabel]} onChange={(v) => setGroupLabel(v[0] || 'Measure')} singleSelect />
        )}
        {tab === 'productivity' && (
          <FilterChip label="Period" options={REPORT_PERIODS} selected={[period]} onChange={(v) => setPeriod(v[0] || 'Last 30 days')} singleSelect />
        )}
      </div>
      <div className={local.tabs}>
        <Tabs items={TABS} value={tab} onValueChange={setTab} fullWidth={false} size="sm" />
      </div>
      {tab === 'outcomes' && <p className={local.note}>A gap closes only on a matched Part D claim. Projected fills show as Pending Claim until their claim arrives.</p>}

      {cold ? (
        <>
          <KpiSkeleton count={tab === 'outcomes' ? 5 : 4} />
          <TableSkeleton rows={6} cols={8} />
        </>
      ) : (
        <>
          {tab === 'outcomes' && <OutcomesTab report={outcomes} groupLabel={groupLabel} />}
          {tab === 'providers' && <ProvidersTab report={providers} />}
          {tab === 'productivity' && <ProductivityTab report={productivity} period={period} />}
          {tab === 'quality' && <DataQualityTab report={quality} />}
        </>
      )}
    </div>
  );
}
