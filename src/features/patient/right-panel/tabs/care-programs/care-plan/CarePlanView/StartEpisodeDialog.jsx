import { useEffect, useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog';
import { DatePicker } from '@/components/DatePicker/DatePicker';
import { Checkbox } from '@/components/ShadcnCheckbox/ShadcnCheckbox';
import { useAppStore } from '../../../../../../../store/useAppStore';
import { isoDay } from '../lib/carePlanPause';
import { dayAfter, episodeEndsOn, episodeLengthLabel, episodeOf } from '../lib/episodeTemplates';
import { formatInstanceDate } from '../lib/templateRenewal';
import styles from './EpisodeBanner.module.css';

/**
 * Applying an episodic template: says what an episode is, confirms its last
 * day (prefilled from the template's length; empty runs until closed) and
 * which of the patient's other care plans pause while it runs.
 * `onConfirm({ endsOn, pausePlans })`.
 */
export function StartEpisodeDialog({ template, patientId, program, onCancel, onConfirm, step, steps }) {
  const fetchEpisodePausablePlans = useAppStore(s => s.fetchEpisodePausablePlans);
  const episode = episodeOf(template);
  const todayIso = isoDay(new Date());
  const [endsOn, setEndsOn] = useState(() => episodeEndsOn(new Date(), episode?.days) || '');
  const [plans, setPlans] = useState(null);
  const [picked, setPicked] = useState(new Set());

  useEffect(() => {
    let live = true;
    fetchEpisodePausablePlans(patientId, program.id).then(list => {
      if (!live) return;
      setPlans(list);
      setPicked(new Set(episode?.pausesOngoing ? list.filter(p => !p.paused).map(p => p.planId) : []));
    });
    return () => { live = false; };
  }, [fetchEpisodePausablePlans, patientId, program.id, episode?.pausesOngoing]);

  const toggle = (planId) => setPicked(prev => {
    const next = new Set(prev);
    if (next.has(planId)) next.delete(planId); else next.add(planId);
    return next;
  });
  const resumeOn = dayAfter(endsOn);

  return (
    <ConfirmDialog
      variant="primary"
      align="start"
      icon="solar:calendar-mark-linear"
      iconColor="var(--primary-300)"
      title={`Start ${episode?.days ? `a ${episodeLengthLabel(episode.days)}` : 'an episode'}?${steps > 1 ? ` (${step} of ${steps})` : ''}`}
      description={`"${template.name}" is episodic: it covers one event, starts today as day 1 and closes on its own after its last day. Its goals and interventions then move to the plan's history.`}
      confirmLabel="Start Episode"
      confirmDisabled={plans == null}
      onCancel={onCancel}
      onConfirm={() => onConfirm({ endsOn: endsOn || null, pausePlans: (plans || []).filter(p => picked.has(p.planId)) })}
    >
      <DatePicker
        label="Last day"
        value={endsOn}
        min={todayIso}
        onSelect={setEndsOn}
        helperText={endsOn
          ? `Day ${episodeDayCount(todayIso, endsOn)} of the episode. ${episode?.days ? `The template suggests ${episode.days} days.` : ''} Clear it to run until someone ends it.`
          : 'No last day: it runs until someone ends it from the care plan.'}
      />

      <div className={styles.pauseList}>
        <span className={styles.pauseListLabel}>Pause the patient’s other care plans during the episode</span>
        {plans == null ? (
          <span className={styles.pauseListHint}>Looking for the patient’s other care plans…</span>
        ) : plans.length === 0 ? (
          <span className={styles.pauseListHint}>The patient has no other care plans to pause.</span>
        ) : (
          <>
            {plans.map(p => (
              <label key={p.planId} className={styles.pauseRow}>
                <Checkbox
                  checked={picked.has(p.planId)}
                  disabled={p.paused}
                  onCheckedChange={() => toggle(p.planId)}
                  aria-label={`Pause the ${p.programName} care plan`}
                />
                <span className={styles.pauseRowName}>{p.programName} care plan</span>
                {p.paused && <span className={styles.pauseRowNote}>Already paused</span>}
              </label>
            ))}
            <span className={styles.pauseListHint}>
              {'Paused plans have no cadence, overdue flags or automated outreach. '}
              {resumeOn
                ? `They resume on ${formatInstanceDate(resumeOn)}, the day after the episode, or sooner if it ends early.`
                : 'They resume when the episode ends.'}
            </span>
          </>
        )}
      </div>
    </ConfirmDialog>
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;
function episodeDayCount(fromIso, toIso) {
  const [a, b] = [fromIso, toIso].map(s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); });
  return Math.round((b - a) / DAY_MS) + 1;
}
