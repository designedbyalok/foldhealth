/**
 * Insight tab: form-level overview: question count, completion rate, response
 * count, a Responded/In-Progress/Not-Started donut, the average-score trend,
 * and one card per score group with its mean + interpretation band.
 */
import { Icon } from '../../../components/Icon/Icon';
import { DonutChart, AvgScoreLineChart } from './FormCharts';
import { completionStats, scoreGroupStats, averageScoreSeries, dropOffStats } from './aggregate';
import { SEV_COLOR, dateRangeLabel } from './formAnalyticsUi';
import styles from './FormAnalyticsPanel.module.css';

const RESP_COLORS = ['#7FD1B0', '#E0B27C'];

export function InsightView({ fields, scoring, completed, pending, onViewResponses }) {
  const all = [...completed, ...pending];
  const c = completionStats(fields, completed);
  const drop = dropOffStats(completed, pending);
  const groups = scoreGroupStats(scoring, completed);
  const series = averageScoreSeries(scoring, completed);

  const donutData = [
    { label: 'Completed', count: drop.completed },
    { label: 'In Progress', count: drop.pending },
  ];

  return (
    <div className={styles.scrollInner}>
      <div className={styles.viewHead}>
        <span className={styles.viewTitle}>Form Insights</span>
        <span className={styles.rangeChip}>
          {dateRangeLabel(all)}
          <Icon name="solar:calendar-linear" size={15} color="var(--neutral-300)" />
        </span>
      </div>

      {/* Top stat cards */}
      <div className={styles.statRow}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Questions</span>
          <span className={styles.statValue}>{c.questionCount}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Completion Rate</span>
          <span className={styles.statValue}>{c.completionRate}%</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Responses</span>
          <span className={styles.statValue}>{drop.completed}</span>
          <button className={styles.statLink} onClick={onViewResponses}>View all</button>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Drop-off Rate</span>
          <span className={styles.statValue} style={{ color: drop.dropOffRate > 0 ? 'var(--status-warning)' : 'var(--neutral-500)' }}>{drop.dropOffRate}%</span>
          <span className={styles.statSub}>{drop.pending} of {drop.started} left incomplete</span>
        </div>
      </div>

      {/* Donut + average score */}
      <div className={styles.twoCol}>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div>
              <div className={styles.cardTitle}>Form Responses</div>
              <div className={styles.cardSub}>Completed vs in-progress fills</div>
            </div>
            <div className={styles.totalUsers}>
              <span className={styles.totalUsersLabel}>Total Started</span>
              <span className={styles.totalUsersValue}>{drop.started}</span>
            </div>
          </div>
          {drop.started === 0 ? (
            <div className={styles.emptyAnswers}>No responses yet.</div>
          ) : (
            <div className={styles.donutBlock}>
              <DonutChart data={donutData} colors={RESP_COLORS} />
              <div className={styles.donutLegend}>
                {donutData.map((d, i) => (
                  <div key={d.label} className={styles.legendItem}>
                    <span className={styles.legendTop}>
                      <span className={styles.legendDot} style={{ background: RESP_COLORS[i] }} />
                      {d.label}
                    </span>
                    <span className={styles.legendVal}>{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div>
              <div className={styles.cardTitle}>Average Score</div>
              <div className={styles.cardSub}>{dateRangeLabel(all)}</div>
            </div>
            <div className={styles.cardActions}>
              <Icon name="solar:info-circle-linear" size={18} />
            </div>
          </div>
          {series.length ? (
            <AvgScoreLineChart data={series} />
          ) : (
            <div className={styles.emptyAnswers}>
              {scoring?.scores?.length ? 'No scored responses yet.' : 'No scores defined for this form.'}
            </div>
          )}
        </div>
      </div>

      {/* Score groups */}
      {groups.length > 0 && (
        <>
          <span className={styles.sectionLabel}>Score Groups</span>
          <div className={styles.scoreGroupRow}>
            {groups.map((g) => (
              <div key={g.id} className={styles.sgCard}>
                <span className={styles.sgName}>{g.label}</span>
                <div className={styles.sgFooter}>
                  <div className={styles.sgCol}>
                    <span className={styles.sgKey}>Average Score</span>
                    <span className={styles.sgVal}>{g.average == null ? '-' : Math.round(g.average * 10) / 10}</span>
                  </div>
                  <div className={`${styles.sgCol} ${styles.sgColRight}`}>
                    <span className={styles.sgKey}>Interpretation</span>
                    <span className={styles.sgInterp} style={{ color: g.band ? SEV_COLOR[g.band.severity] : 'var(--neutral-300)' }}>
                      {g.band?.label || '-'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default InsightView;
