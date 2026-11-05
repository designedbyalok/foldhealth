import { useEffect, useMemo, useState } from 'react';
import { Drawer } from '../../../../../../components/Drawer/Drawer';
import { Input } from '../../../../../../components/Input/Input';
import { CardSkeleton } from '../../../../../../components/CardSkeleton/CardSkeleton';
import { EmptyState } from '../../../../../../components/EmptyState/EmptyState';
import { useAppStore } from '../../../../../../store/useAppStore';
import { toast } from '../../../../../../components/Toast/sonnerToast';
import { todayIso, toIsoDate, isFutureDate } from '../../../../../../lib/clinicalDates';
import { ProcedureSelect } from './ProcedureSelect';
import { HistoryTable, HistoryDelete, HISTORY_ACTIONS_COLUMN, historyRowClass, historyCellClass } from '../HistoryTable';
import styles from '../AddProblemsDrawer/AddProblemsDrawer.module.css';

const KIND = 'surgical';

const SURGICAL_COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'performedOn', label: 'Performed Date', width: 200 },
  HISTORY_ACTIONS_COLUMN,
];

// Newest-added first, so the row just picked lands at the top, beside the
// search it came from. Ordering by performed date instead would make a row
// jump the moment its date was filled in.
const byAddedDesc = (a, b) => (b.createdAt || '').localeCompare(a.createdAt || '');

/**
 * One surgery. The performed date is edited in place and saves as soon as a
 * complete date is entered (the Input only reports full dates), so there is
 * no Save step per row.
 */
function SurgeryRow({ entry, others, onDateChange, onRemove }) {
  const [value, setValue] = useState(toIsoDate(entry.recordedOn));
  const [error, setError] = useState('');

  const change = async (iso) => {
    setValue(iso);
    if (iso && isFutureDate(iso)) { setError('Performed date cannot be in the future'); return; }
    // The same surgery can happen twice (two C-sections, a staged knee
    // replacement), so only the same procedure on the same day is a duplicate.
    const clash = iso && others.some(o => o.recordedOn === iso
      && ((entry.code && o.code === entry.code)
        || o.title.trim().toLowerCase() === entry.title.trim().toLowerCase()));
    if (clash) { setError('Already recorded for this date'); return; }
    setError('');
    const ok = await onDateChange(entry, iso);
    if (!ok) setValue(toIsoDate(entry.recordedOn));
  };

  return (
    <tr className={historyRowClass}>
      <td className={historyCellClass}>{entry.title}</td>
      <td className={historyCellClass}>
        <Input
          type="date"
          aria-label={`Performed date for ${entry.title}`}
          placeholder="Performed Date"
          value={value}
          max={todayIso()}
          onChange={e => change(e.target.value)}
          errorText={error || undefined}
        />
      </td>
      <td className={historyCellClass}>
        <HistoryDelete name={entry.title} onRemove={() => onRemove(entry)} />
      </td>
    </tr>
  );
}

/**
 * Add Surgical History: a Name / Performed Date table. Picking a procedure
 * from the search adds its row straight away; the date is then filled in on
 * the row. Procedures come from the NLM procedure list, so each row carries
 * its key.
 *
 * @param {string}   props.patientId
 * @param {function} props.onClose
 */
export function AddSurgicalHistoryDrawer({ patientId, onClose }) {
  const records = useAppStore(s => (patientId ? s.patientPamiRecords[patientId] : null));
  const loadedFor = useAppStore(s => (patientId ? s.patientPamiRecordsLoadedFor[patientId] : false));
  const fetchPatientPamiRecords = useAppStore(s => s.fetchPatientPamiRecords);
  const addPatientHistoryEntry = useAppStore(s => s.addPatientHistoryEntry);
  const updatePatientHistoryEntry = useAppStore(s => s.updatePatientHistoryEntry);
  const removePatientHistoryEntry = useAppStore(s => s.removePatientHistoryEntry);

  useEffect(() => {
    if (patientId) fetchPatientPamiRecords(patientId);
  }, [patientId, fetchPatientPamiRecords]);

  const loading = !!patientId && !loadedFor;
  const surgeries = useMemo(
    () => (records?.history || []).filter(h => h.kind === KIND).sort(byAddedDesc),
    [records],
  );

  const add = async (concept) => {
    const ok = await addPatientHistoryEntry(patientId, KIND, {
      title: concept.display,
      code: concept.code,
      codeSystem: concept.system,
    });
    if (ok) toast.success('Surgical history added successfully');
  };

  const setDate = (entry, iso) => updatePatientHistoryEntry(patientId, entry.id, { recordedOn: iso });
  const remove = (entry) => removePatientHistoryEntry(patientId, entry.id);

  return (
    <Drawer title="Add Surgical History" onClose={onClose}>
      <div className={styles.body}>
        <div className={styles.addBlock}>
          <span className={styles.addLabel}>Add New Surgical History</span>
          {/* Always empty: each pick becomes a row, and the search is ready
              for the next one. */}
          <ProcedureSelect leadingIcon="solar:magnifer-linear" value="" onChange={add} />
        </div>

        {loading ? (
          <CardSkeleton rows={3} />
        ) : surgeries.length === 0 ? (
          <div className={styles.emptyCard}>
            <EmptyState icon="custom:scalpel" title="No Surgical History" iconSize={31} />
          </div>
        ) : (
          <HistoryTable
            label="Surgical history"
            columns={SURGICAL_COLUMNS}
            rows={surgeries}
            renderRow={entry => (
              <SurgeryRow
                key={entry.id}
                entry={entry}
                others={surgeries.filter(s => s.id !== entry.id)}
                onDateChange={setDate}
                onRemove={remove}
              />
            )}
          />
        )}
      </div>
    </Drawer>
  );
}
