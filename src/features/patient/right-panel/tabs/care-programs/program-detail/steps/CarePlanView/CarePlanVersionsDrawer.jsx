import { useEffect, useState } from 'react';
import { Drawer } from '../../../../../../../../components/Drawer/Drawer';
import { Badge } from '../../../../../../../../components/Badge/Badge';
import { Button } from '../../../../../../../../components/Button/Button';
import { ConfirmDialog } from '../../../../../../../../components/ConfirmDialog/ConfirmDialog';
import { RingEmptyState } from '../../../../../../../../components/RingEmptyState/RingEmptyState';
import { useAppStore } from '../../../../../../../../store/useAppStore';
import styles from './CarePlanVersionsDrawer.module.css';

const REASON = {
  signed: { label: 'Signed', tone: 'green' },
  manual: { label: 'Manual save', tone: 'grey' },
  restore: { label: 'Restore point', tone: 'grey' },
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

  useEffect(() => {
    if (versions === undefined) fetchCarePlanVersions(patientId, program.id);
  }, [versions, patientId, program.id, fetchCarePlanVersions]);

  const list = versions || [];

  return (
    <Drawer title="Version History" onClose={onClose}>
      <div className={styles.body}>
        {list.length === 0 ? (
          <RingEmptyState icon="solar:layers-minimalistic-linear" label={loading ? 'Loading versions…' : 'No saved versions yet'} />
        ) : list.map(v => (
          <div key={v.id} className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.version}>Version {v.versionNumber}</span>
              <Badge tone={(REASON[v.reason] || REASON.manual).tone} size="S" label={(REASON[v.reason] || REASON.manual).label} />
              <Button className={styles.restoreBtn} variant="secondary" size="S" onClick={() => setRestoreTarget(v)}>Restore</Button>
            </div>
            <div className={styles.meta}>
              {fmt(v.createdAt)}{v.createdBy ? ` · ${v.createdBy}` : ''}
            </div>
            <div className={styles.counts}>
              {(v.snapshot?.goals?.length || 0)} goals · {(v.snapshot?.interventions?.length || 0)} interventions
            </div>
            {v.note && <div className={styles.note}>“{v.note}”</div>}
          </div>
        ))}
      </div>

      {restoreTarget && (
        <ConfirmDialog
          icon="solar:rewind-back-linear"
          title={`Restore version ${restoreTarget.versionNumber}?`}
          description="This replaces the current goals and interventions with those from this version. The current state is not saved automatically — save a version first if you want to keep it."
          confirmLabel="Restore"
          onCancel={() => setRestoreTarget(null)}
          onConfirm={() => { restoreCarePlanVersion(patientId, program, restoreTarget); setRestoreTarget(null); onClose(); }}
        />
      )}
    </Drawer>
  );
}
