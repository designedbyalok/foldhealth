import { useState } from 'react';
import { SegmentedControl } from '../../../components/SegmentedControl/SegmentedControl';
import { SectionEmpty } from './AnalyticsParts';
import { MobileTrendChart } from './MobileTrendChart';
import styles from './DashboardChart.module.css';

const TCOC_MODES = [{ key: 'pmpm', label: 'PMPM' }, { key: 'total', label: 'Total Cost' }];
// Same constants as the desktop TcocLineChart (charts.jsx).
const BENCHMARK_PMPM = 910;
const TOTAL_MULTIPLIER = 8.42;

/**
 * A dashboard's trend chart, from the same series the desktop charts in
 * analytics/views/charts.jsx plot. Those are laid out for a wide card
 * (their reference labels sit outside the plot), so the phone draws them
 * with MobileTrendChart.
 */
export function DashboardChart({ spec, data }) {
  const [mode, setMode] = useState('pmpm');
  if (spec.chart === 'tcoc') {
    const series = data?.tcoc_all || [];
    if (!series.length) return <SectionEmpty>No cost trend data for this period</SectionEmpty>;
    const total = mode === 'total';
    const values = series.map(v => (v != null ? Math.round(v * (total ? TOTAL_MULTIPLIER : 1)) : null));
    return (
      <div className={styles.chart}>
        <SegmentedControl size="lg" fullWidth aria-label="Cost view" items={TCOC_MODES} value={mode} onValueChange={setMode} />
        <MobileTrendChart
          values={values}
          name={total ? 'Total Cost' : 'Actual PMPM'}
          format={total ? (v => `$${(v / 1000).toFixed(0)}K`) : (v => `$${Math.round(v)}`)}
          reference={total ? undefined : { value: BENCHMARK_PMPM, label: `Benchmark $${BENCHMARK_PMPM}` }}
        />
      </div>
    );
  }
  if (!data?.length) return <SectionEmpty>No trend data for this period</SectionEmpty>;
  if (spec.chart === 'savings') {
    return <MobileTrendChart values={data} name="Savings" format={v => `$${v.toFixed(1)}M`} reference={{ value: spec.target, label: spec.targetLabel }} />;
  }
  if (spec.chart === 'raf') {
    return <MobileTrendChart values={data} name="Avg RAF" format={v => v.toFixed(2)} reference={{ value: spec.potential, label: `Potential ${spec.potential.toFixed(2)}` }} />;
  }
  if (spec.chart === 'readmit') {
    return <MobileTrendChart values={data} name="Readmit Rate" format={v => `${v.toFixed(1)}%`} reference={{ value: spec.threshold, label: `Threshold ${spec.threshold}%` }} />;
  }
  return null;
}
