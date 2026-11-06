import { AddCarePlanItemScreen } from './AddCarePlanItemScreen';
import { MedReconScreen } from './MedReconScreen';
import { ProgramDocsScreen } from './ProgramDocsScreen';
import { ProgramFormScreen } from './ProgramFormScreen';

// Care program and care plan workflow screens pushed from a program or its
// care plan. The form screens pin their action at the bottom, so MobileShell
// hides the tab bar for them.
export const CARE_SCREENS = {
  carePlanAdd: AddCarePlanItemScreen,
  programMedRecon: MedReconScreen,
  programForm: ProgramFormScreen,
  programDocs: ProgramDocsScreen,
};
export const CARE_FULL_SCREEN = ['carePlanAdd', 'programMedRecon', 'programForm'];
