import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../../../../../../../components/Icon/Icon';
import { Tooltip } from '../../../../../../../../components/Tooltip/Tooltip';
import { formatElapsed } from './reviewTime';
import styles from './CarePlanReviewDrawer.module.css';

/**
 * The running clock in the Review drawer header: a pulsing dot and mm:ss
 * with a stop button while the review runs. Stopped, it shows the frozen
 * time and reopens the Complete review popover when clicked.
 */
export function ReviewTimer({ startedAt, stoppedAt, onStop, onOpenComplete }) {
  const running = stoppedAt == null;
  const ref = useRef(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);
  const elapsed = (running ? now : stoppedAt) - startedAt;
  const rect = () => ref.current?.getBoundingClientRect();

  if (!running) {
    return (
      <Tooltip label="Complete review" placement="bottom">
        <button type="button" ref={ref} className={`${styles.timer} ${styles.timerStopped}`} onClick={() => onOpenComplete(rect())}>
          <Icon name="solar:pause-circle-linear" size={14} color="currentColor" />
          <span className={styles.timerText}>{formatElapsed(elapsed)}</span>
        </button>
      </Tooltip>
    );
  }
  return (
    <span ref={ref} className={`${styles.timer} ${styles.timerRunning}`} role="timer" aria-live="off">
      <span className={styles.timerDot} aria-hidden="true" />
      <span className={styles.timerText}>{formatElapsed(elapsed)}</span>
      <Tooltip label="Stop timer" placement="bottom">
        <button type="button" className={styles.timerStop} onClick={() => onStop(rect())} aria-label="Stop timer">
          <span className={styles.timerStopGlyph} aria-hidden="true" />
        </button>
      </Tooltip>
    </span>
  );
}
