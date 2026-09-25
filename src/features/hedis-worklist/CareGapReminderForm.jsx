import { Input } from '../../components/Input/Input';
import { Select } from '../../components/Select/Select';
import { Textarea } from '../../components/Textarea/Textarea';
import { TIME_SLOTS } from '../../components/ScheduleDrawer/scheduleDrawerConstants';
import { todayIso } from './useCareGapReminderForm';
import styles from './CareGapReminderForm.module.css';

/**
 * Care Gap drawer — "Set Reminder" pane body. Pass the object returned by
 * `useCareGapReminderForm()` as `form`; `users` feeds the Assignee picker.
 */
export function CareGapReminderForm({ form, users = [] }) {
  const { values, set } = form;
  const assigneeOptions = [...new Set((users || []).map(u => u?.name).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b))
    .map(name => ({ value: name, label: name }));

  return (
    <div className={styles.form}>
      <Input
        label="Title"
        required
        value={values.title}
        onChange={e => set('title')(e.target.value)}
        placeholder="e.g. Call patient about lab results"
      />
      <div className={styles.row}>
        <Input
          label="Date"
          required
          type="date"
          min={todayIso()}
          value={values.date}
          onChange={e => set('date')(e.target.value)}
        />
        <Select
          label="Time"
          options={TIME_SLOTS.map(t => ({ value: t, label: t }))}
          value={values.time}
          onChange={set('time')}
          placeholder="Select Time"
        />
      </div>
      <Select
        label="Assignee"
        searchable
        options={assigneeOptions}
        value={values.assignee}
        onChange={set('assignee')}
        placeholder="Select Assignee"
      />
      <Textarea
        title="Note"
        rows={4}
        value={values.note}
        onChange={set('note')}
        placeholder="Add details for this reminder"
      />
    </div>
  );
}
