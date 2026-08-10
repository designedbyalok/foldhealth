import { useState, useEffect } from 'react';
import { Icon } from '../Icon/Icon';
import styles from './DetailDrawer.module.css';

const ShimmerSummary = () => (
  <div style={{ padding: '14px 16px 16px' }}>
    <div className={styles.shimmerLine} style={{ width: '42%', marginBottom: 12 }} />
    <div className={styles.shimmerLine} style={{ width: '94%', marginBottom: 8 }} />
    <div className={styles.shimmerLine} style={{ width: '86%', marginBottom: 8 }} />
    <div className={styles.shimmerLine} style={{ width: '72%', marginBottom: 16 }} />
    <div className={styles.shimmerLine} style={{ width: '32%', marginBottom: 12 }} />
    <div className={styles.shimmerLine} style={{ width: '80%', marginBottom: 8 }} />
    <div className={styles.shimmerLine} style={{ width: '64%' }} />
  </div>
);

function Typewriter({ text, speed = 10, onDone }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (n >= text.length) { onDone?.(); return; }
    const id = setTimeout(() => setN(prev => prev + 1), speed);
    return () => clearTimeout(id);
  }, [n, text, speed, onDone]);
  return <>{text.slice(0, n)}{n < text.length && <span className={styles.typeCursor} />}</>;
}

function SummaryContent({ data, animate }) {
  const [phase, setPhase] = useState(animate ? 0 : 99);
  useEffect(() => { if (animate) setPhase(0); else setPhase(99); }, [animate]);

  const lines = [];
  lines.push({ kind: 'heading', text: 'Key Points Discussed:' });
  data.keyPoints.forEach(it => lines.push({ kind: 'item', text: it }));
  lines.push({ kind: 'heading', text: 'Action Items:' });
  data.actionItems.forEach(it => lines.push({ kind: 'item', text: it }));

  return (
    <div style={{ padding: '14px 16px 14px' }}>
      {lines.map((l, i) => {
        const visible = !animate || i <= phase;
        const active = animate && i === phase;
        if (!visible) return <div key={i} style={{ height: l.kind === 'heading' ? 22 : 20 }} />;
        return (
          <div key={i} style={{
            margin: l.kind === 'heading' ? (i === 0 ? '0 0 6px' : '12px 0 6px') : '3px 0',
            paddingLeft: l.kind === 'item' ? 16 : 0,
            position: 'relative',
            fontSize: 13.5,
            fontWeight: l.kind === 'heading' ? 600 : 400,
            color: 'var(--neutral-400)',
            lineHeight: 1.5,
            opacity: animate && i > phase ? 0 : 1,
            transition: 'opacity 260ms ease',
          }}>
            {l.kind === 'item' && (
              <span style={{
                position: 'absolute', left: 2, top: '0.65em',
                width: 3, height: 3, borderRadius: '50%',
                background: 'var(--primary-300)',
              }} />
            )}
            {active ? <Typewriter text={l.text} onDone={() => setPhase(p => p + 1)} /> : l.text}
          </div>
        );
      })}
    </div>
  );
}

export function DetailDrawerSummary({
  open,
  onToggle,
  callSummary,
  isRefreshing,
  justRefreshed,
  copied,
  onRefresh,
  onCopy,
}) {
  return (
    <>
      <button type="button" className={styles.sectionHeader} onClick={onToggle} aria-expanded={open}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className={styles.sparkle}>
            <Icon name="solar:magic-stick-3-bold" size={14} />
          </span>
          <span className={styles.aiGradientText} style={{ fontSize: 13, fontWeight: 600 }}>
            Unity-Generated Call Summary
          </span>
          <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>
            <Icon name="solar:alt-arrow-right-linear" size={16} />
          </span>
        </div>
        {isRefreshing && (
          <span style={{ fontSize: 12, color: 'var(--neutral-300)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span className={styles.liveBars}><span /><span /><span /><span /></span>
            <span className={styles.aiGradientText} style={{ fontWeight: 500 }}>Regenerating…</span>
          </span>
        )}
      </button>

      {open && !callSummary && (
        <div style={{ padding: '16px', fontSize: 13, color: 'var(--neutral-300)', textAlign: 'center' }}>
          No call summary generated yet. Summary will appear after a completed call.
        </div>
      )}
      {open && callSummary && (
        <div className={`${styles.summaryCard} ${isRefreshing ? styles.summaryCardRefreshing : ''}`}>
          {isRefreshing ? <ShimmerSummary /> : <SummaryContent data={callSummary} animate={justRefreshed} />}

          <div className={`${styles.summaryFooter} ${isRefreshing ? styles.summaryFooterRefreshing : ''}`}>
            <div className={styles.footerInfo}>
              <Icon name="solar:clock-circle-linear" size={14} />
              <span>Generated on 03/24/26, 07:23 pm</span>
            </div>
            <div className={styles.footerActions}>
              <button className={styles.iconBtn} onClick={(e) => { e.stopPropagation(); onRefresh(); }} disabled={isRefreshing} aria-label="Regenerate summary">
                <Icon name="solar:refresh-linear" size={14} style={isRefreshing ? { animation: 'ai-shift 1s linear infinite' } : {}} />
              </button>
              <div className={styles.summaryDivider} />
              <button className={styles.iconBtn} onClick={(e) => { e.stopPropagation(); onCopy(); }} aria-label="Copy summary">
                {copied ? <span className={styles.copyFb}><Icon name="solar:check-read-linear" size={14} /></span> : <Icon name="solar:copy-linear" size={14} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
