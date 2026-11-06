import { useState } from 'react';
import { Badge } from '../../../components/Badge/Badge';
import { BottomSheet, BottomSheetItem } from '../../../components/BottomSheet/BottomSheet';
import { Button } from '../../../components/Button/Button';
import { Icon } from '../../../components/Icon/Icon';
import { Input } from '../../../components/Input/Input';
import { SegmentedControl } from '../../../components/SegmentedControl/SegmentedControl';
import { Skeleton } from '../../../components/Skeleton/Skeleton';
import { sanitizeRichText } from '../../../lib/sanitizeHtml';
import { useAppStore } from '../../../store/useAppStore';
import { QUARTERS } from '../../analytics/analyticsData';
import { PERIOD_MODES, PRACTICES, STATUS_TONE } from './analyticsDashboards';
import styles from './AnalyticsParts.module.css';

const DELTA = {
  pos: { tone: 'success', icon: 'solar:arrow-up-linear' },
  neg: { tone: 'danger', icon: 'solar:arrow-down-linear' },
};

/** One KPI (Figma Business Insights tile 1133:26665): label, value, delta. */
export function KpiTile({ label, value, delta, deltaType, sub, icon }) {
  const d = DELTA[deltaType] || { tone: 'neutral' };
  return (
    <div className={styles.tile}>
      <div className={styles.tileHead}>
        {icon && <Icon name={icon} size={24} color="var(--primary-300)" />}
        <span className={styles.tileLabel}>{label}</span>
      </div>
      <div className={styles.tileRow}>
        <span className={styles.tileValue}>{value}</span>
        {delta && <Badge size="sm" tone={d.tone} icon={d.icon} label={delta} />}
      </div>
      {sub && <span className={styles.tileSub}>{sub}</span>}
    </div>
  );
}

/** Two-up KPI grid, or shimmer tiles while loading. */
export function KpiGrid({ items, loading, count = 4 }) {
  if (loading) {
    return (
      <div className={styles.grid} aria-busy="true" aria-label="Loading KPIs">
        {Array.from({ length: count }, (_, i) => <Skeleton key={i} width="100%" height={88} radius={12} />)}
      </div>
    );
  }
  if (!items?.length) return null;
  return (
    <div className={styles.grid}>
      {items.map(({ key, ...k }) => <KpiTile key={key || k.label} {...k} />)}
    </div>
  );
}

/** A dashboard block: 24px title, optional muted line, then its card. */
export function Section({ title, sub, children, plain }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {sub && <p className={styles.sectionSub}>{sub}</p>}
      </div>
      {plain ? children : <div className={styles.card}>{children}</div>}
    </section>
  );
}

export function SectionEmpty({ children = 'No data for this period' }) {
  return <p className={styles.empty}>{children}</p>;
}

export function SectionLoading({ height = 160 }) {
  return <Skeleton width="100%" height={height} radius={8} />;
}

/** The view's insight banner. Buttons do what desktop's do: open a view or toast. */
export function InsightCard({ insight, onNavigate }) {
  const showToast = useAppStore(s => s.showToast);
  if (!insight) return null;
  const tone = { amber: 'var(--status-warning)', red: 'var(--status-error)', green: 'var(--status-success)' }[insight.variant] || 'var(--primary-300)';
  const ai = !insight.icon || insight.icon.includes('lightbulb') || insight.icon === 'custom:ai';
  return (
    <div className={styles.insight}>
      <div className={styles.insightHead}>
        <Icon name={ai ? 'custom:ai' : insight.icon} size={24} color={tone} />
        <span className={styles.insightTitle}>{insight.title}</span>
      </div>
      {/* Insight copy carries inline <strong> from Supabase: sanitized, as on desktop. */}
      <p className={styles.insightText} dangerouslySetInnerHTML={{ __html: sanitizeRichText(insight.text) }} />
      {insight.buttons?.length > 0 && (
        <div className={styles.insightBtns}>
          {insight.buttons.map(b => (
            <Button
              key={b.label}
              size="lg"
              variant={b.primary ? 'solid' : 'outline'}
              onClick={() => (b.navTo ? onNavigate?.(b.navTo) : showToast(b.toast || b.label))}
            >
              {b.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

const BAR_COLOR = {
  purple: 'var(--primary-300)', green: 'var(--status-success)', amber: 'var(--status-warning)',
  red: 'var(--status-error)', teal: 'var(--accent-teal)',
};

/** Progress bars: label and value, a track, an optional note. */
export function BarList({ items }) {
  if (!items.length) return <SectionEmpty />;
  return (
    <div className={styles.bars}>
      {items.map(b => (
        <div key={b.label} className={styles.bar}>
          <div className={styles.barHead}>
            <span className={styles.barLabel}>{b.label}</span>
            <span className={styles.barValue}>{b.value}</span>
          </div>
          <div className={styles.track} role="meter" aria-label={b.label} aria-valuenow={Math.min(b.pct || 0, 100)} aria-valuemin={0} aria-valuemax={100}>
            <span className={styles.fill} style={{ transform: `scaleX(${Math.min(b.pct || 0, 100) / 100})`, background: BAR_COLOR[b.color] || BAR_COLOR.purple }} />
          </div>
          {b.sub && <span className={styles.barSub}>{b.sub}</span>}
        </div>
      ))}
    </div>
  );
}

/** Quality measures as rate-vs-target bars (desktop Measure Performance). */
export function MeasureList({ rows }) {
  return (
    <BarList items={rows.map(m => {
      const rate = m.rate ?? 0;
      const target = m.target ?? 0;
      const gap = rate - target;
      return {
        label: m.name,
        value: `${rate}%`,
        pct: rate,
        color: gap >= 0 ? 'green' : gap >= -10 ? 'amber' : 'red',
        sub: [`Target ${target}%`, `${gap >= 0 ? '+' : ''}${gap}pp`, m.tag].filter(Boolean).join(' · '),
      };
    })} />
  );
}

const read = (row, f) => (typeof f === 'function' ? f(row) : row?.[f]);
const shown = (v) => v != null && v !== '';

/** A desktop table as stacked rows: name and status, then label/value pairs. */
export function RowList({ rows, spec }) {
  if (!rows.length) return <SectionEmpty />;
  return (
    <ul className={styles.rows}>
      {rows.map((row, i) => {
        const st = spec.status ? read(row, spec.status) : null;
        const secondary = spec.secondary ? read(row, spec.secondary) : null;
        const fields = (spec.fields || []).map(([f, label]) => [label, read(row, f)]).filter(([, v]) => shown(v));
        return (
          <li key={i} className={styles.row}>
            <div className={styles.rowHead}>
              <span className={styles.rowTitle}>{read(row, spec.primary)}</span>
              {st && <Badge size="sm" tone={STATUS_TONE[st] || 'neutral'} label={spec.statusLabel(st, row)} />}
            </div>
            {shown(secondary) && <span className={styles.rowSub}>{secondary}</span>}
            {fields.length > 0 && (
              <dl className={styles.fields}>
                {fields.map(([label, v]) => (
                  <div key={label} className={styles.field}>
                    <dt>{label}</dt>
                    <dd>{typeof v === 'number' ? v.toLocaleString() : v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Config items (rules, anomalies, pipelines) as rows. */
export function ItemList({ items, spec }) {
  const showToast = useAppStore(s => s.showToast);
  if (!items.length) return <SectionEmpty />;
  return (
    <ul className={styles.rows}>
      {items.map((item, i) => {
        const st = spec.status ? spec.status(item) : null;
        const meta = (spec.meta ? spec.meta(item) : []).filter(Boolean);
        const body = (
          <>
            <div className={styles.rowHead}>
              <span className={styles.rowTitle}>{spec.primary(item)}</span>
              {st && <Badge size="sm" tone={STATUS_TONE[st] || 'neutral'} label={spec.statusLabel(st)} />}
            </div>
            {spec.secondary && shown(spec.secondary(item)) && <span className={styles.rowSub}>{spec.secondary(item)}</span>}
            {meta.length > 0 && <span className={styles.rowMeta}>{meta.join(' · ')}</span>}
          </>
        );
        return (
          <li key={i} className={styles.row}>
            {spec.onTap ? (
              <button type="button" className={styles.rowBtn} onClick={() => showToast(spec.onTap(item))}>{body}</button>
            ) : body}
          </li>
        );
      })}
    </ul>
  );
}

/** What stays on the computer, said once instead of a dead control. */
export function DesktopOnlyNote({ what }) {
  return (
    <p className={styles.note}>
      <Icon name="solar:monitor-linear" size={24} color="currentColor" />
      <span>Open on a computer to {what}.</span>
    </p>
  );
}

/** Ask Fold: the same natural-language box as the desktop slicer bar. */
export function AskFold() {
  const showToast = useAppStore(s => s.showToast);
  const [q, setQ] = useState('');
  const submit = (e) => {
    e.preventDefault();
    if (!q.trim()) return;
    showToast(`NLQ: "${q}"`);
    setQ('');
  };
  return (
    <form className={styles.ask} onSubmit={submit} role="search">
      <Input
        size="lg"
        aria-label="Ask Fold a question"
        placeholder="Ask Fold anything..."
        leadingIcon={<Icon name="custom:ai" size={20} />}
        value={q}
        onChange={e => setQ(e.target.value)}
        enterKeyHint="search"
      />
    </form>
  );
}

const quarterLabel = (v) => QUARTERS.find(x => x.value === v)?.label || v;

/**
 * Period and Practice, the desktop slicers that apply to every dashboard,
 * as chips that open bottom sheets. Same store setters as AnalyticsLayout.
 */
export function SlicerBar({ showPractice = true }) {
  const periodMode = useAppStore(s => s.analyticsPeriodMode);
  const quarter = useAppStore(s => s.analyticsQuarter);
  const practice = useAppStore(s => s.analyticsPractice);
  const setPeriodMode = useAppStore(s => s.setAnalyticsPeriodMode);
  const setQuarter = useAppStore(s => s.setAnalyticsQuarter);
  const setPractice = useAppStore(s => s.setAnalyticsPractice);
  const [sheet, setSheet] = useState(null);
  const modeLabel = PERIOD_MODES.find(m => m.key === periodMode)?.label || 'YTD';
  const practiceLabel = PRACTICES.find(p => p.value === practice)?.label || 'All Practices';

  return (
    <>
      <div className={styles.slicers}>
        <button type="button" className={styles.chipBtn} onClick={() => setSheet('period')} aria-haspopup="dialog">
          <Badge size="lg" variant="outline" label={`${modeLabel} · ${quarterLabel(quarter)}`} chevron />
        </button>
        {showPractice && (
          <button type="button" className={styles.chipBtn} onClick={() => setSheet('practice')} aria-haspopup="dialog">
            <Badge size="lg" variant={practice === 'all' ? 'outline' : 'soft'} tone={practice === 'all' ? 'neutral' : 'primary'} label={practice === 'all' ? 'Practice' : practiceLabel} chevron />
          </button>
        )}
      </div>

      {sheet === 'period' && (
        <BottomSheet title="Period" onClose={() => setSheet(null)}>
          <div className={styles.sheetBlock}>
            <SegmentedControl size="lg" fullWidth aria-label="Period" items={PERIOD_MODES} value={periodMode} onValueChange={setPeriodMode} />
          </div>
          <p className={styles.sheetLabel}>Quarter</p>
          {QUARTERS.map(q => (
            <BottomSheetItem
              key={q.value}
              icon="solar:calendar-minimalistic-linear"
              label={q.label}
              detail={q.value === quarter ? 'Selected' : undefined}
              onClick={() => { setQuarter(q.value); setSheet(null); }}
            />
          ))}
        </BottomSheet>
      )}
      {sheet === 'practice' && (
        <BottomSheet title="Practice" onClose={() => setSheet(null)}>
          {PRACTICES.map(p => (
            <BottomSheetItem
              key={p.value}
              icon={p.value === 'all' ? 'solar:buildings-2-linear' : 'solar:hospital-linear'}
              label={p.label}
              detail={p.value === practice ? 'Selected' : undefined}
              onClick={() => { setPractice(p.value); setSheet(null); }}
            />
          ))}
        </BottomSheet>
      )}
    </>
  );
}
