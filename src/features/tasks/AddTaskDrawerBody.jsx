import { Icon } from '../../components/Icon/Icon';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Button } from '../../components/Button/Button';
import { Badge } from '../../components/Badge/Badge';
import { Avatar } from '../../components/Avatar/Avatar';
import { Select } from '../../components/Select/Select';
import { PriorityIcon } from './TasksViewIcons';
import { TaskDatePicker, DetailDropdown, CreatableLabelDropdown } from './TasksViewDropdowns';
import styles from './TasksView.module.css';

export function AddTaskDrawerBody({
  name, setName,
  status, setStatus,
  priority, setPriority,
  dueDate, setDueDate,
  assignedTo, setAssignedTo,
  member, setMember,
  pool, setPool,
  description, setDescription,
  selectedLabels, toggleLabel,
  showAddSubtask, setShowAddSubtask,
  subtaskName, setSubtaskName,
  stagedSubtasks,
  editorRef,
  assigneeOptions,
  memberOptions,
  taskPools,
  currentUserProfile,
  addStagedSubtask,
  removeStagedSubtask,
  STATUS_ORDER,
  STATUS_LABELS,
  PRIORITY_OPTIONS,
  TITLE_MAX,
}) {
  return (
    <div className={styles.drawerContent}>
      <div className={styles.drawerToolbar}>
        <Select
          style={{ width: 120 }}
          options={STATUS_ORDER.map(s => ({ value: s, label: STATUS_LABELS[s] }))}
          value={status}
          onChange={setStatus}
        />
        <div className={styles.drawerToolbarRight}>
          <ActionButton icon="solar:paperclip-linear" size="L" tooltip="Attachments" />
          <span className={styles.iconDivider} />
          <ActionButton icon="solar:link-minimalistic-linear" size="L" tooltip="Copy link" state="disabled" />
          <span className={styles.iconDivider} />
          <ActionButton icon="solar:clipboard-text-linear" size="L" tooltip="Copy ID" state="disabled" />
          <span className={styles.iconDivider} />
          <ActionButton icon="solar:trash-bin-trash-linear" size="L" tooltip="Delete" state="disabled" />
        </div>
      </div>

      <div className={styles.drawerSection}>
        <span className={styles.drawerSectionLabel}>Task Name</span>
        <input aria-label="Task Name"
          className={`${styles.drawerTaskTitleInput} ${name.length > TITLE_MAX ? styles.inputInvalid : ''}`}
          style={{ margin: 0, width: '100%' }}
          placeholder="Enter task name..."
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <div className={styles.fieldHelper}>
          <span className={styles.fieldError}>
            {name.length > TITLE_MAX ? `Title must be ${TITLE_MAX} characters or fewer` : ''}
          </span>
          <span className={`${styles.charCount} ${name.length > TITLE_MAX ? styles.charCountOver : ''}`}>
            {name.length}/{TITLE_MAX}
          </span>
        </div>
      </div>

      <div className={styles.drawerDetails}>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Task Pool</span>
          <DetailDropdown
            value={pool}
            options={['— Direct assign —', ...(taskPools || []).map(p => p.name)]}
            onSelect={v => setPool(v === '— Direct assign —' ? '' : v)}
          >
            <span style={{ color: pool ? 'var(--neutral-400)' : 'var(--neutral-200)' }}>
              {pool || '— Direct assign —'}
            </span>
          </DetailDropdown>
        </div>
        {!pool && (
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Assigned To</span>
            <DetailDropdown
              value={assignedTo}
              options={assigneeOptions}
              onSelect={setAssignedTo}
              renderOption={opt => {
                const label = typeof opt === 'string' ? opt : opt.label;
                const val = typeof opt === 'string' ? opt : opt.value;
                const initials = (val || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                return (
                  <>
                    <Avatar variant="assignee" initials={initials} className={styles.avatarXs} />
                    <span>{label}</span>
                  </>
                );
              }}
            >
              {assignedTo ? (
                <>
                  <Avatar variant="assignee" initials={(assignedTo || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()} className={styles.avatarXs} />
                  <span>{currentUserProfile?.name === assignedTo ? `${assignedTo} (You)` : assignedTo}</span>
                </>
              ) : (
                <span style={{ color: 'var(--neutral-200)' }}>Select assignee</span>
              )}
            </DetailDropdown>
          </div>
        )}
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Due Date</span>
          <TaskDatePicker value={dueDate} onSelect={setDueDate} />
        </div>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Priority</span>
          <DetailDropdown
            value={priority}
            options={PRIORITY_OPTIONS}
            onSelect={setPriority}
            renderOption={opt => (
              <><PriorityIcon priority={opt} size={16} /> <span style={{ textTransform: 'capitalize' }}>{opt}</span></>
            )}
          >
            <PriorityIcon priority={priority} size={16} />
            <span style={{ textTransform: 'capitalize' }}>{priority}</span>
          </DetailDropdown>
        </div>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Member</span>
          <DetailDropdown
            value={member}
            options={memberOptions}
            onSelect={setMember}
            renderOption={opt => {
              const val = typeof opt === 'string' ? opt : opt.value;
              const initials = (val || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
              return (
                <>
                  <Avatar variant="patient" initials={initials} className={styles.avatarXs} />
                  <span>{val}</span>
                </>
              );
            }}
          >
            {member ? (
              <>
                <Avatar variant="patient" initials={(member || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()} className={styles.avatarXs} />
                <span>{member}</span>
              </>
            ) : (
              <span style={{ color: 'var(--neutral-200)' }}>Select member</span>
            )}
          </DetailDropdown>
        </div>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Labels</span>
          <div className={styles.detailValueLabels}>
            {selectedLabels.map(l => (
              <Badge key={l} variant="overflow" label={l} trailingIcon="solar:close-circle-linear" onClick={() => toggleLabel(l)} />
            ))}
            <CreatableLabelDropdown selectedLabels={selectedLabels} onToggle={toggleLabel} />
          </div>
        </div>
      </div>

      <div className={styles.drawerSection}>
        <span className={styles.drawerSectionLabel}>Description</span>
        <div className={styles.descEditor}>
          <div
            ref={editorRef}
            className={styles.descEditable}
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Add a description..."
            onInput={e => setDescription(e.currentTarget.innerHTML)}
          />
          <div className={styles.descToolbar}>
            <ActionButton icon="solar:paperclip-linear" size="S" tooltip="Attach" />
            <span className={styles.toolbarDivider} />
            <ActionButton icon="solar:text-bold-linear" size="S" tooltip="Bold" onClick={() => document.execCommand('bold')} />
            <ActionButton icon="solar:text-italic-linear" size="S" tooltip="Italic" onClick={() => document.execCommand('italic')} />
            <ActionButton icon="solar:text-underline-linear" size="S" tooltip="Underline" onClick={() => document.execCommand('underline')} />
            <ActionButton icon="solar:text-cross-linear" size="S" tooltip="Strikethrough" onClick={() => document.execCommand('strikeThrough')} />
            <span className={styles.toolbarDivider} />
            <ActionButton icon="solar:list-linear" size="S" tooltip="List" onClick={() => document.execCommand('insertUnorderedList')} />
          </div>
        </div>
      </div>

      <div className={styles.drawerSection}>
        <div className={styles.subtaskHeader}>
          <h4 className={styles.drawerSectionTitle}>
            Subtasks {stagedSubtasks.length > 0 && <span className={styles.subtaskCount}>{stagedSubtasks.length}</span>}
          </h4>
          <button className={styles.subtaskAddBtn} onClick={() => setShowAddSubtask(v => !v)}>
            <Icon name="solar:add-circle-linear" size={14} color="var(--primary-300)" />
            Add Subtask
          </button>
        </div>
        {showAddSubtask && (
          <div className={styles.subtaskAddRow}>
            <input aria-label="Subtask name"
              className={styles.subtaskAddInput}
              placeholder="Enter subtask name..."
              maxLength={TITLE_MAX}
              value={subtaskName}
              onChange={e => setSubtaskName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addStagedSubtask(); if (e.key === 'Escape') { setShowAddSubtask(false); setSubtaskName(''); } }}
              autoFocus
            />
            <Button variant="primary" size="S" onClick={addStagedSubtask} disabled={!subtaskName.trim()}>Add</Button>
            <Button variant="secondary" size="S" onClick={() => { setShowAddSubtask(false); setSubtaskName(''); }}>Cancel</Button>
          </div>
        )}
        {stagedSubtasks.map((sub, i) => (
          <div key={i} className={styles.subtaskCard}>
            <div className={styles.subtaskCardBody}>
              <div className={styles.subtaskCardRow}>
                <PriorityIcon priority="medium" size={16} />
                <span className={styles.subtaskCardName}>{sub}</span>
              </div>
            </div>
            <ActionButton icon="solar:close-circle-linear" size="S" tooltip="Remove" onClick={() => removeStagedSubtask(i)} />
          </div>
        ))}
        {stagedSubtasks.length === 0 && !showAddSubtask && (
          <div className={styles.subtaskEmpty}>No subtasks yet. Break this task down into smaller steps.</div>
        )}
      </div>
    </div>
  );
}
