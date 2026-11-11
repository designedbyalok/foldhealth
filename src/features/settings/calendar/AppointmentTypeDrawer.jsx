import { useEffect, useState } from 'react';
import { Drawer } from '../../../components/Drawer/Drawer';
import { Button } from '../../../components/Button/Button';
import { Checkbox } from '../../../components/Checkbox/Checkbox';
import { Input } from '../../../components/Input/Input';
import { NumberUnitInput } from '../../../components/NumberUnitInput/NumberUnitInput';
import { RadioOptionGroup } from '../../../components/RadioOptionGroup/RadioOptionGroup';
import { Switch } from '../../../components/Switch/Switch';
import { toast } from '../../../components/Toast/sonnerToast';
import { Link } from '../../../components/Link/Link';
import { AddIconMinimalist } from '../../../components/Icon/AddIconMinimalist';
import { UserAvailabilityDrawer } from './availability/UserAvailabilityDrawer';
import { useAppStore } from '../../../store/useAppStore';
import { joinWindow, splitWindow, WINDOW_FIELD, WINDOW_UNITS } from '../../calendar/list/typeWindows';
import styles from './AppointmentTypesTab.module.css';

const MODES = ['In-person', 'Virtual'];
const LIMITS = [
  { kind: 'cancel', label: 'Invitees can cancel' },
  { kind: 'reschedule', label: 'Invitees can reschedule' },
];

// A window as the form edits it: "till the time", or a count and unit.
const toForm = (minutes) => ({ limited: Number(minutes) > 0, ...(Number(minutes) > 0 ? splitWindow(minutes) : { count: 24, unit: 'hours' }) });

/**
 * Edit Appointment Type (the slim version of the legacy drawer): its modes,
 * duration, online booking, and "Limit cancel or reschedule time", how long
 * before the appointment patients can still cancel or reschedule it
 * themselves. Staff can still act inside that window; Bulk Cancel and Bulk
 * Reschedule flag those appointments for review.
 *
 * @param {object}   props.type     – the appointment_types row
 * @param {function} props.onClose
 */
export function AppointmentTypeDrawer({ type, onClose }) {
  const save = useAppStore(s => s.saveAppointmentType);
  const [modes, setModes] = useState(() => MODES.filter(m => String(type.mode || '').split('/').some(x => x.trim().toLowerCase() === m.toLowerCase())));
  const [duration, setDuration] = useState(type.duration || '');
  const [bookable, setBookable] = useState(!!type.patient_bookable);
  const [limits, setLimits] = useState(() => Object.fromEntries(LIMITS.map(l => [l.kind, toForm(type[WINDOW_FIELD[l.kind]])])));
  const [saving, setSaving] = useState(false);
  // "Add availability for this type": the multi-user drawer, no users picked,
  // the first appointment type row set to this type.
  const [addingAvailability, setAddingAvailability] = useState(false);
  const platformUsers = useAppStore(s => s.platformUsers);
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  const fetchUserAvailability = useAppStore(s => s.fetchUserAvailability);
  useEffect(() => { if (addingAvailability) { fetchPlatformUsers?.(); fetchUserAvailability?.(); } }, [addingAvailability, fetchPlatformUsers, fetchUserAvailability]);
  const setLimit = (kind, next) => setLimits(p => ({ ...p, [kind]: { ...p[kind], ...next } }));

  const missingCount = LIMITS.some(l => limits[l.kind].limited && !(Number(limits[l.kind].count) > 0));
  const invalid = !modes.length || missingCount;

  const submit = async () => {
    if (invalid || saving) return;
    setSaving(true);
    const ok = await save(type.id, {
      mode: modes.join('/'),
      duration: duration.trim(),
      patient_bookable: bookable,
      ...Object.fromEntries(LIMITS.map(l => [WINDOW_FIELD[l.kind], limits[l.kind].limited ? joinWindow(limits[l.kind].count, limits[l.kind].unit) : null])),
    });
    setSaving(false);
    if (!ok) { toast.error('Appointment type could not be saved. Try again.'); return; }
    toast.success('Appointment Type Updated Successfully');
    onClose();
  };

  return (
    <>
    <Drawer
      title={type.name}
      onClose={onClose}
      noCloseDivider
      headerRight={(
        <>
          <Button variant="solid" disabled={invalid || saving} onClick={submit}>Save</Button>
          <span className={styles.headerDivider} aria-hidden="true" />
        </>
      )}
    >
      <div className={styles.form}>
        <div className={styles.group}>
          <span className={styles.groupLabel}>Mode of Appointment</span>
          <div className={styles.checks}>
            {MODES.map(m => (
              <label key={m} className={styles.check}>
                <Checkbox
                  checked={modes.includes(m)}
                  onCheckedChange={(on) => setModes(p => MODES.filter(x => (x === m ? on : p.includes(x))))}
                />
                {m}
              </label>
            ))}
          </div>
          {!modes.length && <span className={styles.error}>Pick at least one mode</span>}
        </div>

        <Input label="Duration" placeholder="e.g. 30 min" value={duration} onValueChange={setDuration} />

        <div className={styles.group}>
          <span className={styles.groupLabel}>Availability</span>
          <span className={styles.groupHint}>Days, times and locations for this type are set on each user&apos;s schedule.</span>
          <span>
            <Link onClick={() => setAddingAvailability(true)}>
              <AddIconMinimalist size={12} color="currentColor" />
              Add availability for this type
            </Link>
          </span>
        </div>

        <Switch checked={bookable} onChange={setBookable} label="Online booking" />

        <div className={styles.group}>
          <span className={styles.groupLabel}>Limit Cancel or Reschedule Time</span>
          <span className={styles.groupHint}>
            How long before the appointment patients can still cancel or reschedule it themselves. Staff can still do it, after a review.
          </span>
          {LIMITS.map(({ kind, label }) => {
            const l = limits[kind];
            return (
              <RadioOptionGroup
                key={kind}
                label={label}
                name={`${kind}-window`}
                value={l.limited ? 'before' : 'any'}
                onChange={(v) => setLimit(kind, { limited: v === 'before' })}
                options={[
                  { value: 'any', label: 'Till the time of appointment' },
                  {
                    value: 'before',
                    label: 'Up to a set time before appointment time',
                    content: (
                      <NumberUnitInput
                        value={l.count}
                        onChange={(count) => setLimit(kind, { count })}
                        unit={l.unit}
                        units={WINDOW_UNITS}
                        onUnitChange={(unit) => setLimit(kind, { unit })}
                        errorText={Number(l.count) > 0 ? undefined : 'Enter how long before'}
                      />
                    ),
                  },
                ]}
              />
            );
          })}
        </div>
      </div>
    </Drawer>
    {addingAvailability && (
      <UserAvailabilityDrawer
        bulk
        presetType={type.name}
        users={(platformUsers || []).map(u => ({ ...u, role: u.clinicalRoles?.[0] || 'Staff' }))}
        onClose={() => setAddingAvailability(false)}
      />
    )}
    </>
  );
}
