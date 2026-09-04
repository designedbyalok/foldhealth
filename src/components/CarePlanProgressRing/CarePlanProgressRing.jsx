import styles from './CarePlanProgressRing.module.css';

/** Small in-pill radial: ring outlining a pie whose sweep matches the
 *  percentage. Stroke / fill inherit the pill's `color`, so the pill can
 *  swap tone by setting `color` on the wrapper. Figma 4539:72258 / 72269
 *  / 72273 / 72277. */
function PillProgressRing({ pct }) {
  const c = 8;
  const r = 7;
  const theta = (pct / 100) * 2 * Math.PI;
  const x = c + r * Math.sin(theta);
  const y = c - r * Math.cos(theta);
  const largeArc = theta > Math.PI ? 1 : 0;
  const pie = pct >= 100
    ? `M${c} ${c} L${c} ${c - r} A${r} ${r} 0 1 1 ${c - 0.001} ${c - r} Z`
    : pct > 0
      ? `M${c} ${c} L${c} ${c - r} A${r} ${r} 0 ${largeArc} 1 ${x} ${y} Z`
      : '';
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx={c} cy={c} r={r} fill="none" stroke="currentColor" strokeWidth="1" />
      {pie && <path d={pie} fill="currentColor" />}
    </svg>
  );
}

/** Paper ProgressRing (Fold Design System → Care Plan → 2X-0), 46×46. */
const TRACK_SIZE = 37.41;
const TRACK_PATH =
  'M18.707 0C29.038 0 37.413 8.375 37.413 18.707C37.413 29.038 29.038 37.413 18.707 37.413C8.375 37.413 0 29.038 0 18.707C0 8.375 8.375 0 18.707 0ZM18.707 4.159C10.672 4.159 4.159 10.672 4.159 18.707C4.159 26.741 10.672 33.254 18.707 33.254C26.741 33.254 33.254 26.741 33.254 18.707C33.254 10.672 26.741 4.159 18.707 4.159Z';

const PROGRESS_SIZE = 36.19;
const CX = PROGRESS_SIZE / 2;
const R_OUTER = CX;
const R_INNER = CX - 2.894;
const STROKE = R_OUTER - R_INNER;
const R_MID = (R_OUTER + R_INNER) / 2;
const CIRC = 2 * Math.PI * R_MID;

const COMPACT = { dim: 24, stroke: 2.5, r: 9.75 };

function clampPct(progress) {
  return Math.round(Math.max(0, Math.min(100, Number(progress) || 0)));
}

function progressTone(pct) {
  if (pct >= 80) return 'var(--status-success)';
  if (pct >= 40) return 'var(--status-warning-dark)';
  return 'var(--neutral-200)';
}

/** Threshold palette for the pill variant (Figma 4539:72258 / 72269 /
 *  72273 / 72277): quiet neutral for the "not started" 0% state, then
 *  the tinted red / warning / success surfaces for progress. */
function progressPillTone(pct) {
  if (pct === 0) return { bg: 'var(--neutral-50)', ink: 'var(--neutral-300)' };
  if (pct <= 40) return { bg: 'var(--status-error)', ink: 'var(--neutral-0)' };
  if (pct <= 75) return { bg: 'var(--status-warning)', ink: 'var(--neutral-0)' };
  return { bg: 'var(--status-success)', ink: 'var(--neutral-0)' };
}

function ProgressBarCompact({ pct, label, className }) {
  const tone = progressPillTone(pct);
  return (
    <div
      className={[styles.pill, className].filter(Boolean).join(' ')}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      style={{ background: tone.bg, color: tone.ink }}
    >
      <PillProgressRing pct={pct} />
      <span className={styles.pillLabel}>{pct}%</span>
    </div>
  );
}

function ProgressRingCompact({ pct, label, className }) {
  const { dim, stroke, r } = COMPACT;
  const cx = dim / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  const tone = progressTone(pct);

  return (
    <div
      className={[styles.shellCompact, className].filter(Boolean).join(' ')}
      role="img"
      aria-label={label}
    >
      <svg viewBox={`0 0 ${dim} ${dim}`} width={dim} height={dim} aria-hidden="true">
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--neutral-100)" strokeWidth={stroke} />
        {pct > 0 && (
          <circle
            cx={cx}
            cy={cx}
            r={r}
            fill="none"
            stroke={tone}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${cx} ${cx})`}
          />
        )}
      </svg>
      <span className={styles.labelCompact}>{pct}%</span>
    </div>
  );
}

function ProgressRingMedium({ pct, label, className }) {
  const offset = CIRC * (1 - pct / 100);

  return (
    <div
      className={[styles.shell, className].filter(Boolean).join(' ')}
      role="img"
      aria-label={label}
    >
      <svg
        className={styles.track}
        viewBox={`0 0 ${TRACK_SIZE} ${TRACK_SIZE}`}
        width={TRACK_SIZE}
        height={TRACK_SIZE}
        aria-hidden="true"
      >
        <path d={TRACK_PATH} fill="var(--neutral-75)" fillRule="nonzero" />
      </svg>
      {pct > 0 && (
        <svg
          className={styles.progress}
          viewBox={`0 0 ${PROGRESS_SIZE} ${PROGRESS_SIZE}`}
          width={PROGRESS_SIZE}
          height={PROGRESS_SIZE}
          aria-hidden="true"
        >
          <circle
            cx={CX}
            cy={CX}
            r={R_MID}
            fill="none"
            stroke="var(--status-warning-dark)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${CX} ${CX})`}
          />
        </svg>
      )}
      <span className={styles.label}>{pct}%</span>
    </div>
  );
}

/**
 * CarePlanProgressRing — goal/intervention progress indicator.
 *
 * @param {'bar'|'ring'} variant — bar for dense tables; ring for drawers and cards.
 * @param {'S'|'M'} size — ring sizes only: S (24px), M (46px).
 */
export function CarePlanProgressRing({ progress = 0, variant = 'ring', size = 'M', className, title }) {
  const pct = clampPct(progress);
  const label = title ?? `${pct}% progress`;

  if (variant === 'bar') {
    return <ProgressBarCompact pct={pct} label={label} className={className} />;
  }

  if (size === 'S') {
    return <ProgressRingCompact pct={pct} label={label} className={className} />;
  }

  return <ProgressRingMedium pct={pct} label={label} className={className} />;
}
