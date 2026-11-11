import { useState } from 'react';
import { Badge } from '@/components/Badge/Badge';
import { Button } from '@/components/Button/Button';
import { ActionButton } from '@/components/ActionButton/ActionButton';
import { Checkbox } from '@/components/Checkbox/Checkbox';
import { Icon } from '@/components/Icon/Icon';
import { AiSummarySkeleton } from '../summary/CarePlanAiSummary/CarePlanAiSummary';
import { actionText } from '../summary/CarePlanAiSummary/useCarePlanAiSummary';
import { goalProgressBand, goalProgressTone } from '../lib/goalMetrics';
import { fmtCarePlanDate } from '../tables/carePlanTableModel';
import styles from './CarePlanSummaryPanel.module.css';

const ROWS = [
  { kind: 'goal', label: 'Goals', key: 'goals', issue: 'off target', tone: 'danger' },
  { kind: 'intervention', label: 'Interventions', key: 'interventions', issue: 'overdue', tone: 'danger' },
  { kind: 'barrier', label: 'Barriers', key: 'barriers', issue: 'unaddressed', tone: 'warning' },
];
const BAND_TONE = { error: 'danger', warning: 'warning', success: 'success', grey: 'neutral' };
const NOUN = { goal: 'goal', intervention: 'intervention', barrier: 'barrier' };
const stamp = iso => (iso
  ? new Date(iso).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  : '');

function reviewLine(review) {
  const s = review?.status;
  if (!s) return null;
  const last = review.lastReview ? `Last ${fmtCarePlanDate(review.lastReview)}` : 'Not reviewed yet';
  const cadence = review.cadence?.label ? ` • ${review.cadence.label}` : '';
  if (s.state === 'overdue') return { tone: 'danger', title: `Review overdue by ${s.daysOverdue} ${s.daysOverdue === 1 ? 'day' : 'days'}`, sub: `${last}${cadence}` };
  if (s.state === 'due') return { tone: 'warning', title: 'Review due today', sub: `${last}${cadence}` };
  if (s.state === 'upcoming') return { tone: 'neutral', title: `Next review ${fmtCarePlanDate(review.due)}`, sub: `${last}${cadence}` };
  return { tone: 'neutral', title: 'No review scheduled', sub: 'The cadence starts once the plan is signed' };
}

/**
 * The care plan's left column on wide screens (care plan redesign
 * prototype): the plan at a glance (average goal progress, goals,
 * interventions and barriers with what needs attention, where the review
 * stands), the Unity summary, and the recent notes.
 *
 * Rendered by CarePlanOverview, which owns the summary, notes and cadence
 * state, into the column CarePlanView lays out. A count with an issue
 * toggles the Needs Attention filter.
 */
export function CarePlanSummaryPanel({
  totals, attention, attentionOn, onToggleAttention, review, onOpenCadence,
  summary, canEdit, onOpenItem, recentNotes, onAddNote,
}) {
  const band = goalProgressBand(totals.avgProgress);
  const rv = reviewLine(review);
  const { state, data, entry, stale, actions, done, toggleDone, itemFor, isEmpty } = summary;
  // The column is narrow: the intro and action items show, the detail on ask.
  const [details, setDetails] = useState(false);
  return (
    <div className={styles.panel}>
      <section className={styles.block} aria-label="Summary">
        <h3 className={styles.head}>Summary</h3>
        <div className={styles.card}>
          <div className={styles.progress}>
            <span className={styles.pct}>{totals.avgProgress}%</span>
            <Badge size="sm" tone={BAND_TONE[goalProgressTone(band)]} label={band} />
          </div>
          <span className={styles.bar} aria-hidden="true">
            <span className={styles[`bar_${goalProgressTone(band)}`]} style={{ width: `${Math.min(100, totals.avgProgress)}%` }} />
          </span>
          <span className={styles.label}>Average goal progress</span>

          <ul className={styles.rows}>
            {ROWS.map(r => {
              const n = attention.filter(a => a.kind === r.kind).length;
              const body = (
                <>
                  <span className={styles.n}>{totals[r.key]}</span>
                  <span className={styles.rowLabel}>{r.label}</span>
                  <span className={n ? styles[`issue_${r.tone}`] : styles.ok}>{n ? `${n} ${r.issue}` : 'On track'}</span>
                </>
              );
              return (
                <li key={r.kind}>
                  {n ? (
                    <button
                      type="button"
                      className={styles.row}
                      aria-pressed={attentionOn}
                      title={attentionOn ? 'Show all items' : 'Show only what needs attention'}
                      onClick={onToggleAttention}
                    >
                      {body}
                    </button>
                  ) : <div className={styles.row}>{body}</div>}
                </li>
              );
            })}
          </ul>

          {rv && (
            <button type="button" className={styles.review} onClick={onOpenCadence} title="Open Review Cadence">
              <Badge size="sm" tone={rv.tone} label={rv.title} />
              <span className={styles.label}>{rv.sub}</span>
            </button>
          )}
        </div>
      </section>

      {summary.show && (
        <section className={`${styles.block} ${styles.unity}`} aria-label="Unity Summary">
          <div className={styles.unityHead}>
            <Icon name="custom:ai" size={16} color="var(--primary-300)" />
            <h3 className={styles.unityTitle}>Unity Summary</h3>
            {state === 'ready' && data && (
              <span className={styles.unityTools}>
                <ActionButton icon="solar:copy-linear" size="sm" tooltip="Copy summary" onClick={summary.copy} />
                <ActionButton icon="solar:refresh-linear" size="sm" tooltip="Write it again" onClick={summary.regenerate} />
              </span>
            )}
          </div>
          {state === 'loading' && <AiSummarySkeleton />}
          {state === 'idle' && (
            <div className={styles.unityEmpty}>
              <p className={styles.text}>{summary.error || 'Unity reads the goals, interventions and barriers and lists what needs doing next.'}</p>
              {canEdit && !isEmpty && (
                <Button variant="soft" size="sm" leadingIcon="custom:ai" onClick={summary.generate}>
                  {summary.error ? 'Try Again' : 'Summarize'}
                </Button>
              )}
            </div>
          )}
          {state === 'ready' && data && (
            <>
              {data.intro && <p className={styles.text}>{data.intro}</p>}
              {data.points?.length > 0 && details && (
                <ul className={styles.points}>
                  {data.points.map((p, i) => <li key={i}><strong>{p.title}:</strong> {p.body}</li>)}
                </ul>
              )}
              {data.points?.length > 0 && (
                <button type="button" className={styles.link} aria-expanded={details} onClick={() => setDetails(v => !v)}>
                  {details ? 'Hide Details' : `Show Details (${data.points.length})`}
                </button>
              )}
              {actions.length > 0 && (
                <ul className={styles.actionList} aria-label="Action items">
                  {actions.map((a, i) => {
                    const item = itemFor(a);
                    const isDone = done.has(i);
                    return (
                      <li key={i} className={`${styles.action} ${isDone ? styles.actionDone : ''}`}>
                        <Checkbox
                          checked={isDone}
                          onCheckedChange={() => toggleDone(i)}
                          disabled={!canEdit}
                          aria-label={isDone ? 'Mark not done' : 'Mark done'}
                        />
                        {item ? (
                          <button type="button" className={styles.actionLink} onClick={() => onOpenItem(a.refType, item)} title={`Open ${NOUN[a.refType]}`}>
                            {actionText(a)}
                          </button>
                        ) : <span className={styles.actionText}>{actionText(a)}</span>}
                      </li>
                    );
                  })}
                </ul>
              )}
              <span className={styles.meta}>
                {entry?.generatedAt ? `Summarized ${stamp(entry.generatedAt)}` : 'Summarized'}
                {stale ? ' • Plan changed since' : ''}
              </span>
            </>
          )}
        </section>
      )}

      <section className={styles.block} aria-label="Recent Notes">
        <div className={styles.notesHead}>
          <h3 className={styles.head}>Recent Notes</h3>
          {canEdit && <button type="button" className={styles.link} onClick={onAddNote}>Add Note</button>}
        </div>
        {recentNotes.length === 0 ? (
          <p className={styles.empty}>No notes on goals, interventions or barriers yet.</p>
        ) : recentNotes.map(n => (
          <button key={n.id} type="button" className={styles.note} onClick={() => onOpenItem?.(n.kind, n.item)}>
            <span className={styles.noteSource}>{n.source}</span>
            <span className={styles.noteText}>{n.text}</span>
            <span className={styles.meta}>{n.actor} • {stamp(n.createdAt)}</span>
          </button>
        ))}
      </section>
    </div>
  );
}
