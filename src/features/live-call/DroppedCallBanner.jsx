import { Button } from '../../components/Button/Button';
import { Icon } from '../../components/Icon/Icon';
import { useAppStore } from '../../store/useAppStore';
import { useLiveCall } from './useLiveCall';
import { endLiveCall } from './endLiveCall';
import styles from './LiveCallOverlay.module.css';

const clock = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

/**
 * The call cut off: call back (the session and transcript carry on), text
 * the patient, or wrap up what was covered. `compact` is the call card's row.
 */
export function DroppedCallBanner({ patient, compact = false }) {
  const dropped = useLiveCall(s => s.dropped);
  const callBack = useLiveCall(s => s.callBack);
  const showToast = useAppStore(s => s.showToast);
  const runPatientRowAction = useAppStore(s => s.runPatientRowAction);
  if (!dropped || !patient) return null;
  const first = patient.name.split(' ')[0];
  const back = () => { callBack(); showToast(`Calling ${first} back…`); };
  const text = () => runPatientRowAction?.('Send SMS', patient);

  return (
    <div className={compact ? styles.dropCompact : styles.drop} role="alert">
      <Icon name="solar:phone-calling-rounded-linear" size={16} color="var(--status-error)" />
      <span className={styles.dropText}>
        Call dropped at {clock(dropped.at)}{compact ? '' : `. ${first} may call back; the transcript so far is kept.`}
      </span>
      <Button size="sm" onClick={back}>Call Back</Button>
      {!compact && <Button size="sm" variant="outline" onClick={text}>Text {first}</Button>}
      {!compact && <Button size="sm" variant="ghost" onClick={() => endLiveCall(patient)}>Wrap Up</Button>}
    </div>
  );
}
