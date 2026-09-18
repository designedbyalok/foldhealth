import { useEffect, useMemo, useState } from 'react';
import { Drawer } from '../../../../../../../../components/Drawer/Drawer';
import { ActionButton } from '../../../../../../../../components/ActionButton/ActionButton';
import { ConfirmDialog } from '../../../../../../../../components/ConfirmDialog/ConfirmDialog';
import { Badge } from '../../../../../../../../components/Badge/Badge';
import { RingEmptyState } from '../../../../../../../../components/RingEmptyState/RingEmptyState';
import { useAppStore } from '../../../../../../../../store/useAppStore';
import { CarePlanVersionChangesDrawer } from '../CarePlanVersionChangesDrawer/CarePlanVersionChangesDrawer';
import { groupByVersion, versionNumberOf } from '../../lib/carePlanVersions';
import styles from './CarePlanVersionsDrawer.module.css';

// The byline names how the version came about, which the removed status badge
// used to carry.
const BYLINE = {
  signed: 'Signed by',
  manual: 'Saved by',
  restore: 'Restored by',
};

const fmt = (iso) => (iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');

// Immutable version history for a program's care plan, with restore (#25).
export function CarePlanVersionsDrawer({ patientId, program, onClose }) {
  const fetchCarePlanVersions = useAppStore(s => s.fetchCarePlanVersions);
  const restoreCarePlanVersion = useAppStore(s => s.restoreCarePlanVersion);
  const key = `${patientId}::${program.id}`;
  const versions = useAppStore(s => s.patientCarePlanVersions[key]);
  const loading = useAppStore(s => s.patientCarePlanVersionsLoading[key]);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [openVersion, setOpenVersion] = useState(null);
  const fetchCarePlanAudit = useAppStore(s => s.fetchCarePlanAudit);
  const auditKey = `${patientId}::${program.id}`;
  const auditEntries = useAppStore(s => s.patientCarePlanAudit[auditKey]);
  const plan = useAppStore(s => s.patientCarePlans[auditKey]);

  useEffect(() => {
    if (auditEntries === undefined) fetchCarePlanAudit(patientId, program.id);
  }, [auditEntries, patientId, program.id, fetchCarePlanAudit]);

  // A snapshot row and an audit version are linked by the version number the
  // signature records, so "what changed" can be read off the audit trail.
  const changesByVersion = useMemo(() => {
    const map = new Map();
    for (const g of groupByVersion(auditEntries)) {
      const n = versionNumberOf(g.signed);
      if (n) map.set(n, g);
    }
    return map;
  }, [auditEntries]);
  const openChanges = (v) => {
    const g = changesByVersion.get(v.versionNumber);
    setOpenVersion(g || { rows: [], createdAt: v.createdAt });
  };

  useEffect(() => {
    if (versions === undefined) fetchCarePlanVersions(patientId, program.id);
  }, [versions, patientId, program.id, fetchCarePlanVersions]);

  const list = versions || [];

  return (
    <Drawer title="Version History" onClose={onClose}>
      <div className={styles.body}>
        {list.length === 0 ? (
          <RingEmptyState icon="solar:layers-minimalistic-linear" label={loading ? 'Loading versions…' : 'No saved versions yet'} />
        ) : list.map((v, i) => (
          <div
            key={v.id}
            className={styles.card}
            role="button"
            tabIndex={0}
            onClick={() => openChanges(v)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openChanges(v); } }}
          >
            <div className={styles.cardMain}>
            <div className={styles.cardHead}>
              <span className={styles.version}>Version {v.versionNumber}</span>
              {/* Versions come back newest first, so the head of the list is
                  the one the plan is on now. */}
              {i === 0 && <Badge tone="success" size="S" label="Current" />}
            </div>
            <div className={styles.meta}>
              {fmt(v.createdAt)}
              {v.createdBy ? ` · ${BYLINE[v.reason] || BYLINE.manual} ${v.createdBy}` : ''}
            </div>
            <div className={styles.counts}>
              {(v.snapshot?.goals?.length || 0)} goals · {(v.snapshot?.interventions?.length || 0)} interventions
            </div>
            {v.note && <div className={styles.note}>“{v.note}”</div>}
            </div>
            <div className={styles.actionCell} onClick={e => e.stopPropagation()}>
              <ActionButton
                icon="solar:eye-linear"
                size="L"
                tooltip="View"
                onClick={() => openChanges(v)}
              />
              <span className={styles.vDivider} />
              <ActionButton
                icon="solar:restart-linear"
                size="L"
                tooltip="Restore"
                onClick={() => setRestoreTarget(v)}
              />
            </div>
          </div>
        ))}
      </div>

      {openVersion && (
        <CarePlanVersionChangesDrawer
          rows={openVersion.rows}
          signedAt={openVersion.createdAt}
          plan={plan}
          patientId={patientId}
          onClose={() => setOpenVersion(null)}
        />
      )}

      {restoreTarget && (
        <ConfirmDialog
          icon="solar:danger-triangle-linear"
          title={`Restore version ${restoreTarget.versionNumber}?`}
          description="This replaces the current goals and interventions with those from this version. The current state is not saved automatically, Sign the care plan's current version first if you want to keep it."
          confirmLabel="Restore"
          onCancel={() => setRestoreTarget(null)}
          onConfirm={() => { restoreCarePlanVersion(patientId, program, restoreTarget); setRestoreTarget(null); onClose(); }}
        />
      )}
    </Drawer>
  );
}
