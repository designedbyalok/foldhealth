import { useMemo } from 'react';
import { Badge } from '../../../components/Badge/Badge';
import { Button } from '../../../components/Button/Button';
import { CloseButton } from '../../../components/CloseButton/CloseButton';
import { Icon } from '../../../components/Icon/Icon';
import { AIIcon } from '../../../components/Icon/AIIcon';
import { useAppStore } from '../../../store/useAppStore';
import { CHANNELS, FAMILY, nodeDef, triggerDef } from '../lib/catalog';
import { nodeProblems, nodeSummary } from '../lib/graph';
import { preferredChannelOf } from '../lib/conditionFields';
import { ActionEditor } from '../builder/ActionEditor';
import builderStyles from '../builder/AutomationBuilder.module.css';
import styles from './TestRun.module.css';

const BADGE = {
  running: { tone: 'warning', label: 'In process' },
  success: { tone: 'success', label: 'Success' },
  error: { tone: 'error', label: 'Error' },
  skipped: { tone: 'grey', label: 'Skipped' },
};

/**
 * The Test Run panel. Walks the automation one step at a time without
 * touching real data; a step with missing setup errors, the author fixes the
 * field right here (the change is saved to the automation), then tests the
 * step again or continues.
 */
export function TestRunPanel({ test, onConfigChange, onClose, onPublish, isActive }) {
  const members = useAppStore(s => s.automationMembers);
  const { phase, current, result, running, steps, index, summary, autoplay } = test;

  // "N% of the targeted population prefers chat": shown on email steps when a
  // large share prefers another channel (Figma step 7).
  const insight = useMemo(() => {
    const def = nodeDef(current?.type);
    if (!def || def.channel !== 'email' || !members.length) return null;
    const counts = {};
    members.forEach(m => { const c = preferredChannelOf(m); counts[c] = (counts[c] || 0) + 1; });
    const [top, n] = Object.entries(counts).filter(([k]) => k !== 'email' && k !== 'none').sort((a, b) => b[1] - a[1])[0] || [];
    const share = n ? Math.round((n / members.length) * 100) : 0;
    return share >= 25 ? { share, channel: CHANNELS.find(c => c.key === top)?.label.toLowerCase() || top } : null;
  }, [current, members]);

  if (phase === 'intro') {
    return (
      <section className={builderStyles.panel} aria-label="Test run">
        <header className={builderStyles.panelHeader}>
          <h2 className={builderStyles.panelTitle}>Test Run</h2>
          <CloseButton size={18} onClick={onClose} />
        </header>
        <div className={styles.intro}>
          <span className={styles.introIcon}><Icon name="solar:test-tube-minimalistic-linear" size={40} /></span>
          <h3 className={styles.introTitle}>Automation testing</h3>
          <p className={styles.introText}>Step through your automation to see how it runs, one step at a time.</p>
          <ul className={styles.introList}>
            <li>No emails or messages go to real members.</li>
            <li>Delays are skipped automatically.</li>
            <li>Fix a step right here if it fails, then test it again.</li>
          </ul>
          <Button onClick={test.start}>Start test</Button>
        </div>
      </section>
    );
  }

  if (phase === 'done') {
    const clean = !summary.failed && !summary.skipped;
    return (
      <section className={builderStyles.panel} aria-label="Test run">
        <header className={builderStyles.panelHeader}>
          <h2 className={builderStyles.panelTitle}>Test Run</h2>
          <CloseButton size={18} onClick={onClose} />
        </header>
        <div className={styles.intro}>
          <span className={`${styles.introIcon} ${clean ? styles.introIconSuccess : ''}`}>
            <Icon name={clean ? 'solar:confetti-minimalistic-linear' : 'solar:checklist-minimalistic-linear'} size={40} />
          </span>
          <h3 className={styles.introTitle}>{clean ? 'Congratulations!' : 'Test finished'}</h3>
          <p className={styles.introText}>
            {clean
              ? 'Every step ran as expected. Your automation is ready to go live.'
              : `${summary.passed} step${summary.passed === 1 ? '' : 's'} passed, ${summary.skipped} skipped${summary.failed ? `, ${summary.failed} failed` : ''}. Test the skipped steps before going live.`}
          </p>
          <div className={styles.doneActions}>
            {clean && !isActive && <Button onClick={onPublish}>Publish</Button>}
            <Button variant="outline" onClick={test.start}>Test again</Button>
            <Button variant="soft" onClick={onClose}>Done</Button>
          </div>
        </div>
      </section>
    );
  }

  const isTrigger = current?.id === 'trigger';
  const def = isTrigger ? triggerDef(current.type) : nodeDef(current?.type);
  const family = FAMILY[isTrigger ? 'trigger' : def?.family] || FAMILY.add;
  const status = result?.status;
  const badge = BADGE[status];
  // Field errors from the last test, cleared as the author fills each field.
  const stillMissing = new Set(nodeProblems(current).map(p => p.field));
  const errors = Object.fromEntries((result?.errors || []).filter(e => stillMissing.has(e.field)).map(e => [e.field, e.message]));
  const ready = !status || status === 'error';

  let body;
  if (isTrigger) {
    body = (
      <div className={styles.matchCard}>
        <span className={styles.matchLabel}>Match condition</span>
        <span className={styles.matchValue}><Icon name={def?.icon} size={18} /> {def?.label}</span>
      </div>
    );
  } else if (def?.kind === 'condition') {
    body = <p className={styles.stepText}>{nodeSummary(current) || 'No conditions set: every member continues.'}</p>;
  } else if (current?.type === 'delay') {
    body = <p className={styles.stepText}>{nodeSummary(current)}. Skipped during a test.</p>;
  } else if (current?.type === 'repeat') {
    body = <p className={styles.stepText}>{nodeSummary(current)}. Not repeated during a test.</p>;
  } else if (def?.kind === 'action') {
    body = <ActionEditor type={current.type} config={current.config || {}} onChange={(p) => onConfigChange(current.id, p)} errors={errors} />;
  }

  return (
    <section className={builderStyles.panel} aria-label="Test run">
      <header className={builderStyles.panelHeader}>
        <h2 className={builderStyles.panelTitle}>Test Run</h2>
        <span className={builderStyles.panelHeaderActions}>
          <Button variant="outline" leadingIcon="solar:play-linear" disabled={autoplay || running} onClick={test.playAll}>Play All Steps</Button>
          <Button leadingIcon="solar:stop-linear" onClick={() => { test.stop(); onClose(); }}>Stop</Button>
        </span>
      </header>
      <p className={styles.infoLine}><Icon name="solar:info-circle-linear" size={14} /> Testing mode: no real data changes.</p>
      <div className={styles.stepHead}>
        <span className={styles.stepCount}>Step {index + 1}/{steps.length}</span>
        <div className={styles.stepTitleRow}>
          <span className={builderStyles.panelHeadingIcon} style={{ color: family.color, background: family.bg }}><Icon name={isTrigger ? 'solar:bolt-linear' : def?.icon} size={16} /></span>
          <span className={styles.stepTitle}>{isTrigger ? def?.label : def?.nodeLabel}</span>
          {badge && <Badge size="sm" tone={badge.tone} label={badge.label} />}
          {status === 'error' && <Button variant="outline" size="sm" className={styles.continueBtn} onClick={test.skip}>Continue</Button>}
        </div>
      </div>
      <div className={builderStyles.panelBody}>
        {insight && (
          <div className={styles.insight}>
            <AIIcon size={16} />
            <span>{insight.share}% of the targeted members prefer {insight.channel}. Consider sending this step on each member’s preferred channel.</span>
          </div>
        )}
        {body}
      </div>
      {ready && !autoplay && (
        <footer className={styles.footer}>
          <Button leadingIcon="solar:play-linear" disabled={running} onClick={test.run}>Test This Step</Button>
          <Button variant="outline" trailingIcon="solar:skip-next-linear" disabled={running} onClick={test.skip}>Skip This Step</Button>
        </footer>
      )}
    </section>
  );
}
