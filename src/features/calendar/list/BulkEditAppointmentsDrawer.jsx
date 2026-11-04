import { useState } from 'react';
import { Drawer } from '../../../components/Drawer/Drawer';
import { Avatar } from '../../../components/Avatar/Avatar';
import { CollapsibleContent } from '../../../components/Collapsible/Collapsible';
import { Icon } from '../../../components/Icon/Icon';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Button } from '../../../components/Button/Button';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { Input } from '../../../components/Input/Input';
import { Select } from '../../../components/Select/Select';
import { Textarea } from '../../../components/Textarea/Textarea';
import { Tooltip } from '../../../components/Tooltip/Tooltip';
import { toast } from '../../../components/Toast/sonnerToast';
import { useLocationOptions } from '../../../components/ScheduleDrawer/useLocationOptions';
import { useAppStore } from '../../../store/useAppStore';
import { initialsOf, samePerson } from '../../ooo/oooUtils';
import { dateLabel, timeRangeLabel } from './appointmentList';
import { UserProfileBanner } from '../../settings/account/users/UserProfileBanner';
import styles from './AppointmentListView.module.css';

// Each field, the appointments column it saves to, and its preview label.
const FIELDS = [
  { key: 'location', label: 'Location' },
  { key: 'reason_for_visit', label: 'Reason for Visit' },
  { key: 'member_instruction', label: 'Instructions for Patients' },
  { key: 'staff_instruction', label: 'Instructions for Staff' },
];
const EMPTY = Object.fromEntries(FIELDS.map(f => [f.key, '']));

/**
 * Bulk Edit Appointments (Figma Tasks 1413:41609): one provider's selected
 * appointments given a new location, reason for visit or instructions. A
 * field left empty stays as it is on each appointment. Next opens the
 * Bulk Update Preview, where Apply Changes saves. The appointments it applies
 * to are listed on both steps (folded away on the first), and ✕ leaves one out.
 *
 * @param {{ id, name }} props.provider
 * @param {object[]} props.appointments
 * @param {() => void} props.onDone  – after a save
 * @param {() => void} props.onClose
 */
export function BulkEditAppointmentsDrawer({ provider, appointments, onDone, onClose }) {
  const platformUsers = useAppStore(s => (s.platformPeople?.length ? s.platformPeople : s.platformUsers));
  const updateDetails = useAppStore(s => s.updateAppointmentsDetails);
  const locationOptions = useLocationOptions();
  const [values, setValues] = useState(EMPTY);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dropped, setDropped] = useState(() => new Set());
  const [confirmClose, setConfirmClose] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [previewListOpen, setPreviewListOpen] = useState(true);
  const set = (key) => (v) => setValues(p => ({ ...p, [key]: v }));
  const kept = appointments.filter(a => !dropped.has(a.id));

  const person = (platformUsers || []).find(u => samePerson(u, provider));
  const role = person?.role || person?.clinicalRoles?.[0] || 'Provider';
  const changes = FIELDS.filter(f => values[f.key].trim());
  const n = kept.length;
  // Who the change applies to; ✕ leaves one out (on both steps).
  const applyList = (
    <div className={styles.applyList}>
      {kept.map((a) => {
        const when = [`${dateLabel(a.date)}, ${timeRangeLabel(a)}`, a.appointment_type_name].filter(Boolean).join(' • ');
        return (
          <div key={a.id} className={styles.applyRow}>
            <span className={styles.member}>
              <Avatar variant="patient" size="M" initials={initialsOf(a.patient_name)} />
              <span className={styles.memberText}>
                <span className={styles.memberName}>{a.patient_name || 'Member'}</span>
                <span className={styles.memberSub} title={when}>{when}</span>
              </span>
            </span>
            <ActionButton
              icon="solar:close-linear"
              size="sm"
              tooltip="Remove from this update"
              tooltipLeft
              onClick={() => setDropped(d => new Set(d).add(a.id))}
            />
          </div>
        );
      })}
    </div>
  );

  // Who it applies to, in its own card (like Reassign's "No users available
  // for reassignment"): folded on the first step so the fields stay first,
  // open on the preview.
  const appliesCard = (open, setOpen) => (
    <div className={styles.appliesTo}>
      <button type="button" className={styles.appliesToggle} aria-expanded={open} onClick={() => setOpen(o => !o)}>
        Selected appointments
        <span className={styles.countBadge}>{n}</span>
        <Icon name="solar:alt-arrow-right-linear" size={12} color="var(--neutral-300)" className={open ? `${styles.chevron} ${styles.chevronOpen}` : styles.chevron} />
      </button>
      <CollapsibleContent open={open}>
        <div className={styles.appliesBody}>{applyList}</div>
      </CollapsibleContent>
    </div>
  );

  const requestClose = () => (changes.length ? setConfirmClose(true) : onClose());

  const apply = async () => {
    if (!changes.length || !n || saving) return;
    setSaving(true);
    const ok = await updateDetails(kept, Object.fromEntries(changes.map(f => [f.key, values[f.key].trim()])));
    setSaving(false);
    if (!ok) { toast.error('Appointments could not be updated. Try again.'); return; }
    toast.success('Appointments Updated Successfully');
    onDone?.();
    onClose();
  };

  return (
    <>
      <Drawer
        title={previewing ? 'Bulk Update Preview' : 'Bulk Edit Appointments'}
        onClose={requestClose}
        noCloseDivider
        // Whose appointments these are, as Bulk Reschedule shows them.
        banner={(
          <UserProfileBanner
            user={{ initials: initialsOf(provider.name), name: provider.name }}
            subtitle={role}
            actions={false}
          />
        )}
        headerRight={previewing ? (
          <>
            <Button variant="soft" disabled={saving} onClick={() => setPreviewing(false)}>Previous</Button>
            <Button variant="solid" disabled={saving || !n} onClick={apply}>Apply Changes</Button>
            <span className={styles.headerDivider} aria-hidden="true" />
          </>
        ) : (
          <>
            {/* A disabled button gets no hover, so its wrapper carries the tooltip. */}
            <Tooltip label={changes.length ? '' : 'Enter at least one change to continue'} align="right" placement="bottom" className={styles.saveTip}>
              <span className={changes.length ? undefined : styles.saveBlocked}>
                <Button variant="solid" disabled={!changes.length || !n} onClick={() => setPreviewing(true)}>Next</Button>
              </span>
            </Tooltip>
            <span className={styles.headerDivider} aria-hidden="true" />
          </>
        )}
      >
        {previewing ? (
          <div className={styles.bulkEdit}>
            <table className={styles.changeTable}>
              <colgroup>
                <col className={styles.changeFieldCol} />
                <col />
              </colgroup>
              <thead>
                <tr>
                  <th>Fields</th>
                  <th>Change To</th>
                </tr>
              </thead>
              <tbody>
                {changes.map(f => (
                  <tr key={f.key}>
                    <td className={styles.changeField}>{f.label}</td>
                    <td className={styles.changeValue}>{values[f.key].trim()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {appliesCard(previewListOpen, setPreviewListOpen)}
          </div>
        ) : (
          <div className={styles.bulkEdit}>
            <div className={styles.fieldRow}>
              <Select
                label="Change Location"
                placeholder="Select Location"
                options={locationOptions.map(l => ({ value: l, label: l }))}
                value={values.location || undefined}
                onValueChange={set('location')}
                searchable
                portal
              />
              <Input
                label="Change Reason for Visit"
                placeholder="Enter Reason for Visit"
                value={values.reason_for_visit}
                onChange={e => set('reason_for_visit')(e.target.value)}
              />
            </div>
            <Textarea
              title="Instructions for Patients"
              placeholder="Add Instructions for Patients"
              value={values.member_instruction}
              onValueChange={set('member_instruction')}
            />
            <Textarea
              title="Instructions for Staff"
              placeholder="Add Instructions for Staff"
              value={values.staff_instruction}
              onValueChange={set('staff_instruction')}
            />
            {appliesCard(listOpen, setListOpen)}
          </div>
        )}
      </Drawer>
        {confirmClose && (
          <ConfirmDialog
            title="Discard changes?"
            description="Your changes to these appointments won't be saved."
            confirmLabel="Discard"
            cancelLabel="Keep editing"
            onCancel={() => setConfirmClose(false)}
            onConfirm={() => { setConfirmClose(false); onClose(); }}
          />
        )}
    </>
  );
}
