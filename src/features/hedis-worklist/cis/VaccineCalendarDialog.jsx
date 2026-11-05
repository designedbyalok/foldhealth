import { Fragment, useEffect, useMemo, useState } from 'react';
import { Drawer } from '../../../components/Drawer/Drawer';
import { PatientBanner } from '../../../components/PatientBanner/PatientBanner';
import { Icon } from '../../../components/Icon/Icon';
import { FilterChip } from '../../../components/FilterChip/FilterChip';
import { Tooltip } from '../../../components/Tooltip/Tooltip';
import { Banner } from '../../../components/Banner/Banner';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { SegmentedControl } from '../../../components/SegmentedControl/SegmentedControl';
import { CIS_ANTIGEN_STATUS, CIS_DOSE_STATUS, evaluateCis } from './cisRules';
import { isoToMdy } from './useCisTracker';
import { CisStatusBadge } from './CisStatus';
import { CisDoseProgress } from './CisDoseProgress';
import { DOSE_BADGE, fmtDate, isGiven, seriesStartDate } from './cisStatusConfig';
import { VaccineTimeline } from './VaccineTimeline';
import { DoseNoteInput } from './DoseNoteInput';
import { DoseDateField } from './DoseDateField';
import { DoseAppointmentChip } from './DoseAppointmentChip';
import { appointmentForDose } from './cisAppointments';
import { CisMoreMenu } from './CisMoreMenu';
import { CisSyncEhrButton } from './CisSyncEhrButton';
import { SeriesDosesPicker } from './SeriesDosesPicker';
import styles from './VaccineCalendarDialog.module.css';

// Rows that need action get an accent bar down the dose column.
const ACCENT = {
  [CIS_DOSE_STATUS.dueNow]: styles.accentWarning,
  [CIS_DOSE_STATUS.pending]: styles.accentWarning,
  [CIS_DOSE_STATUS.overdue]: styles.accentError,
  [CIS_DOSE_STATUS.notCounted]: styles.accentError,
  [CIS_DOSE_STATUS.cannotMeet]: styles.accentError,
};
const STATUS_ORDER = Object.values(CIS_DOSE_STATUS);
// Doses whose reason shows as a full-width bar under the row: red when the
// dose does not count, grey when it counts but was given late.
const REASON_BAR = {
  [CIS_DOSE_STATUS.notCounted]: { tone: 'danger', icon: 'solar:danger-triangle-linear', quiet: false },
  [CIS_DOSE_STATUS.completedLate]: { tone: 'info', icon: 'solar:history-linear', quiet: true },
};
const reasonBarFor = (r) => (r.reason ? REASON_BAR[r.status] : null);
const URGENCY = [
  CIS_ANTIGEN_STATUS.overdue,
  CIS_ANTIGEN_STATUS.cannotMeet,
  CIS_ANTIGEN_STATUS.dueNow,
  CIS_ANTIGEN_STATUS.upcoming,
  CIS_ANTIGEN_STATUS.onTrack,
  CIS_ANTIGEN_STATUS.met,
];

const fmtSaved = (iso) => {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  return { date: fmtDate(d), time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) };
};

/**
 * Vaccine Calendar for a CIS-CMB10 gap: every dose of the ten Combination
 * 10 vaccines in one table (recommended age and window, earliest allowed
 * date, date given, status, note). Date given and note are edited inline
 * in every row; a planned dose becomes a recorded one once dated. Nothing
 * is written until Save.
 *
 * @param {object}   props
 * @param {object}   props.member
 * @param {Array}    props.immunizations   – patient_immunizations rows
 * @param {object}   props.savedNotes      – { 'dtap:1': { note } }
 * @param {number}   props.measurementYear
 * @param {object}   [props.seriesDoses]   – { rv: 2 | 3 } series length picks
 * @param {function} [props.onSeriesDosesChange] – (antigenKey, doses) => void
 * @param {object}   [props.lastSaved]     – { actor, when }
 * @param {function} props.onSave          – (payload) => Promise<boolean>
 * @param {function} props.onClose
 */
export function VaccineCalendarDialog({ member, immunizations, savedNotes, measurementYear, seriesDoses, onSeriesDosesChange, lastSaved, onSave, appointments, onOpenSchedule, onSaveEvidence, onClose }) {
  const result = useMemo(
    () => evaluateCis({ dob: member?.dob, immunizations: immunizations || [], measurementYear, seriesDoses }),
    [member?.dob, immunizations, measurementYear, seriesDoses],
  );
  const [statusFilter, setStatusFilter] = useState([]);
  const [view, setView] = useState('timeline');
  // Table rows grouped by vaccine, or by the routine age the dose starts at.
  const [viewBy, setViewBy] = useState('vaccine');
  const [confirmRemove, setConfirmRemove] = useState(null);

  const statusOptions = useMemo(() => {
    const present = new Set(result.antigens.flatMap(a => a.rows.map(r => r.status)));
    return STATUS_ORDER.filter(s => present.has(s));
  }, [result]);
  // Same order as the Immunizations tab: vaccines needing action first,
  // complete ones last. Fixed when the dialog opens so rows don't jump
  // under the cursor while a date is being entered.
  const [order] = useState(() => [...result.antigens]
    .sort((x, y) => URGENCY.indexOf(x.status) - URGENCY.indexOf(y.status))
    .map(a => a.key));
  const keep = (r) => !statusFilter.length || statusFilter.includes(r.status);
  const groups = viewBy === 'age'
    ? Object.values(result.antigens.flatMap(a => a.rows.filter(keep).map(row => ({ antigen: a, row })))
      .reduce((acc, item) => {
        const k = item.row.ageMonths;
        (acc[k] ||= { key: `age-${k}`, age: k, items: [] }).items.push(item);
        return acc;
      }, {}))
      .sort((x, y) => x.age - y.age)
    : order
      .map(key => result.antigens.find(a => a.key === key))
      .map(a => ({ key: a.key, antigen: a, items: a.rows.filter(keep).map(row => ({ antigen: a, row })) }))
      .filter(g => g.items.length > 0);
  const totalDoses = result.antigens.reduce((n, a) => n + a.rows.length, 0);
  const shownDoses = groups.reduce((n, g) => n + g.items.length, 0);

  // Every change saves straight away, as on the tab.
  const changeDate = (antigen, row, iso) => {
    const when = iso ? fmtDate(new Date(`${iso}T00:00`)) : '';
    if (!row.record) {
      if (iso) onSave({ inserts: [{ ...antigen.record, dateAdministered: isoToMdy(iso) }], summary: `${antigen.label} dose ${row.number} recorded (${when})` });
      return;
    }
    const shared = result.antigens
      .filter(a => a.key !== antigen.key && a.rows.some(r => r.record?.id === row.record.id))
      .map(a => a.label);
    if (!iso) setConfirmRemove({ antigen, row, shared });
    else onSave({ updates: [{ id: row.record.id, dateAdministered: isoToMdy(iso) }], summary: `${antigen.label} dose ${row.number} date changed to ${when}` });
  };
  const saveNote = (antigen, row, text) => onSave({
    notes: [{ antigenKey: antigen.key, doseNumber: row.number, note: text.trim() }],
    summary: `Note ${text.trim() ? 'updated' : 'removed'} on ${antigen.label} dose ${row.number}`,
  });
  // A block in the progress bar jumps to its dose in the table and
  // flashes the row for 2s.
  const [focusDose, setFocusDose] = useState(null);
  useEffect(() => {
    if (!focusDose) return undefined;
    document.getElementById(`cis-cal-${focusDose}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const t = setTimeout(() => setFocusDose(null), 2000);
    return () => clearTimeout(t);
  }, [focusDose]);
  const goToDose = (a, r) => {
    setView('table');
    setStatusFilter([]);
    setFocusDose(`${a.key}-${r.number}`);
  };

  const saved = lastSaved ? fmtSaved(lastSaved.when) : null;
  const byAge = viewBy === 'age';

  return (
    <Drawer
      title="Vaccine Calendar"
      onClose={onClose}
      width={1120}
      headerRight={(
        <>
          <CisSyncEhrButton member={member} result={result} notes={savedNotes} onSaveEvidence={onSaveEvidence} />
          <span className={styles.headerDivider} aria-hidden="true" />
          <CisMoreMenu
            size="L"
            member={member}
            result={result}
            notes={savedNotes}
            onSaveEvidence={onSaveEvidence}
          />
          <span className={styles.headerDivider} aria-hidden="true" />
        </>
      )}
      noCloseDivider
      // Patient context, as in the Care Gap drawer, edge to edge.
      banner={(
        <PatientBanner
          initials={member?.in}
          name={member?.name}
          gender={member?.gender}
          age={member?.age}
          dob={member?.dob}
          memberId={member?.memberId}
          patientId={member?.id}
          hidePatientLabel
        />
      )}
      bodyClassName={styles.body}
    >
          {result.dob && (
            <section className={styles.progressCard} aria-label="Dose progress">
              <CisDoseProgress result={result} startedOn={seriesStartDate(result)} onSelect={goToDose} />
            </section>
          )}

          <div className={styles.toolbar}>
            <span className={styles.toolbarStart}>
              <SegmentedControl
                size="sm"
                items={[{ key: 'timeline', label: 'Timeline' }, { key: 'table', label: 'Table' }]}
                value={view}
                onValueChange={setView}
              />
              <span className={styles.toolbarCount}>
                {statusFilter.length ? `${shownDoses} of ${totalDoses} doses` : `${totalDoses} doses across ${result.antigens.length} vaccines`}
              </span>
            </span>
            <span className={styles.toolbarEnd}>
              {view === 'table' && (
                <FilterChip
                  size="S"
                  singleSelect
                  noClear
                  label="View by"
                  options={['Vaccine', 'Age']}
                  selected={[viewBy === 'age' ? 'Age' : 'Vaccine']}
                  onChange={(v) => setViewBy(v[0] === 'Age' ? 'age' : 'vaccine')}
                />
              )}
              <FilterChip size="S" label="Status" options={statusOptions} selected={statusFilter} onChange={setStatusFilter} />
            </span>
          </div>

          {view === 'timeline' && result.dob && (
            <VaccineTimeline
              result={result}
              antigenOrder={order}
              statusFilter={statusFilter}
              appointments={appointments}
              notes={savedNotes}
              onDateChange={changeDate}
              onNoteSave={saveNote}
            />
          )}
          <div className={styles.tableWrap} hidden={view === 'timeline' && !!result.dob}>
            <table className={`${styles.table} ${byAge ? styles.tableByAge : ''}`}>
              <thead>
                <tr>
                  <th className={styles.colVaccine}>{byAge ? 'Age' : 'Vaccine'}</th>
                  {byAge && <th className={styles.colVaccineName}>Vaccine</th>}
                  <th className={styles.colDose}>Dose</th>
                  {/* By age, the group already gives the age; each dose's window sits under its number. */}
                  {!byAge && <th className={styles.colRecommended}>Recommended Age</th>}
                  <th className={styles.colEarliest}>
                    <span className={styles.thHint}>
                      Earliest Allowed
                      <Tooltip label="Earliest date this dose can be given and still be valid (minimum age and spacing).">
                        <Icon name="solar:info-circle-linear" size={12} color="var(--neutral-300)" />
                      </Tooltip>
                    </span>
                  </th>
                  <th className={styles.colDate}>Date Administered</th>
                  <th className={styles.colStatus}>Status</th>
                  <th className={styles.colNotes}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(group => (
                  <Fragment key={group.key}>
                    {group.items.map(({ antigen, row }, i) => {
                      const savedNote = savedNotes?.[`${antigen.key}:${row.number}`]?.note || '';
                      const bar = reasonBarFor(row);
                      return (
                        <Fragment key={`${antigen.key}:${row.number}`}>
                        <tr
                          id={`cis-cal-${antigen.key}-${row.number}`}
                          className={[
                            i === 0 ? styles.groupStart : '',
                            bar ? styles.hasReasonBar : '',
                            focusDose === `${antigen.key}-${row.number}` ? styles.doseHighlight : '',
                          ].filter(Boolean).join(' ') || undefined}
                        >
                          {i === 0 && (
                            // The reason bars under "Does Not Count" doses are rows too.
                            <td rowSpan={group.items.length + group.items.filter(it => reasonBarFor(it.row)).length} className={styles.vaccineCell}>
                              {byAge ? <AgeCell group={group} /> : (
                                <>
                                  <span className={styles.vaccineName}>
                                    {antigen.label}
                                    {/* Rotavirus series length, editable until the series is met. */}
                                    {antigen.seriesChoice && antigen.status !== CIS_ANTIGEN_STATUS.met && onSeriesDosesChange && (
                                      <SeriesDosesPicker choice={antigen.seriesChoice} onChange={(n) => onSeriesDosesChange(antigen.key, n)} />
                                    )}
                                  </span>
                                  <span className={styles.vaccineMeta}>
                                    {antigen.measureCode} • {Math.min(antigen.valid.length, antigen.required)} of {antigen.requiredLabel}
                                  </span>
                                </>
                              )}
                            </td>
                          )}
                          {byAge && (
                            <td className={`${styles.doseCell} ${ACCENT[row.status] || ''}`}>{antigen.label}</td>
                          )}
                          <td className={byAge ? undefined : `${styles.doseCell} ${ACCENT[row.status] || ''}`}>
                            {byAge ? (
                              <>
                                <span className={styles.primary}>Dose {row.number}</span>
                                <span className={styles.subtle}>
                                  {fmtDate(row.start)}{row.recommendedEnd ? ` – ${fmtDate(row.recommendedEnd)}` : ''}
                                </span>
                              </>
                            ) : <>Dose {row.number}</>}
                            {row.extra && <span className={styles.subtle}>Extra</span>}
                          </td>
                          {!byAge && (
                            <td>
                              <span className={styles.primary}>{row.recommended}</span>
                              <span className={styles.subtle}>
                                {fmtDate(row.start)}{row.recommendedEnd ? ` – ${fmtDate(row.recommendedEnd)}` : ''}
                              </span>
                            </td>
                          )}
                          <td><span className={styles.primary}>{fmtDate(row.earliest)}</span></td>
                          <td>
                            <DoseDateField row={row} label={antigen.label} dob={result.dob} onChange={(iso) => changeDate(antigen, row, iso)} />
                            <DoseAppointmentChip
                              match={appointmentForDose(appointments, antigen.key, row)}
                              onOpen={(appt) => onOpenSchedule?.(appt)}
                            />
                          </td>
                          <td>
                            <CisStatusBadge map={DOSE_BADGE} status={row.status} hideIcon />
                            {row.reason && !bar && <span className={styles.reasonText}>{row.reason}</span>}
                          </td>
                          <td className={styles.noteCell}>
                            <DoseNoteInput
                              key={savedNote}
                              saved={savedNote}
                              label={`${antigen.label} dose ${row.number} note`}
                              onSave={(text) => saveNote(antigen, row, text)}
                            />
                          </td>
                        </tr>
                        {/* Same reason bar as the Vaccine Calendar tab. */}
                        {bar && (
                          <tr className={styles.reasonBarRow}>
                            <td colSpan={6}>
                              <Banner tone={bar.tone} size="sm" icon={bar.icon} className={`${styles.reasonBar} ${bar.quiet ? styles.reasonBarQuiet : ''}`}>
                                {row.status}: {row.reason}.
                              </Banner>
                            </td>
                          </tr>
                        )}
                        </Fragment>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
            {groups.length === 0 && <p className={styles.empty}>No doses match this status.</p>}
          </div>
          <p className={styles.lastSaved}>
            <Icon name="solar:history-linear" size={14} color="var(--neutral-300)" />
            {saved
              ? <>Last saved by <strong>{lastSaved.actor}</strong> on <strong>{saved.date}</strong> at <strong>{saved.time}</strong></>
              : 'Not saved yet'}
          </p>

        {confirmRemove && (
          <ConfirmDialog
            variant="warning"
            title={`Remove ${confirmRemove.antigen.label} dose ${confirmRemove.row.number}?`}
            description={[
              `The dose given ${fmtDate(confirmRemove.row.record.date)} will be removed from the patient's immunization history.`,
              confirmRemove.shared.length ? `This ${confirmRemove.row.record.title} record also counts for ${confirmRemove.shared.join(', ')}, so it is removed there too.` : '',
            ].filter(Boolean).join(' ')}
            confirmLabel="Remove"
            onConfirm={() => {
              const { antigen, row } = confirmRemove;
              setConfirmRemove(null);
              onSave({ deletes: [row.record.id], summary: `${antigen.label} dose ${row.number} date cleared` });
            }}
            onCancel={() => setConfirmRemove(null)}
          />
        )}

    </Drawer>
  );
}

// Age group cell (View by Age): age, the date the child reaches it, and
// how many of its doses are given.
function AgeCell({ group }) {
  const given = group.items.filter(({ row }) => isGiven(row.status)).length;
  return (
    <>
      <span className={styles.vaccineName}>
        {group.age === 0 ? 'At birth' : `${group.age} Month${group.age === 1 ? '' : 's'}`}
      </span>
      <span className={styles.vaccineMeta}>{fmtDate(group.items[0].row.start)}</span>
      <span className={styles.vaccineMeta}>{given} of {group.items.length} given</span>
    </>
  );
}
