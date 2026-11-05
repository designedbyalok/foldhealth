import { useEffect, useRef, useState } from 'react';
import { Icon } from '../Icon/Icon';
import styles from './VoicePreviewPopover.module.css';

const VOICE_COLORS = { Erica: '#E74C8B', Ricardo: '#7C5CFC', Jia: '#F59E0B' };

const SAMPLE_LINES = {
  Erica: "Hi, I'm Erica. I'll be checking in about your recent discharge.",
  Ricardo: "Hola, I'm Ricardo. Let me help you with your care plan today.",
  Jia: "Hello, I'm Jia. I'm here to support your recovery.",
};
const DEFAULT_LINE = "Hi there! I'm your Fold Health care assistant.";

const PREVIEW_MS = 4000;

export function VoicePreviewPopover({ voice, pos, onMouseEnter, onMouseLeave }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef(null);
  const startRef = useRef(0);

  useEffect(() => {
    if (!playing) return undefined;
    startRef.current = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - startRef.current) / PREVIEW_MS);
      setProgress(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setPlaying(false);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing]);

  if (!voice) return null;

  const color = VOICE_COLORS[voice.name] || '#7C5CFC';
  const sample = SAMPLE_LINES[voice.name] || DEFAULT_LINE;
  const totalSec = (PREVIEW_MS / 1000).toFixed(1);
  const currentSec = (progress * (PREVIEW_MS / 1000)).toFixed(1);
  const initial = (voice.name?.[0] || '?').toUpperCase();

  const handleToggle = () => {
    if (playing) {
      setPlaying(false);
      setProgress(0);
    } else {
      setProgress(0);
      setPlaying(true);
    }
  };

  return (
    <div
      className={styles.popover}
      style={{ top: pos.top, left: pos.left }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className={styles.header}>
        <span className={styles.avatar} style={{ background: `${color}22`, color }}>
          {initial}
        </span>
        <div className={styles.identity}>
          <div className={styles.name}>{voice.name}</div>
          <div className={styles.meta}>
            {voice.gender}
            {voice.language ? ` • ${voice.language}` : ''}
          </div>
        </div>
        <span className={styles.voiceDot} style={{ background: color }} />
      </div>

      <div className={styles.sample}>“{sample}”</div>

      <div className={styles.player}>
        <button
          type="button"
          className={styles.playBtn}
          style={{ background: color }}
          onClick={handleToggle}
          aria-label={playing ? 'Stop preview' : 'Play preview'}
        >
          <Icon name={playing ? 'solar:pause-bold' : 'solar:play-bold'} size={14} color="#fff" />
        </button>
        <div className={styles.progressWrap}>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${progress * 100}%`, background: color }}
            />
          </div>
          <div className={styles.timer}>
            {playing ? currentSec : '0.0'} / {totalSec}s
          </div>
        </div>
      </div>

      <div className={styles.footnote}>Preview approximates tone & pacing</div>
    </div>
  );
}
