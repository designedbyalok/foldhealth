import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../../../components/Badge/Badge';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { BottomSheet, BottomSheetItem } from '../../../components/BottomSheet/BottomSheet';
import { Button } from '../../../components/Button/Button';
import { Icon } from '../../../components/Icon/Icon';
import { Textarea } from '../../../components/Textarea/Textarea';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
import { formatGoalTarget } from '../../settings/care-plan-library/lib';
import { KIND_LABELS } from '../../settings/care-plan-library/interventions/shared/interventionKinds';
import { isCompletedStatus } from '../../patient/right-panel/tabs/care-programs/care-plan/tables/carePlanTableModel';
import { computeDueDate } from '../../patient/right-panel/tabs/care-programs/care-plan/tables/CarePlanInterventionsTable';
import { isCarePlanPaused, pauseReasonLabel } from '../../patient/right-panel/tabs/care-programs/care-plan/lib/carePlanPause';
import { carePlanSignShareEnabled } from '../../patient/right-panel/tabs/care-programs/care-plan/lib/carePlanSignState';
import { useCarePlanDraftState } from '../../patient/right-panel/tabs/care-programs/care-plan/lib/useCarePlanDraftState';
import { useMobileNav } from '../MobileNavContext';
import { MobileEmpty, MobileListSkeleton } from '../MobileParts';
import { carePlanProgram, fmtDate, gbiDisplayStatus, gbiTone } from './careUtils';
import { GbiSheet } from './GbiSheet';
import { ShareCarePlanSheet } from './CarePlanSheets';
import { AssigneeSheet } from './ProgramSheets';
import common from '../mobile.module.css';
import styles from './care.module.css';

const EMPTY = [];
const cap = (s) => (s ? `${s[0].toUpperCase()}${s.slice(1)}` : '');

/**
 * A care plan on the phone (mobile port of CarePlanView): Goals,
 * Interventions, Barriers and Social Needs as cards. Tap one to change its
 * status (with the reason the org asks for), record a goal reading or
 * delete it; add goals, interventions and barriers; sign the plan, send it
 * for review or share the signed version (desktop CarePlanHeader), and add
 * notes. Templates, linkage and versions stay on a computer.
 */
export function CarePlanScreen({ patientId, programId }) {
  const { pop, push } = useMobileNav();
  const programs = useAppStore(s => (patientId ? s.careProgramsByPatient[patientId] : null)) || EMPTY;
  const fetchCareProgramsForPatient = useAppStore(s => s.fetchCareProgramsForPatient);
  const key = `${patientId}::${programId}`;
  const plan = useAppStore(s => s.patientCarePlans[key]);
  const loading = useAppStore(s => !!s.patientCarePlanLoading?.[key]);
  const loadedFor = useAppStore(s => !!s.patientCarePlanLoadedFor?.[key]);
  const fetchPatientCarePlan = useAppStore(s => s.fetchPatientCarePlan);
  const addCarePlanNote = useAppStore(s => s.addCarePlanNote);
  const program = useMemo(() => carePlanProgram(patientId, programId, programs), [patientId, programId, programs]);
  const [open, setOpen] = useState(null); // { kind, item, details }
  const [noteOpen, setNoteOpen] = useState(false);
  const [sheet, setSheet] = useState(null); // 'more' | 'review' | 'share'
  const [signing, setSigning] = useState(false);
  const signCarePlan = useAppStore(s => s.signCarePlan);
  const requestCarePlanReview = useAppStore(s => s.requestCarePlanReview);
  const platformUsers = useAppStore(s => s.platformUsers);
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  const signState = useSignState(patientId, programId, plan);
  useEffect(() => { fetchPlatformUsers?.(); }, [fetchPlatformUsers]);

  useEffect(() => { if (patientId) fetchCareProgramsForPatient?.(patientId); }, [patientId, fetchCareProgramsForPatient]);
  useEffect(() => { if (patientId && programId) fetchPatientCarePlan?.(patientId, programId); }, [patientId, programId, fetchPatientCarePlan]);

  const goals = plan?.goals || EMPTY;
  const interventions = plan?.interventions || EMPTY;
  const allBarriers = plan?.barriers || EMPTY;
  const barriers = allBarriers.filter(b => !b.sdohDomain);
  const needs = allBarriers.filter(b => b.sdohDomain);
  const paused = isCarePlanPaused(plan?.plan);
  const goalTitle = useMemo(() => Object.fromEntries(goals.map(g => [g.id, g.title])), [goals]);
  const title = program?.code === 'PATIENT' ? 'Care Plan' : `${program?.code || ''} Care Plan`.trim();

  const goalDetails = (g) => [
    formatGoalTarget(g) ? `Target: ${formatGoalTarget(g)}` : null,
    g.targetDate ? `Target date ${fmtDate(g.targetDate) || g.targetDate}` : null,
    g.currentValue ? `Latest: ${g.currentValue}${g.unit ? ` ${g.unit}` : ''}` : null,
    g.frequency ? `Measured ${g.frequency.toLowerCase()}` : null,
  ];
  const intvDetails = (i) => {
    const due = computeDueDate(i).formatted;
    return [
      KIND_LABELS[i.kind] || null,
      i.assignee?.name && i.assignee.name !== 'Unassigned' ? `Assigned to ${i.assignee.name}` : null,
      due ? `Due ${due}` : 'No due date',
      i.goalId && goalTitle[i.goalId] ? `For goal: ${goalTitle[i.goalId]}` : null,
    ];
  };
  const barrierDetails = (b) => [
    b.description || null,
    (b.goalIds || []).length ? `Linked goals: ${(b.goalIds || []).map(id => goalTitle[id]).filter(Boolean).join(', ')}` : null,
    b.sdohNeed ? `Need: ${b.sdohNeed}${b.zCode ? ` (${b.zCode})` : ''}` : null,
  ];

  // Desktop signCarePlanDirect / createCarePlanReviewTask.
  const sign = async () => {
    if (!program || signing) return;
    setSigning(true);
    const v = await signCarePlan(patientId, program, '').catch(() => null);
    setSigning(false);
    // signCarePlan explains a refusal (no goals yet, sign-off route) itself.
    if (v) toast.success('Care plan signed');
  };
  const sendForReview = async (user) => {
    setSheet(null);
    const created = await requestCarePlanReview(patientId, program, user).catch(() => null);
    if (created) toast.success(`Care plan sent to ${user.name} for review`);
    else toast.error('Could not send the care plan for review');
  };
  const addItem = (kind) => push('carePlanAdd', { patientId, programId, kind });

  const section = (heading, kind, items, detailsOf, dateOf, canAdd = true) => {
    const openItems = items.filter(x => !isCompletedStatus(x.status));
    const doneItems = items.filter(x => isCompletedStatus(x.status));
    return (
      <section className={styles.group}>
        <div className={styles.groupHead}>
          <h2 className={styles.groupTitle}>{heading} <span className={styles.groupCount}>{items.length}</span></h2>
          {canAdd && <ActionButton icon="solar:add-circle-linear" size="lg" aria-label={`Add ${heading}`} onClick={() => addItem(kind)} />}
        </div>
        {items.length === 0 ? <p className={styles.empty}>No {heading.toLowerCase()}</p> : (
          [...openItems, ...doneItems].map(x => {
            const shown = gbiDisplayStatus(x.status, dateOf?.(x), paused);
            const details = detailsOf(x);
            return (
              <button key={x.id} type="button" className={styles.item} onClick={() => setOpen({ kind, item: x, details })}>
                <div className={styles.itemHead}>
                  <p className={styles.itemTitle}>{x.title || x.description || 'Untitled'}</p>
                  <Badge size="sm" tone={gbiTone(shown)} variant="soft" label={shown} />
                </div>
                <p className={[styles.meta, shown === 'Overdue' ? styles.overdue : ''].join(' ')}>
                  {[...details.filter(Boolean).slice(0, 2), x.priority ? `${cap(x.priority)} priority` : null].filter(Boolean).join(' • ')}
                </p>
              </button>
            );
          })
        )}
      </section>
    );
  };

  return (
    <div className={common.screen}>
      <div className={common.body}>
        <section className={styles.hero}>
          <div className={styles.heroTop}>
            <button type="button" className={common.iconBtn} aria-label="Back" onClick={pop}>
              <Icon name="solar:arrow-left-linear" size={24} />
            </button>
          </div>
          <h1 className={styles.heroTitle}>{title || 'Care Plan'}</h1>
          {program && program.code !== 'PATIENT' && <p className={styles.meta}>{program.name}</p>}
          {plan?.plan && (
            <p className={styles.meta}>
              {signState.version}
              {' • '}
              <span className={styles[signState.tone]}>{signState.status}</span>
            </p>
          )}
          {program && plan && (
            <div className={styles.heroActions}>
              <Button size="lg" variant="solid" leadingIcon="solar:pen-2-linear" disabled={!signState.canSign || signing} onClick={sign}>Sign</Button>
              <Button size="lg" variant="outline" leadingIcon="solar:notes-linear" onClick={() => setNoteOpen(true)}>Add Note</Button>
              <ActionButton icon="solar:menu-dots-linear" size="lg" aria-label="More care plan actions" onClick={() => setSheet('more')} />
            </div>
          )}
        </section>

        <div className={styles.body}>
          {!program ? (
            <MobileEmpty icon="solar:clipboard-remove-linear" title="Care plan not found" />
          ) : (loading || !loadedFor) && !plan ? (
            <MobileListSkeleton count={4} height={88} />
          ) : (
            <>
              {paused && (
                <div className={styles.banner} role="status">
                  <Icon name="solar:pause-circle-linear" size={20} />
                  <span>
                    Paused{plan?.plan?.pause?.reason ? ` (${pauseReasonLabel(plan.plan.pause.reason)})` : ''}
                    {plan?.plan?.pause?.resumeOn ? `, resumes ${fmtDate(plan.plan.pause.resumeOn) || plan.plan.pause.resumeOn}` : ''}.
                    No overdue flags or automated outreach while paused.
                  </span>
                </div>
              )}
              {section('Goals', 'goal', goals, goalDetails, g => g.targetDate)}
              {section('Interventions', 'intv', interventions, intvDetails, i => computeDueDate(i).iso)}
              {section('Barriers', 'barrier', barriers, barrierDetails, null)}
              {needs.length > 0 && section('Social Needs', 'barrier', needs, barrierDetails, null, false)}
              <div className={styles.desktopNote}>
                <Icon name="solar:monitor-linear" size={20} />
                <span>Applying templates, linking items and versions are on a computer.</span>
              </div>
            </>
          )}
        </div>
      </div>

      {open && program && (
        <GbiSheet
          kind={open.kind}
          item={liveItem(plan, open)}
          details={open.details}
          patientId={patientId}
          program={program}
          onClose={() => setOpen(null)}
        />
      )}
      {sheet === 'more' && program && (
        <BottomSheet title="Care Plan" onClose={() => setSheet(null)}>
          <BottomSheetItem icon="solar:checklist-minimalistic-linear" label="Send for Review" disabled={!signState.canSign} onClick={() => setSheet('review')} />
          <BottomSheetItem icon="solar:share-linear" label="Share" onClick={() => setSheet('share')} />
        </BottomSheet>
      )}
      {sheet === 'review' && program && (
        <AssigneeSheet title="Send for Review" users={platformUsers} onPick={sendForReview} onClose={() => setSheet(null)} />
      )}
      {sheet === 'share' && program && <ShareCarePlanSheet patientId={patientId} program={program} onClose={() => setSheet(null)} />}
      {noteOpen && program && (
        <PlanNoteSheet
          onClose={() => setNoteOpen(false)}
          onSave={async (text) => {
            try {
              await addCarePlanNote(patientId, program, text);
              return true;
            } catch {
              toast.error('Could not add the note.');
              return false;
            }
          }}
        />
      )}
    </div>
  );
}

// The open item as it is in the store now (a save updates it in place).
function liveItem(plan, open) {
  const list = open.kind === 'goal' ? plan?.goals : open.kind === 'intv' ? plan?.interventions : plan?.barriers;
  return (list || []).find(x => x.id === open.item.id) || open.item;
}

function PlanNoteSheet({ onSave, onClose }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!text.trim()) return;
    setBusy(true);
    let ok;
    try { ok = await onSave(text.trim()); } finally { setBusy(false); }
    // addCarePlanNote shows "Note added" itself.
    if (ok) onClose();
  };
  return (
    <BottomSheet title="Add Note" onClose={onClose}>
      <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a note on this care plan" aria-label="Care plan note" />
      <div className={styles.actions}>
        <Button size="lg" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button size="lg" variant="solid" onClick={save} disabled={!text.trim() || busy}>Save Note</Button>
      </div>
    </BottomSheet>
  );
}

/**
 * The header's version and sign state, worked out as desktop CarePlanHeader
 * does: a pending review, unsigned changes since the last signature, signed,
 * or not signed; and whether Sign / Send for Review can be used.
 */
function useSignState(patientId, programId, plan) {
  const key = `${patientId}::${programId}`;
  const versions = useAppStore(s => s.patientCarePlanVersions?.[key]);
  const audit = useAppStore(s => s.patientCarePlanAudit?.[key]);
  const draft = useCarePlanDraftState(patientId, programId);
  return useMemo(() => {
    const p = plan?.plan;
    const versionNumber = versions?.[0]?.versionNumber ?? 0;
    let reviewTo = null;
    let reviewAt = null;
    for (const entry of (audit || [])) {
      if (entry.entityType !== 'plan') continue;
      if (entry.action === 'signed') break;
      if (entry.action === 'review_requested') { reviewTo = entry.summary || null; reviewAt = entry.detail || entry.createdAt || null; break; }
    }
    if (p?.signedAt && !draft.hasUnsignedChanges) reviewTo = null;
    let status = 'Not signed';
    let tone = 'muted';
    if (reviewTo) {
      status = `Sent for review to ${reviewTo}${reviewAt ? ` on ${fmtDate(reviewAt)}` : ''}`;
      tone = 'pending';
    } else if (p?.signedBy && draft.hasUnsignedChanges) {
      const n = draft.changes.length;
      const since = versionNumber ? ` since v${versionNumber}` : '';
      status = n ? `${n} unsigned ${n === 1 ? 'change' : 'changes'}${since}` : `Unsigned changes${since}`;
      tone = 'pending';
    } else if (p?.signedBy) {
      status = `Signed by ${p.signedBy}${p.signedAt ? ` on ${fmtDate(p.signedAt)}` : ''}`;
      tone = 'signed';
    }
    return {
      version: p?.signedBy && versionNumber ? `Ver. ${versionNumber}` : 'Draft',
      status,
      tone,
      canSign: carePlanSignShareEnabled(plan, { usingMock: !p, draft }),
    };
  }, [plan, versions, audit, draft]);
}
