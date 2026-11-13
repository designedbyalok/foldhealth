import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ActionButton } from '../../../../components/ActionButton/ActionButton';
import { Avatar } from '../../../../components/Avatar/Avatar';
import { Button } from '../../../../components/Button/Button';
import { Icon } from '../../../../components/Icon/Icon';
import { formatPhone, initialsOf } from '../commsUtils';
import styles from './IncomingCallCard.module.css';

// A soft ring while the call is unanswered: two low sine notes, quiet, every
// few seconds. Made with Web Audio so there's no sound file to load. If the
// browser hasn't allowed audio yet, it stays silent.
const RING_EVERY_MS = 3000;
function playRing(ctx) {
  const t = ctx.currentTime;
  [[523.25, 0], [659.25, 0.18]].forEach(([freq, at]) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t + at);
    gain.gain.linearRampToValueAtTime(0.05, t + at + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + at + 0.6);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t + at);
    osc.stop(t + at + 0.65);
  });
}

function useRing(on) {
  useEffect(() => {
    if (!on || typeof window === 'undefined' || !window.AudioContext) return undefined;
    const ctx = new window.AudioContext();
    const ring = () => { if (ctx.state === 'running') playRing(ctx); else ctx.resume().then(() => playRing(ctx)).catch(() => {}); };
    ring();
    const t = setInterval(ring, RING_EVERY_MS);
    return () => { clearInterval(t); ctx.close().catch(() => {}); };
  }, [on]);
}

const clock = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

/**
 * An incoming call from a patient, bottom right of the screen (Figma Eventus
 * 17887:125267). When the call reached me because I'm covering for someone
 * out of office, a strip on top says who. Accept turns it into the live call
 * (a timer and End); Decline, End or minimise closes it. A soft chime
 * repeats while it rings.
 *
 * @param {object}   props
 * @param {{ name: string, phone?: string, gender?: string, age?: number, pcp?: string, location?: string }} props.caller
 * @param {string}   [props.coveringFor] – the out-of-office colleague the call was for
 * @param {function} props.onClose
 * @param {function} [props.onViewProfile]
 */
export function IncomingCallCard({ caller, coveringFor, onClose, onViewProfile }) {
  const [acceptedAt, setAcceptedAt] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  useRing(!acceptedAt);

  useEffect(() => {
    if (!acceptedAt) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [acceptedAt]);

  const facts = [caller.gender && String(caller.gender)[0].toUpperCase(), caller.age && `${caller.age}Y`].filter(Boolean).join(' , ');
  const meta = [caller.phone && formatPhone(caller.phone), facts && `(${facts})`].filter(Boolean).join(' • ');

  return createPortal(
    <div className={styles.card} role="dialog" aria-label={`Incoming call from ${caller.name}`}>
      {coveringFor && (
        <div className={styles.covering}>You’re covering this call for {coveringFor} (Out of office).</div>
      )}
      <div className={styles.body}>
        <div className={styles.top}>
          {(caller.pcp || caller.location) && (
            <span className={styles.line}>
              {caller.pcp && (
                <span className={styles.lineName}>
                  <Icon name="solar:incoming-call-linear" size={14} color="var(--status-success)" />
                  {caller.pcp}
                </span>
              )}
              {caller.pcp && caller.location && <span className={styles.lineDivider} />}
              {caller.location && <span className={styles.lineLocation}>{caller.location}</span>}
            </span>
          )}
          <ActionButton icon="solar:minimize-square-minimalistic-linear" size="sm" tooltip="Minimize" className={styles.minimize} onClick={onClose} />
        </div>
        <div className={styles.who}>
          <Avatar variant="patient" size="L" initials={initialsOf(caller.name)} />
          <span className={styles.nameRow}>
            <span className={styles.name}>{caller.name}</span>
            {onViewProfile && <ActionButton icon="solar:arrow-right-up-linear" size="sm" tooltip="View Profile" onClick={onViewProfile} />}
          </span>
          {meta && <span className={styles.meta}>{meta}</span>}
          <span className={styles.status}>{acceptedAt ? clock(Math.max(0, Math.round((now - acceptedAt) / 1000))) : 'Incoming call'}</span>
        </div>
        <div className={styles.actions}>
          {acceptedAt ? (
            <Button tone="danger" leadingIcon="solar:end-call-linear" className={styles.action} onClick={onClose}>End</Button>
          ) : (
            <>
              <Button tone="danger" leadingIcon="solar:end-call-linear" className={styles.action} onClick={onClose}>Decline</Button>
              <Button tone="success" leadingIcon="solar:phone-linear" className={styles.action} onClick={() => { setAcceptedAt(Date.now()); setNow(Date.now()); }}>Accept</Button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
