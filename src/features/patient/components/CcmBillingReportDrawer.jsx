import { useMemo, useState } from 'react';
import { Drawer } from '../../../components/Drawer/Drawer';
import { Button } from '../../../components/Button/Button';
import { Icon } from '../../../components/Icon/Icon';
import { PatientBanner } from '../../../components/PatientBanner/PatientBanner';
import { useAppStore } from '../../../store/useAppStore';
import { secondsToTime } from '../data/ccmBillingMock';
import { ActivityRow } from './CcmBillingReview';
import styles from './CcmBillingReportDrawer.module.css';

const MONTH_LABEL = (ym) => {
  if (!ym) return '';
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, 1))
    .toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};

const MDM_LABEL = { high: 'High Complexity', moderate: 'Moderate Complexity' };

const currency = (n) =>
  Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export function CcmBillingReportDrawer({ report, onClose }) {
  const patientId = useAppStore(s => s.selectedPatientId);
  const patient = useAppStore(s =>
    s.patients.find(p => p.id === patientId)
    || (s.hccMembers || []).find(m => m.id === patientId),
  );
  const activitiesByPatient = useAppStore(s => s.ccmBillableActivitiesByPatient[patientId]);

  const [clinicalOpen, setClinicalOpen] = useState(true);

  // Activities in the report's month. Real API would return them scoped to
  // the report; here we filter by yearMonth so the demo stays coherent.
  const activities = useMemo(() => {
    if (!activitiesByPatient) return [];
    return activitiesByPatient.filter(a => (a.occurredAt || '').startsWith(report.yearMonth));
  }, [activitiesByPatient, report.yearMonth]);

  const activitiesTotal = useMemo(
    () => activities.reduce((sum, a) => sum + (a.durationSeconds || 0), 0),
    [activities],
  );

  const bannerInitials = patient?.name
    ? patient.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : 'PT';

  return (
    <Drawer
      title={`Billing Report #${report.reportNumber} - ${MONTH_LABEL(report.yearMonth)}`}
      onClose={onClose}
      headerRight={
        <>
          <Button variant="ghost" size="S" leadingIcon="solar:printer-linear" onClick={() => window.print()}>
            Print
          </Button>
          <span className={styles.headerDivider} />
        </>
      }
      noCloseDivider
      banner={
        <PatientBanner
          initials={bannerInitials}
          name={patient?.name || 'Patient'}
          gender={patient?.gender}
          age={patient?.age}
          dob={patient?.dob}
          memberId={patient?.memberId ? `#${patient.memberId}` : undefined}
          hidePatientLabel={false}
        />
      }
      bodyClassName={styles.body}
    >
      {/* ── Program Details ────────────────────────────────────────── */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Program Details</h3>
        <div className={styles.detailsCard}>
          <div className={styles.detailCol}>
            <span className={styles.detailLabel}>Billed Under</span>
            <span className={styles.detailValue}>CCM</span>
          </div>
          <div className={styles.detailCol}>
            <span className={styles.detailLabel}>Medical Decision Making</span>
            <span className={styles.detailValue}>{MDM_LABEL[report.medicalDecisionMaking] || 'Moderate Complexity'}</span>
          </div>
          <div className={styles.detailCol}>
            <span className={styles.detailLabel}>Provider</span>
            <span className={styles.detailValue}>{report.providerName || '—'}</span>
          </div>
          <div className={styles.detailCol}>
            <span className={styles.detailLabel}>Total Billable Time</span>
            <span className={styles.detailValue}>{secondsToTime(report.totalSeconds)} min</span>
          </div>
        </div>
      </section>

      {/* ── Billing Amount & CPT ───────────────────────────────────── */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Billing Amount & CPT</h3>
        <div className={styles.cptCard}>
          <div className={styles.cptHeadRow}>
            <span className={styles.cptHeadLeft}>Applicable CPT Code</span>
            <span className={styles.cptHeadRight}>Amount</span>
          </div>
          {report.cptCodes.map((row) => (
            <div key={row.code} className={styles.cptRow}>
              <div className={styles.cptLeft}>
                <span className={styles.cptCode}>
                  {row.code}
                  <Icon name="solar:info-circle-linear" size={14} color="var(--neutral-300)" />
                </span>
                <span className={styles.cptMinutes}>{row.minutes} Mins</span>
              </div>
              <span className={styles.cptAmount}>{currency(row.amount)}</span>
            </div>
          ))}
          <div className={styles.cptTotalRow}>
            <span className={styles.cptTotalLabel}>Total Billed Amount</span>
            <span className={styles.cptTotalAmount}>{currency(report.estBillingAmount)}</span>
          </div>
        </div>
      </section>

      {/* ── Clinical Activities ───────────────────────────────────── */}
      <section className={styles.section}>
        <button
          type="button"
          className={styles.clinicalHead}
          onClick={() => setClinicalOpen(o => !o)}
          aria-expanded={clinicalOpen}
        >
          <span className={styles.clinicalTitle}>
            Clinical Activities
            <Icon
              name={clinicalOpen ? 'solar:alt-arrow-down-linear' : 'solar:alt-arrow-right-linear'}
              size={16}
              color="var(--neutral-300)"
            />
          </span>
          <span className={styles.clinicalTotal}>{secondsToTime(activitiesTotal)} mins</span>
        </button>
        {clinicalOpen && (
          <div className={styles.activityList}>
            {activities.length === 0 ? (
              <div className={styles.empty}>No activities logged in this period.</div>
            ) : (
              activities.map(a => <ActivityRow key={a.id} activity={a} />)
            )}
          </div>
        )}
      </section>
    </Drawer>
  );
}
