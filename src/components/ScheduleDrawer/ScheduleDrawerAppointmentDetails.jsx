import { Icon } from '../Icon/Icon';
import { Switch } from '../Switch/Switch';
import { AppointmentTypePicker } from './AppointmentTypePicker';
import { DetailDropdown } from './DetailDropdown';
import { ProviderPicker } from './ProviderPicker';
import { SecondaryUserPicker } from './SecondaryUserPicker';
import { DatePicker } from './DatePicker';
import { ScheduleDrawerRecurringFields } from './ScheduleDrawerRecurringFields';
import { ScheduleDrawerTimePicker } from './ScheduleDrawerTimePicker';
import { MODE_OPTIONS, LOCATION_OPTIONS } from './scheduleDrawerConstants';
import styles from './ScheduleDrawer.module.css';

export function ScheduleDrawerAppointmentDetails({
  appointmentTypes,
  appointmentType,
  setAppointmentType,
  mode,
  setMode,
  location,
  setLocation,
  provider,
  setProvider,
  profileUsers,
  secondaryUsers,
  setSecondaryUsers,
  date,
  setDate,
  recurring,
  setRecurring,
  recurFrequency,
  setRecurFrequency,
  recurUnit,
  setRecurUnit,
  recurDays,
  setRecurDays,
  recurEndDate,
  setRecurEndDate,
  recurConfirmed,
  setRecurConfirmed,
  time,
  setTime,
  openSections,
  setSectionOpen,
  customTime,
  setCustomTime,
  timeBtnRef,
  timezoneLabel,
}) {
  const isSectionOpen = (key) => openSections.includes(key);

  return (
    <div className={styles.section}>
      <span className={styles.sectionLabel}>Appointment Details</span>
      <div className={styles.detailsCard}>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Appointment Type</span>
          <AppointmentTypePicker value={appointmentType} onSelect={setAppointmentType} appointmentTypes={appointmentTypes} />
        </div>

        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Mode of Appointment</span>
          <DetailDropdown
            value={mode}
            placeholder="Select Mode of Appointment"
            icon="solar:monitor-linear"
            options={MODE_OPTIONS.map(m => ({ label: m.label, icon: m.icon }))}
            onSelect={v => setMode(v)}
            renderItem={(opt) => <><Icon name={opt.icon} size={16} color="var(--neutral-300)" /> {opt.label}</>}
          />
        </div>

        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Location</span>
          <DetailDropdown
            value={location}
            placeholder="Select Location"
            icon="solar:map-point-linear"
            options={LOCATION_OPTIONS.map(l => ({ label: l }))}
            onSelect={v => setLocation(v)}
          />
        </div>

        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Primary User</span>
          <ProviderPicker value={provider} onSelect={setProvider} profileUsers={profileUsers} onAddSecondary={() => setSectionOpen('secondary', true)} />
        </div>

        {isSectionOpen('secondary') && (
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Secondary User</span>
            <SecondaryUserPicker selected={secondaryUsers} onChange={setSecondaryUsers} profileUsers={profileUsers} primary={provider} />
          </div>
        )}

        <div className={styles.detailRowTop}>
          <span className={styles.detailLabel}>Date</span>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <DatePicker value={date} onSelect={setDate} />
              {date && (
                <div className={styles.recurringToggle}>
                  <Switch checked={recurring} onChange={v => { setRecurring(v); setRecurConfirmed(false); }} label="Set Recurring" />
                </div>
              )}
            </div>
            {date && recurring && (
              <ScheduleDrawerRecurringFields
                recurFrequency={recurFrequency}
                setRecurFrequency={setRecurFrequency}
                recurUnit={recurUnit}
                setRecurUnit={setRecurUnit}
                recurDays={recurDays}
                setRecurDays={setRecurDays}
                recurEndDate={recurEndDate}
                setRecurEndDate={setRecurEndDate}
                recurConfirmed={recurConfirmed}
                setRecurConfirmed={setRecurConfirmed}
              />
            )}
          </div>
        </div>

        {date && (
          <ScheduleDrawerTimePicker
            time={time}
            setTime={setTime}
            isSectionOpen={isSectionOpen}
            setSectionOpen={setSectionOpen}
            customTime={customTime}
            setCustomTime={setCustomTime}
            timeBtnRef={timeBtnRef}
            timezoneLabel={timezoneLabel}
          />
        )}
      </div>
    </div>
  );
}
