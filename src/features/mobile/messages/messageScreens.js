import { ComposeEmailScreen } from './ComposeEmailScreen';
import { InternalThreadScreen } from './InternalThreadScreen';
import { MessageTaskScreen } from './MessageTaskScreen';
import { NewChatScreen } from './NewChatScreen';
import { NewSmsScreen } from './NewSmsScreen';
import { PatientSendScreen } from './PatientSendScreen';

// Messaging screens pushed from Messages, a thread, or a patient profile:
//   composeEmail   { patient?, conversation?, subject?, bodyText? }
//   newSms         { initialPatient? }
//   newChat        { initialType: 'patient' | 'internal' }
//   internalThread { userId, profile? }
//   patientSend    { kind: 'education' | 'assessment', patient, initialFormIds? }
//   messageTask    { member, patientId? }
// Each has a composer or a pinned action, so the tab bar hides.
export const MESSAGE_SCREENS = {
  composeEmail: ComposeEmailScreen,
  newSms: NewSmsScreen,
  newChat: NewChatScreen,
  internalThread: InternalThreadScreen,
  patientSend: PatientSendScreen,
  messageTask: MessageTaskScreen,
};
export const MESSAGE_FULL_SCREEN = Object.keys(MESSAGE_SCREENS);
