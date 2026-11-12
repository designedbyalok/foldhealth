import { Avatar } from '../../components/Avatar/Avatar';
import { Badge } from '../../components/Badge/Badge';
import { Banner } from '../../components/Banner/Banner';
import { Button } from '../../components/Button/Button';
import { Drawer } from '../../components/Drawer/Drawer';
import { Icon } from '../../components/Icon/Icon';
import { SegmentedControl } from '../../components/SegmentedControl/SegmentedControl';
import { Textarea } from '../../components/Textarea/Textarea';
import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useLiveCall } from './useLiveCall';
import { MODE_COPY, callRecordFromWrapUp, wrapUpDraft } from './liveCallModel';
import { routeAcceptedItems, routeLabel, routedSummary } from './liveCallRouting';
import { useCallPatient } from './useCallPatient';
import { patientLevelProgram, showsProgramCarePlan } from '../patient/right-panel/tabs/care-programs/care-plan/lib/carePlanMode';
import styles from './WrapUpDrawer.module.css';

const clock = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

/** Wrap Up Call (or Visit): after it ends, the summary to keep and what saves with it. */
export function WrapUpDrawer() {
  const open = useLiveCall(s => s.wrapOpen && !!s.patient && !!s.script);
  return open ? <WrapUpDrawerBody /> : null;
}

function WrapUpDrawerBody() {
  const session = useLiveCall();
  const createCallRecord = useAppStore(s => s.createCallRecord);
  const showToast = useAppStore(s => s.showToast);
  const cmName = useAppStore(s => s.currentUserProfile?.name) || 'Care Manager';
  const programLevel = showsProgramCarePlan(useAppStore(s => s.carePlanMode));
  const { patient, script } = session;
  const { pid, programs } = useCallPatient(patient);
  const [saving, setSaving] = useState(false);

  // Care plan items go to the transition program when there is one (the call
  // is about the discharge), else the first open program.
  const planProgram = programLevel
    ? (programs.find(p => /^TOC/.test(p.code)) || programs[0] || null)
    : patientLevelProgram(pid);
  const draft = wrapUpDraft(script, session);
  const summary = session.summaryDraft ?? draft.summary;
  const copy = MODE_COPY[session.mode] || MODE_COPY.call;
  const reached = session.disposition === copy.done;
  const canComplete = !saving && (!reached || summary.trim().length > 0);
  const endedAt = new Date(session.wrapEndedAt);
  const destination = (route) => {
    const label = routeLabel(route);
    if ((route?.kind === 'goal' || route?.kind === 'barrier') && planProgram?.code) return `${label} (${planProgram.code})`;
    return label;
  };

  const discard = () => { session.reset(); showToast('Wrap-up discarded'); };
  const complete = async () => {
    setSaving(true);
    let done;
    try {
      createCallRecord(callRecordFromWrapUp({
        patient, script, session, cmName, summary: summary.trim(), disposition: session.disposition,
        seconds: session.wrapSeconds, endedAt, accepted: draft.accepted, medUpdates: draft.medUpdates, stepUpdates: draft.stepUpdates,
      }));
      done = await routeAcceptedItems({
        store: useAppStore, patient, pid, program: planProgram, accepted: draft.accepted, script, medEdits: session.medEdits,
      });
      // A call taken over from an agent closes the agent's relay: it no
      // longer holds the patient, and the TOC worklist's Relay says so.
      const record = useAppStore.getState().patients.find(p => String(p.id) === String(pid));
      if (record?.relayStatus === 'live') {
        useAppStore.getState().updatePatient(record.id, { relayStatus: 'completed', relayNote: `Handed off to ${cmName}` });
      }
    } finally {
      setSaving(false);
    }
    session.reset();
    const made = routedSummary(done);
    showToast(`${copy.noun} saved to ${patient.name.split(' ')[0]}’s call log${made ? ` · created ${made}` : ''}${done.failed ? ` · ${done.failed} couldn’t be saved` : ''}`);
  };


  return (
    <Drawer
      title={`Wrap Up ${copy.noun}`}
      onClose={discard}
      closeOnOverlayClick={false}
      noCloseDivider
      headerRight={(
        <div className={styles.headerRight}>
          <Button size="sm" leadingIcon="solar:check-circle-linear" disabled={!canComplete} onClick={complete}>{saving ? 'Saving…' : 'Complete'}</Button>
          <span className={styles.headerDivider} />
        </div>
      )}
    >
      <div className={styles.body}>
        <section className={styles.callCard}>
          <Avatar variant="patient" size={36} initials={patient.initials} />
          <div className={styles.who}>
            <span className={styles.name}>{patient.name}</span>
            <span className={styles.sub}>#{patient.memberId} · {script.reason}</span>
          </div>
          <div className={styles.stats}>
            <span className={styles.stat}><span className={styles.statKey}>Duration</span>{clock(session.wrapSeconds)}</span>
            <span className={styles.stat}><span className={styles.statKey}>Ended</span>{endedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
          </div>
        </section>

        <section className={styles.section}>
          <span className={styles.label}>Outcome</span>
          <SegmentedControl size="sm" items={copy.outcomes} value={session.disposition} onValueChange={session.setDisposition} aria-label={`${copy.noun} outcome`} />
        </section>

        <section className={styles.section}>
          <div className={styles.labelRow}>
            <Icon name="custom:ai" size={16} />
            <span className={styles.label}>Call Summary</span>
            <span className={styles.spacer} />
            {draft.sources.length > 0
              ? <span className={styles.sources}>From {draft.sources.join(' · ')}</span>
              : <span className={styles.sources}>Not recorded</span>}
          </div>
          <Textarea
            rows={8}
            aria-label="Call summary"
            value={summary}
            onChange={e => session.setSummaryDraft(e.target.value)}
            placeholder={draft.recorded ? `Summarize the ${copy.noun.toLowerCase()}.` : `Nothing was recorded. Write a short summary of the ${copy.noun.toLowerCase()}.`}
          />
          {reached && !canComplete && <span className={styles.hint}>{copy.noun === 'Visit' ? 'A completed visit' : 'A reached call'} needs a summary before it can be saved.</span>}
        </section>

        {draft.pending.length > 0 && (
          <section className={styles.section}>
            <Banner tone="warning" size="sm">
              {draft.pending.length} {draft.pending.length === 1 ? 'suggestion wasn’t' : 'suggestions weren’t'} reviewed. Accept the ones to keep; the rest won’t be saved.
            </Banner>
            <ul className={styles.list}>
              {draft.pending.map(it => (
                <li key={it.id} className={styles.row}>
                  <Badge size="sm" tone={it.tone} icon={it.icon} label={it.type} />
                  <span className={styles.rowText}>{session.edits[it.id] || it.title}</span>
                  <Button size="sm" variant="soft" onClick={() => session.accept(it.id)}>Accept</Button>
                  <Button size="sm" variant="ghost" onClick={() => session.dismiss(it.id)}>Dismiss</Button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className={styles.section}>
          <span className={styles.label}>Saved With This Call</span>
          <ul className={styles.list}>
            <li className={styles.row}>
              <span className={styles.rowIcon}><Icon name="solar:document-text-linear" size={16} color="var(--neutral-400)" /></span>
              <span className={styles.rowText}>Summary{draft.recorded && session.shown > 0 ? ', transcript' : ''} and outcome</span>
              <span className={styles.where}>Call log</span>
            </li>
            {draft.stepUpdates.map(st => (
              <li key={st} className={styles.row}>
                <span className={styles.rowIcon}><Icon name="solar:checklist-minimalistic-linear" size={16} color="var(--neutral-400)" /></span>
                <span className={styles.rowText}>Program step: {st}</span>
                <span className={styles.where}>Saved to the program</span>
              </li>
            ))}
            {draft.medUpdates.map(m => (
              <li key={m} className={styles.row}>
                <span className={styles.rowIcon}><Icon name="solar:pill-linear" size={16} color="var(--neutral-400)" /></span>
                <span className={styles.rowText}>Medication update: {m}</span>
                <span className={styles.where}>Updates the medication list</span>
              </li>
            ))}
            {draft.accepted.map(it => (
              <li key={it.id} className={styles.row}>
                <span className={styles.rowIcon}><Icon name={it.icon} size={16} color="var(--neutral-400)" /></span>
                <span className={styles.rowText}>{it.type}: {it.title}</span>
                <span className={styles.where}>{destination(it.route)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Drawer>
  );
}
