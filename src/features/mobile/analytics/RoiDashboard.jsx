import { useEffect, useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { safeConfigData } from '../../analytics/views/shared.utils';
import { DesktopOnlyNote, KpiGrid, RowList, Section, SectionLoading } from './AnalyticsParts';
import { MobileTrendChart } from './MobileTrendChart';

const fmt = (n) => (n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `$${(n / 1000).toFixed(0)}K` : `$${n}`);
const LEVER_ROWS = { primary: 'label', secondary: 'sub', fields: [['improvement', 'Improvement'], ['projected', 'Projected Savings'], ['share', '% of Total']] };

/**
 * ROI & Simulators, read only: the scenario at each lever's default, with
 * the same math as RoiView. Moving the levers stays on the computer.
 */
export function RoiDashboard() {
  const fetchConfig = useAppStore(s => s.fetchConfig);
  const period = useAppStore(s => s.analyticsPeriod);
  const [loaded, setLoaded] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetchConfig('roi_levers').then(d => { if (!cancelled) setLoaded({ period, data: d || {} }); });
    return () => { cancelled = true; };
  }, [fetchConfig, period]);
  const config = loaded?.period === period ? loaded.data : null;

  const cfg = safeConfigData(config);
  const levers = cfg.levers || [];
  const b = cfg.baselines || {};
  const at = Object.fromEntries(levers.map(l => [l.key, l.default ?? 0]));
  const rows = levers.map(l => ({ ...l, value: at[l.key], savings: Math.round(at[l.key] * (l.multiplier || 0)) }));
  const total = rows.reduce((sum, l) => sum + l.savings, 0);
  const roi = total > 0 ? (total / (b.investmentBase || 1200000)).toFixed(1) : '0.0';
  const quality = ((b.qualityScore || 0) + ((at.quality || 0) * (b.qualityGainPerPct || 0.009))).toFixed(1);
  const kpis = [
    { label: 'Total Projected Savings', value: fmt(total), sub: `Current: ${fmt(b.totalSavings || 0)}` },
    { label: 'Projected ROI', value: `${roi}x`, sub: `Current: ${b.roi || 0}x` },
    { label: 'Net Revenue Impact', value: fmt(Math.round(total * (b.netRevenueMultiplier || 0.65))), sub: `Current: ${fmt(b.netRevenue || 0)}` },
    { label: 'TCOC PMPM', value: `$${Math.round((b.tcocPmpm || 0) - ((at.tcoc || 0) * (b.tcocReducePerPct || 2.8)))}`, sub: `Current: $${b.tcocPmpm || 0}` },
    { label: 'Readmit Rate', value: `${((b.readmitRate || 0) - ((at.readmit || 0) * (b.readmitReducePerPct || 0.08))).toFixed(1)}%`, sub: `Current: ${b.readmitRate || 0}%` },
    { label: 'Quality Score', value: `${quality}/5`, sub: `Current: ${b.qualityScore || 0}/5` },
  ];
  const leverRows = rows.map(l => ({
    label: l.label,
    sub: l.sub,
    improvement: `${l.value}${l.unit || ''}`,
    projected: fmt(l.savings),
    share: `${total > 0 ? Math.round((l.savings / total) * 100) : 0}%`,
  }));
  const curve = [0, 0.08, 0.16, 0.26, 0.38, 0.48, 0.58, 0.68, 0.78, 0.88, 0.95, 1].map(f => +((total * f) / 1000000).toFixed(2));

  return (
    <>
      <KpiGrid items={kpis} loading={config === null} count={6} />
      <Section title="Savings Breakdown" sub="Each lever at its default setting">
        {config === null ? <SectionLoading /> : <RowList rows={leverRows} spec={LEVER_ROWS} />}
      </Section>
      <Section title="Projected Full-Year Shared Savings" sub={fmt(total)}>
        {config === null ? <SectionLoading height={220} /> : (
          <MobileTrendChart values={curve} name="Projected Savings" format={v => `$${v.toFixed(1)}M`} reference={{ value: (b.msr || 2800000) / 1000000, label: `MSR ${fmt(b.msr || 2800000)}` }} />
        )}
      </Section>
      <DesktopOnlyNote what="move the scenario levers or customize this layout" />
    </>
  );
}
