import { useEffect, useMemo, useRef, useState } from 'react';
import { Drawer } from '../../../../../../../../components/Drawer/Drawer';
import { Badge } from '../../../../../../../../components/Badge/Badge';
import { Button } from '../../../../../../../../components/Button/Button';
import { Icon } from '../../../../../../../../components/Icon/Icon';
import { useAppStore } from '../../../../../../../../store/useAppStore';
import { carePlanKey } from '../../../../../../../../store/lib/carePlanStoreLib';
import { TasksCard } from '../../../../overview/cards/TasksCard';
import { AddTaskDrawer } from '../../../../../../../tasks/AddTaskDrawer';
import { computeDueDate } from '../../tables/CarePlanInterventionsTable';
import { fmtCarePlanDate } from '../../tables/carePlanTableModel';
import { nextReviewDue } from '../../lib/cadence';
import { findPatientRecord } from '../../lib/carePlanPrintSettings';
import { confirmStatusChange, statusReasonPatch } from '../../lib/confirmStatusChange';
import { useReviewCadence } from '../../CarePlanView/useReviewCadence';
import { useEventUpdates } from '../../CarePlanView/useEventUpdates';
import { SuggestedActionsCard } from '../../CarePlanView/SuggestedActionsCard';
import { GoalPreviewDrawer } from '../GoalPreviewDrawer/GoalPreviewDrawer';
import { InterventionPreviewDrawer } from '../InterventionPreviewDrawer/InterventionPreviewDrawer';
import { BarrierDetailDrawer } from '../BarrierDetailDrawer/BarrierDetailDrawer';
import { ReviewDrawerSkeleton } from '../CarePlanReviewDrawer/ReviewDrawerSkeleton';
import { formatElapsed } from '../CarePlanReviewDrawer/reviewTime';
import {
  CHOICES, buildReviewSteps, draftReviewNote, firstOpenStep, isStepConfirmed, reviewChanges, skippedSteps, stepItemKeys,
} from './guidedReviewModel';
import { GoalStep, OtherStep, StepFooter, StepHead, WrapUpStep } from './GuidedReviewSteps';
import styles from './GuidedReviewDrawer.module.css';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function Clock({ startedAt, baseSeconds }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className={styles.clock}>
      <Icon name="solar:clock-circle-linear" size={14} color="var(--status-success)" />
      <span className={styles.clockTime}>{formatElapsed(baseSeconds * 1000 + (now - startedAt))}</span>
      <span className={styles.muted}>on this review</span>
    </span>
  );
}

/**
 * Start / Resume Review on a care plan (care plan redesign prototype, item 7):
 * walks each open goal with its barriers and interventions, then the items
 * no goal covers, Suggested Actions and the patient's tasks, and ends in
 * Wrap Up. Picks are kept on the open review (care_plan_call_reviews) so
 * Save and Exit resumes where it stopped; the plan changes only at Complete.
 * `onClose({ sendToSign })` asks the header to open Complete next.
 */
export function GuidedReviewDrawer({ patientId, program, signable, awaitingSignature, onClose }) {
  const key = carePlanKey(patientId, program.id);
  const live = useAppStore(s => s.patientCarePlans[key]);
  const review = useAppStore(s => s.carePlanReviews[key]);
  const fetchPatientCarePlan = useAppStore(s => s.fetchPatientCarePlan);
  const fetchCarePlanReviews = useAppStore(s => s.fetchCarePlanReviews);

  useEffect(() => {
    fetchPatientCarePlan(patientId, program.id);
    fetchCarePlanReviews(patientId, program.id);
  }, [patientId, program.id, fetchPatientCarePlan, fetchCarePlanReviews]);

  if (!live || !review) {
    return (
      <Drawer title="Care Plan Review" width="min(1280px, calc(100vw - 16px))" onClose={() => onClose()}>
        <ReviewDrawerSkeleton />
      </Drawer>
    );
  }
  return <GuidedReview patientId={patientId} program={program} live={live} open={review.open} signable={signable} awaitingSignature={awaitingSignature} onClose={onClose} />;
}

function GuidedReview({ patientId, program, live, open, signable, awaitingSignature, onClose }) {
  const updateItems = useAppStore(s => s.updateCarePlanReviewItems);
  const patchReview = useAppStore(s => s.patchCarePlanReview);
  const finishReview = useAppStore(s => s.finishCarePlanReview);
  const saveLive = useAppStore(s => s.saveCarePlanLiveField);
  const saveIntervention = useAppStore(s => s.savePatientCarePlanIntervention);
  const markNoteSeen = useAppStore(s => s.markCarePlanNoteSeen);
  const showToast = useAppStore(s => s.showToast);
  const patientName = useAppStore(s => findPatientRecord(s, patientId)?.name || '');
  const cadence = useReviewCadence({ patientId, program, plan: live.plan, fetch: false });
  const events = useEventUpdates({ patientId, program, live });

  const steps = useMemo(() => buildReviewSteps({
    goals: live.goals,
    interventions: live.interventions,
    barriers: live.barriers || [],
    measurements: live.measurements || [],
    dueOf: i => computeDueDate(i),
  }), [live]);

  const [entries, setEntries] = useState(() => open?.discussed || {});
  const [stepIndex, setStepIndex] = useState(() => firstOpenStep(steps, open?.discussed || {}));
  const [doneHere, setDoneHere] = useState(() => new Set()); // Suggested Actions and tasks, confirmed this sitting
  const [note, setNote] = useState(null); // null: the drafted note
  const [sendToSign, setSendToSign] = useState(true);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null); // { kind, item }: the item's own drawer, on top
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const [resumed] = useState(() => Object.keys(open?.discussed || {}).length > 0);
  const baseSeconds = open?.durationSeconds || 0;
  const mainRef = useRef(null);
  // Saves run one after another, so each merges onto the last one's entries.
  const saving = useRef(null);
  const save = (patch) => {
    saving.current = (saving.current || Promise.resolve()).then(() => updateItems(patientId, program, patch));
    return saving.current;
  };
  const setEntry = (itemKey, fields) => {
    setEntries(prev => ({ ...prev, [itemKey]: { ...(prev[itemKey] || { at: new Date().toISOString(), tags: [] }), ...fields } }));
    save({ [itemKey]: fields });
  };

  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const reviewable = steps.filter(s => s.type !== 'wrap');
  const doneCount = reviewable.filter(s => isStepConfirmed(s, entries, doneHere)).length;
  const changes = useMemo(() => reviewChanges(steps, entries), [steps, entries]);
  const skipped = useMemo(() => skippedSteps(steps, entries), [steps, entries]);
  // A signed plan with nothing changed has nothing to send; one waiting on the provider is already sent.
  const canSign = !awaitingSignature && (signable || changes.length > 0);
  const firstName = (patientName || '').split(/\s+/)[0];
  const noteValue = note ?? draftReviewNote({ firstName, changes, skipped, entries });
  const nextDue = cadence?.cadence ? nextReviewDue({ cadence: cadence.cadence, lastTouch: new Date().toISOString().slice(0, 10) }) : null;
  const goalSteps = steps.filter(s => s.type === 'goal');

  const go = (i) => {
    setStepIndex(Math.max(0, Math.min(steps.length - 1, i)));
    mainRef.current?.scrollTo?.({ top: 0 });
  };
  const confirm = () => {
    if (step.type === 'goal' || step.type === 'other') {
      const patch = Object.fromEntries(stepItemKeys(step).map(k => [k, { confirmed: true }]));
      setEntries(prev => {
        const next = { ...prev };
        for (const k of Object.keys(patch)) next[k] = { ...(prev[k] || { at: new Date().toISOString(), tags: [] }), confirmed: true };
        return next;
      });
      save(patch);
    } else {
      setDoneHere(prev => new Set(prev).add(step.key));
    }
    go(stepIndex + 1);
  };
  const pick = (row, choice) => setEntry(row.key, { decision: choice === CHOICES[row.kind][0] ? null : choice });
  const toggleTag = (itemKey, tag) => {
    const tags = entries[itemKey]?.tags || [];
    setEntry(itemKey, { tags: tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag] });
  };
  const openItem = (kind, item) => { setPreview({ kind, item }); markNoteSeen(kind, item.id); };

  const elapsedSeconds = () => baseSeconds + Math.round((Date.now() - startedAt) / 1000);
  const saveAndExit = async () => {
    await saving.current;
    // Nothing picked and no review yet: closing leaves no empty review behind.
    if (!open && !Object.keys(entries).length) { onClose(); return; }
    await patchReview(patientId, program, { duration_seconds: elapsedSeconds() });
    showToast(`Review saved · ${doneCount} of ${reviewable.length} reviewed · Resume Review to continue`);
    onClose();
  };

  // Status changes ask for their reasons one target status at a time, as the tables do.
  const askReasons = async (groups, i = 0, out = new Map()) => {
    if (i >= groups.length) return out;
    const [status, rows] = groups[i];
    const why = await confirmStatusChange(rows.map(r => ({ type: r.kind, item: r.item })), status);
    if (!why) return null;
    out.set(status, why);
    return askReasons(groups, i + 1, out);
  };
  const complete = async () => {
    setBusy(true);
    try {
      const byStatus = new Map();
      for (const c of changes.filter(x => x.status)) byStatus.set(c.status, [...(byStatus.get(c.status) || []), c]);
      const reasons = await askReasons([...byStatus.entries()]);
      if (!reasons) return;
      await saving.current;
      await Promise.all([
        ...changes.filter(c => c.status).map(c => saveLive(patientId, program, c.kind, c.item.id, {
          status: c.status, ...statusReasonPatch(c.item, reasons.get(c.status)),
        })),
        ...changes.filter(c => c.dueDate).map(c => saveIntervention(patientId, program, {
          ...c.item, config: { ...(c.item.config || {}), dueDateOverride: c.dueDate },
        }, c.item.id)),
      ]);
      const reviewedItems = steps.flatMap(stepItemKeys).filter(k => entries[k]?.confirmed || entries[k]?.decision).length;
      const saved = await finishReview(patientId, program, noteValue, {
        startedAt, stoppedAt: Date.now(), baseSeconds, discussedCount: reviewedItems,
      });
      if (!saved) return;
      showToast(`Review completed · ${plural(changes.length, 'change')}`);
      onClose({ sendToSign: sendToSign && canSign });
    } finally {
      setBusy(false);
    }
  };

  const eyebrow = (s) => {
    const i = steps.indexOf(s);
    if (s.type === 'goal') return `Goal ${goalSteps.indexOf(s) + 1} of ${goalSteps.length} · ${s.goal.status || 'Not Started'}`;
    return `Step ${i + 1} of ${steps.length}`;
  };
  const changeHint = (s) => {
    const n = stepItemKeys(s).filter(k => entries[k]?.decision).length;
    return n ? `${plural(n, 'change')} on this step` : 'No changes on this step';
  };
  const footer = (s) => <StepFooter hint={s.type === 'goal' || s.type === 'other' ? changeHint(s) : null} onSkip={() => go(stepIndex + 1)} onConfirm={confirm} />;

  const title = (
    <span className={styles.title}>
      {patientName || 'Care Plan Review'}
      <Badge size="sm" label={program.code || program.name} />
      <span className={styles.titleMeta}>
        {cadence?.lastReview ? `Last reviewed ${fmtCarePlanDate(cadence.lastReview)}` : 'Not reviewed yet'}
        {resumed ? ' · Resumed' : ''}
      </span>
    </span>
  );

  return (
    <Drawer
      title={title}
      width="min(1280px, calc(100vw - 16px))"
      onClose={saveAndExit}
      noCloseDivider
      bodyClassName={styles.body}
      headerRight={(
        <>
          <Clock startedAt={startedAt} baseSeconds={baseSeconds} />
          <span className={styles.headerDivider} aria-hidden="true" />
          <Button variant="ghost" tone="neutral" onClick={saveAndExit}>Save and Exit</Button>
          <Button onClick={() => go(steps.length - 1)} disabled={step.type === 'wrap'}>Wrap Up Review</Button>
          <span className={styles.headerDivider} aria-hidden="true" />
        </>
      )}
    >
      <div className={styles.layout}>
        <aside className={styles.agenda} aria-label="Review agenda">
          <div className={styles.agendaHead}>
            <span className={styles.cardTitle}>Review Agenda</span>
            <span className={styles.progressBar} aria-hidden="true"><span style={{ width: `${reviewable.length ? (doneCount / reviewable.length) * 100 : 0}%` }} /></span>
            <span className={styles.muted}>{doneCount} of {reviewable.length} reviewed</span>
          </div>
          <nav className={styles.agendaList}>
            {steps.map((s, i) => {
              const done = s.type !== 'wrap' && isStepConfirmed(s, entries, doneHere);
              const on = s === step;
              const badge = s.type === 'wrap' ? { label: plural(changes.length, 'Change'), tone: 'neutral' } : s.attention;
              return (
                <button key={s.key} type="button" className={`${styles.agendaItem} ${on ? styles.agendaOn : ''}`} aria-current={on ? 'step' : undefined} onClick={() => go(i)}>
                  <span className={`${styles.mark} ${done ? styles.markDone : on ? styles.markOn : ''}`}>
                    {done ? <Icon name="solar:check-read-linear" size={12} color="currentColor" /> : i + 1}
                  </span>
                  <span className={styles.agendaText}>
                    <span className={styles.agendaLabel}>{s.title}</span>
                    {badge && <Badge size="sm" tone={badge.tone} label={badge.label} />}
                  </span>
                </button>
              );
            })}
          </nav>
          <div className={styles.howTo}>
            <span className={styles.cardTitle}>How to Review</span>
            <span className={styles.muted}>Work top to bottom. Goals that need attention come first; on-track goals only need a quick confirm.</span>
            <span className={styles.muted}>Every item starts as it is today. Change it only when the review supports it.</span>
            <span className={styles.muted}>Nothing changes on the plan until Wrap Up.</span>
          </div>
        </aside>

        <main className={styles.main} ref={mainRef}>
          <div className={styles.stepBody}>
            {step.type === 'goal' && (
              <GoalStep step={step} eyebrow={eyebrow(step)} entries={entries} onPick={pick} onDueDate={(row, iso) => setEntry(row.key, { decision: 'Reschedule', dueDate: iso })} onToggleTag={toggleTag} onOpen={openItem} footer={footer(step)} />
            )}
            {step.type === 'other' && (
              <OtherStep step={step} eyebrow={eyebrow(step)} entries={entries} onPick={pick} onDueDate={(row, iso) => setEntry(row.key, { decision: 'Reschedule', dueDate: iso })} onOpen={openItem} footer={footer(step)} />
            )}
            {step.type === 'actions' && (
              <>
                <StepHead eyebrow={eyebrow(step)} title="Suggested Actions">
                  <span className={styles.muted}>Plan changes suggested by recent events. Accept or dismiss each one; anything left stays on the care plan.</span>
                </StepHead>
                <SuggestedActionsCard events={events} canEdit limit={20} />
                {(!events.loaded || events.missing) && <p className={styles.muted}>{events.missing ? 'Suggested actions are not available for this plan.' : 'Loading suggestions…'}</p>}
                {footer(step)}
              </>
            )}
            {step.type === 'tasks' && (
              <>
                <StepHead eyebrow={eyebrow(step)} title="Pending Patient Tasks">
                  <span className={styles.muted}>Close what was done on this call, or add a follow-up.</span>
                </StepHead>
                <TasksCard patient={{ id: patientId, memberId: patientId, name: patientName }} actions={{ addTask: () => setAddTaskOpen(true) }} />
                {footer(step)}
              </>
            )}
            {step.type === 'wrap' && (
              <WrapUpStep
                changes={changes}
                skipped={skipped}
                note={noteValue}
                onNote={setNote}
                sendToSign={sendToSign && canSign}
                onSendToSign={setSendToSign}
                canSign={canSign}
                nextReview={nextDue ? fmtCarePlanDate(nextDue) : null}
                onReviewSkipped={() => go(steps.indexOf(skipped[0]))}
                onBack={() => go(stepIndex - 1)}
                onComplete={complete}
                busy={busy}
              />
            )}
          </div>
        </main>
      </div>

      {addTaskOpen && (
        <AddTaskDrawer initialMember={patientName} onClose={() => setAddTaskOpen(false)} onTaskCreated={() => setAddTaskOpen(false)} />
      )}
      {preview?.kind === 'goal' && (
        <GoalPreviewDrawer
          goal={live.goals.find(g => g.id === preview.item.id) || preview.item}
          patientId={patientId}
          program={program}
          onClose={() => setPreview(null)}
          onOpenIntervention={(i) => setPreview({ kind: 'intervention', item: i })}
          onOpenBarrier={(b) => setPreview({ kind: 'barrier', item: b })}
        />
      )}
      {preview?.kind === 'intervention' && (
        <InterventionPreviewDrawer
          intervention={live.interventions.find(i => i.id === preview.item.id) || preview.item}
          patientId={patientId}
          program={program}
          onClose={() => setPreview(null)}
          onOpenGoal={(g) => setPreview({ kind: 'goal', item: g })}
        />
      )}
      {preview?.kind === 'barrier' && (
        <BarrierDetailDrawer
          barrier={(live.barriers || []).find(b => b.id === preview.item.id) || preview.item}
          patientId={patientId}
          program={program}
          onClose={() => setPreview(null)}
          onOpenGoal={(g) => setPreview({ kind: 'goal', item: g })}
        />
      )}
    </Drawer>
  );
}
