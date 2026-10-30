import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Avatar } from '../../../../components/Avatar/Avatar';
import { Button } from '../../../../components/Button/Button';
import { Icon } from '../../../../components/Icon/Icon';
import { Link } from '../../../../components/Link/Link';
import { toast } from '../../../../components/Toast/sonnerToast';
import { useBrowserCall } from './useBrowserCall';
import { formatDuration } from './rtc';
import { initialsOf, patientLink } from '../commsUtils';
import styles from './BrowserCallCard.module.css';

const ENDED_TEXT = {
  completed: 'Call ended',
  missed: 'No answer',
  declined: 'Declined by the patient',
  cancelled: 'Call cancelled',
  failed: 'Call failed',
};

const clock = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

/** The staff side's call in progress, over every page. */
export function BrowserCallCard() {
  const call = useBrowserCall();
  const [now, setNow] = useState(() => Date.now());
  const active = call.status === 'ringing' || call.status === 'connecting' || call.status === 'live';

  useEffect(() => {
    if (!active) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);

  // An ended call leaves its result up briefly, then clears.
  useEffect(() => {
    if (call.status !== 'ended') return undefined;
    const t = setTimeout(() => call.dismiss(), call.error ? 8000 : 4000);
    return () => clearTimeout(t);
  }, [call.status, call.error, call]);

  if (call.status === 'idle') return null;

  const seconds = call.connectedAt ? Math.max(0, Math.round((now - call.connectedAt) / 1000)) : 0;
  const token = call.meta?.chat?.patient_token;
  const copyLink = () => {
    navigator.clipboard?.writeText(patientLink(token)).then(() => toast.success('Patient Link Copied Successfully'));
  };

  let status;
  if (call.status === 'ringing') status = 'Ringing…';
  else if (call.status === 'connecting') status = 'Connecting…';
  else if (call.status === 'live') status = clock(seconds);
  else status = call.error || ENDED_TEXT[call.endReason] || 'Call ended';

  return createPortal(
    <div className={styles.card} role="status" aria-live="polite">
      <div className={styles.top}>
        <Avatar variant="patient" size={36} initials={initialsOf(call.patientName)} />
        <div className={styles.who}>
          <span className={styles.name}>{call.patientName}</span>
          <span className={[styles.status, call.status === 'live' ? styles.statusLive : '', call.status === 'ended' && call.endReason !== 'completed' ? styles.statusEnded : ''].join(' ')}>
            {call.status === 'live' && <span className={styles.liveDot} />}
            {status}
          </span>
        </div>
        <Icon name="solar:phone-calling-linear" size={16} color="var(--neutral-300)" />
      </div>

      {call.status === 'ringing' && token && (
        <div className={styles.hint}>
          They answer on their patient page.{' '}
          <Link onClick={copyLink}>Copy link</Link>
        </div>
      )}

      {active ? (
        <div className={styles.actions}>
          <Button
            variant="outline"
            leadingIcon={call.muted ? 'solar:microphone-slash-linear' : 'solar:microphone-linear'}
            onClick={call.toggleMute}
            disabled={call.status === 'ringing'}
          >
            {call.muted ? 'Unmute' : 'Mute'}
          </Button>
          <Button tone="danger" leadingIcon="solar:end-call-rounded-linear" onClick={call.hangup}>
            {call.status === 'ringing' ? 'Cancel' : 'End'}
          </Button>
        </div>
      ) : (
        <div className={styles.actions}>
          {call.endReason === 'completed' && call.duration > 0 && (
            <span className={styles.duration}>{formatDuration(call.duration)}</span>
          )}
          <Button variant="outline" onClick={call.dismiss}>Close</Button>
        </div>
      )}
    </div>,
    document.body,
  );
}
