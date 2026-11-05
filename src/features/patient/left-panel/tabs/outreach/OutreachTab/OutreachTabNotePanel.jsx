import { useMemo, useRef, useState } from 'react';
import { Icon } from '../../../../../../components/Icon/Icon';
import { DownChevronIcon } from '../../../../../../components/Icon/DownChevronIcon';
import { Switch } from '../../../../../../components/Switch/Switch';
import { Textarea } from '../../../../../../components/Textarea/Textarea';
import { CollapsibleContent } from '../../../../../../components/Collapsible/Collapsible';
import { MenuPopover } from '../../../../../../components/MenuPopover/MenuPopover';
import { CheckboxListPopover } from '../../../../../../components/CheckboxListPopover/CheckboxListPopover';
import { Tooltip } from '../../../../../../components/Tooltip/Tooltip';
import { OUTCOME_CHOICES_BY_STATUS } from './OutreachTab.utils';
import styles from './OutreachTab.module.css';

export function NotePanel({ title, expanded, outcomes, note, syncText, outcomeOpen, showSyncText,
  onToggleExpand, onToggleOutcomeOpen, onAddOutcome, onRemoveOutcome, onSetOutcomes, onNoteChange, onToggleSyncText,
  outcomeType, choiceItems = null }) {
  const outcomeBtnRef = useRef(null);
  const [anchorRect, setAnchorRect] = useState(null);
  // The menu lists only the outcomes that fit the chosen Outreach Outcome,
  // so it stays disabled until one of those radios is picked. A host can
  // supply its own items (`choiceItems`, grouped by section headers); those
  // open as a checkbox list so several outcomes go in at once.
  const menuItems = choiceItems
    ? choiceItems
    : (OUTCOME_CHOICES_BY_STATUS[outcomeType] || []).filter(o => !outcomes.includes(o)).map(val => ({ key: val, label: val }));
  const choice = useMemo(() => {
    const keys = [], label = {}, section = {};
    let current = null;
    for (const it of choiceItems || []) {
      if (it.section) { current = it.section; continue; }
      if (!it.key) continue;
      keys.push(it.key); label[it.key] = it.label; section[it.key] = current;
    }
    return { keys, label, section };
  }, [choiceItems]);
  // Outcomes picked under another Outreach Outcome stay; the list only
  // replaces the ones it shows.
  const setChoiceOutcomes = (next) => onSetOutcomes([...outcomes.filter(o => !choice.keys.includes(o)), ...next]);
  const outcomeDisabled = !outcomeType;

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
            className={styles.chevron}
            style={expanded ? undefined : { transform: 'rotate(-90deg)' }}
          />
        </button>
        <div className={styles.notePanelActions}>
          <div className={styles.selectOutcomeWrap}>
            <Tooltip label={outcomeDisabled ? 'Select Successful, Unsuccessful or Note first' : null}>
              <button
                ref={outcomeBtnRef}
                className={styles.selectOutcomeBtn}
                onClick={e => { setAnchorRect(e.currentTarget.getBoundingClientRect()); onToggleOutcomeOpen(); }}
                disabled={outcomeDisabled}
                type="button"
              >
                <Icon name="solar:add-circle-linear" size={12} color="var(--neutral-300)" />
                <span>Select Outcome</span>
                {outcomes.length === 0 && <span className={styles.mandatoryDot} aria-hidden="true" />}
              </button>
            </Tooltip>
            {outcomeOpen && !outcomeDisabled && choiceItems && choice.keys.length > 0 && (
              <CheckboxListPopover
                anchorRect={anchorRect}
                options={choice.keys}
                selected={outcomes}
                onChange={setChoiceOutcomes}
                onClose={onToggleOutcomeOpen}
                labelOf={k => choice.label[k]}
                sectionOf={k => choice.section[k]}
                width={380}
                showClear={false}
                searchable
                searchPlaceholder="Search outcomes or stakeholder…"
              />
            )}
            {outcomeOpen && !outcomeDisabled && !choiceItems && menuItems.some(it => it.key) && (
              <MenuPopover
                anchorRef={outcomeBtnRef}
                items={menuItems}
                onSelect={onAddOutcome}
                onClose={onToggleOutcomeOpen}
                width={260}
                ariaLabel="Select outcome"
              />
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

      <CollapsibleContent open={expanded}>
        <div className={styles.notePanelBody}>
          {outcomes.length > 0 && (
            <div className={styles.outcomeRow}>
              <span className={styles.outcomeRowLabel}>Outcome:</span>
              {outcomes.map(o => (
                <button key={o} className={`${styles.outcomeBadge} ${badgeClass}`}
                  onClick={() => onRemoveOutcome(o)} type="button">
                  {o}
                  <Icon name="solar:close-circle-linear" size={10} color="currentColor" />
                </button>
              ))}
            </div>
          )}
          <Textarea aria-label="Outreach note"
            className={styles.noteTextarea}
            placeholder="Write note"
            value={note}
            onChange={e => onNoteChange(e.target.value)}
          />
        </div>
      </CollapsibleContent>
    </div>
  );
}
