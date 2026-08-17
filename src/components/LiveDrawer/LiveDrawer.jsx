import { useState } from 'react';
import { Icon } from '../Icon/Icon';
import { Button } from '../Button/Button';
import { Drawer } from '../Drawer/Drawer';
import { ComplianceBadges } from '../ComplianceBadges/ComplianceBadges';
import { DepartmentSelector, TransferringState, TransferFailure, NoHumanAvailable, CallbackOffer, PostTransferFeedback } from '../TransferFlow/TransferFlow';
import { useAppStore } from '../../store/useAppStore';
import styles from './LiveDrawer.module.css';

export function LiveDrawer() {
  const liveDrawerPatient = useAppStore(s => s.liveDrawerPatient);
  const closeLiveDrawer = useAppStore(s => s.closeLiveDrawer);
  const patients = useAppStore(s => s.patients);
  const callDetails = useAppStore(s => s.callDetails);
  const showToast = useAppStore(s => s.showToast);
  const [listenActive, setListenActive] = useState(false);
  const [muteActive, setMuteActive] = useState(false);
  const [openSections, setOpenSections] = useState({ goals: true, transcript: true });
  // Transfer flow state: null | 'select-dept' | 'transferring' | 'failure' | 'no-human' | 'callback' | 'feedback'
  const [transferState, setTransferState] = useState(null);
  const [transferDept, setTransferDept] = useState(null);

  const p = patients.find(x => x.id === liveDrawerPatient);
  if (!p) return null;

  // Resolve call data from call_details (ongoing record) with fallback to patient fields
  const ongoingCall = callDetails.find(c => c.patientId === p.id && c.callType === 'ongoing');
  const goals = ongoingCall?.liveGoals || p.liveGoals || [];
  const transcript = ongoingCall?.liveTranscript || p.liveTranscript || [];

  const toggleSection = (key) => setOpenSections(s => ({ ...s, [key]: !s[key] }));

  const liveTag = (
    <div className={styles.liveTag}>
      <span className={styles.liveDot} />
      Live Call
    </div>
  );

  return (
    <Drawer title={liveTag} onClose={closeLiveDrawer}>
      {/* Call Info Card — matches DetailDrawer */}
      <div className={styles.callCard}>
        <div className={styles.callCardLeft}>
          <div className={styles.callIcon}>
            <Icon name="solar:phone-calling-bold" size={24} color="#059669" />
          </div>
          <div className={styles.callInfo}>
            <div className={styles.callLine1}>
              Live Call
              <span className={styles.dot}>•</span>
              <span className={styles.callLine1Detail}>{p.name}</span>
              <span className={styles.dot}>•</span>
              <span className={styles.callTimer}>{p.callDuration || '00:00'}</span>
            </div>
            <div className={styles.callLine2}>
              Via: <Icon name="solar:bot-bold" size={13} color="var(--primary-300)" /> {p.agentAssigned || 'Anna'} → To: {p.name}
            </div>
            {p.facility && (
              <div className={styles.callLine2}>{p.facility} • {p.admitReason}</div>
            )}
          </div>
        </div>
      </div>

      {/* Compliance Strip */}
      <ComplianceBadges compliance={ongoingCall?.compliance} compact />

      {/* Action buttons */}
      <div className={styles.actions}>
        <Button
          variant="secondary"
          size="L"
          leadingIcon="solar:headphones-round-sound-bold"
          className={listenActive ? styles.active : ''}
          onClick={() => setListenActive(v => !v)}
        >
          Live Listen
        </Button>
        <Button variant="primary" size="L" leadingIcon="solar:phone-calling-bold" onClick={() => showToast('Take Over Call – coming soon')}>
          Take Over Call
        </Button>
        <Button
          variant="secondary"
          size="L"
          leadingIcon="solar:call-medicine-bold"
          className={transferState ? styles.active : ''}
          onClick={() => setTransferState(transferState ? null : 'select-dept')}
        >
          Transfer
        </Button>
        <Button
          variant="secondary"
          size="L"
          leadingIcon="solar:microphone-slash-linear"
          className={muteActive ? styles.active : ''}
          onClick={() => setMuteActive(v => !v)}
        >
          Mute
        </Button>
      </div>

      {/* Transfer Flow States */}
      {transferState === 'select-dept' && (
        <DepartmentSelector
          onSelect={(dept) => { setTransferDept(dept); setTransferState('transferring'); }}
          onCancel={() => setTransferState(null)}
        />
      )}
      {transferState === 'transferring' && (
        <TransferringState department={transferDept} onCancel={() => setTransferState('failure')} />
      )}
      {transferState === 'failure' && (
        <TransferFailure
          reason="The line is busy. Please try again or offer a callback."
          onRetry={() => setTransferState('transferring')}
          onCallback={() => setTransferState('callback')}
        />
      )}
      {transferState === 'no-human' && (
        <NoHumanAvailable
          onCallback={() => setTransferState('callback')}
          onMessage={() => { showToast('Message sent to care team'); setTransferState('feedback'); }}
        />
      )}
      {transferState === 'callback' && (
        <CallbackOffer
          patientName={p.name}
          onSchedule={(mins) => { showToast(`Callback scheduled in ${mins} minutes`); setTransferState('feedback'); }}
          onDismiss={() => setTransferState(null)}
        />
      )}
      {transferState === 'feedback' && (
        <PostTransferFeedback onSubmit={({ outcome }) => { showToast(`Feedback recorded: ${outcome}`); setTransferState(null); }} />
      )}

      {/* Transfer Context Card (shown when taking over) */}
      {ongoingCall?.compliance && (
        <div style={{
          border: '0.5px solid var(--neutral-150)', borderRadius: 8, padding: 10, marginBottom: 12, background: '#fafbff',
          display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12, color: 'var(--neutral-300)',
        }}>
          <span><strong>Verified:</strong> {ongoingCall.compliance.identityVerified ? 'Yes' : 'No'}</span>
          <span>•</span>
          <span><strong>Reason:</strong> {p.admitReason || 'TOC Follow-up'}</span>
          <span>•</span>
          <span><strong>LACE:</strong> {p.lace}</span>
          <span>•</span>
          <span><strong>Facility:</strong> {p.facility || 'N/A'}</span>
        </div>
      )}

      {/* Goals Section — collapsible */}
      <button type="button" className={styles.sectionHeader} onClick={() => toggleSection('goals')}>
        <span className={styles.sectionTitle}>
          <Icon name="solar:target-bold" size={15} color="var(--primary-300)" />
          Goals Tracking
        </span>
        <span className={`${styles.chevron} ${openSections.goals ? styles.chevronOpen : ''}`}>
          <Icon name="solar:alt-arrow-right-linear" size={16} />
        </span>
      </button>
      {openSections.goals && (
        <div className={styles.goalsSection}>
          {goals.length > 0 ? goals.map((g, i) => (
            <div key={i} className={`${styles.goalRow} ${g.done ? styles.completed : ''}`}>
              <Icon
                name={g.done ? "solar:check-circle-bold" : "solar:clock-circle-linear"}
                size={16}
                color={g.done ? "var(--status-success)" : "var(--neutral-200)"}
              />
              <span className={styles.goalLabel}>{g.name}</span>
              {g.done && g.time && (
                <span className={styles.goalTime}>
                  <Icon name="solar:check-circle-bold" size={12} color="var(--status-success)" /> {g.time}
                </span>
              )}
            </div>
          )) : (
            <div style={{ padding: '12px 0', fontSize: 13, color: 'var(--neutral-300)' }}>
              No goals data available yet.
            </div>
          )}
        </div>
      )}

      {/* Transcript — collapsible */}
      <button type="button" className={styles.sectionHeader} onClick={() => toggleSection('transcript')}>
        <span className={styles.sectionTitle}>
          <Icon name="solar:chat-round-dots-bold" size={15} color="var(--primary-300)" />
          Live Transcript
        </span>
        <span className={`${styles.chevron} ${openSections.transcript ? styles.chevronOpen : ''}`}>
          <Icon name="solar:alt-arrow-right-linear" size={16} />
        </span>
      </button>
      {openSections.transcript && (
        <div className={styles.transcriptSection}>
          {transcript.map((msg, i) => (
            <div key={i} className={`${styles.message} ${styles[msg.sender]}`}>
              {msg.sender === 'agent' && (
                <div className={styles.msgAvatar}>
                  <Icon name="solar:bot-bold" size={12} color="var(--primary-300)" />
                </div>
              )}
              <div className={styles.msgContent}>
                <div className={styles.msgSender}>{msg.name}</div>
                <div className={styles.msgBubble}>{msg.text}</div>
                <div className={styles.msgTime}>{msg.time}</div>
              </div>
            </div>
          ))}
          {/* Typing indicator */}
          <div className={styles.typing}>
            <Icon name="solar:bot-bold" size={14} color="var(--primary-300)" />
            <span>{p.agentAssigned || 'Anna'} is speaking</span>
            <span className={styles.typingDots}>
              <span>.</span><span>.</span><span>.</span>
            </span>
          </div>
        </div>
      )}
    </Drawer>
  );
}
