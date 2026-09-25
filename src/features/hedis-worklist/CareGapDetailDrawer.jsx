import { useState, useEffect, useMemo, useRef } from 'react';
import { Drawer } from '../../components/Drawer/Drawer';
import { Button } from '../../components/Button/Button';
import { Input } from '../../components/Input/Input';
import { Textarea } from '../../components/Textarea/Textarea';
import { ClinicalNotePanel } from './ClinicalNotePanel';
import { useClinicalNotePanel } from './useClinicalNotePanel';
import { ClinicalNoteWorkspaceBody, ConsolidatedNoteBody, HeaderActions as ClinicalNoteHeaderActions } from './ClinicalNotePanelParts';
import { ReviewerPickerPopover } from './ReviewerPickerPopover';
import { ClinicalNotesTab } from './ClinicalNotesTab';
import { ClinicalNotePreviewBody } from './ClinicalNotePreviewBody';
import { MeasureInfoBody } from './MeasureInfoBody';
import { TasksTab } from '../patient/left-panel/tabs/tasks/TasksTab/TasksTab';
import { groupTasksForTab } from '../patient/left-panel/tabs/tasks/TasksTab/groupTasksForTab';
import { TaskDetailDrawer } from '../tasks/TaskDetailDrawer';
import { useAddTaskDrawer } from '../tasks/useAddTaskDrawer';
import { AddTaskDrawerBody } from '../tasks/AddTaskDrawerBody';
import { useScheduleDrawer } from '../../components/ScheduleDrawer/useScheduleDrawer';
import { ScheduleDrawerBookingBody } from '../../components/ScheduleDrawer/ScheduleDrawerBookingForm';
import { CloseButton } from '../../components/CloseButton/CloseButton';
import { ConfirmDialog } from '../../components/ConfirmDialog/ConfirmDialog';
import { Phq9ExitDialog } from './dsf/Phq9ExitDialog';
import { computeDsfbDueDateISO } from './dsf/dsfScoring';
import { PatientBanner } from '../../components/PatientBanner/PatientBanner';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Icon } from '../../components/Icon/Icon';
import { TabStrip } from '../../components/TabStrip/TabStrip';
import { MenuPopover } from '../../components/MenuPopover/MenuPopover';
import { ActivityLog } from '../../components/ActivityLog/ActivityLog';
import { CardSkeleton } from '../../components/CardSkeleton/CardSkeleton';
import { OutreachTabView } from '../patient/left-panel/tabs/outreach/OutreachTab/OutreachTab';
import { useOutreachTab } from '../patient/left-panel/tabs/outreach/OutreachTab/useOutreachTab';
import { DocumentUploadForm } from '../../components/DocumentUploadForm/DocumentUploadForm';
import { useDocumentUploadForm } from '../../components/DocumentUploadForm/useDocumentUploadForm';
import { DOC_TYPES } from '../hcc/data/chartDocs';
import { DocumentList } from '../../components/DocumentList/DocumentList';
import { CommentComposer } from '../../components/CommentComposer/CommentComposer';
import { CareGapAppointmentsTab } from './CareGapAppointmentsTab';
import { CareGapReminderForm } from './CareGapReminderForm';
import { useCareGapReminderForm } from './useCareGapReminderForm';
import { CareGapReferralForm } from './CareGapReferralForm';
import { useCareGapReferralForm, REFERRAL_CHANNELS, REFERRAL_STATUS, isReferralDraft, CUSTOM_SENDER, isEmail, providerContact } from './useCareGapReferralForm';
import { draftReferralEmail } from './referralEmail';
import { ScheduleDrawer } from '../../components/ScheduleDrawer/ScheduleDrawer';
import { FilePreview } from '../../components/FilePreview/FilePreview';
import { useAppStore } from '../../store/useAppStore';
import { TABS, MORE_ACTIONS, MEASURE_NAMES, toActivityLogEntries, initialsOf } from './CareGapDetailDrawer.utils';
import { CareGapDetailDrawerHeader } from './CareGapDetailDrawerHeader';
import styles from './CareGapDetailDrawer.module.css';

// Compact MM/DD/YYYY formatter used by the preview subtitle. Kept local
// so the drawer file doesn't reach into date-utils modules for a one-off.
function formatPreviewDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}/${dd}/${d.getFullYear()}`;
}

export function CareGapDetailDrawer(props) {
  const memberKey = props.member?.id ?? '';
  return <CareGapDetailDrawerContent key={memberKey} {...props} />;
}

const EMPTY_REMINDERS = [];

function CareGapDetailDrawerContent({ member, gapCode, year, onClose }) {
  const showToast = useAppStore(s => s.showToast);
  const updateGapStatus = useAppStore(s => s.updateGapStatus);
  const updateGapAssignee = useAppStore(s => s.updateGapAssignee);
  const logCareGapActivity = useAppStore(s => s.logCareGapActivity);
  const currentActorName = useAppStore(s => s.currentActorName);
  const addProgramDocument = useAppStore(s => s.addProgramDocument);
  const updateProgramDocument = useAppStore(s => s.updateProgramDocument);
  const removeProgramDocument = useAppStore(s => s.removeProgramDocument);
  const programDocuments = useAppStore(s => s.programDocuments);
  const programDocumentsDidFetch = useAppStore(s => s.programDocumentsDidFetch);
  const fetchProgramDocuments = useAppStore(s => s.fetchProgramDocuments);
  useEffect(() => { fetchProgramDocuments(); }, [fetchProgramDocuments]);
  const activityEntries = useAppStore(s => s.caregapActivity[member?.id]);
  const platformUsers = useAppStore(s => s.platformUsers);
  const updateAppointment = useAppStore(s => s.updateAppointment);
  const deleteAppointment = useAppStore(s => s.deleteAppointment);
  // Appt/Reminders: title click / Edit open the shared appointment detail
  // drawer; Delete confirms first.
  const [openAppt, setOpenAppt] = useState(null);
  const openAppointmentDetail = (appt) => { setOpenAppt(appt); setLeftWorkspace('appointment-detail'); };
  // Set Reminder workspace (caregap_reminders). Reminders list in the
  // Appt/Reminders tab as Type = Reminder; each change is logged.
  const memberReminders = useAppStore(s => s.caregapReminders[member?.id]) || EMPTY_REMINDERS;
  const fetchCaregapReminders = useAppStore(s => s.fetchCaregapReminders);
  const addCaregapReminder = useAppStore(s => s.addCaregapReminder);
  const updateCaregapReminder = useAppStore(s => s.updateCaregapReminder);
  const deleteCaregapReminder = useAppStore(s => s.deleteCaregapReminder);
  useEffect(() => { fetchCaregapReminders(); }, [fetchCaregapReminders]);
  const reminderForm = useCareGapReminderForm();
  // Send Referral workspace (caregap_referrals): eFax / Email.
  const directoryProviders = useAppStore(s => s.referralProviders);
  const practiceSenderLines = useAppStore(s => s.referralSenderLines);
  // eFax senders are the practice eFax numbers (Settings > Messages > eFax)
  // that are active and linked to the signed-in user; email lines come from
  // referral_sender_lines.
  const efaxNumbers = useAppStore(s => s.efaxNumbers);
  const fetchEfaxNumbers = useAppStore(s => s.fetchEfaxNumbers);
  const meId = useAppStore(s => s.currentUserProfile?.id);
  useEffect(() => { fetchEfaxNumbers(); }, [fetchEfaxNumbers]);
  const referralSenderLines = useMemo(() => [
    ...efaxNumbers
      .filter(n => n.isActive && meId && n.linkedUserIds.includes(meId))
      .map((n, i) => ({ id: n.id, channel: 'efax', label: n.name, value: n.number, isDefault: i === 0 })),
    ...practiceSenderLines.filter(l => l.channel !== 'efax'),
  ], [efaxNumbers, meId, practiceSenderLines]);
  const fetchReferralDirectory = useAppStore(s => s.fetchReferralDirectory);
  const memberReferrals = useAppStore(s => s.caregapReferrals[member?.id]) || EMPTY_REMINDERS;
  const fetchCaregapReferrals = useAppStore(s => s.fetchCaregapReferrals);
  const addCaregapReferral = useAppStore(s => s.addCaregapReferral);
  const updateCaregapReferral = useAppStore(s => s.updateCaregapReferral);
  useEffect(() => { fetchReferralDirectory(); fetchCaregapReferrals(); }, [fetchReferralDirectory, fetchCaregapReferrals]);
  // A user linked to an active practice eFax number can receive referrals on
  // it, so that number fills in when their profile has no fax of its own.
  const referralProviders = useMemo(() => directoryProviders.map(p => {
    if (p.fax) return p;
    const linked = efaxNumbers.find(n => n.isActive && n.linkedUserIds.includes(p.id));
    return linked ? { ...p, fax: linked.number } : p;
  }), [directoryProviders, efaxNumbers]);
  const referralForm = useCareGapReferralForm();
  const referralProvider = referralProviders.find(p => p.id === referralForm.values.providerId);
  const referralContact = providerContact(referralProvider, referralForm.values.channel);
  const canSendReferral = !!(
    referralContact
    // Email states its purpose in the subject / body instead of a reason.
    && (referralForm.values.channel === 'email' || referralForm.values.reason.trim())
    && (referralForm.values.files.length || referralForm.values.docs.length)
    && (referralForm.values.senderId === CUSTOM_SENDER ? isEmail(referralForm.values.customSender) : referralForm.values.senderId)
    && (referralForm.values.channel !== 'email'
      || (referralForm.values.emailSubject.trim() && referralForm.values.emailBody.trim()))
  );
  // Email signature: the sender's own directory entry (profile).
  const meProvider = referralProviders.find(p => p.id === meId);
  const referralEmailSignature = meProvider && {
    name: meProvider.name,
    lines: [meProvider.specialty, meProvider.practice, meProvider.address],
    details: [
      { label: 'Phone', value: meProvider.phone },
      { label: 'Fax', value: meProvider.fax },
      { label: 'Email', value: meProvider.email },
    ],
  };
  const [generatingReferralEmail, setGeneratingReferralEmail] = useState(false);
  const handleGenerateReferralEmail = async () => {
    const v = referralForm.values;
    if (!referralProvider) {
      showToast('Pick who to refer to first');
      return;
    }
    setGeneratingReferralEmail(true);
    const draft = await draftReferralEmail({
      patientName: member?.name,
      patientAge: member?.age,
      patientSex: member?.gender,
      gap: MEASURE_NAMES[currentCode] ? `${currentCode} - ${MEASURE_NAMES[currentCode]}` : currentCode,
      providerName: referralProvider.name,
      providerSpecialty: referralProvider.specialty,
      // Email has no separate reason field; whatever is already typed in the
      // message steers the draft.
      reason: v.reason.trim() || v.emailBody.trim(),
      attachments: [...v.docs.map(d => d.name), ...v.files.map(f => f.name)],
      senderName: meProvider?.name,
    });
    setGeneratingReferralEmail(false);
    referralForm.set('emailSubject')(draft.subject);
    referralForm.set('emailBody')(draft.body);
    showToast(draft.source === 'ai' ? 'Email drafted with UnityAI' : 'UnityAI is unavailable, drafted from the referral details');
  };
  const referralSenderDefaults = () => {
    const defaultFor = (ch) => (referralSenderLines.find(l => l.channel === ch && l.isDefault) || referralSenderLines.find(l => l.channel === ch))?.id || '';
    return { efax: defaultFor('efax'), email: defaultFor('email') };
  };
  const openReferral = () => {
    referralForm.reset(referralSenderDefaults());
    setLeftWorkspace('referral');
  };
  const openReferralDraft = (id) => {
    const draft = memberReferrals.find(r => r.id === id);
    if (!isReferralDraft(draft)) return;
    referralForm.loadDraft(draft, referralSenderDefaults());
    setLeftWorkspace('referral');
  };
  // A draft needs something worth keeping; Sign & Refer needs it all.
  const canSaveReferralDraft = (() => {
    const v = referralForm.values;
    return !!(v.providerId || v.reason.trim() || v.emailSubject.trim() || v.emailBody.trim() || v.files.length || v.docs.length);
  })();
  const saveReferral = (status) => {
    const isDraft = status === REFERRAL_STATUS.draft;
    if (!member?.id || (isDraft ? !canSaveReferralDraft : !canSendReferral)) return;
    const v = referralForm.values;
    const sender = referralSenderLines.find(l => l.id === v.senderId);
    const channelLabel = REFERRAL_CHANNELS.find(c => c.key === v.channel)?.label || v.channel;
    const isEmailChannel = v.channel === 'email';
    const now = new Date();
    const existing = v.draftId ? memberReferrals.find(r => r.id === v.draftId) : null;
    const referral = {
      id: v.draftId || `cgref-${now.getTime()}`,
      memberId: member.id,
      memberName: member.name,
      gapCode: currentCode,
      channel: v.channel,
      status,
      senderLineId: v.senderId === CUSTOM_SENDER ? null : (v.senderId || null),
      senderValue: v.senderId === CUSTOM_SENDER ? v.customSender.trim() : (sender?.value || ''),
      providerId: referralProvider?.id || null,
      providerName: referralProvider?.name || '',
      providerContact: referralContact,
      reason: isEmailChannel ? v.emailSubject.trim() : v.reason.trim(),
      note: !isEmailChannel && v.noteOpen ? v.note.trim() : '',
      emailSubject: isEmailChannel ? v.emailSubject.trim() : '',
      emailBody: isEmailChannel ? v.emailBody.trim() : '',
      sentBy: existing?.sentBy || currentActorName(),
      sentById: existing?.sentById || meId || null,
      // Picked documents ride along by reference; attachments reloaded from a
      // draft keep their stored file.
      documentAttachments: v.docs.map(d => (d.storagePath
        ? { name: d.name, type: d.type || '', url: d.url || '', size: d.size, storagePath: d.storagePath }
        : { name: d.name, type: d.type || '', url: d.url || '', documentId: d.documentId || d.id })),
    };
    if (existing) updateCaregapReferral(referral, v.files);
    else addCaregapReferral(referral, v.files);
    logCareGapActivity(member.id, {
      when: now.toISOString(),
      actor: currentActorName(),
      t: 'referral',
      title: isDraft ? 'Referral Saved as Draft' : 'Referral Signed & Referred',
      gapCodes: [currentCode],
      detailCard: {
        referralId: referral.id,
        channel: v.channel,
        fromName: currentActorName(),
        fromRole: meProvider?.specialty || currentUserProfile?.role || '',
        toName: referral.providerName || 'Provider not selected',
        toBadge: referral.providerName ? 'Fold Provider' : '',
        toSubtitle: [referralProvider?.specialty, referralContact && `${channelLabel} : ${referralContact}`].filter(Boolean).join(' • '),
        createdAt: now.toISOString(),
        status,
      },
    });
    showToast(isDraft ? 'Referral saved as draft' : `Referral signed & referred via ${channelLabel}`);
    referralForm.reset();
    runLeftClose();
  };
  const [reminderToDelete, setReminderToDelete] = useState(null);
  const reminderCard = (r, status) => {
    const [y, m, d] = String(r.date || '').split('-');
    const dateLabel = y && m && d ? `${m}/${d}/${y}` : '';
    return {
      title: r.title || 'Reminder',
      subtitle: [dateLabel, r.time, r.assignee].filter(Boolean).join(' • '),
      status: status || r.status || 'Pending',
    };
  };
  const logReminder = (title, r, status) => logCareGapActivity(member?.id, {
    when: new Date().toISOString(),
    actor: currentActorName(),
    t: 'appointment',
    title,
    gapCodes: [currentCode],
    detailCard: reminderCard(r, status),
  });
  const openReminderNew = () => {
    reminderForm.reset({ assignee: currentActorName() || '' });
    setLeftWorkspace('reminder');
  };
  const openReminderEdit = (r) => {
    reminderForm.startEdit(r);
    setLeftWorkspace('reminder');
  };
  const handleSaveReminder = () => {
    if (!reminderForm.canSave || !member?.id) return;
    const v = reminderForm.values;
    const fields = { title: v.title.trim(), date: v.date, time: v.time, assignee: v.assignee, note: v.note.trim() };
    if (reminderForm.editingId) {
      updateCaregapReminder(member.id, reminderForm.editingId, fields);
      logReminder('Reminder Updated', fields);
      showToast('Reminder updated');
    } else {
      const reminder = {
        id: `cgrem-${new Date().getTime()}`,
        memberId: member.id,
        memberName: member.name,
        gapCode: currentCode,
        createdBy: currentActorName(),
        ...fields,
      };
      addCaregapReminder(reminder);
      logReminder('Reminder Set', reminder, 'Pending');
      showToast('Reminder set');
    }
    reminderForm.reset();
    runLeftClose();
  };
  const [apptToDelete, setApptToDelete] = useState(null);
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  useEffect(() => { fetchPlatformUsers(); }, [fetchPlatformUsers]);
  const caregapActivityLoaded = useAppStore(s => s.caregapActivityLoaded);
  const fetchCaregapActivity = useAppStore(s => s.fetchCaregapActivity);
  const memberComments = useAppStore(s => s.caregapComments[member?.id]);
  const fetchCaregapComments = useAppStore(s => s.fetchCaregapComments);
  const addCaregapComment = useAppStore(s => s.addCaregapComment);
  const updateCaregapComment = useAppStore(s => s.updateCaregapComment);
  const deleteCaregapComment = useAppStore(s => s.deleteCaregapComment);
  const currentUserProfile = useAppStore(s => s.currentUserProfile);
  const [commentToDelete, setCommentToDelete] = useState(null);
  useEffect(() => { fetchCaregapComments(); }, [fetchCaregapComments]);
  useEffect(() => { fetchCaregapActivity(); }, [fetchCaregapActivity]);
  const appointments = useAppStore(s => s.appointments);
  const fetchAppointments = useAppStore(s => s.fetchAppointments);
  useEffect(() => { fetchAppointments?.(); }, [fetchAppointments]);
  // Clinical notes + tasks slices used by the Clinical Notes and Tasks tabs.
  const memberNotes = useAppStore(s => (member?.id ? s.clinicalNotesByMember?.[member.id] : null)) || [];
  const fetchClinicalNotesForMember = useAppStore(s => s.fetchClinicalNotesForMember);
  useEffect(() => { if (member?.id) fetchClinicalNotesForMember?.(member.id); }, [member?.id, fetchClinicalNotesForMember]);
  const allTasks = useAppStore(s => s.tasks);
  // Populate the tasks slice on mount so the nested "Preview task" eye
  // on Pending Review / Sign-off cards can resolve their linked task
  // (allTasks.find(t => t.id === reviewTask.taskId)). Without this,
  // `state.tasks` is empty when the user opens the Care Gap drawer
  // directly (bypassing Home / TasksView) and the eye silently no-ops.
  // fetchTasks is idempotent (tasksDidFetch guard) so this is cheap.
  const fetchTasks = useAppStore(s => s.fetchTasks);
  useEffect(() => { fetchTasks?.(); }, [fetchTasks]);
  // The eye affordance inside the Clinical Notes tab (and Activity Log) can
  // navigate to the Tasks page for a linked sign-off task. When that
  // navigation fires (activePage flips to 'tasks'), close this drawer so
  // the reviewer isn't looking at the Tasks page through our overlay.
  const activePage = useAppStore(s => s.activePage);
  useEffect(() => { if (activePage === 'tasks') onClose?.(); }, [activePage, onClose]);
  // Slice appointments to just this member. Supabase persists patient_id,
  // so a save from the inline Schedule pane immediately shows up here
  // after fetchAppointments refreshes.
  const memberAppointments = (appointments || []).filter(a => a.patient_id === member?.id);

  const gaps = member?.gaps ?? [];
  const [currentCode, setCurrentCode] = useState(gapCode);
  const gapKey = `${member?.id ?? ''}|${gapCode ?? ''}`;
  const [prevGapKey, setPrevGapKey] = useState(gapKey);
  if (prevGapKey !== gapKey) { setPrevGapKey(gapKey); setCurrentCode(gapCode); }

  const [statusOpen, setStatusOpen] = useState(false);
  const [statusAnchorRect, setStatusAnchorRect] = useState(null);

  const [selectedYear, setSelectedYear] = useState(year);
  const [prevYear, setPrevYear] = useState(year);
  if (prevYear !== year) { setPrevYear(year); setSelectedYear(year); }
  const [yearOpen, setYearOpen] = useState(false);
  const yearOptions = [year, year - 1, year - 2];

  const moreBtnRef = useRef(null);
  const [moreMenuRect, setMoreMenuRect] = useState(null);
  const openMoreMenu = () => { const r = moreBtnRef.current?.getBoundingClientRect(); if (r) setMoreMenuRect(r); };
  const closeMoreMenu = () => setMoreMenuRect(null);
  // Route Add Note based on how many gaps are open for this member.
  //   >1 → standalone consolidated Clinical Note drawer (two-pane
  //        layout: Visit Notes list on the left, focused gap's
  //        evidence on the right). Add Note, the Save-Score auto-
  //        promote, and Edit on a multi-gap draft all land here so
  //        the coordinator sees the same surface every time.
  //    1 → inline single-gap workspace on this drawer's left pane.
  const openClinicalNoteFlow = () => {
    if (openGapCount > 1) setShowClinicalNote(true);
    else setLeftWorkspace('clinical-note');
  };
  const runMoreAction = (a) => {
    closeMoreMenu();
    if (a.openClinicalNote) openClinicalNoteFlow();
    else if (a.key === 'task') setLeftWorkspace('task');
    else if (a.key === 'appointment') setLeftWorkspace('schedule');
    else if (a.key === 'outreach') openOutreachWorkspace();
    else if (a.key === 'document') openDocumentUpload();
    else if (a.key === 'reminder') openReminderNew();
    else if (a.key === 'referral') openReferral();
    else showToast(`${a.label} — coming soon`);
  };

  const [activeTab, setActiveTab] = useState('Activity Log');
  const [showClinicalNote, setShowClinicalNote] = useState(false);
  // Single-slot left workspace — only one workspace mounts at a time
  // ('task' | 'schedule' | null). Sharing the slot means widening the
  // drawer, mounting the banner inline, and running the collapse
  // animation all key off the same state instead of two parallel flags.
  const [leftWorkspace, setLeftWorkspace] = useState(null);
  // Track which clinical note the eye affordance opened so the preview
  // pane can resolve the exact note (signed vs. pending) instead of the
  // first note that happens to cover the current gap code. Without this,
  // clicking the Signed eye showed the Pending Review card because
  // `memberNotes.find` returned the first match for the gap.
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  // Called from the note-card eye affordance. Signed notes open a read-
  // only summary view (ClinicalNotePreviewBody) matching Figma 511:105429.
  // Draft / Pending Review notes open the editable workspace so the
  // author can amend before the reviewer signs. useClinicalNotePanel's
  // draft-restore effect (upstream 3e0aa74) hydrates the form fields from
  // the newest saved note for that gap so nothing extra is needed on the
  // editable path.
  const [amendNoteId, setAmendNoteId] = useState(null);
  const openNoteInWorkspace = (dc) => {
    if (!dc?.gapCode && !dc?.noteId && !dc?.id) return;
    if (dc.gapCode) {
      const found = gaps.find(g => g.code === dc.gapCode);
      if (found) setCurrentCode(found.code);
    }
    // Remember the exact note the user clicked so the preview pane
    // resolves that note (via memberNotes.find by id) instead of the
    // first note that covers the gap. Fixes the "Signed eye showed
    // Pending Review" bug when a member has multiple notes for the
    // same gaps.
    if (dc.noteId) setSelectedNoteId(dc.noteId);
    else if (dc.id) setSelectedNoteId(dc.id);
    else setSelectedNoteId(null);
    // Eye behavior per role/state — same underlying note record for
    // both users. NEVER creates a duplicate note; permissions are
    // decided by the current user's relationship to the note.
    //   • Draft                            → inline editable (author).
    //   • Signed                           → read-only preview (Amend
    //                                        flips to editor per audit
    //                                        rules — existing behavior).
    //   • Pending Review AND current user
    //     is the assigned reviewer         → editable consolidated view
    //                                        directly (no extra Edit
    //                                        click) — Provider path.
    //   • Pending Review AND current user
    //     is anyone else (author / NP)     → read-only preview with
    //                                        Edit affordance to flip
    //                                        into the editable
    //                                        consolidated view — NP
    //                                        path.
    if (dc.status === 'Draft') {
      setAmendNoteId(dc.noteId || null);
      // Multi-gap edit fires when EITHER the draft itself already
      // covers multiple gaps OR the member has more than one open gap
      // on the worklist. The coordinator needs every open gap
      // editable at once so DSF-A + DSF-B (or any pair) can be
      // authored together, not one at a time. Route into the
      // standalone two-pane Clinical Note drawer (Visit Notes list on
      // the left, focused gap's evidence on the right) so Add Note,
      // the Save-Score auto-promote, and Edit-on-draft all land on
      // the same surface. Falls back to the single-gap inline
      // workspace only when the whole member has just this one gap.
      const noteForClick = dc.noteId
        ? memberNotes.find(n => n.id === dc.noteId)
        : null;
      const scopeCodes = (dc.gapCodes && dc.gapCodes.length)
        ? dc.gapCodes
        : (noteForClick?.gapCodes || []);
      const goConsolidated = scopeCodes.length > 1 || openGapCount > 1;
      if (goConsolidated) {
        setLeftWorkspace(null);
        setShowClinicalNote(true);
      } else {
        setLeftWorkspace('clinical-note');
      }
      return;
    }
    if (dc.status === 'Pending Review' || dc.status === 'Submitted') {
      const noteForClick = dc.noteId
        ? memberNotes.find(n => n.id === dc.noteId)
        : memberNotes.find(n => (n.gapCodes || []).includes(dc.gapCode));
      const iAmReviewer = !!noteForClick
        && !!noteForClick.reviewerName
        && noteForClick.reviewerName === currentActorName();
      setAmendNoteId(null);
      setLeftWorkspace(iAmReviewer ? 'clinical-note-consolidated' : 'clinical-note-preview');
      return;
    }
    setAmendNoteId(null);
    setLeftWorkspace('clinical-note-preview');
  };
  const [inPlaceTaskId, setInPlaceTaskId] = useState(null);
  const inPlaceTaskRaw = inPlaceTaskId ? (allTasks || []).find(t => t.id === inPlaceTaskId) : null;
  const inPlaceTask = inPlaceTaskRaw ? {
    ...inPlaceTaskRaw,
    hedisMemberId: inPlaceTaskRaw.hedisMemberId || member?.id,
    hedisGapCodes: inPlaceTaskRaw.hedisGapCodes || (currentCode ? [currentCode] : []),
  } : null;
  const handleOpenTaskInPlace = (taskIdOrObj) => {
    const id = typeof taskIdOrObj === 'object' ? taskIdOrObj?.id : taskIdOrObj;
    if (!id) return;
    // Open the task in the drawer's own left workspace (like Add Task /
    // Schedule / Clinical Note) instead of a separate TaskDetailDrawer.
    // Reviewers get task context inline while still seeing the Care Gap
    // Details right pane behind it.
    setInPlaceTaskId(id);
    setLeftWorkspace('task-detail');
  };

  // Open-gap count drives the "Add Note" routing rule (see openClinicalNoteFlow).
  // Mirrors the hook's own filter so both counts agree.
  const openGapCount = (member?.gaps ?? [])
    .filter(g => g.status !== 'Completed' && !String(g.status).startsWith('Closed'))
    .length;

  // Both workspace hooks are called unconditionally (React rules) and
  // their outputs only wire into the UI when their key is active.
  // Activity entries for tasks / appointments. Shared by this drawer's own
  // workspaces and the outreach form's Actions row, so a task or
  // appointment created from either path lands in the persisted feed.
  const logTaskAdded = (task) => {
    logCareGapActivity(member?.id, {
      title: 'Task Added',
      detail: task?.name || 'Task',
      actor: currentActorName(),
      icon: 'solar:clipboard-list-linear',
      t: 'task',
      gapCodes: [currentCode],
      detailCard: {
        taskId: task?.id,
        title: task?.name || 'Task',
        assignee: task?.assigned_to || null,
        priority: task?.priority || 'none',
        status: task?.status === 'completed' ? 'Completed' : 'Pending',
      },
    });
  };
  const logAppointmentScheduled = (row) => {
    // Match Figma 1230:74055 — Activity entry is a detail card with the
    // appointment type as title, a "date, time · provider" subtitle, and
    // the appointment's own status pill (default Scheduled).
    const subtitleBits = [];
    if (row?.date) subtitleBits.push(row.date);
    if (row?.time_start) subtitleBits.push(row.time_end ? `${row.time_start} – ${row.time_end}` : row.time_start);
    const subtitleLeft = subtitleBits.join(', ');
    const provider = row?.primary_user || '';
    logCareGapActivity(member?.id, {
      when: new Date().toISOString(),
      actor: currentActorName(),
      t: 'appointment',
      title: 'Appointment Scheduled',
      gapCodes: [currentCode],
      detailCard: {
        title: row?.appointment_type_name || 'Appointment',
        subtitle: [subtitleLeft, provider].filter(Boolean).join(' • '),
        status: row?.status || 'Scheduled',
      },
    });
  };
  // One entry per program the outreach was logged for, so each keeps its
  // own outcome and note (Separate Notes).
  const logOutreachSaved = (entries, { isEdit, callDetails } = {}) => {
    const when = new Date().toISOString();
    entries.forEach(e => {
      const title = e.type === 'General' ? 'General Outreach' : e.title;
      logCareGapActivity(member?.id, {
        when,
        actor: currentActorName(),
        t: 'outreach',
        title: isEdit ? `${title} Updated` : title,
        badges: e.programs,
        gapCodes: e.programs,
        outcome: e.outcome,
        outcomeColor: e.outcomeColor,
        note: e.note,
        ...(callDetails ? { callDetails } : {}),
      });
    });
  };
  const addTask = useAddTaskDrawer({
    defaultStatus: undefined,
    initialMember: member?.name || '',
    onTaskCreated: (task) => {
      showToast('Task created');
      // Log an activity entry so the Care Gap Drawer's Activity Log
      // shows the create action, and close the left workspace so the
      // Tasks tab (which reads from the store) is immediately visible.
      logTaskAdded(task);
      runLeftClose();
    },
    // hedisMemberId lets the Tasks tab filter reliably (member.name is
    // fragile — two members can share a display name). extraFields is
    // spread into the task payload by useAddTaskDrawer.
    extraFields: { hedisMemberId: member?.id, careGap: currentCode, measurementYear: selectedYear },
    // These three fields have no columns in public.tasks — strip them
    // before the Supabase INSERT so the row is actually persisted (they
    // stay on the in-memory task object for the drawer's own use).
    dbOmit: ['hedisMemberId', 'careGap', 'measurementYear'],
  });
  // One outreach state backs both the left-pane form (Add Outreach) and
  // the Outreaches tab list, so a save in the pane shows up in the tab.
  const outreach = useOutreachTab({ defaultPrograms: [currentCode], defaultLogFor: 'care-program', onSaved: logOutreachSaved });
  const openOutreachWorkspace = () => {
    outreach.setDatetime(outreach.formatNow());
    // Pre-select the gap the drawer is focused on; the hook's reset after a
    // save or discard clears the selection.
    if (!outreach.selectedProgs.includes(currentCode)) outreach.toggleProgram(currentCode);
    outreach.setFormOpen(true);
    setLeftWorkspace('outreach');
  };
  const handleSaveOutreach = () => {
    if (!outreach.canSave) return;
    outreach.handleSave();
    runLeftClose();
  };
  // Pre-populate the patient using the current gap's member. Passing the
  // synthesized object (not just an id) skips the patients.find lookup —
  // HEDIS members don't share ids with the appointments' patients table.
  // Shared by this drawer's scheduler and the outreach form's scheduler.
  const schedulePatient = member && {
    id: member.id,
    name: member.name,
    gender: member.gender,
    age: member.age,
    dob: member.dob,
    facility: member.facility,
    laceScore: member.laceScore,
  };
  // Add Document workspace. The file + row go to `program_documents` (gap
  // code as program_code, HEDIS member id as patient_id) and the upload is
  // logged to this gap's Activity feed.
  const docUpload = useDocumentUploadForm();
  // Care gap uploads are this member's `cgdoc-` rows; the id prefix keeps
  // them apart from P360 program documents that share the table.
  const memberDocs = (programDocuments || [])
    .filter(d => String(d.id).startsWith('cgdoc-') && String(d.patientId) === String(member?.id))
    .toSorted((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const [previewDocId, setPreviewDocId] = useState(null);
  const [docToDelete, setDocToDelete] = useState(null);
  const previewDoc = previewDocId ? memberDocs.find(d => d.id === previewDocId) : null;
  const openDocumentUpload = () => { docUpload.reset(); setLeftWorkspace('document'); };
  const openDocumentPreview = (id) => { setPreviewDocId(id); setLeftWorkspace('document-preview'); };
  const todayMmDdYyyy = (d) => `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
  // Adds a new document to this member's Documents (store + storage) and logs
  // it to Activity. Shared by the Documents tab and the referral doc picker.
  const createMemberDocument = ({ file, caption, docType }) => {
    if (!member?.id || !file) return null;
    const now = new Date();
    const id = `cgdoc-${now.getTime()}`;
    const name = caption.trim();
    addProgramDocument({
      id,
      programCode: currentCode,
      patientId: String(member.id),
      name,
      type: docType,
      sizeBytes: file.size,
      updatedBy: currentActorName(),
      updatedDate: todayMmDdYyyy(now),
      createdAt: now.toISOString(),
      ext: (/\.([a-z0-9]+)$/i.exec(file.name) || [])[1]?.toLowerCase() || null,
    }, file, { logActivity: false });
    logCareGapActivity(member.id, {
      when: now.toISOString(),
      actor: currentActorName(),
      t: 'upload',
      title: 'Document Uploaded',
      file: name,
      fileType: docType,
      docId: id,
      gapCodes: [currentCode],
    });
    showToast(`Uploaded ${name}`);
    return { id, name, type: docType, addedAt: now.toISOString() };
  };
  const handleUploadDocument = () => {
    if (!docUpload.canSave || !member?.id) return;
    const { file, caption, docType } = docUpload;
    const now = new Date();
    if (docUpload.editingId) {
      const name = caption.trim();
      updateProgramDocument(docUpload.editingId, {
        name, type: docType, updatedBy: currentActorName(), updatedDate: todayMmDdYyyy(now),
      });
      logCareGapActivity(member.id, {
        when: now.toISOString(),
        actor: currentActorName(),
        t: 'upload',
        title: 'Document Updated',
        file: name,
        fileType: docType,
        docId: docUpload.editingId,
        gapCodes: [currentCode],
      });
      showToast(`Updated ${name}`);
      docUpload.reset();
      runLeftClose();
      return;
    }
    createMemberDocument({ file, caption, docType });
    docUpload.reset();
    runLeftClose();
  };
  const scheduleDrawer = useScheduleDrawer({
    onClose: () => closeLeftWorkspace(),
    // On successful create, surface a toast, log an activity entry so the
    // Activity feed reflects the schedule action, and refresh the list
    // (the hook already calls createAppointment + fetchAppointments, but
    // this guarantees the local `memberAppointments` slice is up to date
    // before the pane collapses).
    onSave: (row) => {
      showToast('Appointment scheduled');
      logAppointmentScheduled(row);
      fetchAppointments?.();
    },
    initialSelectedPatient: schedulePatient,
  });
  // Inline single-gap Clinical Note hook — always mounted (React rules) but
  // only wired into the UI when leftWorkspace === 'clinical-note' /
  // 'clinical-note-consolidated' / 'clinical-note-preview'. selectedNoteId
  // hydrates the form from the exact note the eye affordance opened;
  // amendNoteId seeds the form from that note's persisted payload when the
  // Amend button is clicked from a preview.
  const clinicalNote = useClinicalNotePanel({
    member,
    gapCode: currentCode,
    selectedNoteId,
    amendNoteId,
    onClose: () => { setAmendNoteId(null); runLeftClose(); },
    // DSF-A save on a single-gap note opens DSF-B natively, then the
    // hook auto-promotes into the standalone two-pane Clinical Note
    // drawer (Visit Notes list on the left, focused gap's evidence on
    // the right). Add Note and Edit-on-multi-gap-draft both land here
    // too. `currentCode` flips to DSF-B first so the RHS pane opens
    // focused on the new gap.
    onPromoteToConsolidated: (targetCode) => {
      if (targetCode) setCurrentCode(targetCode);
      setLeftWorkspace(null);
      setLeftClosing(false);
      setShowClinicalNote(true);
    },
  });

  // Two-phase close so the drawer collapses with the same easing it opens
  // with. Phase 1 (250ms) — drawer.width transitions 1280 → 700 while the
  // left pane is still mounted; its flex space shrinks in lock-step so it
  // reads as sliding back into the right pane. Phase 2 — actually unmount.
  const [leftClosing, setLeftClosing] = useState(false);
  // DSF-B: incomplete-PHQ-9 exit modal. Set when the user tries to
  // leave a clinical-note workspace whose active DSF-B gap has some
  // but not all PHQ-9 items answered and no saved score yet.
  const [phq9ExitPrompt, setPhq9ExitPrompt] = useState(null); // { answered, total, dueDateISO, mode } | null
  const runLeftClose = () => {
    setLeftClosing(true);
    setTimeout(() => { setLeftWorkspace(null); setLeftClosing(false); setSelectedNoteId(null); setAmendNoteId(null); setInPlaceTaskId(null); }, 250);
  };
  // DSF-B guard used by the Close and Save-as-Draft paths.
  //
  // `mode: 'close'` — fires only when PHQ-9 is partially answered.
  //   Navigating away with nothing typed shouldn't nag the user, and a
  //   fully-answered PHQ-9 will get signed through the normal flow.
  //
  // `mode: 'save-draft'` — fires whenever DSF-B is on this note and
  //   the user isn't declining follow-up. Save as Draft never signs
  //   the gap, so the note leaves DSF-B still open regardless of PHQ-9
  //   completeness. The popup reminds the user of the 30-day window.
  //
  // Returns `{ answered, total, dueDateISO }` when the guard should
  // fire, else null.
  const detectPhq9Incomplete = ({ mode = 'close' } = {}) => {
    if (leftWorkspace !== 'clinical-note' && leftWorkspace !== 'clinical-note-consolidated') return null;
    const dsfb = clinicalNote?.gapState?.['DSF-B'];
    if (!dsfb) return null;
    const items = dsfb.phq9?.items || [];
    const answered = items.filter(v => v !== null && v !== undefined).length;
    if (mode === 'close') {
      // Close path: decline short-circuits the sign-off queue, and an
      // untouched or fully-answered PHQ-9 doesn't warrant a nag.
      if (dsfb.decline) return null;
      if (answered === 0 || answered >= 9) return null;
    }
    // Save-as-Draft path fires whenever DSF-B is on the note — a draft
    // leaves the gap Open even when the user has ticked Decline, so the
    // 30-day sign-off reminder still applies.
    // 30-day window anchor is centralised in computeDsfbDueDateISO so
    // the Fold-native (paired DSF-A savedAt) and Astrana (DSF-B gap
    // ingestion date) branches stay consistent across the app.
    const dsfa = clinicalNote?.gapState?.['DSF-A'];
    const dsfbGap = (member?.gaps || []).find(g => g.code === 'DSF-B');
    const dueDateISO = computeDsfbDueDateISO({
      dsfaSavedAt: dsfa?.phq2?.savedAt,
      dsfbGap,
    });
    return { answered, total: 9, dueDateISO };
  };
  const closeLeftWorkspace = () => {
    // Task workspace has a "discard unsaved changes?" guard; the scheduler
    // discards silently for parity with its standalone usage.
    if (leftWorkspace === 'task' && addTask.guardClose() === false) return;
    if (leftWorkspace === 'outreach') outreach.handleDiscard();
    if (leftWorkspace === 'document') docUpload.reset();
    if (leftWorkspace === 'document-preview') setPreviewDocId(null);
    if (leftWorkspace === 'appointment-detail') { setOpenAppt(null); fetchAppointments?.(); }
    if (leftWorkspace === 'reminder') reminderForm.reset();
    if (leftWorkspace === 'referral') referralForm.reset();
    // DSF-B: block close on a partial PHQ-9 and surface the exit modal.
    const guard = detectPhq9Incomplete({ mode: 'close' });
    if (guard) { setPhq9ExitPrompt({ ...guard, mode: 'close' }); return; }
    // Clear the selected note so the next preview starts from currentCode
    // rather than a stale id.
    setSelectedNoteId(null);
    if (leftWorkspace === 'clinical-note' && amendNoteId) setAmendNoteId(null);
    runLeftClose();
  };
  // Save-as-Draft wrapper: same PHQ-9 completeness guard the close path
  // uses, but the modal maps to Keep editing / Save as Draft. The draft
  // still writes when the user confirms, matching the header button's
  // implicit contract.
  const handleGuardedSaveDraft = () => {
    const guard = detectPhq9Incomplete({ mode: 'save-draft' });
    if (guard) { setPhq9ExitPrompt({ ...guard, mode: 'save-draft' }); return; }
    clinicalNote.handleSaveDraft();
  };
  // DSF-B on the note keeps Save-as-Draft enabled even without dirty
  // state — the popup nags the user about the 30-day sign-off window
  // whenever they try to park DSF-B as a draft.
  const canSaveDraftEffective = clinicalNote.hasChanges
    || !!detectPhq9Incomplete({ mode: 'save-draft' });
  const inSplit = !!leftWorkspace || leftClosing;
  const isExpanded = !!leftWorkspace && !leftClosing;

  if (!member || gaps.length === 0) return null;

  const idx = Math.max(0, gaps.findIndex(g => g.code === currentCode));
  const gap = gaps[idx] ?? gaps[0];
  const canPrev = idx > 0;
  const canNext = idx < gaps.length - 1;
  const status = gap?.status ?? 'Open';
  const statusLocked = status === 'Completed';
  // Saved comments (caregap_comments) join the Activity feed as comment
  // entries; the author's own get Edit / Delete.
  const commentEntries = (memberComments || []).map(c => {
    const mine = !!(c.authorId && currentUserProfile?.id && c.authorId === currentUserProfile.id);
    return {
      id: c.id,
      when: c.createdAt,
      actor: c.author || 'Unknown author',
      t: 'comment',
      title: 'Added a Comment',
      commentBody: c.body,
      edited: c.edited,
      ...(mine ? {
        onEditComment: (text, mentions) => updateCaregapComment(member.id, c.id, text, mentions),
        onDeleteComment: () => setCommentToDelete(c),
      } : {}),
    };
  });
  // A referral entry whose referral is still a draft can be picked back up.
  const allActivityEntries = [...(activityEntries || []), ...commentEntries].map(e => (
    e.t === 'referral' && e.detailCard?.referralId && isReferralDraft(memberReferrals.find(r => r.id === e.detailCard.referralId))
      ? { ...e, onOpenReferralDraft: () => openReferralDraft(e.detailCard.referralId) }
      : e
  ));
  const activityLogEntries = toActivityLogEntries(allActivityEntries);
  // Clinical Notes tab is DB-driven (clinicalNotesByMember) so it shows the
  // current state per note — a Pending Review note that is later Signed
  // updates in place instead of appearing as two rows. Activity Log keeps
  // both history entries; the Notes tab mirrors the DB's single row per
  // note, which is what the user expects ("should have updated the Below
  // Consolidated note status to signed instead of creating 1 more duplicate").
  const clinicalNoteEntries = (() => {
    const notes = memberNotes || [];
    if (notes.length === 0) return [];
    const mapped = notes.map(n => {
      const rawStatus = n.status;
      const statusLabel = rawStatus === 'submitted' ? 'Pending Review' : rawStatus === 'signed' ? 'Signed' : rawStatus === 'draft' ? 'Draft' : String(rawStatus || '');
      const gapList = n.gapCodes || [];
      const isMulti = gapList.length > 1;
      const title = isMulti ? 'Consolidated Clinical Note' : (gapList[0] ? `${gapList[0]} Visit Note` : 'Clinical Note');
      const chip = isMulti ? `${gapList.length} Gaps` : undefined;
      let subtitle = '';
      if (rawStatus === 'draft') {
        subtitle = `Save as Draft by ${n.authorName || '—'}`;
      } else if (rawStatus === 'submitted') {
        subtitle = n.reviewerName ? `Submitted for Review to ${n.reviewerName}` : 'Submitted for Review';
      } else if (rawStatus === 'signed') {
        const signer = n.signedByName || n.reviewerName || n.authorName || 'Provider';
        const when = n.signedAt ? ` · ${formatPreviewDate(n.signedAt)}` : '';
        subtitle = `Signed by ${signer}${when}`;
      }
      // Attach the linked review task only while the note is still pending;
      // once signed the task is complete and the nested card should disappear
      // (fixes "below entry those action will not be visible").
      let reviewTask = null;
      if (rawStatus === 'submitted' && n.reviewTaskId) {
        const t = (allTasks || []).find(x => String(x.id) === String(n.reviewTaskId));
        if (t) {
          const s = String(t.status || '').toLowerCase();
          if (s !== 'completed') {
            reviewTask = {
              taskId: t.id,
              title: t.name || `Request for Sign-off - ${title}`,
              assignee: t.assigned_to || n.reviewerName || '',
              status: 'Pending',
            };
          }
        } else {
          reviewTask = {
            taskId: n.reviewTaskId,
            title: `Request for Sign-off - ${title}`,
            assignee: n.reviewerName || '',
            status: 'Pending',
          };
        }
      }
      const when = n.signedAt || n.updatedAt || n.createdAt || new Date().toISOString();
      return {
        id: `note-${n.id}`,
        t: 'clinical_note',
        when,
        at: when,
        actor: n.authorName || n.signedByName || 'Provider',
        title,
        gapCodes: gapList,
        detailCard: {
          noteId: n.id,
          memberId: member.id,
          gapCode: gapList[0] || currentCode,
          gapCodes: gapList,
          title,
          chip,
          status: statusLabel,
          subtitle,
          reviewTask,
          pdfDataUrl: n.pdfDataUrl || null,
        },
      };
    });
    return toActivityLogEntries(mapped);
  })();
  // Count of actual note entries (excludes month-group headers) — used for
  // the tab label and empty-state gating.
  const clinicalNoteCount = clinicalNoteEntries.filter(e => e.t === 'clinical_note').length;
  // Tasks tab lists every task tied to this HEDIS member — sign-off tasks
  // (created by createCareGapSignOffTask) always have hedisMemberId set;
  // manually created tasks land here via the `member` denormalized field.
  const memberTasks = (allTasks || []).filter(
    t => (t.hedisMemberId && t.hedisMemberId === member?.id)
      || (member?.name && t.member === member.name),
  );
  const openTaskDetail = (task) => handleOpenTaskInPlace(task);
  const tabCounts = {
    'Activity Log': allActivityEntries.length,
    Outreaches: outreach.logGroups.reduce((n, g) => n + (g.logs?.length ?? 0), 0),
    'Appt/Reminders': memberAppointments.length + memberReminders.length,
    'Clinical Notes': clinicalNoteCount,
    Documents: memberDocs.length,
    Referrals: memberReferrals.length,
    Tasks: memberTasks.length,
  };

  const goPrev = () => { if (canPrev) { setCurrentCode(gaps[idx - 1].code); setStatusOpen(false); } };
  const goNext = () => { if (canNext) { setCurrentCode(gaps[idx + 1].code); setStatusOpen(false); } };


  return (
    <>
      {showClinicalNote && (
        <ClinicalNotePanel member={member} gapCode={gap.code} year={selectedYear} onClose={() => setShowClinicalNote(false)} />
      )}
      {/* The task detail no longer opens as its own standalone Drawer —
          it renders inline as the left workspace when leftWorkspace ===
          'task-detail' (see the leftPane branches below). */}
      {reminderToDelete && (
        <ConfirmDialog
          variant="destructive"
          title="Delete reminder?"
          description={`"${reminderToDelete.title || 'Reminder'}" will be removed. This can't be undone.`}
          confirmLabel="Delete"
          onCancel={() => setReminderToDelete(null)}
          onConfirm={() => {
            const r = reminderToDelete;
            deleteCaregapReminder(member.id, r.id);
            logReminder('Reminder Deleted', r, 'Deleted');
            if (reminderForm.editingId === r.id) { reminderForm.reset(); runLeftClose(); }
            showToast('Reminder deleted');
            setReminderToDelete(null);
          }}
        />
      )}
      {apptToDelete && (
        <ConfirmDialog
          variant="destructive"
          title="Delete appointment?"
          description={`"${apptToDelete.appointment_type_name || 'Appointment'}" will be removed from this member's appointments. This can't be undone.`}
          confirmLabel="Delete"
          onCancel={() => setApptToDelete(null)}
          onConfirm={() => {
            const appt = apptToDelete;
            deleteAppointment?.(appt.id);
            logCareGapActivity(member.id, {
              when: new Date().toISOString(),
              actor: currentActorName(),
              t: 'appointment',
              title: 'Appointment Deleted',
              gapCodes: [currentCode],
              detailCard: {
                title: appt.appointment_type_name || 'Appointment',
                subtitle: [appt.date, appt.time_start, appt.primary_user].filter(Boolean).join(' • '),
                status: 'Deleted',
              },
            });
            showToast('Appointment deleted');
            setApptToDelete(null);
          }}
        />
      )}
      {commentToDelete && (
        <ConfirmDialog
          variant="destructive"
          title="Delete comment?"
          description="This comment will be removed. A Deleted a Comment entry stays in the Activity log."
          confirmLabel="Delete"
          onCancel={() => setCommentToDelete(null)}
          onConfirm={() => {
            deleteCaregapComment(member.id, commentToDelete.id);
            showToast('Comment deleted');
            setCommentToDelete(null);
          }}
        />
      )}
      {docToDelete && (
        <ConfirmDialog
          variant="destructive"
          title="Delete document?"
          description={`"${docToDelete.name}" will be removed from this member's documents. This can't be undone.`}
          confirmLabel="Delete"
          onCancel={() => setDocToDelete(null)}
          onConfirm={() => {
            const doc = docToDelete;
            removeProgramDocument(doc.id);
            logCareGapActivity(member.id, {
              when: new Date().toISOString(),
              actor: currentActorName(),
              t: 'upload',
              title: 'Document Deleted',
              file: doc.name,
              fileType: doc.type,
              docId: doc.id,
              gapCodes: [currentCode],
            });
            if (previewDocId === doc.id) { setPreviewDocId(null); runLeftClose(); }
            showToast(`Removed ${doc.name}`);
            setDocToDelete(null);
          }}
        />
      )}
      {addTask.showCloseConfirm && (
        <ConfirmDialog
          icon="solar:danger-triangle-linear"
          iconColor="var(--status-warning)"
          title="Discard unsaved task?"
          description="You have unsaved changes. Closing now will discard them."
          confirmLabel="Discard"
          cancelLabel="Keep editing"
          variant="error"
          onConfirm={() => { addTask.setShowCloseConfirm(false); runLeftClose(); }}
          onCancel={() => addTask.setShowCloseConfirm(false)}
        />
      )}
      {phq9ExitPrompt && (
        <Phq9ExitDialog
          answered={phq9ExitPrompt.answered}
          total={phq9ExitPrompt.total}
          dueDateISO={phq9ExitPrompt.dueDateISO}
          mode={phq9ExitPrompt.mode}
          onCompleteNow={() => setPhq9ExitPrompt(null)}
          onSaveExit={() => {
            const wasCloseFlow = phq9ExitPrompt.mode !== 'save-draft';
            setPhq9ExitPrompt(null);
            // Persist whatever the user has already answered. Save-as-Draft
            // stops here so the drawer stays put; the Close flow keeps
            // going and unmounts the workspace after the draft lands.
            if (typeof clinicalNote.handleSaveDraft === 'function') {
              try { clinicalNote.handleSaveDraft(); } catch { /* draft best-effort */ }
            }
            if (wasCloseFlow) runLeftClose();
          }}
        />
      )}
      <ReviewerPickerPopover
        open={clinicalNote.reviewerPickerOpen}
        onClose={() => clinicalNote.setReviewerPickerOpen(false)}
        onConfirm={(reviewer) => clinicalNote.handleConfirmSubmitForReview(reviewer)}
      />
      <Drawer
        title="Care Gap Details"
        onClose={onClose}
        noCloseDivider
        // Mirror the Diagnosis Gaps drawer sizing so both surfaces feel like
        // one system — 700px closed, 1280px expanded (640 + 640 split). The
        // right pane stays fixed at 640px so the Care Gap content doesn't
        // reflow when a workspace (Add Task / Add Note / Schedule) opens;
        // the drawer simply expands leftward and collapses back.
        width={isExpanded ? 1280 : 700}
        className={`${styles.panel} ${isExpanded ? styles.panelExpanded : ''}`}
        bodyClassName={inSplit ? `${styles.drawerBody} ${styles.drawerBodySplit}` : styles.drawerBody}
        headerRight={
          <div className={styles.headerNav}>
            <ActionButton icon="solar:alt-arrow-left-linear" size="L" tooltip="Previous gap" state={canPrev ? 'active' : 'disabled'} onClick={goPrev} />
            <ActionButton icon="solar:alt-arrow-right-linear" size="L" tooltip="Next gap" state={canNext ? 'active' : 'disabled'} onClick={goNext} />
            <span className={styles.headerDivider} />
          </div>
        }
        banner={inSplit ? undefined : (
          <div className={styles.patientBannerWrap}>
            <PatientBanner initials={member.in} name={member.name} gender={member.gender} age={member.age} dob={member.dob}
              memberId={member.memberId} hidePatientLabel patientId={member.id} />
          </div>
        )}
      >
        {inSplit && (() => {
          // Look up the note we're previewing / editing once so both the
          // pane header title and its right-side actions can branch on the
          // note's status (Signed vs. Submitted / Pending Review). Prefer
          // the exact note the eye affordance opened (selectedNoteId); fall
          // back to the first note that covers the current gap so the
          // Add-Note entry points still resolve.
          const previewNoteHoisted = (leftWorkspace === 'clinical-note-preview' || leftWorkspace === 'clinical-note-consolidated')
            ? (selectedNoteId ? memberNotes.find(n => n.id === selectedNoteId) : null)
              || memberNotes.find(n => (n.gapCodes || []).includes(currentCode))
            : null;
          const previewStatus = previewNoteHoisted?.status;
          return (
          <div className={styles.leftPane}>
            <div className={styles.paneHeader}>
              {(() => {
                if (leftWorkspace === 'schedule') {
                  return <span className={styles.paneTitle}>Schedule Appointment</span>;
                }
                if (leftWorkspace === 'task') {
                  return <span className={styles.paneTitle}>Add Task</span>;
                }
                if (leftWorkspace === 'outreach') {
                  return <span className={styles.paneTitle}>Add Outreach</span>;
                }
                if (leftWorkspace === 'document') {
                  return <span className={styles.paneTitle}>{docUpload.editingId ? 'Edit Document' : 'Upload Document'}</span>;
                }
                if (leftWorkspace === 'document-preview') {
                  return <span className={styles.paneTitle}>{previewDoc?.name || 'Document'}</span>;
                }
                if (leftWorkspace === 'clinical-note-consolidated') {
                  return <span className={styles.paneTitle}>Consolidated Clinical Note</span>;
                }
                if (leftWorkspace === 'task-detail') {
                  return <span className={styles.paneTitle}>Task Details</span>;
                }
                if (leftWorkspace === 'appointment-detail') {
                  return <span className={styles.paneTitle}>Appointment Details</span>;
                }
                if (leftWorkspace === 'referral') {
                  return <span className={styles.paneTitle}>Send Referral</span>;
                }
                if (leftWorkspace === 'reminder') {
                  return <span className={styles.paneTitle}>{reminderForm.editingId ? 'Edit Reminder' : 'Set Reminder'}</span>;
                }
                if (leftWorkspace === 'measure-info') {
                  return <span className={styles.paneTitle}>Measure Tutorial</span>;
                }
                const isPreview = leftWorkspace === 'clinical-note-preview';
                const previewNote = previewNoteHoisted;
                const codes = previewNote?.gapCodes?.length
                  ? previewNote.gapCodes
                  : [currentCode];
                const noteTitle = codes.length > 1
                  ? 'Consolidated Clinical Note'
                  : `${codes[0]} Visit Note`;
                // Editable mode: gap-specific title (COL Visit Note /
                // Consolidated Clinical Note) with a small icon+text status
                // subtitle underneath — same icon vocabulary the HCC
                // worklist uses (solar:sun-bold for Action Needed / In
                // Progress). Preview mode keeps its Signed / Submitted /
                // Draft attribution subtitle instead.
                if (!isPreview) {
                  const status = previewNote?.status;
                  const stat = status === 'signed'
                    ? { icon: 'solar:check-circle-bold', color: 'var(--status-success)', label: 'Signed' }
                    : status === 'submitted'
                      ? { icon: 'solar:clock-circle-bold', color: 'var(--status-warning)', label: 'Pending Review' }
                      : status === 'draft'
                        ? { icon: 'solar:file-text-linear', color: 'var(--neutral-300)', label: 'Draft' }
                        : { icon: 'solar:sun-bold', color: 'var(--status-warning)', label: 'In Progress' };
                  return (
                    <div className={styles.paneTitleStack}>
                      <span className={styles.paneTitle}>{noteTitle}</span>
                      <span className={styles.paneStatusRow} style={{ color: stat.color }}>
                        <Icon name={stat.icon} size={12} color={stat.color} />
                        {stat.label}
                      </span>
                    </div>
                  );
                }
                let subtitle = null;
                if (previewNote?.status === 'signed') {
                  const signer = previewNote.signedByName || previewNote.reviewerName || previewNote.authorName || 'Provider';
                  const when = previewNote.signedAt ? ` · ${formatPreviewDate(previewNote.signedAt)}` : '';
                  subtitle = `Signed by ${signer}${when}`;
                } else if (previewNote?.status === 'submitted') {
                  subtitle = `Submitted for Review to ${previewNote.reviewerName || '—'}`;
                } else if (previewNote?.status === 'draft') {
                  subtitle = `Draft · ${previewNote.authorName || 'You'} · ${formatPreviewDate(previewNote.updatedAt || previewNote.createdAt)}`;
                }
                return (
                  <div className={styles.paneTitleStack}>
                    <span className={styles.paneTitleSm}>{noteTitle}</span>
                    {subtitle && (
                      <span className={styles.paneSubtitleSm}>
                        <Icon name="solar:pen-new-square-linear" size={11} color="var(--primary-300)" />
                        {subtitle}
                      </span>
                    )}
                  </div>
                );
              })()}
              <div className={styles.paneHeaderRight}>
                {leftWorkspace === 'schedule' ? (
                  <Button variant="primary" size="M" disabled={!scheduleDrawer.canSchedule} onClick={scheduleDrawer.handleSchedule}>
                    Schedule
                  </Button>
                ) : leftWorkspace === 'outreach' ? (
                  <Button variant="primary" size="M" disabled={!outreach.canSave} onClick={handleSaveOutreach}>
                    Save
                  </Button>
                ) : leftWorkspace === 'document' ? (
                  <Button variant="primary" size="M" disabled={!docUpload.canSave} onClick={handleUploadDocument}>
                    {docUpload.editingId ? 'Save' : 'Upload'}
                  </Button>
                ) : leftWorkspace === 'document-preview' ? (
                  previewDoc?.fileUrl ? (
                    <ActionButton
                      icon="solar:square-top-down-linear"
                      size="L"
                      tooltip="Open in new tab"
                      onClick={() => { const w = window.open(previewDoc.fileUrl, '_blank', 'noopener'); try { w?.focus(); } catch { /* popup blocked */ } }}
                    />
                  ) : null
                ) : leftWorkspace === 'clinical-note' ? (
                  (() => {
                    // The author revisiting their own Pending Review note
                    // sees Update-and-Save instead of Sign & Save — pushes
                    // the revised state back to the same reviewer via
                    // handleSubmitForReview (which re-notifies). Signing is
                    // still available from the chevron menu as an escape
                    // hatch.
                    const amendNote = amendNoteId ? memberNotes.find(n => n.id === amendNoteId) : null;
                    const authorEditingSubmitted = !!amendNote
                      && amendNote.status === 'submitted'
                      && amendNote.authorName === currentActorName();
                    return (
                      <ClinicalNoteHeaderActions
                        onSaveDraft={handleGuardedSaveDraft}
                        onSubmitForReview={clinicalNote.handleSubmitForReview}
                        onSaveAndSign={clinicalNote.handleSaveAndSign}
                        onSignAndPrint={clinicalNote.handleSignAndPrint}
                        canSaveDraft={canSaveDraftEffective}
                        canSign={clinicalNote.activeMandatoryComplete}
                        authorEditingSubmitted={authorEditingSubmitted}
                      />
                    );
                  })()
                ) : leftWorkspace === 'clinical-note-preview' ? (
                  // Preview affordances branch on the note's DB status:
                  //   • signed    → Displayed-to-Member + Print + Amend
                  //     (Amend seeds the editable workspace from this note's
                  //      persisted payload; the DB trigger snapshots the
                  //      prior row for versioned audit).
                  //   • submitted → Pending Review status pill + Edit
                  //     (Edit flips to the stacked consolidated editor so
                  //      the author can revise a note that is out for review
                  //      before it comes back).
                  previewStatus === 'submitted' ? (
                    <>
                      <span className={styles.previewPendingReview}>
                        <Icon name="solar:clock-circle-linear" size={16} color="var(--status-warning)" />
                        Pending Review
                      </span>
                      <span className={styles.headerDivider} />
                      <Button
                        variant="tertiary"
                        size="M"
                        leadingIcon="solar:pen-new-square-linear"
                        onClick={() => {
                          const note = selectedNoteId ? memberNotes.find(n => n.id === selectedNoteId) : memberNotes.find(n => (n.gapCodes || []).includes(currentCode));
                          if (note?.id) setAmendNoteId(note.id);
                          setLeftWorkspace('clinical-note-consolidated');
                        }}
                      >
                        Edit
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className={styles.previewDisplayed}>
                        <Icon name="solar:check-circle-linear" size={16} color="var(--status-success)" />
                        Displayed to Member
                      </span>
                      <span className={styles.headerDivider} />
                      <ActionButton
                        icon="solar:printer-linear"
                        size="L"
                        tooltip="Print"
                        onClick={() => {
                          const url = memberNotes.find(n => n.id === selectedNoteId)?.pdfDataUrl || memberNotes.find(n => (n.gapCodes || []).includes(currentCode))?.pdfDataUrl;
                          if (url) { const w = window.open(url, '_blank'); try { w?.focus(); } catch {} }
                          else showToast('No PDF for this version');
                        }}
                      />
                      <Button
                        variant="tertiary"
                        size="M"
                        leadingIcon="solar:lock-keyhole-minimalistic-linear"
                        onClick={() => {
                          const note = selectedNoteId ? memberNotes.find(n => n.id === selectedNoteId) : memberNotes.find(n => (n.gapCodes || []).includes(currentCode));
                          if (note?.id) setAmendNoteId(note.id);
                          setLeftWorkspace('clinical-note');
                        }}
                      >
                        Amend
                      </Button>
                    </>
                  )
                ) : leftWorkspace === 'clinical-note-consolidated' ? (
                  (() => {
                    const amendNote = amendNoteId ? memberNotes.find(n => n.id === amendNoteId) : null;
                    const authorEditingSubmitted = !!amendNote
                      && amendNote.status === 'submitted'
                      && amendNote.authorName === currentActorName();
                    return (
                      <ClinicalNoteHeaderActions
                        onSaveDraft={handleGuardedSaveDraft}
                        onSubmitForReview={clinicalNote.handleSubmitForReview}
                        onSaveAndSign={clinicalNote.handleSaveAndSign}
                        onSignAndPrint={clinicalNote.handleSignAndPrint}
                        canSaveDraft={canSaveDraftEffective}
                        canSign={clinicalNote.anyReadyForReview}
                        authorEditingSubmitted={authorEditingSubmitted}
                      />
                    );
                  })()
                ) : leftWorkspace === 'appointment-detail' ? (
                  // Appointment Details saves each field as it changes.
                  null
                ) : leftWorkspace === 'referral' ? (
                  <>
                    <Button variant="secondary" size="M" disabled={!canSaveReferralDraft} onClick={() => saveReferral(REFERRAL_STATUS.draft)}>
                      Save as Draft
                    </Button>
                    <Button variant="primary" size="M" disabled={!canSendReferral} onClick={() => saveReferral(REFERRAL_STATUS.referred)}>
                      Sign &amp; Refer
                    </Button>
                  </>
                ) : leftWorkspace === 'reminder' ? (
                  <Button variant="primary" size="M" disabled={!reminderForm.canSave} onClick={handleSaveReminder}>
                    Save
                  </Button>
                ) : leftWorkspace === 'task-detail' ? (
                  // Task detail is a read/edit surface; the task's own
                  // header (status pill, title, etc.) lives in the body so
                  // there's no CTA to render alongside the close button.
                  null
                ) : leftWorkspace === 'measure-info' ? (
                  // Measure Details is a read-only reference pane — no
                  // CTA next to the close button.
                  null
                ) : (
                  <Button variant="primary" size="M" disabled={!addTask.canSave} onClick={addTask.handleSave}>
                    Save Task
                  </Button>
                )}
                <span className={styles.headerDivider} />
                <CloseButton
                  size={18}
                  onClick={closeLeftWorkspace}
                  label={
                    leftWorkspace === 'schedule'
                      ? 'Close Schedule Appointment'
                      : leftWorkspace === 'outreach'
                        ? 'Close Add Outreach'
                        : leftWorkspace === 'document'
                          ? (docUpload.editingId ? 'Close Edit Document' : 'Close Upload Document')
                          : leftWorkspace === 'document-preview'
                            ? 'Close Document Preview'
                            : leftWorkspace === 'clinical-note'
                        || leftWorkspace === 'clinical-note-preview'
                        || leftWorkspace === 'clinical-note-consolidated'
                        ? 'Close Clinical Note'
                        : leftWorkspace === 'appointment-detail'
                          ? 'Close Appointment Details'
                          : leftWorkspace === 'reminder'
                          ? 'Close Set Reminder'
                          : leftWorkspace === 'referral'
                          ? 'Close Send Referral'
                          : leftWorkspace === 'task-detail'
                          ? 'Close Task Details'
                          : leftWorkspace === 'measure-info'
                            ? 'Close Measure Tutorial'
                            : 'Close Add Task'
                  }
                />
              </div>
            </div>
            {/* Consolidated workspace pins its info banner as a sibling of
                leftPaneBody so it sits directly under the pane header,
                edge-to-edge, and stays fixed while the body scrolls. */}
            {leftWorkspace === 'clinical-note-consolidated' && (
              <div className={styles.clinicalNoteInfoBanner}>
                <Icon name="solar:info-circle-linear" size={14} color="var(--status-info)" />
                <span>All signed notes sync to the patient's EHR.</span>
              </div>
            )}
            <div className={`${styles.leftPaneBody} ${leftWorkspace === 'clinical-note' ? styles.leftPaneBodyClinicalNote : ''} ${leftWorkspace === 'clinical-note-preview' ? styles.leftPaneBodyClinicalNotePreview : ''} ${leftWorkspace === 'clinical-note-consolidated' ? styles.leftPaneBodyClinicalNoteConsolidated : ''} ${leftWorkspace === 'schedule' ? styles.leftPaneBodySchedule : ''} ${leftWorkspace === 'document-preview' ? styles.leftPaneBodyDocPreview : ''} ${leftWorkspace === 'appointment-detail' ? styles.leftPaneBodyFlush : ''}`}>
              {leftWorkspace === 'schedule' ? (
                <ScheduleDrawerBookingBody {...scheduleDrawer} timezoneLabel="GMT" patientLocked />
              ) : leftWorkspace === 'document' ? (
                <DocumentUploadForm form={docUpload} docTypes={DOC_TYPES} />
              ) : leftWorkspace === 'document-preview' ? (
                previewDoc ? (
                  <FilePreview src={previewDoc.fileUrl} file={previewDoc.file} name={previewDoc.name} ext={previewDoc.ext} />
                ) : null
              ) : leftWorkspace === 'outreach' ? (
                <OutreachTabView tab={outreach} hideLogForRow hideActivity hideFormFooter flush taskMember={member?.name} schedulePatient={schedulePatient}
                  onTaskCreated={logTaskAdded} onAppointmentScheduled={(row) => { logAppointmentScheduled(row); fetchAppointments?.(); }} />
              ) : leftWorkspace === 'clinical-note' ? (
                <ClinicalNoteWorkspaceBody v={clinicalNote} />
              ) : leftWorkspace === 'clinical-note-preview' ? (
                <ClinicalNotePreviewBody memberId={member?.id} gapCode={currentCode} noteId={selectedNoteId} />
              ) : leftWorkspace === 'clinical-note-consolidated' ? (
                <ConsolidatedNoteBody v={clinicalNote} />
              ) : leftWorkspace === 'referral' ? (
                <CareGapReferralForm
                  form={referralForm}
                  providers={referralProviders}
                  senderLines={referralSenderLines}
                  patientDocuments={memberDocs.map(d => ({ id: d.id, name: d.name, type: d.type, addedAt: d.createdAt, url: d.fileUrl }))}
                  docTypes={DOC_TYPES}
                  onUploadDocument={createMemberDocument}
                  onGenerateEmail={handleGenerateReferralEmail}
                  generatingEmail={generatingReferralEmail}
                  emailSignature={referralEmailSignature}
                  ccMember={member && { id: member.id, name: member.name, initials: member.in }}
                />
              ) : leftWorkspace === 'reminder' ? (
                <CareGapReminderForm form={reminderForm} users={platformUsers} />
              ) : leftWorkspace === 'appointment-detail' ? (
                openAppt ? (
                  <ScheduleDrawer
                    key={openAppt.id}
                    existingAppointment={openAppt}
                    initialSelectedPatient={schedulePatient}
                    patientLocked
                    inline
                    onClose={closeLeftWorkspace}
                  />
                ) : null
              ) : leftWorkspace === 'task-detail' ? (
                inPlaceTask ? (
                  <TaskDetailDrawer task={inPlaceTask} inline onClose={closeLeftWorkspace} />
                ) : null
              ) : leftWorkspace === 'measure-info' ? (
                <MeasureInfoBody gapCode={currentCode} />
              ) : (
                <AddTaskDrawerBody {...addTask} />
              )}
            </div>
          </div>
          );
        })()}
        <div className={styles.contentBody}>
          {inSplit && (
            <div className={styles.patientBannerWrap}>
              <PatientBanner initials={member.in} name={member.name} gender={member.gender} age={member.age} dob={member.dob}
                memberId={member.memberId} hidePatientLabel patientId={member.id} />
            </div>
          )}
          <CareGapDetailDrawerHeader
            gap={gap} member={member} selectedYear={selectedYear} setSelectedYear={setSelectedYear}
            yearOpen={yearOpen} setYearOpen={setYearOpen} yearOptions={yearOptions}
            status={status} statusLocked={statusLocked}
            statusOpen={statusOpen} setStatusOpen={setStatusOpen} statusAnchorRect={statusAnchorRect} setStatusAnchorRect={setStatusAnchorRect} updateGapStatus={updateGapStatus}
            platformUsers={platformUsers} updateGapAssignee={updateGapAssignee}
            showToast={showToast} setShowClinicalNote={setShowClinicalNote}
            onOpenClinicalNote={openClinicalNoteFlow}
            onScheduleAppointment={() => setLeftWorkspace('schedule')}
            onAddOutreach={openOutreachWorkspace}
            onOpenMeasureInfo={() => setLeftWorkspace('measure-info')} moreBtnRef={moreBtnRef}
            moreMenuRect={moreMenuRect} openMoreMenu={openMoreMenu} closeMoreMenu={closeMoreMenu}
            goPrev={goPrev} goNext={goNext} canPrev={canPrev} canNext={canNext}
          />

          {/* Shared TabStrip — same underline motion the HCC drawer uses.
              Counts are baked into `label` as "(N)" so we skip the Badge
              default that `count` renders. `fullWidth={false}` because
              this drawer's `.drawerBody` already has `padding: 0` — the
              default bleed would apply a -24px margin and push the row
              past the drawer's own edges. */}
          <TabStrip
            items={TABS.map((tab) => ({
              key: tab.key,
              label: tabCounts[tab.key] != null
                ? `${tab.label} (${tabCounts[tab.key]})`
                : tab.label,
            }))}
            activeKey={activeTab}
            onChange={setActiveTab}
            fullWidth={false}
            size="S"
          />

          <div className={`${styles.tabContentWrap} ${(activeTab === 'Tasks' || activeTab === 'Outreaches') ? styles.tabContentWrapFlush : ''}`}>
            {activeTab === 'Activity Log' ? (
              <div className={styles.activityLog}>
                <div className={styles.commentInput}>
                  {/* Same composer as the HCC Diagnosis Gaps drawer: @mention
                      chips, and the mentioned people get a bell from the
                      caregap_comments trigger. */}
                  <CommentComposer
                    placeholder="Add a comment, use @ to mention someone"
                    onSubmit={(text, mentions) => addCaregapComment({ memberId: member.id, gapCode: currentCode, body: text, mentions })}
                  />
                </div>
                {caregapActivityLoaded
                  ? <ActivityLog entries={activityLogEntries} emptyLabel="No activity yet for this care gap." onOpenTask={handleOpenTaskInPlace} onOpenNote={openNoteInWorkspace} />
                  : <CardSkeleton />}
              </div>
            ) : activeTab === 'Outreaches' ? (
              // While Add Outreach is open in the left pane, the tab shows
              // only the log so the same form isn't rendered twice.
              <OutreachTabView tab={outreach} hideLogForRow hideForm={leftWorkspace === 'outreach'} taskMember={member?.name} schedulePatient={schedulePatient}
                onLogNew={openOutreachWorkspace}
                onTaskCreated={logTaskAdded} onAppointmentScheduled={(row) => { logAppointmentScheduled(row); fetchAppointments?.(); }} />
            ) : activeTab === 'Documents' ? (
              programDocumentsDidFetch ? (
                <DocumentList
                  documents={memberDocs.map(d => ({
                    id: d.id,
                    name: d.name,
                    meta: [d.type, d.programCode, d.updatedDate, d.updatedBy].filter(Boolean).join(' • '),
                  }))}
                  onUpload={openDocumentUpload}
                  onOpen={(d) => openDocumentPreview(d.id)}
                  menuItems={[
                    { key: 'edit', icon: 'solar:pen-linear', label: 'Edit' },
                    { key: 'delete', icon: 'solar:trash-bin-2-linear', label: 'Delete', danger: true },
                  ]}
                  onMenuSelect={(key, d) => {
                    const doc = memberDocs.find(x => x.id === d.id);
                    if (!doc) return;
                    if (key === 'edit') {
                      docUpload.startEdit({ id: doc.id, caption: doc.name, docType: doc.type });
                      setLeftWorkspace('document');
                    } else if (key === 'delete') {
                      setDocToDelete(doc);
                    }
                  }}
                  emptyLabel="No documents uploaded for this member yet."
                />
              ) : <CardSkeleton />
            ) : activeTab === 'Referrals' ? (
              <DocumentList
                documents={memberReferrals.map(r => ({
                  id: r.id,
                  name: `Referral to ${r.providerName}`,
                  meta: [
                    REFERRAL_CHANNELS.find(c => c.key === r.channel)?.label || r.channel,
                    r.providerContact,
                    r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '',
                    r.sentBy,
                  ].filter(Boolean).join(' • '),
                  status: isReferralDraft(r)
                    ? { variant: 'status-review', label: 'Draft' }
                    : { variant: 'status-completed', label: r.status || 'Sent' },
                }))}
                showStatus
                onOpen={(d) => openReferralDraft(d.id)}
                onUpload={openReferral}
                uploadLabel="Send Referral"
                emptyLabel="No referrals sent for this member yet."
              />
            ) : activeTab === 'Clinical Notes' ? (
              // Flat column-headed list per Figma 1030:78586 — no timeline
              // rail, no month grouping. Card affordances are shared with
              // the Activity Log via ClinicalNoteCardActions.
              <ClinicalNotesTab entries={clinicalNoteEntries} onOpenNote={openNoteInWorkspace} onOpenTask={handleOpenTaskInPlace} />
            ) : activeTab === 'Tasks' ? (
              // Same layout as the P360 patient profile's Tasks tab —
              // Pending / Overdue / Completed sections, checkbox rows,
              // priority + due columns, so a task looks identical in
              // both the drawer here and the P360 view.
              <TasksTab
                hideToolbar
                data={groupTasksForTab(memberTasks)}
                onTaskClick={openTaskDetail}
              />
            ) : activeTab === 'Appt/Reminders' ? (
              <CareGapAppointmentsTab
                appointments={memberAppointments}
                platformUsers={platformUsers}
                onOpen={openAppointmentDetail}
                onEdit={openAppointmentDetail}
                selectedId={leftWorkspace === 'appointment-detail' ? openAppt?.id : leftWorkspace === 'reminder' ? reminderForm.editingId : null}
                reminders={memberReminders}
                onOpenReminder={openReminderEdit}
                onDeleteReminder={setReminderToDelete}
                onCompleteReminder={(r) => {
                  updateCaregapReminder(member.id, r.id, { status: 'Completed' });
                  logReminder('Reminder Completed', r, 'Completed');
                  showToast('Reminder marked as done');
                }}
                onReminderAssigneeChange={(r, name) => {
                  updateCaregapReminder(member.id, r.id, { assignee: name });
                  logCareGapActivity(member.id, {
                    when: new Date().toISOString(),
                    actor: currentActorName(),
                    t: 'assignee_change',
                    title: `${r.title || 'Reminder'} Assignee Changed`,
                    gapCodes: [currentCode],
                    fromAssignee: r.assignee ? { initials: initialsOf(r.assignee), name: r.assignee } : null,
                    toAssignee: { initials: initialsOf(name), name },
                  });
                }}
                onDelete={setApptToDelete}
                onAssigneeChange={(appt, name) => {
                  const prev = appt.primary_user || null;
                  updateAppointment?.(appt.id, { primary_user: name });
                  logCareGapActivity(member.id, {
                    when: new Date().toISOString(),
                    actor: currentActorName(),
                    t: 'assignee_change',
                    title: `${appt.appointment_type_name || 'Appointment'} Assignee Changed`,
                    gapCodes: [currentCode],
                    fromAssignee: prev ? { initials: initialsOf(prev), name: prev } : null,
                    toAssignee: { initials: initialsOf(name), name },
                  });
                }}
              />
            ) : (
              <div className={styles.emptyTab}>
                <Icon name="solar:hourglass-line-linear" size={36} color="var(--neutral-200)" />
                <p className={styles.emptyTabTitle}>{activeTab} — coming soon</p>
              </div>
            )}
          </div>
        </div>
      </Drawer>

      {moreMenuRect && (
        <MenuPopover
          anchorRect={moreMenuRect}
          items={MORE_ACTIONS.map(a => ({ key: a.key, label: a.label, icon: a.icon }))}
          onSelect={(key) => {
            const action = MORE_ACTIONS.find(x => x.key === key);
            if (action) runMoreAction(action);
          }}
          onClose={closeMoreMenu}
          ariaLabel="More actions"
          width={220}
        />
      )}
    </>
  );
}
