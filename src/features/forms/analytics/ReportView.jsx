/**
 * Report tab: question-wise breakdown. One card per question: choice questions
 * get a distribution donut + legend + "Most Voted"; NPS questions get the
 * score, its three groups and the 0–10 spread; numeric questions get a
 * votes bar chart; free-text questions list the answers (with Show more).
 */
import { useMemo, useState } from 'react';
import { Icon } from '../../../components/Icon/Icon';
import { DonutChart, VotesBarChart } from './FormCharts';
import { leafFields, questionStats, perQuestionDropoff, formatNps } from './aggregate';
import { fieldIcon, SERIES_COLORS } from './formAnalyticsUi';
import styles from './FormAnalyticsPanel.module.css';

function ChoiceBreakdown({ stats }) {
  const data = stats.distribution.map((d, i) => ({ ...d, color: SERIES_COLORS[i % SERIES_COLORS.length] }));
  const top = stats.mostVoted;
  return (
    <div className={styles.choiceGrid}>
      <div className={styles.choiceLegend}>
        {data.map((d, i) => (
          <div key={i} className={`${styles.choiceRow} ${top && d.label === top.label && top.count > 0 ? styles.choiceRowTop : ''}`}>
            <span className={styles.legendDot} style={{ background: d.color }} />
            <span className={styles.choiceLabel}>{d.label}</span>
            <span className={styles.choiceCount}>{d.count}</span>
          </div>
        ))}
      </div>
      <DonutChart data={data} height={180} innerRadius={46} outerRadius={78} />
      {top && top.count > 0 && (
        <span className={styles.mostVoted}>Most Voted:<strong>{top.label}</strong></span>
      )}
    </div>
  );
}

function NumericBreakdown({ stats }) {
  return (
    <div className={styles.choiceGrid} style={{ gridTemplateColumns: '1fr auto' }}>
      <VotesBarChart data={stats.distribution} />
      {stats.mostVoted && stats.mostVoted.count > 0 && (
        <span className={styles.mostVoted}>Most Voted:<strong>{stats.mostVoted.label}</strong></span>
      )}
    </div>
  );
}

// Same tones as the NPS tiles, so a group reads the same in the form and here.
const NPS_GROUPS = [
  { key: 'promoter', label: 'Promoters (9–10)', color: 'var(--status-success-dark)' },
  { key: 'passive', label: 'Passives (7–8)', color: 'var(--status-warning-dark)' },
  { key: 'detractor', label: 'Detractors (0–6)', color: 'var(--status-error-dark)' },
];

/** NPS: the score, each group's share, and how the 0–10 answers spread. */
function NpsBreakdown({ stats }) {
  const { nps } = stats;
  const pct = (n) => (nps.total ? `${Math.round((n / nps.total) * 100)}%` : '0%');
  return (
    <div className={styles.choiceGrid}>
      <div className={styles.choiceLegend}>
        {NPS_GROUPS.map((g) => (
          <div key={g.key} className={styles.choiceRow}>
            <span className={styles.legendDot} style={{ background: g.color }} />
            <span className={styles.choiceLabel}>{g.label}</span>
            <span className={styles.choiceCount}>{nps[g.key]} · {pct(nps[g.key])}</span>
          </div>
        ))}
      </div>
      <VotesBarChart data={stats.distribution} />
      <span className={styles.mostVoted}>NPS:<strong>{formatNps(nps.score)}</strong></span>
    </div>
  );
}

function TextBreakdown({ stats }) {
  const [expanded, setExpanded] = useState(false);
  if (!stats.answers.length) return <div className={styles.emptyAnswers}>No answers yet.</div>;
  const shown = expanded ? stats.answers : stats.answers.slice(0, 3);
  return (
    <div className={styles.answerList}>
      {shown.map((a, i) => <div key={i} className={styles.answerRow}>{a}</div>)}
      {stats.answers.length > 3 && (
        <button className={styles.showMore} onClick={() => setExpanded((e) => !e)}>
          {expanded ? 'Show less' : `Show more (${stats.answers.length - 3})`}
        </button>
      )}
    </div>
  );
}

const EMPTY_PENDING = [];

export function ReportView({ fields, responses, pending = EMPTY_PENDING }) {
  const leaves = leafFields(fields);
  const dropMap = useMemo(() => {
    const m = {};
    perQuestionDropoff(fields, responses, pending).forEach((d) => { m[d.linkId] = d; });
    return m;
  }, [fields, responses, pending]);

  return (
    <div className={styles.scrollInner}>
      <div className={styles.viewHead}>
        <span className={styles.viewTitle}>Question Wise Report</span>
      </div>

      {leaves.map((field) => {
        const stats = questionStats(field, responses);
        const drop = dropMap[field.linkId];
        return (
          <div key={field.linkId} className={styles.qCard}>
            <div className={styles.qHead}>
              <span className={styles.qIcon}><Icon name={fieldIcon(field)} size={16} color="#fff" /></span>
              <div className={styles.qHeadText}>
                <div className={styles.qText}>{field.text}{field.required && <span className={styles.qReq}>*</span>}</div>
                <div className={styles.qMeta}>
                  {stats.answeredCount} out of {stats.total} {stats.total === 1 ? 'person' : 'people'} answered this question
                  {drop && drop.dropped > 0 && (
                    <span className={styles.qDropoff}>
                      <Icon name="solar:arrow-down-linear" size={12} color="var(--status-warning)" />
                      {drop.dropOff}% dropped off here
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className={styles.qBody}>
              {stats.kind === 'nps' && <NpsBreakdown stats={stats} />}
              {stats.kind === 'choice' && <ChoiceBreakdown stats={stats} />}
              {stats.kind === 'numeric' && <NumericBreakdown stats={stats} />}
              {stats.kind === 'text' && <TextBreakdown stats={stats} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ReportView;
