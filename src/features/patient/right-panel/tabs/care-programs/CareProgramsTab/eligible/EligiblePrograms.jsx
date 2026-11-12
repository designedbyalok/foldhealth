import { useEffect } from 'react';
import { Badge } from '../../../../../../../components/Badge/Badge';
import { Button } from '../../../../../../../components/Button/Button';
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
    <section className={styles.section} aria-label="Eligible programs">
      <div className={styles.head}>
        <Icon name="custom:ai" size={16} />
        <span className={styles.title}>Eligible Programs</span>
        <span className={styles.count}>{rows.length}</span>
        <span className={styles.spacer} />
        <span className={styles.basis}>Unity checked the problem list, labs, payer rules and consents</span>
      </div>
      <ul className={styles.list}>
        {rows.map(r => (
          <li key={r.id} className={styles.row}>
            <span className={styles.code}>{r.code}</span>
            <span className={styles.body}>
              <span className={styles.nameRow}>
                <span className={styles.name}>{r.name}</span>
                <Badge size="sm" tone={r.fit === 'eligible' ? 'success' : 'warning'} label={r.fit === 'eligible' ? 'Eligible' : 'Check Eligibility'} />
              </span>
              <span className={styles.why}>{r.why}</span>
              <span className={r.consentOk ? styles.consentOk : styles.consentNeeded}>
                <Icon name={r.consentOk ? 'solar:check-circle-linear' : 'solar:document-add-linear'} size={14} color="currentColor" />
                {r.consent}
              </span>
            </span>
            <Button size="sm" variant="outline" onClick={() => onEnroll(r.code)}>Enroll</Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
