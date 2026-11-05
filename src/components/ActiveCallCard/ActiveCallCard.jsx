import { Icon } from '../Icon/Icon';
import { Avatar } from '../Avatar/Avatar';
import { useAppStore } from '../../store/useAppStore';
import styles from './ActiveCallCard.module.css';

function formatTimer(secs) {
  const m = Math.floor(secs / 60), s = secs % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

export function ActiveCallCard() {
  const activeCallPatient = useAppStore(s => s.activeCallPatient);
  const activeCallSeconds = useAppStore(s => s.activeCallSeconds);
  const p = useAppStore(s => s.patients.find(x => x.id === s.activeCallPatient));
  const endActiveCall = useAppStore(s => s.endActiveCall);

  const visible = !!activeCallPatient;

  return (
    <div className={[styles.card, visible ? styles.visible : ''].filter(Boolean).join(' ')}>
      <div className={styles.header}>
        <div className={styles.status}>
          <span className={styles.liveDot} />
          Active Call
          <span style={{ color: 'var(--neutral-200)', fontWeight: 400 }}>•</span>
          <span>{formatTimer(activeCallSeconds)}</span>
          <span style={{ color: 'var(--neutral-200)', fontWeight: 400 }}>•</span>
          <Icon name="solar:smile-circle-linear" size={14} color="#059669" />
          <span>{p?.agentAssigned || 'TOC Agent'}</span>
        </div>
        <button type="button" className={styles.expandBtn} aria-label="Expand call card">
          <Icon name="solar:maximize-square-2-linear" size={16} />
        </button>
      </div>

      {p && (
        <div className={styles.patient}>
          <Avatar variant="callCard" initials={p.initials} />
          <div>
            <div className={styles.patientName}>
              {p.name}
              <button
                type="button"
                className={styles.openPatientBtn}
                aria-label={`Open ${p.name} profile`}
                onClick={() => {}}
              >
                ↗
              </button>
            </div>
            <div className={styles.patientMeta}>(125) 648-4230 ({p.gender} • {p.age})</div>
          </div>
        </div>
      )}

      <div className={styles.divider} />

      <div className={styles.actions}>
        <button type="button" className={styles.actionBtn} aria-label="Mute">
          <Icon name="solar:muted-linear" size={18} />
        </button>
        <div className={styles.sep} />
        <button type="button" className={styles.actionBtn} aria-label="Hold">
          <Icon name="solar:pause-linear" size={18} />
        </button>
        <div className={styles.sep} />
        <button type="button" className={styles.actionBtn} aria-label="Transfer">
          <Icon name="solar:phone-calling-rounded-linear" size={18} />
        </button>
        <div className={styles.sep} />
        <button type="button" className={styles.actionBtn} aria-label="Add participant">
          <Icon name="solar:user-plus-linear" size={18} />
        </button>
        <div className={styles.sep} />
        <button type="button" className={styles.actionBtn} aria-label="Keypad">
          <Icon name="tabler:dialpad" size={18} />
        </button>
        <div className={styles.sep} />
        <button type="button" className={styles.actionBtn} aria-label="More call actions">
          <Icon name="solar:menu-dots-linear" size={18} />
        </button>
        <div className={styles.sep} />
        <button type="button" className={styles.endBtn} aria-label="End call" onClick={endActiveCall}>
          <Icon name="solar:end-call-linear" size={18} />
        </button>
      </div>
    </div>
  );
}
