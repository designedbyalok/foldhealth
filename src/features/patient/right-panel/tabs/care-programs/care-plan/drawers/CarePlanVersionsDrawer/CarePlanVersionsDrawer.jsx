import { useEffect, useMemo, useState } from 'react';
import { Drawer } from '../../../../../../../../components/Drawer/Drawer';
import { ActionButton } from '../../../../../../../../components/ActionButton/ActionButton';
import { ConfirmDialog } from '../../../../../../../../components/ConfirmDialog/ConfirmDialog';
import { Badge } from '../../../../../../../../components/Badge/Badge';
import { Input } from '../../../../../../../../components/Input/Input';
import { EmptyState } from '../../../../../../../../components/EmptyState/EmptyState';
import { useAppStore } from '../../../../../../../../store/useAppStore';
import { CarePlanVersionChangesDrawer } from '../CarePlanVersionChangesDrawer/CarePlanVersionChangesDrawer';
import { groupByVersion, versionNumberOf } from '../../lib/carePlanVersions';
import { isFullSnapshot, uniqueById } from '../../lib/carePlanDraft';
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
  const setViewedCarePlanVersion = useAppStore(s => s.setViewedCarePlanVersion);
  // Clicking a card shows that version on the care plan, read only; the
  // current one goes back to the live plan.
  const showVersion = (v, isCurrent) => {
    setViewedCarePlanVersion(key, isCurrent ? null : v);
    onClose();
  };

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
    setOpenVersion({ ...(g || { rows: [], createdAt: v.createdAt }), versionNumber: v.versionNumber, current: v.versionNumber === list[0]?.versionNumber, signedBy: v.createdBy });
  };

  useEffect(() => {
    if (versions === undefined) fetchCarePlanVersions(patientId, program.id);
  }, [versions, patientId, program.id, fetchCarePlanVersions]);

  const list = versions || [];
  // Search matches the version number, signer, date and the signing note.
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = q
    ? list.filter(v => [`version ${v.versionNumber}`, `v${v.versionNumber}`, v.createdBy, fmt(v.createdAt), v.note]
      .some(s => String(s || '').toLowerCase().includes(q)))
    : list;
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  return (
    <Drawer title="Version History" onClose={onClose}>
      <div className={styles.body}>
        <Input
          leadingIcon="solar:magnifer-linear"
          placeholder="Search"
          aria-label="Search versions"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        {list.length === 0 ? (
          <EmptyState icon="solar:layers-minimalistic-linear" title={loading ? 'Loading versions…' : 'No saved versions yet'} />
        ) : shown.length === 0 ? (
          <EmptyState icon="solar:magnifer-linear" title="No versions match your search" />
        ) : shown.map((v) => {
          // Versions come back newest first, so the head of the full list is
          // the one the plan is on now.
          const isCurrent = v.id === list[0]?.id;
          const s = v.snapshot || {};
          const counts = [
            plural(new Set(s.appliedTemplateIds || []).size, 'Template'),
            plural(uniqueById(s.goals).length, 'Goal'),
            plural(uniqueById(s.interventions).length, 'Intervention'),
            ...(Array.isArray(s.barriers) ? [plural(uniqueById(s.barriers).length, 'Barrier')] : []),
          ].join(' • ');
          return (
            <div
              key={v.id}
              className={styles.card}
              role="button"
              tabIndex={0}
              title={v.note ? `\u201c${v.note}\u201d` : undefined}
              onClick={() => showVersion(v, isCurrent)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showVersion(v, isCurrent); } }}
            >
              <div className={styles.cardMain}>
                <div className={styles.meta}>
                  {fmt(v.createdAt)}
                  {v.createdBy ? ` · ${BYLINE[v.reason] || BYLINE.manual} ${v.createdBy}` : ''}
                </div>
                <div className={styles.cardHead}>
                  <span className={styles.version}>Version {v.versionNumber}</span>
                  {isCurrent && <Badge tone="unity" size="sm" label="Current" />}
                </div>
                <div className={styles.counts}>{counts}</div>
              </div>
              <div className={styles.actionCell} onClick={e => e.stopPropagation()}>
                <ActionButton
                  icon="solar:eye-linear"
                  tooltip="View changes"
                  onClick={() => openChanges(v)}
                />
                {/* The newest version is the one the draft is measured against;
                    going back to it is Discard, in the plan header. */}
                {!isCurrent && (
                  <>
                    <span className={styles.vDivider} />
                    <ActionButton
                      icon="solar:restart-linear"
                      tooltip="Load into draft"
                      onClick={() => setRestoreTarget(v)}
                    />
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {openVersion && (
        <CarePlanVersionChangesDrawer
          rows={openVersion.rows}
          signedAt={openVersion.createdAt}
          plan={plan}
          patientId={patientId}
          versionNumber={openVersion.versionNumber}
          current={openVersion.current}
          signedBy={openVersion.signedBy}
          onClose={() => setOpenVersion(null)}
        />
      )}

      {restoreTarget && (
        <ConfirmDialog
          icon="solar:danger-triangle-linear"
          title={`Load version ${restoreTarget.versionNumber} into the draft?`}
          description={isFullSnapshot(restoreTarget.snapshot)
            ? 'The draft is replaced with this version\'s goals, interventions, barriers and templates. It becomes current only once the care plan is signed. Notes and readings are kept.'
            : 'The draft\'s goals and interventions are replaced with this version\'s. This version was signed before barriers and templates were recorded, so those stay as they are. It becomes current only once the care plan is signed.'}
          confirmLabel="Load into Draft"
          onCancel={() => setRestoreTarget(null)}
          onConfirm={() => { restoreCarePlanVersion(patientId, program, restoreTarget); setRestoreTarget(null); onClose(); }}
        />
      )}
    </Drawer>
  );
}
