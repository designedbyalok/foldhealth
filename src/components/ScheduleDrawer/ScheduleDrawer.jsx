import { Drawer } from '../Drawer/Drawer';
import { ScheduleDrawerViewMode } from './ScheduleDrawerViewMode';
import { ScheduleDrawerBookingForm } from './ScheduleDrawerBookingForm';
import { BookingSuccessScreen } from './ScheduleDrawerScreens';
import { useScheduleDrawer } from './useScheduleDrawer';
import styles from './ScheduleDrawer.module.css';

export function ScheduleDrawer({ onClose, selectedSlot, onSave, existingAppointment, timezoneLabel = 'GMT', initialPatientId, initialSelectedPatient, initialProvider, patientLocked = false, inline = false, source }) {
  const drawer = useScheduleDrawer({ onClose, selectedSlot, onSave, existingAppointment, initialPatientId, initialSelectedPatient, initialProvider, source });

  if (drawer.isViewMode) {
    return (
      <ScheduleDrawerViewMode
        onClose={onClose}
        existingAppointment={drawer.existingAppointment}
        appointmentTypes={drawer.appointmentTypes}
        appointmentType={drawer.appointmentType}
        setAppointmentType={drawer.setAppointmentType}
        updateAppointment={drawer.updateAppointment}
        apptStatus={drawer.apptStatus}
        handleStatusChange={drawer.handleStatusChange}
        isPastAppointment={drawer.isPastAppointment}
        showViewStaffInstructions={drawer.showViewStaffInstructions}
        setShowViewStaffInstructions={drawer.setShowViewStaffInstructions}
        showMoreMenu={drawer.showMoreMenu}
        setShowMoreMenu={drawer.setShowMoreMenu}
        moreMenuRef={drawer.moreMenuRef}
        showToast={drawer.showToast}
        handleDeleteAppointment={drawer.handleDeleteAppointment}
        mode={drawer.mode}
        setMode={drawer.setMode}
        location={drawer.location}
        setLocation={drawer.setLocation}
        provider={drawer.provider}
        setProvider={drawer.setProvider}
        profileUsers={drawer.profileUsers}
        providerOoo={drawer.providerOoo}
        setSectionOpen={drawer.setSectionOpen}
        date={drawer.date}
        setDate={drawer.setDate}
        timezoneLabel={timezoneLabel}
        time={drawer.time}
        setTime={drawer.setTime}
        openSections={drawer.openSections}
        customTime={drawer.customTime}
        setCustomTime={drawer.setCustomTime}
        timeBtnRef={drawer.timeBtnRef}
        inline={inline}
        editingInstruction={drawer.editingInstruction}
        setEditingInstruction={drawer.setEditingInstruction}
        instructionDraft={drawer.instructionDraft}
        setInstructionDraft={drawer.setInstructionDraft}
        handleSaveInstruction={drawer.handleSaveInstruction}
        editingStaffInstruction={drawer.editingStaffInstruction}
        setEditingStaffInstruction={drawer.setEditingStaffInstruction}
        staffInstructionDraft={drawer.staffInstructionDraft}
        setStaffInstructionDraft={drawer.setStaffInstructionDraft}
        handleSaveStaffInstruction={drawer.handleSaveStaffInstruction}
      />
    );
  }

  if (drawer.bookingSuccess) {
    return (
      <Drawer title="Schedule Appointment" onClose={onClose} bodyClassName={styles.drawerBody}>
        <BookingSuccessScreen />
      </Drawer>
    );
  }

  return (
    <ScheduleDrawerBookingForm
      onClose={onClose}
      patientLocked={patientLocked}
      canSchedule={drawer.canSchedule}
      handleSchedule={drawer.handleSchedule}
      patients={drawer.patients}
      selectedPatient={drawer.selectedPatient}
      setSelectedPatient={drawer.setSelectedPatient}
      reasonForVisit={drawer.reasonForVisit}
      setReasonForVisit={drawer.setReasonForVisit}
      appointmentTypes={drawer.appointmentTypes}
      appointmentType={drawer.appointmentType}
      setAppointmentType={drawer.setAppointmentType}
      mode={drawer.mode}
      setMode={drawer.setMode}
      location={drawer.location}
      setLocation={drawer.setLocation}
      provider={drawer.provider}
      setProvider={drawer.setProvider}
      profileUsers={drawer.profileUsers}
      providerOoo={drawer.providerOoo}
      providerOooError={drawer.providerOooError}
      secondaryUsers={drawer.secondaryUsers}
      setSecondaryUsers={drawer.setSecondaryUsers}
      date={drawer.date}
      setDate={drawer.setDate}
      recurring={drawer.recurring}
      setRecurring={drawer.setRecurring}
      recurFrequency={drawer.recurFrequency}
      setRecurFrequency={drawer.setRecurFrequency}
      recurUnit={drawer.recurUnit}
      setRecurUnit={drawer.setRecurUnit}
      recurDays={drawer.recurDays}
      setRecurDays={drawer.setRecurDays}
      recurEndDate={drawer.recurEndDate}
      setRecurEndDate={drawer.setRecurEndDate}
      recurConfirmed={drawer.recurConfirmed}
      setRecurConfirmed={drawer.setRecurConfirmed}
      time={drawer.time}
      setTime={drawer.setTime}
      openSections={drawer.openSections}
      setSectionOpen={drawer.setSectionOpen}
      customTime={drawer.customTime}
      setCustomTime={drawer.setCustomTime}
      timeBtnRef={drawer.timeBtnRef}
      timezoneLabel={timezoneLabel}
      requireRsvp={drawer.requireRsvp}
      setRequireRsvp={drawer.setRequireRsvp}
      memberInstructionRef={drawer.memberInstructionRef}
      staffInstructionRef={drawer.staffInstructionRef}
    />
  );
}
