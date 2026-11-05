import { Icon } from '../Icon/Icon';
import { ActionButton } from '../ActionButton/ActionButton';
import { Avatar } from '../Avatar/Avatar';
import { PatientSearch } from './PatientSearch';
import { getInitials } from './scheduleDrawerConstants';
import styles from './ScheduleDrawer.module.css';

export function ScheduleDrawerPatientSection({
  selectedPatient,
  setSelectedPatient,
  patients,
  reasonForVisit,
  setReasonForVisit,
  // Callers that already own the patient context (e.g. the HEDIS Care Gap
  // drawer opens for one specific member) pass `locked` so the search
  // fallback + Remove button are suppressed, users can't accidentally
  // swap the patient the appointment is being scheduled for.
  locked = false,
}) {
  if (!selectedPatient && !locked) {
    return (
      <div className={styles.section}>
        <label className={styles.sectionLabel} htmlFor="schedule-patient-search">Patient/Prospect <span className={styles.required}>*</span></label>
        <PatientSearch inputId="schedule-patient-search" patients={patients} onSelect={setSelectedPatient} />
      </div>
    );
  }

  if (!selectedPatient) return null;

  return (
    <div className={styles.section}>
      <span className={styles.sectionLabel}>Patient Details</span>
      <div className={styles.patientCard}>
        <div className={styles.patientCardHeader}>
          <Avatar variant="patient" initials={getInitials(selectedPatient.name).toUpperCase()} />
          <div className={styles.patientCardInfo}>
            <div className={styles.patientCardName}>{selectedPatient.name}</div>
            <div className={styles.patientCardMeta}>
              {selectedPatient.gender?.[0] || 'M'} &bull; {selectedPatient.age || '62'}Y ({selectedPatient.dob || '03/29/1961'}) &bull;{' '}
              <span className={styles.rafScore}>RAF Score: {selectedPatient.laceScore || '3.5'}</span>{' '}
              <span className={styles.rafDelta}>+0.5 <Icon name="solar:arrow-up-linear" size={10} color="var(--status-success-bright)" /></span>
            </div>
          </div>
          {!locked && (
            <ActionButton icon="solar:close-linear" size="sm" tooltip="Remove" onClick={() => setSelectedPatient(null)} />
          )}
        </div>

        <div className={styles.reasonField}>
          <label className={styles.reasonLabel} htmlFor="schedule-reason-for-visit">Reason for Visit</label>
          <input
            id="schedule-reason-for-visit"
            className={styles.reasonInput}
            placeholder="Enter Reason for Visit"
            value={reasonForVisit}
            onChange={e => setReasonForVisit(e.target.value)}
          />
        </div>

        <div className={styles.patientInfoGrid}>
          <div className={styles.patientInfoRow}>
            <span className={styles.patientInfoLabel}>Patient Location</span>
            <span className={styles.patientInfoValue}>{selectedPatient.facility || 'New York'}</span>
          </div>
          <div className={styles.patientInfoRow}>
            <span className={styles.patientInfoLabel}>Last Appointment</span>
            <span className={styles.patientInfoValue}>
              07-26-2023 with Katherine Moss{' '}
              <button className={styles.viewDetailsLink}>View Details</button>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
