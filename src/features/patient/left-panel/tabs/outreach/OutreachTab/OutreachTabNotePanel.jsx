import { Icon } from '../../../../../../components/Icon/Icon';
import { DownChevronIcon } from '../../../../../../components/Icon/DownChevronIcon';
import { Switch } from '../../../../../../components/Switch/Switch';
import { OUTCOME_CHOICES } from './OutreachTab.utils';
import styles from './OutreachTab.module.css';

export function NotePanel({ title, expanded, outcomes, note, syncText, outcomeOpen, showSyncText,
  onToggleExpand, onToggleOutcomeOpen, onAddOutcome, onRemoveOutcome, onNoteChange, onToggleSyncText,
  outcomeType }) {

  const badgeClass = outcomeType === 'Successful' ? styles.outcomeBadgeSuccess
    : outcomeType === 'Unsuccessful' ? styles.outcomeBadgeError
    : styles.outcomeBadgeWarning;

  return (
    <div className={styles.notePanel}>
      <div className={styles.notePanelHeader}>
        <button className={styles.notePanelTitle} onClick={onToggleExpand} type="button">
          <span className={styles.notePanelName}>{title}</span>
          <DownChevronIcon
            size={14} color="var(--neutral-400)"
            style={expanded ? undefined : { transform: 'rotate(-90deg)' }}
          />
        </button>
        <div className={styles.notePanelActions}>
          <div className={styles.selectOutcomeWrap}>
            <button className={styles.selectOutcomeBtn} onClick={onToggleOutcomeOpen} type="button">
              <Icon name="solar:add-circle-linear" size={12} color="var(--neutral-300)" />
              <span>Select Outcome</span>
              {outcomes.length === 0 && <span className={styles.mandatoryDot} aria-hidden="true" />}
            </button>
            {outcomeOpen && (
              <div className={styles.outcomeDropdown}>
                {OUTCOME_CHOICES.map(val => (
                  <button key={val} className={styles.outcomeDropdownItem}
                    onClick={() => onAddOutcome(val)} type="button">
                    {val}
                  </button>
                ))}
              </div>
            )}
          </div>
          {showSyncText && (
            <>
              <span className={styles.panelDivider} />
              <Switch
                checked={syncText}
                onChange={onToggleSyncText}
                label="Sync Text"
                ariaLabel="Sync text across panels"
              />
            </>
          )}
        </div>
      </div>

      {expanded && (
        <>
          {outcomes.length > 0 && (
            <div className={styles.outcomeRow}>
              <span className={styles.outcomeRowLabel}>Outcome:</span>
              {outcomes.map(o => (
                <button key={o} className={`${styles.outcomeBadge} ${badgeClass}`}
                  onClick={() => onRemoveOutcome(o)} type="button">
                  {o}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              ))}
            </div>
          )}
          <textarea aria-label="Outreach note"
            className={styles.noteTextarea}
            placeholder="Write note"
            value={note}
            onChange={e => onNoteChange(e.target.value)}
          />
        </>
      )}
    </div>
  );
}
