import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, PieChart, Pie, Cell,
} from '../../../components/LazyRecharts/LazyRecharts';
import { Icon } from '../../../components/Icon/Icon';
import { Tooltip } from '../../../components/Tooltip/Tooltip';
import { SERIES, num } from './analyticsUi';
import styles from './Analytics.module.css';

const AXIS_TICK = { fontSize: 'var(--font-xs)', fill: 'var(--neutral-200)' };
const AXIS_LABEL = { fontSize: 'var(--font-xs)', fill: 'var(--neutral-300)' };

/**
 * One KPI tile. With `onClick` it is a button (drawers, the cards' tiles);
 * `selected` paints the drawer's active tile.
 */
export function KpiTile({ label, value, color, icon, info, selected = false, onClick }) {
  const body = (
    <>
      <span className={styles.tileLabel}>{label}</span>
      <span className={styles.tileValue}>
        {icon && <Icon name={icon} size={18} color="var(--neutral-300)" />}
        {color && <span className={styles.dot} style={{ background: color }} aria-hidden />}
        {value}
        {info && (
          <Tooltip label={Array.isArray(info) ? <InfoRows rows={info} /> : info} variant="card" maxWidth={240}>
            <span className={styles.tileInfo} role="img" aria-label={`About ${label}`}>
              <Icon name="solar:info-circle-linear" size={14} color="var(--neutral-300)" />
            </span>
          </Tooltip>
        )}
      </span>
    </>
  );
  if (!onClick) return <div className={styles.tile}>{body}</div>;
  return (
    <button
      type="button"
      className={[styles.tile, styles.tileButton, selected ? styles.tileSelected : ''].filter(Boolean).join(' ')}
      aria-pressed={selected}
      onClick={onClick}
    >
      {body}
    </button>
  );
}

function InfoRows({ rows }) {
  return (
    <span className={styles.infoRows}>
      {rows.map(([k, v]) => (
        <span key={k} className={styles.infoRow}><span>{k}</span><strong>{num(v)}</strong></span>
      ))}
    </span>
  );
}

function BarTip({ active, payload, keys }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className={styles.chartTip}>
      <div className={styles.chartTipTitle}>{d.rangeLabel || d.label}</div>
      {keys.map(k => (
        <div key={k} className={styles.chartTipRow}>
          <span className={styles.dot} style={{ background: SERIES[k].color }} aria-hidden />
          <span className={styles.chartTipLabel}>{SERIES[k].label}</span>
          <span className={styles.chartTipValue}>{num(d[k])}</span>
        </div>
      ))}
    </div>
  );
}

/** Grouped bars per day (or week) for a channel. */
export function ExecutionBarChart({ data, keys, height = 220 }) {
  return (
    <div className={styles.chartBox} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 16, left: 4 }} barGap={2} barCategoryGap="18%">
          <CartesianGrid stroke="var(--neutral-100)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: 'var(--neutral-150)' }}
            label={{ value: data.length && data[0].rangeLabel ? 'Week' : 'Date', position: 'insideBottom', offset: -10, style: AXIS_LABEL }} />
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} width={36}
            label={{ value: 'Execution', angle: -90, position: 'insideLeft', offset: 10, style: AXIS_LABEL }} />
          <ChartTooltip cursor={{ fill: 'var(--neutral-50)' }} content={<BarTip keys={keys} />} />
          {keys.map(k => (
            <Bar key={k} dataKey={k} name={SERIES[k].label} fill={SERIES[k].color} radius={[3, 3, 0, 0]} maxBarSize={12} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Completed / In progress / Failed donut with a clickable legend. */
export function StatusDonut({ data, onSelect }) {
  const rows = data.filter(d => d.value > 0);
  return (
    <div className={styles.donutWrap}>
      <div className={styles.donut}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={rows} dataKey="value" nameKey="label" innerRadius="58%" outerRadius="95%" stroke="var(--neutral-0)" strokeWidth={2} isAnimationActive={false}>
              {rows.map(d => <Cell key={d.key} fill={d.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className={styles.legend}>
        {data.map(d => (
          <li key={d.key}>
            <button type="button" className={styles.legendBtn} onClick={() => onSelect(d.key)}>
              <span className={styles.dot} style={{ background: d.color }} aria-hidden />
              <span className={styles.legendLabel}>{d.label}</span>
              <Icon name="solar:alt-arrow-right-linear" size={12} color="var(--neutral-300)" />
              <span className={styles.legendValue}>{num(d.value)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
