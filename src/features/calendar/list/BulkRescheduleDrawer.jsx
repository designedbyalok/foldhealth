import { useEffect, useMemo, useState } from 'react';
import { Drawer } from '../../../components/Drawer/Drawer';
import { Avatar } from '../../../components/Avatar/Avatar';
import { Button } from '../../../components/Button/Button';
import { InfoBar } from '../../../components/InfoBar/InfoBar';
import { Tooltip } from '../../../components/Tooltip/Tooltip';
import { Icon } from '../../../components/Icon/Icon';
import { DatePicker } from '../../../components/DatePicker/DatePicker';
import { Select } from '../../../components/Select/Select';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
import { holidaysForUser } from '../../holidays/holidayUtils';
import { initialsOf, samePerson } from '../../ooo/oooUtils';
import { apptSpan } from '../../ooo/reassignUtils';
import { getTodayInTimezone, BROWSER_TIMEZONE } from '../calendarUtils';
import { minutesToTime, noSlotsReason, openSlots } from '../openSlots';
import { dateLabel, durationMin, timeRangeLabel } from './appointmentList';
import { UserProfileBanner } from '../../settings/account/users/UserProfileBanner';
import styles from './AppointmentListView.module.css';

// "2026-10-02" → "10-02-2026", the format appointments store.
const toApptDate = (iso) => { const [y, m, d] = iso.split('-'); return `${m}-${d}-${y}`; };
const spanOf = (iso, minutes, length) => {
  const [y, m, d] = iso.split('-').map(Number);
  const start = new Date(y, m - 1, d).getTime() + minutes * 60000;
  return { start, end: start + length * 60000 };
};

/**
 * Bulk Reschedule Appointments (Figma 3023:575134): one provider's selected
 * appointments, each given a new date and an open slot. Slots leave out the
 * provider's unavailable, out of office, holiday and booked time, and any
 * slot already picked on another row. Save needs every row filled in.
 *
 * @param {{ id, name }} props.provider
 * @param {object[]} props.appointments
 * @param {() => void} props.onDone  – after a save
 * @param {() => void} props.onClose
 */
export function BulkRescheduleDrawer({ provider, appointments, onDone, onClose }) {
  const everyone = useAppStore(s => s.appointments);
  const oooRecords = useAppStore(s => s.oooRecords);
  const segments = useAppStore(s => s.userAvailability);
  const fetchUserAvailability = useAppStore(s => s.fetchUserAvailability);
  const holidayConfigs = useAppStore(s => s.holidayConfigs);
  const fetchHolidayConfigs = useAppStore(s => s.fetchHolidayConfigs);
  const platformUsers = useAppStore(s => (s.platformPeople?.length ? s.platformPeople : s.platformUsers));
  const allPatients = useAppStore(s => s.allPatients);
  const reschedule = useAppStore(s => s.rescheduleAppointments);
  useEffect(() => { fetchUserAvailability?.(); fetchHolidayConfigs?.(); }, [fetchUserAvailability, fetchHolidayConfigs]);

  const person = (platformUsers || []).find(u => samePerson(u, provider));
  const role = person?.role || person?.clinicalRoles?.[0] || 'Provider';
  const holidays = useMemo(() => holidaysForUser(holidayConfigs, platformUsers, provider), [holidayConfigs, platformUsers, provider]);
  const today = getTodayInTimezone(BROWSER_TIMEZONE);
  const moving = useMemo(() => new Set(appointments.map(a => a.id)), [appointments]);

  // { [appointment id]: { date: ISO, minutes: number|null } }
  const [picks, setPicks] = useState({});
  const [saving, setSaving] = useState(false);
  const setPick = (id, next) => setPicks(p => ({ ...p, [id]: { ...p[id], ...next } }));

  // A row's open slots on `date`, without the times picked on other rows.
  const slotsOn = (a, date, chosen = picks) => {
    const taken = appointments
      .filter(b => b.id !== a.id && chosen[b.id]?.date && chosen[b.id].minutes != null)
      .map(b => spanOf(chosen[b.id].date, chosen[b.id].minutes, durationMin(b)));
    return openSlots({
      date, person: provider, durationMin: durationMin(a),
      segments, holidays, oooRecords, appointments: everyone, ignoreIds: moving, taken,
    });
  };

  // A row's open start times on an ISO day, as a set of minutes; cached for
  // the render, since the date picker asks about every day it shows.
  const openCache = new Map();
  const openOn = (a, iso) => {
    const k = `${a.id}|${iso}`;
    if (!openCache.has(k)) openCache.set(k, new Set(slotsOn(a, iso).map(s => s.minutes)));
    return openCache.get(k);
  };

  // "Autofill Slots": each row gets the first open slot after
  // its current time (or from now, if that has passed), never one another
  // row already has. Any row can still be changed before Save.
  const autofill = () => {
    const next = {};
    appointments.forEach((a) => {
      const from = Math.max(apptSpan(a).start || 0, Date.now());
      const start = new Date(from);
      for (let i = 0; i < 90; i++) {
        const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
        const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
        const slot = slotsOn(a, iso, next).find(s => day.getTime() + s.minutes * 60000 >= from);
        if (slot) { next[a.id] = { date: iso, minutes: slot.minutes }; break; }
      }
    });
    setPicks(next);
    const missing = appointments.length - Object.keys(next).length;
    if (missing) toast.error(`No open slot found in the next 90 days for ${missing} ${missing === 1 ? 'appointment' : 'appointments'}.`);
  };

  const complete = appointments.every(a => picks[a.id]?.date && picks[a.id].minutes != null);

  // Like a reassignment, it runs as a job: the drawer closes once it starts
  // and the list refreshes when it's done; only a failure says more.
  const save = async () => {
    if (!complete || saving) return;
    setSaving(true);
    const changes = appointments.map((a) => {
      const { date, minutes } = picks[a.id];
      return { appt: a, date: toApptDate(date), time_start: minutesToTime(minutes), time_end: minutesToTime(minutes + durationMin(a)) };
    });
    toast.success('Rescheduling Job Started');
    onDone?.();
    onClose();
    const failed = await reschedule(changes);
    if (failed) toast.error(`${failed} of ${changes.length} appointments could not be rescheduled. Try again.`);
  };

  const patientOf = (a) => (allPatients || []).find(p => String(p.id) === String(a.patient_id) || String(p.memberId) === String(a.patient_id));

  return (
    <Drawer
      title="Bulk Reschedule Appointments"
      onClose={onClose}
      noCloseDivider
      // Whose appointments these are, edge to edge under the header.
      // Whose appointments these are, as the user profile drawers show a user.
      banner={(
        <UserProfileBanner
          user={{ initials: initialsOf(provider.name), name: provider.name }}
          subtitle={role}
          actions={false}
        />
      )}
      headerRight={(
        <>
          {/* A disabled button gets no hover, so its wrapper carries the tooltip. */}
          <Tooltip label={complete ? '' : 'Select a date and time for every appointment to save'} maxWidth={240} align="right" placement="bottom" className={styles.saveTip}>
            <span className={complete ? undefined : styles.saveBlocked}>
              <Button variant="solid" disabled={!complete || saving} onClick={save}>Save</Button>
            </span>
          </Tooltip>
          <span className={styles.headerDivider} aria-hidden="true" />
        </>
      )}
    >
      <div className={styles.reschedule}>
        <InfoBar tone="info" variant="inline">
          Only User&apos;s open times are offered. Out of Office, Block Time and already-booked slots are hidden.
        </InfoBar>

        {/* A heading with its action on the right, like the Reassign
            drawer's "Select Reassignment Providers". */}
        <div className={styles.rescheduleHead}>
          <span className={styles.rescheduleTitle}>Select New Date &amp; Time</span>
          <Button variant="soft" size="sm" leadingIconElement={<Icon name="custom:ai" size={14} />} onClick={autofill}>
            Autofill Slots
          </Button>
        </div>

        <table className={styles.rescheduleTable}>
          <colgroup>
            <col />
            <col className={styles.rescheduleDateCol} />
            <col className={styles.rescheduleTimeCol} />
          </colgroup>
          <thead>
            <tr>
              <th>Member</th>
              <th>Date</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((a) => {
              const pick = picks[a.id] || {};
              const p = patientOf(a);
              const demo = [p?.gender?.[0], p?.age != null ? `${p.age}Y` : null].filter(Boolean).join(' • ');
              const when = [`${dateLabel(a.date)}, ${timeRangeLabel(a)}`, a.appointment_type_name].filter(Boolean).join(' • ');
              return (
                <tr key={a.id}>
                  <td>
                    <span className={styles.member}>
                      <Avatar variant="patient" size="M" initials={initialsOf(a.patient_name)} />
                      <span className={styles.memberText}>
                        <span className={styles.memberName}>
                          {a.patient_name || 'Member'}
                          {demo && <span className={styles.memberDemo}> ({demo})</span>}
                        </span>
                        {/* When it is now, so the new pick can be weighed against it. */}
                        <span className={styles.memberSub} title={when}>{when}</span>
                      </span>
                    </span>
                  </td>
                  {/* Date, then that day's open slots: days the provider can't
                      be booked at all (out of office, holidays, fully booked)
                      are greyed out in the calendar. */}
                  <td>
                    <DatePicker
                      aria-label={`New date for ${a.patient_name || 'this appointment'}`}
                      value={pick.date || ''}
                      min={today}
                      isDayDisabled={(iso) => openOn(a, iso).size === 0 && noSlotsReason({ date: iso, person: provider, holidays, oooRecords })}
                      onSelect={(date) => setPick(a.id, { date, minutes: null })}
                    />
                  </td>
                  <td>
                    <Select
                      portal
                      placeholder="Select Slot"
                      disabled={!pick.date}
                      options={pick.date ? slotsOn(a, pick.date).map(s => ({
                        value: String(s.minutes),
                        label: timeRangeLabel({ time_start: minutesToTime(s.minutes), time_end: minutesToTime(s.minutes + durationMin(a)) }),
                      })) : []}
                      value={pick.minutes != null ? String(pick.minutes) : undefined}
                      onChange={(v) => setPick(a.id, { minutes: Number(v) })}
                      emptyText="No open slots on this day"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Drawer>
  );
}
