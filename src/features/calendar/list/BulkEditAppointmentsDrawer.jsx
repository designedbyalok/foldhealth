import { useEffect, useMemo, useState } from 'react';
import { Drawer } from '../../../components/Drawer/Drawer';
import { Avatar } from '../../../components/Avatar/Avatar';
import { CollapsibleContent } from '../../../components/Collapsible/Collapsible';
import { Icon } from '../../../components/Icon/Icon';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Button } from '../../../components/Button/Button';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { DatePicker } from '../../../components/DatePicker/DatePicker';
import { Banner } from '../../../components/Banner/Banner';
import { Link } from '../../../components/Link/Link';
import { Select } from '../../../components/Select/Select';
import { Switch } from '../../../components/Switch/Switch';
import { Textarea } from '../../../components/Textarea/Textarea';
import { Tooltip } from '../../../components/Tooltip/Tooltip';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
import { holidaysForUser } from '../../holidays/holidayUtils';
import { initialsOf, sameName, samePerson } from '../../ooo/oooUtils';
import { apptSpan } from '../../ooo/reassignUtils';
import { BROWSER_TIMEZONE, getTodayInTimezone } from '../calendarUtils';
import { minutesToTime, nearestOpenSlot, noSlotsReason, openSlots } from '../openSlots';
import { dateLabel, durationMin, sessionRows, timeRangeLabel } from './appointmentList';
import { availableAt, awayDuring, providerAllLocations, providerLocations, segmentsAt } from './locationChecks';
import { UserProfileBanner } from '../../settings/account/users/UserProfileBanner';
import { FALLBACK_APPOINTMENT_TYPES } from '../../../components/ScheduleDrawer/scheduleDrawerConstants';
import styles from './AppointmentListView.module.css';

// Each field, the appointments column it saves to, and its preview label.
const FIELDS = [
  { key: 'mode', label: 'Appointment Mode' },
  { key: 'location', label: 'Location' },
  { key: 'member_instruction', label: 'Instructions for Patients' },
  { key: 'staff_instruction', label: 'Instructions for Staff' },
];
const EMPTY = Object.fromEntries(FIELDS.map(f => [f.key, '']));
const MODES = ['In-person', 'Virtual'];

// "2026-10-02" → "10-02-2026", the format appointments store.
const toApptDate = (iso) => { const [y, m, d] = iso.split('-'); return `${m}-${d}-${y}`; };
const spanOf = (iso, minutes, length) => {
  const [y, m, d] = iso.split('-').map(Number);
  const start = new Date(y, m - 1, d).getTime() + minutes * 60000;
  return { start, end: start + length * 60000 };
};
// A row of the update: an appointment, or a group session and its members.
const membersOf = (item) => item.members || [item];
// A group session shows a group icon; one member, their initials.
const rowAvatar = (item) => (item.isGroup
  ? <Avatar type="icon" iconName="solar:users-group-rounded-linear" variant="patient" size="M" />
  : <Avatar variant="patient" size="M" initials={initialsOf(item.patient_name)} />);

/**
 * Bulk Edit Appointments (Figma Tasks 1413:41609): one provider's selected
 * appointments given a new mode, location or instructions. A
 * field left empty stays as it is on each appointment. Next opens the
 * Bulk Update Preview, where Apply Changes saves. The appointments it applies
 * to are listed on both steps (folded away on the first), and ✕ leaves one out.
 *
 * Location lists only where the provider has availability on these days.
 * On the preview, Action Needed lists each appointment (or group session)
 * the new location causes a problem for, with its location and time now and
 * after: it can take its own location instead; a time the provider isn't
 * available for there needs a new one before Apply Changes; a patient not
 * linked to the location is flagged. ✕ leaves one out of the update.
 *
 * @param {{ id, name }} props.provider
 * @param {object[]} props.appointments
 * @param {() => void} props.onDone  – after a save
 * @param {() => void} props.onClose
 */
export function BulkEditAppointmentsDrawer({ provider, appointments, onDone, onClose }) {
  const platformUsers = useAppStore(s => (s.platformPeople?.length ? s.platformPeople : s.platformUsers));
  const updateDetails = useAppStore(s => s.updateAppointmentsDetails);
  const reschedule = useAppStore(s => s.rescheduleAppointments);
  const everyone = useAppStore(s => s.appointments);
  const oooRecords = useAppStore(s => s.oooRecords);
  const segments = useAppStore(s => s.userAvailability);
  const fetchUserAvailability = useAppStore(s => s.fetchUserAvailability);
  const holidayConfigs = useAppStore(s => s.holidayConfigs);
  const fetchHolidayConfigs = useAppStore(s => s.fetchHolidayConfigs);
  const allPatients = useAppStore(s => s.allPatients);
  const storeTypes = useAppStore(s => s.appointmentTypes);
  const fetchAppointmentTypes = useAppStore(s => s.fetchAppointmentTypes);
  useEffect(() => { if (!storeTypes?.length) fetchAppointmentTypes?.(); }, [storeTypes?.length, fetchAppointmentTypes]);
  const fetchAllPatients = useAppStore(s => s.fetchAllPatients);
  useEffect(() => { fetchUserAvailability?.(); fetchHolidayConfigs?.(); }, [fetchUserAvailability, fetchHolidayConfigs]);
  useEffect(() => { if (!allPatients?.length) fetchAllPatients?.(); }, [allPatients?.length, fetchAllPatients]);
  const holidays = useMemo(() => holidaysForUser(holidayConfigs, platformUsers, provider), [holidayConfigs, platformUsers, provider]);
  const locationOptions = useMemo(
    () => providerLocations({ segments, provider, appointments, holidays }),
    [segments, provider, appointments, holidays],
  );
  const today = getTodayInTimezone(BROWSER_TIMEZONE);
  const [values, setValues] = useState(EMPTY);
  // New times for Action Needed rows: { [row id]: { date: ISO, minutes } }.
  const [picks, setPicks] = useState({});
  const [previewing, setPreviewing] = useState(false);
  // After Apply Changes: { updated: rows, failed: rows }, shown as Confirmation.
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dropped, setDropped] = useState(() => new Set());
  const [confirmClose, setConfirmClose] = useState(false);
  // Discard closes the drawer from outside, with its close animation.
  const [dismissed, setDismissed] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [previewListOpen, setPreviewListOpen] = useState(true);
  // An Action Needed row's own location, when moved off the new one.
  const [locFor, setLocFor] = useState({});
  // Action Needed rows whose details are folded.
  const [folded, setFolded] = useState(() => new Set());
  const kept = appointments.filter(a => !dropped.has(a.id));
  // "At Clinic" (older rows) is In-person.
  const modeOf = (a) => (!a.mode || sameName(a.mode, 'At Clinic') ? 'In-person' : a.mode);
  // The modes an appointment's type allows ("In-person/Virtual" is both),
  // from the saved types, else the built-in list; a type in neither allows either.
  const findType = (list, a) => (list || []).find(x => (a.appointment_type_id && x.id === a.appointment_type_id) || sameName(x.name, a.appointment_type_name));
  const modesFor = (a) => {
    const t = findType(storeTypes, a) || findType(FALLBACK_APPOINTMENT_TYPES, a);
    const allowed = MODES.filter(m => String(t?.mode || '').split('/').some(x => sameName(x, m)));
    return allowed.length ? allowed : MODES;
  };
  // A mode is offered only when every selected appointment's type allows it;
  // otherwise its tooltip names the types that don't.
  // A mode they're all in already would change nothing, so it's off too.
  const modeOptions = MODES.map((m) => {
    const cant = [...new Set(kept.filter(a => !modesFor(a).includes(m)).map(a => a.appointment_type_name || 'Appointment'))];
    if (cant.length) return { value: m, label: m, disabled: true, tooltip: `${cant.join(', ')} ${cant.length === 1 ? "doesn't" : "don't"} allow ${m.toLowerCase()} appointments` };
    if (kept.length && kept.every(a => modeOf(a) === m)) return { value: m, label: m, disabled: true, tooltip: `All appointments are already ${m}` };
    return { value: m, label: m };
  });
  // Nothing to change to: no mode every type allows, or all are in the only one.
  const allowedModes = MODES.filter(m => kept.every(a => modesFor(a).includes(m)));
  const modeLocked = !allowedModes.some(m => kept.some(a => modeOf(a) !== m));
  const modeLockedNote = allowedModes.length
    ? `These appointments' types only allow ${allowedModes[0].toLowerCase()} appointments, so mode can't be changed.`
    : 'No common mode present for all appointments';
  const set = (key) => (v) => {
    setValues(p => ({ ...p, [key]: v }));
    // Times and locations were picked for the old location.
    if (key === 'location') { setPicks({}); setLocFor({}); }
    // New times were picked for the old mode.
    if (key === 'mode') { setPicks({}); setLocFor({}); }
    if (key === 'mode' && v === 'Virtual') setValues(p => ({ ...p, location: '' }));
    // Going in-person needs a location: prefill it when the provider has only one.
    if (key === 'mode' && v === 'In-person' && locationOptions.length === 1 && kept.some(a => modeOf(a) !== v)) {
      setValues(p => ({ ...p, location: p.location || locationOptions[0] }));
    }
  };
  const drop = (items) => setDropped(d => new Set([...d, ...items.flatMap(membersOf).map(a => a.id)]));

  // What the new location affects. A row is listed when the new location
  // causes it a problem; it can then take its own location, and its problems
  // are checked against wherever it's going now.
  const loc = values.location.trim();
  const patientOf = (a) => (allPatients || []).find(p => (a.patient_id && String(p.id) === String(a.patient_id)) || sameName(p.name, a.patient_name));
  // A patient is linked to a location by their record's location, or by
  // being booked or seen there (records hold a city, not a practice), so the
  // location they're booked at now always counts.
  const samePatient = (a, b) => (a.patient_id && String(b.patient_id) === String(a.patient_id)) || sameName(b.patient_name, a.patient_name);
  const linked = (a, l) => sameName(patientOf(a)?.location, l)
    || (everyone || []).some(b => sameName(b.location, l) && samePatient(a, b));
  // The provider out of office over its current time needs a new time too.
  const away = (it) => !!awayDuring({ oooRecords, provider, appt: it });
  const problemsAt = (it, l) => ({
    slot: !availableAt({ segments, provider, location: l, appt: it, holidays }) || away(it),
    unlinked: membersOf(it).filter(a => !linked(a, l)),
  });
  // A row stays on the new location unless its patient isn't linked there;
  // then it waits for a location they are linked to.
  const itemLoc = (it) => (it.id in locFor ? locFor[it.id] : (membersOf(it).every(a => linked(a, loc)) ? loc : ''));
  // A row's location choices: any location the provider has availability at
  // for its type (not just on these dates), where every member is linked; a
  // new time can then be picked there.
  const allLocations = useMemo(() => providerAllLocations({ segments, provider }), [segments, provider]);
  const locationsFor = (it) => providerAllLocations({ segments, provider, type: it.appointment_type_name })
    .filter(l => membersOf(it).every(a => linked(a, l)));
  // Going virtual: the appointment can happen wherever the provider is, so
  // its time needs their availability at any of their locations. Those
  // already virtual keep their times.
  const toVirtual = values.mode === 'Virtual';
  const availableAnywhere = (it) => !away(it) && allLocations.some(l => availableAt({ segments, provider, location: l, appt: it, holidays }));
  const flagged = loc
    ? sessionRows(kept).filter((it) => { const p = problemsAt(it, loc); return p.slot || p.unlinked.length; })
    : toVirtual ? sessionRows(kept.filter(a => modeOf(a) !== 'Virtual')).filter(it => !availableAnywhere(it)) : [];
  const hasPick = (it) => picks[it.id]?.date && picks[it.id].minutes != null;
  const moving = new Set(kept.map(a => a.id));
  // A row's open slots at its location on `date`: hours open to its type,
  // without times picked on other rows or when its patients are already
  // booked elsewhere.
  const slotsOn = (it, date, chosen = picks) => {
    const type = it.appointment_type_name;
    const segs = toVirtual ? allLocations.flatMap(l => segmentsAt(segments, provider, l, type)) : segmentsAt(segments, provider, itemLoc(it), type);
    const taken = flagged
      .filter(o => o.id !== it.id && chosen[o.id]?.date && chosen[o.id].minutes != null)
      .map(o => spanOf(chosen[o.id].date, chosen[o.id].minutes, durationMin(o)));
    const patientBusy = (everyone || [])
      .filter(b => b.status !== 'Cancelled' && !moving.has(b.id) && membersOf(it).some(a => samePatient(a, b)))
      .map(apptSpan);
    return openSlots({
      date, person: provider, durationMin: durationMin(it),
      segments: segs, holidays, oooRecords, appointments: everyone, ignoreIds: moving, taken,
    }).filter((sl) => {
      const { start, end } = spanOf(date, sl.minutes, durationMin(it));
      return !patientBusy.some(x => start < x.end && end > x.start);
    });
  };
  // A time the provider isn't available for blocks Apply until a new one is
  // picked (or the row is removed); a patient not linked is a flag only.
  const needsTime = toVirtual ? flagged : flagged.filter(it => itemLoc(it) && problemsAt(it, itemLoc(it)).slot);
  const unpicked = needsTime.filter(it => !hasPick(it)).length;
  const unplaced = toVirtual ? 0 : flagged.filter(it => !itemLoc(it)).length;
  const blocked = unpicked + unplaced;
  const blockedTip = [
    unplaced ? `pick a location for ${unplaced} ${unplaced === 1 ? 'appointment' : 'appointments'}` : '',
    unpicked ? `pick a new time for ${unpicked} ${unpicked === 1 ? 'appointment' : 'appointments'}` : '',
  ].filter(Boolean).join(' and ');
  // "Autofill Slots", as in Bulk Reschedule, on one card: the open slot
  // nearest its own time, never one another row already has. It can still
  // be changed.
  const autofill = (rows) => {
    const next = { ...picks };
    let missing = 0;
    rows.forEach((it) => {
      delete next[it.id];
      const slot = nearestOpenSlot(it, iso => slotsOn(it, iso, next));
      if (slot) next[it.id] = slot;
      else missing += 1;
    });
    setPicks(next);
    if (missing) toast.error(`No open slot found in the next 90 days for ${missing} ${missing === 1 ? 'appointment' : 'appointments'}.`);
  };
  const moveLocation = (it, l) => {
    setLocFor(p => ({ ...p, [it.id]: l }));
    setPicks(p => ({ ...p, [it.id]: undefined }));
  };

  const person = (platformUsers || []).find(u => samePerson(u, provider));
  const role = person?.role || person?.clinicalRoles?.[0] || 'Provider';
  const changes = FIELDS.filter(f => values[f.key].trim());
  // A picked mode applies to all; the ones already in it don't change.
  const modeChanging = values.mode ? kept.filter(a => modeOf(a) !== values.mode) : [];
  // Location doesn't apply to virtual appointments.
  const virtual = values.mode === 'Virtual';
  // Virtual appointments going in-person need somewhere to be; the location
  // checks then run on it as on any location change.
  const goingInPerson = values.mode === 'In-person' ? sessionRows(modeChanging).length : 0;
  const needsLocation = goingInPerson > 0 && !loc;
  // Counted as the Selected appointments list counts them: a group session is one.
  const changingRows = sessionRows(modeChanging).length;
  const stayingRows = sessionRows(kept).length - changingRows;
  // Under the Mode field once one is picked: what changes, and what's already there.
  const modeNote = values.mode ? [
    `${changingRows} ${changingRows === 1 ? 'appointment' : 'appointments'} will change from ${[...new Set(modeChanging.map(modeOf))].join(' and ') || values.mode} to ${values.mode}.`,
    stayingRows > 0 ? `${stayingRows} ${stayingRows === 1 ? 'is' : 'are'} already ${values.mode}.` : '',
  ].filter(Boolean).join(' ') : undefined;
  const n = kept.length;
  const flaggedIds = new Set(flagged.map(it => it.id));
  const ready = sessionRows(kept).filter(it => !flaggedIds.has(it.id));
  // Who the change applies to, a group session as one entry; ✕ leaves one
  // out (on both steps).
  const applyList = (rows) => (
    <div className={styles.applyList}>
      {rows.map((a) => {
        const when = a.isGroup
          ? `${a.members.length} members • ${dateLabel(a.date)}, ${timeRangeLabel(a)}`
          : [`${dateLabel(a.date)}, ${timeRangeLabel(a)}`, a.appointment_type_name].filter(Boolean).join(' • ');
        return (
          <div key={a.id} className={styles.applyRow}>
            <span className={styles.member}>
              {rowAvatar(a)}
              <span className={styles.memberText}>
                <span className={styles.memberName}>{a.isGroup ? a.appointment_type_name : (a.patient_name || 'Member')}</span>
                <span className={styles.memberSub} title={when}>{when}</span>
              </span>
            </span>
            <ActionButton
              icon="solar:close-linear"
              size="sm"
              tooltip="Remove from this update"
              tooltipLeft
              onClick={() => drop([a])}
            />
          </div>
        );
      })}
    </div>
  );

  // Who it applies to, in its own card (like Reassign's "No users available
  // for reassignment"): every one on the first step, folded so the fields
  // stay first; on the preview, only those not in Action Needed, so each
  // appointment shows once.
  const appliesCard = (title, rows, open, setOpen) => (
    <div className={styles.appliesTo}>
      <button type="button" className={styles.appliesToggle} aria-expanded={open} onClick={() => setOpen(o => !o)}>
        {title}
        <span className={styles.countBadge}>{rows.length}</span>
        <Icon name="solar:alt-arrow-right-linear" size={12} color="var(--neutral-300)" className={open ? `${styles.chevron} ${styles.chevronOpen}` : styles.chevron} />
      </button>
      <CollapsibleContent open={open}>
        <div className={styles.appliesBody}>{applyList(rows)}</div>
      </CollapsibleContent>
    </div>
  );

  // Unsaved changes: the drawer stays open under a Discard confirm.
  const beforeClose = () => {
    if (!changes.length || result) return true;
    setConfirmClose(true);
    return false;
  };

  const apply = async () => {
    if (!changes.length || !n || blocked || saving) return;
    setSaving(true);
    const rows = sessionRows(kept);
    const failed = new Set();
    const ok = await updateDetails(kept, Object.fromEntries(changes.map(f => [f.key, values[f.key].trim()])));
    if (!ok) rows.forEach(r => failed.add(r.id));
    // Action Needed rows given their own location.
    for (const it of toVirtual ? [] : flagged.filter(f => itemLoc(f) !== loc && !failed.has(f.id))) {
      if (!await updateDetails(membersOf(it), { location: itemLoc(it) })) failed.add(it.id);
    }
    // Action Needed rows move to the times picked for them; a row whose
    // members didn't all land on their new time failed.
    const timed = needsTime.filter(it => !failed.has(it.id));
    const moves = timed.flatMap((it) => {
      const { date, minutes } = picks[it.id];
      return membersOf(it).map(a => ({ appt: a, date: toApptDate(date), time_start: minutesToTime(minutes), time_end: minutesToTime(minutes + durationMin(it)) }));
    });
    if (moves.length && await reschedule(moves)) {
      const now = new Map((useAppStore.getState().appointments || []).map(a => [a.id, a]));
      moves.forEach((m) => {
        const a = now.get(m.appt.id);
        if (!a || a.date !== m.date || a.time_start !== m.time_start) {
          const row = timed.find(it => membersOf(it).some(x => x.id === m.appt.id));
          if (row) failed.add(row.id);
        }
      });
    }
    setSaving(false);
    setResult({ updated: rows.filter(r => !failed.has(r.id)), failed: rows.filter(r => failed.has(r.id)) });
    onDone?.();
  };

  return (
    <>
      <Drawer
        title={result ? 'Confirmation' : previewing ? 'Bulk Update Preview' : 'Bulk Edit Appointments'}
        onClose={onClose}
        beforeClose={beforeClose}
        dismissed={dismissed}
        // Only ✕ or Escape close it; a stray click outside shouldn't.
        closeOnOverlayClick={false}
        noCloseDivider={!result}
        // Whose appointments these are, as Bulk Reschedule shows them.
        banner={result ? null : (
          <UserProfileBanner
            user={{ initials: initialsOf(provider.name), name: provider.name }}
            subtitle={role}
            actions={false}
          />
        )}
        headerRight={result ? null : previewing ? (
          <>
            <Button variant="soft" disabled={saving} onClick={() => setPreviewing(false)}>Previous</Button>
            <Tooltip label={blocked ? `${blockedTip[0].toUpperCase()}${blockedTip.slice(1)}, or remove ${blocked === 1 ? 'it' : 'them'}` : ''} align="right" placement="bottom" className={styles.saveTip}>
              <span className={blocked ? styles.saveBlocked : undefined}>
                <Button variant="solid" disabled={saving || !n || !!blocked} onClick={apply}>Apply Changes</Button>
              </span>
            </Tooltip>
            <span className={styles.headerDivider} aria-hidden="true" />
          </>
        ) : (
          <>
            {/* A disabled button gets no hover, so its wrapper carries the tooltip. */}
            <Tooltip label={!changes.length ? 'Enter at least one change to continue' : needsLocation ? 'Pick a location for the appointments changing to in-person' : ''} align="right" placement="bottom" className={styles.saveTip}>
              <span className={changes.length && !needsLocation ? undefined : styles.saveBlocked}>
                <Button variant="solid" disabled={!changes.length || !n || needsLocation} onClick={() => { setPreviewListOpen(!flagged.length); setPreviewing(true); }}>Next</Button>
              </span>
            </Tooltip>
            <span className={styles.headerDivider} aria-hidden="true" />
          </>
        )}
      >
        {result ? (
          // Figma Tasks 1424:13811: what was saved, and what wasn't.
          <div className={styles.confirm}>
            <div className={styles.confirmHero} aria-hidden="true">
              <span className={result.failed.length && !result.updated.length ? `${styles.confirmMark} ${styles.confirmMarkFailed}` : styles.confirmMark}>
                <Icon name={result.failed.length && !result.updated.length ? 'solar:close-circle-linear' : 'solar:check-circle-linear'} size={64} />
              </span>
            </div>
            <div className={styles.confirmCard}>
              <span className={styles.confirmTitle}>
                {!result.failed.length ? 'Bulk Update Successful' : result.updated.length ? 'Bulk Update Partially Successful' : 'Bulk Update Failed'}
              </span>
              <span className={styles.confirmCounts}>
                {result.updated.length > 0 && <span className={styles.confirmOk}>{result.updated.length} Successfully Updated</span>}
                {result.updated.length > 0 && result.failed.length > 0 && <span className={styles.confirmDot} aria-hidden="true">•</span>}
                {result.failed.length > 0 && (
                  <button type="button" className={styles.confirmFailed} onClick={() => document.getElementById('bulk-edit-failed')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                    {result.failed.length} {result.failed.length === 1 ? 'Update' : 'Updates'} Failed
                  </button>
                )}
              </span>
            </div>

            {result.failed.length > 0 && (
              <div id="bulk-edit-failed" className={styles.conflicts}>
                <div className={styles.conflictsHead}>
                  <span className={styles.conflictsTitle}>
                    Bulk Update Failed for the Following Appointments
                    <span className={styles.countBadge}>{result.failed.length}</span>
                  </span>
                </div>
                {result.failed.map((it) => {
                  const when = [
                    it.isGroup ? `${it.members.length} members` : null,
                    `${dateLabel(it.date)}, ${timeRangeLabel(it)}`,
                    it.isGroup ? null : it.appointment_type_name,
                  ].filter(Boolean).join(' • ');
                  return (
                    <div key={it.id} className={`${styles.conflictCard} ${styles.conflictHead}`}>
                      <span className={styles.member}>
                        {rowAvatar(it)}
                        <span className={styles.memberText}>
                          <span className={styles.memberName}>{it.isGroup ? it.appointment_type_name : (it.patient_name || 'Member')}</span>
                          <span className={styles.memberSub} title={when}>{when}</span>
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : previewing ? (
          <div className={styles.bulkEdit}>
            <table className={styles.changeTable}>
              <colgroup>
                <col className={styles.changeFieldCol} />
                <col />
              </colgroup>
              <thead>
                <tr>
                  <th>Fields</th>
                  <th>Change To</th>
                </tr>
              </thead>
              <tbody>
                {changes.map(f => (
                  <tr key={f.key}>
                    <td className={styles.changeField}>{f.label}</td>
                    <td className={styles.changeValue}>{values[f.key].trim()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {flagged.length > 0 && (
              // Figma Tasks 1413:40970: the change's conflicts, one card each,
              // with what each field is now and what it'll be.
              <div className={styles.conflicts}>
                <div className={styles.conflictsHead}>
                  <span className={styles.conflictsTitle}>
                    Action Needed
                    <span className={styles.countBadge}>{flagged.length}</span>
                  </span>
                  <Switch
                    label="Expand All"
                    checked={folded.size === 0}
                    onChange={(on) => setFolded(on ? new Set() : new Set(flagged.map(it => it.id)))}
                  />
                </div>
                {flagged.map((it) => {
                  // A row going virtual has no location, only its time to fix.
                  const l = toVirtual ? null : itemLoc(it);
                  const now = toVirtual ? { slot: true, unlinked: [] } : l ? problemsAt(it, l) : { slot: false, unlinked: [] };
                  const choices = locationsFor(it);
                  const pick = picks[it.id] || {};
                  const timeError = now.slot && !hasPick(it);
                  const errors = (toVirtual || l ? 0 : 1) + (timeError ? 1 : 0);
                  const open = !folded.has(it.id);
                  const who = it.isGroup ? it.appointment_type_name : (it.patient_name || 'Member');
                  // When it is now, and its type (a session's name is its title).
                  const when = [
                    it.isGroup ? `${it.members.length} members` : null,
                    `${dateLabel(it.date)}, ${timeRangeLabel(it)}`,
                    it.isGroup ? null : it.appointment_type_name,
                  ].filter(Boolean).join(' • ');
                  // Generic, like the time error: one patient, or some of a group's.
                  const many = problemsAt(it, loc).unlinked.length > 1;
                  const subject = many ? "Some patients aren't" : "Patient isn't";
                  const locError = l ? undefined : choices.length
                    ? `${subject} available at this location. Please pick a location ${many ? 'they are all' : 'they are'} available at.`
                    : `${subject} available at any of the user's locations. Please remove this appointment from the bulk update.`;
                  const setPick = (next) => setPicks(p => ({ ...p, [it.id]: { ...p[it.id], ...next } }));
                  const toggle = () => setFolded((f) => { const next = new Set(f); if (next.has(it.id)) next.delete(it.id); else next.add(it.id); return next; });
                  return (
                    <div key={it.id} className={styles.conflictCard}>
                      <div className={styles.conflictHead}>
                        <span className={styles.member}>
                          {rowAvatar(it)}
                          <span className={styles.memberText}>
                            <span className={styles.memberName}>{who}</span>
                            <span className={styles.memberSub} title={when}>{when}</span>
                          </span>
                        </span>
                        <ActionButton icon="solar:close-linear" size="sm" tooltip="Remove from this update" tooltipLeft onClick={() => drop([it])} />
                      </div>
                      <div className={styles.conflictBody}>
                        <div className={styles.conflictTable}>
                          <div className={styles.conflictTitleRow}>
                            <span className={errors ? styles.conflictErrors : styles.conflictOk}>
                              {errors ? `${errors} ${errors === 1 ? 'Error' : 'Errors'} Identified` : 'Resolved'}
                            </span>
                            <span className={styles.conflictsTools}>
                              {now.slot && (
                                <>
                                  <Button variant="outline" size="sm" leadingIconElement={<Icon name="custom:ai" size={14} />} onClick={() => autofill([it])}>
                                    Autofill Slots
                                  </Button>
                                  <span className={styles.headerDivider} aria-hidden="true" />
                                </>
                              )}
                              <Link size="xs" onClick={toggle}>{open ? 'Hide Details' : 'Show Details'}</Link>
                            </span>
                          </div>
                          {open && (
                            <div className={styles.conflictGrid}>
                              <span className={styles.conflictTh}>Fields</span>
                              <span className={styles.conflictTh}>Value</span>

                              {!toVirtual && (
                                <>
                                  <span className={styles.conflictField}>Location</span>
                                  <Select
                                    portal
                                    searchable
                                    placeholder="Select Location"
                                    options={choices.map(o => ({ value: o, label: o }))}
                                    value={l || undefined}
                                    onValueChange={(v) => moveLocation(it, v)}
                                    emptyText="No locations the patient is available at"
                                    errorText={locError}
                                  />
                                </>
                              )}

                              {now.slot && (
                                <>
                                  <span className={styles.conflictField}>Date &amp; Time</span>
                                  <span className={styles.conflictPick}>
                                    <DatePicker
                                      aria-label={`New date for ${who}`}
                                      value={pick.date || ''}
                                      min={today}
                                      isDayDisabled={(iso) => slotsOn(it, iso).length === 0 && noSlotsReason({ date: iso, person: provider, holidays, oooRecords })}
                                      onSelect={(date) => setPick({ date, minutes: null })}
                                    />
                                    <Select
                                      portal
                                      placeholder="Select Slot"
                                      disabled={!pick.date}
                                      options={pick.date ? slotsOn(it, pick.date).map(sl => ({
                                        value: String(sl.minutes),
                                        label: timeRangeLabel({ time_start: minutesToTime(sl.minutes), time_end: minutesToTime(sl.minutes + durationMin(it)) }),
                                      })) : []}
                                      value={pick.minutes != null ? String(pick.minutes) : undefined}
                                      onValueChange={(v) => setPick({ minutes: Number(v) })}
                                      emptyText="No open slots on this day"
                                      invalid={timeError}
                                    />
                                    {timeError && (
                                      <span className={styles.conflictError}>
                                        {away(it)
                                          ? 'User is out of office at this time. Please pick a new time.'
                                          : toVirtual ? "Current time isn't available for virtual mode. Pick a new time." : "User isn't available at this time at this location. Please pick a new time."}
                                      </span>
                                    )}
                                  </span>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {ready.length > 0 && appliesCard('Ready to Update', ready, previewListOpen, setPreviewListOpen)}
          </div>
        ) : (
          <div className={styles.bulkEdit}>
            {/* Location doesn't apply to virtual appointments: it and its note
                fold away, easing the fields below into place. */}
            <CollapsibleContent open={!virtual} className={styles.foldAbove}>
              <Banner tone="info" size="sm">
                Only locations where {provider.name} has availability on these dates are listed for location change.
              </Banner>
            </CollapsibleContent>
            <Select
              label="Change Appointment Mode"
              placeholder="Select Mode"
              options={modeOptions}
              value={values.mode || undefined}
              onValueChange={set('mode')}
              disabled={modeLocked}
              helperText={modeLocked ? modeLockedNote : modeNote}
              portal
            />
            <CollapsibleContent open={!virtual} className={styles.foldBelow}>
              <Select
                label="Change Location"
                placeholder="Select Location"
                options={locationOptions.map(l => ({ value: l, label: l }))}
                value={values.location || undefined}
                onValueChange={set('location')}
                emptyText="No locations with availability on these dates"
                required={goingInPerson > 0}
                searchable
                portal
              />
            </CollapsibleContent>
            <Textarea
              title="Instructions for Patients"
              placeholder="Add Instructions for Patients"
              value={values.member_instruction}
              onValueChange={set('member_instruction')}
            />
            <Textarea
              title="Instructions for Staff"
              placeholder="Add Instructions for Staff"
              value={values.staff_instruction}
              onValueChange={set('staff_instruction')}
            />
            {appliesCard('Selected appointments', sessionRows(kept), listOpen, setListOpen)}
          </div>
        )}
      </Drawer>
        {confirmClose && (
          <ConfirmDialog
            title="Discard changes?"
            description="Your changes to these appointments won't be saved."
            confirmLabel="Discard"
            cancelLabel="Keep editing"
            onCancel={() => setConfirmClose(false)}
            onConfirm={() => { setConfirmClose(false); setDismissed(true); }}
          />
        )}
    </>
  );
}
