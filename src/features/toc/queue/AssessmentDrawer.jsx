import { useMemo } from 'react';
import { Drawer } from '../../../components/Drawer/Drawer';
import { PatientBanner } from '../../../components/PatientBanner/PatientBanner';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Button } from '../../../components/Button/Button';
import { useAppStore } from '../../../store/useAppStore';
import { AssessmentFormView } from '../../patient/right-panel/tabs/care-programs/program-detail/steps/AssessmentFormView/AssessmentFormView';
import {
  POST_IP_FORM_NAME,
  POST_IP_FORM_TITLE,
  POST_IP_PREFILLED_ANSWERS,
  buildPostIpForm,
} from '../../forms/postIpAssessment';
import styles from './AssessmentDrawer.module.css';

/**
 * TOC queue assessment drawer. Renders the Post IP Assessment (Astrana
 * Connect) pre-filled by the TOC agent when the agent has connected with
 * the patient; otherwise the form opens blank. The form definition lives
 * in src/features/forms/postIpAssessment.js so the same schema drives the
 * drawer, Content → Forms, and the builder.
 */
export function AssessmentDrawer() {
  const patientId = useAppStore(s => s.assessmentDrawerPatientId);
  const prefilled = useAppStore(s => s.assessmentDrawerPrefilled);
  const close = useAppStore(s => s.closeAssessmentDrawer);
  const patients = useAppStore(s => s.patients);
  const showToast = useAppStore(s => s.showToast);
  const patient = useMemo(
    () => patients.find(p => p.id === patientId) || null,
    [patients, patientId],
  );
  const fallbackForm = useMemo(() => (patient ? buildPostIpForm(patient) : null), [patient]);

  if (!patient) return null;

  return (
    <Drawer
      title="Patient Assessment"
      onClose={close}
      titleStyle={{ color: 'var(--neutral-500)' }}
      bodyClassName={styles.drawerBody}
      banner={
        <PatientBanner
          initials={patient.initials}
          name={patient.name}
          gender={patient.gender}
          age={patient.age}
          memberId={patient.memberId}
        />
      }
    >
      <div className={styles.formHeader}>
        <div className={styles.formHeaderText}>
          <span className={styles.formTitle}>{POST_IP_FORM_TITLE}</span>
          <span className={styles.formMeta}>
            {prefilled
              ? 'Sent by: Robert Fox on 07/11/26 • Filled by: TOC Agent on 08/11/26'
              : 'Sent by: Robert Fox on 07/11/26 • Awaiting patient outreach'}
          </span>
        </div>
        <div className={styles.formActions}>
          <ActionButton
            icon="solar:printer-linear"
            tooltip="Print"
            tooltipBelow
            onClick={() => window.print()}
          />
          <span className={styles.actionDivider} />
          <Button
            variant="outline" tone="primary"
            onClick={() => showToast('Resend: coming soon')}
          >
            Resend
          </Button>
        </div>
      </div>

      <AssessmentFormView
        formName={POST_IP_FORM_NAME}
        fallbackForm={fallbackForm}
        initialAnswers={prefilled ? POST_IP_PREFILLED_ANSWERS : null}
        interpretation={prefilled ? 'Complete' : 'Not Started'}
      />
    </Drawer>
  );
}
