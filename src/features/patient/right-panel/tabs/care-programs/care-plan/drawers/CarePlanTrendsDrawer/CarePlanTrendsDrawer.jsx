import { useMemo } from 'react';
import { Drawer } from '../../../../../../../../components/Drawer/Drawer';
import { Badge } from '../../../../../../../../components/Badge/Badge';
import styles from './CarePlanTrendsDrawer.module.css';

const sparkNum = (v) => {
  const m = String(v ?? '').match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : NaN;
};

function Sparkline({ values }) {
  const nums = values.map(sparkNum).filter(n => !Number.isNaN(n));
  if (nums.length < 2) return <span className={styles.sparkEmpty}>—</span>;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1;
  const w = 96, h = 40, padX = 8, padY = 6;
  const step = (w - padX * 2) / (nums.length - 1);
  const pts = nums.map((n, i) => ({ x: padX + i * step, y: h - padY - ((n - min) / span) * (h - padY * 2) }));
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={styles.spark} aria-hidden="true">
      {pts.map((p, i) => {
        const last = i === pts.length - 1;
        return (
          <g key={i}>
            <line x1={p.x} y1={h - padY} x2={p.x} y2={p.y} stroke={last ? 'var(--accent-blue)' : 'var(--neutral-150)'} strokeWidth="1" strokeLinecap="round" />
            <circle cx={p.x} cy={p.y} r={last ? 2.5 : 2} fill={last ? 'var(--accent-blue)' : 'var(--neutral-200)'} />
          </g>
        );
      })}
    </svg>
  );
}

function TrendBadge({ trend }) {
  if (!trend || trend === '-') return <span className={styles.dash}>—</span>;
  const tone = trend === '↑' ? 'success' : trend === '↓' ? 'error' : 'grey';
  const icon = trend === '↑' ? 'solar:arrow-up-linear' : trend === '↓' ? 'solar:arrow-down-linear' : 'solar:minus-circle-linear';
  return <Badge tone={tone} size="S" icon={icon} />;
}

/**
 * Goal Trends — a read-only roll-up of every goal's recorded readings across the
 * plan, so a clinician can scan progress without opening each goal. Readings
 * come from patient_care_plan_goal_measurements (persisted).
 */
export function CarePlanTrendsDrawer({ goals = [], measurements = [], onClose }) {
  const byGoal = useMemo(() => {
    const m = new Map();
    for (const r of measurements) (m.get(r.goalId) || m.set(r.goalId, []).get(r.goalId)).push(r);
    for (const arr of m.values()) arr.sort((a, b) => new Date(a.takenAt || 0) - new Date(b.takenAt || 0));
    return m;
  }, [measurements]);

  const withReadings = goals.filter(g => (byGoal.get(g.id) || []).length > 0);
  const without = goals.filter(g => (byGoal.get(g.id) || []).length === 0);

  return (
    <Drawer title="Goal Trends" onClose={onClose}>
      <div className={styles.body}>
        {withReadings.length === 0 ? (
          <p className={styles.empty}>No goal readings recorded yet. Add readings from a goal&apos;s details and they&apos;ll trend here.</p>
        ) : (
          withReadings.map(g => {
            const rows = byGoal.get(g.id) || [];
            const latest = g.currentValue || rows[rows.length - 1]?.value || '';
            return (
              <div key={g.id} className={styles.row}>
                <div className={styles.info}>
                  <span className={styles.title}>{g.title}</span>
                  <span className={styles.meta}>
                    {rows.length} reading{rows.length === 1 ? '' : 's'}{latest ? ` · latest ${latest}` : ''}
                  </span>
                </div>
                <TrendBadge trend={g.trend} />
                <Sparkline values={rows.map(r => r.value)} />
              </div>
            );
          })
        )}

        {without.length > 0 && (
          <div className={styles.section}>
            <span className={styles.sectionLabel}>No readings yet</span>
            {without.map(g => <div key={g.id} className={styles.rowMuted}>{g.title}</div>)}
          </div>
        )}
      </div>
    </Drawer>
  );
}
