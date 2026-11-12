import { PatientTasksTab } from '../patient/left-panel/tabs/tasks/PatientTasksTab/PatientTasksTab';
import { useCallPatient } from './useCallPatient';
import styles from './LiveCallOverlay.module.css';

/** Patient Tasks tab: the chart's own tasks tab for the call's patient (search, filters, Add Task). */
export function CallTasksTab({ patient }) {
  const { record } = useCallPatient(patient);
  return (
    <div className={styles.tabScroll}>
      <PatientTasksTab patient={record} />
    </div>
  );
}
