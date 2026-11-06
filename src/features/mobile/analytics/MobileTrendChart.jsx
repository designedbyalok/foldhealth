import { useId } from 'react';
import {
  Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from '../../../components/LazyRecharts/LazyRecharts';
import styles from './MobileTrendChart.module.css';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TICK = { fontSize: 'var(--font-sm)', fill: 'var(--neutral-200)' };

function TrendTooltip({ active, payload, label, format, name }) {
  const p = payload?.[0];
  if (!active || p?.value == null) return null;
  return (
    <div className={styles.tooltip}>
      <span className={styles.tooltipLabel}>{label}</span>
      <span className={styles.tooltipRow}>
        <span className={styles.tooltipDot} />
        <span>{name}</span>
        <strong>{format(p.value)}</strong>
      </span>
    </div>
  );
}

/**
 * A 12-month trend at phone width (Figma Business Insights 1133:26676):
 * one primary line over a soft fill, recessive axes, a dashed reference
 * line (benchmark, target) labelled inside the plot so nothing clips, and
 * a crosshair tooltip on touch.
 *
 * @param {(number|null)[]} props.values  – One per month, Jan first
 * @param {string} props.name             – Series name for the tooltip
 * @param {(v:number) => string} props.format
 * @param {{ value:number, label:string }} [props.reference]
 */
export function MobileTrendChart({ values, name, format, reference }) {
  const gradId = useId().replace(/:/g, '');
  const data = MONTHS.map((month, i) => ({ month, value: values?.[i] ?? null }));
  const nums = data.map(d => d.value).filter(v => v != null);
  if (reference) nums.push(reference.value);
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  const pad = (hi - lo) * 0.12 || Math.abs(hi) * 0.05 || 1;
  const domain = [lo - pad, hi + pad];
  const last = [...data].reverse().find(d => d.value != null);

  return (
    <figure className={styles.figure} aria-label={`${name}: ${last ? `${format(last.value)} in ${last.month}` : 'no data'}`}>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary-300)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--primary-300)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--neutral-100)" vertical={false} />
          <XAxis dataKey="month" tick={TICK} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={8} />
          <YAxis tick={TICK} tickLine={false} axisLine={false} width={48} domain={domain} tickCount={5} tickFormatter={format} allowDecimals />
          <Tooltip
            content={<TrendTooltip format={format} name={name} />}
            cursor={{ stroke: 'var(--primary-300)', strokeDasharray: '3 3' }}
          />
          {reference && (
            <ReferenceLine
              y={reference.value}
              stroke="var(--neutral-300)"
              strokeDasharray="4 4"
              label={{ value: reference.label, position: 'insideTopRight', fill: 'var(--neutral-300)', fontSize: 'var(--font-sm)' }}
            />
          )}
          <Area
            type="monotone"
            dataKey="value"
            name={name}
            stroke="var(--primary-300)"
            strokeWidth={2}
            fill={`url(#${gradId})`}
            dot={false}
            activeDot={{ r: 5, fill: 'var(--neutral-0)', stroke: 'var(--primary-300)', strokeWidth: 2 }}
            connectNulls={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </figure>
  );
}
