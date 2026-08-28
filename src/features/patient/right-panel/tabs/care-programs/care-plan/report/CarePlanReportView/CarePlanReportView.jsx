import { useEffect, useMemo } from 'react';
import { Icon } from '../../../../../../../../components/Icon/Icon';
import { CloseButton } from '../../../../../../../../components/CloseButton/CloseButton';
import { RingEmptyState } from '../../../../../../../../components/RingEmptyState/RingEmptyState';
import { TableSkeleton } from '../../../../../../../../components/TableSkeleton/TableSkeleton';
import { useAppStore } from '../../../../../../../../store/useAppStore';
import styles from './CarePlanReportView.module.css';

const STATUSES = ['Not Started', 'In Progress', 'On Hold', 'Met', 'Not Met'];
const STATUS_COLOR = {
  'Not Started': 'var(--neutral-200)',
  'In Progress': 'var(--primary-300)',
  'On Hold': 'var(--status-warning)',
  Met: 'var(--status-success)',
  'Not Met': 'var(--status-error)',
};
const TARGET_LABEL = { ehr: 'EHR', patient: 'Patient', poa: 'POA' };
const ACTION_LABEL = {
  created: 'Created', updated: 'Edited', status_changed: 'Status changed',
  deleted: 'Removed', shared: 'Shared', signed: 'Signed', note: 'Notes', restored: 'Restored',
};

const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

// Read-only reporting across all of a patient's care plans (roadmap #10):
// completion, status mix, per-program rollup, share & activity totals.
export function CarePlanReportView({ patientId, programs, onClose }) {
  const fetchCarePlanReport = useAppStore(s => s.fetchCarePlanReport);
  const loading = useAppStore(s => s.patientCarePlanReportLoading[patientId]);
  const report = useAppStore(s => s.patientCarePlanReport[patientId]);
  const patientCarePlans = useAppStore(s => s.patientCarePlans);

  useEffect(() => { if (patientId) fetchCarePlanReport(patientId); }, [patientId, fetchCarePlanReport]);

  const agg = useMemo(() => {
    const goals = [], interventions = [], barriers = [];
    const perProgram = [];
    for (const program of programs) {
      const plan = patientCarePlans[`${patientId}::${program.id}`];
      if (!plan) continue;
      const g = plan.goals || [], iv = plan.interventions || [], br = plan.barriers || [];
      goals.push(...g); interventions.push(...iv); barriers.push(...br);
      const gbi = [...g, ...iv, ...br];
      perProgram.push({
        code: program.code, name: program.name,
        goals: g.length, interventions: iv.length, barriers: br.length,
        completion: pct(gbi.filter(x => x.status === 'Met').length, gbi.length),
      });
    }
    const all = [...goals, ...interventions, ...barriers];
    const statusCounts = STATUSES.map(st => ({ status: st, count: all.filter(x => x.status === st).length }));
    return {
      goals, interventions, barriers, perProgram, statusCounts,
      total: all.length,
      met: all.filter(x => x.status === 'Met').length,
      hasPlans: perProgram.length > 0,
    };
  }, [programs, patientCarePlans, patientId]);

  const shares = report?.shares || [];
  const audit = report?.audit || [];
  const shareByTarget = ['ehr', 'patient', 'poa'].map(t => ({ target: t, count: shares.filter(s => s.target === t).length }));
  const auditByAction = Object.keys(ACTION_LABEL)
    .map(a => ({ action: a, count: audit.filter(x => x.action === a).length }))
    .filter(x => x.count > 0);
  const maxStatus = Math.max(1, ...agg.statusCounts.map(s => s.count));

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerText}>
          <span className={styles.headerTitle}>Care Plan Report</span>
          <span className={styles.headerMeta}>All programs · read-only</span>
        </div>
        <CloseButton onClick={onClose} />
      </div>

      {loading && !report ? (
        <TableSkeleton rows={6} />
      ) : !agg.hasPlans ? (
        <RingEmptyState icon="solar:chart-2-linear" label="No Care Plan Data Yet" />
      ) : (
        <div className={styles.body}>
          <div className={styles.tiles}>
            <div className={styles.tile}><div className={styles.tileNum}>{agg.total}</div><div className={styles.tileLabel}>Total items</div></div>
            <div className={styles.tile}><div className={styles.tileNum} style={{ color: 'var(--status-success)' }}>{pct(agg.met, agg.total)}%</div><div className={styles.tileLabel}>Met ({agg.met}/{agg.total})</div></div>
            <div className={styles.tile}><div className={styles.tileNum}>{agg.goals.length}</div><div className={styles.tileLabel}>Goals</div></div>
            <div className={styles.tile}><div className={styles.tileNum}>{agg.interventions.length}</div><div className={styles.tileLabel}>Interventions</div></div>
            <div className={styles.tile}><div className={styles.tileNum}>{shares.length}</div><div className={styles.tileLabel}>Shares</div></div>
          </div>

          <div className={styles.section}>
            <span className={styles.sectionTitle}>Status breakdown</span>
            <div className={styles.bars}>
              {agg.statusCounts.map(s => (
                <div key={s.status} className={styles.barRow}>
                  <span className={styles.barLabel}>{s.status}</span>
                  <span className={styles.barTrack}>
                    <span className={styles.barFill} style={{ width: `${pct(s.count, maxStatus)}%`, background: STATUS_COLOR[s.status] }} />
                  </span>
                  <span className={styles.barCount}>{s.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <span className={styles.sectionTitle}>By program</span>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr><th>Program</th><th>Goals</th><th>Interventions</th><th>Barriers</th><th>Completion</th></tr>
                </thead>
                <tbody>
                  {agg.perProgram.map(p => (
                    <tr key={p.code}>
                      <td>{p.name}</td>
                      <td className={styles.num}>{p.goals}</td>
                      <td className={styles.num}>{p.interventions}</td>
                      <td className={styles.num}>{p.barriers}</td>
                      <td className={styles.num}>{p.completion}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={styles.twoCol}>
            <div className={styles.section}>
              <span className={styles.sectionTitle}>Share activity</span>
              {shares.length === 0 ? <div className={styles.empty}>No shares yet.</div> : (
                <div className={styles.chips}>
                  {shareByTarget.filter(s => s.count > 0).map(s => (
                    <span key={s.target} className={styles.statChip}>{TARGET_LABEL[s.target]}<b>{s.count}</b></span>
                  ))}
                </div>
              )}
            </div>
            <div className={styles.section}>
              <span className={styles.sectionTitle}>Recent activity</span>
              {auditByAction.length === 0 ? <div className={styles.empty}>No activity yet.</div> : (
                <div className={styles.chips}>
                  {auditByAction.map(a => (
                    <span key={a.action} className={styles.statChip}>{ACTION_LABEL[a.action]}<b>{a.count}</b></span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
