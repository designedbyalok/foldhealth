import { useEffect, useMemo, useState } from 'react';
import { BottomSheet, BottomSheetItem } from '../../../components/BottomSheet/BottomSheet';
import { Button } from '../../../components/Button/Button';
import { DesktopOnlyNote } from '../../../components/DesktopOnlyNote/DesktopOnlyNote';
import { Icon } from '../../../components/Icon/Icon';
import { Input } from '../../../components/Input/Input';
import { Switch } from '../../../components/Switch/Switch';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
import { FALLBACK_APPOINTMENT_TYPES } from '../../../components/ScheduleDrawer/scheduleDrawerConstants';
import {
  ALL_TYPES, DAY_SHORT, TIMEZONES, cadenceSentence, conflictText, findConflicts, newBlock, newSlot, timezoneLabel, validateBlock,
} from '../../settings/calendar/availability/availabilityUtils';
import { useMobileNav } from '../MobileNavContext';
import { FieldGroup, FormScreen, PickerField } from '../patient/FormScreen';
import { useMyAvailability } from './useMyAvailability';
import styles from './settings.module.css';

// What changing makes an accepted overlap void (as the desktop drawer).
const SCHEDULE_KEYS = ['startDate', 'endDate', 'rolling', 'advanced', 'repeat', 'interval', 'days', 'weeks', 'slots'];

/**
 * Add or edit one of my availability slots (desktop User Availability
 * drawer, new view): location, timezone, days, dates (or rolling), hours per
 * appointment type, and Skips holidays for all my slots. Saves every slot I
 * have through saveUserAvailability, the same all-at-once save as desktop.
 * Monthly or every-N cadences are changed on a computer.
 */
export function AvailabilitySlotScreen({ blockId }) {
  const { pop } = useMobileNav();
  const { user, blocks } = useMyAvailability();
  const saveUserAvailability = useAppStore(s => s.saveUserAvailability);
  const locations = useAppStore(s => s.practiceLocations);
  const fetchPracticeLocations = useAppStore(s => s.fetchPracticeLocations);
  const appointmentTypes = useAppStore(s => s.appointmentTypes);
  const fetchAppointmentTypes = useAppStore(s => s.fetchAppointmentTypes);
  useEffect(() => { fetchPracticeLocations?.(); fetchAppointmentTypes?.(); }, [fetchPracticeLocations, fetchAppointmentTypes]);

  const original = blockId ? blocks.find(b => b.id === blockId) : null;
  const [block, setBlock] = useState(() => original || { ...newBlock(), rolling: false });
  const [skipHolidays, setSkipHolidays] = useState(() => (blocks.length ? blocks.every(b => b.skipHolidays !== false) : true));
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [overlapAsk, setOverlapAsk] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const update = (patch) => setBlock(b => ({
    ...b, ...patch, ...(SCHEDULE_KEYS.some(k => k in patch) ? { allowOverlap: false } : {}),
  }));
  const updateSlot = (j, patch) => update({ slots: block.slots.map((s, k) => (k === j ? { ...s, ...patch } : s)) });

  const locationOptions = useMemo(() => {
    const names = new Set((locations || []).map(l => l.name));
    if (block.location) names.add(block.location);
    return [...names].sort().map(n => ({ value: n, label: n }));
  }, [locations, block.location]);
  const typeOptions = useMemo(() => {
    const names = (appointmentTypes?.length ? appointmentTypes : FALLBACK_APPOINTMENT_TYPES).map(t => t.name);
    return [ALL_TYPES, ...names].map(n => ({ value: n, label: n }));
  }, [appointmentTypes]);
  const tzOptions = useMemo(() => {
    const zones = new Set(TIMEZONES);
    if (block.timezone) zones.add(block.timezone);
    return [...zones].map(z => ({ value: z, label: timezoneLabel(z) }));
  }, [block.timezone]);

  const errors = useMemo(() => {
    const e = validateBlock(block);
    if (block.rolling) delete e.endDate;
    return e;
  }, [block]);
  const shown = checked ? errors : {};
  const advanced = block.repeat !== 'weekly' || (Number(block.interval) || 1) > 1;
  // All my slots as they'll be saved, this one in its place (or added).
  const next = original ? blocks.map(b => (b.id === original.id ? block : b)) : [...blocks, block];
  const index = original ? blocks.findIndex(b => b.id === original.id) : next.length - 1;

  const persist = async (list) => {
    // Slots that double-book are saved as allowed overlaps, as desktop.
    const overlapping = new Set(findConflicts(list).flatMap((cs, i) => (cs.length ? [i] : [])));
    setSaving(true);
    const clean = list.map((b, k) => ({
      ...b, collapsed: undefined, arrive: undefined, importedFrom: undefined, importedFromId: undefined, checked: undefined,
      skipHolidays, allowOverlap: overlapping.has(k),
      ...(b.rolling ? { endDate: '' } : {}),
    }));
    let ok;
    try {
      ok = await saveUserAvailability(user, clean);
    } finally {
      setSaving(false);
    }
    if (ok) {
      toast.success(`Availability saved for ${user.name}`);
      pop();
    }
  };

  const save = (acknowledged = false) => {
    setChecked(true);
    if (Object.keys(errors).length) return;
    const mine = findConflicts(next)[index] || [];
    // Overlaps are allowed, but taken on knowingly, as on desktop.
    const fresh = mine.filter(c => !(block.allowOverlap && next[c.index].allowOverlap));
    if (fresh.length && !acknowledged) { setOverlapAsk(fresh); return; }
    persist(next);
  };

  const remove = () => {
    setConfirmDelete(false);
    persist(blocks.filter(b => b.id !== original.id));
  };

  const toggleDay = (d) => update({ days: block.days.includes(d) ? block.days.filter(x => x !== d) : [...block.days, d].sort() });

  return (
    <FormScreen
      title={original ? 'Edit hours' : 'Add hours'}
      subtitle={cadenceSentence(block) || undefined}
      actions={original && (
        <button type="button" className={styles.iconBtn} aria-label="Delete these hours" onClick={() => setConfirmDelete(true)}>
          <Icon name="solar:trash-bin-minimalistic-linear" size={24} color="var(--status-error-dark)" />
        </button>
      )}
      footer={<Button size="lg" loading={saving} disabled={!user} onClick={() => save()}>Save</Button>}
    >
      <FieldGroup label="Where">
        <PickerField label="Location" required value={block.location} options={locationOptions} placeholder="Select location" onChange={(v) => update({ location: v })} />
        {shown.location && <p className={styles.error}>{shown.location}</p>}
        <PickerField label="Timezone" required value={block.timezone} options={tzOptions} placeholder="Select timezone" onChange={(v) => update({ timezone: v })} />
        {shown.timezone && <p className={styles.error}>{shown.timezone}</p>}
      </FieldGroup>

      <FieldGroup label="When">
        {advanced ? (
          <DesktopOnlyNote title="Custom repeat" description={`${cadenceSentence(block)} Change a monthly or every-few-weeks repeat on a computer.`} />
        ) : (
          <>
            <div className={styles.days} role="group" aria-label="Days">
              {DAY_SHORT.map((d, i) => (
                <button key={d} type="button" aria-pressed={block.days.includes(i)} className={`${styles.day} ${block.days.includes(i) ? styles.dayOn : ''}`} onClick={() => toggleDay(i)}>{d}</button>
              ))}
            </div>
            {shown.days && <p className={styles.error}>{shown.days}</p>}
          </>
        )}
        <div className={styles.row2}>
          <Input size="lg" type="date" label="Starts" required value={block.startDate || ''} onValueChange={(v) => update({ startDate: v })} errorText={shown.startDate} />
          {!block.rolling && <Input size="lg" type="date" label="Ends" required value={block.endDate || ''} onValueChange={(v) => update({ endDate: v })} errorText={shown.endDate} />}
        </div>
        <label className={styles.switchRow}>
          <span>
            Repeats until stopped
            <span className={styles.switchSub}>Rolling schedule, no end date</span>
          </span>
          <span className={styles.switchWrap}>
            <Switch checked={!!block.rolling} onChange={(on) => update(on ? { rolling: true, endDate: '' } : { rolling: false })} ariaLabel="Repeats until stopped" />
          </span>
        </label>
      </FieldGroup>

      <FieldGroup label="Hours">
        {block.slots.map((s, j) => (
          <div key={j} className={styles.slot}>
            <span className={styles.slotHead}>
              Time range {j + 1}
              {block.slots.length > 1 && (
                <button type="button" className={styles.iconBtn} aria-label={`Remove time range ${j + 1}`} onClick={() => update({ slots: block.slots.filter((_, k) => k !== j) })}>
                  <Icon name="solar:close-circle-linear" size={24} />
                </button>
              )}
            </span>
            <PickerField label="Appointment type" required value={s.appointmentType} options={typeOptions} placeholder="Select type" onChange={(v) => updateSlot(j, { appointmentType: v })} />
            <div className={styles.row2}>
              <Input size="lg" type="time" label="From" value={s.start || ''} onValueChange={(v) => updateSlot(j, { start: v })} />
              <Input size="lg" type="time" label="To" value={s.end || ''} onValueChange={(v) => updateSlot(j, { end: v })} />
            </div>
            {shown.slotErrors?.[j] && <p className={styles.error}>{shown.slotErrors[j]}</p>}
          </div>
        ))}
        {shown.slots && <p className={styles.error}>{shown.slots}</p>}
        <Button variant="outline" size="lg" leadingIcon="solar:add-circle-linear" onClick={() => update({ slots: [...block.slots, newSlot()] })}>Add time range</Button>
      </FieldGroup>

      <label className={styles.switchRow}>
        <span>
          Skips holidays
          <span className={styles.switchSub}>Applies to all my availability</span>
        </span>
        <span className={styles.switchWrap}>
          <Switch checked={skipHolidays} onChange={setSkipHolidays} ariaLabel="Skips holidays" />
        </span>
      </label>

      {overlapAsk && (
        <BottomSheet title="Overlapping hours" onClose={() => setOverlapAsk(null)}>
          <p className={styles.switchSub}>
            These hours double-book you: {overlapAsk.map(conflictText).join('; ')}. Save anyway?
          </p>
          <BottomSheetItem icon="solar:check-circle-linear" label="Save with overlap" onClick={() => { setOverlapAsk(null); save(true); }} />
          <BottomSheetItem icon="solar:pen-linear" label="Keep editing" onClick={() => setOverlapAsk(null)} />
        </BottomSheet>
      )}
      {confirmDelete && (
        <BottomSheet title="Delete these hours?" onClose={() => setConfirmDelete(false)}>
          <BottomSheetItem icon="solar:trash-bin-minimalistic-linear" tone="danger" label="Delete" onClick={remove} />
          <BottomSheetItem icon="solar:close-circle-linear" label="Cancel" onClick={() => setConfirmDelete(false)} />
        </BottomSheet>
      )}
    </FormScreen>
  );
}
