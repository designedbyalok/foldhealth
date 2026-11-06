import { BottomSheet, BottomSheetItem } from '../../../components/BottomSheet/BottomSheet';
import { Button } from '../../../components/Button/Button';
import styles from './patientForm.module.css';
import own from './PatientSheets.module.css';

/**
 * The profile's More tile (Figma 759:20011): the channels that didn't fit
 * on a tile, then the clinical workflows.
 */
export function MoreSheet({ phone, email, onPick, onClose }) {
  const pick = (key) => () => { onClose(); onPick(key); };
  return (
    <BottomSheet title="More" onClose={onClose}>
      <BottomSheetItem icon="solar:chat-square-linear" label="SMS" disabled={!phone} onClick={pick('sms')} />
      <BottomSheetItem icon="solar:letter-linear" label="Email" disabled={!email} onClick={pick('email')} />
      <div className={own.divider} />
      <BottomSheetItem icon="solar:phone-calling-linear" label="Log Outreach" onClick={pick('outreach')} />
      <BottomSheetItem icon="solar:stopwatch-linear" label="Log CCM Time" onClick={pick('ccm')} />
      <BottomSheetItem icon="solar:notes-linear" label="Clinical Note" onClick={pick('note')} />
      <BottomSheetItem icon="solar:heart-pulse-linear" label="Record Vitals" onClick={pick('vitals')} />
      <BottomSheetItem icon="solar:upload-minimalistic-linear" label="Upload Document" onClick={pick('upload')} />
    </BottomSheet>
  );
}

/** The "⋯" beside the avatar (Figma 1100:71569): profile-level actions. */
export function ProfileMenuSheet({ onPick, onClose }) {
  const pick = (key) => () => { onClose(); onPick(key); };
  return (
    <BottomSheet title="Patient" onClose={onClose}>
      <BottomSheetItem icon="solar:tag-linear" label="Edit Tags" onClick={pick('tags')} />
      <BottomSheetItem icon="solar:phone-linear" label="Contact Consent" onClick={pick('contactConsent')} />
      <BottomSheetItem icon="solar:clipboard-check-linear" label="Capture Consent" onClick={pick('consent')} />
      <BottomSheetItem icon="solar:sticker-square-linear" label="Add Sticky Note" onClick={pick('sticky')} />
    </BottomSheet>
  );
}

/** Asked when the provider comes back to the app after calling from it. */
export function AfterCallSheet({ name, onLog, onClose }) {
  return (
    <BottomSheet title="Call Ended?" onClose={onClose}>
      <div className={styles.sheetForm}>
        <p className={styles.sheetText}>Log the outcome of your call with {name} as an outreach attempt.</p>
        <div className={styles.sheetActions}>
          <Button size="lg" variant="outline" onClick={onClose}>Not Now</Button>
          <Button size="lg" onClick={() => { onClose(); onLog(); }}>Log Outreach</Button>
        </div>
      </div>
    </BottomSheet>
  );
}
