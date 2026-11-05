import { useState } from 'react';
import { Drawer } from '../../../../components/Drawer/Drawer';
import { Button } from '../../../../components/Button/Button';
import { PatientBanner } from '../../../../components/PatientBanner/PatientBanner';
import { AssessmentFormView } from '../../../patient/right-panel/tabs/care-programs/program-detail/steps/AssessmentFormView/AssessmentFormView';
import { ASSESSMENT_STEPS } from '../../../patient/right-panel/tabs/care-programs/program-detail/ProgramDetailView/ProgramDetailView.utils';
import { useAppStore } from '../../../../store/useAppStore';

const HRA = ASSESSMENT_STEPS.HRA;

/**
 * Phq9AssessmentDrawer: opened from the TOC agent queue's "View details"
 * touchpoint. Bare question list only (no progress/score strip), prefilled
 * so the reviewer sees a fully-answered assessment. Save stays disabled
 * until they actually edit a question (AssessmentFormView's onAnswersChange).
 */
export function Phq9AssessmentDrawer({ patient, onClose }) {
  const [dirty, setDirty] = useState(false);
  const showToast = useAppStore(s => s.showToast);

  const handleSave = () => {
    showToast('PHQ-9 saved');
    onClose?.();
  };

  return (
    <Drawer
      title="PHQ-9 Assessment"
      onClose={onClose}
      primaryAction={
        <Button disabled={!dirty} onClick={handleSave}>
          Save
        </Button>
      }
      banner={patient && (
        <PatientBanner
          initials={patient.initials}
          name={patient.name}
          gender={patient.gender}
          age={patient.age}
          memberId={patient.memberId}
          hidePatientLabel
        />
      )}
    >
      <AssessmentFormView formName={HRA.formName} hideStats prefill onAnswersChange={() => setDirty(true)} />
    </Drawer>
  );
}
