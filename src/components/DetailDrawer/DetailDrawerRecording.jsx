import { useState } from 'react';
import { Icon } from '../Icon/Icon';
import { Button } from '../Button/Button';
import { WAVE_BARS, RECORDING_URL, formatTime } from './detailDrawerConstants';
import styles from './DetailDrawer.module.css';

export function DetailDrawerRecording({
  open,
  onToggleSection,
  callTranscript,
  audioRef,
  playState,
  elapsed,
  duration,
  onTimeUpdate,
  onLoadedMetadata,
  onEnded,
  onSeek,
  startPlayback,
  pausePlayback,
  stopPlayback,
  transcriptContainerRef,
  transcriptRefs,
}) {
  const [showTranscript, setShowTranscript] = useState(true);
  const progress = duration > 0 ? elapsed / duration : 0;
  const progressBarIdx = Math.floor(progress * WAVE_BARS.length);

  // The waveform is a scrubber, so keyboard users get the arrow/Home/End
  // contract a slider is expected to honour. Writing currentTime fires the
  // audio element's timeupdate, which is what keeps `elapsed` in sync.
  const SEEK_STEP = 5;
  const seekTo = (seconds) => {
    if (!audioRef.current || duration === 0) return;
    audioRef.current.currentTime = Math.max(0, Math.min(duration, seconds));
  };

  const handleWaveformKeyDown = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') seekTo(elapsed + SEEK_STEP);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') seekTo(elapsed - SEEK_STEP);
    else if (e.key === 'Home') seekTo(0);
    else if (e.key === 'End') seekTo(duration);
    else return;
    e.preventDefault();
  };

  return (
    <>
      <button type="button" className={styles.sectionHeader} onClick={onToggleSection} aria-expanded={open}>
        <span className={styles.sectionTitle}>Call Recording &amp; Transcript</span>
        <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>
          <Icon name="solar:alt-arrow-right-linear" size={16} />
        </span>
      </button>
      {open && (!callTranscript || callTranscript.length === 0) && (
        <div style={{ padding: '16px', fontSize: 13, color: 'var(--neutral-300)', textAlign: 'center' }}>
          No call recording available. Recording will appear after a completed call.
        </div>
      )}
      {open && callTranscript?.length > 0 && (
        <div className={styles.recordingContainer}>
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
            <div
              className={styles.waveformContainer}
              onClick={onSeek}
              onKeyDown={handleWaveformKeyDown}
              role="slider"
              tabIndex={0}
              aria-label="Seek recording"
              aria-valuemin={0}
              aria-valuemax={Math.round(duration) || 0}
              aria-valuenow={Math.round(elapsed) || 0}
              aria-valuetext={`${formatTime(elapsed)} of ${formatTime(duration)}`}
            >
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

          <button
            type="button"
            className={styles.transcriptSubHeader}
            onClick={() => setShowTranscript(v => !v)}
            aria-expanded={showTranscript}
          >
            <span className={styles.transcriptSubTitle}>Call Transcript</span>
            <span className={`${styles.chevron} ${showTranscript ? styles.chevronOpen : ''}`}>
              <Icon name="solar:alt-arrow-right-linear" size={14} color="var(--neutral-200)" />
            </span>
          </button>

          {showTranscript && (
            <div className={styles.transcriptBody} ref={transcriptContainerRef}>
              <div className={styles.transcriptDivider}><span>Today</span></div>
              {callTranscript.map((msg, i) => {
                const isActive = elapsed >= msg.start && elapsed <= msg.end;
                const isSystem = msg.sender === 'system';

                return (
                  <div
                    key={i}
                    ref={el => { transcriptRefs.current[i] = el; }}
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
  );
}
