import { useMemo } from 'react';
import { CarePlanHeader } from '../../care-programs/care-plan/CarePlanHeader/CarePlanHeader';
import { CarePlanView } from '../../care-programs/care-plan/CarePlanView/CarePlanView';
import { patientLevelProgram } from '../../care-programs/care-plan/lib/carePlanMode';
import pdStyles from '../../care-programs/program-detail/ProgramDetailView/ProgramDetailView.module.css';
import toolbarStyles from '../CareManagementToolbar/CareManagementToolbar.module.css';
import styles from './PatientCarePlanPane.module.css';

/**
 * Care Management > Care Plan for orgs that plan at patient level only: the
 * same care plan a program's Care Plan step shows (templates, sign / review,
 * versions, notes, download), kept under the patient's own PATIENT program.
 * Search and filter live in the plan header, so the toolbar row carries just
 * the sub-tabs.
 *
 * Also renders a program's care plan opened as its own panel in the split
 * layout: pass that `program` (defaults to the patient-level plan) and
 * `inPanel`, which the header uses to offer "Show in Program".
 */
export function PatientCarePlanPane({ header, patientId, program: programProp, inPanel = false }) {
  const patientProgram = useMemo(() => (patientId ? patientLevelProgram(patientId) : null), [patientId]);
  const program = programProp || patientProgram;
  return (
    <div className={styles.pane}>
      {/* No sub-tabs when the plan is a panel of its own (split layout). */}
      {header && (
        <div className={toolbarStyles.subTabBar}>
          <div className={toolbarStyles.subTabs}>{header}</div>
        </div>
      )}
      {program && (
        <div className={styles.card}>
          <div className={`${pdStyles.contentHeader} ${pdStyles.contentHeaderCarePlan}`}>
            <div className={`${pdStyles.contentHeaderRow} ${pdStyles.contentHeaderRowCarePlan}`}>
              <CarePlanHeader patientId={patientId} program={program} inPanel={inPanel} />
            </div>
          </div>
          <CarePlanView patientId={patientId} program={program} />
        </div>
      )}
    </div>
  );
}
