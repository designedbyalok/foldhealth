import { Icon } from '../../../components/Icon/Icon';
import { AiInsightIcon } from '../../../components/Icon/AiInsightIcon';
import { Button } from '../../../components/Button/Button';
import { useAppStore } from '../../../store/useAppStore';
import { sanitizeRichText } from '../../../lib/sanitizeHtml';
import s from '../AnalyticsLayout.module.css';

// ─── Safe data extractors ───
// fetchProgressBars returns { items: [...] } from DB, but fallback is a plain array.
export function safeBarItems(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.items)) return data.items;
  return [];
}

// fetchConfig returns { configData: {...} } from DB, but fallback is the config object directly.
export function safeConfigData(data, fallback) {
  if (!data) return fallback || {};
  // DB shape: { configData: { ... } }
  if (data.configData && typeof data.configData === 'object') return data.configData;
  // Fallback shape: the config object itself (has domain-specific keys like levers, pipelines, etc.)
  return data;
}

// fetchViewTable returns { rows: [...] } from both DB and fallback, but guard anyway.
export function safeTableRows(data, fallbackRows) {
  if (!data) return fallbackRows || [];
  if (Array.isArray(data.rows)) return data.rows;
  if (Array.isArray(data)) return data;
  return fallbackRows || [];
}

// ─── Skeletons (shimmer loaders) ───
// Per-shape placeholders used while a Supabase fetch is in flight.
// Convention: views start data state at `null` (= loading) and the
// fetch resolves it to either real data or an empty shape. Render
// these when the state is still null.

function Bar({ w = '60%', h = 12, style }) {
  // Single shimmer rectangle. Sized via CSS width/height to match
  // the real content metric (KPI label height, chart axis height, etc.).
  return <div className={s.shimmer} style={{ width: w, height: h, ...style }} />;
}

export function KpiSkeleton({ count = 4 }) {
  return (
    <div className={s.kpiGrid} style={{ gridTemplateColumns: `repeat(${count}, 1fr)` }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={s.skeletonKpi}>
          <Bar w="55%" h={11} />
          <Bar w="80%" h={26} />
          <Bar w="40%" h={10} />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 5 }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className={s.skeletonRow}>
          {Array.from({ length: cols }).map((_, c) => (
            <Bar key={c} w={c === 0 ? '20%' : '14%'} h={12} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton({ bars = 12 }) {
  // Simulates bar heights that approximate a chart silhouette so the
  // placeholder reads as "a chart, loading" rather than a generic block.
  const heights = Array.from({ length: bars }, (_, i) =>
    30 + Math.round(60 * Math.abs(Math.sin((i / bars) * Math.PI * 1.4)))
  );
  return (
    <div className={s.skeletonChart}>
      {heights.map((h, i) => (
        <div key={i} className={`${s.shimmer} ${s.skeletonBar}`} style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

export function ProgressBarSkeleton({ count = 4 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 0' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Bar w="35%" h={11} />
            <Bar w="15%" h={11} />
          </div>
          <Bar w="100%" h={6} style={{ borderRadius: 3 }} />
        </div>
      ))}
    </div>
  );
}

// ─── Empty state ───
// Drop-in placeholder for tables / charts that have no data to render.
// Use `colSpan` when placed inside a <tbody> for a table; otherwise pass nothing
// and it renders a standalone centered block.
export function EmptyState({ message = 'No data available', icon = 'solar:chart-line-linear', colSpan }) {
  const body = (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 8, padding: '32px 16px', color: 'var(--neutral-300)',
      fontSize: 13, textAlign: 'center',
    }}>
      <Icon name={icon} size={24} color="var(--neutral-200)" />
      <span>{message}</span>
    </div>
  );
  if (colSpan) {
    return (
      <tr><td colSpan={colSpan} style={{ padding: 0 }}>{body}</td></tr>
    );
  }
  return body;
}

// ─── KPI Card ───
export function KpiCard({ value, label, delta, deltaType = 'pos', sub, accentColor }) {
  return (
    <div className={s.kpiCard}>
      <div className={s.kpiEyebrow}>{label}</div>
      <div className={s.kpiHero}>{value}</div>
      {delta && (
        <span className={`${s.kpiDelta} ${s[deltaType]}`}>
          {deltaType === 'pos' ? (
            <Icon name="solar:alt-arrow-up-linear" size={10} />
          ) : deltaType === 'neg' ? (
            <Icon name="solar:alt-arrow-down-linear" size={10} />
          ) : (
            <Icon name="solar:minus-circle-linear" size={10} />
          )} {delta}
        </span>
      )}
      {sub && <div className={s.kpiSub}>{sub}</div>}
      {accentColor && <div className={s.kpiAccent} style={{ background: accentColor }} />}
    </div>
  );
}

// ─── Insight Banner ───
export function InsightBanner({ icon, title, text, variant = '', buttons = [], showToast }) {
  const setAnalyticsView = useAppStore(st => st.setAnalyticsView);

  const handleButtonClick = (b) => {
    if (b.navTo) {
      setAnalyticsView(b.navTo);
    } else {
      showToast?.(b.toast || b.label);
    }
  };

  return (
    <div className={`${s.insight} ${variant ? s[variant] : ''}`}>
      <div className={icon?.includes('lightbulb') ? s.insightIconAi : s.insightIcon}>
        {icon?.includes('lightbulb') ? (
          <AiInsightIcon size={20} />
        ) : (
          <Icon name={icon} size={16} color={
            variant === 'amber' ? 'var(--status-warning)' : variant === 'red' ? 'var(--status-error)' : variant === 'green' ? 'var(--status-success)' : 'var(--primary-300)'
          } />
        )}
      </div>
      <div className={s.insightBody}>
        <div className={s.insightEyebrow}>{title}</div>
        {/* Insight copy carries inline <strong> and arrives from Supabase, so
            it is sanitized rather than trusted verbatim. */}
        <div className={s.insightText} dangerouslySetInnerHTML={{ __html: sanitizeRichText(text) }} />
        {buttons.length > 0 && (
          <div className={s.insightBtns}>
            {buttons.map((b, i) => (
              <Button
                key={i}
                variant={b.primary ? 'primary' : 'secondary'}
                size="S"
                onClick={() => handleButtonClick(b)}
              >
                {b.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Card ───
// flush=true removes padding (for tables that go edge-to-edge)
export function Card({ title, sub, actions, children, style, flush }) {
  return (
    <div className={s.card} style={style}>
      {title && (
        <div className={s.cardHeader}>
          <span className={s.cardTitle}>{title}</span>
          {sub && <span className={s.cardSub}>{sub}</span>}
          {actions && <div className={s.cardActions}>{actions}</div>}
        </div>
      )}
      <div className={flush ? s.cardBodyFlush : s.cardBody}>{children}</div>
    </div>
  );
}

// ─── Progress Bar ───
export function ProgressBar({ label, value, pct, color = 'purple', sub }) {
  return (
    <div className={s.prRow}>
      <div className={s.prHead}>
        <span className={s.prLabel}>{label}</span>
        <span className={s.prValue}>{value}</span>
      </div>
      <div className={s.prTrack}>
        <div className={`${s.prFill} ${s[color]}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      {sub && <div className={s.prSub}>{sub}</div>}
    </div>
  );
}

// ─── Status Pill ───
export function StatusPill({ label, variant = 'green' }) {
  const cls = variant === 'green' ? s.stGreen : variant === 'amber' ? s.stAmber : variant === 'red' ? s.stRed : s.stNeutral;
  return <span className={`${s.stPill} ${cls}`}>{label}</span>;
}

// ─── Tag ───
export function Tag({ label, variant = 'stars' }) {
  const cls = variant === 'stars' ? s.tagStars : variant === 'hedis' ? s.tagHedis : s.tagAco;
  return <span className={`${s.tag} ${cls}`}>{label}</span>;
}

// ─── Button helpers (thin wrappers around shared Button component) ───
export function GhostBtn({ label, onClick }) {
  return <Button variant="ghost" size="S" onClick={onClick}>{label}</Button>;
}
export function PrimaryBtn({ label, onClick }) {
  return <Button variant="primary" size="S" onClick={onClick}>{label}</Button>;
}
