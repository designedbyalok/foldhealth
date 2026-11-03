import { useEffect, useState } from 'react';
import { DashboardCard, DashboardCardBody, DashboardCardSkeleton } from '../../../../../../components/DashboardCard/DashboardCard';
import { PanelSectionItem } from '../../../../../../components/PanelSection/PanelSection';
import { ActionButton } from '../../../../../../components/ActionButton/ActionButton';
import { Button } from '../../../../../../components/Button/Button';
import { Input } from '../../../../../../components/Input/Input';
import { DateTimePicker } from '../../../../../../components/DateTimePicker/DateTimePicker';
import { Checkbox } from '../../../../../../components/ShadcnCheckbox/ShadcnCheckbox';
import { useAppStore } from '../../../../../../store/useAppStore';
import { defaultRemindAt, groupReminders, isoToPicker, pickerToIso, reminderWhen, snoozeOneDay } from './reminders';
import styles from './overviewCards.module.css';

// The clock the card reads "overdue" and "today" against, refreshed each
// minute so a reminder turns overdue without a reload.
function useNow(intervalMs = 60000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/**
 * The signed-in user's own reminders on this patient (patient_reminders):
 * overdue first, then today and upcoming, each with check-off, snooze and
 * delete. Nobody else on the team sees them.
 */
export function RemindersCard({ patient }) {
  const memberId = patient?.memberId ? String(patient.memberId) : null;
  const reminders = useAppStore(s => (memberId ? s.patientReminders[memberId] : undefined));
  const fetchReminders = useAppStore(s => s.fetchPatientReminders);
  const addReminder = useAppStore(s => s.addPatientReminder);
  const updateReminder = useAppStore(s => s.updatePatientReminder);
  const deleteReminder = useAppStore(s => s.deletePatientReminder);
  const now = useNow();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDone, setShowDone] = useState(false);

  useEffect(() => { if (memberId) fetchReminders(memberId); }, [memberId, fetchReminders]);

  if (memberId && reminders === undefined) return <DashboardCardSkeleton icon="solar:alarm-linear" title="Reminders" rows={2} />;

  const groups = groupReminders(reminders || [], now);
  const open = [...groups.overdue, ...groups.today, ...groups.upcoming];
  const remindAt = pickerToIso(when);
  const canSave = !!title.trim() && !!remindAt && !saving;

  const startAdding = () => {
    setTitle('');
    setWhen(isoToPicker(defaultRemindAt()));
    setAdding(true);
  };
  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const row = await addReminder(memberId, { title, remindAt });
      if (row) setAdding(false);
    } finally {
      setSaving(false);
    }
  };

  const row = (r, done) => {
    const overdue = !done && new Date(r.remindAt).getTime() < now;
    return (
      <div key={r.id} className={`${styles.listRow} ${done ? styles.reminderDone : ''}`}>
        <PanelSectionItem
          inset
          leading={(
            <Checkbox
              checked={done}
              onCheckedChange={() => updateReminder(memberId, r.id, { doneAt: done ? null : new Date().toISOString() })}
              aria-label={done ? `Reopen ${r.title}` : `Mark ${r.title} done`}
            />
          )}
          title={done ? <span className={styles.struck}>{r.title}</span> : r.title}
          wrapTitle
          meta={[<span key="when" className={overdue ? styles.textError : undefined}>{overdue ? `Overdue, ${reminderWhen(r.remindAt, now)}` : reminderWhen(r.remindAt, now)}</span>]}
          trailing={(
            <>
              {!done && (
                <ActionButton
                  icon="solar:alarm-linear"
                  size="sm"
                  tooltip="Snooze a day"
                  onClick={() => updateReminder(memberId, r.id, { remindAt: snoozeOneDay(r.remindAt, Date.now()) })}
                />
              )}
              <ActionButton icon="solar:trash-bin-minimalistic-linear" size="sm" tooltip="Delete" onClick={() => deleteReminder(memberId, r.id)} />
            </>
          )}
        />
      </div>
    );
  };

  return (
    <DashboardCard
      icon="solar:alarm-linear"
      title="Reminders"
      count={open.length || null}
      actions={!adding && <ActionButton icon="solar:add-circle-linear" size="sm" tooltip="Add reminder" onClick={startAdding} />}
    >
      <DashboardCardBody className={styles.listBody}>
        {adding && (
          <form
            className={styles.reminderForm}
            onSubmit={(e) => { e.preventDefault(); save(); }}
          >
            <Input
              autoFocus
              placeholder="Remind me to…"
              value={title}
              maxLength={200}
              onChange={e => setTitle(e.target.value)}
              aria-label="Reminder"
            />
            <DateTimePicker value={when} onChange={setWhen} hour12 fullWidth minDate={new Date(now)} />
            <span className={styles.reminderActions}>
              <Button variant="ghost" size="sm" type="button" onClick={() => setAdding(false)}>Cancel</Button>
              <Button size="sm" type="submit" disabled={!canSave} loading={saving}>Add Reminder</Button>
            </span>
          </form>
        )}
        {open.length === 0 && !adding && (
          <p className={styles.empty}>
            {groups.done.length ? 'No open reminders.' : 'No reminders. Add one to follow up on this patient; only you will see it.'}
          </p>
        )}
        {open.map(r => row(r, false))}
        {groups.done.length > 0 && (
          <Button variant="ghost" size="sm" className={styles.listMore} onClick={() => setShowDone(v => !v)}>
            {showDone ? 'Hide done' : `Show done (${groups.done.length})`}
          </Button>
        )}
        {showDone && groups.done.map(r => row(r, true))}
      </DashboardCardBody>
    </DashboardCard>
  );
}
