import { useEffect, useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { SectionTitleBar } from '../../../components/SectionTitleBar/SectionTitleBar';
import { Switch } from '../../../components/Switch/Switch';
import { TableSkeleton } from '../../../components/TableSkeleton/TableSkeleton';
import { EmptyState } from '../../../components/EmptyState/EmptyState';
import { windowLabel, WINDOW_FIELD } from '../../calendar/list/typeWindows';
import { AppointmentTypeDrawer } from './AppointmentTypeDrawer';
import calendarStyles from './CalendarSettings.module.css';
import styles from './AppointmentTypesTab.module.css';

/**
 * Settings → Calendar → Appointment types: every visit type, whether
 * patients may book it themselves in the patient app
 * (appointment_types.patient_bookable), and how long before the appointment
 * they can still cancel or reschedule it. A row opens its Appointment Type
 * drawer. Open times come from User availability.
 */
export function AppointmentTypesTab({ tabs, activeTab, onTabChange }) {
  const types = useAppStore((s) => s.appointmentTypes);
  const fetchTypes = useAppStore((s) => s.fetchAppointmentTypes);
  const setBookable = useAppStore((s) => s.setAppointmentTypeBookable);
  const [editingId, setEditingId] = useState(null);
  const editing = types.find(t => t.id === editingId);
  const limit = (t, kind) => (t[WINDOW_FIELD[kind]] ? `${windowLabel(t[WINDOW_FIELD[kind]])} before` : 'Till appointment');

  // Show the skeleton until the first fetch settles, unless types are already loaded.
  const [fetched, setFetched] = useState(() => types.length > 0);
  useEffect(() => {
    let alive = true;
    Promise.resolve(fetchTypes()).finally(() => { if (alive) setFetched(true); });
    return () => { alive = false; };
  }, [fetchTypes]);

  return (
    <div className={calendarStyles.wrapper}>
      <SectionTitleBar tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} actions={[]} />
      <div className={calendarStyles.content}>
        <p className={styles.intro}>
          Turn on Online booking to let patients book a visit type themselves in the patient app.
          They see open times from each provider&apos;s User availability.
        </p>
        {!fetched ? <TableSkeleton rows={5} /> : types.length === 0 ? (
          <div className={calendarStyles.empty}>
            <EmptyState icon="solar:calendar-linear" title="No appointment types yet" />
          </div>
        ) : (
          <div className={styles.scroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Appointment type</th>
                  <th scope="col">Mode</th>
                  <th scope="col">Duration</th>
                  <th scope="col">Cancel limit</th>
                  <th scope="col">Reschedule limit</th>
                  <th scope="col">Online booking</th>
                </tr>
              </thead>
              <tbody>
                {types.map((t) => (
                  <tr key={t.id} className={styles.row} onClick={() => setEditingId(t.id)}>
                    <td className={styles.name}>{t.name}</td>
                    <td>{t.mode || '-'}</td>
                    <td>{t.duration || '-'}</td>
                    <td>{limit(t, 'cancel')}</td>
                    <td>{limit(t, 'reschedule')}</td>
                    {/* The switch flips online booking without opening the drawer. */}
                    <td onClick={e => e.stopPropagation()}>
                      <Switch
                        checked={!!t.patient_bookable}
                        onChange={(on) => setBookable(t.id, on)}
                        ariaLabel={`Patients can book ${t.name} online`}
                        label={t.patient_bookable ? 'On' : 'Off'}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {editing && <AppointmentTypeDrawer key={editing.id} type={editing} onClose={() => setEditingId(null)} />}
    </div>
  );
}
