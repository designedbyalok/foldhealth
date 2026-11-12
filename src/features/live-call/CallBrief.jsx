import { useState } from 'react';
import { Badge } from '../../components/Badge/Badge';
import { useLiveCall } from './useLiveCall';
import { medBadge, pointsView } from './liveCallModel';
import { jumpToLine } from './jumpToLine';
import { useGoalsInTheirWords } from './useGoalsInTheirWords';
import { Button } from '../../components/Button/Button';
import { useAppStore } from '../../store/useAppStore';
import styles from './LiveCallOverlay.module.css';

/** Left rail: why we're calling, what to cover and the medications to review. */
export function CallBrief({ script }) {
  const shown = useLiveCall(s => s.shown);
  const mode = useLiveCall(s => s.mode);
  const patient = useLiveCall(s => s.patient);
  const openLiveDrawer = useAppStore(s => s.openLiveDrawer);
  const words = useGoalsInTheirWords(patient);
  const agent = patient?.agent || 'the agent';
  const medOpen = useLiveCall(s => s.medOpen);
  const medEdits = useLiveCall(s => s.medEdits);
  const openMed = useLiveCall(s => s.openMed);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const { points, done } = pointsView(script, shown);

  return (
    <aside className={`${styles.panel} ${styles.brief}`} aria-label="Call brief">
      <section className={styles.briefSection}>
        <span className={styles.sectionLabel}>Reason for {mode === 'visit' ? 'Visit' : 'Call'}</span>
        <p className={styles.reason}>{script.reason}</p>
      </section>

      {script.handoff?.length > 0 && (
        <section className={styles.briefSection}>
          <span className={styles.sectionLabel}>Handoff From {agent}</span>
          <ul className={styles.notes}>
            {script.handoff.map(h => <li key={h}>{h}</li>)}
          </ul>
          <span><Button variant="ghost" size="sm" leadingIcon="solar:document-text-linear" onClick={() => openLiveDrawer(patient.id)}>Agent Transcript</Button></span>
        </section>
      )}

      {points.length > 0 && (
        <section className={styles.briefSection}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionLabel}>Talking Points</span>
            <span className={styles.count}>{done} of {points.length}</span>
          </div>
          <ul className={styles.points}>
            {points.map(p => (
              <li key={p.t}>
                <button
                  type="button"
                  className={p.done ? styles.pointDone : styles.point}
                  disabled={!p.done}
                  title={p.done ? `Jump to ${script.lines[p.line].t} in the transcript` : 'Not covered yet'}
                  onClick={() => jumpToLine(p.line)}
                >
                  <span className={styles.bullet} aria-hidden="true" />
                  <span className={styles.pointText}>{p.t}</span>
                  {p.done && <span className={styles.pointAt}>{script.lines[p.line].t}</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {words.length > 0 && (
        <section className={styles.briefSection}>
          <span className={styles.sectionLabel}>Goals in Their Words</span>
          <ul className={styles.words}>
            {words.map(w => (
              <li key={w.id}>
                <span className={styles.wordsQuote}>“{w.words}”</span>
                <span className={styles.wordsGoal}>{w.goal} · {w.program}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {script.meds.length > 0 && (
        <section className={styles.briefSection}>
          <span className={styles.sectionLabel}>Medications</span>
          <ul className={styles.meds}>
            {script.meds.map(m => {
              const badge = medBadge(m, medEdits[m.n], today);
              return (
                <li key={m.n}>
                  <button
                    type="button"
                    className={medOpen === m.n ? styles.medOn : styles.med}
                    aria-expanded={medOpen === m.n}
                    title={`Review or update ${m.n}`}
                    onClick={() => openMed(m.n)}
                  >
                    <span className={styles.medName}>{m.n}</span>
                    <span className={styles.medRow}>
                      <span className={styles.medSig}>{medEdits[m.n]?.sig || m.sig}</span>
                      <Badge size="sm" tone={badge.tone} label={badge.label} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </aside>
  );
}
