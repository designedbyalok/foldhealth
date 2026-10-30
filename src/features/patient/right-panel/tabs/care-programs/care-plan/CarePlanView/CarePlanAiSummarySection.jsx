import { useEffect } from 'react';
import { useAppStore } from '../../../../../../../store/useAppStore';
import { AiSummaryCard, AiSummarySkeleton, SummarizeButton } from '../summary/CarePlanAiSummary/CarePlanAiSummary';
import { buildSummaryPayload, useCarePlanAiSummary } from '../summary/CarePlanAiSummary/useCarePlanAiSummary';
import { SectionTitle } from './CarePlanViewSections';
import styles from './CarePlanView.module.css';

/* AI Summary for one program's care plan: the Comprehensive Care Plan's
   recap scoped to this program, saved per patient + program until someone
   regenerates or dismisses it. Summarizes the current plan (`live`). */
export function CarePlanAiSummarySection({ patientId, program, patientName, live, open, onToggle }) {
  const programId = program?.id;
  const entry = useAppStore(s => s.programCarePlanSummaries[`${patientId}::${programId}`]);
  const fetchSummary = useAppStore(s => s.fetchProgramCarePlanSummary);
  const saveSummary = useAppStore(s => s.saveProgramCarePlanSummary);
  const deleteSummary = useAppStore(s => s.deleteProgramCarePlanSummary);

  useEffect(() => {
    if (patientId && programId) fetchSummary(patientId, programId);
  }, [patientId, programId, fetchSummary]);

  const goals = live?.goals || [];
  const interventions = live?.interventions || [];
  const barriers = live?.barriers || [];
  const summary = useCarePlanAiSummary({
    saved: entry?.summary || null,
    onSave: (next) => saveSummary(patientId, programId, next),
    onDelete: () => deleteSummary(patientId, programId),
    buildPayload: () => buildSummaryPayload({
      patientName,
      programs: [program],
      conditions: live?.plan?.conditions || [],
      goals,
      interventions,
      barriers,
    }),
    isEmpty: goals.length + interventions.length + barriers.length === 0,
  });

  return (
    <section className={styles.careNoteSection}>
      <div className={`${styles.careNoteHead} ${styles.aiSummaryHead}`}>
        <SectionTitle label="AI Summary" open={open} onToggle={onToggle} />
        {/* Opens the section too, so the result isn't generated out of sight. */}
        <SummarizeButton
          state={summary.state}
          onClick={() => { if (!open) onToggle(); summary.generate(); }}
          idleLabel="Summarize this care plan"
        />
      </div>
      {open && summary.state === 'loading' && <AiSummarySkeleton />}
      {open && summary.state === 'ready' && (
        <AiSummaryCard
          data={entry.summary}
          label="AI-generated care plan summary"
          onCopy={summary.copy}
          onRegenerate={summary.regenerate}
          onDelete={summary.clear}
        />
      )}
    </section>
  );
}
