import { useEffect, useState } from 'react';
import { Icon } from '../../../../../../../../components/Icon/Icon';
import { Tooltip } from '../../../../../../../../components/Tooltip/Tooltip';
import styles from './CarePlanReviewDrawer.module.css';

function formatElapsed(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${m}:${s}` : `${m}:${s}`;
}

/**
 * The running clock in the Review drawer header: a pulsing dot and mm:ss
 * with a stop button while the review runs, a check and the frozen time
 * once stopped.
 */
export function ReviewTimer({ startedAt, stoppedAt, onStop }) {
  const running = stoppedAt == null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);
  const elapsed = (running ? now : stoppedAt) - startedAt;

  return (
    <span className={`${styles.timer} ${running ? styles.timerRunning : styles.timerStopped}`} role="timer" aria-live="off">
      {running
        ? <span className={styles.timerDot} aria-hidden="true" />
        : <Icon name="solar:check-circle-linear" size={14} color="currentColor" />}
      <span className={styles.timerText}>{formatElapsed(elapsed)}</span>
      {running && (
        <Tooltip label="Stop timer" placement="bottom">
          <button type="button" className={styles.timerStop} onClick={onStop} aria-label="Stop timer">
            <span className={styles.timerStopGlyph} aria-hidden="true" />
          </button>
        </Tooltip>
      )}
    </span>
  );
}
