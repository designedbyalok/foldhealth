import { useEffect, useState } from 'react';
import { Icon } from '../../../../../../components/Icon/Icon';
import { useAppStore } from '../../../../../../store/useAppStore';
import { programUrlKey } from '../../care-programs/CareProgramsTab/CareProgramsTab.utils';
import { ActionButton } from '../../../../../../components/ActionButton/ActionButton';
import { HealthMapWidget } from '../../../../shared/widgets/HealthMapWidget/HealthMapWidget.jsx';
import { ProgressRing } from '../../../../../hcc/DiagPanel/ReviewProgressPopover';
import { AppointmentsDrawer } from '../AppointmentsDrawer/AppointmentsDrawer.jsx';
import { PATIENT_SYNOPSIS, RECENT_NOTES, UPCOMING_APPOINTMENTS, CARE_PLAN_RECOMMENDATIONS } from '../../../../data/overviewMock';
import styles from './OverviewTab.module.css';

function SectionHeader({ title, onAdd, viewAll, viewByDropdown, onViewAll }) {
  return (
    <div className={styles.sectionHeader}>
      <span className={styles.sectionTitle}>{title}</span>
      <div className={styles.sectionActions}>
        {viewByDropdown && (
          <button className={styles.viewAllLink} style={{ color: 'var(--neutral-300)' }}>
            View By: Upcoming <Icon name="solar:alt-arrow-down-linear" size={14} color="var(--neutral-300)" />
          </button>
        )}
        {onAdd && <ActionButton icon="solar:add-circle-linear" size="S" tooltip="Add" onClick={onAdd} />}
        {viewAll && (
          <>
            <span className={styles.actionDivider} />
            <button className={styles.viewAllLink} onClick={onViewAll}>View All <Icon name="solar:alt-arrow-right-linear" size={14} color="var(--primary-300)" /></button>
          </>
        )}
      </div>
    </div>
  );
}

function PatientSynopsis() {
  return (
    <div className={styles.card}>
      <div className={styles.synopsisHeader}>
        <Icon name="solar:stars-minimalistic-linear" size={16} color="var(--primary-300)" />
        <span className={styles.synopsisLabel}>Patient Synopsis</span>
      </div>
      <div className={styles.synopsisBody}>
        <div className={styles.synopsisLeft}>
          <div className={styles.templateRow}>
            <button className={styles.templateDropdown}>
              Diabetes Standard Template <Icon name="solar:alt-arrow-down-linear" size={10} color="var(--neutral-300)" />
            </button>
            <div className={styles.synopsisActions}>
              <ActionButton icon="solar:clipboard-linear" size="S" tooltip="Copy" />
              <ActionButton icon="solar:refresh-linear" size="S" tooltip="Re-Generate" />
              <ActionButton icon="solar:dislike-linear" size="S" tooltip="Dislike" />
              <ActionButton icon="solar:like-linear" size="S" tooltip="Like" />
            </div>
          </div>
          <p className={styles.synopsisText}>{PATIENT_SYNOPSIS}</p>
          <div className={styles.synopsisFooter}>
            <span>Last Generated on: 11/09/2025, 2:30 PM &bull; Dr. Michael Chen</span>
            <span className={styles.internalBadge}><Icon name="solar:lock-linear" size={10} color="var(--neutral-200)" /> Internal Use Only</span>
          </div>
          <div className={styles.feedbackRow}>
            <span>Are these Synopsis useful?</span>
            <ActionButton icon="solar:like-linear" size="S" tooltip="Yes" />
            <ActionButton icon="solar:dislike-linear" size="S" tooltip="No" />
            <ActionButton icon="solar:clipboard-linear" size="S" tooltip="Copy" />
            <ActionButton icon="solar:share-linear" size="S" tooltip="Share" />
          </div>
        </div>
        <div className={styles.synopsisRight}>
          <HealthMapWidget compact />
        </div>
      </div>
    </div>
  );
}

function RecentNotesTable() {
  return (
    <div className={styles.card}>
      <SectionHeader title="Recent Notes" onAdd={() => {}} viewAll />
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th></th>
              <th>Note Title</th>
              <th>Status</th>
              <th>Created By</th>
              <th>Last Updated</th>
              <th>Template Name</th>
            </tr>
          </thead>
          <tbody>
            {RECENT_NOTES.slice(0, 3).map(note => (
              <tr key={note.id}>
                <td><input type="checkbox" className={styles.checkbox} aria-label={`Select ${note.title}`} /></td>
                <td>
                  <div className={styles.noteTitle}>{note.title}</div>
                  <div className={styles.noteSub}>{note.subtitle}</div>
                </td>
                <td><span style={{ color: note.statusColor }}>{note.status}</span></td>
                <td>
                  <div>{note.createdBy}</div>
                  <div className={styles.dateText}>{note.createdDate}</div>
                </td>
                <td>
                  <div>{note.updatedBy}</div>
                  <div className={styles.dateText}>{note.updatedDate}</div>
                </td>
                <td>{note.template}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ActiveCareProgramsTable() {
  const patientId = useAppStore(s => s.selectedPatientId);
  const careProgramsByPatient = useAppStore(s => s.careProgramsByPatient);
  const fetchCareProgramsForPatient = useAppStore(s => s.fetchCareProgramsForPatient);
  const setPatientProfileTab = useAppStore(s => s.setPatientProfileTab);
  const openCareProgram = useAppStore(s => s.openCareProgram);

  useEffect(() => {
    if (patientId) fetchCareProgramsForPatient(patientId);
  }, [patientId, fetchCareProgramsForPatient]);

  // Active = every enrollment that isn't closed. Show the first few here; the
  // full list lives on the Care Programs tab.
  const programs = (careProgramsByPatient[patientId] || []).filter(p => p.status !== 'Closed');

  const goToCarePrograms = () => setPatientProfileTab('Care Programs');
  const openProgram = (prog) => {
    setPatientProfileTab('Care Programs');
    openCareProgram(programUrlKey(prog));
  };

  return (
    <div className={styles.card}>
      <SectionHeader title="Active Care Programs" onAdd={goToCarePrograms} viewAll onViewAll={goToCarePrograms} />
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th></th>
              <th>Program Name</th>
              <th>Status</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Last Updated</th>
              <th>Assignee</th>
              <th>PCP</th>
            </tr>
          </thead>
          <tbody>
            {programs.length === 0 ? (
              <tr><td colSpan={8} className={styles.emptyCell}>No active care programs.</td></tr>
            ) : programs.slice(0, 3).map(prog => (
              <tr key={prog.id} className={styles.clickableRow} onClick={() => openProgram(prog)}>
                <td onClick={e => e.stopPropagation()}><input type="checkbox" className={styles.checkbox} aria-label={`Select ${prog.name}`} /></td>
                <td>
                  <div className={styles.progressCell}>
                    <ProgressRing progress={prog.progress || 0} size={16} stroke={2} />
                    <button type="button" className={styles.programLink} onClick={(e) => { e.stopPropagation(); openProgram(prog); }}>{prog.name}</button>
                  </div>
                </td>
                <td><span style={{ color: prog.statusColor || 'var(--neutral-300)' }}>{prog.status}</span></td>
                <td>{prog.startDate}</td>
                <td>{prog.endDate}</td>
                <td>{prog.lastUpdated}</td>
                <td>{prog.assignee}</td>
                <td>{prog.pcp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UpcomingAppointmentsTable({ onViewAll }) {
  return (
    <div className={styles.card}>
      <SectionHeader title="Upcoming Appointments & Reminders" viewByDropdown onAdd={() => {}} viewAll onViewAll={onViewAll} />
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th></th>
              <th>Title</th>
              <th>Type</th>
              <th>Date & Time</th>
              <th>Assignee</th>
              <th>Created By</th>
            </tr>
          </thead>
          <tbody>
            {UPCOMING_APPOINTMENTS.slice(0, 3).map(appt => (
              <tr key={appt.id}>
                <td><input type="checkbox" className={styles.checkbox} aria-label={`Select ${appt.title}`} /></td>
                <td>
                  <div className={styles.noteTitle}>{appt.title}</div>
                  <div className={styles.noteSub}>{appt.subtitle}</div>
                </td>
                <td>{appt.type}</td>
                <td>
                  <div>{appt.date}</div>
                  <div className={styles.dateText}>{appt.time}</div>
                </td>
                <td>{appt.assignee}</td>
                <td>
                  <div>{appt.createdBy}</div>
                  <div className={styles.dateText}>{appt.createdDate}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CareRecommendations() {
  return (
    <div className={styles.card}>
      <div className={styles.recHeader}>
        <span className={styles.recTitle}>Care Plan Recommendations</span>
        <button className={styles.costLink}>
          View Cost Projection <Icon name="solar:alt-arrow-right-linear" size={14} color="var(--primary-300)" />
        </button>
      </div>
      <div className={styles.recList}>
        {CARE_PLAN_RECOMMENDATIONS.slice(0, 3).map(rec => (
          <div key={rec.step} className={styles.recItem}>
            <span className={styles.stepBadge}>Step {rec.step}</span>
            <div className={styles.recBody}>
              <span className={styles.recItemTitle}>{rec.title}</span>
              <span className={styles.recConditions}>Conditions Addressed: {rec.conditions}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OverviewTab() {
  const [showAppointments, setShowAppointments] = useState(false);

  return (
    <div className={styles.overview}>
      <PatientSynopsis />
      <RecentNotesTable />
      <ActiveCareProgramsTable />
      <UpcomingAppointmentsTable onViewAll={() => setShowAppointments(true)} />
      <CareRecommendations />
      {showAppointments && <AppointmentsDrawer onClose={() => setShowAppointments(false)} />}
    </div>
  );
}


