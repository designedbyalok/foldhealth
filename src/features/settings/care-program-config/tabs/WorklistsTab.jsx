import { useState } from 'react';
import { Button } from '../../../../components/Button/Button';
import { ActionButton } from '../../../../components/ActionButton/ActionButton';
import { Badge } from '../../../../components/Badge/Badge';
import { Drawer } from '../../../../components/Drawer/Drawer';
import { Input } from '../../../../components/Input/Input';
import { Textarea } from '../../../../components/Textarea/Textarea';
import { Select } from '../../../../components/Select/Select';
import { Switch } from '../../../../components/Switch/Switch';
import { RadioOptionGroup } from '../../../../components/RadioOptionGroup/RadioOptionGroup';
import { ConfirmDialog } from '../../../../components/ConfirmDialog/ConfirmDialog';
import { PROGRAM_STATUS_OPTIONS } from '../../../patient/data/programStatus';
import { ASSIGNMENT_MODES, newId } from '../careProgramConfigModel';
import { usePlatformUserOptions } from './usePlatformUserOptions';
import styles from '../CareProgramConfig.module.css';

const STATUS_OPTIONS = [...new Set([...PROGRAM_STATUS_OPTIONS, 'Closed'])];

function WorklistDrawer({ worklist, programName, userOptions, onSave, onClose }) {
  const [w, setW] = useState(worklist);
  const set = p => setW(prev => ({ ...prev, ...p }));
  return (
    <Drawer
      title={worklist.name ? `Edit ${worklist.name}` : 'New Worklist'}
      onClose={onClose}
      noCloseDivider
      headerRight={(
        <>
          <Button disabled={!w.name.trim()} onClick={() => onSave({ ...w, name: w.name.trim() })}>Save</Button>
          <span className={styles.headerDivider} />
        </>
      )}
    >
      <div className={styles.drawerBody}>
        <Input label="Worklist Name" required value={w.name} maxLength={60} placeholder={`e.g. ${programName} Outreach Queue`} onChange={e => set({ name: e.target.value })} />
        <Textarea title="Description" value={w.description} onValueChange={description => set({ description })} rows={2} maxLength={200} placeholder="Who this worklist is for (optional)" />
        <Select
          label="Patients in this worklist"
          portal
          multiple
          badges
          checkboxes
          placeholder="Every enrolled patient"
          options={STATUS_OPTIONS.map(v => ({ value: v, label: v }))}
          value={w.statuses}
          onValueChange={statuses => set({ statuses })}
          helperText="Program statuses to include. Leave empty for every status."
        />
        <RadioOptionGroup
          label="Assignment"
          name="worklist-assignment"
          value={w.assignmentMode}
          onChange={assignmentMode => set({ assignmentMode })}
          options={ASSIGNMENT_MODES}
        />
        {w.assignmentMode !== 'care-team' && (
          <Select
            label="Assignees"
            portal
            multiple
            badges
            checkboxes
            searchable
            placeholder="Pick who works this worklist"
            options={userOptions}
            value={w.assigneeIds}
            onValueChange={assigneeIds => set({ assigneeIds })}
          />
        )}
        <div className={styles.switchRow}>
          <span className={styles.switchText}>
            <span className={styles.switchLabel}>Show in Population navigation</span>
            <span className={styles.switchHint}>Lists this worklist under Population &gt; Worklists for the roles allowed on the Access tab.</span>
          </span>
          <Switch checked={w.showInNavigation} onChange={showInNavigation => set({ showInNavigation })} ariaLabel="Show in Population navigation" />
        </div>
      </div>
    </Drawer>
  );
}

/** Worklists: the queues this program's patients are worked from, and who works them. */
export function WorklistsTab({ draft, patch }) {
  const userOptions = usePlatformUserOptions();
  const nameOf = id => userOptions.find(o => o.value === id)?.label;
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const lists = draft.worklists;

  const save = (w) => {
    patch({ worklists: lists.some(x => x.id === w.id) ? lists.map(x => (x.id === w.id ? w : x)) : [...lists, w] });
    setEditing(null);
  };

  return (
    <section className={`${styles.card} ${styles.cardFlush}`}>
      <div className={styles.cardHead}>
        <div className={styles.cardTitleBlock}>
          <h3 className={styles.cardTitle}>Worklists</h3>
          <p className={styles.cardHint}>Each worklist holds this program&apos;s patients in the statuses you pick, assigned by hand, in turn, or to the patient&apos;s Care Manager.</p>
        </div>
        <Button
          variant="outline"
          leadingIcon="solar:add-circle-linear"
          onClick={() => setEditing({ id: newId('wl'), name: '', description: '', assignmentMode: 'manual', assigneeIds: [], statuses: [], showInNavigation: true })}
        >
          New Worklist
        </Button>
      </div>
      <div className={`${styles.listRow} ${styles.worklistRow} ${styles.listHead}`}>
        <span>Worklist</span><span>Assignment</span><span>Assignees</span><span>Navigation</span><span />
      </div>
      {lists.length === 0 && <div className={styles.listRow}><span className={styles.cardHint}>No worklists yet.</span></div>}
      {lists.map(w => (
        <div key={w.id} className={`${styles.listRow} ${styles.worklistRow}`}>
          <span className={styles.nameCell}>
            <span className={styles.listText}>{w.name}</span>
            <span className={styles.listMuted}>{w.statuses.length ? w.statuses.join(', ') : 'Every enrolled patient'}</span>
          </span>
          <span className={styles.listMuted}>{ASSIGNMENT_MODES.find(m => m.value === w.assignmentMode)?.label}</span>
          <span className={styles.listMuted}>
            {w.assignmentMode === 'care-team' ? 'Care Manager' : (w.assigneeIds.map(nameOf).filter(Boolean).join(', ') || 'No one yet')}
          </span>
          <span>{w.showInNavigation ? <Badge size="sm" tone="success" label="Shown" /> : <Badge size="sm" label="Hidden" />}</span>
          <span className={styles.actionCell}>
            <ActionButton icon="solar:pen-linear" size="sm" tooltip="Edit" onClick={() => setEditing(w)} />
            <ActionButton icon="solar:trash-bin-trash-linear" size="sm" tooltip="Delete" onClick={() => setRemoving(w)} />
          </span>
        </div>
      ))}
      {editing && <WorklistDrawer worklist={editing} programName={draft.code} userOptions={userOptions} onSave={save} onClose={() => setEditing(null)} />}
      {removing && (
        <ConfirmDialog
          variant="destructive"
          title={`Delete ${removing.name}?`}
          description="The worklist is removed from this program when you save."
          confirmLabel="Delete"
          onCancel={() => setRemoving(null)}
          onConfirm={() => { patch({ worklists: lists.filter(x => x.id !== removing.id) }); setRemoving(null); }}
        />
      )}
    </section>
  );
}
