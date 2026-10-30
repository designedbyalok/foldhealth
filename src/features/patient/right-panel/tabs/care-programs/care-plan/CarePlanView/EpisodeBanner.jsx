import { useState } from 'react';
import { Button } from '@/components/Button/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog';
import { DatePicker } from '@/components/DatePicker/DatePicker';
import { Icon } from '@/components/Icon/Icon';
import { Tooltip } from '@/components/Tooltip/Tooltip';
import { isoDay } from '../lib/carePlanPause';
import { dayAfter, episodeProgress } from '../lib/episodeTemplates';
import { formatInstanceDate } from '../lib/templateRenewal';
import styles from './EpisodeBanner.module.css';

const EPISODE_INFO = 'An episodic template covers one event, like a hospital discharge. '
  + 'It closes on its own after its last day and its goals and interventions move to the plan’s history. '
  + 'Extend it if the patient needs more time, or end it early.';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * A running episode on the care plan: which day it's on, when it ends, how
 * many other plans it has paused, and Extend / End Episode.
 */
export function EpisodeBanner({ run, canEdit, onExtend, onEnd }) {
  const p = episodeProgress(run);
  const paused = run.pausedPlanIds?.length || 0;
  const when = run.endsOn
    ? (p.daysLeft === 1 ? 'Last day today' : `Ends ${formatInstanceDate(run.endsOn)} · ${plural(p.daysLeft, 'day')} left`)
    : 'Runs until ended';
  const day = p.day ? (p.totalDays ? `Day ${Math.min(p.day, p.totalDays)} of ${p.totalDays}` : `Day ${p.day}`) : null;

  return (
    <div className={`${styles.banner} ${p.endingSoon ? styles.bannerSoon : ''}`} role="status">
      <Icon name="solar:calendar-mark-linear" size={16} color={p.endingSoon ? 'var(--status-warning)' : 'var(--primary-300)'} />
      <span className={styles.text}>
        <strong>{run.templateName} episode</strong>
        {[day, when, paused ? `${plural(paused, 'other care plan')} paused` : null].filter(Boolean).map(part => ` · ${part}`).join('')}
      </span>
      <Tooltip label={EPISODE_INFO}>
        <span className={styles.info} aria-label="About episodes" tabIndex={0}>
          <Icon name="solar:info-circle-linear" size={16} color="var(--neutral-300)" />
        </span>
      </Tooltip>
      {canEdit && (
        <span className={styles.actions}>
          <Button variant="outline" size="sm" leadingIcon="solar:calendar-add-linear" onClick={onExtend}>
            Extend
          </Button>
          <Button variant="ghost" size="sm" onClick={onEnd}>
            End Episode
          </Button>
        </span>
      )}
    </div>
  );
}

const QUICK_EXTENSIONS = [7, 14, 30];

/** A new last day for a running episode; paused plans' resume date follows it. */
export function ExtendEpisodeDialog({ run, onCancel, onConfirm }) {
  const todayIso = isoDay(new Date());
  const from = run.endsOn && run.endsOn >= todayIso ? run.endsOn : todayIso;
  const plus = (days) => {
    const [y, m, d] = from.split('-').map(Number);
    return isoDay(new Date(y, m - 1, d + days));
  };
  const [endsOn, setEndsOn] = useState(() => plus(QUICK_EXTENSIONS[0]));
  const [busy, setBusy] = useState(false);
  const paused = run.pausedPlanIds?.length || 0;
  const resumeOn = dayAfter(endsOn);

  const confirm = async () => {
    setBusy(true);
    try { await onConfirm(endsOn || null); } finally { setBusy(false); }
  };

  return (
    <ConfirmDialog
      variant="primary"
      align="start"
      icon="solar:calendar-add-linear"
      iconColor="var(--primary-300)"
      title={`Extend the ${run.templateName} episode?`}
      description={run.endsOn
        ? `It currently ends ${formatInstanceDate(run.endsOn)}. Pick a new last day.`
        : 'It has no last day yet. Pick one, or leave it empty to keep it running until someone ends it.'}
      confirmLabel="Save End Date"
      loading={busy}
      onCancel={onCancel}
      onConfirm={confirm}
    >
      <div className={styles.quick}>
        {QUICK_EXTENSIONS.map(n => (
          <Button key={n} variant="soft" size="sm" onClick={() => setEndsOn(plus(n))}>
            {`+${n} days`}
          </Button>
        ))}
      </div>
      <DatePicker
        label="New last day"
        value={endsOn}
        min={todayIso}
        onSelect={setEndsOn}
        helperText={paused
          ? (resumeOn
            ? `The ${plural(paused, 'paused care plan')} now resume${paused === 1 ? 's' : ''} on ${formatInstanceDate(resumeOn)}.`
            : `The ${plural(paused, 'paused care plan')} resume${paused === 1 ? 's' : ''} when the episode ends.`)
          : undefined}
      />
    </ConfirmDialog>
  );
}

/** Ending a running episode now: what moves to history and what resumes. */
export function EndEpisodeDialog({ run, outcome, onCancel, onConfirm }) {
  const [busy, setBusy] = useState(false);
  const paused = run.pausedPlanIds?.length || 0;
  const confirm = async () => {
    setBusy(true);
    try { await onConfirm(); } finally { setBusy(false); }
  };
  return (
    <ConfirmDialog
      variant="warning"
      align="start"
      title={`End the ${run.templateName} episode now?`}
      description={[
        `Its goals and interventions move to the plan’s history${outcome ? ` (${outcome.done} of ${outcome.total} met)` : ''} and the template comes off the plan. You can still open the ended episode from the template strip.`,
        paused ? `The ${plural(paused, 'paused care plan')} resume${paused === 1 ? 's' : ''} today.` : '',
      ].filter(Boolean).join(' ')}
      confirmLabel="End Episode"
      loading={busy}
      onCancel={onCancel}
      onConfirm={confirm}
    />
  );
}
