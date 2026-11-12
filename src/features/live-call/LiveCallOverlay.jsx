import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Avatar } from '../../components/Avatar/Avatar';
import { Badge } from '../../components/Badge/Badge';
import { Button } from '../../components/Button/Button';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Icon } from '../../components/Icon/Icon';
import { Spinner } from '../../components/Spinner/Spinner';
import { useAppStore } from '../../store/useAppStore';
import { useLiveCall } from './useLiveCall';
import { minimizeLiveCall } from './liveCallMorph';
import { endLiveCall } from './endLiveCall';
import { recordingStatus } from './liveCallModel';
import { useCallControls } from './useCallControls';
import { CallBrief } from './CallBrief';
import { CallWorkspace } from './CallWorkspace';
import { ActionItems } from './ActionItems';
import styles from './LiveCallOverlay.module.css';

const clock = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

/** The call in progress, full screen: brief, live transcript and the action items it raises. */
export function LiveCallOverlay() {
  const call = useLiveCall();
  const seconds = useAppStore(s => s.activeCallSeconds);
  const showToast = useAppStore(s => s.showToast);
  const cmName = useAppStore(s => s.currentUserProfile?.name) || 'Care Manager';
  const { patient, script } = call;
  const controls = useCallControls();

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') minimizeLiveCall(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  if (!call.open || !patient) return null;

  const total = script?.lines.length || 0;
  const status = recordingStatus(call, total);
  const endCall = () => endLiveCall(patient);

  return createPortal(
    <div className={styles.layer}>
      <button type="button" className={styles.scrim} aria-label="Minimize the call" onClick={minimizeLiveCall} />
      <section className={styles.overlay} data-live-call aria-label={`Live call with ${patient.name}`}>
        <header className={styles.header}>
          <span data-lc="avatar"><Avatar variant="patient" size={40} initials={patient.initials} /></span>
          <div className={styles.who}>
            <span className={styles.nameRow}>
              <span className={styles.name} data-lc="name">{patient.name}</span>
              {patient.tags?.map(t => <Badge key={t} size="sm" tone="info" label={t} />)}
            </span>
            <span className={styles.meta}>
              <span className={styles.callStatus} data-lc="status">
                <span className={call.held ? styles.liveDotHeld : styles.liveDot} aria-hidden="true" />
                Active Call
                <span className={styles.sep}>•</span>
                <span className={styles.timer}>{clock(seconds)}</span>
                <span className={styles.sep}>•</span>
                <Icon name="solar:smile-circle-linear" size={14} color="var(--status-success)" />
                {patient.agent || 'TOC Agent'}
              </span>
              {script && <><span className={styles.sep}>•</span><span className={styles.interp} title={script.interpreter}>{script.interpreter}</span></>}
              <span className={styles.sep}>•</span>
              <span className={styles[`status_${status.tone}`]}>{status.label}</span>
            </span>
          </div>
          <span className={styles.spacer} />
          {call.consent === 'yes' && call.shown < total && (
            <Button variant="ghost" size="sm" onClick={call.skipAhead}>Skip Ahead (Demo)</Button>
          )}
          <div className={styles.controls}>
            {controls.map(c => (
              <span key={c.key} data-lc={c.key}>
                <ActionButton icon={c.icon} tooltip={c.label} aria-label={c.label} tooltipBelow active={c.active} onClick={c.onClick} />
              </span>
            ))}
            <span className={styles.headerDivider} />
            <span data-lc="toggle">
              <ActionButton icon="solar:minimize-square-2-linear" tooltip="Minimize to call card" aria-label="Minimize to call card" tooltipBelow tooltipLeft onClick={minimizeLiveCall} />
            </span>
          </div>
          <span data-lc="end">
            <Button tone="danger" size="sm" leadingIcon="solar:end-call-linear" onClick={endCall}>End Call</Button>
          </span>
        </header>

        {!script ? (
          <div className={styles.loading}><Spinner size={24} label="Loading the call" /></div>
        ) : (
          <div className={styles.body}>
            <CallBrief script={script} />
            <CallWorkspace script={script} cmName={cmName} patient={patient} />
            <ActionItems script={script} cmName={cmName} showToast={showToast} />
          </div>
        )}
      </section>
    </div>,
    document.body,
  );
}
