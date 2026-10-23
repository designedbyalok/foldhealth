import { Button } from '../../../../../../components/Button/Button';
import { OutreachIcon } from '../../../../../../components/Icon/OutreachIcon';
import { ScheduleDrawer } from '../../../../../../components/ScheduleDrawer/ScheduleDrawer';
import { AddTaskDrawer } from '../../../../../tasks/AddTaskDrawer';
import { useOutreachTab } from './useOutreachTab';
import { OutreachComposer } from '../OutreachComposer/OutreachComposer';
import { OutreachTabActivity } from './OutreachTabActivity';
import styles from './OutreachTab.module.css';


export function OutreachTab(props) {
  const {
    programsLabel = 'Select Programs/Gaps',
    hideLogForRow = false,
    hideActivity = false,
    ...hookProps
  } = props;

  const tab = useOutreachTab({ ...hookProps, hideLogForRow, programsLabel });

  return (
    <OutreachTabView
      tab={tab}
      programsLabel={programsLabel}
      hideLogForRow={hideLogForRow}
      hideActivity={hideActivity}
      taskMember={hookProps.memberName}
    />
  );
}

/**
 * Renders an Outreach tab from an externally owned `useOutreachTab` state,
 * so a host (e.g. the Care Gap drawer) can show the form in one place and
 * the activity list in another while both read the same log.
 *   hideForm        : omit the form slot entirely (form is open elsewhere)
 *   hideFormFooter  : drop the in-form Save / Discard (host owns them)
 *   flush           : no outer padding or card chrome (host frames the form)
 *   taskMember      : patient name prefilled in the Actions > Add Task drawer
 *   schedulePatient : patient object prefilled in Actions > Schedule Appointment
 *                     (for hosts whose member ids aren't in the patients table)
 *   onTaskCreated / onAppointmentScheduled : let the host log what the
 *                     Actions row created
 *   onLogNew        : replaces the inline form when "Log New Outreach" is
 *                     clicked (host opens its own outreach workspace)
 */
export function OutreachTabView({
  tab,
  programsLabel = 'Select Programs/Gaps',
  hideLogForRow = false,
  hideActivity = false,
  hideForm = false,
  hideFormFooter = false,
  flush = false,
  taskMember,
  schedulePatient,
  onTaskCreated,
  onAppointmentScheduled,
  onLogNew,
}) {
  return (
    <div className={`${styles.wrapper} ${flush ? styles.wrapperFlush : ''}`}>
      {hideForm ? null : !tab.formOpen && !tab.scopedProgram ? (
        <div className={styles.emptyCard}>
          <Button
            variant="alt"
            size="L"
            leadingIconElement={<OutreachIcon size={16} color="var(--primary-300)" />}
            onClick={() => {
              // A host with its own outreach workspace (Care Gap drawer's
              // left pane) takes over; otherwise the form opens inline.
              if (onLogNew) { onLogNew(); return; }
              tab.setDatetime(tab.formatNow());
              tab.setFormOpen(true);
            }}
          >
            Log New Outreach
          </Button>
        </div>
      ) : (
        <OutreachComposer
          hideLogForRow={hideLogForRow}
          scopedProgram={tab.scopedProgram}
          logFor={tab.logFor}
          isHccGaps={tab.isHccGaps}
          type={tab.type}
          setType={tab.setType}
          contactWarning={tab.contactWarning}
          datetime={tab.datetime}
          setDatetime={tab.setDatetime}
          showCallDetails={tab.showCallDetails}
          callBannerVisible={tab.callBannerVisible}
          setCallBannerVisible={tab.setCallBannerVisible}
          callDirection={tab.callDirection}
          setCallDirection={tab.setCallDirection}
          callViaNumber={tab.callViaNumber}
          setCallViaNumber={tab.setCallViaNumber}
          calledToNumber={tab.calledToNumber}
          setCalledToNumber={tab.setCalledToNumber}
          callType={tab.callType}
          setCallType={tab.setCallType}
          callDurationMin={tab.callDurationMin}
          setCallDurationMin={tab.setCallDurationMin}
          callDurationSec={tab.callDurationSec}
          setCallDurationSec={tab.setCallDurationSec}
          CALLED_TO_OPTIONS={tab.CALLED_TO_OPTIONS}
          programsLabel={tab.isHccGaps ? 'Select HCC Gaps' : programsLabel}
          PROGRAM_OPTIONS={tab.isHccGaps ? tab.HCC_GAP_OPTIONS : tab.PROGRAM_OPTIONS}
          selectedProgs={tab.selectedProgs}
          toggleProgram={tab.toggleProgram}
          outcome={tab.outcome}
          setOutcome={tab.setOutcome}
          separateNotes={tab.separateNotes}
          setSeparateNotes={tab.setSeparateNotes}
          useSeparate={tab.useSeparate}
          getPanel={tab.getPanel}
          patchPanel={tab.patchPanel}
          patchShared={tab.patchShared}
          toggleSyncText={tab.toggleSyncText}
          sharedPanel={tab.sharedPanel}
          sharedPanelTitle={tab.sharedPanelTitle}
          addOutcome={tab.addOutcome}
          removeOutcome={tab.removeOutcome}
          handleNoteChange={tab.handleNoteChange}
          canSave={tab.canSave}
          handleLogForChange={tab.handleLogForChange}
          handleSave={tab.handleSave}
          handleDiscard={tab.handleDiscard}
          onAddTask={() => tab.setAddTaskOpen(true)}
          onSchedule={() => tab.setScheduleOpen(true)}
          hideFooter={hideFormFooter}
        />
      )}

      {!hideActivity && (
        <OutreachTabActivity
          activityFilter={tab.activityFilter}
          setActivityFilter={tab.setActivityFilter}
          activitySearchOpen={tab.activitySearchOpen}
          setActivitySearchOpen={tab.setActivitySearchOpen}
          activitySearchText={tab.activitySearchText}
          setActivitySearchText={tab.setActivitySearchText}
          outreachScope={tab.outreachScope}
          setOutreachScope={tab.setOutreachScope}
          filterMenu={tab.filterMenu}
          setFilterMenu={tab.setFilterMenu}
          logGroups={tab.logGroups}
          filteredLogGroups={tab.filteredLogGroups}
          onEdit={tab.handleEdit}
          onDelete={tab.handleDelete}
        />
      )}

      {tab.addTaskOpen && (
        <AddTaskDrawer
          initialMember={taskMember}
          onClose={() => tab.setAddTaskOpen(false)}
          onTaskCreated={task => {
            if (tab.scopedProgram) tab.addProgramTask(tab.scopedProgram, task);
            onTaskCreated?.(task);
            tab.setAddTaskOpen(false);
          }}
        />
      )}
      {tab.scheduleOpen && (
        <ScheduleDrawer
          initialPatientId={tab.patientId}
          initialSelectedPatient={schedulePatient}
          patientLocked={!!schedulePatient}
          source="outreach"
          onClose={() => tab.setScheduleOpen(false)}
          onSave={row => {
            if (row) onAppointmentScheduled?.(row);
            if (!tab.scopedProgram || !row) return;
            tab.addProgramAppointment(tab.scopedProgram, {
              id: `appt-${Date.now()}`,
              title: row.appointment_type_name || 'Appointment',
              subtitle: row.reason_for_visit || row.mode || '',
              type: 'Appointment',
              programCode: tab.scopedProgram,
              date: row.date || '',
              time: row.time_start || '',
              assignee: row.primary_user || 'Unassigned',
              recurring: !!row.recurring,
            });
          }}
        />
      )}
    </div>
  );
}
