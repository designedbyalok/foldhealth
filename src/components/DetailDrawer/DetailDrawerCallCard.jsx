import { Icon } from '../Icon/Icon';
import { ActionButton } from '../ActionButton/ActionButton';
import { CallTypeAvatar } from '../CallTypeAvatar/CallTypeAvatar';
import { DIR_LABEL } from '../CallTypeAvatar/CallTypeAvatar.constants';
import { usePatientCallButton } from '../../hooks/usePatientCallButton';
import styles from './DetailDrawer.module.css';

export function DetailDrawerCallCard({ callDir, callDate, callDurationFull, agentName, patient, detailPatientCallsCount }) {
  const { callBtnRef, openCall } = usePatientCallButton(patient?.id);
  return (
    <div className={styles.callCard}>
      <div className={styles.callCardLeft}>
        <CallTypeAvatar dir={callDir} size={40} iconSize={20} />
        <div className={styles.callInfo}>
          <div className={styles.callLine1}>
            {DIR_LABEL[callDir]} Call
            <span className={styles.dot}>•</span>
            <span className={styles.callLine1Detail}>{callDate}</span>
            <span className={styles.dot}>•</span>
            <span className={styles.callLine1Detail}>{callDurationFull}</span>
            {detailPatientCallsCount > 1 && (
              <>
                <span className={styles.dot}>•</span>
                <span className={styles.callLine1Detail}>{detailPatientCallsCount} calls</span>
              </>
            )}
          </div>
          <div className={styles.callLine2}>
            Via: <Icon name="solar:bot-bold" size={13} color="var(--primary-300)" /> {agentName} (581) 824-1591 → To: {patient.name} (581) 824-1591
          </div>
          {patient.facility && (
            <div className={styles.callLine2}>{patient.facility} • {patient.admitReason}</div>
          )}
        </div>
      </div>
      <div className={styles.callCardActions} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <ActionButton
          ref={callBtnRef}
          icon="solar:phone-linear"
          tooltip="Call patient"
          className={styles.callCardBtn}
          onClick={openCall}
        />
        <span style={{ width: 1, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />
        <ActionButton icon="solar:menu-dots-linear" tooltip="More options" className={styles.callCardBtn} />
      </div>
    </div>
  );
}

export function DetailDrawerMissedState({ callDir }) {
  return (
    <div className={styles.noCallState}>
      <CallTypeAvatar dir={callDir} size={36} iconSize={18} />
      <div className={styles.noCallStateTitle}>
        {callDir === 'declined' ? 'Patient declined this call.' : 'Call was not connected.'}
      </div>
      <div className={styles.noCallStateDesc}>
        No recording, transcript, goals, or summary available for this call.
      </div>
    </div>
  );
}
