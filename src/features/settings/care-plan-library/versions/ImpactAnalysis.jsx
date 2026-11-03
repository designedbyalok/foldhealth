import { useMemo } from 'react';
import { Badge } from '../../../../components/Badge/Badge';
import { impactSummary } from '../lib/templateVersions';
import styles from './Versions.module.css';

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const templateVersion = r => `v${r.versionNumber ?? 1}`;

/**
 * Plans affected by a new version, broken down the ways a cohort can be cut.
 * `marked` (a Set of instanceIds) labels the rows that move; `versionOf`
 * reads the version a row is on (template version by default).
 */
export function ImpactAnalysis({ rows, marked, versionOf = templateVersion, emptyText = 'No active care plan uses this template yet.', lead = 'Used by', showTemplate = false }) {
  const s = useMemo(() => impactSummary(rows, versionOf), [rows, versionOf]);
  if (!rows.length) return <p className={styles.muted}>{emptyText}</p>;
  const group = (title, list) => (
    <div className={styles.breakdown}>
      <span className={styles.breakdownTitle}>{title}</span>
      <div className={styles.breakdownChips}>
        {list.slice(0, 8).map(x => <span key={x.value} className={styles.breakdownChip}>{x.value} <b>{x.n}</b></span>)}
        {list.length > 8 && <span className={styles.muted}>+{list.length - 8} more</span>}
      </div>
    </div>
  );
  return (
    <div className={styles.impact}>
      <p className={styles.impactLead}>{lead} <b>{plural(s.plans, 'active care plan')}</b> for {plural(s.patients, 'patient')}.</p>
      {group('Version', s.byVersion)}
      {group('Care program', s.programCode)}
      {group('IPA', s.ipa)}
      {group('Care manager', s.careManager)}
      {group('Population group', s.groups)}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>Patient</th><th>Program</th>{showTemplate && <th>Template</th>}<th>IPA</th><th>Care manager</th><th>On</th><th /></tr></thead>
          <tbody>
            {rows.slice(0, 100).map(r => (
              <tr key={r.instanceId} className={marked && !marked.has(r.instanceId) ? styles.rowDim : ''}>
                <td>{r.patientName}</td>
                <td>{r.programCode}</td>
                {showTemplate && <td>{r.templateName || '-'}</td>}
                <td>{r.ipa || '-'}</td>
                <td>{r.careManager || 'Unassigned'}</td>
                <td>{versionOf(r)}</td>
                <td>{marked && (marked.has(r.instanceId) ? <Badge tone="info" size="sm" label="Moves" /> : <span className={styles.muted}>Stays</span>)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 100 && <p className={styles.muted}>Showing 100 of {rows.length}.</p>}
      </div>
    </div>
  );
}
