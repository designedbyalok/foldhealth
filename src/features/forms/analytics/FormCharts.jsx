/**
 * Form-analytics charts — Recharts, themed with Fold Health tokens.
 * Mirrors the styling conventions in src/features/analytics/views/charts.jsx
 * (FoldTooltip, Inter font, token colors).
 */
import {
  ResponsiveContainer, PieChart, Pie, Cell,
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from '../../../components/LazyRecharts/LazyRecharts';
import { SERIES_COLORS } from './formAnalyticsUi';

const FONT = { fontFamily: "'Inter', sans-serif" };
const AXIS_TICK = { fontSize: 12, fill: 'var(--neutral-200)', ...FONT };
const GRID = { stroke: 'var(--neutral-100)', strokeDasharray: '3 3' };

function FoldTooltip({ active, payload, label, suffix = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--neutral-0)', borderRadius: 8, padding: '8px 12px', boxShadow: 'var(--shadow-card)', border: '1px solid var(--neutral-100)', minWidth: 100 }}>
      {label != null && <div style={{ fontSize: 12, color: 'var(--neutral-200)', fontWeight: 500, marginBottom: 4, ...FONT }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color || p.payload?.fill, flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--neutral-300)', flex: 1, ...FONT }}>{p.name || p.dataKey}</span>
          <span style={{ fontSize: 13, color: 'var(--neutral-400)', fontWeight: 500, ...FONT }}>{p.value}{suffix}</span>
        </div>
      ))}
    </div>
  );
}

/** Donut chart. data: [{ label, count }]. Optional explicit colors via `colors`. */
export function DonutChart({ data, colors = SERIES_COLORS, height = 220, innerRadius = 58, outerRadius = 92 }) {
  const rows = (data || []).filter((d) => d.count > 0);
  if (!rows.length) return null;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={rows}
          dataKey="count"
          nameKey="label"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          paddingAngle={1}
          stroke="var(--neutral-0)"
          strokeWidth={2}
          label={({ value }) => value}
          labelLine={false}
          style={{ fontSize: 12, ...FONT }}
        >
          {rows.map((d, i) => <Cell key={i} fill={d.color || colors[i % colors.length]} />)}
        </Pie>
        <Tooltip content={<FoldTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  );
}

/** Vertical bar chart for numeric / rating answer distributions. data: [{ label, count }]. */
export function VotesBarChart({ data, height = 200, color = 'var(--primary-300)' }) {
  if (!data?.length) return null;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 16, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS_TICK} axisLine={{ stroke: 'var(--neutral-150)' }} tickLine={false} />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
        <Tooltip cursor={{ fill: 'var(--neutral-50)' }} content={<FoldTooltip />} />
        <Bar dataKey="count" name="Votes" fill={color} radius={[4, 4, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Average-score line over months. data: [{ month, value }]. */
export function AvgScoreLineChart({ data, height = 260, yLabel = '% of Satisfaction' }) {
  if (!data?.length) return null;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 12, right: 20, bottom: 4, left: 8 }}>
        <CartesianGrid {...GRID} />
        <XAxis dataKey="month" tick={AXIS_TICK} axisLine={{ stroke: 'var(--neutral-150)' }} tickLine={false} />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={40}
          label={{ value: yLabel, angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: 'var(--neutral-200)', ...FONT }, dy: 50 }} />
        <Tooltip content={<FoldTooltip />} />
        <Line type="monotone" dataKey="value" name="Average" stroke="var(--primary-300)" strokeWidth={2}
          dot={{ r: 3, fill: 'var(--primary-300)', strokeWidth: 0 }}
          activeDot={{ r: 5, fill: 'var(--primary-300)', stroke: 'var(--neutral-0)', strokeWidth: 2 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
