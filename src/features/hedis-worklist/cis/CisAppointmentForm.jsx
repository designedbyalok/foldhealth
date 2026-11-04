import { useId } from 'react';
import { Input } from '../../../components/Input/Input';
import { Select } from '../../../components/Select/Select';
import { Textarea } from '../../../components/Textarea/Textarea';
import { Checkbox } from '../../../components/ShadcnCheckbox/ShadcnCheckbox';
import { TIME_SLOTS } from '../../../components/ScheduleDrawer/scheduleDrawerConstants';
import { todayIso } from '../useCareGapReminderForm';
import { CisStatusBadge } from './CisStatus';
import { DOSE_BADGE, fmtDate } from './cisStatusConfig';
import { appointmentForDose, apptDate, doseKey } from './cisAppointments';
import styles from './CisAppointmentForm.module.css';

/**
 * Care Gap drawer: "Schedule Vaccine Reminder" pane body (CIS-CMB10):
 * a visit booked with the child's own provider. Pass the object returned by
 * `useCisAppointmentForm()` as `form`, evaluateCis() output as `result`,
 * and the member's appointments so doses already booked can't be picked
 * again (the appointment being edited keeps its own).
 */
export function CisAppointmentForm({ form, result, appointments = [] }) {
  const uid = useId();
  const { values, set, toggleDose, editing } = form;
  const others = appointments.filter(a => a.id !== editing?.id);
  // Doses still to give, earliest first; on edit its doses stay listed even
  // if one has since been recorded.
  const doses = result.antigens
    .flatMap(a => a.rows
      .filter(r => r.kind !== 'given' || editing?.doses.includes(doseKey(a.key, r.number)))
      .map(r => ({ a, r, key: doseKey(a.key, r.number) })))
    .sort((x, y) => (x.r.nextDue ?? x.r.start) - (y.r.nextDue ?? y.r.start));

  const chosenDoses = new Set(values.doses);
  return (
    <div className={styles.form}>
      <p className={styles.hint}>
        Booked with the child's own provider. A reminder is set for the day after to confirm the doses were given.
      </p>
      <div className={styles.row}>
        <Input
          label="Date"
          required
          type="date"
          min={editing ? undefined : todayIso()}
          value={values.date}
          onChange={e => set('date')(e.target.value)}
        />
        <Select
          label="Time"
          options={TIME_SLOTS.map(t => ({ value: t, label: t }))}
          value={values.time}
          onValueChange={set('time')}
          placeholder="Select Time"
        />
      </div>
      <Input
        label="Provider / Clinic"
        value={values.provider}
        onChange={e => set('provider')(e.target.value)}
        placeholder="e.g. Dr. Lopez, Sunrise Pediatrics"
      />

      <fieldset className={styles.doses}>
        <legend className={styles.label}>
          Doses to Give
          <span className={styles.required} aria-hidden="true" />
        </legend>
        {doses.length === 0 ? <p className={styles.empty}>Every dose has been given.</p> : (
          <div className={styles.doseList}>
            {doses.map(({ a, r, key }) => {
              const chosen = chosenDoses.has(key);
              // Already on another scheduled appointment: one booking per dose.
              const booked = appointmentForDose(others, a.key, r);
              return (
                <label key={key} htmlFor={`${uid}-${key}`} className={`${styles.dose} ${booked ? styles.doseBooked : ''}`}>
                  <Checkbox
                    id={`${uid}-${key}`}
                    checked={!booked && chosen}
                    disabled={!!booked}
                    onCheckedChange={(on) => toggleDose(key, on === true)}
                  />
                  <span className={styles.doseText}>
                    <span className={styles.doseName}>{a.label} dose {r.number}</span>
                    <span className={styles.doseMeta}>
                      {booked
                        ? `Already scheduled for ${fmtDate(apptDate(booked.appt))}`
                        : r.kind === 'given' ? `Given ${fmtDate(r.record.date)}` : `${r.recommendedShort} · from ${fmtDate(r.nextDue ?? r.start)}`}
                    </span>
                  </span>
                  <CisStatusBadge map={DOSE_BADGE} status={r.status} hideIcon />
                </label>
              );
            })}
          </div>
        )}
      </fieldset>

      <Textarea
        title="Note"
        rows={3}
        value={values.note}
        onValueChange={set('note')}
        placeholder="Add details for this appointment"
      />
    </div>
  );
}
