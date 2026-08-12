import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../../../../../../store/useAppStore';
import { toast } from '../../../../../../../components/Toast/sonnerToast';
import { PROGRAM_LETTERS_MOCK } from '../../../../../data/programActivityMock';
import { statusColorFor } from '../../../../../data/programStatus';
import {
  ASSESSMENT_STEPS,
  DEFAULT_LETTER_NAMES,
  EMPTY_LETTER_FILTERS,
  EMPTY_TASK_FILTERS,
  TASK_STATUS_LABEL,
  capFirst,
  downloadLetters,
  flatSteps,
  fmtCompletedDate,
  initialsOf,
  progressForCode,
  stepsFor,
} from './ProgramDetailView.utils';

export function useProgramDetailView({ program, onSwitchProgram }) {
  const isCcm = program.code === 'CCM';
  const isSnp = program.code === 'SNP';
  const stepList = stepsFor(program.code);
  const ALL_STEPS = flatSteps(stepList);
  const firstStep = stepList[0];
  const programProgress = ALL_STEPS.length
    ? Math.round((ALL_STEPS.filter(s => s.status === 'completed').length / ALL_STEPS.length) * 100)
    : 0;

  // The active step lives in the store (mirrored into the URL by the hash
  // router) so a refresh restores it. null or an id that doesn't belong to
  // this program falls back to the program's default step.
  const storedStep = useAppStore(s => s.careProgramStep);
  const setActiveStep = useAppStore(s => s.setCareProgramStep);
  const defaultStep = isCcm ? 'ccm-billing' : firstStep?.id;
  const activeStep = (storedStep && ALL_STEPS.some(s => s.id === storedStep)) ? storedStep : defaultStep;
  const [expandedSections, setExpandedSections] = useState({});
  const [activeLetterTab, setActiveLetterTab] = useState('All');
  const [letterSearchOpen, setLetterSearchOpen] = useState(false);
  const [letterSearchText, setLetterSearchText] = useState('');
  const [letterFiltersOpen, setLetterFiltersOpen] = useState(false);
  const [letterFilters, setLetterFilters] = useState(EMPTY_LETTER_FILTERS);
  const [selectedLetters, setSelectedLetters] = useState(() => new Set());
  const [sendTarget, setSendTarget] = useState(null);
  const [rowMenu, setRowMenu] = useState(null);
  const [previewTarget, setPreviewTarget] = useState(null);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [taskFiltersOpen, setTaskFiltersOpen] = useState(false);
  const [taskSearchOpen, setTaskSearchOpen] = useState(false);
  const [taskSearchText, setTaskSearchText] = useState('');
  const [taskFilters, setTaskFilters] = useState(EMPTY_TASK_FILTERS);
  const [addLetterOpen, setAddLetterOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [addedLetterIds, setAddedLetterIds] = useState(() => new Set());
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [statusMenu, setStatusMenu] = useState(null);

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
  const currentPatient = useAppStore(s => s.patients.find(p => p.id === s.selectedPatientId));
  const patientId = useAppStore(s => s.selectedPatientId);
  const updateCareProgram = useAppStore(s => s.updateCareProgram);
  const storeLetters = useAppStore(s => s.letters);
  const fetchLetters = useAppStore(s => s.fetchLetters);

  useEffect(() => { fetchLetters(); }, [fetchLetters]);

  const letters = storeLetters.length ? storeLetters : PROGRAM_LETTERS_MOCK;
  const visibleLetters = useMemo(
    () => letters.filter(l => DEFAULT_LETTER_NAMES.includes(l.fileName) || addedLetterIds.has(l.id)),
    [letters, addedLetterIds],
  );

  const letterFilterMeta = useMemo(() => ([
    { key: 'fileType', label: 'File Type', options: [...new Set(visibleLetters.flatMap(l => l.fileType ? [l.fileType] : []))] },
    { key: 'sentVia', label: 'Sent Via', options: [...new Set(visibleLetters.flatMap(l => l.sentVia || []))] },
    { key: 'lastSent', label: 'Last Sent', options: [...new Set(visibleLetters.flatMap(l => l.lastSent ? [l.lastSent] : []))] },
    { key: 'sentBy', label: 'Sent By', options: [...new Set(visibleLetters.flatMap(l => l.sentBy ? [l.sentBy] : []))] },
  ]), [visibleLetters]);

  const setLetterFilter = (key, vals) => setLetterFilters(f => ({ ...f, [key]: vals }));
  const clearLetterFilters = () => setLetterFilters(EMPTY_LETTER_FILTERS);
  const letterFiltersActive = Object.values(letterFilters).some(v => v.length > 0);

  const matchesLetterFilters = (l) => {
    const sentVia = l.sentVia || [];
    const sentViaSet = letterFilters.sentVia.length ? new Set(letterFilters.sentVia) : null;
    return (!letterFilters.fileType.length || letterFilters.fileType.includes(l.fileType))
      && (!sentViaSet || sentVia.some(v => sentViaSet.has(v)))
      && (!letterFilters.lastSent.length || letterFilters.lastSent.includes(l.lastSent))
      && (!letterFilters.sentBy.length || letterFilters.sentBy.includes(l.sentBy));
  };

  const matchesLetterTab = (l) => {
    const sent = (l.sentVia || []).length > 0;
    return activeLetterTab === 'Sent' ? sent : activeLetterTab === 'Not Sent' ? !sent : true;
  };

  const letterSearch = letterSearchText.trim().toLowerCase();
  const shownLetters = visibleLetters.filter(l =>
    matchesLetterTab(l)
    && (!letterSearch || l.fileName.toLowerCase().includes(letterSearch))
    && matchesLetterFilters(l)
  );

  const patientPrograms = useAppStore(s => s.careProgramsByPatient[s.selectedPatientId]);
  const liveProgram = patientPrograms?.find(p => p.id === program.id);
  const status = liveProgram?.status || program.status || 'New';
  const assignee = liveProgram?.assignee || program.assignee;
  const isUnassigned = !assignee || assignee === 'Unassigned';

  const orderedTriggers = useMemo(
    () => (patientPrograms || []).filter(p => p.code === 'SNP').sort((a, b) => (a.trigger || 0) - (b.trigger || 0)),
    [patientPrograms],
  );
  const otherPrograms = useMemo(
    () => (patientPrograms || []).filter(p => p.id !== program.id && p.status !== 'Closed'),
    [patientPrograms, program.id],
  );

  const triggerIdx = orderedTriggers.findIndex(p => p.id === program.id);
  const prevTrigger = triggerIdx > 0 ? orderedTriggers[triggerIdx - 1] : null;
  const nextTrigger = triggerIdx >= 0 && triggerIdx < orderedTriggers.length - 1 ? orderedTriggers[triggerIdx + 1] : null;
  const triggerNum = (triggerIdx >= 0 ? orderedTriggers[triggerIdx].trigger : program.trigger) || 1;

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

  const previewLetter = (letter) => setPreviewTarget(letter);
  const downloadSelectedLetters = () => downloadLetters(letters.filter(l => selectedLetters.has(l.id)), toast);

  const activeStepObj = ALL_STEPS.find(s => s.id === activeStep);
  const stepName = activeStepObj?.name || '';
  const isMandatoryStep = !!activeStepObj?.mandatory;
  const assessmentCfg = ASSESSMENT_STEPS[stepName];

  const activeStepIdx = ALL_STEPS.findIndex(s => s.id === activeStep);
  const nextStep = activeStepIdx >= 0 && activeStepIdx < ALL_STEPS.length - 1 ? ALL_STEPS[activeStepIdx + 1] : null;
  const goNextStep = () => { if (nextStep) setActiveStep(nextStep.id); };
  const toggleSection = (id) => setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));

  const stepFlags = {
    isBillingStep: activeStepObj?.kind === 'billing',
    isOutreachStep: stepName === 'Outreach',
    isPreVisitStep: /^pre-?visit$/i.test(stepName),
    isCarePlanStep: stepName === 'Care Plan',
    isAppointmentStep: /appointment/i.test(stepName),
    isOpenCareGapsStep: stepName === 'Open Care Gaps' || stepName === 'Care Gaps',
    isMedReconStep: stepName === 'Medication Reconciliation' || stepName === 'Medication Review',
    isProgramTasksStep: stepName === 'Program Related Task',
    isProgramFilesStep: stepName === 'Program Related Files' || stepName === 'Program Documents' || stepName === 'Documents',
    isReferralStep: stepName === 'Referral Review',
    isLettersStep: stepName === 'Letters',
  };

  return {
    isCcm, isSnp, stepList, ALL_STEPS, programProgress, activeStep, setActiveStep,
    expandedSections, activeLetterTab, setActiveLetterTab,
    letterSearchOpen, setLetterSearchOpen, letterSearchText, setLetterSearchText,
    letterFiltersOpen, setLetterFiltersOpen, letterFilters, letterFilterMeta,
    setLetterFilter, clearLetterFilters, letterFiltersActive,
    selectedLetters, setSelectedLetters, sendTarget, setSendTarget,
    rowMenu, setRowMenu, previewTarget, setPreviewTarget,
    addTaskOpen, setAddTaskOpen, taskFiltersOpen, setTaskFiltersOpen,
    taskSearchOpen, setTaskSearchOpen, taskSearchText, setTaskSearchText,
    taskFilters, setTaskFilter, taskFiltersActive, taskFilterMeta,
    addLetterOpen, setAddLetterOpen, historyOpen, setHistoryOpen,
    addedLetterIds, setAddedLetterIds, detailsExpanded, setDetailsExpanded,
    statusMenu, setStatusMenu, programTasks, addProgramTask, currentPatient,
    patientId, updateCareProgram, letters, shownLetters, status, assignee,
    isUnassigned, otherPrograms, prevTrigger, nextTrigger, triggerNum,
    changeStatus, allLettersSelected, someLettersSelected, toggleAllLetters,
    toggleLetter, previewLetter, downloadSelectedLetters, stepName,
    isMandatoryStep, assessmentCfg, goNextStep, toggleSection, stepFlags,
    initialsOf, progressForCode, onSwitchProgram,
  };
}
