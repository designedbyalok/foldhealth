import { useState, useRef, useCallback, useEffect } from 'react';
import { Icon } from '../Icon/Icon';
import { Button } from '../Button/Button';
import { ActionButton } from '../ActionButton/ActionButton';
import { Drawer } from '../Drawer/Drawer';
import { useAppStore } from '../../store/useAppStore';
import { EngagementCard } from '../EngagementCard/EngagementCard';
import { GoalProgress } from '../GoalProgress/GoalProgress';
import { CallTypeAvatar, DIR_LABEL } from '../CallTypeAvatar/CallTypeAvatar';
import styles from './DetailDrawer.module.css';

/* ── Waveform data (seeded random heights for consistent look) ── */
const WAVE_BARS = Array.from({ length: 120 }, (_, i) => {
  const seed = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return 3 + (seed - Math.floor(seed)) * 12;
});

const RECORDING_URL = "https://osnihfqqrcchsaqhagcx.supabase.co/storage/v1/object/sign/Call%20Recording/call_recording.mp3?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9hMzBhZDI5OS1mYjE0LTQ2ZjUtOTQ1NC0xOGM2OTNiNjEyMzkiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJDYWxsIFJlY29yZGluZy9jYWxsX3JlY29yZGluZy5tcDMiLCJpYXQiOjE3NzY5MzA1MjMsImV4cCI6MTc3NzUzNTMyM30.jjYQNHs_zPGBSwpw6G4zUdn-oYinz8NkHvSRSP_YAIs";

function formatTime(secs) {
  if (!secs || isNaN(secs)) return '00:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Hoisted out of DetailDrawer so React doesn't remount them (and lose their
// state) on every parent render.
const ShimmerSummary = () => (
  <div style={{ padding: "14px 16px 16px" }}>
    <div className={styles.shimmerLine} style={{ width: "42%", marginBottom: 12 }} />
    <div className={styles.shimmerLine} style={{ width: "94%", marginBottom: 8 }} />
    <div className={styles.shimmerLine} style={{ width: "86%", marginBottom: 8 }} />
    <div className={styles.shimmerLine} style={{ width: "72%", marginBottom: 16 }} />
    <div className={styles.shimmerLine} style={{ width: "32%", marginBottom: 12 }} />
    <div className={styles.shimmerLine} style={{ width: "80%", marginBottom: 8 }} />
    <div className={styles.shimmerLine} style={{ width: "64%" }} />
  </div>
);

const Typewriter = ({ text, speed = 10, onDone }) => {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (n >= text.length) { onDone?.(); return; }
    const id = setTimeout(() => setN(prev => prev + 1), speed);
    return () => clearTimeout(id);
  }, [n, text, speed]);
  return <>{text.slice(0, n)}{n < text.length && <span className={styles.typeCursor} />}</>;
};

const SummaryContent = ({ data, animate }) => {
  const [phase, setPhase] = useState(animate ? 0 : 99);
  useEffect(() => { if (animate) setPhase(0); else setPhase(99); }, [animate]);

  const lines = [];
  lines.push({ kind: "heading", text: "Key Points Discussed:" });
  data.keyPoints.forEach(it => lines.push({ kind: "item", text: it }));
  lines.push({ kind: "heading", text: "Action Items:" });
  data.actionItems.forEach(it => lines.push({ kind: "item", text: it }));

  return (
    <div style={{ padding: "14px 16px 14px" }}>
      {lines.map((l, i) => {
        const visible = !animate || i <= phase;
        const active = animate && i === phase;
        if (!visible) return <div key={i} style={{ height: l.kind === "heading" ? 22 : 20 }} />;
        return (
          <div key={i} style={{
            margin: l.kind === "heading" ? (i === 0 ? "0 0 6px" : "12px 0 6px") : "3px 0",
            paddingLeft: l.kind === "item" ? 16 : 0,
            position: "relative",
            fontSize: 13.5,
            fontWeight: l.kind === "heading" ? 600 : 400,
            color: "var(--neutral-400)",
            lineHeight: 1.5,
            opacity: animate && i > phase ? 0 : 1,
            transition: "opacity 260ms ease",
          }}>
            {l.kind === "item" && (
              <span style={{
                position: "absolute", left: 2, top: "0.65em",
                width: 3, height: 3, borderRadius: "50%",
                background: "var(--primary-300)",
              }} />
            )}
            {active ? <Typewriter text={l.text} onDone={() => setPhase(p => p + 1)} /> : l.text}
          </div>
        );
      })}
    </div>
  );
};

export function DetailDrawer() {
  const detailPatient = useAppStore(s => s.detailPatient);
  const detailPatientCalls = useAppStore(s => s.detailPatientCalls);
  const activeCallRow = useAppStore(s => s.activeCallRow);
  const closeDetail = useAppStore(s => s.closeDetail);
  const showToast = useAppStore(s => s.showToast);
  const [openSections, setOpenSections] = useState({ goals: true, summary: true, transcript: true });
  const [showTranscript, setShowTranscript] = useState(true);

  const audioRef = useRef(null);
  const [playState, setPlayState] = useState('idle'); // idle | playing | paused
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);

  // Transcript refs for auto-scroll
  const transcriptRefs = useRef({});
  const transcriptContainerRef = useRef(null);

  const startPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play();
      setPlayState('playing');
    }
  }, []);

  const pausePlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setPlayState('paused');
    }
  }, []);

  const stopPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlayState('idle');
      setElapsed(0);
    }
  }, []);

  const onTimeUpdate = () => {
    if (audioRef.current) {
      setElapsed(audioRef.current.currentTime);
    }
  };

  const onLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const onEnded = () => {
    setPlayState('idle');
    setElapsed(0);
  };

  const handleSeek = (e) => {
    if (!audioRef.current || duration === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    audioRef.current.currentTime = pct * duration;
    setElapsed(audioRef.current.currentTime);
  };

  // Auto-scroll transcript logic
  useEffect(() => {
    if (playState !== 'playing' || !showTranscript) return;
    
    // Find active message index
    const activeIdx = callTranscript.findIndex(m => elapsed >= m.start && elapsed <= m.end);
    if (activeIdx !== -1) {
      const node = transcriptRefs.current[activeIdx];
      const container = transcriptContainerRef.current;
      if (node && container) {
        const nodeTop = node.offsetTop;
        const nodeH = node.offsetHeight;
        const containerH = container.clientHeight;
        const target = nodeTop - containerH / 2 + nodeH / 2;
        container.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
      }
    }
  }, [elapsed, playState, showTranscript]);

  /* ── AI Summary Helpers ── */
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [justRefreshed, setJustRefreshed] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleRefreshSummary = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setJustRefreshed(true);
      setTimeout(() => setJustRefreshed(false), 2000);
    }, 2000);
  };

  const handleCopySummary = () => {
    if (!callSummary) return;
    const text = `Key Points Discussed:\n${callSummary.keyPoints.map(p => `• ${p}`).join('\n')}\n\nAction Items:\n${callSummary.actionItems.map(a => `• ${a}`).join('\n')}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  if (!detailPatient) return null;
  const p = detailPatient;

  // Resolve the specific call record for the clicked row, then fall back to first completed
  const specificCall = activeCallRow?.id
    ? (detailPatientCalls || []).find(c => c.id === activeCallRow.id)
    : null;
  const completedCall = specificCall || (detailPatientCalls || []).find(c => c.callType === 'completed');
  const callRecord = completedCall || {};
  const goalsDetail = callRecord.goalsDetail || [];
  const callSummary = callRecord.callSummary || null;
  const callTranscript = callRecord.callTranscript || [];

  // Sync with activeCallRow if available
  const callDate = activeCallRow?.date || callRecord.startedAt || p.callDate || null;
  const callDurationFull = activeCallRow?.duration || callRecord.duration || p.callDurationFull || null;
  const callDir = activeCallRow?.dir || callRecord.direction || (callRecord.callType === 'voicemail' ? 'missed' : callRecord.callType === 'declined' ? 'declined' : 'outgoing');
  const agentName = activeCallRow?.agent || callRecord.agentName || 'Anna';
  const isMissedOrDeclined = callDir === 'missed' || callDir === 'declined';

  const toggleSection = (key) => setOpenSections(s => ({ ...s, [key]: !s[key] }));
  const progress = duration > 0 ? elapsed / duration : 0;
  const progressBarIdx = Math.floor(progress * WAVE_BARS.length);

  return (
    <Drawer title="Call Details" onClose={closeDetail}>
      {/* ── Call Info Card ── */}
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
              {detailPatientCalls?.length > 1 && (
                <>
                  <span className={styles.dot}>•</span>
                  <span className={styles.callLine1Detail}>{detailPatientCalls.length} calls</span>
                </>
              )}
            </div>
            <div className={styles.callLine2}>
              Via: <Icon name="solar:bot-bold" size={13} color="var(--primary-300)" /> {agentName} (581) 824-1591 → To: {p.name} (581) 824-1591
            </div>
            {p.facility && (
              <div className={styles.callLine2}>{p.facility} • {p.admitReason}</div>
            )}
          </div>
        </div>
        <div className={styles.callCardActions} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ActionButton icon="solar:phone-linear" size="L" tooltip="Call" className={styles.callCardBtn} />
          <span style={{ width: 1, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />
          <ActionButton icon="solar:menu-dots-linear" size="L" tooltip="More options" className={styles.callCardBtn} />
        </div>
      </div>

      {/* ── Empty state for missed / declined calls ── */}
      {isMissedOrDeclined ? (
        <div className={styles.noCallState}>
          <CallTypeAvatar dir={callDir} size={36} iconSize={18} />
          <div className={styles.noCallStateTitle}>
            {callDir === 'declined' ? 'Patient declined this call.' : 'Call was not connected.'}
          </div>
          <div className={styles.noCallStateDesc}>
            No recording, transcript, goals, or summary available for this call.
          </div>
        </div>
      ) : (
        <>
          {/* ── Engagement Card ── */}
          {(callRecord.qualityScore || callRecord.sentimentScore || activeCallRow?.engagementScore) && (
            <EngagementCard
              engagementScore={activeCallRow?.engagementScore ?? callRecord.qualityScore?.overall ?? 0}
              sentimentScore={callRecord.sentimentScore?.overall || 0}
              sentimentLabel={callRecord.sentimentScore?.label || 'neutral'}
            />
          )}

          {/* ── Goal Progress ── */}
          {goalsDetail?.length > 0 && <GoalProgress goalsDetail={goalsDetail} />}

          {/* ── Unity-Generated Call Summary ── */}
          <div className={styles.sectionHeader} onClick={() => toggleSection('summary')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className={styles.sparkle} style={{ color: "#FF57CD" }}><Icon name="solar:magic-stick-3-bold" size={14} /></span>
              <span className={styles.aiGradientText} style={{ fontSize: 13, fontWeight: 600 }}>
                Unity-Generated Call Summary
              </span>
              <span className={`${styles.chevron} ${openSections.summary ? styles.chevronOpen : ''}`}>
                <Icon name="solar:alt-arrow-right-linear" size={16} />
              </span>
            </div>
            {isRefreshing && (
              <span style={{ fontSize: 12, color: "var(--neutral-300)", display:"inline-flex", alignItems:"center", gap:6 }}>
                <span className={styles.liveBars}><span/><span/><span/><span/></span>
                <span className={styles.aiGradientText} style={{fontWeight:500}}>Regenerating…</span>
              </span>
            )}
          </div>

          {openSections.summary && !callSummary && (
            <div style={{ padding: '16px', fontSize: 13, color: 'var(--neutral-300)', textAlign: 'center' }}>
              No call summary generated yet. Summary will appear after a completed call.
            </div>
          )}
          {openSections.summary && callSummary && (
            <div className={`${styles.summaryCard} ${isRefreshing ? styles.summaryCardRefreshing : ''}`}>
              {isRefreshing ? <ShimmerSummary /> : <SummaryContent data={callSummary} animate={justRefreshed} />}
              
              <div className={`${styles.summaryFooter} ${isRefreshing ? styles.summaryFooterRefreshing : ''}`}>
                <div className={styles.footerInfo}>
                  <Icon name="solar:clock-circle-linear" size={14} />
                  <span>Generated on 03/24/26, 07:23 pm</span>
                </div>
                <div className={styles.footerActions}>
                  <button className={styles.iconBtn} onClick={(e) => { e.stopPropagation(); handleRefreshSummary(); }} disabled={isRefreshing}>
                    <Icon name="solar:refresh-linear" size={14} style={isRefreshing ? { animation: "ai-shift 1s linear infinite" } : {}} />
                  </button>
                  <div className={styles.summaryDivider} />
                  <button className={styles.iconBtn} onClick={(e) => { e.stopPropagation(); handleCopySummary(); }}>
                    {copied ? <span className={styles.copyFb}><Icon name="solar:check-read-linear" size={14} /></span> : <Icon name="solar:copy-linear" size={14} />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Call Recording & Transcript ── */}
          <div className={styles.sectionHeader} onClick={() => toggleSection('transcript')}>
            <span className={styles.sectionTitle}>Call Recording &amp; Transcript</span>
            <span className={`${styles.chevron} ${openSections.transcript ? styles.chevronOpen : ''}`}>
              <Icon name="solar:alt-arrow-right-linear" size={16} />
            </span>
          </div>
          {openSections.transcript && (!callTranscript || callTranscript.length === 0) && (
            <div style={{ padding: '16px', fontSize: 13, color: 'var(--neutral-300)', textAlign: 'center' }}>
              No call recording available. Recording will appear after a completed call.
            </div>
          )}
          {openSections.transcript && callTranscript?.length > 0 && (
            <div className={styles.recordingContainer}>
              {/* Audio Player */}
              <div className={styles.audioPlayer}>
                <audio
                  ref={audioRef}
                  src={RECORDING_URL}
                  onTimeUpdate={onTimeUpdate}
                  onLoadedMetadata={onLoadedMetadata}
                  onEnded={onEnded}
                  style={{ display: 'none' }}
                />
                <span className={styles.audioTime}>
                  {playState === 'idle' ? formatTime(duration) : formatTime(elapsed)}
                </span>
                <div className={styles.waveformContainer} onClick={handleSeek}>
                  <div className={styles.waveform}>
                    {WAVE_BARS.map((h, i) => (
                      <div
                        key={i}
                        className={`${styles.waveBar} ${i <= progressBarIdx && playState !== 'idle' ? styles.waveBarPlayed : styles.waveBarUnplayed}`}
                        style={{ height: `${h}px` }}
                      />
                    ))}
                  </div>
                </div>
                <div className={styles.audioButtons}>
                  {playState === 'idle' && (
                    <Button variant="primary" size="S" leadingIcon="solar:play-bold" className={styles.playBtn} onClick={startPlayback}>
                      Play Recording
                    </Button>
                  )}
                  {playState === 'playing' && (
                    <>
                      <Button variant="secondary" size="S" leadingIcon="solar:pause-bold" className={styles.pauseBtn} onClick={pausePlayback}>
                        Pause
                      </Button>
                      <Button variant="dangerFilled" size="S" leadingIcon="solar:stop-bold" className={styles.stopBtn} onClick={stopPlayback}>
                        Stop
                      </Button>
                    </>
                  )}
                  {playState === 'paused' && (
                    <>
                      <Button variant="primary" size="S" leadingIcon="solar:play-bold" className={styles.playBtn} onClick={startPlayback}>
                        Resume
                      </Button>
                      <Button variant="dangerFilled" size="S" leadingIcon="solar:stop-bold" className={styles.stopBtn} onClick={stopPlayback}>
                        Stop
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Transcript Sub-section */}
              <div className={styles.transcriptSubHeader} onClick={() => setShowTranscript(v => !v)}>
                <span className={styles.transcriptSubTitle}>Call Transcript</span>
                <span className={`${styles.chevron} ${showTranscript ? styles.chevronOpen : ''}`}>
                  <Icon name="solar:alt-arrow-right-linear" size={14} color="var(--neutral-200)" />
                </span>
              </div>

              {showTranscript && (
                <div className={styles.transcriptBody} ref={transcriptContainerRef}>
                  <div className={styles.transcriptDivider}><span>Today</span></div>
                  {callTranscript.map((msg, i) => {
                    const isActive = elapsed >= msg.start && elapsed <= msg.end;
                    const isSystem = msg.sender === 'system';
                    
                    return (
                      <div 
                        key={i} 
                        ref={el => transcriptRefs.current[i] = el}
                        className={`${styles.message} ${styles[msg.sender] || ''} ${isActive ? styles.messageActive : ''}`}
                      >
                        {!isSystem && msg.sender === 'agent' && (
                          <div className={styles.msgAvatar}>
                            <Icon name="solar:bot-bold" size={12} color="var(--primary-300)" />
                          </div>
                        )}
                        <div className={styles.msgContent}>
                          {!isSystem && (
                            <div className={styles.msgHeader}>
                              <span className={styles.msgSender}>{msg.name}</span>
                              <button className={styles.msgMore}><Icon name="solar:menu-dots-linear" size={14} /></button>
                            </div>
                          )}
                          <div className={styles.msgBubble}>{msg.text}</div>
                          {!isSystem && (
                            <div className={styles.msgTime}>
                              Today, {msg.time}
                              {msg.sender === 'patient' && <span className={styles.readReceipt}> ✓✓</span>}
                            </div>
                          )}
                        </div>
                        {!isSystem && msg.sender === 'patient' && (
                          <div className={styles.msgAvatar} style={{ background: 'var(--primary-100)', marginTop: 18 }}>
                            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--primary-400)' }}>
                              {msg.name.split(' ').map(n => n[0]).join('')}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Drawer>
  );
}
