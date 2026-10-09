import { useEffect, useMemo } from 'react';
import { useAppStore } from '../../../../../../store/useAppStore';
import { templateContents as templateContentsOnPlan } from '../../../../../../store/lib/carePlanStoreLib';
import { AuditDetailCard } from '../../../../../../components/AuditDetailCard/AuditDetailCard';
import { CardSkeleton } from '../../../../../../components/CardSkeleton/CardSkeleton';
import { buildCarePlanHistory } from '../../care-programs/care-plan/lib/carePlanHistory';
import { CarePlanVersionChangesDrawer } from '../../care-programs/care-plan/drawers/CarePlanVersionChangesDrawer/CarePlanVersionChangesDrawer';
import { sectionsFor } from '../../care-programs/care-plan/drawers/CarePlanHistoryDrawer/CarePlanHistoryDrawer';
import styles from './CarePlanVersionFromLog.module.css';

/**
 * One signed version of a program's care plan, as the Care Plan History
 * builds it: loads that plan's versions, audit and current state, then finds
 * the version's entry (what it changed, as audit-shaped rows). `null` while
 * loading or when the version isn't found.
 */
function useCarePlanVersionEntry(patientId, program, versionNumber) {
  const key = `${patientId}::${program.id}`;
  const fetchCarePlanAudit = useAppStore(s => s.fetchCarePlanAudit);
  const fetchCarePlanVersions = useAppStore(s => s.fetchCarePlanVersions);
  const fetchPatientCarePlan = useAppStore(s => s.fetchPatientCarePlan);
  const audit = useAppStore(s => s.patientCarePlanAudit[key]);
  const versions = useAppStore(s => s.patientCarePlanVersions[key]);
  const plan = useAppStore(s => s.patientCarePlans[key]);
  const templates = useAppStore(s => s.carePlanTemplates);
  const libraryGoals = useAppStore(s => s.carePlanGoals);

  useEffect(() => {
    if (audit === undefined) fetchCarePlanAudit(patientId, program.id);
    if (versions === undefined) fetchCarePlanVersions(patientId, program.id);
    if (!plan) fetchPatientCarePlan(patientId, program.id);
  }, [audit, versions, plan, patientId, program.id, fetchCarePlanAudit, fetchCarePlanVersions, fetchPatientCarePlan]);

  const entry = useMemo(() => {
    if (!audit || !versions) return null;
    const templateDetail = (id, snapshot) => {
      const template = (templates || []).find(t => String(t.id) === String(id));
      return template ? JSON.stringify(templateContentsOnPlan(template, snapshot, libraryGoals)) : '';
    };
    return buildCarePlanHistory({ versions, audit, slice: plan, templates, templateDetail })
      .find(e => e.kind === 'version' && e.versionNumber === versionNumber) || null;
  }, [audit, versions, plan, templates, libraryGoals, versionNumber]);

  const links = useMemo(() => ({ plan, libraryGoals }), [plan, libraryGoals]);
  return { entry, plan, links };
}

/**
 * The glanceable summary of a signed version, the card the Care Plan History
 * opens under "Changes in Care Plan": templates, goals, interventions and
 * barriers that moved, each a count that opens the version drawer at it.
 */
export function CarePlanVersionGlance({ patientId, program, versionNumber, onOpen }) {
  const { entry, links } = useCarePlanVersionEntry(patientId, program, versionNumber);
  if (!entry) return <div className={styles.glance}><CardSkeleton count={1} /></div>;
  const rows = [...entry.rows].sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
  const group = { id: entry.id, rows, signed: { id: entry.id, detail: entry.note || '' }, createdAt: entry.at };
  return (
    <div className={styles.glance}>
      <AuditDetailCard
        header={[`Signed by: ${entry.actor || 'Unknown'}`, `v${entry.versionNumber}`, entry.sharedTo].filter(Boolean)}
        sections={sectionsFor(group, anchor => onOpen?.(anchor), links)}
        onOpen={() => onOpen?.(null)}
        openTooltip="View changes"
      />
    </div>
  );
}

/**
 * Opens one signed version of a program's care plan from the Program Activity
 * Log in the same changes drawer the Care Plan History uses.
 */
export function CarePlanVersionFromLog({ patientId, program, versionNumber, anchor = null, onClose }) {
  const { entry, plan } = useCarePlanVersionEntry(patientId, program, versionNumber);
  if (!entry) return null;
  return (
    <CarePlanVersionChangesDrawer
      rows={entry.rows}
      signedAt={entry.at}
      anchor={anchor}
      plan={plan}
      patientId={patientId}
      versionNumber={entry.versionNumber}
      current={entry.current}
      signedBy={entry.actor}
      onClose={onClose}
    />
  );
}
