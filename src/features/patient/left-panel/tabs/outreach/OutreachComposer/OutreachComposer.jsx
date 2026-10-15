import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../../../../../components/Button/Button';
import { Textarea } from '../../../../../../components/Textarea/Textarea';
import { Switch } from '../../../../../../components/Switch/Switch';
import { ActionButton } from '../../../../../../components/ActionButton/ActionButton';
import { Tooltip } from '../../../../../../components/Tooltip/Tooltip';
import { Icon } from '../../../../../../components/Icon/Icon';
import { DateTimePicker } from '../../../../../../components/DateTimePicker/DateTimePicker';
import { TypeDropdown, FieldDropdown } from '../OutreachTab/OutreachTabDropdowns';
import { OutreachProgramChip } from './OutreachProgramChip';
import { LOG_FOR_OPTIONS } from '../OutreachTab/OutreachTab.utils';
import { RadioButton } from '../../../../../../components/RadioButton/RadioButton';
import styles from './OutreachComposer.module.css';

const RELATIVE_TIME_LABEL = (iso) => {
  if (!iso) return 'just now';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime?.())) return 'just now';
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

/**
 * OutreachComposer — chat-style replacement for the old OutreachTabForm.
 *
 * Collapses the previous form (Log For radio + Type + Datetime + Call
 * Details block + Programs multi-select + Outreach Outcome radio +
 * Separate Notes switch + Note panels + Actions row + Save/Discard)
 * into a composer with three visual tiers:
 *
 *   1. Default: scoped program chip, placeholder, Save hint.
 *   2. Focus-expanded: Type, logged-at, program chips (with inline
 *      outcome), note area, action tray, Save / Discard.
 *   3. Hidden behind … More: Separate Notes, Log For, Call Details
 *      (auto-shown when Type = Call), per-program notes.
 *
 * The host hook (`useOutreachTab`) stays the single source of truth:
 * every prop below maps to the same callback the old form used, so
 * downstream consumers (patient left panel's Outreach tab, Care Gap
 * drawer, HCC gap drawer, Care Programs' Outreach step, TOC outreach
 * drawer) keep working without changes.
 */
export function OutreachComposer({
  hideLogForRow,
  scopedProgram,
  logFor,
  isHccGaps,
  type, setType,
  datetime, setDatetime,
  showCallDetails,
  callBannerVisible, setCallBannerVisible,
  callDirection, setCallDirection,
  callViaNumber, setCallViaNumber,
  calledToNumber, setCalledToNumber,
  callType, setCallType,
  callDurationMin, setCallDurationMin,
  callDurationSec, setCallDurationSec,
  CALLED_TO_OPTIONS,
  programsLabel,
  PROGRAM_OPTIONS,
  selectedProgs,
  toggleProgram,
  outcome, setOutcome,
  separateNotes, setSeparateNotes,
  useSeparate,
  getPanel,
  patchPanel,
  patchShared,
  sharedPanel,
  sharedPanelTitle,
  addOutcome,
  removeOutcome,
  handleNoteChange,
  canSave,
  handleLogForChange,
  handleSave,
  handleDiscard,
  onAddTask,
  onSchedule,
  hideFooter = false,
}) {
  const [expanded, setExpanded] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);
  const [savedBeat, setSavedBeat] = useState(false);
  const [showDatetime, setShowDatetime] = useState(false);
  const noteRef = useRef(null);
  const moreMenuRef = useRef(null);

  // Open the composer the moment the host asks for it; a non-empty
  // datetime is the hook's hint ("Log New Outreach" was clicked).
  useEffect(() => {
    if (datetime) setExpanded(true);
  }, [datetime]);

  // Dismiss the "… More" sheet on outside click.
  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) setMoreOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [moreOpen]);

  const handleFocus = useCallback(() => setExpanded(true), []);

  // Cycle a program chip's outcome. The hook keeps per-program panel
  // state in `panels[prog].outcomes`, but its `addOutcome` helper routes
  // through `sharedPanel.outcomes` when `useSeparate` is off. The chip
  // model demands each chip own its outcome regardless, so we write to
  // the per-program panel directly via `patchPanel`. The hook's overall
  // `outcome` still gets updated so `canSave` enables and the log
  // summary reads correctly.
  const cycleChip = useCallback((prog, next) => {
    const current = getPanel(prog)?.outcomes?.[0] || null;
    const alreadyIn = selectedProgs.includes(prog);

    if (next === null) {
      // Clear this chip, drop the program; clear the overall outcome
      // only if no sibling chip still carries one.
      if (alreadyIn) toggleProgram(prog);
      const anyLeft = selectedProgs.filter(p => p !== prog)
        .some(p => (getPanel(p)?.outcomes || []).length > 0);
      if (!anyLeft) setOutcome(null);
      else patchPanel(prog, { outcomes: [] });
      return;
    }

    if (!alreadyIn) toggleProgram(prog);

    if (next === 'selected') {
      patchPanel(prog, { outcomes: [] });
      return;
    }

    // Note the hook's setOutcome wipes ALL panel outcomes whenever the
    // overall outcome actually changes (its radio-group semantics), so
    // we commit the panel AFTER setOutcome instead of before, otherwise
    // the wipe swallows the chip we just set.
    setOutcome(next);
    patchPanel(prog, { outcomes: [next] });
  }, [getPanel, selectedProgs, toggleProgram, patchPanel, setOutcome]);

  const onSaveClick = useCallback(() => {
    if (!canSave) return;
    handleSave();
    setSavedBeat(true);
    window.setTimeout(() => setSavedBeat(false), 1600);
  }, [canSave, handleSave]);

  // ⌘⏎ or Ctrl+⏎ saves from inside the note.
  const onNoteKeyDown = useCallback((e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      onSaveClick();
    }
  }, [onSaveClick]);

  const relLabel = useMemo(() => RELATIVE_TIME_LABEL(datetime), [datetime]);

  const chipList = PROGRAM_OPTIONS.map(prog => {
    const m = isHccGaps ? String(prog).match(/HCC\s+(\d+)/i) : null;
    const label = m ? m[1] : prog;
    const chipOutcome = (getPanel(prog)?.outcomes || [])[0] || null;
    return (
      <OutreachProgramChip
        key={prog}
        code={prog}
        label={label}
        outcome={chipOutcome}
        selected={selectedProgs.includes(prog)}
        onCycle={(next) => cycleChip(prog, next)}
      />
    );
  });

  return (
    <div
      className={[styles.composer, expanded ? styles.composerOpen : ''].join(' ')}
      onFocus={handleFocus}
      onClick={handleFocus}
    >
      {/* ── Log For (hidden by default, surfaced in More menu or when the host asks) ── */}
      {!hideLogForRow && !scopedProgram && expanded && (
        <div className={styles.logForRow}>
          <span className={styles.logForLabel}>Log outreach for</span>
          {LOG_FOR_OPTIONS.map(opt => (
            <RadioButton
              key={opt.key}
              checked={logFor === opt.key}
              onChange={() => handleLogForChange(opt.key)}
              label={opt.label}
            />
          ))}
        </div>
      )}

      {/* ── Meta row: Type · logged-at · program chips · separate notes ── */}
      <div className={styles.metaRow}>
        <TypeDropdown value={type} onChange={setType} disabled={isHccGaps} />

        <button
          type="button"
          className={styles.timestampBtn}
          onClick={(e) => { e.stopPropagation(); setShowDatetime(v => !v); }}
          aria-label="Backdate outreach"
        >
          <Icon name="solar:clock-circle-linear" size={14} color="currentColor" />
          <span>logged {relLabel}</span>
        </button>

        <span className={styles.metaSep} aria-hidden />

        <div className={styles.chips}>
          {chipList}
        </div>

        {selectedProgs.length >= 2 && (
          <div className={styles.separateNotesInline}>
            <Switch
              checked={separateNotes}
              onChange={setSeparateNotes}
              label="Separate notes"
              ariaLabel="Separate notes per program"
            />
          </div>
        )}
      </div>

      {/* ── Backdate picker (slides in on demand) ── */}
      {showDatetime && expanded && (
        <div className={styles.datetimeRow}>
          <DateTimePicker value={datetime} onChange={setDatetime} />
          <Button variant="ghost" size="S" onClick={() => setShowDatetime(false)}>Done</Button>
        </div>
      )}

      {/* ── Call Details (inline, auto-shown when Type=Call) ── */}
      {showCallDetails && (
        <div className={styles.callRow}>
          {callBannerVisible && (
            <div className={styles.callBanner}>
              <Icon name="solar:phone-calling-linear" size={14} color="var(--primary-300)" />
              <span className={styles.callBannerText}>
                Last call: Outgoing · 11/28/2023 10:55 · 05:29s
              </span>
              <button
                type="button"
                className={styles.callBannerLink}
                onClick={(e) => {
                  e.stopPropagation();
                  setCallDirection('outgoing');
                  setCallViaNumber('Delores Conn (581 824-1591)');
                  setCalledToNumber('Dr. Katherine Moss (581 824-1591)');
                  setCallDurationMin('05');
                  setCallDurationSec('29');
                }}
              >
                Use this
              </button>
              <button
                type="button"
                className={styles.callBannerDismiss}
                onClick={(e) => { e.stopPropagation(); setCallBannerVisible(false); }}
                aria-label="Dismiss call banner"
              >
                <Icon name="solar:close-circle-linear" size={14} color="currentColor" />
              </button>
            </div>
          )}

          <div className={styles.callDetailsLine}>
            <div className={styles.callDirection}>
              <RadioButton
                checked={callDirection === 'outgoing'}
                onChange={() => setCallDirection('outgoing')}
                label="Outgoing"
              />
              <RadioButton
                checked={callDirection === 'incoming'}
                onChange={() => setCallDirection('incoming')}
                label="Incoming"
              />
            </div>

            <div className={styles.callField}>
              <span className={styles.callFieldLabel}>Via</span>
              <FieldDropdown
                value={callViaNumber}
                onChange={setCallViaNumber}
                options={CALLED_TO_OPTIONS}
                placeholder="Select"
              />
            </div>

            <div className={styles.callField}>
              <span className={styles.callFieldLabel}>To</span>
              <FieldDropdown
                value={calledToNumber}
                onChange={setCalledToNumber}
                options={CALLED_TO_OPTIONS}
                placeholder="Select"
              />
            </div>

            <div className={styles.callField}>
              <span className={styles.callFieldLabel}>Type</span>
              <FieldDropdown
                value={callType}
                onChange={setCallType}
                options={['Provider', 'Member', 'Family', 'Other']}
                placeholder="Select"
              />
            </div>

            <div className={styles.callDuration}>
              <input
                type="text"
                inputMode="numeric"
                maxLength={2}
                value={callDurationMin}
                onChange={e => setCallDurationMin(e.target.value.replace(/\D/g, '').slice(0, 2))}
                aria-label="Minutes"
                className={styles.callDurationInput}
              />
              <span className={styles.callDurationUnit}>min</span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={2}
                value={callDurationSec}
                onChange={e => setCallDurationSec(e.target.value.replace(/\D/g, '').slice(0, 2))}
                aria-label="Seconds"
                className={styles.callDurationInput}
              />
              <span className={styles.callDurationUnit}>sec</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Note body ── */}
      {useSeparate ? (
        <div className={styles.panels}>
          {selectedProgs.map(prog => {
            const ps = getPanel(prog);
            return (
              <div className={styles.panel} key={prog}>
                <span className={styles.panelTitle}>{prog}</span>
                <Textarea
                  value={ps.note}
                  onChange={e => handleNoteChange(prog, typeof e === 'string' ? e : e.target.value)}
                  placeholder="How did it go?"
                  rows={3}
                  onKeyDown={onNoteKeyDown}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <Textarea
          ref={noteRef}
          value={sharedPanel.note}
          onChange={e => handleNoteChange(null, typeof e === 'string' ? e : e.target.value)}
          placeholder={type === 'Call' ? 'What did you talk about?' : 'What happened on this outreach?'}
          rows={3}
          onKeyDown={onNoteKeyDown}
          autoFocus={expanded && !sharedPanel.note}
        />
      )}

      {/* ── Action tray + Save / Discard ──
         * One row at every reasonable composer width. Grouped action
         * clusters are set apart by the shared Fold divider rule (1 px
         * tall, --neutral-150) — per the house convention noted in
         * CLAUDE.md: "always place a divider between distinct groups
         * of action buttons." */}
      {!hideFooter && (
        <div className={styles.tray}>
          <div className={styles.trayLeft}>
            <ActionButton
              icon="solar:checklist-minimalistic-linear"
              size="S"
              tooltip="Add Task"
              iconColor="var(--neutral-300)"
              onClick={onAddTask}
            />
            <span className={styles.trayDivider} aria-hidden />
            <ActionButton
              icon="solar:calendar-add-linear"
              size="S"
              tooltip="Schedule Appointment"
              iconColor="var(--neutral-300)"
              onClick={onSchedule}
            />
            <span className={styles.trayDivider} aria-hidden />
            <ActionButton
              icon="solar:alarm-linear"
              size="S"
              tooltip="Set Reminder"
              iconColor="var(--neutral-300)"
            />

            <span className={styles.trayGroupDivider} aria-hidden />

            <div className={styles.moreWrap} ref={moreMenuRef}>
              <Tooltip label="More options" placement="top">
                <button
                  type="button"
                  className={styles.moreBtn}
                  onClick={(e) => { e.stopPropagation(); setMoreOpen(v => !v); }}
                  aria-haspopup="menu"
                  aria-expanded={moreOpen}
                >
                  <Icon name="solar:menu-dots-linear" size={14} color="currentColor" />
                  More
                </button>
              </Tooltip>
              {moreOpen && (
                <div className={styles.moreMenu} role="menu">
                  {!hideLogForRow && !scopedProgram && (
                    <div className={styles.moreMenuSection}>
                      <span className={styles.moreMenuLabel}>Log outreach for</span>
                      {LOG_FOR_OPTIONS.map(opt => (
                        <button
                          key={opt.key}
                          type="button"
                          role="menuitemradio"
                          aria-checked={logFor === opt.key}
                          className={[styles.moreMenuItem, logFor === opt.key ? styles.moreMenuItemActive : ''].join(' ')}
                          onClick={() => { handleLogForChange(opt.key); setMoreOpen(false); }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className={styles.moreMenuSection}>
                    <span className={styles.moreMenuLabel}>Note mode</span>
                    <label className={styles.moreMenuToggleRow}>
                      <span>Separate notes per program</span>
                      <Switch
                        checked={separateNotes}
                        onChange={setSeparateNotes}
                        ariaLabel="Separate notes per program"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className={styles.trayRight}>
            <span
              className={[styles.savedChip, savedBeat ? styles.savedChipShown : ''].join(' ')}
              aria-live="polite"
            >
              <Icon name="solar:check-circle-bold" size={12} color="currentColor" />
              Saved
            </span>
            <Button variant="ghost" size="S" onClick={handleDiscard}>Discard</Button>
            <span className={styles.trayGroupDivider} aria-hidden />
            <Button
              variant="primary"
              size="S"
              trailingIconElement={<span className={styles.kbdHint}>⌘⏎</span>}
              disabled={!canSave}
              onClick={onSaveClick}
            >
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
