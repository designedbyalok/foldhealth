import { useState } from 'react';
import { Icon } from '../../../../../../../../components/Icon/Icon';
import { AddIconMinimalist } from '../../../../../../../../components/Icon/AddIconMinimalist';
import { DownChevronIcon } from '../../../../../../../../components/Icon/DownChevronIcon';
import { Button } from '../../../../../../../../components/Button/Button';
import { ActionButton } from '../../../../../../../../components/ActionButton/ActionButton';
import { Checkbox } from '../../../../../../../../components/Checkbox/Checkbox';
import { ScheduleDrawer } from '../../../../../../../../components/ScheduleDrawer/ScheduleDrawer';
import { toast } from '../../../../../../../../components/Toast/sonnerToast';
import { CollapsibleContent } from '../../../../../../../../components/Collapsible/Collapsible';
import { WorklistShell } from '../../../../../../../../components/WorklistShell/WorklistShell';
import { useAppStore } from '../../../../../../../../store/useAppStore';
import styles from './AppointmentStep.module.css';
import { useProgramActivityLog } from '../../shared/useProgramActivityLog';

// Mirrors the grid this table replaced: 32 / fill / 140 / 140 / 160.
const APPT_COLUMNS = [
  { key: 'select', label: '', showCheckbox: true, width: 32 },
  { key: 'title', label: 'Title' },
  { key: 'type', label: 'Type', width: 140 },
  { key: 'dateTime', label: 'Date & Time', width: 140 },
  { key: 'assignee', label: 'Assignee', width: 160 },
];

// One appointment/reminder row of the Upcoming / Program-related tables.
function ApptRow({ appt }) {
  return (
    <tr className={styles.row}>
      <td className={styles.checkCell} onClick={e => e.stopPropagation()}>
        <Checkbox aria-label={`Select ${appt.title}`} />
      </td>
      <td className={styles.titleCell}>
        <span className={styles.titleText}>{appt.title}</span>
        <span className={styles.subtitle}>{appt.subtitle}</span>
      </td>
      <td className={styles.typeCell}>
        <span className={styles.typeInner}>
          {appt.type}
          {appt.recurring && (
            <span className={styles.recurring}><Icon name="solar:refresh-linear" size={12} color="var(--primary-300)" /></span>
          )}
        </span>
      </td>
      <td className={styles.dateCell}>
        <span>{appt.date}</span>
        <span className={styles.time}>{appt.time}</span>
      </td>
      <td className={styles.assigneeCell}>{appt.assignee}</td>
    </tr>
  );
}

function ApptTable({ rows }) {
  return (
    <WorklistShell
      embedded
      header={null}
      columns={APPT_COLUMNS}
      rows={rows}
      renderRow={a => <ApptRow key={a.id} appt={a} />}
      minTableWidth={0}
    />
  );
}

/**
 * Appointment step (ICT / Follow Up Appointments). Figma E2R1KfF 2358:348528.
 * Shows program-related bookings (matched to the open program) above the
 * Upcoming Appointments & Reminders table; an empty card when the program has
 * no booking yet.
 */
export function AppointmentStep({ patientId, programCode, stepName = 'Appointment' }) {
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [upcomingOpen, setUpcomingOpen] = useState(true);

  const addedForProgram = useAppStore(s => s.programAddedAppointments[programCode]);
  const addProgramAppointment = useAppStore(s => s.addProgramAppointment);
  const logActivity = useProgramActivityLog(programCode);
  const added = addedForProgram || [];

  const all = [...added];
  const programAppts = all.filter(a => a.type === 'Appointment' && a.programCode && a.programCode === programCode);

  const handleScheduled = (row) => {
    if (!row) return;
    addProgramAppointment(programCode, {
      id: `appt-${Date.now()}`,
      title: row.appointment_type_name || 'Appointment',
      subtitle: row.reason_for_visit || row.mode || '',
      type: 'Appointment',
      programCode,
      date: row.date || '',
      time: row.time_start || '',
      assignee: row.primary_user || 'Unassigned',
      recurring: !!row.recurring,
    });
    const when = [row.date, row.time_start].filter(Boolean).join(' ');
    logActivity(`${stepName} Scheduled: ${row.appointment_type_name || 'Appointment'}`, {
      activityKind: 'appointment',
      statusLabel: when || 'Scheduled',
      statusType: 'neutral',
    });
  };

  return (
    <div className={styles.container}>
      {programAppts.length > 0 ? (
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionTitle}>Program related appointments</span>
            <ActionButton size="sm" tooltip="Schedule appointment" onClick={() => setScheduleOpen(true)}><AddIconMinimalist size={16} color="var(--neutral-300)" /></ActionButton>
          </div>
          <ApptTable rows={programAppts} />
        </div>
      ) : (
        <div className={styles.emptyCard}>
          <span className={styles.iconWrap}>
            <span className={styles.iconInner}>
              <Icon name="solar:calendar-linear" size={22} color="var(--neutral-200)" />
            </span>
          </span>
          <span className={styles.emptyText}>Program Related Appointment Not Scheduled</span>
          <div className={styles.actions}>
            <Button onClick={() => setScheduleOpen(true)}>Schedule Appointment</Button>
            <Button variant="outline" trailingIcon="solar:arrow-right-up-linear" onClick={() => toast.success('Link Appointments: coming soon')}>
              Link Appointments
            </Button>
          </div>
        </div>
      )}

      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <button type="button" className={styles.collapseToggle} onClick={() => setUpcomingOpen(o => !o)} aria-expanded={upcomingOpen}>
            <DownChevronIcon size={16} color="var(--neutral-300)" className={styles.chevron} style={upcomingOpen ? undefined : { transform: 'rotate(-90deg)' }} />
            <span className={styles.sectionTitle}>Upcoming Appointments &amp; Reminders</span>
          </button>
          {upcomingOpen && (
            <ActionButton size="sm" tooltip="Add" onClick={() => setScheduleOpen(true)}><AddIconMinimalist size={16} color="var(--neutral-300)" /></ActionButton>
          )}
        </div>
        <CollapsibleContent open={upcomingOpen} className={styles.sectionCollapse}>
          <div className={styles.sectionBody}>
            {all.length > 0
              ? <ApptTable rows={all} />
              : <div className={styles.sectionEmpty}>No upcoming appointments or reminders.</div>}
          </div>
        </CollapsibleContent>
      </div>

      {scheduleOpen && (
        <ScheduleDrawer initialPatientId={patientId} source="care_program" onClose={() => setScheduleOpen(false)} onSave={handleScheduled} />
      )}
    </div>
  );
}
