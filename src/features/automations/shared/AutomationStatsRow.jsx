import { useMemo } from 'react';
import { Badge } from '../../../components/Badge/Badge';
import { executionTypeOf, scheduleLabel } from '../lib/catalog';
import { avgExecutionMinutes, formatDurationMinutes } from '../lib/analytics';
import styles from './AutomationStatsRow.module.css';

const fmt = (iso) => (iso
  ? new Date(iso).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  : '-');

/**
 * The label/value strip under an automation's title (quick view, analytics):
 * audience, execution type, frequency, runs, average execution time, last run.
 * Figures come from the last 90 days of records (`runs`, `members`).
 */
export function AutomationStatsRow({ automation, runs = [], members = [] }) {
  const audience = useMemo(() => new Set(members.map(m => m.patientId)).size, [members]);
  const avg = useMemo(() => avgExecutionMinutes(members), [members]);
  const last = runs[0];
  const items = [
    { label: 'Target audience', value: audience.toLocaleString('en-US'), hint: 'Members reached in the last 90 days' },
    { label: 'Execution type', value: executionTypeOf(automation.schedule) },
    { label: 'Frequency', value: scheduleLabel(automation.schedule) },
    { label: 'Executed', value: `${runs.length.toLocaleString('en-US')} time${runs.length === 1 ? '' : 's'}` },
    { label: 'Avg. exe. time', value: formatDurationMinutes(avg) },
    {
      label: 'Last executed',
      value: last ? fmt(last.startedAt) : 'Not run yet',
      badge: last ? (last.failedCount ? { tone: 'error', label: `${last.failedCount} failed` } : { tone: 'success', label: 'Success' }) : null,
    },
  ];
  return (
    <dl className={styles.row}>
      {items.map(it => (
        <div key={it.label} className={styles.item} title={it.hint}>
          <dt className={styles.label}>{it.label}</dt>
          <dd className={styles.value}>
            {it.value}
            {it.badge && <Badge size="sm" tone={it.badge.tone} label={it.badge.label} />}
          </dd>
        </div>
      ))}
    </dl>
  );
}
