import { useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { Icon } from '../../../components/Icon/Icon';
import { Button } from '../../../components/Button/Button';
import { getMeatNoteFromDb } from '../data/confidence';
import styles from './IcdRow.module.css';

export function IcdRowExpansionPanel({
  panel,
  isClosed,
  confOpen,
  setConfOpen,
  setPanel,
  conf,
  scoreStyle,
  meatOpen,
  setMeatOpen,
  meatText,
  setMeatText,
  gapConfMap,
  icd,
  onSignAccept,
  showToast,
}) {
  if (panel === 'none' || isClosed) return null;

  return (
    <div className={styles.expansionPanel}>
      <div className={styles.expandSection}>
        <div className={styles.expandHeader}>
          <button
            type="button"
            className={styles.expandHeaderLeft}
            onClick={() => setConfOpen(o => !o)}
          >
            <Icon
              name={confOpen ? 'solar:alt-arrow-down-linear' : 'solar:alt-arrow-right-linear'}
              size={12}
              color="var(--neutral-300)"
            />
            <span className={styles.expandTitle}>Confidence Score</span>
            <span
              className={styles.scorePill}
              style={{ background: scoreStyle.bg, color: scoreStyle.color }}
            >
              <span className={styles.scoreValue}>{conf.score}/100</span>
              <span className={styles.scoreLabel}>&bull; {scoreStyle.label}</span>
            </span>
          </button>
          <Button
            variant="ghost"
            size="S"
            leadingIcon="solar:close-linear"
            className={styles.expandClose}
            onClick={() => setPanel('none')}
          >
            Close
          </Button>
        </div>
        {confOpen && (
          <div className={styles.evidenceWrap}>
            <div className={styles.evidenceHeader}>
              <Icon name="solar:bolt-linear" size={14} color="var(--primary-300)" />
              <span>Clinical Evidence</span>
            </div>
            {conf.evidence.map((ev, i) => (
              <div key={i} className={styles.evidenceRow}>
                <span className={styles.evidenceBullet} aria-hidden="true" />
                <span className={styles.evidenceText}>{ev.text}</span>
                <button
                  type="button"
                  className={styles.evidenceLink}
                  title="Open source document"
                  aria-label="Open source document"
                >
                  <Icon name="solar:link-linear" size={12} color="var(--primary-300)" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.expandSection}>
        <button
          type="button"
          className={styles.expandHeaderLeft}
          onClick={() => {
            if (!meatOpen && !meatText) setMeatText(getMeatNoteFromDb(gapConfMap, icd.code, icd.desc));
            setMeatOpen(o => !o);
          }}
        >
          <Icon
            name={meatOpen ? 'solar:alt-arrow-down-linear' : 'solar:alt-arrow-right-linear'}
            size={12}
            color="var(--neutral-400)"
          />
          <span className={styles.expandTitleLg}>MEAT Note</span>
          <span className={styles.readyBadge}>
            <Icon name="solar:star-bold" size={9} color="var(--primary-300)" />
            <span>Ready</span>
          </span>
        </button>
        {meatOpen && (
          <div className={styles.meatBody}>
            <div className={styles.meatInfoBanner}>
              <Icon name="solar:info-circle-linear" size={12} color="var(--status-info)" />
              <span>Review this auto-generated MEAT note before accepting.</span>
            </div>
            <textarea
              aria-label="MEAT note"
              className={styles.meatTextarea}
              value={meatText}
              onChange={(e) => setMeatText(e.target.value)}
            />
            <div className={styles.meatActions}>
              <button
                type="button"
                className={[styles.meatBtn, styles.meatSignBtn].join(' ')}
                onClick={onSignAccept}
                disabled={!meatText.trim()}
              >
                <Icon name="solar:pen-linear" size={12} color="var(--neutral-0)" />
                <span>Sign &amp; Accept</span>
              </button>
              <button
                type="button"
                className={styles.meatBtn}
                onClick={() => showToast('Saved as draft — wiring in a follow-up.')}
              >
                <Icon name="solar:notes-linear" size={12} color="var(--neutral-300)" />
                <span>Save as Draft</span>
              </button>
              <button
                type="button"
                className={styles.meatBtn}
                onClick={() => {
                  navigator.clipboard?.writeText?.(meatText);
                  showToast('MEAT note copied to clipboard');
                }}
              >
                <Icon name="solar:copy-linear" size={12} color="var(--neutral-300)" />
                <span>Copy</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
