import { useEffect, useMemo, useState } from 'react';
import {
  ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as ChartTooltip,
} from '../../../../../../components/LazyRecharts/LazyRecharts';
import { Toggle } from '../../../../../../components/Toggle/Toggle';
import { CardSkeleton } from '../../../../../../components/CardSkeleton/CardSkeleton';
import { ActionButton } from '../../../../../../components/ActionButton/ActionButton';
import { ProfileTable } from '../../../../../../components/ProfileTable/ProfileTable';
import { profileRowClass, profileCellClass } from '../../../../../../components/ProfileTable/profileTableClasses';
import { useAppStore } from '../../../../../../store/useAppStore';
import { VITALS, TABLE_SECTIONS, formatVital, vitalsHistory } from '../vitalsConfig';
import { RecordVitalsDrawer } from '../RecordVitalsDrawer/RecordVitalsDrawer';
import styles from './VitalsLabsTab.module.css';

function GraphIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1.33 14.17C1.06 14.17 0.83 14.39 0.83 14.67C0.83 14.94 1.06 15.17 1.33 15.17V14.67V14.17ZM14.67 14.67V14.17H1.33V14.67V15.17H14.67V14.67ZM11 8.67V9.17H13V8.67V8.17H11V8.67ZM14 9.67H13.5V14.67H14H14.5V9.67H14ZM10 14.67H10.5V9.67H10H9.5V14.67H10ZM13 8.67V9.17C13.28 9.17 13.5 9.39 13.5 9.67H14H14.5C14.5 8.84 13.83 8.17 13 8.17V8.67ZM11 8.67V8.17C10.17 8.17 9.5 8.84 9.5 9.67H10H10.5C10.5 9.39 10.72 9.17 11 9.17V8.67ZM10 3.33H9.5V14.67H10H10.5V3.33H10ZM6 14.67H6.5V3.33H6H5.5V14.67H6ZM8 1.33V1.83C8.49 1.83 8.8 1.84 9.03 1.87C9.25 1.9 9.32 1.94 9.35 1.98L9.71 1.63L10.06 1.27C9.81 1.02 9.49 0.92 9.16 0.88C8.85 0.83 8.46 0.83 8 0.83V1.33ZM10 3.33H10.5C10.5 2.88 10.5 2.48 10.46 2.17C10.41 1.84 10.32 1.53 10.06 1.27L9.71 1.63L9.35 1.98C9.39 2.02 9.44 2.09 9.47 2.3C9.5 2.53 9.5 2.85 9.5 3.33H10ZM8 1.33V0.83C7.54 0.83 7.15 0.83 6.84 0.88C6.51 0.92 6.19 1.02 5.94 1.27L6.29 1.63L6.65 1.98C6.68 1.94 6.75 1.9 6.97 1.87C7.2 1.84 7.51 1.83 8 1.83V1.33ZM6 3.33H6.5C6.5 2.85 6.5 2.53 6.53 2.3C6.56 2.09 6.61 2.02 6.65 1.98L6.29 1.63L5.94 1.27C5.68 1.53 5.58 1.84 5.54 2.17C5.5 2.48 5.5 2.88 5.5 3.33H6ZM3 5.33V5.83H5V5.33V4.83H3V5.33ZM6 6.33H5.5V14.67H6H6.5V6.33H6ZM2 14.67H2.5V6.33H2H1.5V14.67H2ZM5 5.33V5.83C5.28 5.83 5.5 6.06 5.5 6.33H6H6.5C6.5 5.51 5.83 4.83 5 4.83V5.33ZM3 5.33V4.83C2.17 4.83 1.5 5.51 1.5 6.33H2H2.5C2.5 6.06 2.72 5.83 3 5.83V5.33Z" fill="currentColor"/>
    </svg>
  );
}

function AddIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 8.5C12.28 8.5 12.5 8.28 12.5 8C12.5 7.72 12.28 7.5 12 7.5V8V8.5ZM4 7.5C3.72 7.5 3.5 7.72 3.5 8C3.5 8.28 3.72 8.5 4 8.5V8V7.5ZM8.5 4C8.5 3.72 8.28 3.5 8 3.5C7.72 3.5 7.5 3.72 7.5 4L8 4L8.5 4ZM7.5 12C7.5 12.28 7.72 12.5 8 12.5C8.28 12.5 8.5 12.28 8.5 12H8H7.5ZM12 8V7.5H8V8V8.5H12V8ZM8 8V7.5H4V8V8.5H8V8ZM8 4L7.5 4L7.5 8L8 8H8.5L8.5 4L8 4ZM8 8H7.5V12H8H8.5V8H8Z" fill="currentColor"/>
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function TrendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3.69 2.98C3.49 2.79 3.17 2.79 2.98 2.98C2.78 3.18 2.78 3.49 2.98 3.69L3.33 3.33L3.69 2.98ZM11.65 12.35C11.84 12.55 12.158 12.55 12.35 12.35C12.55 12.16 12.55 11.84 12.35 11.65L12 12L11.65 12.35ZM10.66 3.3L11.013 2.95V2.95L10.66 3.3ZM12.71 5.36L13.07 5V5L12.71 5.36ZM5.83 12.95L5.47 13.31H5.47L5.83 12.95ZM3.08 10.21L3.43 9.85H3.43L3.08 10.21ZM3.9 7.12L4.03 7.6H4.03L3.9 7.12ZM4.87 6.76L4.58 6.35L4.58 6.35L4.87 6.76ZM5.5 6.85C5.68 6.64 5.65 6.33 5.44 6.15C5.23 5.97 4.92 5.99 4.74 6.2L5.12 6.53L5.5 6.85ZM8.92 12.13L9.4 12.27V12.27L8.92 12.13ZM9.28 11.165L9.68 11.46V11.46L9.28 11.165ZM9.83 11.299C10.04 11.12 10.06 10.8 9.88 10.59C9.7 10.38 9.38 10.36 9.17 10.543L9.5 10.921L9.83 11.299ZM1.81 8.5L1.31 8.51L1.31 8.51L1.81 8.5ZM1.95 7.97L2.39 8.22V8.22L1.95 7.97ZM7.54 14.23L7.54 13.73H7.54L7.54 14.23ZM8.06 14.09L7.81 13.66L7.81 13.66L8.06 14.09ZM14.64 8.2L15.13 8.31L15.13 8.31L14.64 8.2ZM11.54 9.53C11.28 9.63 11.15 9.91 11.24 10.17C11.34 10.43 11.63 10.562 11.89 10.46L11.711 10L11.54 9.53ZM7.8 1.36L7.91 1.85V1.85L7.8 1.36ZM5.55 4.15C5.45 4.41 5.59 4.7 5.85 4.79C6.1 4.89 6.39 4.76 6.49 4.5L6.02 4.32L5.55 4.15ZM0.98 14.31C0.78 14.51 0.78 14.83 0.98 15.02C1.175 15.22 1.49 15.22 1.69 15.02L1.33 14.67L0.98 14.31ZM4.79 11.92C4.98 11.72 4.98 11.4 4.79 11.21C4.59 11.01 4.28 11.01 4.08 11.21L4.44 11.562L4.79 11.92ZM3.33 3.33L2.98 3.69L11.65 12.35L12 12L12.35 11.65L3.69 2.98L3.33 3.33ZM10.66 3.3L10.31 3.65L12.36 5.71L12.71 5.36L13.07 5L11.013 2.95L10.66 3.3ZM5.83 12.95L6.18 12.6L3.43 9.85L3.08 10.21L2.73 10.56L5.47 13.31L5.83 12.95ZM3.9 7.12L4.03 7.6C4.5 7.47 4.86 7.38 5.16 7.16L4.87 6.76L4.58 6.35C4.46 6.43 4.31 6.48 3.76 6.63L3.9 7.12ZM4.87 6.76L5.16 7.16C5.28 7.07 5.4 6.97 5.5 6.85L5.12 6.53L4.74 6.2C4.69 6.26 4.63 6.31 4.58 6.35L4.87 6.76ZM8.92 12.13L9.4 12.27C9.55 11.72 9.6 11.57 9.68 11.46L9.28 11.165L8.87 10.87C8.66 11.17 8.57 11.53 8.44 12L8.92 12.13ZM9.5 10.921L9.17 10.543C9.06 10.641 8.96 10.75 8.87 10.87L9.28 11.165L9.68 11.46C9.73 11.4 9.77 11.35 9.83 11.299L9.5 10.921ZM3.08 10.21L3.43 9.85C3 9.42 2.71 9.128 2.52 8.89C2.33 8.65 2.31 8.55 2.31 8.5L1.81 8.5L1.31 8.51C1.31 8.9 1.51 9.22 1.74 9.51C1.97 9.81 2.31 10.15 2.73 10.56L3.08 10.21ZM3.9 7.12L3.76 6.63C3.2 6.79 2.74 6.92 2.39 7.06C2.04 7.2 1.71 7.38 1.52 7.72L1.95 7.97L2.39 8.22C2.41 8.18 2.48 8.1 2.76 7.98C3.04 7.87 3.44 7.76 4.03 7.6L3.9 7.12ZM1.81 8.5L2.31 8.5C2.31 8.4 2.34 8.3 2.39 8.22L1.95 7.97L1.52 7.72C1.38 7.96 1.31 8.23 1.31 8.51L1.81 8.5ZM5.83 12.95L5.47 13.31C5.89 13.723 6.23 14.07 6.52 14.3C6.82 14.535 7.14 14.73 7.54 14.73L7.54 14.23L7.54 13.73C7.49 13.73 7.39 13.71 7.15 13.52C6.91 13.33 6.61 13.03 6.18 12.6L5.83 12.95ZM8.92 12.13L8.44 12C8.28 12.59 8.16 13 8.05 13.28C7.94 13.57 7.85 13.63 7.81 13.66L8.06 14.09L8.31 14.52C8.65 14.331 8.84 14 8.98 13.65C9.12 13.3 9.25 12.84 9.4 12.27L8.92 12.13ZM7.54 14.23L7.54 14.73C7.81 14.73 8.07 14.66 8.31 14.52L8.06 14.09L7.81 13.66C7.73 13.7 7.63 13.73 7.54 13.73L7.54 14.23ZM12.71 5.36L12.36 5.71C13.07 6.42 13.56 6.91 13.86 7.32C14.16 7.72 14.19 7.93 14.15 8.1L14.64 8.2L15.13 8.31C15.26 7.72 15.03 7.21 14.66 6.72C14.31 6.24 13.75 5.69 13.07 5L12.71 5.36ZM11.711 10L11.89 10.46C12.79 10.12 13.529 9.85 14.051 9.56C14.58 9.27 15.01 8.9 15.13 8.31L14.64 8.2L14.15 8.1C14.12 8.27 14 8.44 13.57 8.69C13.124 8.93 12.47 9.18 11.54 9.53L11.711 10ZM10.66 3.3L11.013 2.95C10.32 2.26 9.77 1.7 9.28 1.34C8.79 0.98 8.28 0.74 7.69 0.87L7.8 1.36L7.91 1.85C8.07 1.81 8.28 1.84 8.69 2.14C9.1 2.44 9.59 2.94 10.31 3.65L10.66 3.3ZM6.02 4.32L6.49 4.5C6.83 3.55 7.08 2.89 7.32 2.44C7.56 2 7.74 1.88 7.91 1.85L7.8 1.36L7.69 0.87C7.1 1 6.73 1.43 6.44 1.96C6.15 2.49 5.88 3.24 5.55 4.15L6.02 4.32ZM1.33 14.67L1.69 15.02L4.79 11.92L4.44 11.562L4.08 11.21L0.98 14.31L1.33 14.67Z" fill="currentColor"/>
    </svg>
  );
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// ── Table data ──────────────────────────────────────────────────────────────

// Pinned until the patient has pins saved (patient_vital_pins).
const DEFAULT_PINS = ['bp', 'spo2', 'bg'];
const shortDate = (iso) => { const [y, m, d] = iso.split('-'); return `${+m}/${+d}/${y.slice(2)}`; };

// Vitals table section from recorded readings: latest three per vital,
// vitals with no readings at all left out.
function vitalsSection(history) {
  return {
    id: 'vitals', title: 'Vitals',
    rows: VITALS.filter(v => history[v.key]?.length).map(v => ({
      id: v.key, name: v.name, unit: v.unit,
      values: history[v.key].slice(0, 3).map(r => ({
        v: formatVital(v.key, r.value, r.value2), date: shortDate(r.recorded_on), flag: r.flag,
      })),
    })),
  };
}

// ── Graph data ──────────────────────────────────────────────────────────────
// The graphs draw the same rows as the table: one card per row, in the
// table's order. Vitals plot every recorded reading; the other sections plot
// the readings their row lists.

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/**
 * The ranges the graphs offer, counted back from a row's latest reading.
 * Day ranges tick every `tickDays`; month ranges tick on every month, from
 * the first of the month `months - 1` before the latest one.
 */
const dayTick = d => `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
const monthTick = d => MONTHS[d.getUTCMonth()];
const RANGES = {
  '1W': { days: 7, tickDays: 1, tick: dayTick },
  '1M': { days: 30, tickDays: 7, tick: dayTick },
  '6M': { months: 6, tick: monthTick },
  '1Y': { months: 12, tick: monthTick },
};
const RANGE_KEYS = Object.keys(RANGES);
const toNum = (v) => Number(String(v ?? '').replace(/,/g, ''));
// '3/9/25' (the static rows' dates) to '2025-03-09'.
const mdyToIso = (d) => { const [m, day, y] = d.split('/'); return `20${y}-${m.padStart(2, '0')}-${day.padStart(2, '0')}`; };
const isoToMdy = (iso) => { const [y, m, d] = iso.split('-'); return `${m}/${d}/${y}`; };

/** A row's readings as chart points, oldest first: { date, t, v, sys?, dia?, flag }. */
function rowPoints(row, history) {
  const readings = history[row.id]
    ? history[row.id].map(r => ({ date: r.recorded_on, value: r.value, value2: r.value2, flag: r.flag }))
    : row.values.map(val => ({ date: mdyToIso(val.date), value: val.v, flag: val.flag }));
  return readings
    .filter(r => r.date)
    .map((r) => {
      const point = { date: r.date, ts: Date.parse(r.date), flag: !!r.flag };
      if (row.id === 'bp') {
        const sys = toNum(r.value);
        const dia = toNum(r.value2);
        return { ...point, sys, dia, range: Math.max(sys - dia, 0), v: sys };
      }
      // Height plots in inches so feet and inches share one scale.
      if (row.id === 'ht') return { ...point, v: toNum(r.value) * 12 + toNum(r.value2) };
      return { ...point, v: toNum(r.value) };
    })
    .filter(p => Number.isFinite(p.v))
    .reverse();
}

/**
 * The range's window, counted back from the row's latest reading, with its
 * x-axis ticks; and the points inside it.
 */
function inRange(points, range) {
  const { days, tickDays, months } = RANGES[range];
  if (!points.length) return { points, domain: [0, 1], ticks: [] };
  const to = points[points.length - 1].ts;
  const ticks = [];
  let from;
  let pad;
  if (months) {
    const last = new Date(to);
    for (let i = months - 1; i >= 0; i -= 1) ticks.push(Date.UTC(last.getUTCFullYear(), last.getUTCMonth() - i, 1));
    from = ticks[0];
    pad = 15 * DAY_MS;
  } else {
    from = to - days * DAY_MS;
    for (let t = to; t >= from; t -= tickDays * DAY_MS) ticks.unshift(t);
    pad = (tickDays * DAY_MS) / 2;
  }
  // Room each side, so the first and last readings aren't on the edge.
  return { points: points.filter(p => p.ts >= from), domain: [from - pad, to + pad], ticks };
}

const fmt = (n) => (Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1));

/** Latest, average and range of what the chart shows. */
function rowStats(row, points) {
  if (!points.length) return [];
  const last = points[points.length - 1];
  if (row.id === 'bp') {
    const avg = (k) => Math.round(points.reduce((sum, p) => sum + p[k], 0) / points.length);
    return [
      { val: `${last.sys}/${last.dia}`, label: 'Latest' },
      { val: `${avg('sys')}/${avg('dia')}`, label: 'Average' },
      { val: `${Math.min(...points.map(p => p.sys))}–${Math.max(...points.map(p => p.sys))}`, label: 'Systolic Range' },
      { val: `${Math.min(...points.map(p => p.dia))}–${Math.max(...points.map(p => p.dia))}`, label: 'Diastolic Range' },
    ];
  }
  const values = points.map(p => p.v);
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  const show = (v) => (row.id === 'ht' ? `${Math.floor(v / 12)}'${Math.round(v % 12)}"` : fmt(v));
  return [
    { val: show(last.v), label: 'Latest' },
    { val: show(Math.round(avg * 10) / 10), label: 'Average' },
    { val: `${show(Math.min(...values))}–${show(Math.max(...values))}`, label: 'Range' },
  ];
}

// ── Custom range bar shapes ───────────────────────────────────────────────────

// Blood Pressure: a line from diastolic up to systolic, a circle on top and a
// diamond at the bottom. Recharts passes the bar's box; colors come as props.
function RangeShape({ x, y, width, height, topColor, botColor }) {
  if (!height || height <= 0 || width == null) return null;
  const cx = x + width / 2;
  const ds = 3.5;
  return (
    <g>
      <line x1={cx} y1={y} x2={cx} y2={y + height} stroke={topColor} strokeWidth={1.5} />
      <circle cx={cx} cy={y} r={3.5} fill={topColor} />
      <path
        d={`M${cx},${y + height - ds} L${cx + ds},${y + height} L${cx},${y + height + ds} L${cx - ds},${y + height} Z`}
        fill={botColor}
      />
    </g>
  );
}

// A reading's dot, red when the table flags it.
function LineDot({ cx, cy, payload, color, flagColor }) {
  if (cx == null || cy == null) return null;
  return <circle cx={cx} cy={cy} r={payload?.flag ? 3.5 : 2.5} fill={payload?.flag ? flagColor : color} />;
}

// ── Metric Chart ─────────────────────────────────────────────────────────────

function MetricChart({ row, points, domain, ticks, range, colors }) {
  const { topColor, botColor, lineColor, gridColor, axisColor, flagColor } = colors;
  const unit = row.id === 'ht' ? 'in' : row.unit;

  const axisProps = {
    tick: { fontSize: 'var(--font-xs)', fill: axisColor, fontFamily: 'Inter, sans-serif' },
    axisLine: false,
    tickLine: false,
  };
  const xAxis = (
    <XAxis
      dataKey="ts"
      type="number"
      scale="time"
      domain={domain}
      ticks={ticks}
      tickFormatter={ts => RANGES[range].tick(new Date(ts))}
      interval={0}
      {...axisProps}
    />
  );
  const tooltip = (
    <ChartTooltip
      cursor={{ stroke: gridColor }}
      formatter={(value, name, item) => (row.id === 'bp' && name === 'range'
        ? [`${item.payload.sys}/${item.payload.dia} ${unit}`, row.name]
        : [`${value} ${unit}`, row.name])}
      labelFormatter={(_, payload) => (payload?.[0] ? isoToMdy(payload[0].payload.date) : '')}
    />
  );

  const innerChart = row.id === 'bp' ? (
    <ResponsiveContainer width="100%" height={180}>
      <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="none" />
        {xAxis}
        <YAxis domain={[0, 'auto']} width={40} {...axisProps} />
        {tooltip}
        <Bar dataKey="dia" stackId="r" fill="transparent" stroke="none" isAnimationActive={false} barSize={8} />
        <Bar dataKey="range" stackId="r" shape={<RangeShape topColor={topColor} botColor={botColor} />} fill="transparent" stroke="none" isAnimationActive={false} barSize={8} />
      </ComposedChart>
    </ResponsiveContainer>
  ) : (
    <ResponsiveContainer width="100%" height={180}>
      <ComposedChart data={points} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
        <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="none" />
        {xAxis}
        <YAxis domain={['auto', 'auto']} width={40} {...axisProps} />
        {tooltip}
        <Line type="monotone" dataKey="v" stroke={lineColor} strokeWidth={1.5}
          dot={<LineDot color={lineColor} flagColor={flagColor} />} activeDot={{ r: 4, fill: lineColor }} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );

  return (
    <div className={styles.chartArea}>
      <span className={styles.yLabel}>{unit}</span>
      <div className={styles.chartAreaInner}>{innerChart}</div>
    </div>
  );
}

// ── Table View ───────────────────────────────────────────────────────────────

const pick = (sections, keys) => {
  const byId = new Map(sections.map(sec => [sec.id, sec]));
  return keys.map(k => byId.get(k)).filter(Boolean);
};

const TABLE_COLUMNS = [
  { key: 'name', label: 'Name', width: 180 },
  { key: 'values', label: 'Values' },
];

/**
 * One table per section (ProfileTable, the app's WorklistShell). Pinned rows sit at the
 * top of their section; every row can be pinned (its pin shows on hover) or
 * unpinned (the pinned mark stays visible).
 */
function TableView({ sections, onOpenGraph, onAdd, widgets, pinned, onTogglePin }) {
  return (
    <div className={styles.tableView}>
      {pick(sections, widgets).map(section => {
        const rows = [...section.rows].sort((a, b) => pinned.includes(b.id) - pinned.includes(a.id));
        return (
          <div key={section.id} className={styles.tableSection}>
            <div className={styles.tableSectionHeader}>
              <span className={styles.tableSectionTitle}>{section.title}</span>
              <div className={styles.tableSectionActions}>
                <button className={styles.graphIconBtn} onClick={() => onOpenGraph(section.id)} title="View graphs">
                  <GraphIcon />
                </button>
                <span className={styles.sectionActionDivider} />
                <button className={styles.addIconBtn} title="Add" onClick={section.id === 'vitals' ? onAdd : undefined}>
                  <AddIcon />
                </button>
              </div>
            </div>

            <ProfileTable
                firstColumnDivider
                columns={TABLE_COLUMNS}
                rows={rows}
                renderRow={(row) => {
                  const isPinned = pinned.includes(row.id);
                  return (
                    <tr key={row.id} className={profileRowClass}>
                      <td className={`${profileCellClass} ${styles.nameTd}`}>
                        <div className={styles.nameCell}>
                          <div className={styles.nameRow}>
                            <span className={styles.rowName}>{row.name}</span>
                            <span className={`${styles.pinBtn} ${isPinned ? styles.pinBtnOn : ''}`}>
                              <ActionButton
                                size="sm"
                                tooltip={isPinned ? 'Unpin' : 'Pin to top'}
                                aria-label={`${isPinned ? 'Unpin' : 'Pin'} ${row.name}`}
                                active={isPinned}
                                icon={isPinned ? undefined : 'solar:pin-linear'}
                                onClick={() => onTogglePin(row.id)}
                              >
                                {isPinned ? <TrendIcon /> : undefined}
                              </ActionButton>
                            </span>
                          </div>
                          <span className={styles.rowUnit}>{row.unit}</span>
                        </div>
                      </td>
                      <td className={profileCellClass}>
                        <div className={styles.valuesCell}>
                          {row.values.map((val, i) => (
                            <div key={i} className={styles.valueItem}>
                              <span className={`${styles.val} ${val.flag ? styles.valFlag : ''}`}>{val.v}</span>
                              <span className={styles.valDate}>{val.date}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                }}
              />
          </div>
        );
      })}
    </div>
  );
}

// ── Graph View ───────────────────────────────────────────────────────────────

/** The table's sections as charts: one card per row, pinned rows first. */
function GraphView({ sections, history, pinned, onClose, onAdd, widgets }) {
  const [range, setRange] = useState('1M');

  const topColor  = cssVar('--chart-1');
  const botColor  = cssVar('--chart-2');
  const lineColor = cssVar('--chart-1');
  const gridColor = cssVar('--neutral-100');
  const axisColor = cssVar('--neutral-300');
  const flagColor = cssVar('--status-error');
  const colors = { topColor, botColor, lineColor, gridColor, axisColor, flagColor };

  return (
    <div className={styles.graphView}>
      {pick(sections, widgets).map((section, i) => {
        const rows = [...section.rows].sort((a, b) => pinned.includes(b.id) - pinned.includes(a.id));
        return (
          <div key={section.id}>
            <div className={styles.graphSectionHeader}>
              <span className={styles.graphSectionTitle}>{section.title}</span>
              {i === 0 && (
                <>
                  <Toggle items={RANGE_KEYS} value={range} onValueChange={setRange} size="sm" />
                  <button className={styles.listIconBtn} onClick={onClose} title="Back to list">
                    <ListIcon />
                  </button>
                </>
              )}
              <button className={styles.addIconBtn} title="Add" onClick={section.id === 'vitals' ? onAdd : undefined}>
                <AddIcon />
              </button>
            </div>

            {rows.map((row) => {
              const all = rowPoints(row, history);
              const { points, domain, ticks } = inRange(all, range);
              const stats = rowStats(row, points);
              const unit = row.id === 'ht' ? '' : row.unit;
              return (
                <div key={row.id} className={styles.metricCard}>
                  <div className={styles.metricHeader}>
                    <div className={styles.metricTitleGroup}>
                      <span className={styles.metricTitle}>{row.name}</span>
                      {all.length > 0 && (
                        <span className={styles.metricSub}>Last Recorded on {isoToMdy(all[all.length - 1].date)}</span>
                      )}
                    </div>
                    {row.id === 'bp' && (
                      <div className={styles.legend}>
                        <span className={styles.legendCircle} style={{ background: topColor }} />
                        <span className={styles.legendLabel}>Sys</span>
                        <span className={styles.legendDiamond} style={{ background: botColor }} />
                        <span className={styles.legendLabel}>Dia</span>
                      </div>
                    )}
                  </div>

                  <div className={styles.chartWrap}>
                    <MetricChart row={row} points={points} domain={domain} ticks={ticks} range={range} colors={colors} />
                  </div>

                  {stats.length > 0 && (
                    <div className={styles.statsBar}>
                      {stats.flatMap((stat, j) => [
                        j > 0 ? <span key={`d${j}`} className={styles.statDivider} /> : null,
                        <div key={`s${j}`} className={styles.statItem}>
                          <span className={styles.statLine}>
                            <span className={styles.statValue}>{stat.val}</span>
                            {unit && <span className={styles.statUnit}> {unit}</span>}
                          </span>
                          <span className={styles.statLabel}>{stat.label}</span>
                        </div>,
                      ])}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

// Vitals is built from the patient's readings (vitalsSection), the rest are static.
const VITALS_WIDGETS = ['vitals', ...TABLE_SECTIONS.map(sec => sec.id)];

/** `widgets`: the section ids to show, in order (More > Customize); all by default. */
export function VitalsLabsTab({ patientId, widgets = VITALS_WIDGETS }) {
  const [graphOpen, setGraphOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const rows = useAppStore(s => s.patientVitals[patientId]);
  const loading = useAppStore(s => s.patientVitalsLoading);
  const fetchPatientVitals = useAppStore(s => s.fetchPatientVitals);
  const savedPins = useAppStore(s => s.patientVitalPins[patientId]);
  const fetchPatientVitalPins = useAppStore(s => s.fetchPatientVitalPins);
  const setPatientVitalPins = useAppStore(s => s.setPatientVitalPins);

  useEffect(() => { fetchPatientVitals(patientId); }, [patientId, fetchPatientVitals]);
  useEffect(() => { fetchPatientVitalPins(patientId); }, [patientId, fetchPatientVitalPins]);

  const pinned = savedPins ?? DEFAULT_PINS;
  const togglePin = (id) => setPatientVitalPins(patientId, pinned.includes(id) ? pinned.filter(p => p !== id) : [...pinned, id]);

  const history = useMemo(() => vitalsHistory(rows), [rows]);
  const sections = useMemo(() => [vitalsSection(history), ...TABLE_SECTIONS], [history]);
  const openRecord = () => setRecording(true);

  return (
    <div className={styles.wrapper}>
      {/* Skeleton only on the first load for this patient, not on refetches. */}
      {loading && !rows
        ? <CardSkeleton count={3} />
        : graphOpen
          ? <GraphView sections={sections} history={history} pinned={pinned} onClose={() => setGraphOpen(false)} onAdd={openRecord} widgets={widgets} />
          : <TableView sections={sections} onOpenGraph={() => setGraphOpen(true)} onAdd={openRecord} widgets={widgets} pinned={pinned} onTogglePin={togglePin} />
      }
      {recording && (
        <RecordVitalsDrawer patientId={patientId} history={history} onClose={() => setRecording(false)} />
      )}
    </div>
  );
}
