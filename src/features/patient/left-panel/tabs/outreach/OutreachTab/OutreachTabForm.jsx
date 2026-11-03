import { Icon } from '../../../../../../components/Icon/Icon';
import { CloseButton } from '../../../../../../components/CloseButton/CloseButton';
import { AddTaskIcon } from '../../../../../../components/Icon/AddTaskIcon';
import { Button } from '../../../../../../components/Button/Button';
import { ActionButton } from '../../../../../../components/ActionButton/ActionButton';
import { Input } from '../../../../../../components/Input/Input';
import { RadioButton } from '../../../../../../components/RadioButton/RadioButton';
import { Switch } from '../../../../../../components/Switch/Switch';
import { Tooltip } from '../../../../../../components/Tooltip/Tooltip';
import { FieldDropdown, TypeDropdown } from './OutreachTabDropdowns';
import { DateTimePicker } from '../../../../../../components/DateTimePicker/DateTimePicker';
import { NotePanel } from './OutreachTabNotePanel';
import { DEFAULT_CALL_TYPES, LOG_FOR_OPTIONS } from './OutreachTab.utils';
import styles from './OutreachTab.module.css';

export function OutreachTabForm({
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
  toggleSyncText,
  sharedPanel,
  sharedPanelTitle,
  addOutcome,
  removeOutcome,
  setOutcomes,
  handleNoteChange,
  canSave,
  handleLogForChange,
  handleSave,
  handleDiscard,
  onAddTask,
  onSchedule,
  hideFooter = false,
  outcomeItems = null,
  callTypeOptions = DEFAULT_CALL_TYPES,
}) {
  const choiceItemsFor = (progs) => (outcomeItems ? outcomeItems(outcome, progs) : null);
  return (
    <div className={styles.formCard}>
      {!hideLogForRow && !scopedProgram && (
        <div className={styles.logForRow}>
          <span className={styles.logForLabel}>Log Outreach For:</span>
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

      <div className={styles.formHeader}>
        <TypeDropdown value={type} onChange={setType} disabled={isHccGaps} />
        <DateTimePicker value={datetime} onChange={setDatetime} />
      </div>

      <div className={styles.formBody}>
        {showCallDetails && (
          <div className={styles.callDetailsInner}>
            {callBannerVisible && (
              <div className={styles.callBanner}>
                <div className={styles.callBannerIconWrap}>
                  <Icon name="solar:phone-calling-linear" size={14} color="var(--primary-300)" />
                </div>
                <div className={styles.callBannerText}>
                  <span className={styles.callBannerTitle}>
                    Last Call&nbsp;•&nbsp;Outgoing&nbsp;•&nbsp;11/28/2023 10:55&nbsp;•&nbsp;05:29s
                  </span>
                  <span className={styles.callBannerSub}>
                    Via: Delores Conn (581 824‑1591)&nbsp;→&nbsp;To: Dr. Katherine Moss (581 824‑1591)
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.callBannerUseBtn}
                  onClick={() => {
                    setCallDirection('outgoing');
                    setCallViaNumber('Delores Conn (581 824-1591)');
                    setCalledToNumber('Dr. Katherine Moss (581 824-1591)');
                    setCallDurationMin('05');
                    setCallDurationSec('29');
                    // The last call is now in the fields below; the card is done.
                    setCallBannerVisible(false);
                  }}
                >
                  Use This
                </button>
                <CloseButton
                  size={12}
                  onClick={() => setCallBannerVisible(false)}
                  className={styles.callBannerCloseBtn}
                  label="Dismiss call banner"
                />
              </div>
            )}

            <div className={styles.callDetailsHeader}>
              <span className={styles.callDetailsLabel}>Call Details:</span>
            </div>
            <div className={styles.callDirectionRow}>
              <RadioButton checked={callDirection === 'outgoing'} onChange={() => setCallDirection('outgoing')} label="Outgoing" />
              <RadioButton checked={callDirection === 'incoming'} onChange={() => setCallDirection('incoming')} label="Incoming" />
            </div>

            <div className={styles.callFieldsGrid}>
              <div className={styles.callFieldWrap}>
                <span className={styles.callFieldLabel}>Call Via Number</span>
                <FieldDropdown
                  value={callViaNumber}
                  onChange={setCallViaNumber}
                  placeholder="Select number"
                  options={['Delores Conn (581 824-1591)', 'Practice Line (800 000-0000)']}
                />
              </div>
              <div className={styles.callFieldWrap}>
                <span className={styles.callFieldLabel}>Called To Number</span>
                <FieldDropdown value={calledToNumber} onChange={setCalledToNumber} placeholder="Select number" options={CALLED_TO_OPTIONS} />
              </div>
              <div className={styles.callFieldWrap}>
                <span className={styles.callFieldLabel}>Call Type</span>
                <FieldDropdown value={callType} onChange={setCallType} placeholder="Select type" options={callTypeOptions} />
              </div>
              <div className={styles.callFieldWrap}>
                <span className={styles.callFieldLabel}>Duration</span>
                <div className={styles.callDurationRow}>
                  <Input type="number" className={styles.callDurationInput} value={callDurationMin} min={0} max={99}
                    onChange={e => setCallDurationMin(e.target.value.padStart(2, '0').slice(-2))} />
                  <span className={styles.callDurationUnit}>Min</span>
                  <Input type="number" className={styles.callDurationInput} value={callDurationSec} min={0} max={59}
                    onChange={e => setCallDurationSec(e.target.value.padStart(2, '0').slice(-2))} />
                  <span className={styles.callDurationUnit}>Sec</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className={styles.section}>
          <div className={styles.sectionLabelRow}>
            <span className={styles.sectionLabel}>{programsLabel}</span>
            <Tooltip label="Select the programs or gaps this outreach is for. Leave them all unselected to log it as a Member Outreach.">
              <Icon name="solar:info-circle-linear" size={15} color="var(--neutral-300)" />
            </Tooltip>
          </div>
          <div className={styles.programs}>
            {PROGRAM_OPTIONS.map(prog => {
              // In HCC mode the option value is the full gap label (kept for the
              // logged note); the badge shows just the HCC number.
              const m = isHccGaps ? String(prog).match(/HCC\s+(\d+)/i) : null;
              const label = m ? m[1] : prog;
              return (
                <button
                  key={prog}
                  className={`${styles.progPill} ${selectedProgs.includes(prog) ? styles.progPillSelected : ''}`}
                  onClick={() => toggleProgram(prog)}
                  type="button"
                  title={isHccGaps ? prog : undefined}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.section}>
          <span className={styles.sectionLabel}>Outreach Outcome</span>
          <div className={styles.outcomeRow2}>
            <div className={styles.radios}>
              {['Successful', 'Unsuccessful', 'Note'].map(opt => (
                <RadioButton key={opt} checked={outcome === opt} onChange={() => setOutcome(opt)} label={opt} />
              ))}
            </div>
            {selectedProgs.length >= 2 && (
              <div className={styles.separateNotesInline}>
                <Switch checked={separateNotes} onChange={setSeparateNotes} label="Separate Notes" />
              </div>
            )}
          </div>
        </div>

        {/* No program or gap picked: the note still opens, as a Member Outreach. */}
        {(selectedProgs.length > 0 || !scopedProgram) && (
          <div className={styles.notePanels}>
            {useSeparate ? (
              selectedProgs.map(prog => {
                const ps = getPanel(prog);
                return (
                  <NotePanel
                    key={prog}
                    title={prog}
                    expanded={ps.expanded}
                    outcomes={ps.outcomes}
                    note={ps.note}
                    syncText={ps.syncText}
                    outcomeOpen={ps.outcomeOpen}
                    outcomeType={outcome}
                    choiceItems={choiceItemsFor([prog])}
                    showSyncText
                    onToggleExpand={() => patchPanel(prog, { expanded: !ps.expanded })}
                    onToggleOutcomeOpen={() => {
                      selectedProgs.forEach(p => { if (p !== prog) patchPanel(p, { outcomeOpen: false }); });
                      patchPanel(prog, { outcomeOpen: !ps.outcomeOpen });
                    }}
                    onAddOutcome={val => addOutcome(prog, val)}
                    onRemoveOutcome={val => removeOutcome(prog, val)}
                    onSetOutcomes={list => setOutcomes(prog, list)}
                    onNoteChange={text => handleNoteChange(prog, text)}
                    onToggleSyncText={() => toggleSyncText(prog)}
                  />
                );
              })
            ) : (
              <NotePanel
                title={sharedPanelTitle}
                expanded={sharedPanel.expanded}
                outcomes={sharedPanel.outcomes}
                note={sharedPanel.note}
                syncText={false}
                outcomeOpen={sharedPanel.outcomeOpen}
                outcomeType={outcome}
                choiceItems={choiceItemsFor(selectedProgs)}
                showSyncText={false}
                onToggleExpand={() => patchShared({ expanded: !sharedPanel.expanded })}
                onToggleOutcomeOpen={() => patchShared({ outcomeOpen: !sharedPanel.outcomeOpen })}
                onAddOutcome={val => addOutcome(null, val)}
                onRemoveOutcome={val => removeOutcome(null, val)}
                onSetOutcomes={list => setOutcomes(null, list)}
                onNoteChange={text => handleNoteChange(null, text)}
                onToggleSyncText={() => {}}
              />
            )}
          </div>
        )}

        <div className={styles.actionsRow}>
          <span className={styles.actionsLabel}>Actions:</span>
          <span className={styles.actionsDivider} />
          <ActionButton size="sm" tooltip="Add Task" onClick={onAddTask}>
            <AddTaskIcon size={16} color="var(--neutral-300)" />
          </ActionButton>
          <ActionButton size="sm" icon="solar:calendar-add-linear" tooltip="Schedule Appointment" onClick={onSchedule} />
          <ActionButton size="sm" icon="solar:alarm-linear" tooltip="Set Reminder" />
        </div>

        {!hideFooter && (
          <div className={styles.formFooter}>
            <Button disabled={!canSave} onClick={handleSave}>Save</Button>
            <Button variant="ghost" onClick={handleDiscard}>Discard</Button>
          </div>
        )}
      </div>
    </div>
  );
}
