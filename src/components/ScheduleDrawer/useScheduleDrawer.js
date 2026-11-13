import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useInterpreterStatus } from '../../features/patient/shared/InterpreterOffer/useInterpreterStatus';
import { supabase } from '../../lib/supabase';
import { trackFunnel } from '../../lib/tracking';
import { FALLBACK_APPOINTMENT_TYPES, displayAppointmentStatus, storedAppointmentStatus } from './scheduleDrawerConstants';
import { useLocationOptions } from './useLocationOptions';

export function useScheduleDrawer({ onClose, selectedSlot, onSave, existingAppointment, initialPatientId, initialSelectedPatient, initialProvider, source }) {
  const locationOptions = useLocationOptions();
  const isViewMode = !!existingAppointment;
  const patients = useAppStore(s => s.patients);
  const fetchPatients = useAppStore(s => s.fetchPatients);
  const showToast = useAppStore(s => s.showToast);
  const createAppointment = useAppStore(s => s.createAppointment);
  const updateAppointment = useAppStore(s => s.updateAppointment);
  const deleteAppointment = useAppStore(s => s.deleteAppointment);
  const storeApptTypes = useAppStore(s => s.appointmentTypes);
  const fetchAppointmentTypes = useAppStore(s => s.fetchAppointmentTypes);

  const appointmentTypes = storeApptTypes.length > 0 ? storeApptTypes : FALLBACK_APPOINTMENT_TYPES;

  useEffect(() => {
    if (fetchPatients && patients.length === 0) fetchPatients();
    if (fetchAppointmentTypes && storeApptTypes.length === 0) fetchAppointmentTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initialDate = (() => {
    if (!selectedSlot?.month) return '';
    const m = String(selectedSlot.month).padStart(2, '0');
    const d = String(selectedSlot.day).padStart(2, '0');
    return `${m}-${d}-${selectedSlot.year}`;
  })();

  const initialTime = (() => {
    if (!selectedSlot?.hour && selectedSlot?.hour !== 0) return '';
    const h = selectedSlot.hour;
    const min = String(selectedSlot.minute || 0).padStart(2, '0');
    const ampm = h >= 12 ? 'pm' : 'am';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${min} ${ampm}`;
  })();

  // `initialSelectedPatient` lets callers pre-populate the patient when
  // context is already known (e.g. HEDIS Care Gap drawer, the drawer is
  // already scoped to one member so re-searching them is friction). Falls
  // back to `initialPatientId`'s patients.find lookup below.
  const [selectedPatient, setSelectedPatientState] = useState(initialSelectedPatient || null);
  const [reasonForVisit, setReasonForVisit] = useState('');
  // Section 1557: a patient who needs an interpreter gets a qualified one
  // booked with the visit unless they chose a family member instead.
  const { prefs: interpreterPrefs, status: interpreterNeed } = useInterpreterStatus(selectedPatient ? String(selectedPatient.memberId ?? selectedPatient.id) : null);
  const [bookInterpreterChoice, setBookInterpreter] = useState(null);
  const bookInterpreter = bookInterpreterChoice ?? (interpreterPrefs?.interpreterOffer?.status !== 'declined');
  const [appointmentType, setAppointmentTypeState] = useState(null);
  const [mode, setMode] = useState('');
  const [location, setLocation] = useState('');
  // A Day-view column click books for that column's user.
  // The provider's name (shown) and id (who they are: two staff can share a
  // name). `initialProvider` is { id, name } or, from older callers, a name.
  const [provider, setProviderName] = useState(typeof initialProvider === 'object' && initialProvider ? initialProvider.name : (initialProvider || ''));
  const [providerId, setProviderId] = useState(typeof initialProvider === 'object' && initialProvider ? initialProvider.id || null : null);
  const setProvider = (name, person) => { setProviderName(name); setProviderId(person?.id || null); };
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const [recurring, setRecurring] = useState(false);
  const [recurFrequency, setRecurFrequency] = useState(1);
  const [recurUnit, setRecurUnit] = useState('Week(s)');
  const [recurDays, setRecurDays] = useState([]);
  const [recurEndDate, setRecurEndDate] = useState('');
  const [recurConfirmed, setRecurConfirmed] = useState(false);
  const [openSections, setOpenSections] = useState([]);
  const setSectionOpen = (key, open) => {
    setOpenSections(prev => (open
      ? prev.includes(key) ? prev : [...prev, key]
      : prev.filter(k => k !== key)));
  };
  const [customTime, setCustomTime] = useState('');
  const timeBtnRef = useRef(null);
  const [requireRsvp, setRequireRsvp] = useState(false);
  const [secondaryUsers, setSecondaryUsers] = useState([]);
  const [profileUsers, setProfileUsers] = useState([]);
  const memberInstructionRef = useRef('');
  const staffInstructionRef = useRef('');
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const rawStatus = existingAppointment?.status;
  const [apptStatus, setApptStatus] = useState(displayAppointmentStatus(rawStatus));
  const [editingInstruction, setEditingInstruction] = useState(false);
  const [instructionDraft, setInstructionDraft] = useState(existingAppointment?.member_instruction || '');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef(null);
  const [showViewStaffInstructions, setShowViewStaffInstructions] = useState(!!existingAppointment?.staff_instruction);
  const [editingStaffInstruction, setEditingStaffInstruction] = useState(false);
  const [staffInstructionDraft, setStaffInstructionDraft] = useState(existingAppointment?.staff_instruction || '');

  // ── Booking funnel tracking ──
  // StrictMode (dev-only) mounts→unmounts→remounts every effect once; the
  // pending-abandonment timer lets the second setup cancel the first
  // cleanup's write while still firing on a real close.
  // maxStep mirrors the furthest funnel step reached (1 open, 2 patient,
  // 3 type, 4 submitted) so abandonment knows where the user stopped.
  const openedAtRef = useRef(0);
  const outcomeRef = useRef(null);
  const maxStepRef = useRef(0);
  const openedLoggedRef = useRef(false);
  const abandonTimerRef = useRef(null);

  useEffect(() => {
    if (isViewMode) return undefined;
    clearTimeout(abandonTimerRef.current);
    if (!openedAtRef.current) openedAtRef.current = Date.now();
    if (!openedLoggedRef.current) {
      openedLoggedRef.current = true;
      maxStepRef.current = 1;
      trackFunnel('schedule.drawer_opened', {
        source: source || null,
        hadPatientPreset: !!initialPatientId,
      });
    }
    return () => {
      abandonTimerRef.current = setTimeout(() => {
        if (outcomeRef.current) return;
        trackFunnel('schedule.drawer_abandoned', {
          lastStep: maxStepRef.current,
          durationMs: Date.now() - openedAtRef.current,
        });
      }, 0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setSelectedPatient = (next) => {
    setSelectedPatientState(next);
    if (next && !isViewMode) {
      maxStepRef.current = Math.max(maxStepRef.current, 2);
      trackFunnel('schedule.patient_selected', { patientId: next.id ?? null });
    }
  };

  useEffect(() => {
    if (!initialPatientId || !patients.length) return;
    const match = patients.find(p => p.id === initialPatientId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirrors the user having picked the preset patient
    if (match) setSelectedPatient(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPatientId, patients]);

  useEffect(() => {
    supabase.from('profiles').select('id, full_name, first_name, last_name, email, status').order('full_name').then(({ data }) => {
      if (!data) return;
      const users = [];
      for (const u of data) {
        if (u.status !== 'Active') continue;
        users.push({
          id: u.id,
          name: u.full_name?.trim() || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email,
          email: u.email,
        });
      }
      setProfileUsers(users);
    });
  }, []);

  // Picking a type resets the mode and location it implies. Doing it here, in
  // the event that causes it, keeps mode/location as plain user-editable state
  // instead of state an effect has to chase after every render.
  const setAppointmentType = (next) => {
    setAppointmentTypeState(next);
    if (next) {
      setMode(next.mode === 'Virtual' ? 'Virtual' : 'At Clinic');
      setLocation(locationOptions[0]);
      if (!isViewMode) {
        maxStepRef.current = Math.max(maxStepRef.current, 3);
        trackFunnel('schedule.type_selected', { typeId: next.id ?? null, typeName: next.name || null });
      }
    }
  };

  const canSchedule = selectedPatient && appointmentType;

  const handleSchedule = async () => {
    const computeEndTime = (t) => {
      const match = t.match(/(\d+):(\d+)\s*(am|pm)/i);
      if (!match) return t;
      const [, h, m, p] = match;
      const mins = (parseInt(m) || 0) + 30;
      return mins >= 60
        ? `${(parseInt(h) || 0) + 1}:${String(mins - 60).padStart(2, '0')} ${p}`
        : `${h}:${String(mins).padStart(2, '0')} ${p}`;
    };

    const colorToCalId = { '#D9A50B': 'awv', '#8C5AE2': 'followup', '#009B53': 'specialty', '#145ECC': 'telehealth' };
    const calId = appointmentType ? (colorToCalId[appointmentType.color] || 'followup') : 'followup';

    const row = {
      patient_id: selectedPatient?.id || null,
      patient_name: selectedPatient?.name || '',
      appointment_type_id: appointmentType?.id ?? null,
      appointment_type_name: appointmentType?.name || '',
      mode,
      location,
      primary_user: provider,
      ...(provider ? { primary_user_id: providerId || (profileUsers.filter(u => u.name === provider).length === 1 ? profileUsers.find(u => u.name === provider).id : null) } : {}),
      secondary_users: secondaryUsers,
      date,
      time_start: time,
      time_end: time ? computeEndTime(time) : '',
      reason_for_visit: reasonForVisit,
      member_instruction: memberInstructionRef.current,
      staff_instruction: [staffInstructionRef.current, interpreterNeed && bookInterpreter ? `Book a qualified ${interpreterPrefs?.preferredLanguage || ''} interpreter.`.replace(/\s+/g, ' ') : ''].filter(Boolean).join('\n'),
      require_rsvp: requireRsvp,
      recurring,
      recurring_config: recurring ? JSON.stringify({ frequency: recurFrequency, unit: recurUnit, days: recurDays, endDate: recurEndDate }) : null,
      status: 'Scheduled',
      calendar_id: calId,
    };

    maxStepRef.current = Math.max(maxStepRef.current, 4);
    trackFunnel('schedule.submitted', { recurring, hasProvider: !!provider });

    const result = await createAppointment(row);
    if (result) {
      outcomeRef.current = 'completed';
      trackFunnel('schedule.booking_completed', {
        appointmentId: result.id ?? null,
        durationMs: Date.now() - openedAtRef.current,
      });
      if (onSave) onSave(row);
      setBookingSuccess(true);
      setTimeout(() => onClose(), 2000);
    } else {
      outcomeRef.current = 'failed';
      trackFunnel('schedule.booking_failed', { durationMs: Date.now() - openedAtRef.current });
      showToast('Failed to save appointment');
    }
  };

  const handleStatusChange = async (newStatus) => {
    setApptStatus(newStatus);
    if (existingAppointment?.id) {
      await updateAppointment(existingAppointment.id, { status: storedAppointmentStatus(newStatus) });
      if (onSave) onSave();
    }
  };

  const handleSaveInstruction = async () => {
    if (existingAppointment?.id) {
      await updateAppointment(existingAppointment.id, { member_instruction: instructionDraft });
      if (onSave) onSave();
    }
    setEditingInstruction(false);
  };

  const handleSaveStaffInstruction = async () => {
    if (existingAppointment?.id) {
      await updateAppointment(existingAppointment.id, { staff_instruction: staffInstructionDraft });
      if (onSave) onSave();
    }
    setEditingStaffInstruction(false);
  };

  const handleDeleteAppointment = async () => {
    if (existingAppointment?.id) {
      await deleteAppointment(existingAppointment.id);
      if (onSave) onSave();
      showToast('Appointment deleted');
      onClose();
    }
  };

  const isPastAppointment = (() => {
    if (!existingAppointment?.date) return false;
    const today = new Date().toLocaleDateString('en-CA');
    const [mo, dd, yyyy] = existingAppointment.date.split('-');
    const apptDate = `${yyyy}-${mo}-${dd}`;
    return apptDate < today;
  })();

  return {
    isViewMode,
    patients,
    showToast,
    updateAppointment,
    appointmentTypes,
    existingAppointment,
    canSchedule,
    handleSchedule,
    handleStatusChange,
    handleSaveInstruction,
    handleSaveStaffInstruction,
    handleDeleteAppointment,
    isPastAppointment,
    bookingSuccess,
    selectedPatient,
    setSelectedPatient,
    interpreter: interpreterNeed ? { language: interpreterPrefs?.preferredLanguage || '', offer: interpreterPrefs?.interpreterOffer || null, book: bookInterpreter, setBook: setBookInterpreter } : null,
    reasonForVisit,
    setReasonForVisit,
    appointmentType,
    setAppointmentType,
    mode,
    setMode,
    location,
    setLocation,
    provider,
    setProvider,
    date,
    setDate,
    time,
    setTime,
    recurring,
    setRecurring,
    recurFrequency,
    setRecurFrequency,
    recurUnit,
    setRecurUnit,
    recurDays,
    setRecurDays,
    recurEndDate,
    setRecurEndDate,
    recurConfirmed,
    setRecurConfirmed,
    openSections,
    setSectionOpen,
    customTime,
    setCustomTime,
    timeBtnRef,
    requireRsvp,
    setRequireRsvp,
    secondaryUsers,
    setSecondaryUsers,
    profileUsers,
    memberInstructionRef,
    staffInstructionRef,
    apptStatus,
    editingInstruction,
    setEditingInstruction,
    instructionDraft,
    setInstructionDraft,
    showMoreMenu,
    setShowMoreMenu,
    moreMenuRef,
    showViewStaffInstructions,
    setShowViewStaffInstructions,
    editingStaffInstruction,
    setEditingStaffInstruction,
    staffInstructionDraft,
    setStaffInstructionDraft,
  };
}
