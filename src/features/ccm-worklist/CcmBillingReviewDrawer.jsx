import { Drawer } from '../../components/Drawer/Drawer';
import { Button } from '../../components/Button/Button';
import { Icon } from '../../components/Icon/Icon';
import { PatientBanner } from '../../components/PatientBanner/PatientBanner';
import { CcmBillingReview } from '../patient/components/CcmBillingReview';
import { useAppStore } from '../../store/useAppStore';
import styles from './CcmBillingReviewDrawer.module.css';

// Full CCM Billing Review inside a drawer, opened from the CCM worklist's
// Billable Mins cell. Reuses the same CcmBillingReview component that
// renders inside the patient's Care Programs tab — we just pass the row's
// patientId explicitly so it doesn't fall back to the routed patient.
export function CcmBillingReviewDrawer({ member, onClose }) {
  const navigateToPatient = useAppStore(s => s.navigateToPatient);

  const gotoCarePlan = () => {
    if (member.patientId) {
      navigateToPatient(member.patientId);
      onClose?.();
    }
  };

  return (
    <Drawer
      title="CCM Billing Review"
      onClose={onClose}
      noCloseDivider
      headerRight={
        <>
          <Button
            variant="tertiary"
            size="S"
            trailingIcon="solar:arrow-right-linear"
            onClick={gotoCarePlan}
            disabled={!member.patientId}
          >
            View in Care Plan
          </Button>
          <span className={styles.headerDivider} />
        </>
      }
      banner={
        <PatientBanner
          initials={member.initials}
          name={member.name}
          gender={member.gender === 'M' ? 'Male' : member.gender === 'F' ? 'Female' : member.gender}
          age={member.age}
          dob={member.dob}
          memberId={member.memberId}
        />
      }
      bodyClassName={styles.body}
    >
      <CcmBillingReview patientId={member.patientId || member.id} />
    </Drawer>
  );
}
