import { Fragment } from 'react';
import { Icon } from '../Icon/Icon';
import { Avatar } from '../Avatar/Avatar';
import { useAppStore } from '../../store/useAppStore';
import { useLiveCall } from '../../features/live-call/useLiveCall';
import { expandLiveCall } from '../../features/live-call/liveCallMorph';
import { useCallControls } from '../../features/live-call/useCallControls';
import { endLiveCall } from '../../features/live-call/endLiveCall';
import { livePatientOf } from '../../features/live-call/joinAgentCall';
import { CallMoreMenu } from '../../features/live-call/CallMoreMenu';
import { DroppedCallBanner } from '../../features/live-call/DroppedCallBanner';
import styles from './ActiveCallCard.module.css';

function formatTimer(secs) {
  const m = Math.floor(secs / 60), s = secs % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

export function ActiveCallCard() {
  const activeCallPatient = useAppStore(s => s.activeCallPatient);
  const activeCallSeconds = useAppStore(s => s.activeCallSeconds);
  const p = useAppStore(s => s.patients.find(x => x.id === s.activeCallPatient));
  const expanded = useLiveCall(s => s.open);
  const held = useLiveCall(s => s.held);
  const mode = useLiveCall(s => s.mode);
  const livePatient = useLiveCall(s => s.patient);
  const wrapOpen = useLiveCall(s => s.wrapOpen);
  const visitSeconds = useLiveCall(s => s.visitSeconds);
  const dropped = useLiveCall(s => !!s.dropped);
  const controls = useCallControls();

  // An in-person visit has no phone call behind it: the card follows the visit.
  const visiting = mode === 'visit' && !!livePatient && !wrapOpen;
  const who = visiting ? livePatient : p;
  const visible = (!!activeCallPatient || visiting) && !expanded;
  const payload = () => livePatientOf(p);
  const openFullScreen = () => (visiting ? expandLiveCall(livePatient) : p && expandLiveCall(payload()));
  const endCall = () => endLiveCall(visiting ? livePatient : (p ? payload() : null));

  return (
    <div className={[styles.card, visible ? styles.visible : '', expanded ? styles.expanded : ''].filter(Boolean).join(' ')} data-call-card={visible ? '' : undefined}>
      <div className={styles.header}>
        <div className={[styles.status, dropped && !visiting ? styles.statusDropped : ''].filter(Boolean).join(' ')} data-lc="status">
          <span className={dropped && !visiting ? styles.droppedDot : held ? styles.liveDotHeld : styles.liveDot} />
          {visiting ? 'In-Person Visit' : dropped ? 'Call Dropped' : 'Active Call'}
          <span style={{ color: 'var(--neutral-200)', fontWeight: 400 }}>•</span>
          <span>{formatTimer(visiting ? visitSeconds : activeCallSeconds)}</span>
          {!visiting && (
            <>
              <span style={{ color: 'var(--neutral-200)', fontWeight: 400 }}>•</span>
              <Icon name="solar:smile-circle-linear" size={14} color="#059669" />
              <span>{p?.agentAssigned || 'TOC Agent'}</span>
            </>
          )}
        </div>
        <button type="button" className={styles.expandBtn} data-lc="toggle" aria-label="Open the live transcript full screen" title="Full Screen" onClick={openFullScreen}>
          <Icon name="solar:maximize-square-2-linear" size={16} />
        </button>
      </div>

      {who && (
        <div className={styles.patient}>
          <span data-lc="avatar"><Avatar variant="callCard" initials={who.initials} /></span>
          <div>
            <div className={styles.patientName}>
              <span data-lc="name">{who.name}</span>
              <button
                type="button"
                className={styles.openPatientBtn}
                aria-label={`Open ${who.name} profile`}
                onClick={() => {}}
              >
                ↗
              </button>
            </div>
            <div className={styles.patientMeta}>{visiting ? 'Recording in the room' : `(125) 648-4230 (${p.gender} • ${p.age})`}</div>
          </div>
        </div>
      )}

      {!visiting && p && <DroppedCallBanner patient={payload()} compact />}
      <div className={styles.divider} />

      <div className={styles.actions}>
        {controls.map(c => (
          <Fragment key={c.key}>
            <button type="button" className={styles.actionBtn} data-lc={c.key} aria-label={c.label} title={c.label} aria-pressed={c.active ?? undefined} onClick={c.onClick}>
              <Icon name={c.icon} size={18} />
            </button>
            <div className={styles.sep} />
          </Fragment>
        ))}
        <button type="button" className={styles.endBtn} data-lc="end" aria-label={visiting ? 'End visit' : 'End call'} onClick={endCall}>
          <Icon name="solar:end-call-linear" size={18} />
        </button>
      </div>
      <CallMoreMenu />
    </div>
  );
}
