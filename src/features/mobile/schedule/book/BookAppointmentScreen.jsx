import { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar } from '../../../../components/Avatar/Avatar';
import { BottomSheet, BottomSheetItem } from '../../../../components/BottomSheet/BottomSheet';
import { Button } from '../../../../components/Button/Button';
import { Icon } from '../../../../components/Icon/Icon';
import { Input } from '../../../../components/Input/Input';
import { Textarea } from '../../../../components/Textarea/Textarea';
import { toast } from '../../../../components/Toast/sonnerToast';
import { FALLBACK_APPOINTMENT_TYPES } from '../../../../components/ScheduleDrawer/scheduleDrawerConstants';
import { useLocationOptions } from '../../../../components/ScheduleDrawer/useLocationOptions';
import { trackFunnel } from '../../../../lib/tracking';
import { useAppStore } from '../../../../store/useAppStore';
import { sameName, samePerson } from '../../../ooo/oooUtils';
import { minutesToTime } from '../../../calendar/openSlots';
import { durationMin as apptDurationMin, lockedReason, modeLabel } from '../../../calendar/list/appointmentList';
import { MobileSubHeader } from '../../MobileHeader';
import { MobileEmpty, MobileListSkeleton } from '../../MobileParts';
import { useMobileNav } from '../../MobileNavContext';
import { initialsOf, patientLine } from '../../mobileFormat';
import { appointmentStart } from '../appointmentTime';
import { PickerField } from './PickerField';
import { SlotPicker } from './SlotPicker';
import { apptToIso, isoToAppt, typeDurationMin, useBookableUsers, useOpenSlots } from './scheduling';
import common from '../../mobile.module.css';
import styles from './BookAppointmentScreen.module.css';

// The desktop drawer's calendar for a type, by its colour (useScheduleDrawer).
const COLOR_TO_CAL = { '#D9A50B': 'awv', '#8C5AE2': 'followup', '#009B53': 'specialty', '#145ECC': 'telehealth' };
// Booking saves the drawer's values: a Virtual type books "Virtual", any
// other "At Clinic". Editing an existing visit saves the List view's
// In-person / Virtual, limited to what its type allows (BulkEditAppointmentsDrawer).
const BOOK_MODES = [{ value: 'At Clinic', label: 'In-person', icon: 'solar:buildings-linear' }, { value: 'Virtual', label: 'Virtual', icon: 'solar:monitor-linear' }];
const EDIT_MODES = [{ value: 'In-person', label: 'In-person', icon: 'solar:buildings-linear' }, { value: 'Virtual', label: 'Virtual', icon: 'solar:monitor-linear' }];
const isVirtual = (mode) => /virtual|tele/i.test(mode || '');

const findType = (list, a) => (list || []).find(x => (a.appointment_type_id && x.id === a.appointment_type_id) || sameName(x.name, a.appointment_type_name));

/**
 * Book an appointment from the phone (Figma 1082:58665), or, given
 * `appointmentId`, reschedule one and change its mode and location.
 *
 * Booking sends the desktop Schedule drawer's row (useScheduleDrawer) to
 * createAppointment. Times are the provider's open slots for the type's
 * length (openSlots: availability, time off, holidays, other bookings, 15
 * minutes ahead), so a conflicting or past time can't be picked.
 *
 * Rescheduling moves the visit with rescheduleAppointments (the desktop
 * reschedule path: audit entry, and a cancelled visit is booked again) and
 * saves mode / location with updateAppointment, as the desktop drawer does.
 * Checked in / out visits are locked (lockedReason).
 *
 * @param {object} props
 * @param {string|number} [props.patientId]   – prefill (e.g. from a profile)
 * @param {string} [props.patientName]
 * @param {string|number} [props.appointmentId] – reschedule this one instead
 * @param {string} [props.date]               – preselect a day (ISO or MM-DD-YYYY)
 */
export function BookAppointmentScreen({ patientId, patientName, appointmentId, date: initialDate }) {
  const editing = appointmentId != null;
  const appt = useAppStore(s => (editing ? (s.appointments || []).find(a => String(a.id) === String(appointmentId)) || null : null));
  const loading = useAppStore(s => s.appointmentsLoading);
  const fetchAppointments = useAppStore(s => s.fetchAppointments);
  useEffect(() => { if (editing) fetchAppointments?.(); }, [editing, fetchAppointments]);

  if (editing && !appt) {
    return (
      <div className={common.screen}>
        <MobileSubHeader title="Reschedule" />
        <div className={common.body}>
          {loading ? <MobileListSkeleton count={3} /> : <MobileEmpty icon="solar:calendar-minimalistic-linear" title="Appointment not found" />}
        </div>
      </div>
    );
  }
  return editing
    ? <RescheduleForm key={appt.id} appt={appt} />
    : <BookForm patientId={patientId} patientName={patientName} initialDate={initialDate} />;
}

function toIso(d) {
  if (!d) return '';
  return /^\d{4}-/.test(d) ? d.slice(0, 10) : apptToIso(d);
}

/* ─────────────────────────── Book ─────────────────────────── */

function BookForm({ patientId, patientName, initialDate }) {
  const { pop } = useMobileNav();
  const me = useAppStore(s => s.currentUserProfile);
  const allPatients = useAppStore(s => s.allPatients);
  const fetchAllPatients = useAppStore(s => s.fetchAllPatients);
  const storeTypes = useAppStore(s => s.appointmentTypes);
  const fetchAppointmentTypes = useAppStore(s => s.fetchAppointmentTypes);
  const fetchAppointments = useAppStore(s => s.fetchAppointments);
  const createAppointment = useAppStore(s => s.createAppointment);
  const users = useBookableUsers();
  const locationOptions = useLocationOptions();
  const types = storeTypes?.length ? storeTypes : FALLBACK_APPOINTMENT_TYPES;

  useEffect(() => {
    fetchAllPatients?.();
    fetchAppointments?.();
    if (!storeTypes?.length) fetchAppointmentTypes?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [patient, setPatient] = useState(() => (patientId != null || patientName ? { id: patientId ?? null, name: patientName || '' } : null));
  // A prefilled id with no name takes the name from the patient list.
  const shownPatient = useMemo(() => {
    if (!patient || patient.name) return patient;
    const hit = (allPatients || []).find(p => String(p.id) === String(patient.id) || String(p.memberId) === String(patient.id));
    return hit ? { id: patient.id, name: hit.name } : patient;
  }, [patient, allPatients]);
  const [type, setTypeState] = useState(null);
  const [mode, setMode] = useState('');
  const [location, setLocation] = useState('');
  const [providerPick, setProvider] = useState(null);
  const [slot, setSlot] = useState({ date: toIso(initialDate), minutes: null });
  const [reason, setReason] = useState('');
  const [memberNote, setMemberNote] = useState('');
  const [staffNote, setStaffNote] = useState('');
  const [sheet, setSheet] = useState(null);
  const [saving, setSaving] = useState(false);
  const [booked, setBooked] = useState(null);

  // The signed-in user books for themselves unless they pick someone else.
  // Memoized: a fresh object each render would recompute every day's slots.
  const meUser = useMemo(() => (me?.name ? (users.find(u => samePerson(u, me)) || { id: me.id || null, name: me.name }) : null), [users, me]);
  const provider = providerPick || meUser;
  const duration = typeDurationMin(type);
  const { slotsOn, whyNone } = useOpenSlots(provider);
  const slotsFor = useMemo(() => (iso) => slotsOn(iso, duration), [slotsOn, duration]);

  // Funnel events, as the desktop drawer logs them.
  const outcome = useRef(null);
  useEffect(() => {
    const openedAt = Date.now();
    trackFunnel('schedule.drawer_opened', { source: 'mobile', hadPatientPreset: patientId != null });
    return () => { if (!outcome.current) trackFunnel('schedule.drawer_abandoned', { lastStep: 0, durationMs: Date.now() - openedAt }); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Picking a type sets the mode and location it implies (useScheduleDrawer);
  // its length can change which slots are open, so the time is picked again.
  const setType = (next) => {
    setTypeState(next);
    setMode(next.mode === 'Virtual' ? 'Virtual' : 'At Clinic');
    setLocation(locationOptions[0] || '');
    setSlot(s => ({ ...s, minutes: null }));
    trackFunnel('schedule.type_selected', { typeId: next.id ?? null, typeName: next.name || null });
  };
  const pickPatient = (p) => {
    setPatient({ id: p.id, name: p.name });
    trackFunnel('schedule.patient_selected', { patientId: p.id ?? null });
  };

  const missing = !shownPatient?.name ? 'Select a patient'
    : !type ? 'Select an appointment type'
      : !provider ? 'Select a primary user'
        : !slot.date ? 'Select a date'
          : slot.minutes == null ? 'Select a time' : '';

  const save = async () => {
    if (missing || saving) return;
    // The slot may have been taken since it was shown.
    if (!slotsOn(slot.date, duration).some(s => s.minutes === slot.minutes)) {
      toast.error('That time is no longer open. Pick another slot.');
      setSlot(s => ({ ...s, minutes: null }));
      return;
    }
    const row = {
      patient_id: shownPatient.id != null ? String(shownPatient.id) : null,
      patient_name: shownPatient.name,
      appointment_type_id: type.id ?? null,
      appointment_type_name: type.name || '',
      mode,
      location,
      primary_user: provider.name,
      primary_user_id: provider.id || null,
      secondary_users: [],
      date: isoToAppt(slot.date),
      time_start: minutesToTime(slot.minutes),
      time_end: minutesToTime(slot.minutes + duration),
      reason_for_visit: reason.trim(),
      member_instruction: memberNote.trim(),
      staff_instruction: staffNote.trim(),
      require_rsvp: false,
      recurring: false,
      recurring_config: null,
      status: 'Scheduled',
      calendar_id: COLOR_TO_CAL[type.color] || 'followup',
    };
    trackFunnel('schedule.submitted', { recurring: false, hasProvider: true });
    setSaving(true);
    let result;
    try { result = await createAppointment(row); } finally { setSaving(false); }
    if (!result) {
      outcome.current = 'failed';
      trackFunnel('schedule.booking_failed', {});
      toast.error('Failed to save appointment');
      return;
    }
    outcome.current = 'completed';
    trackFunnel('schedule.booking_completed', { appointmentId: result.id ?? null });
    setBooked(row);
  };

  if (booked) return <Booked row={booked} onDone={pop} />;

  const virtualPick = isVirtual(mode);
  return (
    <div className={common.screen}>
      <MobileSubHeader title={shownPatient?.name || 'Book Appointment'} />
      <div className={`${common.body} ${styles.body}`}>
        <div className={styles.form}>
          {!shownPatient?.name && (
            <PickerField label="Patient" required value={shownPatient?.name} placeholder="Search patient" onClick={() => setSheet('patient')} />
          )}
          <NoteField label="Reason For Visit" rows={4} placeholder="Type reason here" value={reason} onValueChange={setReason} />

          <section className={styles.card} aria-label="Appointment info">
            <h2 className={styles.cardTitle}>Appointment info</h2>
            <PickerField
              label="Appointment Type"
              required
              value={type?.name}
              placeholder="Select appointment type"
              onClick={() => setSheet('type')}
              trailing={type ? <span className={styles.typeDot} style={{ background: type.color }} aria-hidden="true" /> : undefined}
            />
            <PickerField label="Mode of appointment" value={mode ? (virtualPick ? 'Virtual' : 'In-person') : ''} placeholder="Select mode" onClick={() => setSheet('mode')} />
            <PickerField label="Primary User" required value={provider?.name ? (samePerson(provider, me || {}) ? `${provider.name} (You)` : provider.name) : ''} placeholder="Select provider" onClick={() => setSheet('provider')} />
            <PickerField label="Location" value={location} placeholder="Select location" onClick={() => setSheet('location')} />
            <PickerField label="Duration" required readOnly value={String(duration)} suffix="Min" />
          </section>

          <SlotPicker
            date={slot.date}
            minutes={slot.minutes}
            slotsOn={slotsFor}
            whyNone={whyNone}
            durationMin={duration}
            blockedText={!type ? 'Select an appointment type to see slots' : !provider ? 'Select a primary user to see slots' : ''}
            onChange={setSlot}
          />

          <NoteField label="Instructions for Member" rows={3} placeholder="Enter instructions for member here" value={memberNote} onValueChange={setMemberNote} />
          <NoteField label="Instructions for Staff" rows={3} placeholder="Enter instructions for staff here" value={staffNote} onValueChange={setStaffNote} />
        </div>
      </div>
      <div className={styles.footer}>
        <Button size="lg" variant="solid" fullWidth loading={saving} disabled={!!missing || saving} disabledReason={missing || undefined} onClick={save}>
          Schedule Appointment
        </Button>
      </div>

      {sheet === 'patient' && <PatientSheet patients={allPatients} onPick={(p) => { pickPatient(p); setSheet(null); }} onClose={() => setSheet(null)} />}
      {sheet === 'type' && (
        <BottomSheet title="Appointment Type" onClose={() => setSheet(null)}>
          <div className={styles.sheetList}>
            {types.map(t => (
              <button key={t.id || t.name} type="button" className={styles.option} aria-pressed={type?.name === t.name} onClick={() => { setType(t); setSheet(null); }}>
                <span className={styles.typeDot} style={{ background: t.color }} aria-hidden="true" />
                <span className={styles.optionText}>
                  <span className={styles.optionMain}>{t.name}</span>
                  <span className={styles.optionSub}>{[t.code, t.mode, t.duration].filter(Boolean).join(' • ')}</span>
                </span>
                {type?.name === t.name && <Icon name="solar:check-read-linear" size={24} color="var(--primary-300)" />}
              </button>
            ))}
          </div>
        </BottomSheet>
      )}
      {sheet === 'mode' && (
        <BottomSheet title="Mode of appointment" onClose={() => setSheet(null)}>
          {BOOK_MODES.map(m => (
            <BottomSheetItem key={m.value} icon={m.icon} label={m.label} detail={isVirtual(mode) === isVirtual(m.value) && mode ? 'Selected' : undefined} onClick={() => { setMode(m.value); setSheet(null); }} />
          ))}
        </BottomSheet>
      )}
      {sheet === 'provider' && (
        <PeopleSheet
          users={users}
          me={me}
          value={provider}
          onPick={(u) => { setProvider(u); setSlot(s => ({ ...s, minutes: null })); setSheet(null); }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'location' && (
        <BottomSheet title="Location" onClose={() => setSheet(null)}>
          {locationOptions.map(l => (
            <BottomSheetItem key={l} icon="solar:map-point-linear" label={l} detail={l === location ? 'Selected' : undefined} onClick={() => { setLocation(l); setSheet(null); }} />
          ))}
        </BottomSheet>
      )}
    </div>
  );
}

/* ─────────────────────────── Reschedule ─────────────────────────── */

function RescheduleForm({ appt }) {
  const { pop } = useMobileNav();
  const storeTypes = useAppStore(s => s.appointmentTypes);
  const fetchAppointmentTypes = useAppStore(s => s.fetchAppointmentTypes);
  const reschedule = useAppStore(s => s.rescheduleAppointments);
  const updateAppointment = useAppStore(s => s.updateAppointment);
  const locationOptions = useLocationOptions();
  useEffect(() => { if (!storeTypes?.length) fetchAppointmentTypes?.(); }, [storeTypes?.length, fetchAppointmentTypes]);

  const provider = useMemo(() => ({ id: appt.primary_user_id || null, name: appt.primary_user || '' }), [appt.primary_user_id, appt.primary_user]);
  const duration = apptDurationMin(appt);
  const moving = useMemo(() => new Set([appt.id]), [appt.id]);
  const { slotsOn, whyNone } = useOpenSlots(provider.name ? provider : null);
  const slotsFor = useMemo(() => (iso) => slotsOn(iso, duration, moving), [slotsOn, duration, moving]);

  const start = appointmentStart(appt);
  const [slot, setSlot] = useState({ date: '', minutes: null });
  const currentMode = modeLabel(appt) === '-' ? '' : (isVirtual(appt.mode) ? 'Virtual' : 'In-person');
  const [mode, setMode] = useState(currentMode);
  const [location, setLocation] = useState(appt.location || '');
  const [sheet, setSheet] = useState(null);
  const [saving, setSaving] = useState(false);

  // The modes the visit's type allows ("In-person/Virtual" is both).
  const type = findType(storeTypes, appt) || findType(FALLBACK_APPOINTMENT_TYPES, appt);
  const allowed = EDIT_MODES.filter(m => String(type?.mode || '').split('/').some(x => sameName(x, m.value)));
  const modes = allowed.length ? allowed : EDIT_MODES;

  const locked = lockedReason(appt);
  const cancelled = appt.status === 'Cancelled';
  const timeChanged = !!slot.date && slot.minutes != null;
  const detailsChanged = mode !== currentMode || location !== (appt.location || '');
  const blocked = locked || (slot.date && slot.minutes == null ? 'Select a time' : '') || (!timeChanged && !detailsChanged ? 'Nothing has changed' : '');

  const save = async () => {
    if (blocked || saving) return;
    setSaving(true);
    try {
      // Check the slot first so a stale time doesn't leave a half-saved edit.
      if (timeChanged && !slotsOn(slot.date, duration, moving).some(s => s.minutes === slot.minutes)) {
        toast.error('That time is no longer open. Pick another slot.');
        setSlot(s => ({ ...s, minutes: null }));
        return;
      }
      if (detailsChanged) {
        const changes = {};
        if (mode !== currentMode) changes.mode = mode;
        if (location !== (appt.location || '')) changes.location = location;
        if (!await updateAppointment(appt.id, changes)) { toast.error('Could not update the appointment.'); return; }
      }
      if (timeChanged) {
        const failed = await reschedule([{
          appt,
          date: isoToAppt(slot.date),
          time_start: minutesToTime(slot.minutes),
          time_end: minutesToTime(slot.minutes + duration),
        }]);
        if (failed) { toast.error('Could not reschedule the appointment.'); return; }
      }
    } finally { setSaving(false); }
    toast.success(timeChanged ? 'Appointment rescheduled' : 'Appointment updated');
    pop();
  };

  const nowText = start ? `${start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}, ${[appt.time_start, appt.time_end].filter(Boolean).join(' - ')}` : appt.date;

  return (
    <div className={common.screen}>
      <MobileSubHeader title="Reschedule" />
      <div className={`${common.body} ${styles.body}`}>
        <div className={styles.form}>
          <div className={styles.current}>
            <Avatar variant="patient" size="XL" initials={initialsOf(appt.patient_name)} />
            <span className={styles.optionText}>
              <span className={styles.optionMain}>{appt.patient_name || 'Appointment'}</span>
              <span className={styles.optionSub}>{[appt.appointment_type_name, nowText].filter(Boolean).join(' • ')}</span>
            </span>
          </div>
          {locked && <p className={styles.notice}>{locked}</p>}
          {!locked && cancelled && <p className={styles.notice}>This appointment is cancelled. A new time books it again.</p>}

          <section className={styles.card} aria-label="Appointment info">
            <h2 className={styles.cardTitle}>Appointment info</h2>
            <PickerField label="Mode of appointment" value={mode} placeholder="Select mode" readOnly={!!locked} onClick={() => setSheet('mode')} />
            <PickerField label="Location" value={location} placeholder="Select location" readOnly={!!locked} onClick={() => setSheet('location')} />
            <PickerField label="Primary User" readOnly value={provider.name || 'Unassigned'} />
            <PickerField label="Duration" readOnly value={String(duration)} suffix="Min" />
          </section>

          {!locked && (
            <SlotPicker
              date={slot.date}
              minutes={slot.minutes}
              slotsOn={slotsFor}
              whyNone={whyNone}
              durationMin={duration}
              blockedText={provider.name ? '' : 'Assign a primary user to see slots'}
              onChange={setSlot}
            />
          )}
        </div>
      </div>
      {!locked && (
        <div className={styles.footer}>
          <Button size="lg" variant="solid" fullWidth loading={saving} disabled={!!blocked || saving} disabledReason={blocked || undefined} onClick={save}>
            Save Changes
          </Button>
        </div>
      )}

      {sheet === 'mode' && (
        <BottomSheet title="Mode of appointment" onClose={() => setSheet(null)}>
          {modes.map(m => (
            <BottomSheetItem key={m.value} icon={m.icon} label={m.label} detail={m.value === mode ? 'Selected' : undefined} onClick={() => { setMode(m.value); setSheet(null); }} />
          ))}
        </BottomSheet>
      )}
      {sheet === 'location' && (
        <BottomSheet title="Location" onClose={() => setSheet(null)}>
          {locationOptions.map(l => (
            <BottomSheetItem key={l} icon="solar:map-point-linear" label={l} detail={l === location ? 'Selected' : undefined} onClick={() => { setLocation(l); setSheet(null); }} />
          ))}
        </BottomSheet>
      )}
    </div>
  );
}

/* ─────────────────────────── Pieces ─────────────────────────── */

function PatientSheet({ patients, onPick, onClose }) {
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (patients || []).filter(p => !q || [p.name, p.memberId, p.phone, p.email].some(v => String(v || '').toLowerCase().includes(q))).slice(0, 50);
  }, [patients, query]);
  return (
    <BottomSheet title="Patient" onClose={onClose} className={styles.tallSheet}>
      <div className={styles.sheetSearch}>
        <Input leadingIcon="solar:magnifer-linear" size="lg" type="search" placeholder="Search members" enterKeyHint="search" aria-label="Search members" value={query} onValueChange={setQuery} />
      </div>
      <div className={styles.sheetList}>
        {shown.length === 0 ? <p className={styles.sheetEmpty}>{patients?.length ? 'No members match' : 'Loading members'}</p> : shown.map(p => (
          <button key={p.id} type="button" className={styles.option} onClick={() => onPick(p)}>
            <Avatar variant="patient" size="L" initials={p.initials || initialsOf(p.name)} />
            <span className={styles.optionText}>
              <span className={styles.optionMain}>{p.name}</span>
              <span className={styles.optionSub}>{patientLine(p)}</span>
            </span>
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}

function PeopleSheet({ users, me, value, onPick, onClose }) {
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (users || []).filter(u => !q || u.name.toLowerCase().includes(q));
  }, [users, query]);
  return (
    <BottomSheet title="Primary User" onClose={onClose} className={styles.tallSheet}>
      <div className={styles.sheetSearch}>
        <Input leadingIcon="solar:magnifer-linear" size="lg" type="search" placeholder="Search Provider" enterKeyHint="search" aria-label="Search providers" value={query} onValueChange={setQuery} />
      </div>
      <div className={styles.sheetList}>
        {shown.length === 0 ? <p className={styles.sheetEmpty}>No users match</p> : shown.map(u => (
          <button key={u.id || u.name} type="button" className={styles.option} aria-pressed={!!value && samePerson(u, value)} onClick={() => onPick(u)}>
            <Avatar variant="assignee" size="L" initials={initialsOf(u.name)} />
            <span className={styles.optionText}>
              <span className={styles.optionMain}>{samePerson(u, me || {}) ? `${u.name} (You)` : u.name}</span>
              {u.email && <span className={styles.optionSub}>{u.email}</span>}
            </span>
            {!!value && samePerson(u, value) && <Icon name="solar:check-read-linear" size={24} color="var(--primary-300)" />}
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}

// A labelled text area (Figma "Text Area Mobile", 1082:58708).
function NoteField({ label, ...props }) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <Textarea className={styles.note} enterKeyHint="enter" {...props} />
    </label>
  );
}

function Booked({ row, onDone }) {
  const [m, d, y] = row.date.split('-').map(Number);
  const when = new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' });
  return (
    <div className={common.screen}>
      <div className={styles.booked} role="status">
        <span className={styles.bookedIcon}><Icon name="solar:unread-linear" size={44} color="currentColor" /></span>
        <h1 className={styles.bookedTitle}>Appointment Booked</h1>
        <span className={styles.bookedName}>{row.patient_name}</span>
        <span className={styles.bookedMeta}>{when} {row.time_start.toUpperCase()}</span>
        {row.location && <span className={styles.bookedMeta}>{isVirtual(row.mode) ? 'Virtual' : row.location}</span>}
      </div>
      <div className={styles.footer}>
        <Button size="lg" variant="solid" fullWidth onClick={onDone}>Done</Button>
      </div>
    </div>
  );
}
