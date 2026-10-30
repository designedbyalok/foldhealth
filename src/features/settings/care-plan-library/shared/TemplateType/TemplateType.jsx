import { useState } from 'react';
import { Badge } from '../../../../../components/Badge/Badge';
import { IntroCard } from '../../../../../components/IntroCard/IntroCard';
import { NumberStepper } from '../../../../../components/NumberStepper/NumberStepper';
import { RadioOptionGroup } from '../../../../../components/RadioOptionGroup/RadioOptionGroup';
import { Switch } from '../../../../../components/Switch/Switch';
import {
  DEFAULT_EPISODE_DAYS, EPISODE_PRESETS, MAX_EPISODE_DAYS, episodeOf,
} from '../../../../patient/right-panel/tabs/care-programs/care-plan/lib/episodeTemplates';
import { TEMPLATE_TYPE_CHOICES } from './templateType';
import styles from './TemplateType.module.css';

/** "Template Type": general, chronic or episodic, each with a line saying when to use it. */
export function TemplateTypeChoice({ value, onChange, label = 'Template Type' }) {
  return (
    <RadioOptionGroup
      label={label}
      name="template-type"
      value={value}
      onChange={onChange}
      options={TEMPLATE_TYPE_CHOICES}
    />
  );
}

const CUSTOM = 'custom';
const presetKeyFor = (days) => EPISODE_PRESETS.find(p => p.days === (days || null))?.key || CUSTOM;

/**
 * What an episodic template does, then its length (a preset or a custom
 * number of days) and whether it pauses the patient's other plans.
 * `value` is { days, pausesOngoing }; `days` null means until closed.
 */
export function EpisodeSettings({ value, onChange }) {
  const days = value?.days ?? null;
  const pausesOngoing = value?.pausesOngoing !== false;
  // Kept apart from `days` so picking Custom stays picked when its number
  // happens to match a preset.
  const [lengthKey, setLengthKey] = useState(() => presetKeyFor(days));
  const set = (patch) => onChange({ days, pausesOngoing, ...patch });

  const pickLength = (key) => {
    setLengthKey(key);
    if (key === CUSTOM) set({ days: days || DEFAULT_EPISODE_DAYS });
    else set({ days: EPISODE_PRESETS.find(p => p.key === key).days });
  };

  return (
    <div className={styles.episode}>
      <IntroCard
        icon="solar:calendar-mark-linear"
        title="How episodic templates work"
        description="Use one for care that belongs to a single event rather than a long-term condition."
        items={[
          {
            icon: 'solar:play-circle-linear',
            title: 'Starts when applied',
            description: 'Day 1 is the day it’s added to a patient’s care plan. The end date is confirmed then.',
          },
          {
            icon: 'solar:calendar-linear',
            title: 'Ends on its own',
            description: 'After its last day the episode closes and its goals and interventions move to the plan’s history. It can be extended or ended early.',
          },
          {
            icon: 'solar:pause-circle-linear',
            title: 'Can pause ongoing plans',
            description: 'The patient’s other care plans pause during the episode, so their tasks and overdue flags don’t compete with it, and resume when it ends.',
          },
        ]}
      />

      <RadioOptionGroup
        label="Episode length"
        name="episode-length"
        variant="card"
        value={lengthKey}
        onChange={pickLength}
        options={[
          ...EPISODE_PRESETS.map(p => ({ value: p.key, label: p.label, hint: p.hint })),
          { value: CUSTOM, label: 'Custom', hint: `Any number of days, up to ${MAX_EPISODE_DAYS}.` },
        ]}
      />
      {lengthKey === CUSTOM && (
        <div className={styles.customDays}>
          <NumberStepper
            value={days || DEFAULT_EPISODE_DAYS}
            min={1}
            max={MAX_EPISODE_DAYS}
            onChange={(n) => set({ days: n })}
            ariaLabel="Episode length in days"
          />
          <span className={styles.customUnit}>days</span>
        </div>
      )}

      <div className={styles.pauseField}>
        <Switch
          checked={pausesOngoing}
          onChange={(on) => set({ pausesOngoing: on })}
          label="Pause the patient’s other care plans during the episode"
        />
        <p className={styles.pauseHint}>
          Suggested when it’s applied. Whoever applies it sees which plans would pause and can change it for that patient.
        </p>
      </div>
    </div>
  );
}

/** "Episodic · 30 days" / "Episodic · until closed" beside a template's name. Nothing for ongoing ones. */
export function EpisodeBadge({ template, className }) {
  const episode = episodeOf(template);
  if (!episode) return null;
  return (
    <Badge
      size="S"
      tone="info"
      icon="solar:calendar-mark-linear"
      label={`Episodic · ${episode.days ? `${episode.days} days` : 'until closed'}`}
      className={className}
    />
  );
}
