import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../../../../../../store/useAppStore';
import { Icon } from '../../../../../../../components/Icon/Icon';
import { DownChevronIcon } from '../../../../../../../components/Icon/DownChevronIcon';
import { ActionButton } from '../../../../../../../components/ActionButton/ActionButton';
import { SearchBar } from '../../../../../../../components/SearchBar/SearchBar';
import { FilterChip } from '../../../../../../../components/FilterChip/FilterChip';
import { MenuPopover } from '../../../../../../../components/MenuPopover/MenuPopover';
import { Button } from '../../../../../../../components/Button/Button';
import { BannerExpandIcon } from '../../../../../../../components/Icon/BannerExpandIcon';
import { ProgressRing } from '../../../../../../hcc/DiagPanel/ReviewProgressPopover';
import { Checkbox } from '../../../../../../../components/ShadcnCheckbox/ShadcnCheckbox';
import { ProgramStatusRing } from '../ProgramStatusRing/ProgramStatusRing.jsx';
import { toast } from '../../../../../../../components/Toast/Toast';
import { PROGRAM_STEPS, PROGRAM_LETTERS_MOCK } from '../../../../../data/programActivityMock';
import { PROGRAM_STATUS_OPTIONS, statusColorFor } from '../../../../../data/programStatus';
import { RoleAssigneePicker } from '../../../../../../hcc/RoleAssigneePicker';
import { ProgramBadges } from '../ProgramBadges/ProgramBadges.jsx';
import { OutreachTab } from '../../../../../left-panel/tabs/outreach/OutreachTab/OutreachTab.jsx';
import { CcmBillingReview } from '../billing/CcmBillingReview/CcmBillingReview.jsx';
import { SendLetterDrawer } from '../letters/SendLetterDrawer/SendLetterDrawer.jsx';
import { PreVisitStep } from '../steps/PreVisitStep/PreVisitStep.jsx';
import { AssessmentFormView } from '../steps/AssessmentFormView/AssessmentFormView.jsx';
import { CarePlanView } from '../steps/CarePlanView/CarePlanView.jsx';
import { AppointmentStep } from '../steps/AppointmentStep/AppointmentStep.jsx';
import { PostVisitChecklist } from '../steps/PostVisitChecklist/PostVisitChecklist.jsx';
import { OpenCareGaps } from '../steps/OpenCareGaps/OpenCareGaps.jsx';
import { MedicationReconciliation } from '../steps/MedicationReconciliation/MedicationReconciliation.jsx';
import { ProgramRelatedTasks } from '../related/ProgramRelatedTasks/ProgramRelatedTasks.jsx';
import { AddTaskDrawer } from '../../../../../../tasks/TasksView';
import { ProgramRelatedFiles } from '../related/ProgramRelatedFiles/ProgramRelatedFiles.jsx';
import { ReferralReview } from '../steps/ReferralReview/ReferralReview.jsx';
import { AddLetterDrawer } from '../letters/AddLetterDrawer/AddLetterDrawer.jsx';
import { LetterHistoryDrawer } from '../letters/LetterHistoryDrawer/LetterHistoryDrawer.jsx';
import { LetterPreviewDrawer } from '../letters/LetterPreviewDrawer/LetterPreviewDrawer.jsx';
import { RingEmptyState } from '../../../../../../../components/RingEmptyState/RingEmptyState';
import styles from './ProgramDetailView.module.css';

// Program Related Tasks filter helpers — chip options/matching derive from the
// task's own fields (status/priority/due_date/completed_at).
const TASK_STATUS_LABEL = { pending: 'Pending', missed: 'Missed', completed: 'Completed' };
const capFirst = (s = '') => s.charAt(0).toUpperCase() + s.slice(1);
const fmtCompletedDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
};
const EMPTY_TASK_FILTERS = { status: [], priority: [], dueDate: [], completedDate: [] };

// Per-program step lists live in PROGRAM_STEPS (keyed by code). Unknown codes
// fall back to the SNP list.
const initialsOf = (name = '') =>
  name.split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase() || '?';

const stepsFor = (code) => PROGRAM_STEPS[code] || PROGRAM_STEPS.SNP;
const flatSteps = (list) => list.flatMap(s => (s.type === 'section' ? s.children : [s]));


// Neutral fallback for steps whose content view hasn't been built yet.
function StepPlaceholder({ name }) {
  return (
    <div className={styles.stepPlaceholder}>
      <Icon name="solar:documents-linear" size={36} color="var(--neutral-150)" />
      <p className={styles.stepPlaceholderTitle}>{name}</p>
      <p className={styles.stepPlaceholderText}>This step is coming soon.</p>
    </div>
  );
}

function DetailRow({ icon, label, value }) {
  return (
    <div className={styles.detailRow}>
      <span className={styles.detailLabelGroup}>
        <Icon name={icon} size={16} color="var(--neutral-400)" />
        <span className={styles.detailLabel}>{label}</span>
      </span>
      <span className={styles.detailValue}>{value}</span>
    </div>
  );
}

function CheckMark() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M2.5 5L4.5 7L7.5 3" stroke="var(--status-success)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StepStatusIcon({ status }) {
  if (status === 'completed') {
    return (
      <span className={styles.statusCompleted}>
        <CheckMark />
      </span>
    );
  }
  return <span className={styles.statusPending} />;
}

function StepItem({ step, isActive, onClick, isChild }) {
  return (
    <button
      className={`${styles.stepItem} ${isActive ? styles.stepItemActive : ''} ${isChild ? styles.stepChild : ''}`}
      onClick={onClick}
    >
      <StepStatusIcon status={step.status} />
      <span className={isActive ? styles.stepNameActive : styles.stepName}>{step.name}</span>
      {(step.mandatory || step.hasAlert) && <span className={styles.mandatoryDot} />}
    </button>
  );
}

function SectionHeader({ name, expanded, onToggle }) {
  return (
    <button className={styles.sectionHeader} onClick={onToggle}>
      <DownChevronIcon
        size={16}
        color="var(--neutral-300)"
        style={expanded ? undefined : { transform: 'rotate(-90deg)' }}
      />
      <span className={styles.sectionName}>{name}</span>
    </button>
  );
}

const LETTER_SUB_TABS = ['All', 'Sent', 'Not Sent'];

// Steps that render a saved form (from Settings → Content → Forms) in the
// Review layout. Keyed by step name → the form to load + review-header meta.
const ASSESSMENT_STEPS = {
  HRA: { formName: 'HRA Assessment form', title: 'Health Risk Assessment', filledBy: 'Annette Brave', filledDate: '10/11/24', reviewedBy: 'Robert Fox', reviewedDate: '10/11/24' },
  'BRCSI Assessment': { formName: 'BRCSI Assessment form', title: 'BRCSI Assessment', filledBy: 'Annette Brave', filledDate: '10/11/24', reviewedBy: 'Robert Fox', reviewedDate: '10/11/24' },
  'SNP Assessment': { formName: 'SNP Assessment form', title: 'SNP Assessment', filledBy: 'Annette Brave', filledDate: '10/11/24', reviewedBy: 'Robert Fox', reviewedDate: '10/11/24' },
  // Post Visit Checklist is a fixed checklist (not a saved form), so it shares
  // the review header but renders the PostVisitChecklist body.
  'Post Visit Checklist': { checklist: true, title: 'Post Visit Check List', filledBy: 'Robert Fox', filledDate: '10/11/24', reviewedBy: 'Robert Fox', reviewedDate: '10/11/24' },
  // Programs other than SNP name this step "Post-Visit" — same checklist body.
  'Post-Visit': { checklist: true, title: 'Post Visit Check List', filledBy: 'Robert Fox', filledDate: '10/11/24', reviewedBy: 'Robert Fox', reviewedDate: '10/11/24' },
};

export function ProgramDetailView({ program, onClose, startAtFirstStep = false, onSwitchProgram }) {
  const isCcm = program.code === 'CCM';
  const isSnp = program.code === 'SNP';
  const stepList = stepsFor(program.code);
  const ALL_STEPS = flatSteps(stepList);
  const firstStep = stepList[0];
  // Completion % for the header status ring — completed steps ÷ total steps.
  const programProgress = ALL_STEPS.length
    ? Math.round((ALL_STEPS.filter(s => s.status === 'completed').length / ALL_STEPS.length) * 100)
    : 0;
  // Land on the first step by default (CCM keeps its billing step); step ids
  // differ per program so we can't hardcode one.
  const [activeStep, setActiveStep] = useState(isCcm ? 'ccm-billing' : firstStep?.id);
  // Section open/closed is seeded from each section's own `expanded` flag
  // (SectionHeader falls back to it), so an empty map works for every program.
  const [expandedSections, setExpandedSections] = useState({});
  const [activeLetterTab, setActiveLetterTab] = useState('All');
  const [letterSearchOpen, setLetterSearchOpen] = useState(false);
  const [letterSearchText, setLetterSearchText] = useState('');
  const [letterFiltersOpen, setLetterFiltersOpen] = useState(false);
  const EMPTY_LETTER_FILTERS = { fileType: [], sentVia: [], lastSent: [], sentBy: [] };
  const [letterFilters, setLetterFilters] = useState(EMPTY_LETTER_FILTERS);
  const [selectedLetters, setSelectedLetters] = useState(() => new Set());
  // Send-letter drawer target: null | { letterName, clearOnSent }. Opened from
  // the bulk bar (all/selected) or a single row's send icon.
  const [sendTarget, setSendTarget] = useState(null);
  // Per-row "more" menu (Preview / Download): { id, rect } | null.
  const [rowMenu, setRowMenu] = useState(null);
  // Letter whose PDF is open in the Preview Letter drawer.
  const [previewTarget, setPreviewTarget] = useState(null);
  // Add Task drawer (Program Related Tasks step).
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  // Program Related Tasks filter bar (toggled by the header filter icon). The
  // chips live in the section header; filter values are passed down to the
  // list. Options derive from this program's tasks.
  const [taskFiltersOpen, setTaskFiltersOpen] = useState(false);
  const [taskSearchOpen, setTaskSearchOpen] = useState(false);
  const [taskSearchText, setTaskSearchText] = useState('');
  const [taskFilters, setTaskFilters] = useState(EMPTY_TASK_FILTERS);
  const setTaskFilter = (key, vals) => setTaskFilters(f => ({ ...f, [key]: vals }));
  const taskFiltersActive = Object.values(taskFilters).some(v => v.length > 0);
  const programAddedTasks = useAppStore(s => s.programAddedTasks[program.code]);
  const allStoreTasks = useAppStore(s => s.tasks);
  const programTasks = useMemo(
    () => (programAddedTasks || []).map(a => allStoreTasks.find(g => g.id === a.id) || a),
    [programAddedTasks, allStoreTasks],
  );
  const taskFilterMeta = useMemo(() => ([
    { key: 'status', label: 'Status', options: [...new Set(programTasks.flatMap(t => TASK_STATUS_LABEL[t.status] ? [TASK_STATUS_LABEL[t.status]] : []))] },
    { key: 'priority', label: 'Priority', options: [...new Set(programTasks.flatMap(t => { const v = capFirst(t.priority); return v ? [v] : []; }))] },
    { key: 'dueDate', label: 'Due Date', options: [...new Set(programTasks.flatMap(t => t.due_date ? [t.due_date] : []))] },
    { key: 'completedDate', label: 'Completed Date', options: [...new Set(programTasks.flatMap(t => { const v = fmtCompletedDate(t.completed_at); return v ? [v] : []; }))] },
  ]), [programTasks]);
  const addProgramTask = useAppStore(s => s.addProgramTask);
  // Letters pane drawers.
  const [addLetterOpen, setAddLetterOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [addedLetterIds, setAddedLetterIds] = useState(() => new Set());

  // The member whose care program we're in — drives the send-letter prefill.
  const currentPatient = useAppStore(s => s.patients.find(p => p.id === s.selectedPatientId));

  // Live program row from the store so the header status dropdown reflects
  // (and persists) changes without relying on the stale `program` prop.
  const patientId = useAppStore(s => s.selectedPatientId);
  const updateCareProgram = useAppStore(s => s.updateCareProgram);
  // Letters library from Supabase (PDFs); falls back to the mock when empty.
  const storeLetters = useAppStore(s => s.letters);
  const fetchLetters = useAppStore(s => s.fetchLetters);
  useEffect(() => { fetchLetters(); }, [fetchLetters]);
  const letters = storeLetters.length ? storeLetters : PROGRAM_LETTERS_MOCK;
  // The table shows a small default set; the rest are opt-in via Add Letter.
  const DEFAULT_LETTER_NAMES = ['Intro or Welcome Letter - Patient', 'UTR Letter', 'Member Flyers'];
  const visibleLetters = useMemo(
    () => letters.filter(l => DEFAULT_LETTER_NAMES.includes(l.fileName) || addedLetterIds.has(l.id)),
    [letters, addedLetterIds],
  );
  // Letters filter bar — one chip per column (except File Name); options are
  // the distinct values present in the shown letters.
  const letterFilterMeta = useMemo(() => ([
    { key: 'fileType', label: 'File Type', options: [...new Set(visibleLetters.flatMap(l => l.fileType ? [l.fileType] : []))] },
    { key: 'sentVia', label: 'Sent Via', options: [...new Set(visibleLetters.flatMap(l => l.sentVia || []))] },
    { key: 'lastSent', label: 'Last Sent', options: [...new Set(visibleLetters.flatMap(l => l.lastSent ? [l.lastSent] : []))] },
    { key: 'sentBy', label: 'Sent By', options: [...new Set(visibleLetters.flatMap(l => l.sentBy ? [l.sentBy] : []))] },
  ]), [visibleLetters]);
  const setLetterFilter = (key, vals) => setLetterFilters(f => ({ ...f, [key]: vals }));
  const clearLetterFilters = () => setLetterFilters(EMPTY_LETTER_FILTERS);
  const letterFiltersActive = Object.values(letterFilters).some(v => v.length > 0);
  const matchesLetterFilters = (l) =>
    (!letterFilters.fileType.length || letterFilters.fileType.includes(l.fileType))
    && (!letterFilters.sentVia.length || (l.sentVia || []).some(v => letterFilters.sentVia.includes(v)))
    && (!letterFilters.lastSent.length || letterFilters.lastSent.includes(l.lastSent))
    && (!letterFilters.sentBy.length || letterFilters.sentBy.includes(l.sentBy));
  // All / Sent / Not Sent — a letter counts as "sent" once it has a channel.
  const matchesLetterTab = (l) => {
    const sent = (l.sentVia || []).length > 0;
    return activeLetterTab === 'Sent' ? sent : activeLetterTab === 'Not Sent' ? !sent : true;
  };
  const shownLetters = visibleLetters
    .filter(matchesLetterTab)
    .filter(l => !letterSearchText.trim() || l.fileName.toLowerCase().includes(letterSearchText.trim().toLowerCase()))
    .filter(matchesLetterFilters);
  // Select the stable array reference only; derive everything else locally so
  // no selector returns a fresh array/object (that trips useSyncExternalStore's
  // "getSnapshot should be cached" guard).
  const patientPrograms = useAppStore(s => s.careProgramsByPatient[s.selectedPatientId]);
  const liveProgram = patientPrograms?.find(p => p.id === program.id);
  const status = liveProgram?.status || program.status || 'New';
  const assignee = liveProgram?.assignee || program.assignee;

  // SNP trigger navigation — the patient's SNP enrollments, ordered by trigger.
  // Prev/Next render the neighbouring trigger in this same detail window.
  const orderedTriggers = useMemo(
    () => (patientPrograms || []).filter(p => p.code === 'SNP').sort((a, b) => (a.trigger || 0) - (b.trigger || 0)),
    [patientPrograms],
  );
  // Other active programs for this patient — shown as header badges. Excludes
  // the program currently open and any that are Closed.
  const otherPrograms = useMemo(
    () => (patientPrograms || []).filter(p => p.id !== program.id && p.status !== 'Closed'),
    [patientPrograms, program.id],
  );
  // Completion % for any program code (used by the badges' rings).
  const progressForCode = (code) => {
    const flat = flatSteps(PROGRAM_STEPS[code] || []);
    return flat.length ? Math.round((flat.filter(s => s.status === 'completed').length / flat.length) * 100) : 0;
  };

  const triggerIdx = orderedTriggers.findIndex(p => p.id === program.id);
  const prevTrigger = triggerIdx > 0 ? orderedTriggers[triggerIdx - 1] : null;
  const nextTrigger = triggerIdx >= 0 && triggerIdx < orderedTriggers.length - 1 ? orderedTriggers[triggerIdx + 1] : null;
  const triggerNum = (triggerIdx >= 0 ? orderedTriggers[triggerIdx].trigger : program.trigger) || 1;
  const [statusMenu, setStatusMenu] = useState(null); // { rect } | null
  const changeStatus = (newStatus) => {
    const patch = { status: newStatus, statusColor: statusColorFor(newStatus) };
    const cur = liveProgram || program;
    if (newStatus === 'Enrolled' && (!cur.startDate || cur.startDate === '—')) {
      const d = new Date();
      patch.startDate = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
    }
    updateCareProgram(patientId, program.id, patch);
  };

  const allLettersSelected = selectedLetters.size === visibleLetters.length && visibleLetters.length > 0;
  const someLettersSelected = selectedLetters.size > 0 && !allLettersSelected;
  const toggleAllLetters = () =>
    setSelectedLetters(prev => (prev.size === visibleLetters.length ? new Set() : new Set(visibleLetters.map(l => l.id))));
  const toggleLetter = (id) =>
    setSelectedLetters(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  // Download the given letters as files, then confirm with a success toast.
  // Defaults to the current bulk selection.
  // Decode a stored base64 PDF into a Blob (or null for mock letters that
  // have no attached file).
  const letterPdfBlob = (letter) => {
    if (!letter?.contentBase64) return null;
    const bin = atob(letter.contentBase64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: 'application/pdf' });
  };

  const downloadLetters = (chosen) => {
    if (!chosen || chosen.length === 0) return;
    chosen.forEach(letter => {
      const pdf = letterPdfBlob(letter);
      const blob = pdf || new Blob([
        `${letter.fileName}\n\nFile Type: ${letter.fileType}\nSent Via: ${(letter.sentVia || []).join(', ')}\nLast Sent: ${letter.lastSent}\nSent By: ${letter.sentBy}\n`,
      ], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = pdf ? (letter.sourceFile || `${letter.fileName}.pdf`) : `${letter.fileName}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
    toast.success(
      chosen.length === 1 ? 'File downloaded successfully' : `${chosen.length} files downloaded successfully`,
    );
  };

  const previewLetter = (letter) => setPreviewTarget(letter);
  const downloadSelectedLetters = () => downloadLetters(letters.filter(l => selectedLetters.has(l.id)));

  const activeStepObj = ALL_STEPS.find(s => s.id === activeStep);
  const stepName = activeStepObj?.name || '';
  // Mandatory steps can't be skipped — the Skip action is hidden for them.
  const isMandatoryStep = !!activeStepObj?.mandatory;
  const isOutreachStep = stepName === 'Outreach';
  const isBillingStep = activeStepObj?.kind === 'billing';
  const isPreVisitStep = /^pre-?visit$/i.test(stepName);           // "Pre-visit" / "Pre-Visit"
  const isCarePlanStep = stepName === 'Care Plan';
  const isAppointmentStep = /appointment/i.test(stepName);          // "Appointment" / "ICT Appointment"
  const isOpenCareGapsStep = stepName === 'Open Care Gaps' || stepName === 'Care Gaps';
  const isMedReconStep = stepName === 'Medication Reconciliation' || stepName === 'Medication Review';
  const isProgramTasksStep = stepName === 'Program Related Task';
  const isProgramFilesStep = stepName === 'Program Related Files' || stepName === 'Program Documents' || stepName === 'Documents';
  const isReferralStep = stepName === 'Referral Review';
  const assessmentCfg = ASSESSMENT_STEPS[stepName];
  const isLettersStep = stepName === 'Letters';
  const isLettersPane = isLettersStep;
  // Step names without a dedicated view yet (Snapshot, Diagnosis Gaps, PHQ-9,
  // the various assessments/checklists, …) render a neutral placeholder.

  const [detailsExpanded, setDetailsExpanded] = useState(false);

  const isUnassigned = !assignee || assignee === 'Unassigned';

  // Program assignee picker (Care Gaps chip). Reused in the header and in the
  // Outreach step's content actions so both edit the same program assignee.
  const assigneePicker = (
    <RoleAssigneePicker
      role="care_program"
      memberId={program.id}
      dosDate="care-program"
      titleLabel=""
      currentName={isUnassigned ? null : assignee}
      onAssign={user => updateCareProgram(patientId, program.id, { assignee: user.name })}
      trigger={({ ref, onClick }) => (
        isUnassigned ? (
          <button ref={ref} type="button" className={styles.assigneeChipEmpty} onClick={onClick} title="Assign" aria-label="Assign">
            <Icon name="solar:user-plus-linear" size={14} color="var(--neutral-300)" />
            <DownChevronIcon size={11} color="var(--neutral-300)" />
          </button>
        ) : (
          <button ref={ref} type="button" className={styles.assigneeChip} onClick={onClick} title={`Assigned to ${assignee}`} aria-label={assignee}>
            <span className={styles.assigneeAvatar}>{initialsOf(assignee)}</span>
            <DownChevronIcon size={11} color="var(--secondary-300)" />
          </button>
        )
      )}
    />
  );

  // Next step in the flattened step list — drives the Outreach header's Next.
  const activeStepIdx = ALL_STEPS.findIndex(s => s.id === activeStep);
  const nextStep = activeStepIdx >= 0 && activeStepIdx < ALL_STEPS.length - 1
    ? ALL_STEPS[activeStepIdx + 1] : null;
  const goNextStep = () => { if (nextStep) setActiveStep(nextStep.id); };

  const toggleSection = (id) => {
    setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <ProgramStatusRing progress={programProgress} size={16} />
          <span className={styles.programTitle}>{program.name}</span>
          <button
            type="button"
            className={styles.statusBadge}
            onClick={e => setStatusMenu({ rect: e.currentTarget.getBoundingClientRect() })}
          >
            <span className={styles.statusBadgeText} style={{ color: statusColorFor(status) }}>{status}</span>
            <DownChevronIcon size={16} color={statusColorFor(status)} />
          </button>
          {assigneePicker}
          {/* Trigger navigation is SNP-only — other programs have a single track. */}
          {isSnp && (
            <>
              <span className={styles.headerDivider} />
              <div className={styles.breadcrumb}>
                <button
                  type="button"
                  className={styles.breadcrumbArrow}
                  aria-label="Previous trigger"
                  disabled={!prevTrigger}
                  onClick={() => prevTrigger && onSwitchProgram?.(prevTrigger)}
                >
                  <Icon name="solar:alt-arrow-left-linear" size={16} color={prevTrigger ? 'var(--neutral-300)' : 'var(--neutral-150)'} />
                </button>
                <span className={styles.breadcrumbLabel}>Trigger {triggerNum}</span>
                <button
                  type="button"
                  className={styles.breadcrumbArrow}
                  aria-label="Next trigger"
                  disabled={!nextTrigger}
                  onClick={() => nextTrigger && onSwitchProgram?.(nextTrigger)}
                >
                  <Icon name="solar:alt-arrow-right-linear" size={16} color={nextTrigger ? 'var(--neutral-300)' : 'var(--neutral-150)'} />
                </button>
              </div>
            </>
          )}
          <button
            type="button"
            className={styles.expandBtn}
            aria-label={detailsExpanded ? 'Collapse details' : 'Expand details'}
            aria-expanded={detailsExpanded}
            onClick={() => setDetailsExpanded(e => !e)}
          >
            <BannerExpandIcon size={16} className={detailsExpanded ? styles.expandIconRotated : ''} />
          </button>
        </div>
        <div className={styles.headerRight}>
          {isCcm && (
            <>
              <span className={styles.secondaryBadge}>
                <ProgressRing progress={0.5} size={14} stroke={2} />
                BHI
              </span>
              <span className={styles.secondaryBadge}>
                <ProgressRing progress={0.75} size={14} stroke={2} />
                APCM
              </span>
              <span className={styles.headerDivider} />
            </>
          )}
          {otherPrograms.length > 0 && (
            <>
              <ProgramBadges programs={otherPrograms} progressFor={progressForCode} />
              <span className={styles.headerDivider} />
            </>
          )}
          <ActionButton icon="solar:menu-dots-linear" size="S" tooltip="More" />
          <span className={styles.headerDivider} />
          <ActionButton icon="solar:close-square-linear" size="S" tooltip="Close" onClick={onClose} />
        </div>
      </div>

      {/* CCM-only info bar — the horizontal read-only strip under the header
          in the Figma. Uses the same DetailRow styling as the expand panel so
          typography stays consistent. */}
      {isCcm && (
        <div className={styles.ccmInfoBar}>
          <span className={styles.ccmInfoItem}>
            <span className={styles.ccmInfoLabel}>Last Updated:</span> 09/11/2024
          </span>
          <span className={styles.ccmInfoDivider} />
          <span className={styles.ccmInfoItem}>
            <span className={styles.ccmInfoLabel}>DM Type:</span> CKD
          </span>
          <span className={styles.ccmInfoDivider} />
          <span className={styles.ccmInfoItem}>
            <span className={styles.ccmInfoLabel}>1st Outreach Due on:</span> 08/22/2024
            <Icon name="solar:check-circle-linear" size={14} color="var(--status-success)" />
          </span>
          <span className={styles.ccmInfoDivider} />
          <span className={styles.ccmInfoItem}>
            <span className={styles.ccmInfoLabel}>Chronic Condition:</span> 3 Active
            <DownChevronIcon size={14} color="var(--neutral-300)" />
          </span>
          <span className={styles.ccmInfoDivider} />
          <span className={styles.ccmInfoItem}>
            <span className={styles.ccmInfoLabel}>Program Due on:</span> 08/22/2024
          </span>
          <span className={styles.ccmInfoDivider} />
          <span className={styles.ccmInfoItem}>
            <span className={styles.ccmInfoLabel}>Next Cadence:</span> 09/13/2024
            <DownChevronIcon size={14} color="var(--neutral-300)" />
          </span>
        </div>
      )}

      {/* Expanded program details */}
      {detailsExpanded && (
        <div className={styles.expandPanel}>
          <div className={styles.expandCol}>
            <div className={styles.expandColTitle}>Assessment &amp; Documentation</div>
            <div className={styles.expandRows}>
              <DetailRow icon="solar:document-add-linear" label="Assessment Done:" value="06/19/2025" />
              <DetailRow icon="solar:document-add-linear" label="Last HRA:" value="09/11/2024" />
              <DetailRow icon="solar:hand-heart-linear" label="Care Plan Due:" value="06/19/2025" />
              <DetailRow icon="solar:clock-circle-linear" label="Last Updated:" value="09/11/2024" />
            </div>
          </div>
          <div className={styles.expandCol}>
            <div className={styles.expandColTitle}>Care Coordination</div>
            <div className={styles.expandRows}>
              <DetailRow icon="solar:calendar-minimalistic-linear" label="ICT meeting:" value="06/19/2025" />
              <DetailRow icon="solar:double-alt-arrow-right-linear" label="Next Cadence:" value="09/11/2024" />
            </div>
          </div>
          <div className={styles.expandCol}>
            <div className={styles.expandColTitle}>Compliance &amp; Consent</div>
            <div className={styles.expandRows}>
              <div className={styles.detailRow}>
                <span className={styles.detailLabelGroup}>
                  <Icon name="solar:like-linear" size={16} color="var(--neutral-400)" />
                  <span className={styles.detailLabel}>{program.code} Consent:</span>
                </span>
                <Icon name="solar:check-circle-linear" size={16} color="var(--status-success)" />
              </div>
            </div>
          </div>
          <div className={styles.expandCol}>
            <div className={styles.expandColTitle}>Plan &amp; Conditions</div>
            <div className={styles.expandRows}>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Health Plan:</span>
                <Icon name="solar:check-circle-linear" size={16} color="var(--status-success)" />
              </div>
              <div className={styles.condRow}>
                <span className={styles.detailLabel}>Diabetes Mellitus (DM)</span>
                <span className={styles.condBadge}>14 M</span>
              </div>
              <div className={styles.condRow}>
                <span className={styles.detailLabel}>Hypertension (HTN)</span>
                <span className={styles.condBadge}>13 M</span>
              </div>
              <div className={styles.condRow}>
                <span className={styles.detailLabel}>Cystic Fibrosis (CF)</span>
                <span className={styles.condBadge}>4 M</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Body */}
      <div className={styles.body}>
        {/* Step list sidebar */}
        <div className={styles.stepList}>
          {stepList.map(step => {
            if (step.type === 'section') {
              const expanded = expandedSections[step.id] ?? step.expanded;
              return (
                <div key={step.id}>
                  <SectionHeader name={step.name} expanded={expanded} onToggle={() => toggleSection(step.id)} />
                  {expanded && step.children.map(child => (
                    <StepItem
                      key={child.id}
                      step={child}
                      isActive={activeStep === child.id}
                      onClick={() => setActiveStep(child.id)}
                      isChild
                    />
                  ))}
                </div>
              );
            }
            return (
              <StepItem
                key={step.id}
                step={step}
                isActive={activeStep === step.id}
                onClick={() => setActiveStep(step.id)}
              />
            );
          })}
        </div>

        {/* Right content */}
        <div className={styles.content}>
          {!isBillingStep && (
          <div className={styles.contentHeader}>
            <div className={styles.contentHeaderRow}>
            {assessmentCfg ? (
              <div className={styles.assessmentHeader}>
                <div className={styles.assessmentHeaderText}>
                  <span className={styles.assessmentTitle}>{assessmentCfg.title}</span>
                  <span className={styles.assessmentMeta}>
                    Filled by {assessmentCfg.filledBy} on {assessmentCfg.filledDate} • Reviewed by {assessmentCfg.reviewedBy} on {assessmentCfg.reviewedDate}
                  </span>
                </div>
              </div>
            ) : isMedReconStep ? (
              <div className={styles.assessmentHeader}>
                <div className={styles.assessmentHeaderText}>
                  <span className={styles.assessmentTitle}>Medication Reconciliation</span>
                  <span className={styles.assessmentMeta}>Last Reviewed by Robert Fox on 11/10/24</span>
                </div>
              </div>
            ) : isReferralStep ? (
              <div className={styles.assessmentHeader}>
                <div className={styles.assessmentHeaderText}>
                  <span className={styles.assessmentTitle}>Referral Review</span>
                  <span className={styles.assessmentMeta}>Reviewed by Jonathan Bush (NP) on 05/01/25</span>
                </div>
              </div>
            ) : isCarePlanStep ? (
              <div className={styles.assessmentHeader}>
                <div className={styles.assessmentHeaderText}>
                  <span className={styles.assessmentTitle}>Care Plan</span>
                  <span className={styles.assessmentMeta}>Created by Ivy Ralph on 09/11/24</span>
                </div>
              </div>
            ) : (
              <span className={styles.contentTitle}>
                {isBillingStep ? 'Billing Review'
                  : isOutreachStep ? 'Outreach'
                  : isPreVisitStep ? 'Pre-visit'
                  : isAppointmentStep ? 'Follow Up Appointments'
                  : isOpenCareGapsStep ? 'Open Care Gaps'
                  : isProgramTasksStep ? 'Program Related Tasks'
                  : isProgramFilesStep ? 'Document Library'
                  : isLettersStep ? 'Program Related Letters'
                  : stepName}
              </span>
            )}
            <div className={styles.contentActions}>
              {isCarePlanStep ? (
                <>
                  <ActionButton icon="solar:magnifer-linear" size="S" tooltip="Search" />
                  <ActionButton icon="solar:download-minimalistic-linear" size="S" tooltip="Download" />
                  <Button variant="ghost" size="S" leadingIcon="solar:add-circle-linear" className={styles.actionBtn}>
                    Add Care Plan
                  </Button>
                  <Button
                    variant="ghost"
                    size="S"
                    leadingIconElement={<Icon name="solar:pen-2-linear" size={14} color="var(--primary-300)" />}
                    className={styles.reviewedBtn}
                  >
                    Sign &amp; Share
                  </Button>
                  <ActionButton icon="solar:menu-dots-linear" size="S" tooltip="More" />
                </>
              ) : isMedReconStep ? (
                <>
                  {assigneePicker}
                  {!isMandatoryStep && <Button variant="ghost" size="S" className={styles.actionBtn}>Skip</Button>}
                  <Button variant="ghost" size="S" trailingIconElement={<DownChevronIcon size={14} color="var(--primary-300)" />} className={styles.reviewedBtn}>
                    Sign
                  </Button>
                  <ActionButton icon="solar:menu-dots-linear" size="S" tooltip="More" />
                </>
              ) : isProgramTasksStep ? (
                <>
                  {taskSearchOpen ? (
                    <SearchBar
                      className={styles.taskSearch}
                      placeholder="Search tasks"
                      value={taskSearchText}
                      onChange={e => setTaskSearchText(e.target.value)}
                      onClose={() => { setTaskSearchOpen(false); setTaskSearchText(''); }}
                    />
                  ) : (
                    <ActionButton icon="solar:magnifer-linear" size="S" tooltip="Search" onClick={() => setTaskSearchOpen(true)} />
                  )}
                  <span className={styles.headerDivider} />
                  <Button variant="tertiary" size="L" leadingIcon="solar:add-circle-linear" onClick={() => setAddTaskOpen(true)}>
                    Add Task
                  </Button>
                  <span className={styles.headerDivider} />
                  <ActionButton
                    icon="solar:filter-linear"
                    size="S"
                    tooltip="Filter"
                    active={taskFiltersOpen}
                    iconColor={taskFiltersOpen ? 'var(--primary-300)' : undefined}
                    onClick={() => setTaskFiltersOpen(v => !v)}
                  />
                </>
              ) : isOutreachStep ? (
                <>
                  {assigneePicker}
                  <span className={styles.headerDivider} />
                  <Button
                    variant="tertiary"
                    size="L"
                    onClick={goNextStep}
                    disabled={!nextStep}
                  >
                    Next
                  </Button>
                </>
              ) : (
                <>
                  {/* variant=ghost gives Button its bare shell (cursor, focus, structure)
                      so the caller's .actionBtn / .reviewedBtn class fully defines the
                      color state (neutral border for Assign/Skip, green border for
                      Reviewed) without Button's variant tokens overriding. */}
                  {assigneePicker}
                  {!isMandatoryStep && <Button variant="ghost" size="S" className={styles.actionBtn}>Skip</Button>}
                  <Button
                    variant="tertiary"
                    size="L"
                    leadingIcon="solar:check-circle-linear"
                  >
                    Reviewed
                  </Button>
                  <ActionButton icon="solar:menu-dots-linear" size="S" tooltip="More" />
                </>
              )}
            </div>
            </div>
            {isProgramTasksStep && taskFiltersOpen && (
              <div className={styles.headerFilterBar}>
                {taskFilterMeta.map(f => (
                  <FilterChip
                    key={f.key}
                    label={f.label}
                    options={f.options}
                    selected={taskFilters[f.key]}
                    onChange={vals => setTaskFilter(f.key, vals)}
                  />
                ))}
                {taskFiltersActive && (
                  <button className={styles.headerClearAll} onClick={() => setTaskFilters(EMPTY_TASK_FILTERS)}>
                    <Icon name="solar:backspace-linear" size={16} color="var(--primary-300)" />
                    Clear All
                  </button>
                )}
              </div>
            )}
          </div>
          )}

          {isBillingStep ? (
            <CcmBillingReview program={program} />
          ) : isOutreachStep ? (
            <div className={styles.outreachWrap}>
              <OutreachTab
                defaultPrograms={[program.code].filter(Boolean)}
                scopedProgram={program.code}
                defaultLogFor="care-program"
                defaultFormOpen
              />
            </div>
          ) : isPreVisitStep ? (
            <PreVisitStep programCode={program.code} />
          ) : isCarePlanStep ? (
            <CarePlanView />
          ) : isAppointmentStep ? (
            <AppointmentStep patientId={currentPatient?.id} programCode={program.code} />
          ) : isOpenCareGapsStep ? (
            <OpenCareGaps />
          ) : isMedReconStep ? (
            <MedicationReconciliation />
          ) : isProgramTasksStep ? (
            <ProgramRelatedTasks programCode={program.code} onAddTask={() => setAddTaskOpen(true)} filters={taskFilters} search={taskSearchText} />
          ) : isProgramFilesStep ? (
            <ProgramRelatedFiles />
          ) : isReferralStep ? (
            <ReferralReview />
          ) : assessmentCfg ? (
            assessmentCfg.checklist
              ? <PostVisitChecklist />
              : <AssessmentFormView formName={assessmentCfg.formName} />
          ) : isLettersStep ? (
          <div className={styles.contentInner}>
            <div className={styles.contentSubTabs}>
              {letterSearchOpen ? (
                <div className={styles.letterSearchWrap}>
                  <SearchBar
                    fullWidth
                    placeholder="Search letters"
                    value={letterSearchText}
                    onChange={e => setLetterSearchText(e.target.value)}
                    onClose={() => { setLetterSearchOpen(false); setLetterSearchText(''); }}
                  />
                </div>
              ) : (
                <>
                  <ActionButton icon="solar:magnifer-linear" size="S" tooltip="Search" onClick={() => setLetterSearchOpen(true)} />
                  <span className={styles.tabDivider} />
                  {LETTER_SUB_TABS.map(tab => (
                    <button
                      key={tab}
                      className={`${styles.contentTab} ${activeLetterTab === tab ? styles.contentTabActive : ''}`}
                      onClick={() => setActiveLetterTab(tab)}
                    >
                      {tab}
                    </button>
                  ))}
                  <div style={{ flex: 1 }} />
                </>
              )}
              <ActionButton icon="solar:add-circle-linear" size="S" tooltip="Add" onClick={() => setAddLetterOpen(true)} />
              <ActionButton
                icon="solar:filter-linear"
                size="S"
                tooltip="Filter"
                active={letterFiltersOpen}
                iconColor={letterFiltersOpen ? 'var(--primary-300)' : undefined}
                onClick={() => setLetterFiltersOpen(v => !v)}
              />
              <ActionButton icon="solar:history-linear" size="S" tooltip="History" onClick={() => setHistoryOpen(true)} />
            </div>

            {letterFiltersOpen && (
              <div className={styles.letterFilterBar}>
                {letterFilterMeta.map(f => (
                  <FilterChip
                    key={f.key}
                    label={f.label}
                    options={f.options}
                    selected={letterFilters[f.key]}
                    onChange={vals => setLetterFilter(f.key, vals)}
                  />
                ))}
                {letterFiltersActive && (
                  <button className={styles.letterClearAll} onClick={clearLetterFilters}>
                    <Icon name="solar:backspace-linear" size={16} color="var(--primary-300)" />
                    Clear All
                  </button>
                )}
              </div>
            )}

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.checkCell}>
                      <Checkbox
                        checked={someLettersSelected ? 'indeterminate' : allLettersSelected}
                        onCheckedChange={toggleAllLetters}
                        aria-label="Select all letters"
                      />
                    </th>
                    <th>File Name</th>
                    <th>File Type</th>
                    <th>Sent Via</th>
                    <th>Last Sent</th>
                    <th>Sent By</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {shownLetters.length === 0 && (
                    <tr>
                      <td colSpan={7} className={styles.lettersEmptyCell}>
                        <RingEmptyState icon="solar:letter-linear" label="No Letters" />
                      </td>
                    </tr>
                  )}
                  {shownLetters.map(letter => (
                    <tr
                      key={letter.id}
                      className={selectedLetters.has(letter.id) ? styles.rowSelected : undefined}
                    >
                      <td className={styles.checkCell}>
                        <Checkbox
                          checked={selectedLetters.has(letter.id)}
                          onCheckedChange={() => toggleLetter(letter.id)}
                          aria-label={`Select ${letter.fileName}`}
                        />
                      </td>
                      <td className={styles.fileNameCell}>{letter.fileName}</td>
                      <td className={styles.colMuted}>{letter.fileType}</td>
                      <td>
                        <span className={styles.viaChips}>
                          {letter.sentVia.map(v => (
                            <span key={v} className={styles.viaChip}>{v}</span>
                          ))}
                        </span>
                      </td>
                      <td>{letter.lastSent}</td>
                      <td>{letter.sentBy}</td>
                      <td className={styles.rowActionsCell}>
                        {selectedLetters.size === 0 && (
                          <div className={styles.rowActions}>
                            <ActionButton
                              icon="solar:plain-linear"
                              size="S"
                              tooltip="Send letter"
                              onClick={() => setSendTarget({ letterName: letter.fileName, clearOnSent: false })}
                            />
                            <ActionButton
                              icon="solar:menu-dots-linear"
                              size="S"
                              tooltip="More actions"
                              onClick={(e) => setRowMenu({ id: letter.id, rect: e.currentTarget.getBoundingClientRect() })}
                            />
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          ) : (
            <StepPlaceholder name={stepName} />
          )}

          {/* Floating bulk-action bar — appears when letters are selected. Figma 439:614595.
              Lives inside the content column so it centers on the letters pane
              rather than the whole window, and is gated on that pane being the
              visible one so a selection can't float it over Billing Review /
              Outreach / Pre-visit. */}
          {isLettersPane && selectedLetters.size > 0 && (
            <div className={styles.bulkBar} role="toolbar" aria-label="Letter bulk actions">
              <div className={styles.bulkSelect}>
                <Checkbox
                  checked={someLettersSelected ? 'indeterminate' : allLettersSelected}
                  onCheckedChange={toggleAllLetters}
                  aria-label="Select all letters"
                />
                <span className={styles.bulkCount}>{selectedLetters.size} Selected</span>
              </div>
              <span className={styles.bulkDivider} />
              <Button variant="secondary" size="L" leadingIcon="solar:download-minimalistic-linear" onClick={downloadSelectedLetters}>
                Download Files
              </Button>
              <Button
                variant="primary"
                size="L"
                leadingIcon="solar:plain-linear"
                onClick={() => setSendTarget({
                  letterName: selectedLetters.size === 1
                    ? letters.find(l => selectedLetters.has(l.id))?.fileName || 'Letter'
                    : 'Letters',
                  clearOnSent: true,
                })}
              >
                Send Files
              </Button>
              <span className={styles.bulkDivider} />
              <ActionButton
                icon="solar:close-square-linear"
                size="S"
                tooltip="Clear selection"
                onClick={() => setSelectedLetters(new Set())}
              />
            </div>
          )}
        </div>
      </div>
      {sendTarget && (
        <SendLetterDrawer
          letterName={sendTarget.letterName}
          memberName={currentPatient?.name}
          memberId={currentPatient?.memberId}
          onClose={() => setSendTarget(null)}
          onSent={() => { if (sendTarget.clearOnSent) setSelectedLetters(new Set()); }}
        />
      )}

      {rowMenu && (
        <MenuPopover
          anchorRect={rowMenu.rect}
          ariaLabel="Letter actions"
          width={168}
          items={[
            { key: 'preview', icon: 'solar:eye-linear', label: 'Preview' },
            { key: 'download', icon: 'solar:download-minimalistic-linear', label: 'Download' },
          ]}
          onSelect={(key) => {
            const letter = letters.find(l => l.id === rowMenu.id);
            if (!letter) return;
            if (key === 'download') downloadLetters([letter]);
            else if (key === 'preview') previewLetter(letter);
          }}
          onClose={() => setRowMenu(null)}
        />
      )}

      {addLetterOpen && (
        <AddLetterDrawer
          letters={letters}
          addedIds={addedLetterIds}
          onAdd={(letter) => {
            setAddedLetterIds(prev => new Set(prev).add(letter.id));
            toast.success(`${letter.fileName} added`);
          }}
          onPreview={previewLetter}
          onDownload={(letter) => downloadLetters([letter])}
          onClose={() => setAddLetterOpen(false)}
        />
      )}

      {historyOpen && (
        <LetterHistoryDrawer
          letters={letters}
          onOpen={previewLetter}
          onClose={() => setHistoryOpen(false)}
        />
      )}

      {previewTarget && (
        <LetterPreviewDrawer letter={previewTarget} onClose={() => setPreviewTarget(null)} />
      )}

      {addTaskOpen && (
        <AddTaskDrawer
          onClose={() => setAddTaskOpen(false)}
          initialMember={currentPatient?.name}
          onTaskCreated={(t) => {
            setAddTaskOpen(false);
            if (program.code && t) addProgramTask(program.code, t);
          }}
        />
      )}

      {statusMenu && (
        <MenuPopover
          anchorRect={statusMenu.rect}
          align="left"
          width={180}
          ariaLabel="Change status"
          items={PROGRAM_STATUS_OPTIONS.map(s => ({
            key: s,
            label: <span style={{ color: 'var(--neutral-400)' }}>{s}</span>,
          }))}
          onSelect={(newStatus) => changeStatus(newStatus)}
          onClose={() => setStatusMenu(null)}
        />
      )}
    </div>
  );
}
