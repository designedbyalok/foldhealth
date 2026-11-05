import { Icon } from '../Icon/Icon';
import styles from './OutreachStatus.module.css';

// Per outreach type: the icon for each result (Figma SNP-Story 8602:333343).
const ICONS = {
  call: {
    success: 'solar:outgoing-call-rounded-linear',
    failed: 'solar:call-cancel-rounded-linear',
    followup: 'solar:incoming-call-rounded-linear',
    removed: 'solar:call-dropped-rounded-linear',
  },
  'in-person': 'solar:walking-linear',
  video: 'solar:videocamera-linear',
  sms: 'solar:chat-round-linear',
  app: 'solar:smartphone-2-linear',
  email: 'solar:letter-linear',
  letter: 'solar:document-text-linear',
};

// Calls and video calls are "Attended"; the other channels "Success".
const LABELS = { failed: 'Failed', followup: 'Followup', removed: 'Remove' };
const successLabel = type => (type === 'call' || type === 'video' ? 'Attended' : 'Success');

// M/D/YY, as in the design ("9/12/25"), from MM/DD/YYYY or MM/DD/YY.
function shortDate(value) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(String(value || '').trim());
  if (!m) return value || '';
  return `${Number(m[1])}/${Number(m[2])}/${m[3].slice(-2)}`;
}

/**
 * Outreach status for a worklist Outreach column: the channel's icon, the
 * result (Attended / Success green; Failed / Followup / Remove red), the date
 * of the last attempt and three attempt dots. Earlier attempts are peach and
 * the latest shows the result; all three are red once every attempt failed.
 * No outreach yet: a grey phone and "--". Build props with
 * outreachStatusModel.js.
 *
 * @param {object} props
 * @param {'call'|'in-person'|'video'|'sms'|'app'|'email'|'letter'} [props.type]
 * @param {'success'|'failed'|'followup'|'removed'|null} props.result
 * @param {string} [props.date] the last outreach attempt's date
 * @param {number} [props.attempts] 1 to 3
 */
export function OutreachStatus({ type = 'call', result, date, attempts = 1 }) {
  if (!result) {
    return (
      <span className={styles.root}>
        <Icon name="solar:phone-rounded-linear" size={20} color="var(--neutral-200)" />
        <span className={styles.none}>--</span>
      </span>
    );
  }
  const ok = result === 'success';
  const icon = typeof ICONS[type] === 'object' ? ICONS[type][result] : (ICONS[type] || ICONS.call[result]);
  const label = ok ? successLabel(type) : LABELS[result];
  const allFailed = result === 'failed' && attempts >= 3;
  const dotClass = i => {
    if (i >= attempts) return styles.dotPending;
    if (i === attempts - 1 || allFailed) return ok ? styles.dotSuccess : styles.dotError;
    return styles.dotPrior;
  };
  return (
    <span className={styles.root}>
      <Icon name={icon} size={20} color={ok ? 'var(--status-success)' : 'var(--status-error)'} />
      <span className={styles.body}>
        <span className={ok ? styles.labelSuccess : styles.labelError}>{label}</span>
        {date && <span className={styles.date} title={`Last outreach: ${date}`}>{shortDate(date)}</span>}
        <span className={styles.dots} aria-label={`${attempts} of 3 attempts`}>
          {[0, 1, 2].map(i => <span key={i} className={`${styles.dot} ${dotClass(i)}`} />)}
        </span>
      </span>
    </span>
  );
}
