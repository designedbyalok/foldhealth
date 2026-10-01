import { useState } from 'react';
import { Drawer } from '../../components/Drawer/Drawer';
import { Button } from '../../components/Button/Button';
import { Input } from '../../components/Input/Input';
import { Select } from '../../components/Select/Select';
import { Textarea } from '../../components/Textarea/Textarea';
import { DateTimePicker } from '../../components/DateTimePicker/DateTimePicker';
import { useLocationOptions } from '../../components/ScheduleDrawer/useLocationOptions';
import { toast } from '../../components/Toast/sonnerToast';
import { useAppStore } from '../../store/useAppStore';
import { fromPickerValue, toPickerValue } from '../ooo/oooUtils';
import { HOLIDAY_NAME_MAX, validateHoliday } from './holidayUtils';
import styles from './holidays.module.css';

/**
 * Add / Edit Holiday (Figma December-2025 842:13864): name, start and end
 * date and time (the same fields as Out of Office), the locations it
 * applies to, and an optional auto reply. Dates can't be in the past
 * (840:13167). Duplicating opens it as a new holiday from an existing one,
 * named "… (Copy)" with its dates cleared.
 *
 * @param {object}   props
 * @param {object}   [props.holiday]   – The holiday being edited
 * @param {object}   [props.copyFrom]  – A holiday to duplicate
 * @param {function} props.onClose
 */
export function HolidayDrawer({ holiday, copyFrom, onClose }) {
  const saveHoliday = useAppStore(s => s.saveHolidayConfig);
  const locationOptions = useLocationOptions();
  const isEdit = !!holiday;
  const source = holiday || copyFrom;
  const [values, setValues] = useState(() => ({
    name: holiday ? holiday.name : copyFrom ? `${copyFrom.name} (Copy)`.slice(0, HOLIDAY_NAME_MAX) : '',
    startAt: holiday?.startAt || null,
    endAt: holiday?.endAt || null,
    locations: source?.locations || [],
    autoReplyMessage: source?.autoReplyMessage || '',
  }));
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (patch) => setValues(v => ({ ...v, ...patch }));

  const errors = validateHoliday(values, { original: holiday });
  const hasErrors = Object.keys(errors).length > 0;
  // A date error shows as soon as its field is set (e.g. picking a past day),
  // the rest once Save is tried.
  const err = (k) => (touched || ((k === 'startAt' || k === 'endAt') && values[k]) ? errors[k] : undefined);

  const save = async () => {
    setTouched(true);
    if (hasErrors) return;
    setSaving(true);
    try {
      const saved = await saveHoliday({
        ...holiday,
        name: values.name.trim(),
        startAt: values.startAt,
        endAt: values.endAt,
        locations: values.locations,
        autoReplyMessage: values.autoReplyMessage.trim(),
      });
      if (!saved) return;
      toast.success('Holiday Saved Successfully');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const today = new Date();
  return (
    <Drawer
      title={isEdit ? 'Edit Holiday' : 'Add Holiday'}
      width={640}
      onClose={onClose}
      noCloseDivider
      headerRight={(
        <>
          <Button variant="primary" size="L" disabled={saving || (touched && hasErrors)} onClick={save}>{saving ? 'Saving…' : 'Save'}</Button>
          <span className={styles.headerDivider} aria-hidden="true" />
        </>
      )}
    >
      <div className={styles.form}>
        <Input
          label="Holiday Name"
          required
          placeholder="Enter Holiday Name"
          value={values.name}
          characterLimit={HOLIDAY_NAME_MAX}
          maxLength={HOLIDAY_NAME_MAX}
          onChange={(e) => set({ name: e.target.value })}
          errorText={err('name')}
        />
        <div className={styles.dateRow}>
          <DateTimePicker
            label="Start Date & Time"
            required
            fullWidth
            hour12
            autoCommit
            placeholder="Select Start Date & Time"
            minDate={today}
            value={toPickerValue(values.startAt)}
            onChange={(v) => set({ startAt: fromPickerValue(v) })}
            errorText={err('startAt')}
          />
          <DateTimePicker
            label="End Date & Time"
            required
            fullWidth
            hour12
            autoCommit
            placeholder="Select End Date & Time"
            minDate={values.startAt ? new Date(values.startAt) : today}
            value={toPickerValue(values.endAt)}
            onChange={(v) => set({ endAt: fromPickerValue(v) })}
            errorText={err('endAt')}
          />
        </div>
        <Select
          label="Location"
          required
          portal
          searchable
          multiple
          checkboxes
          badges
          placeholder="Select Locations"
          options={locationOptions.map(l => ({ value: l, label: l }))}
          value={values.locations}
          onChange={(next) => set({ locations: next })}
          errorText={err('locations')}
        />
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Auto Reply Message</span>
          <Textarea
            rows={3}
            placeholder="Enter Message"
            value={values.autoReplyMessage}
            maxLength={500}
            onChange={(e) => set({ autoReplyMessage: e.target.value })}
            aria-label="Auto reply message"
          />
          <span className={styles.helper}>Auto Replies trigger on designated holidays and follow holiday configurations specific to locations.</span>
        </label>
      </div>
    </Drawer>
  );
}
