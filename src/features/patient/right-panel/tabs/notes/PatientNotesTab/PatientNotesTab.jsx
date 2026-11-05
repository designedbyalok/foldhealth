import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../../../../../store/useAppStore';
import { ActionButton } from '../../../../../../components/ActionButton/ActionButton';
import { Button } from '../../../../../../components/Button/Button';
import { FilterBar } from '../../../../../worklists/FilterBar';
import { Input } from '../../../../../../components/Input/Input';
import { SimpleTableSkeleton } from '../../../../../../components/SimpleTableSkeleton/SimpleTableSkeleton';
import { Tabs } from '../../../../../../components/Tabs/Tabs';
import { useTableSort } from '../../../../../../components/HeaderCell/useTableSort';
import { TaskDetailDrawer } from '../../../../../tasks/TaskDetailDrawer';
import { NonVisitNoteDrawer } from './NonVisitNoteDrawer';
import { InlineNoteView } from './InlineNoteView';
import { NotesTable } from './NotesTable';
import { TodayAppointmentBanner } from './TodayAppointmentBanner';
import { useTodayAppointment } from './useTodayAppointment';
import { VIEWS, applyFilters, buildNoteRow, filterDefsFor, matchesQuery } from './noteRows';
import styles from './PatientNotesTab.module.css';

const VIEW_TABS = VIEWS.map(({ key, label }) => ({ key, label }));
const EMPTY_FILTERS = {};

/**
 * Every id a patient's notes may be filed under: the deep-link id, the
 * patients-slice id, the fold memberId, and the HEDIS worklist id that
 * Care Gap notes are written with. There's no FK from
 * clinical_notes.patient_id to patients.id yet, so all are scanned.
 */
function usePatientNoteIds(patient) {
  const selectedPatientId = useAppStore(s => s.selectedPatientId);
  const hedisMembers = useAppStore(s => s.hedisMembers);
  const memberIdStr = patient?.memberId != null ? String(patient.memberId) : null;
  const hedisMemberId = useMemo(() => hedisMembers?.find(m => (
    m.id === selectedPatientId || m.id === patient?.id || (memberIdStr && String(m.memberId) === memberIdStr)
  ))?.id || null, [hedisMembers, selectedPatientId, patient?.id, memberIdStr]);
  const key = [...new Set([selectedPatientId, patient?.id, memberIdStr, hedisMemberId].filter(Boolean))].join('|');
  return useMemo(() => (key ? key.split('|') : []), [key]);
}

/** The patient's clinical notes as table rows, and whether the first fetch is still out. */
function usePatientNoteRows(ids) {
  const byPatient = useAppStore(s => s.clinicalNotesByPatient);
  const byMember = useAppStore(s => s.clinicalNotesByMember);
  const fetchForPatient = useAppStore(s => s.fetchClinicalNotesForPatient);
  const fetchForMember = useAppStore(s => s.fetchClinicalNotesForMember);
  const fetchTasks = useAppStore(s => s.fetchTasks);
  const templatesById = useAppStore(s => s.noteTemplatesById);
  const allTasks = useAppStore(s => s.tasks);
  const [loadedKey, setLoadedKey] = useState(null);
  const key = ids.join('|');

  useEffect(() => {
    let live = true;
    Promise.allSettled(ids.flatMap(id => [fetchForPatient?.(id), fetchForMember?.(id)]))
      .then(() => { if (live) setLoadedKey(key); });
    return () => { live = false; };
  }, [ids, key, fetchForPatient, fetchForMember]);
  useEffect(() => { fetchTasks?.(); }, [fetchTasks]);

  const rows = useMemo(() => {
    const tasksById = new Map((allTasks || []).map(t => [String(t.id), t]));
    const tasksByNote = new Map();
    for (const t of (allTasks || [])) {
      const nid = t.linkedNoteId || t.noteId;
      if (nid) tasksByNote.set(nid, [...(tasksByNote.get(nid) || []), t]);
    }
    const seen = new Set();
    const out = [];
    for (const map of [byPatient, byMember]) {
      for (const id of ids) {
        for (const n of (map?.[id] || [])) {
          if (!seen.has(n.id)) { seen.add(n.id); out.push(buildNoteRow(n, { templatesById, tasksByNote, tasksById })); }
        }
      }
    }
    return out;
  }, [ids, byPatient, byMember, templatesById, allTasks]);

  return { rows, loading: loadedKey !== key && rows.length === 0 };
}

function NotesToolbar({ view, onView, onSearch, onNewNote, filtersOpen, onToggleFilters, filterCount, canFilter }) {
  return (
    <div className={styles.toolbar}>
      <Tabs
        variant="pill"
        className={styles.views}
        items={VIEW_TABS}
        value={view}
        onValueChange={onView}
        leading={(
          <>
            <ActionButton icon="solar:magnifer-linear" tooltip="Search" aria-label="Search notes" onClick={onSearch} />
            <span className={styles.divider} aria-hidden="true" />
          </>
        )}
      />
      <Button variant="soft" leadingIcon="solar:add-circle-linear" onClick={onNewNote}>
        New Note
      </Button>
      <span className={styles.divider} aria-hidden="true" />
      <ActionButton
        icon="custom:filter"
        tooltip="Filters"
        tooltipLeft
        aria-label="Filters"
        active={filtersOpen}
        disabled={!canFilter}
        count={filterCount ? String(filterCount) : undefined}
        onClick={onToggleFilters}
      />
    </div>
  );
}

function SearchRow({ query, onQuery, onClose }) {
  return (
    <div className={`${styles.toolbar} ${styles.searchRow}`}>
      <Input
        autoFocus
        leadingIcon="solar:magnifer-linear"
        placeholder="Search Notes"
        aria-label="Search notes"
        value={query}
        onChange={e => onQuery(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
        trailingAction="solar:close-linear"
        trailingActionLabel="Close search"
        onTrailingAction={onClose}
        wrapperClassName={styles.searchField}
      />
    </div>
  );
}

/**
 * P360 Notes: the patient's clinical notes (Supabase `clinical_notes`),
 * with a prompt to write the visit note for today's appointment. A row
 * opens the note inline.
 */
export function PatientNotesTab({ patient }) {
  const ids = usePatientNoteIds(patient);
  const { rows, loading } = usePatientNoteRows(ids);
  const todayAppointment = useTodayAppointment();
  const allTasks = useAppStore(s => s.tasks);

  const [view, setView] = useState('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selectedIds, setSelectedIds] = useState([]);
  const [newNote, setNewNote] = useState(null);
  const [inlineNoteId, setInlineNoteId] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);

  const filterDefs = useMemo(() => filterDefsFor(rows), [rows]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return applyFilters(rows, filterDefs, filters)
      .filter(r => (view === 'all' || r.statusInfo.view === view) && (!q || matchesQuery(r, q)));
  }, [rows, filterDefs, filters, view, query]);
  const sort = useTableSort(shown, 'sortUpdated', 'desc');
  const filterCount = Object.values(filters).reduce((n, v) => n + v.length, 0);
  const narrowed = filterCount || view !== 'all' || query.trim();
  const inlineNote = inlineNoteId ? rows.find(n => n.id === inlineNoteId) : null;
  const hedisMembers = useAppStore(s => s.hedisMembers);

  if (!ids.length) return null;

  if (inlineNote) {
    const member = hedisMembers?.find(m => m.id === inlineNote.hedisMemberId || m.id === inlineNote.patientId) || null;
    return (
      <div className={styles.inlineWrap}>
        <InlineNoteView note={inlineNote} member={member} onBack={() => setInlineNoteId(null)} />
      </div>
    );
  }

  const closeSearch = () => { setSearchOpen(false); setQuery(''); };
  const toggle = id => setSelectedIds(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));

  return (
    <div className={styles.wrapper}>
      {searchOpen
        ? <SearchRow query={query} onQuery={setQuery} onClose={closeSearch} />
        : (
          <NotesToolbar
            view={view}
            onView={setView}
            onSearch={() => setSearchOpen(true)}
            onNewNote={() => setNewNote({ title: '' })}
            filtersOpen={filtersOpen}
            onToggleFilters={() => setFiltersOpen(o => !o)}
            filterCount={filterCount}
            canFilter={filterDefs.length > 0}
          />
        )}
      {filtersOpen && filterDefs.length > 0 && (
        <FilterBar
          variant="inline"
          multiSelect
          leading={null}
          filterDefs={filterDefs}
          filters={filters}
          onFilterChange={(key, vals) => setFilters(f => ({ ...f, [key]: vals }))}
          onClearAll={() => setFilters(EMPTY_FILTERS)}
          getOptions={def => def.options}
          showMoreFilters={false}
          showSaveFilter={false}
        />
      )}
      {todayAppointment && (
        <TodayAppointmentBanner
          appointment={todayAppointment}
          onAddVisitNote={title => setNewNote({ title: `${title} Visit Note` })}
        />
      )}
      {loading
        ? <SimpleTableSkeleton rows={5} cols={5} />
        : (
          <NotesTable
            rows={sort.sorted}
            sort={sort}
            selectedIds={selectedIds}
            onToggle={toggle}
            onToggleAll={checked => setSelectedIds(checked ? shown.map(r => r.id) : [])}
            onOpen={setInlineNoteId}
            onOpenTask={setSelectedTask}
            emptyLabel={narrowed ? 'No notes match these filters.' : 'No clinical notes for this patient yet.'}
          />
        )}

      {newNote && (
        <NonVisitNoteDrawer patient={patient} initialTitle={newNote.title} onClose={() => setNewNote(null)} />
      )}
      {selectedTask && (
        <TaskDetailDrawer
          task={(allTasks || []).find(t => t.id === selectedTask.id) || selectedTask}
          onClose={() => setSelectedTask(null)}
          onSelectTask={setSelectedTask}
        />
      )}
    </div>
  );
}
