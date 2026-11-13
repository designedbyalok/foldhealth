import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../components/Icon/Icon';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { FilterChip } from '../../components/FilterChip/FilterChip';
import { DobFilter } from '../../components/DobFilter/DobFilter';
import { DateRangePopover } from '../../components/DateRangePopover/DateRangePopover';
import { fmtDay } from '../../components/DateRangeFilter/dateRangePresets';
import { WORKLIST_FILTERS, filterOptions, passes, rowFacts } from './worklistFilters';
import { useAppStore } from '../../store/useAppStore';
import {
  matchTaskAssignee, normName, resolvePatientId, useMyWorklistPatients,
} from './useMyWorklistPatients';
import { TaskDetailDrawer } from '../tasks/TaskDetailDrawer';
import { HomeWidgetEmpty } from './HomeWidgetEmpty';
import { MyWorklistTable } from './MyWorklistTable';
import styles from './HomeView.module.css';

export function AlertsMonitoringCard({ dragHandleClassName }) {
  const patients = useAppStore(s => s.patients);
  const tasks = useAppStore(s => s.tasks);
  const allPatients = useAppStore(s => s.allPatients) || [];
  const fetchAllPatients = useAppStore(s => s.fetchAllPatients);
  const openQuickView = useAppStore(s => s.openQuickView);
  const patientsError = useAppStore(s => s.patientsError);
  const [selectedTask, setSelectedTask] = useState(null);
  // all_patients is ~100 KB and is only used to resolve a row click onto a
  // profile id, so it loads on click, not on every Home visit.
  // Filter row (the funnel): Covering narrows the list to the patients of
  // the picked out-of-office people's open tasks.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [covering, setCovering] = useState([]);
  const { rows: allRows, loading, meId, meName, coveringFor } = useMyWorklistPatients({ covering });
  // The worklist filters (appointments, tasks, profile), value per key.
  const appointments = useAppStore(s => s.appointments);
  const fetchAppointments = useAppStore(s => s.fetchAppointments);
  useEffect(() => { if (filtersOpen && !appointments?.length) fetchAppointments?.(); }, [filtersOpen, appointments, fetchAppointments]);
  const [values, setValues] = useState({});
  const setValue = (key, v) => setValues(cur => ({ ...cur, [key]: v }));
  const facts = useMemo(
    () => allRows.map(r => [r, rowFacts(r, { patients, appointments: appointments || [], tasks })]),
    [allRows, patients, appointments, tasks],
  );
  const options = useMemo(() => filterOptions(facts.map(([, f]) => f)), [facts]);
  const items = useMemo(() => facts.filter(([, f]) => passes(f, values)).map(([row, f]) => ({ row, facts: f })), [facts, values]);
  const anySet = covering.length > 0 || Object.values(values).some(v => v?.length);

  const handleRowClick = async (row) => {
    let patientId = resolvePatientId(row, patients, allPatients);
    if (!patientId) {
      await fetchAllPatients?.();
      const st = useAppStore.getState();
      patientId = resolvePatientId(row, st.patients, st.allPatients || []);
    }
    openQuickView({
      id: patientId || row.id || row.key,
      name: row.name,
      initials: row.initials,
      gender: row.gender,
      age: row.age,
      dob: row.dob,
      memberId: row.memberId,
    });
  };

  const openMyTask = (row) => {
    const match = tasks.find(t =>
      t.status !== 'completed'
      && matchTaskAssignee(t, meId, meName)
      && normName(t.member) === normName(row.name),
    );
    if (match) setSelectedTask(match);
  };

  return (
    <>
      <div className={styles.card}>
        <div className={[styles.cardHeader, dragHandleClassName].filter(Boolean).join(' ')}>
          <div className={styles.cardTitle}>
            <Icon name="solar:clipboard-list-linear" size={14} color="var(--primary-300)" />
            My Worklist
          </div>
          <div className={styles.cardActions}>
            <ActionButton icon="solar:user-linear" size="sm" tooltip="Assigned to me" />
            <ActionButton icon="solar:hamburger-menu-linear" size="sm" tooltip="List view" />
            <ActionButton
              icon="custom:filter"
              size="sm"
              tooltip="Filter"
              tooltipLeft
              aria-pressed={filtersOpen || anySet}
              className={filtersOpen || anySet ? styles.actionOn : undefined}
              onClick={() => setFiltersOpen(v => !v)}
            />
          </div>
        </div>
        {(filtersOpen || anySet) && (
          <div className={styles.cardFilters}>
            {coveringFor.length > 0 && (
              <FilterChip
                label="Covering for"
                options={coveringFor}
                selected={covering}
                onChange={setCovering}
                searchable={coveringFor.length > 8}
              />
            )}
            {WORKLIST_FILTERS.map((f) => {
              const v = values[f.key] || [];
              if (f.type === 'dob') return <DobFilter key={f.key} value={v} onChange={(next) => setValue(f.key, next)} />;
              if (f.type === 'date') {
                return (
                  <FilterChip
                    key={f.key}
                    label={f.label}
                    active={v.length >= 2}
                    activeSummary={v.length >= 2 ? `${fmtDay(v[0])} – ${fmtDay(v[1])}` : undefined}
                    onClear={() => setValue(f.key, [])}
                    renderPopover={({ anchorRect, onClose }) => (
                      <DateRangePopover anchorRect={anchorRect} label={f.label} selected={v} onChange={(next) => setValue(f.key, next)} onClose={onClose} />
                    )}
                  />
                );
              }
              return (
                <FilterChip
                  key={f.key}
                  label={f.label}
                  options={options[f.key] || []}
                  selected={v}
                  onChange={(next) => setValue(f.key, next)}
                  searchable={(options[f.key] || []).length > 8}
                />
              );
            })}
            {anySet && (
              <button type="button" className={styles.cardFiltersClear} onClick={() => { setValues({}); setCovering([]); }}>
                Clear All
              </button>
            )}
          </div>
        )}
        {patientsError && !loading ? (
          <div className={styles.errorState}>Failed to load patients</div>
        ) : (
          <MyWorklistTable
            items={items}
            meName={meName}
            loading={loading}
            onOpen={handleRowClick}
            onOpenTask={openMyTask}
            emptyState={anySet ? (
              <HomeWidgetEmpty icon="solar:filter-linear" title="No patients match these filters" description="Change or clear the filters to see more." />
            ) : (
              <HomeWidgetEmpty icon="solar:clipboard-list-linear" title="Your worklist is clear" description="Patients assigned to you from SNP, HCC, and other worklists will appear here." />
            )}
          />
        )}
      </div>

      {selectedTask && (
        <TaskDetailDrawer
          task={tasks.find(t => t.id === selectedTask.id) || selectedTask}
          onClose={() => setSelectedTask(null)}
          onSelectTask={setSelectedTask}
        />
      )}
    </>
  );
}
