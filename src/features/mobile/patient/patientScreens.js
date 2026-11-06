import { CaptureConsentScreen } from './CaptureConsentScreen';
import { CcmTimeScreen } from './CcmTimeScreen';
import { ClinicalNoteScreen } from './ClinicalNoteScreen';
import { LogOutreachScreen } from './LogOutreachScreen';
import { PamiItemScreen } from './PamiItemScreen';
import { PatientTagsScreen } from './PatientTagsScreen';
import { RecordVitalsScreen } from './RecordVitalsScreen';

// Patient workflow screens pushed from the mobile profile. Every one has a
// pinned footer action, so MobileShell hides the tab bar for all of them.
export const PATIENT_SCREENS = {
  patientOutreach: LogOutreachScreen,
  patientCcm: CcmTimeScreen,
  patientNote: ClinicalNoteScreen,
  patientVitals: RecordVitalsScreen,
  patientConsent: CaptureConsentScreen,
  patientTags: PatientTagsScreen,
  patientPami: PamiItemScreen,
};
export const PATIENT_FULL_SCREEN = Object.keys(PATIENT_SCREENS);
