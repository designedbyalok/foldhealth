import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { BottomSheet, BottomSheetItem } from '../../../components/BottomSheet/BottomSheet';
import { Button } from '../../../components/Button/Button';
import { Checkbox } from '../../../components/Checkbox/Checkbox';
import { Input } from '../../../components/Input/Input';
import { RadioOptionGroup } from '../../../components/RadioOptionGroup/RadioOptionGroup';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
import { CARE_PROGRAM_CATALOG } from '../../patient/data/careProgramCatalog';
import { CMP_SUB_PROGRAMS } from '../../patient/data/cmpSubPrograms';
import { SNP_TRIGGER_TYPES } from '../../patient/data/snpTriggerTypes';
import { nextEnrollment } from '../../patient/data/programLifecycle';
import { enrollmentCheck } from '../../patient/data/consentRules';
import { usePatientConsent } from '../../patient/hooks/usePatientConsent';
import { isoDay } from '../../patient/right-panel/tabs/care-programs/care-plan/lib/carePlanPause';
import {
  dayAfter, episodeEndsOn, episodeLengthLabel, episodeOf, episodeSupersedes,
} from '../../patient/right-panel/tabs/care-programs/care-plan/lib/episodeTemplates';
import { formatInstanceDate } from '../../patient/right-panel/tabs/care-programs/care-plan/lib/templateRenewal';
import styles from './care.module.css';

const EMPTY = [];
const MEMBER_SLICES = ['patients', 'snpWorklistMembers', 'hccMembers', 'awvMembers', 'cmpMembers', 'ccmWorklistMembers', 'hedisMembers', 'allPatients'];

// The member's plan ids as "Member ID - IPA" (desktop CreateSnpProgramDrawer).
function useMemberInfoOptions(patientId) {
  const slices = useAppStore(useShallow(s => MEMBER_SLICES.map(k => s[k])));
  return useMemo(() => {
    const seen = new Map();
    for (const rows of slices) {
      for (const m of rows || []) {
        if (!m || (m.id !== patientId && String(m.memberId) !== String(patientId) && m.patientId !== patientId)) continue;
        const id = String(m.memberId || m.id || '').replace(/^#/, '');
        if (!id) continue;
        const label = m.ipa ? `${id} - ${m.ipa}` : id;
        if (!seen.has(label)) seen.set(label, { value: label, label });
      }
    }
    return [...seen.values()];
  }, [patientId, slices]);
}

/**
 * New Program on the phone (desktop CareProgramsTab "New Program"): pick a
 * program type, CMP asks for its sub-program and SNP for its trigger, then
 * the same eligibility and consent checks as desktop (useConsentedEnrollment)
 * run before addCareProgram. Episodic templates that run as their own
 * program start through startEpisodeProgram (desktop StartEpisodeDialog).
 * `onEnrolled(program)` opens the new enrollment.
 */
export function EnrollSheet({ patientId, onEnrolled, onCaptureConsent, onClose }) {
  const programs = useAppStore(s => s.careProgramsByPatient[patientId]) || EMPTY;
  const programTypes = useAppStore(s => s.careProgramTypes);
  const fetchCareProgramTypes = useAppStore(s => s.fetchCareProgramTypes);
  const templates = useAppStore(s => s.carePlanTemplates) || EMPTY;
  const libraryDidFetch = useAppStore(s => s.carePlanLibraryDidFetch);
  const fetchCarePlanLibrary = useAppStore(s => s.fetchCarePlanLibrary);
  const addCareProgram = useAppStore(s => s.addCareProgram);
  const consentTableMissing = useAppStore(s => s.patientConsentTableMissing);
  const profile = useAppStore(s => s.p360ProfilesById[patientId]);
  const { consents } = usePatientConsent(patientId);
  // null: the list | { code: 'CMP' } | { code: 'SNP' } | { consent: code } | { episode: template }
  const [stage, setStage] = useState(null);

  useEffect(() => { fetchCareProgramTypes?.(); }, [fetchCareProgramTypes]);
  useEffect(() => { if (!libraryDidFetch) fetchCarePlanLibrary?.(); }, [libraryDidFetch, fetchCarePlanLibrary]);

  const catalog = useMemo(() => (programTypes?.length
    ? programTypes.filter(t => t.status === 'active').map(t => ({ code: t.code, name: t.name }))
    : CARE_PROGRAM_CATALOG), [programTypes]);
  const cmpTaken = useMemo(
    () => programs.flatMap(p => (p.code === 'CMP' && p.subProgram ? [p.subProgram] : [])),
    [programs],
  );
  // Same rule as desktop programOptions: a program with an open enrollment can't be added again.
  const disabledFor = (code) => {
    if (code === 'SNP') return false;
    if (code === 'CMP') return CMP_SUB_PROGRAMS.every(sp => cmpTaken.includes(sp));
    return !nextEnrollment(programs, code).allowed;
  };
  const episodes = useMemo(() => templates.filter(t => episodeOf(t)?.programCode), [templates]);

  const enroll = (code, details = null) => {
    const entry = catalog.find(e => e.code === code);
    if (!entry) return;
    const conditions = profile ? (profile.chronic_conditions || []) : null;
    const check = enrollmentCheck(code, { existing: programs, conditions, consents, subProgram: details?.subProgram || null, triggerable: code === 'SNP' });
    if (!check.eligible) {
      toast.error(`Can't enroll in ${code}: ${check.reasons.join('; ')}`);
      return;
    }
    if (check.needsConsent && !consentTableMissing) {
      setStage({ consent: code });
      return;
    }
    // addCareProgram returns nothing and leaves state alone when the store
    // refuses, so the new enrollment is whichever row wasn't there before.
    const before = new Set((useAppStore.getState().careProgramsByPatient[patientId] || []).map(p => p.id));
    addCareProgram(patientId, details ? { ...entry, ...details } : entry);
    const list = useAppStore.getState().careProgramsByPatient[patientId] || [];
    const created = list.find(p => !before.has(p.id) && p.code === code);
    if (!created) { toast.error(`Could not enroll the patient in ${code}`); return; }
    toast.success(`Enrolled in ${created.name}`);
    onEnrolled(created);
  };

  const pick = (code) => {
    if (code === 'CMP') setStage({ code: 'CMP' });
    else if (code === 'SNP') setStage({ code: 'SNP' });
    else enroll(code);
  };

  if (stage?.code === 'CMP') {
    return (
      <BottomSheet title="CMP Sub-Program" onClose={onClose}>
        {CMP_SUB_PROGRAMS.map(sp => (
          <BottomSheetItem
            key={sp}
            label={sp}
            detail={cmpTaken.includes(sp) ? 'Enrolled' : undefined}
            disabled={cmpTaken.includes(sp)}
            onClick={() => enroll('CMP', { subProgram: sp })}
          />
        ))}
      </BottomSheet>
    );
  }
  if (stage?.code === 'SNP') {
    return <SnpSheet patientId={patientId} onCreate={(details) => enroll('SNP', details)} onClose={onClose} />;
  }
  if (stage?.consent) {
    return (
      <BottomSheet title={`${stage.consent} Consent`} onClose={onClose}>
        <p className={styles.sheetText}>{stage.consent} needs the patient&rsquo;s consent before they can be enrolled.</p>
        <p className={styles.sheetMeta}>Capture it first, then enroll again from New Program.</p>
        <div className={styles.actions}>
          <Button size="lg" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button size="lg" variant="solid" onClick={() => onCaptureConsent(stage.consent)}>Capture Consent</Button>
        </div>
      </BottomSheet>
    );
  }
  if (stage?.episode) {
    return <EpisodeSheet patientId={patientId} template={stage.episode} onStarted={onEnrolled} onClose={onClose} />;
  }

  return (
    <BottomSheet title="New Program" onClose={onClose}>
      {catalog.map(e => (
        <BottomSheetItem
          key={e.code}
          label={`${e.code} · ${e.name}`}
          detail={disabledFor(e.code) ? 'Enrolled' : undefined}
          disabled={disabledFor(e.code)}
          onClick={() => pick(e.code)}
        />
      ))}
      {episodes.length > 0 && (
        <>
          <p className={styles.sheetLabel}>Start an Episode</p>
          {episodes.map(t => (
            <BottomSheetItem
              key={t.id}
              icon="solar:calendar-mark-linear"
              label={t.name}
              detail={`${episodeOf(t).programCode} · ${episodeLengthLabel(episodeOf(t).days)}`}
              onClick={() => setStage({ episode: t })}
            />
          ))}
        </>
      )}
    </BottomSheet>
  );
}

/** Create SNP Program: Member Info, Trigger Type and Trigger Date, all required. */
function SnpSheet({ patientId, onCreate, onClose }) {
  const memberOptions = useMemberInfoOptions(patientId);
  const [memberInfo, setMemberInfo] = useState('');
  const [triggerType, setTriggerType] = useState(null);
  const [triggerDate, setTriggerDate] = useState('');
  const member = memberInfo || memberOptions[0]?.value || '';
  const ready = !!member && !!triggerType && !!triggerDate;
  return (
    <BottomSheet title="Create SNP Program" onClose={onClose}>
      {memberOptions.length > 1 ? (
        <RadioOptionGroup label="Member Info" variant="card" options={memberOptions} value={member} onChange={setMemberInfo} />
      ) : (
        <p className={styles.sheetMeta}>Member Info: {member || 'No member ids found'}</p>
      )}
      <RadioOptionGroup
        label="Trigger Type"
        variant="card"
        options={SNP_TRIGGER_TYPES.map(t => ({ value: t, label: t }))}
        value={triggerType}
        onChange={setTriggerType}
      />
      <Input type="date" size="lg" label="Trigger Date" required value={triggerDate} onValueChange={setTriggerDate} />
      <div className={styles.actions}>
        <Button size="lg" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button size="lg" variant="solid" disabled={!ready} onClick={() => onCreate({ memberInfo: member, triggerType, triggerDate })}>Create</Button>
      </div>
    </BottomSheet>
  );
}

/**
 * Start an episode that runs as its own program (desktop StartEpisodeDialog
 * then startEpisodeProgram): its last day, prefilled from the template, and
 * the patient's other care plans that pause while it runs.
 */
function EpisodeSheet({ patientId, template, onStarted, onClose }) {
  const fetchEpisodePausablePlans = useAppStore(s => s.fetchEpisodePausablePlans);
  const startEpisodeProgram = useAppStore(s => s.startEpisodeProgram);
  const episode = episodeOf(template);
  const todayIso = isoDay(new Date());
  const [endsOn, setEndsOn] = useState(() => episodeEndsOn(new Date(), episode?.days) || '');
  const [plans, setPlans] = useState(null);
  const [picked, setPicked] = useState(() => new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    fetchEpisodePausablePlans(patientId, null).then(list => {
      if (!live) return;
      setPlans(list);
      setPicked(new Set(list.filter(p => !p.paused && episodeSupersedes(episode, p.programCode)).map(p => p.planId)));
    });
    return () => { live = false; };
    // episode derives from template, which keys this sheet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchEpisodePausablePlans, patientId]);

  const toggle = (planId) => setPicked(prev => {
    const next = new Set(prev);
    if (next.has(planId)) next.delete(planId); else next.add(planId);
    return next;
  });
  const resumeOn = dayAfter(endsOn);

  const start = async () => {
    setBusy(true);
    const pausePlans = (plans || []).filter(p => picked.has(p.planId));
    const opened = await startEpisodeProgram(patientId, template, { endsOn: endsOn || null, pausePlans }).catch(() => null);
    setBusy(false);
    // startEpisodeProgram shows its own error toast.
    if (!opened) return;
    toast.success(`"${template.name}" episode started${pausePlans.length ? `. ${pausePlans.length} other care plan${pausePlans.length === 1 ? '' : 's'} paused` : ''}`);
    onStarted(opened);
  };

  return (
    <BottomSheet title={`Start ${episode?.days ? `a ${episodeLengthLabel(episode.days)}` : 'an Episode'}`} onClose={onClose}>
      <p className={styles.sheetMeta}>
        &ldquo;{template.name}&rdquo; enrolls the patient in {episode.programCode} with a care plan of its own, starts today as day 1 and closes on its own after its last day.
      </p>
      <Input type="date" size="lg" label="Last day" value={endsOn} min={todayIso} onValueChange={setEndsOn} />
      <p className={styles.sheetMeta}>{endsOn ? 'Clear it to run until someone ends it.' : 'No last day: it runs until someone ends it from the care plan.'}</p>
      <p className={styles.sheetLabel}>Pause the patient&rsquo;s other care plans</p>
      {plans == null ? <p className={styles.sheetMeta}>Looking for the patient&rsquo;s other care plans…</p>
        : plans.length === 0 ? <p className={styles.sheetMeta}>The patient has no other care plans to pause.</p> : (
          <div className={styles.checklist}>
            {plans.map(p => (
              <label key={p.planId} className={styles.checkRow}>
                <Checkbox checked={picked.has(p.planId)} disabled={p.paused} onCheckedChange={() => toggle(p.planId)} aria-label={`Pause the ${p.programName} care plan`} />
                <span className={styles.checkLabel}>{p.programName} care plan{p.paused ? ' (already paused)' : ''}</span>
              </label>
            ))}
            <p className={styles.sheetMeta}>
              {resumeOn ? `They resume on ${formatInstanceDate(resumeOn)}, or sooner if it ends early.` : 'They resume when the episode ends.'}
            </p>
          </div>
        )}
      <div className={styles.actions}>
        <Button size="lg" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button size="lg" variant="solid" disabled={plans == null || busy} onClick={start}>Start Episode</Button>
      </div>
    </BottomSheet>
  );
}
