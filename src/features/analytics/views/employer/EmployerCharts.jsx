/**
 * Employer Impact Report: chart renderers. Recharts via LazyRecharts, the
 * same library as the rest of Analytics.
 *
 * Series colours come from the design system's ordered chart palette
 * (--chart-1 … --chart-5, the colours in the Figma), assigned by series
 * position in a widget's config so a colour always means the same series.
 * Those colours are soft, so identity never rides on colour alone: every
 * multi-series chart has a legend, stacked segments are split by a 2px
 * surface gap, and every mark has a tooltip.
 */
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, ComposedChart, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from '../../../../components/LazyRecharts/LazyRecharts';
import { seriesColor, formatValue, compactTick, niceTicks } from './employerImpactFormat';
import styles from './EmployerImpactView.module.css';

const LINE_COLOR = 'var(--neutral-300)';

const AXIS_TICK = { fontSize: 'var(--font-sm)', fill: 'var(--neutral-300)' };
const AXIS_TITLE = { ...AXIS_TICK, fill: 'var(--neutral-200)' };
const GRID = { stroke: 'var(--neutral-100)' };


// ── Tooltip (matches Analytics' FoldTooltip) ──
function ImpactTooltip({ active, payload, label, format }) {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipLabel}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} className={styles.tooltipRow}>
          <span className={styles.tooltipDot} style={{ background: p.color }} />
          <span className={styles.tooltipName}>{p.name}</span>
          <span className={styles.tooltipValue}>{formatValue(p.value, format)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Legend: toggles a series; hidden ones keep their colour for when they return ──
export function ChartLegend({ series, hidden, onToggle, line }) {
  if (series.length < 2 && !line) return null;
  return (
    <div className={styles.legend}>
      {series.map((s, i) => {
        const off = hidden.has(s.key);
        return (
          <button
            key={s.key}
            type="button"
            className={[styles.legendItem, off ? styles.legendOff : ''].filter(Boolean).join(' ')}
            aria-pressed={!off}
            onClick={() => onToggle(s.key)}
          >
            <span className={styles.legendDot} style={{ background: seriesColor(i) }} />
            {s.label}
          </button>
        );
      })}
      {line && (
        <button
          type="button"
          className={[styles.legendItem, hidden.has(line.key) ? styles.legendOff : ''].filter(Boolean).join(' ')}
          aria-pressed={!hidden.has(line.key)}
          onClick={() => onToggle(line.key)}
        >
          <span className={styles.legendLine} />
          {line.label}
        </button>
      )}
    </div>
  );
}

// ── Axes ──
// Ticks are set explicitly (0 up to a round top value) so the widest tick
// label is known before render. That lets each axis be sized so its title
// sits exactly LABEL_GAP from the tick values, whatever their width.
const TICK_MARGIN = 8;   // axis line → tick text
const LABEL_GAP = 12;    // tick text → axis title

let measureCtx = null;
function fontPx() {
  if (typeof document === 'undefined') return 12;
  // --font-sm is 0.75rem.
  return (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) * 0.75;
}
function textWidth(str) {
  if (typeof document === 'undefined') return String(str).length * 7;
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  const family = getComputedStyle(document.body).fontFamily || 'sans-serif';
  measureCtx.font = `${fontPx()}px ${family}`;
  return measureCtx.measureText(String(str)).width;
}

// Month labels read "Feb 26"; when a tick's slot is too narrow for them,
// the whole axis drops the year ("Feb") rather than letting labels overlap.
const MONTH_LABEL = /^([A-Z][a-z]{2}) \d{2}$/;
const TICK_GAP = 6;
/**
 * A category-axis tick that fits its slot. The decision is per axis, from
 * the widest label, so every tick reads the same way.
 */
function fitTick(labels) {
  const monthly = labels.length > 0 && labels.every(l => MONTH_LABEL.test(String(l)));
  const widest = monthly ? Math.max(...labels.map(textWidth)) : 0;
  return function FitTick({ x, y, payload, width, visibleTicksCount }) {
    const slot = width / Math.max(1, visibleTicksCount);
    const value = String(payload.value);
    const text = monthly && widest + TICK_GAP > slot ? value.replace(MONTH_LABEL, '$1') : value;
    return (
      <text x={x} y={y} dy="0.71em" textAnchor="middle" fill={AXIS_TICK.fill} fontSize={AXIS_TICK.fontSize}>
        {text}
      </text>
    );
  };
}

/** Title for a left axis, drawn LABEL_GAP left of the widest tick. */
function YTitle({ viewBox, value }) {
  const size = fontPx();
  const x = viewBox.x + size;
  const y = viewBox.y + viewBox.height / 2;
  return (
    <text x={x} y={y} transform={`rotate(-90 ${x} ${y})`} textAnchor="middle" dominantBaseline="text-after-edge" style={AXIS_TITLE}>
      {value}
    </text>
  );
}

/** Title for a bottom axis, drawn LABEL_GAP below the tick text. */
function XTitle({ viewBox, value, tickHeight }) {
  return (
    <text x={viewBox.x + viewBox.width / 2} y={viewBox.y + TICK_MARGIN + tickHeight + LABEL_GAP} textAnchor="middle" dominantBaseline="hanging" style={AXIS_TITLE}>
      {value}
    </text>
  );
}

/**
 * Props for a left axis whose tick labels are `labels`: width fits the
 * widest label, plus the title and gap when there is a title.
 */
function yAxisLayout(labels, title, maxLabelWidth = Infinity) {
  const widest = Math.min(maxLabelWidth, Math.max(0, ...labels.map(textWidth)));
  const width = Math.ceil(widest + TICK_MARGIN + (title ? LABEL_GAP + fontPx() : 4));
  return {
    width,
    tickSize: 0,
    tickMargin: TICK_MARGIN,
    label: title ? <YTitle value={title} /> : undefined,
  };
}

/** Props for a bottom axis; `angled` for the rotated hour ticks. */
function xAxisLayout(labels, title, angled = false) {
  const size = fontPx();
  const tickHeight = angled
    ? Math.max(0, ...labels.map(textWidth)) * Math.sin(Math.PI / 3) + size * 0.5
    : size;
  return {
    height: Math.ceil(TICK_MARGIN + tickHeight + (title ? LABEL_GAP + size * 1.2 : 4)),
    tickSize: 0,
    tickMargin: TICK_MARGIN,
    label: title ? <XTitle value={title} tickHeight={tickHeight} /> : undefined,
  };
}

/**
 * Vertical bars, stacked when there is more than one series. An optional
 * `line` (e.g. an average) draws on the same axis: never a second scale.
 */
export function StackedBars({ data, series, line, hidden, yLabel, xLabel, format, height = '100%', denseX = false }) {
  const visible = series.map((s, i) => ({ ...s, i })).filter(s => !hidden.has(s.key));
  const topKey = visible[visible.length - 1]?.key;
  const Chart = line ? ComposedChart : BarChart;
  const max = Math.max(0, ...data.map(r => Math.max(
    visible.reduce((a, s) => a + (r[s.key] || 0), 0),
    line && !hidden.has(line.key) ? r[line.key] || 0 : 0,
  )));
  const ticks = format === 'percent' ? [0, 25, 50, 75, 100] : niceTicks(max);
  const tickFmt = compactTick(format);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <Chart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="28%">
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis
          dataKey="x"
          tick={denseX ? { ...AXIS_TICK, angle: -60, textAnchor: 'end' } : fitTick(data.map(r => r.x))}
          interval={0}
          tickLine={false}
          axisLine={{ stroke: 'var(--neutral-150)' }}
          {...xAxisLayout(data.map(r => r.x), xLabel, denseX)}
        />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          tickFormatter={tickFmt}
          ticks={ticks}
          domain={[0, ticks[ticks.length - 1]]}
          {...yAxisLayout(ticks.map(tickFmt), yLabel)}
        />
        <Tooltip content={<ImpactTooltip format={format} />} cursor={{ fill: 'var(--neutral-50)' }} />
        {visible.map(s => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            stackId="stack"
            fill={seriesColor(s.i)}
            // A 2px surface gap between stacked segments keeps adjacent
            // series apart even where their colours are close.
            stroke="var(--neutral-0)"
            strokeWidth={visible.length > 1 ? 2 : 0}
            radius={s.key === topKey ? [4, 4, 0, 0] : 0}
            maxBarSize={36}
            isAnimationActive={false}
          />
        ))}
        {line && !hidden.has(line.key) && (
          <Line
            type="linear"
            dataKey={line.key}
            name={line.label}
            stroke={LINE_COLOR}
            strokeWidth={2}
            dot={{ r: 4, fill: LINE_COLOR, stroke: 'var(--neutral-0)', strokeWidth: 2 }}
            isAnimationActive={false}
          />
        )}
      </Chart>
    </ResponsiveContainer>
  );
}

// Space between the plot edges and the first / last points.
const LINE_INSET = 16;

/**
 * Vertical grid positions for a line chart: both plot edges plus every
 * point except the first and last, whose lines would sit just inside the
 * edge lines and read as doubled dividers. Points fall evenly between the
 * insets (a category point scale), so their x is computable from `offset`.
 */
const lineColumns = (count) => ({ offset }) => {
  const left = offset.left;
  const right = offset.left + offset.width;
  const inner = [];
  if (count > 1) {
    const step = (offset.width - LINE_INSET * 2) / (count - 1);
    for (let i = 1; i < count - 1; i += 1) inner.push(left + LINE_INSET + step * i);
  }
  return [left, ...inner, right];
};

export function Lines({ data, series, hidden, yLabel, xLabel, format, height = '100%' }) {
  const visible = series.map((s, i) => ({ ...s, i })).filter(s => !hidden.has(s.key));
  const ticks = niceTicks(Math.max(0, ...data.flatMap(r => visible.map(s => r[s.key] || 0))));
  const tickFmt = compactTick(format);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid {...GRID} verticalCoordinatesGenerator={lineColumns(data.length)} />
        <XAxis dataKey="x" tick={fitTick(data.map(r => r.x))} tickLine={false} axisLine={{ stroke: 'var(--neutral-150)' }} padding={{ left: LINE_INSET, right: LINE_INSET }} {...xAxisLayout(data.map(r => r.x), xLabel)} />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          tickFormatter={tickFmt}
          ticks={ticks}
          domain={[0, ticks[ticks.length - 1]]}
          {...yAxisLayout(ticks.map(tickFmt), yLabel)}
        />
        <Tooltip content={<ImpactTooltip format={format} />} cursor={{ stroke: 'var(--neutral-150)' }} />
        {visible.map(s => (
          <Line
            key={s.key}
            type="linear"
            dataKey={s.key}
            name={s.label}
            stroke={seriesColor(s.i)}
            strokeWidth={2}
            dot={{ r: 4, fill: seriesColor(s.i), stroke: 'var(--neutral-0)', strokeWidth: 2 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Horizontal bars for ranked or labelled categories. */
// Long category names wrap inside this width rather than widening the axis.
const MAX_CATEGORY_WIDTH = 140;

export function HBars({ data, seriesKey, seriesLabel, yLabel, xLabel, format, height = '100%' }) {
  const ticks = niceTicks(Math.max(0, ...data.map(r => r[seriesKey] || 0)));
  const tickFmt = compactTick(format);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 0 }} barCategoryGap="30%">
        <CartesianGrid {...GRID} horizontal={false} />
        <XAxis
          type="number"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          tickFormatter={tickFmt}
          ticks={ticks}
          domain={[0, ticks[ticks.length - 1]]}
          {...xAxisLayout(ticks.map(tickFmt), xLabel)}
        />
        <YAxis
          type="category"
          dataKey="x"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          {...yAxisLayout(data.map(r => r.x), yLabel, MAX_CATEGORY_WIDTH)}
        />
        <Tooltip content={<ImpactTooltip format={format} />} cursor={{ fill: 'var(--neutral-50)' }} />
        <Bar dataKey={seriesKey} name={seriesLabel} fill={seriesColor(0)} radius={[0, 4, 4, 0]} maxBarSize={16} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** A donut with its values listed beside it, as in the design. */
export function Donut({ data, seriesKey, height = '100%' }) {
  const total = data.reduce((a, r) => a + (r[seriesKey] || 0), 0);
  return (
    <div className={styles.donut}>
      <div className={styles.donutChart} style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              content={({ active, payload }) => (active && payload?.length ? (
                <div className={styles.tooltip}>
                  <div className={styles.tooltipLabel}>{payload[0].name}</div>
                  <div className={styles.tooltipRow}>
                    <span className={styles.tooltipDot} style={{ background: payload[0].payload.fill }} />
                    <span className={styles.tooltipName}>
                      {total ? `${Math.round((payload[0].value / total) * 100)}%` : ''}
                    </span>
                    <span className={styles.tooltipValue}>{formatValue(payload[0].value)}</span>
                  </div>
                </div>
              ) : null)}
            />
            <Pie
              data={data.map((r, i) => ({ name: r.x, value: r[seriesKey] || 0, fill: seriesColor(i) }))}
              dataKey="value"
              nameKey="name"
              innerRadius="52%"
              outerRadius="92%"
              stroke="var(--neutral-0)"
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
            >
              {data.map((r, i) => <Cell key={r.x} fill={seriesColor(i)} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className={styles.donutLegend}>
        {data.map((r, i) => (
          <li key={r.x} className={styles.donutLegendItem}>
            <span className={styles.legendDot} style={{ background: seriesColor(i) }} />
            <span className={styles.donutLegendText}>
              <span className={styles.donutLegendLabel}>{r.x}</span>
              <span className={styles.donutLegendValue}>{formatValue(r[seriesKey])}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Cost Savings Comparison: one bar for the traditional cost, one for ours
 * stacked as membership + service, on a shared axis.
 */
export function CostComparisonBars({ summary, height = '100%' }) {
  const data = [
    { x: 'Traditional Cost', traditional: summary.traditional },
    { x: 'Our Cost', membership: summary.membership, service: summary.service },
  ];
  const ticks = niceTicks(Math.max(summary.traditional, summary.ours));
  const tickFmt = compactTick('currency');
  const bar = { stackId: 'cost', stroke: 'var(--neutral-0)', maxBarSize: 32, isAnimationActive: false };
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }} barCategoryGap="30%">
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis dataKey="x" tick={AXIS_TICK} interval={0} tickLine={false} axisLine={{ stroke: 'var(--neutral-150)' }} {...xAxisLayout(data.map(r => r.x))} />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          tickFormatter={tickFmt}
          ticks={ticks}
          domain={[0, ticks[ticks.length - 1]]}
          {...yAxisLayout(ticks.map(tickFmt))}
        />
        <Tooltip content={<ImpactTooltip format="currency" />} cursor={{ fill: 'var(--neutral-50)' }} />
        <Bar {...bar} dataKey="traditional" name="Traditional Cost" fill={seriesColor(0)} strokeWidth={0} radius={[4, 4, 0, 0]} />
        <Bar {...bar} dataKey="membership" name="Membership Cost" fill={seriesColor(0)} strokeWidth={2} />
        <Bar {...bar} dataKey="service" name="Service Cost" fill={seriesColor(1)} strokeWidth={2} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
