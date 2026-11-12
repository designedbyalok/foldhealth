import { useEffect } from 'react';
import { Badge } from '../../../../../../../components/Badge/Badge';
import { Button } from '../../../../../../../components/Button/Button';
import { DashboardCard } from '../../../../../../../components/DashboardCard/DashboardCard';
import { PanelSectionItem } from '../../../../../../../components/PanelSection/PanelSection';
import { Icon } from '../../../../../../../components/Icon/Icon';
import { useAppStore } from '../../../../../../../store/useAppStore';
import { usePatientConsent } from '../../../../../hooks/usePatientConsent';
import { findPatientRecord } from '../../care-plan/lib/carePlanPrintSettings';
import { eligibleRows } from './eligibleProgramsModel';
import styles from './EligiblePrograms.module.css';

const EMPTY = [];

/**
 * Programs the patient qualifies for but isn't in (care management redesign
 * prototype): Unity's reason, whether consent is still needed, and Enroll,
 * which runs the tab's normal enrollment (consent capture, SNP and CMP
 * pickers). A program they're already in drops off the list.
 */
export function EligiblePrograms({ patientId, programs, catalog, onEnroll }) {
  const memberId = useAppStore(s => String(findPatientRecord(s, patientId)?.memberId || patientId || ''));
  const found = useAppStore(s => s.programEligibility[memberId]) || EMPTY;
  const fetchProgramEligibility = useAppStore(s => s.fetchProgramEligibility);
  const { consents } = usePatientConsent(patientId);
  useEffect(() => { if (memberId) fetchProgramEligibility(memberId); }, [memberId, fetchProgramEligibility]);

  const rows = eligibleRows(found, { programs, catalog, consents });
  if (!rows.length) return null;

  return (
    <DashboardCard icon="custom:ai" title="Eligible Programs" count={rows.length}>
      <p className={styles.basis}>Unity checked the problem list, labs, payer rules and consents.</p>
      <ul className={styles.list}>
        {rows.map(r => (
          <li key={r.id}>
            <PanelSectionItem
              inset
              alignTop
              wrapTitle
              title={`${r.name} (${r.code})`}
              titleAside={<Badge size="sm" tone={r.fit === 'eligible' ? 'success' : 'warning'} label={r.fit === 'eligible' ? 'Eligible' : 'Check Eligibility'} />}
              meta={r.why}
            >
              <span className={styles.foot}>
                <span className={r.consentOk ? styles.consentOk : styles.consentNeeded}>
                  <Icon name={r.consentOk ? 'solar:check-circle-linear' : 'solar:document-add-linear'} size={14} color="currentColor" />
                  {r.consent}
                </span>
                <Button size="sm" variant="outline" onClick={() => onEnroll(r.code)}>Enroll</Button>
              </span>
            </PanelSectionItem>
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}
