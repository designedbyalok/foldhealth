import { useEffect, useMemo } from 'react';
import { Drawer } from '../../../../../../components/Drawer/Drawer';
import { CardSkeleton } from '../../../../../../components/CardSkeleton/CardSkeleton';
import { EmptyState } from '../../../../../../components/EmptyState/EmptyState';
import { ChronicConditionSelect } from '../../../../../settings/care-plan-library/shared/ChronicConditionSelect/ChronicConditionSelect';
import { useAppStore } from '../../../../../../store/useAppStore';
import { toast } from '../../../../../../components/Toast/sonnerToast';
import { HistoryTable, HistoryDelete, HISTORY_ACTIONS_COLUMN, historyRowClass, historyCellClass } from '../HistoryTable';
import styles from '../AddProblemsDrawer/AddProblemsDrawer.module.css';

const KIND = 'medical';

const MEDICAL_COLUMNS = [
  { key: 'name', label: 'Name' },
  HISTORY_ACTIONS_COLUMN,
];

// Newest-added first, so the row just picked lands at the top, beside the
// search it came from.
const byAddedDesc = (a, b) => (b.createdAt || '').localeCompare(a.createdAt || '');

const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** One condition, with its delete in the Actions column. */
function ConditionRow({ entry, onRemove }) {
  return (
    <tr className={historyRowClass}>
      <td className={historyCellClass}>{entry.title}</td>
      <td className={historyCellClass}>
        <HistoryDelete name={entry.title} onRemove={() => onRemove(entry)} />
      </td>
    </tr>
  );
}

/**
 * Add Medical History: past conditions, picked from the same NLM conditions
 * lookup as Problems (chronic conditions). Picking one adds its row straight
 * away; there is nothing else to fill in, so the table is just Name and a
 * remove action.
 *
 * @param {string}   props.patientId
 * @param {function} props.onClose
 */
export function AddMedicalHistoryDrawer({ patientId, onClose }) {
  const records = useAppStore(s => (patientId ? s.patientPamiRecords[patientId] : null));
  const loadedFor = useAppStore(s => (patientId ? s.patientPamiRecordsLoadedFor[patientId] : false));
  const fetchPatientPamiRecords = useAppStore(s => s.fetchPatientPamiRecords);
  const addPatientHistoryEntry = useAppStore(s => s.addPatientHistoryEntry);
  const removePatientHistoryEntry = useAppStore(s => s.removePatientHistoryEntry);

  useEffect(() => {
    if (patientId) fetchPatientPamiRecords(patientId);
  }, [patientId, fetchPatientPamiRecords]);

  const loading = !!patientId && !loadedFor;
  const conditions = useMemo(
    () => (records?.history || []).filter(h => h.kind === KIND).sort(byAddedDesc),
    [records],
  );

  const add = async (name) => {
    if (!name) return;
    if (conditions.some(c => sameName(c.title, name))) {
      toast.info('Already in Medical History');
      return;
    }
    const ok = await addPatientHistoryEntry(patientId, KIND, { title: name });
    if (ok) toast.success('Medical History Added');
  };

  const remove = (entry) => removePatientHistoryEntry(patientId, entry.id);

  return (
    <Drawer title="Add Medical History" onClose={onClose}>
      <div className={styles.body}>
        <div className={styles.addBlock}>
          <span className={styles.addLabel}>Add New Medical History</span>
          {/* Always empty: each pick becomes a row, and the search is ready
              for the next one. */}
          <ChronicConditionSelect
            label=""
            multiple={false}
            leadingIcon="solar:magnifer-linear"
            placeholder="Search And Add Medical History"
            value=""
            onChange={add}
          />
        </div>

        {loading ? (
          <CardSkeleton rows={3} />
        ) : conditions.length === 0 ? (
          <div className={styles.emptyCard}>
            <EmptyState icon="custom:medical-history" title="No Medical History" iconSize={31} />
          </div>
        ) : (
          <HistoryTable
            label="Medical history"
            columns={MEDICAL_COLUMNS}
            rows={conditions}
            renderRow={entry => <ConditionRow key={entry.id} entry={entry} onRemove={remove} />}
          />
        )}
      </div>
    </Drawer>
  );
}
