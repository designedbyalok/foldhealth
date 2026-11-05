import { Button } from '../Button/Button';
import { Drawer } from '../Drawer/Drawer';
import { ScheduleDrawerPatientSection } from './ScheduleDrawerPatientSection';
import { ScheduleDrawerAppointmentDetails } from './ScheduleDrawerAppointmentDetails';
import { ScheduleDrawerInstructionFields } from './ScheduleDrawerInstructionFields';
import styles from './ScheduleDrawer.module.css';

// Body-only view of the booking form, no `<Drawer>` shell. Callers that
// host the scheduler as an inline workspace (e.g. HEDIS Care Gap left
// pane) render this directly and own their own header + save CTA.
export function ScheduleDrawerBookingBody(props) {
  const {
    patients,
    selectedPatient,
    setSelectedPatient,
    reasonForVisit,
    setReasonForVisit,
    requireRsvp,
    setRequireRsvp,
    openSections,
    setSectionOpen,
    memberInstructionRef,
    staffInstructionRef,
    patientLocked = false,
  } = props;

  return (
    <div className={styles.content}>
      <ScheduleDrawerPatientSection
        selectedPatient={selectedPatient}
        setSelectedPatient={setSelectedPatient}
        patients={patients}
        reasonForVisit={reasonForVisit}
        setReasonForVisit={setReasonForVisit}
        locked={patientLocked}
      />
      <ScheduleDrawerAppointmentDetails {...props} />
      <ScheduleDrawerInstructionFields
        requireRsvp={requireRsvp}
        setRequireRsvp={setRequireRsvp}
        openSections={openSections}
        setSectionOpen={setSectionOpen}
        memberInstructionRef={memberInstructionRef}
        staffInstructionRef={staffInstructionRef}
      />
    </div>
  );
}

export function ScheduleDrawerBookingForm(props) {
  const { onClose, canSchedule, handleSchedule } = props;
  return (
    <Drawer title="Schedule Appointment" onClose={onClose} noCloseDivider headerRight={
      <>
        <Button disabled={!canSchedule} onClick={handleSchedule}>Schedule</Button>
        <span className={styles.headerDivider} />
      </>
    } bodyClassName={styles.drawerBody}>
      <ScheduleDrawerBookingBody {...props} />
    </Drawer>
  );
}
