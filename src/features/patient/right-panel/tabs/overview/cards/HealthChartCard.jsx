import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip,
} from '../../../../../../components/LazyRecharts/LazyRecharts';
import { DashboardCard, DashboardCardBody } from '../../../../../../components/DashboardCard/DashboardCard';
import styles from './overviewCards.module.css';

const MAX_SCORE = 3;

export function HealthChartCard({ overview }) {
  const scores = overview?.healthScores || [];
  const overall = scores.length
    ? (scores.reduce((sum, s) => sum + Number(s.patient || 0), 0) / scores.length).toFixed(1)
    : null;
  const change = overview?.healthScoreChange;
  // Domains under the clinic average, furthest behind first.
  const behind = scores
    .map(s => ({ axis: s.axis, gap: Number(s.patient) - Number(s.clinic) }))
    .filter(s => Number.isFinite(s.gap) && s.gap < 0)
    .sort((a, b) => a.gap - b.gap);

  return (
    <DashboardCard
      icon="solar:radar-2-linear"
      title="Health Chart"
      footer={scores.length > 0 ? (
        <>
          <span>Overall health score</span>
          <span className={styles.spacer} />
          <span className={styles.scoreValue}>{overall} / {MAX_SCORE}</span>
          {change != null && change !== 0 && (
            <span className={change > 0 ? styles.textSuccess : styles.textError}>
              {change > 0 ? '▲' : '▼'} {Math.abs(change)}{overview.healthScoreSince ? ` since ${overview.healthScoreSince}` : ''}
            </span>
          )}
        </>
      ) : null}
    >
      <DashboardCardBody>
        {scores.length === 0 ? (
          <p className={styles.empty}>No health scores yet.</p>
        ) : (
          <>
            <div className={styles.radar} role="img" aria-label={`Health chart: ${scores.map(s => `${s.axis} ${s.patient} of ${MAX_SCORE}`).join(', ')}`}>
              <ResponsiveContainer width="100%" height="100%">
                {/* Radius leaves room for the longest axis label ("Musculoskeletal")
                    in the narrow 1/4 and 1/3 columns. */}
                <RadarChart data={scores} outerRadius="58%" margin={{ top: 8, right: 0, bottom: 8, left: 0 }}>
                  <PolarGrid stroke="var(--neutral-100)" strokeWidth={0.75} />
                  <PolarAngleAxis dataKey="axis" tick={{ fontSize: 'var(--font-xs)', fill: 'var(--neutral-200)' }} tickLine={false} />
                  <PolarRadiusAxis angle={90} domain={[0, MAX_SCORE]} tickCount={4} tick={false} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ stroke: 'var(--primary-200)', strokeWidth: 1 }} />
                  <Radar name="Clinic average" dataKey="clinic" stroke="var(--neutral-200)" strokeWidth={1} strokeDasharray="3 3" fill="var(--neutral-200)" fillOpacity={0.04} isAnimationActive={false} />
                  <Radar name="Patient" dataKey="patient" stroke="var(--primary-300)" strokeWidth={1.5} fill="var(--primary-300)" fillOpacity={0.15} dot={{ fill: 'var(--primary-300)', r: 2.5, strokeWidth: 0 }} isAnimationActive={false} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className={styles.legend}>
              <span className={styles.legendItem}><span className={styles.legendSwatch} aria-hidden="true" />Patient</span>
              <span className={styles.legendItem}><span className={`${styles.legendSwatch} ${styles.clinic}`} aria-hidden="true" />Clinic average</span>
            </div>
            {behind.length > 0 && (
              <p className={styles.behind}>
                <span className={styles.textWarning}>Below clinic average:</span>{' '}
                {behind.map(b => `${b.axis} (${b.gap.toFixed(1)})`).join(', ')}
              </p>
            )}
          </>
        )}
      </DashboardCardBody>
    </DashboardCard>
  );
}
