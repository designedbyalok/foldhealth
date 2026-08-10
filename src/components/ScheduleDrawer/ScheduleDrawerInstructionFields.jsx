import { Icon } from '../Icon/Icon';
import { ActionButton } from '../ActionButton/ActionButton';
import styles from './ScheduleDrawer.module.css';

function InstructionEditor({ label, placeholder, inputRef, showRemove, onRemove }) {
  return (
    <div className={styles.section}>
      <span className={styles.sectionLabel}>{label}</span>
      <div className={styles.instructionEditor}>
        <div
          className={styles.instructionEditable}
          contentEditable
          suppressContentEditableWarning
          data-placeholder={placeholder}
          onInput={e => { inputRef.current = e.currentTarget.innerHTML; }}
        />
        <div className={styles.instructionToolbar}>
          <ActionButton icon="solar:paperclip-linear" size="S" tooltip="Attach" />
          <span className={styles.toolbarDivider} />
          <ActionButton icon="solar:text-bold-linear" size="S" tooltip="Bold" onClick={() => document.execCommand('bold')} />
          <ActionButton icon="solar:text-italic-linear" size="S" tooltip="Italic" onClick={() => document.execCommand('italic')} />
          <ActionButton icon="solar:text-underline-linear" size="S" tooltip="Underline" onClick={() => document.execCommand('underline')} />
          <span className={styles.toolbarDivider} />
          <ActionButton icon="solar:text-field-linear" size="S" tooltip="Heading" onClick={() => document.execCommand('formatBlock', false, 'h3')} />
          <ActionButton icon="solar:list-linear" size="S" tooltip="List" onClick={() => document.execCommand('insertUnorderedList')} />
          {showRemove && (
            <>
              <div style={{ flex: 1 }} />
              <ActionButton icon="solar:trash-bin-minimalistic-linear" size="S" tooltip="Remove" state="error" onClick={onRemove} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function ScheduleDrawerInstructionFields({
  requireRsvp,
  setRequireRsvp,
  openSections,
  setSectionOpen,
  memberInstructionRef,
  staffInstructionRef,
}) {
  const isSectionOpen = (key) => openSections.includes(key);

  return (
    <>
      <label className={styles.rsvpRow}>
        <input type="checkbox" checked={requireRsvp} onChange={() => setRequireRsvp(v => !v)} className={styles.checkbox} />
        <span>Require RSVP</span>
        <Icon name="solar:info-circle-linear" size={14} color="var(--neutral-200)" />
      </label>

      <InstructionEditor
        label="Member Instruction"
        placeholder="Add Instructions for Member"
        inputRef={memberInstructionRef}
      />

      {!isSectionOpen('staffInstructions') ? (
        <button className={styles.addStaffBtn} onClick={() => setSectionOpen('staffInstructions', true)}>
          <Icon name="solar:document-add-linear" size={16} color="var(--primary-300)" />
          Add Staff Instructions
        </button>
      ) : (
        <InstructionEditor
          label="Staff Instructions"
          placeholder="Add Instructions for Staff"
          inputRef={staffInstructionRef}
          showRemove
          onRemove={() => { setSectionOpen('staffInstructions', false); staffInstructionRef.current = ''; }}
        />
      )}
    </>
  );
}
