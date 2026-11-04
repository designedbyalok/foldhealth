import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../components/Button/Button';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { Input } from '../../../components/Input/Input';
import { Toggle } from '../../../components/Toggle/Toggle';
import { SearchBar } from '../../../components/SearchBar/SearchBar';
import { Switch } from '../../../components/Switch/Switch';
import { Badge } from '../../../components/Badge/Badge';
import { DatePickerPopover } from '../../../components/DatePicker/DatePickerPopover';
import { Icon } from '../../../components/Icon/Icon';
import { DownChevronIcon } from '../../../components/Icon/DownChevronIcon';
import { Tooltip } from '../../../components/Tooltip/Tooltip';
import { InfoBar } from '../../../components/InfoBar/InfoBar';
import { CisTabSkeleton } from './CisTabSkeleton';
import { CIS_ANTIGENS, CIS_ANTIGEN_STATUS, CIS_DOSE_STATUS, CIS_EVALUATION, evaluateCis } from './cisRules';
import { isoToMdy } from './useCisTracker';
import { CisStatusBadge } from './CisStatus';
import { ANTIGEN_BADGE, DOSE_BADGE, EVALUATION_BADGE, fmtDate, isGiven, seriesStartDate } from './cisStatusConfig';
import { VaccineCalendarDialog } from './VaccineCalendarDialog';
import { DoseDateField } from './DoseDateField';
import { CisDoseProgress } from './CisDoseProgress';
import { DoseAppointmentChip } from './DoseAppointmentChip';
import { appointmentForDose, apptDate } from './cisAppointments';
import { CisMoreMenu } from './CisMoreMenu';
import { CisSyncEhrButton } from './CisSyncEhrButton';
import { SeriesDosesPicker } from './SeriesDosesPicker';
import styles from './CisImmunizationsTab.module.css';

// Vaccines grouped by what the care team should do about them (Figma:
// New Care Gap Workflow, node 1444:103523); Action Needed opens by default.
const GROUPS = [
  { key: 'action', label: 'Action Needed', statuses: [CIS_ANTIGEN_STATUS.overdue, CIS_ANTIGEN_STATUS.cannotMeet, CIS_ANTIGEN_STATUS.dueNow] },
  { key: 'soon', label: 'Upcoming', statuses: [CIS_ANTIGEN_STATUS.upcoming] },
  { key: 'later', label: 'Later', statuses: [CIS_ANTIGEN_STATUS.onTrack] },
  { key: 'done', label: 'Completed', statuses: [CIS_ANTIGEN_STATUS.met] },
];
// Every dose of the series has been given, whether or not each one counts:
// nothing is left to do, so the vaccine sits under Completed as Met / Not Met.
const allGiven = (a) => a.rows.every(r => r.kind === 'given');
const groupOf = (a) => (a.status === CIS_ANTIGEN_STATUS.met || allGiven(a)
  ? 'done'
  : GROUPS.find(g => g.statuses.includes(a.status))?.key);

// Download the child's full dose schedule as CSV, one row per dose.
const ageGroupLabel = (m) => (m === 0 ? 'At birth' : `${m} Month${m === 1 ? '' : 's'}`);


/**
 * Care Gap drawer: Immunizations tab for CIS-CMB10. Follows the Orders tab:
 * a summary card (DOB, dose-block progress, recommended action) and a
 * Vaccines card grouped by urgency. Doses and notes are recorded in the
 * Vaccine Calendar dialog.
 *
 * @param {object}   props
 * @param {object}   props.member
 * @param {Array}    props.immunizations   – patient_immunizations rows
 * @param {object}   props.savedNotes      – cis_dose_notes, keyed 'dtap:1'
 * @param {boolean}  props.loading
 * @param {number}   props.measurementYear
 * @param {object}   [props.lastSaved]     – { actor, when }
 * @param {function} props.onSave          – (payload) => Promise<boolean>
 */
export function CisImmunizationsTab({ member, immunizations, savedNotes, loading, measurementYear, lastSaved, onSave, appointments, onOpenSchedule, onSaveEvidence, seriesDoses, onSeriesDosesChange }) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const result = useMemo(
    () => evaluateCis({ dob: member?.dob, immunizations: immunizations || [], measurementYear, seriesDoses }),
    [member?.dob, immunizations, measurementYear, seriesDoses],
  );
  // Vaccines that need action are open unless the user closed them; a
  // toggle is remembered per vaccine. (Not seeded at mount: immunizations
  // may still be loading then, when every vaccine looks overdue.)
  const [toggled, setToggled] = useState({});
  const [closedGroups, setClosedGroups] = useState({});
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  // 'vaccine': grouped by status. 'age': the schedule sheet, doses grouped
  // by the routine age they start at.
  const [viewBy, setViewBy] = useState('vaccine');
  const [closedAges, setClosedAges] = useState({});
  // Dose picked from the progress bar: scrolled to and flashed for 2s.
  const [focusDose, setFocusDose] = useState(null);
  useEffect(() => {
    if (!focusDose) return undefined;
    const el = document.getElementById(`cis-dose-${focusDose.key}-${focusDose.number}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const t = setTimeout(() => setFocusDose(null), 2000);
    return () => clearTimeout(t);
  }, [focusDose]);
  if (loading) return <CisTabSkeleton />;

  const isOpen = (a) => toggled[a.key] ?? groupOf(a) === 'action';
  const toggle = (a) => setToggled(t => ({ ...t, [a.key]: !isOpen(a) }));
  const openCalendar = () => setCalendarOpen(true);
  const startedOn = seriesStartDate(result);
  const ageKeys = [...new Set(result.antigens.flatMap(a => a.rows.map(r => r.ageMonths)))];
  const allOpen = viewBy === 'age'
    ? ageKeys.every(k => !closedAges[k])
    : result.antigens.length > 0 && result.antigens.every(isOpen);
  const setAllOpen = (open) => {
    if (viewBy === 'age') {
      setClosedAges(open ? {} : Object.fromEntries(ageKeys.map(k => [k, true])));
      return;
    }
    setToggled(Object.fromEntries(result.antigens.map(a => [a.key, open])));
    if (open) setClosedGroups({});
  };
  // Open the dose's vaccine (and group), clear a search hiding it, then
  // let the effect above scroll to and highlight the row.
  const goToDose = (a, r) => {
    const group = GROUPS.find(g => g.statuses.includes(a.status));
    if (group) setClosedGroups(g => ({ ...g, [group.key]: false }));
    setToggled(t => ({ ...t, [a.key]: true }));
    setClosedAges(g => ({ ...g, [r.ageMonths]: false }));
    setSearch('');
    setFocusDose({ key: a.key, number: r.number, at: Date.now() });
  };
  const query = search.trim().toLowerCase();
  const visible = (a) => !query || `${a.label} ${a.name}`.toLowerCase().includes(query);
  const shownGroups = GROUPS
    .map(group => ({ group, items: result.antigens.filter(a => groupOf(a) === group.key && visible(a)) }))
    .filter(g => g.items.length);
  // By-age view: every dose of the visible vaccines, bucketed by the age
  // it is routinely given at, youngest first (schedule order within).
  const ageGroups = Object.values(
    result.antigens.filter(visible).flatMap(a => a.rows.map(r => ({ a, r }))).reduce((acc, item) => {
      const k = item.r.ageMonths;
      (acc[k] ||= { key: k, items: [] }).items.push(item);
      return acc;
    }, {}),
  ).sort((x, y) => x.key - y.key);

  // Right side of the list bar: search, calendar, download, expand/collapse.
  const listToolbar = (
    <span className={styles.listToolbar}>
      <CisSyncEhrButton member={member} result={result} notes={savedNotes} onSaveEvidence={onSaveEvidence} />
      <span className={styles.toolbarDivider} aria-hidden="true" />
      {searchOpen ? (
        <SearchBar
          className={styles.listSearch}
          placeholder="Search vaccines"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onClose={() => { setSearchOpen(false); setSearch(''); }}
        />
      ) : (
        <ActionButton size="sm" icon="solar:magnifer-linear" tooltip="Search" onClick={() => setSearchOpen(true)} />
      )}
      <span className={styles.toolbarDivider} aria-hidden="true" />
      <ActionButton size="sm" icon="solar:calendar-linear" tooltip="Vaccine Calendar" onClick={openCalendar} />
      <span className={styles.toolbarDivider} aria-hidden="true" />
      <Switch checked={allOpen} onChange={setAllOpen} label="Expand all" labelGap={6} />
      <span className={styles.toolbarDivider} aria-hidden="true" />
      <CisMoreMenu
        member={member}
        result={result}
        notes={savedNotes}
        onSaveEvidence={onSaveEvidence}
      />
    </span>
  );

  // Inline edits save straight away, one change per save. The edited
  // vaccine stays open even if the save completes it, so its dose (and
  // note) remain in view.
  const keepOpen = (antigen) => setToggled(t => ({ ...t, [antigen.key]: true }));
  const changeDate = (antigen, row, iso) => {
    keepOpen(antigen);
    const record = CIS_ANTIGENS.find(a => a.key === antigen.key).record;
    if (!row.record) {
      if (!iso) return;
      onSave({ inserts: [{ ...record, dateAdministered: isoToMdy(iso) }], summary: `${antigen.label} dose ${row.number} recorded (${fmtDate(new Date(`${iso}T00:00`))})` });
      return;
    }
    const shared = result.antigens
      .filter(a => a.key !== antigen.key && a.rows.some(r => r.record?.id === row.record.id))
      .map(a => a.label);
    if (!iso) {
      setConfirm({ kind: 'remove', antigen, row, shared });
      return;
    }
    const update = () => onSave({ updates: [{ id: row.record.id, dateAdministered: isoToMdy(iso) }], summary: `${antigen.label} dose ${row.number} date changed to ${fmtDate(new Date(`${iso}T00:00`))}` });
    if (shared.length) setConfirm({ kind: 'shared', antigen, row, shared, run: update });
    else update();
  };
  const saveNote = (antigen, row, text) => onSave({
    notes: [{ antigenKey: antigen.key, doseNumber: row.number, note: text.trim() }],
    summary: `Note ${text.trim() ? 'updated' : 'removed'} on ${antigen.label} dose ${row.number}`,
  });

  const hasDob = !!result.dob;
  // A child outside the measure (aged out, or no DOB) has nothing to track.
  const trackable = hasDob && result.evaluation !== CIS_EVALUATION.notEligible;

  return (
    <div className={styles.tab}>
      {/* 1. Gap summary: dose progress */}
      <section className={styles.summary} aria-label="Care Gap summary">
        {/* Why there is nothing to track (aged out / no DOB). */}
        {!trackable && (
          <div className={styles.notEligible}>
            <CisStatusBadge map={EVALUATION_BADGE} status={result.evaluation} size="md" />
            <p className={styles.reason}>{result.reason}</p>
          </div>
        )}

        {trackable && (
          <CisDoseProgress result={result} startedOn={startedOn} onSelect={goToDose} />
        )}
      </section>


      {/* 2. Vaccines: flat accordion list (Figma Component 109), grouped by
          urgency. */}
      {trackable && (
        <section className={styles.vaccines} aria-label="Combination 10 vaccines">
          <div className={styles.listBar}>
            <Toggle
              size="sm"
              items={[{ key: 'vaccine', label: 'Vaccine' }, { key: 'age', label: 'Age' }]}
              value={viewBy}
              onValueChange={setViewBy}
            />
            {listToolbar}
          </div>
          {viewBy === 'age' && (
            <>
              {ageGroups.length === 0 && (
                <>
                  <p className={styles.empty}>
                    <Icon name="solar:info-circle-linear" size={14} color="currentColor" />
                    No vaccines match your search.
                  </p>
                </>
              )}
              {ageGroups.map(g => (
                <div key={g.key} className={styles.group} role="group" aria-label={ageGroupLabel(g.key)}>
                  <div className={styles.groupLine}>
                    <button
                      type="button"
                      className={`${styles.groupHeader} ${styles.ageTitle}`}
                      onClick={() => setClosedAges(c => ({ ...c, [g.key]: !c[g.key] }))}
                      aria-expanded={!closedAges[g.key]}
                    >
                      {ageGroupLabel(g.key)} ({g.items.length})
                      <DownChevronIcon size={16} color="var(--neutral-400)" className={closedAges[g.key] ? styles.chevronClosed : undefined} />
                    </button>
                    <AgeProgress items={g.items} title={ageGroupLabel(g.key)} collapsed={!!closedAges[g.key]} />
                    <span className={styles.ageStart}>Start date: <b>{fmtDate(g.items[0].r.start)}</b></span>
                  </div>
                  {!closedAges[g.key] && (
                    <div className={`${styles.doseTable} ${styles.ageTable}`} role="table" aria-label={`Doses due at ${ageGroupLabel(g.key)}`}>
                      <div className={`${styles.doseRow} ${styles.doseHead}`} role="row">
                        <span role="columnheader">Vaccine (Dose)</span>
                        <span role="columnheader">Earliest Allowed</span>
                        <span role="columnheader">Date Administered</span>
                        <span role="columnheader">Status</span>
                        <span role="columnheader" className={styles.noteHead}>Note</span>
                      </div>
                      {g.items.map(({ a, r }) => (
                        <DoseRow
                          key={`${a.key}-${r.number}`}
                          antigen={a}
                          row={r}
                          showVaccine
                          note={savedNotes?.[`${a.key}:${r.number}`]?.note || ''}
                          onDateChange={changeDate}
                          onNoteSave={saveNote}
                          dob={result.dob}
                          highlight={focusDose?.key === a.key && focusDose.number === r.number}
                          appointments={appointments}
                          onOpenAppointment={(appt) => onOpenSchedule?.(appt)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
          {viewBy === 'vaccine' && shownGroups.length === 0 && (
            <>
              <p className={styles.empty}>
                <Icon name="solar:info-circle-linear" size={14} color="currentColor" />
                No vaccines match your search.
              </p>
            </>
          )}
          {viewBy === 'vaccine' && shownGroups.map(({ group, items }) => {
            return (
              <div key={group.key} className={styles.group} role="group" aria-label={group.label}>
                <div className={styles.groupLine}>
                <button
                  type="button"
                  className={styles.groupHeader}
                  onClick={() => setClosedGroups(g => ({ ...g, [group.key]: !g[group.key] }))}
                  aria-expanded={!closedGroups[group.key]}
                >
                  {group.label} ({items.length})
                  <DownChevronIcon size={16} color="var(--neutral-400)" className={closedGroups[group.key] ? styles.chevronClosed : undefined} />
                </button>
                </div>
                {!closedGroups[group.key] && (
                <div className={styles.groupBody}>
                <div className={`${styles.vaccineRow} ${styles.colHead}`} aria-hidden="true">
                  <span>Vaccine Name</span>
                  <span>Progress</span>
                  <span>{group.key === 'done' ? 'Completed On' : 'Next Action Due'}</span>
                  <span>Status</span>
                </div>
                {items.map(a => (
                  <VaccineRow
                    key={a.key}
                    antigen={a}
                    open={isOpen(a)}
                    onToggle={() => toggle(a)}
                    notes={savedNotes}
                    onDateChange={changeDate}
                    onNoteSave={saveNote}
                    dob={result.dob}
                    focusNumber={focusDose?.key === a.key ? focusDose.number : null}
                    appointments={appointments}
                    onOpenAppointment={(appt) => onOpenSchedule?.(appt)}
                    onSeriesDosesChange={onSeriesDosesChange}
                  />
                ))}
                </div>
                )}
              </div>
            );
          })}
          {(immunizations || []).length === 0 && (
            <p className={styles.empty}>
              <Icon name="solar:info-circle-linear" size={14} color="currentColor" />
              No immunizations on file yet. Open a vaccine to record its doses.
            </p>
          )}
        </section>
      )}

      {confirm && (
        <ConfirmDialog
          variant="warning"
          title={confirm.kind === 'remove'
            ? `Clear the date for ${confirm.antigen.label} dose ${confirm.row.number}?`
            : `Change a combination vaccine date?`}
          description={confirm.kind === 'remove'
            ? [
              `The dose will show as not given, and its ${fmtDate(confirm.row.record.date)} record is removed from the patient's immunization history.`,
              confirm.shared.length ? `This ${confirm.row.record.title} record also counts for ${confirm.shared.join(', ')}, so their date clears too.` : '',
            ].filter(Boolean).join(' ')
            : `This ${confirm.row.record.title} record also counts for ${confirm.shared.join(', ')}. Their date changes too.`}
          confirmLabel={confirm.kind === 'remove' ? 'Clear date' : 'Change date'}
          onConfirm={() => {
            if (confirm.kind === 'remove') {
              onSave({ deletes: [confirm.row.record.id], summary: `${confirm.antigen.label} dose ${confirm.row.number} date cleared` });
            } else confirm.run();
            setConfirm(null);
          }}
          onCancel={() => setConfirm(null)}
        />
      )}

      {calendarOpen && (
        <VaccineCalendarDialog
          member={member}
          immunizations={immunizations}
          savedNotes={savedNotes}
          measurementYear={measurementYear}
          seriesDoses={seriesDoses}
          onSeriesDosesChange={onSeriesDosesChange}
          lastSaved={lastSaved}
          onSave={onSave}
          appointments={appointments}
          onSaveEvidence={onSaveEvidence}
          // The form opens in the Care Gap drawer's left panel, which this
          // drawer would cover, so close it first.
          onOpenSchedule={(appt) => { setCalendarOpen(false); onOpenSchedule?.(appt); }}
          onClose={() => setCalendarOpen(false)}
        />
      )}
    </div>
  );
}

const PIP_CLASS = {
  [CIS_DOSE_STATUS.completed]: 'pipDone',
  [CIS_DOSE_STATUS.completedLate]: 'pipDone',
  [CIS_DOSE_STATUS.dueNow]: 'pipDue',
  [CIS_DOSE_STATUS.pending]: 'pipDue',
  [CIS_DOSE_STATUS.overdue]: 'pipLate',
  [CIS_DOSE_STATUS.notCounted]: 'pipLate',
  [CIS_DOSE_STATUS.cannotMeet]: 'pipLate',
};

// Age group header progress, readable while collapsed: given count and
// one pip per dose, styled like a vaccine's progress in the Vaccine view.
// Collapsed, hovering it lists the group's doses (expanded, the rows show).
function AgeProgress({ items, title, collapsed }) {
  const given = items.filter(({ r }) => isGiven(r.status)).length;
  const progress = (
    <span className={styles.progress} aria-label={`${given} of ${items.length} doses given`}>
      <span className={styles.progressText}>{given}/{items.length}</span>
      <span className={styles.pips} aria-hidden="true">
        {items.map(({ a, r }) => (
          <span key={`${a.key}-${r.number}`} className={`${styles.pip} ${styles[PIP_CLASS[r.status]] || ''}`} />
        ))}
      </span>
    </span>
  );
  if (!collapsed) return <span className={styles.ageProgress}>{progress}</span>;
  return (
    <Tooltip variant="light" placement="bottom" align="start" maxWidth={320} className={styles.ageProgress} label={<AgeDoseList title={title} items={items} />}>
      {progress}
    </Tooltip>
  );
}

// Hover card on a collapsed age group: every dose in it with its date and status.
function AgeDoseList({ title, items }) {
  return (
    <div className={styles.doseList}>
      <span className={styles.doseListTitle}>{title} · {items.length} dose{items.length === 1 ? '' : 's'}</span>
      {items.map(({ a, r }) => (
        <div key={`${a.key}-${r.number}`} className={styles.doseListRow}>
          <span className={`${styles.doseListDose} ${styles.ageDoseName}`}>{a.label} · Dose {r.number}</span>
          <span className={styles.doseListDate}>
            {r.record ? fmtDate(r.record.date) : r.kind === 'planned' ? `From ${fmtDate(r.nextDue)}` : 'Not given'}
          </span>
          <CisStatusBadge map={DOSE_BADGE} status={r.status} />
        </div>
      ))}
    </div>
  );
}

// One pip per required dose (Figma): green = counted; the next dose is a
// red / yellow ring when overdue / due now, else solid grey; hollow = later.
function DosePips({ antigen }) {
  const counted = Math.min(antigen.valid.length, antigen.required);
  const next = antigen.rows.find(r => r.kind === 'planned');
  const urgent = next && [CIS_DOSE_STATUS.dueNow, CIS_DOSE_STATUS.overdue, CIS_DOSE_STATUS.cannotMeet].includes(next.status);
  return (
    <span className={styles.pips} aria-label={`${counted} of ${antigen.required} doses`}>
      {Array.from({ length: antigen.required }, (_, i) => (
        <span
          key={i}
          className={[
            styles.pip,
            i < counted ? styles.pipDone : '',
            i === counted && next ? (urgent ? (next.status === CIS_DOSE_STATUS.dueNow ? styles.pipDue : styles.pipLate) : styles.pipNext) : '',
          ].join(' ')}
        />
      ))}
    </span>
  );
}

// Hover card on a vaccine's progress: every dose with its date and status.
function DoseList({ antigen }) {
  return (
    <div className={styles.doseList}>
      <span className={styles.doseListTitle}>{antigen.label} · {antigen.name}</span>
      {antigen.rows.map(r => (
        <div key={r.number} className={styles.doseListRow}>
          <span className={styles.doseListDose}>Dose {r.number}</span>
          <span className={styles.doseListDate}>
            {r.record ? fmtDate(r.record.date) : r.kind === 'planned' ? `From ${fmtDate(r.nextDue)}` : 'Not given'}
          </span>
          <CisStatusBadge map={DOSE_BADGE} status={r.status} />
        </div>
      ))}
    </div>
  );
}

// Collapsed: name, dose dots, next step, status. Expanded: one row per
// dose with its recommended age, earliest allowed date, an editable given
// date, status and note (Figma: New Care Gap Workflow, Component 109).
function VaccineRow({ antigen, open, onToggle, notes, onDateChange, onNoteSave, dob, focusNumber, appointments, onOpenAppointment, onSeriesDosesChange }) {
  const counted = Math.min(antigen.valid.length, antigen.required);
  const next = antigen.rows.find(r => r.kind === 'planned');
  let when;
  // Met rows sit under a "Completed On" column: just the date the series
  // was completed (the dose that met the requirement).
  const done = groupOf(antigen) === 'done';
  if (antigen.status === CIS_ANTIGEN_STATUS.met) when = fmtDate(antigen.valid[antigen.required - 1]?.date);
  // Every dose given but the series still falls short: the last dose date.
  else if (done) when = fmtDate(antigen.rows[antigen.rows.length - 1]?.record?.date);
  // The Can't Meet badge carries the "too late" message; this column
  // names the next dose, like every other row.
  else if (antigen.status === CIS_ANTIGEN_STATUS.cannotMeet && !next) {
    // Nothing left to give: the missing dose was given but does not count,
    // so the dose is still owed; the badge carries "does not count".
    const late = antigen.rows.find(r => r.status === CIS_DOSE_STATUS.notCounted);
    when = `Dose ${late?.number} was due ${fmtDate(late?.due)}`;
  } else if (antigen.status === CIS_ANTIGEN_STATUS.cannotMeet) {
    when = next?.status === CIS_DOSE_STATUS.overdue
      ? `Dose ${next.number} overdue`
      : next && new Date() >= next.nextDue ? `Dose ${next.number} due now` : `Dose ${next?.number} from ${fmtDate(next?.nextDue)}`;
  }
  else if (antigen.status === CIS_ANTIGEN_STATUS.overdue) when = `Dose ${next?.number} was due ${fmtDate(next?.due)}`;
  else if (antigen.status === CIS_ANTIGEN_STATUS.dueNow) when = `Dose ${next?.number} due now`;
  else when = `Dose ${next?.number} from ${fmtDate(next?.nextDue)}`;
  // A booked appointment for the next dose replaces the due text, so the
  // row reads right while collapsed.
  const booked = next && appointmentForDose(appointments, antigen.key, next);
  if (booked) {
    const on = fmtDate(apptDate(booked.appt));
    when = booked.passed ? `Dose ${next.number}: confirm given (${on})` : `Dose ${next.number} scheduled ${on}`;
  }
  const panelId = `cis-doses-${antigen.key}`;
  return (
    <div className={styles.vaccine}>
      <button
        type="button"
        className={styles.vaccineRow}
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <span className={styles.vaccineName}>
          <DownChevronIcon size={16} color="var(--neutral-400)" className={open ? undefined : styles.chevronClosed} />
          <span className={styles.vaccineLabel}>{antigen.label}</span>
          {/* Rotavirus series length (2 Rotarix / 3 RotaTeq), editable
              while the row is expanded and the series isn't met yet. */}
          {open && antigen.seriesChoice && antigen.status !== CIS_ANTIGEN_STATUS.met && onSeriesDosesChange && (
            <SeriesDosesPicker choice={antigen.seriesChoice} onChange={(n) => onSeriesDosesChange(antigen.key, n)} />
          )}
        </span>
        <span className={styles.progressCell}>
          <Tooltip variant="light" placement="bottom" align="start" maxWidth={300} label={<DoseList antigen={antigen} />}>
            <span className={styles.progress} aria-label={`${counted} of ${antigen.required} doses`}>
              <span className={styles.progressText}>{counted}/{antigen.required}</span>
              <DosePips antigen={antigen} />
            </span>
          </Tooltip>
        </span>
        <span className={styles.when} title={when}>{when}</span>
        {/* Own cell, so the column padding insets the badge instead of
            padding the badge itself (keeps it under the Status title). */}
        <span className={styles.statusCell}>
          {done && antigen.status !== CIS_ANTIGEN_STATUS.met
            ? <CisStatusBadge map={ANTIGEN_BADGE} status={CIS_ANTIGEN_STATUS.cannotMeet} label="Not Met" />
            : <CisStatusBadge map={ANTIGEN_BADGE} status={antigen.status} />}
        </span>
      </button>
      {open && (
        <div id={panelId} className={styles.doseTable} role="table" aria-label={`${antigen.label} doses`}>
          <div className={`${styles.doseRow} ${styles.doseHead}`} role="row">
            <span role="columnheader">Doses (Recommended Age)</span>
            <span role="columnheader">Earliest Allowed</span>
            <span role="columnheader">Date Administered</span>
            <span role="columnheader">Status</span>
            <span role="columnheader" className={styles.noteHead}>Note</span>
          </div>
          {antigen.rows.map(row => (
            <DoseRow
              key={row.number}
              antigen={antigen}
              row={row}
              note={notes?.[`${antigen.key}:${row.number}`]?.note || ''}
              onDateChange={onDateChange}
              onNoteSave={onNoteSave}
              dob={dob}
              highlight={focusNumber === row.number}
              appointments={appointments}
              onOpenAppointment={onOpenAppointment}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DoseRow({ antigen, row, note, onDateChange, onNoteSave, dob, highlight, showVaccine = false, appointments, onOpenAppointment }) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [draft, setDraft] = useState(note);
  const range = row.recommendedEnd ? `${fmtDate(row.start)} - ${fmtDate(row.recommendedEnd)}` : fmtDate(row.start);
  const notCounted = row.status === CIS_DOSE_STATUS.notCounted;
  return (
    <div
      id={`cis-dose-${antigen.key}-${row.number}`}
      className={[notCounted ? styles.doseItemError : '', highlight ? styles.doseHighlight : ''].filter(Boolean).join(' ') || undefined}
    >
      <div className={styles.doseRow} role="row">
        <span role="cell" className={styles.doseCol}>
          <span className={styles.doseName}>
            {showVaccine
              ? <>{antigen.label} <span className={styles.doseAge}>(Dose {row.number})</span></>
              : <>Dose {row.number} <span className={styles.doseAge}>({row.recommendedShort})</span></>}
          </span>
          <span className={styles.doseRange}>{range}</span>
        </span>
        <span role="cell" className={styles.doseValue}>{fmtDate(row.earliest)}</span>
        <span role="cell" className={styles.dateCell}>
          <DoseDateField row={row} label={antigen.label} dob={dob} onChange={(iso) => onDateChange(antigen, row, iso)} />
          <DoseAppointmentChip match={appointmentForDose(appointments, antigen.key, row)} onOpen={onOpenAppointment} />
        </span>
        <span role="cell">
          {row.status === CIS_DOSE_STATUS.completedLate ? (
            <Tooltip label={row.reason} variant="light" maxWidth={240}>
              <CisStatusBadge map={DOSE_BADGE} status={row.status} size="md" hideIcon />
            </Tooltip>
          ) : <CisStatusBadge map={DOSE_BADGE} status={row.status} size="md" hideIcon />}

        </span>
        <span role="cell" className={styles.noteCol}>
          <ActionButton
            icon="solar:chat-round-line-linear"
            size="sm"
            tooltip={note ? note : 'Add a note'}
            tooltipLeft
            dot={!!note}
            onClick={() => { setDraft(note); setNoteOpen(o => !o); }}
          />
        </span>
      </div>
      {noteOpen && (
        <div className={styles.noteEditor}>
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Note for ${antigen.label} dose ${row.number}`}
            aria-label={`${antigen.label} dose ${row.number} note`}
            autoFocus
          />
          <Button variant="outline" size="sm" onClick={() => setNoteOpen(false)}>Cancel</Button>
          <Button
            size="sm"
            disabled={draft.trim() === note}
            onClick={() => { onNoteSave(antigen, row, draft); setNoteOpen(false); }}
          >
            Save
          </Button>
        </div>
      )}
      {notCounted && row.reason && (
        <div className={styles.doseError}>
          <InfoBar tone="error" variant="inline" icon="solar:danger-triangle-linear" className={styles.doseErrorBar}>
            Does Not Count: {row.reason}.
          </InfoBar>
        </div>
      )}
    </div>
  );
}
