import { useState } from 'react';
import { Badge } from '../../../../../components/Badge/Badge';
import { CollapsibleSection } from '../../../../../components/CollapsibleSection/CollapsibleSection';
import { IntroCard } from '../../../../../components/IntroCard/IntroCard';
import { NumberStepper } from '../../../../../components/NumberStepper/NumberStepper';
import { RadioOptionGroup } from '../../../../../components/RadioOptionGroup/RadioOptionGroup';
import { Select } from '../../../../../components/Select/Select';
import { Switch } from '../../../../../components/Switch/Switch';
import { CARE_PROGRAM_CATALOG } from '../../../../patient/data/careProgramCatalog';
import {
  DEFAULT_EPISODE_DAYS, EPISODE_PRESETS, EPISODE_PROGRAM_CODES, MAX_EPISODE_DAYS, episodeOf,
} from '../../../../patient/right-panel/tabs/care-programs/care-plan/lib/episodeTemplates';
import { TEMPLATE_TYPE_CHOICES } from './templateType';
import styles from './TemplateType.module.css';

/**
 * "Template Type": general, chronic or episodic, each with a line saying when
 * to use it. `details` ({ [type]: node }) shows under that type while it's picked.
 */
export function TemplateTypeChoice({ value, onChange, label = 'Template Type', details = {} }) {
  return (
    <RadioOptionGroup
      label={label}
      name="template-type"
      value={value}
      onChange={onChange}
      options={TEMPLATE_TYPE_CHOICES.map(c => ({ ...c, content: details[c.value] }))}
    />
  );
}

const CUSTOM = 'custom';
const presetKeyFor = (days) => EPISODE_PRESETS.find(p => p.days === (days || null))?.key || CUSTOM;

const PROGRAMS = [...CARE_PROGRAM_CATALOG, { code: 'CCM', name: 'Chronic Care Management' }];
const programOption = p => ({ value: p.code, label: `${p.name} (${p.code})` });
const EPISODE_PROGRAM_OPTIONS = PROGRAMS.filter(p => EPISODE_PROGRAM_CODES.includes(p.code)).map(programOption);
const PAUSABLE_PROGRAM_OPTIONS = PROGRAMS.filter(p => !EPISODE_PROGRAM_CODES.includes(p.code)).map(programOption);

/**
 * What an episodic template does, then its length (a preset or a custom
 * number of days), the program it runs as, and which of the patient's other
 * plans it pauses. `value` is { days, pausesOngoing, programCode, supersedes };
 * `days` null means until closed, an empty `supersedes` pauses every other plan.
 */
export function EpisodeSettings({ value, onChange }) {
  const days = value?.days ?? null;
  const pausesOngoing = value?.pausesOngoing !== false;
  const programCode = value?.programCode || null;
  const supersedes = value?.supersedes || [];
  // Kept apart from `days` so picking Custom stays picked when its number
  // happens to match a preset.
  const [lengthKey, setLengthKey] = useState(() => presetKeyFor(days));
  const set = (patch) => onChange({ days, pausesOngoing, programCode, supersedes, ...patch });

  const pickLength = (key) => {
    setLengthKey(key);
    if (key === CUSTOM) { set({ days: days || DEFAULT_EPISODE_DAYS }); return; }
    const preset = EPISODE_PRESETS.find(p => p.key === key);
    // A preset suggests its program until someone picks one.
    set({ days: preset.days, programCode: programCode || preset.programCode });
  };

  return (
    <div className={styles.episode}>
      <IntroCard
        icon="solar:calendar-mark-linear"
        title="How episodic templates work"
        description="For care that belongs to one event, such as a discharge, rather than a long-term condition."
        layout="steps"
        // In the order they happen to the patient.
        items={[
          {
            icon: 'solar:play-circle-linear',
            title: 'Starts when applied',
            description: 'The patient is enrolled in its program with a care plan of its own. Day 1 is the day it’s applied.',
          },
          {
            icon: 'solar:pause-circle-linear',
            title: 'Can pause other plans',
            description: 'Their tasks and overdue flags step aside during the episode and come back when it ends.',
          },
          {
            icon: 'solar:flag-linear',
            title: 'Ends on its own',
            description: 'After its last day it closes and moves to the plan’s history. It can be extended or ended early.',
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

      {/* The program and what it pauses have sensible defaults, so they stay folded away. */}
      <CollapsibleSection icon="solar:tuning-2-linear" title="More controls" defaultOpen={false}>
        <div className={styles.moreControls}>
          <Select
            label="Runs as program"
            options={EPISODE_PROGRAM_OPTIONS}
            value={programCode || ''}
            onChange={(code) => set({ programCode: code || null })}
            placeholder="Pick a program"
            helperText="The patient is enrolled in this program for the episode, and its care plan holds the episode. It closes when the episode ends."
          />

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
          {pausesOngoing && (
            <Select
              label="Programs it pauses"
              multiple
              options={PAUSABLE_PROGRAM_OPTIONS}
              value={supersedes}
              onChange={(codes) => set({ supersedes: codes })}
              placeholder="All of the patient’s other programs"
              helperText="Leave empty to pause every other ongoing plan. Other episodes never pause."
            />
          )}
        </div>
      </CollapsibleSection>
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
