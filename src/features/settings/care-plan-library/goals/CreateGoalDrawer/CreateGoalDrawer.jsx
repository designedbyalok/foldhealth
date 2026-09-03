import { useRef, useState } from 'react';
import { Drawer } from '../../../../../components/Drawer/Drawer';
import { Button } from '../../../../../components/Button/Button';
import { Toggle } from '../../../../../components/Toggle/Toggle';
import { Badge } from '../../../../../components/Badge/Badge';
import { Icon } from '../../../../../components/Icon/Icon';
import { Select } from '../../../../../components/Select/Select';
import { Switch } from '../../../../../components/Switch/Switch';
import { Input } from '../../../../../components/Input/Input';
import { DatePicker } from '../../../../../components/DatePicker/DatePicker';
import { MenuPopover } from '../../../../../components/MenuPopover/MenuPopover';
import { Tooltip } from '../../../../../components/Tooltip/Tooltip';
import { INTERVENTION_EDITORS } from '../../interventions';
import { Link } from '../../../../../components/Link/Link';
import { ActionButton } from '../../../../../components/ActionButton/ActionButton';
import { AddIconMinimalist } from '../../../../../components/Icon/AddIconMinimalist';
import { DownChevronIcon } from '../../../../../components/Icon/DownChevronIcon';
import { PriorityIcon } from '../../../../../components/PriorityIcon/PriorityIcon';
import { VITAL_OPTIONS } from '../../lib/vitalOptions';
import { ChronicConditionSelect } from '../../shared';
import { MEASURE_CONFIG } from '../../lib/goalFormat';
import { GOAL_CATEGORIES, normalizeCategory } from '../../lib/goalCategories';
import styles from './CreateGoalDrawer.module.css';

// Per-measure target-value shape:
//   unit        single trailing unit segment
//   dual        two value fields; `units` / `placeholders` give each its own
//   kind:select the value is chosen from a list rather than typed
//   stepper     numeric spinner (Body Temperature)
// A measure with none of these is a plain number with no unit.

// The measure picker's label and options follow the chosen category.
const MEASURES = {
  Vitals: {
    label: 'Select Vital',
    options: VITAL_OPTIONS,
  },
  Exercise: {
    label: 'Select Exercise',
    options: ['Steps', 'Calories', 'Duration', 'Aerobics', 'Strength Training', 'Cycling',
      'Swimming', 'Yoga', 'Walking', 'Running'],
  },
  Labs: {
    label: 'Select Lab',
    options: [
      'LDL Cholesterol', 'HDL Cholesterol', 'Total Cholesterol', 'Triglycerides',
      'Hemoglobin A1c', 'Estim. Avg Glu (eAG)', 'Glucose, Fasting', 'Glucose, 1 hour',
      'Glucose, 2 hour', 'Glucose, 3 hour', 'eGFR', 'Creatinine', 'Fructosamine',
      'Microalbumin (urine)', 'Urine Protein', 'TSH', 'T3', 'T4', 'Vitamin D',
      'Vitamin B12', 'Ferritin', 'Iron, Serum', 'CBC', 'Basic Metabolic Panel',
      'Comprehensive Metabolic Panel', 'PT/INR',
    ],
  },
  Diet: {
    label: 'Select Diet Measure',
    options: [
      // Nutrient targets — simple, action-oriented labels so goals read
      // as "Consume calories …", "Maintain sodium …" instead of the
      // clinical "Calorie Intake" phrasing.
      'Calories', 'Sodium', 'Carbohydrates', 'Protein', 'Fiber', 'Water',
      'Fruits & Vegetables', 'Sugar', 'Saturated Fat',
      // Body-composition outcomes commonly tracked as diet goals.
      'BMI', 'Weight',
      // Adherence-pattern goals.
      'DASH Adherence', 'Mediterranean Adherence',
    ],
  },
  Assessment: {
    label: 'Select Assessment',
    options: [
      'Annual Wellness Visit', 'Preventive Screening', 'Fall Risk Assessment',
      'Immunization Review', 'Advance Care Planning',
    ],
  },
  // No Others entry — the measure row is hidden for Others so a free-
  // form target is authored instead. `measureCfg` falls back to
  // GOAL_CATEGORIES[0] (`Vitals`) if the map is ever consulted, but
  // isOther gates every consumer of that config.
};

// Chronic conditions come from the NLM Clinical Table Search Service — a
// public terminology lookup. Only the typed search term leaves the app; no
// patient data is sent.
// Select takes { value, label } pairs — plain strings render blank rows.
const asOptions = (list) => (list || []).map(v => ({ value: v, label: v }));

/* Lab and assessment names run long — they need a wider field. */
const WIDE_MEASURE_CATEGORIES = ['Labs', 'Assessment'];

const COMPARATORS = ['=', '<', '<=', '>', '>=', 'between'];
const DURATION_UNITS = ['Day', 'Week', 'Month', 'Year'];
const FREQUENCIES = ['Daily', 'Weekly', 'Monthly', 'Quarterly'];

// Linked Items sub-sections (Figma 14506:194349). Icons follow the glyphs the
// rest of the app already uses for each concept.
const LINKED_SECTIONS = [
  { key: 'interventions', label: 'Interventions', addTooltip: 'Add New Intervention' },
  { key: 'barriers', label: 'Barriers', addTooltip: 'Add Barriers' },
  { key: 'automations', label: 'Automations', addTooltip: 'Add Automations' },
];

/* Figma 14109:303516 — the intervention types a goal can link to. */
const INTERVENTION_ITEMS = [
  { key: 'send-form', label: 'Send Form', icon: 'solar:document-add-linear' },
  { key: 'patient-education', label: 'Patient Education', icon: 'solar:book-2-linear' },
  { key: 'patient-task', label: 'Patient Task', icon: 'solar:checklist-minimalistic-linear' },
  { key: 'measure-vital', label: 'Measure Vital', icon: 'solar:heart-pulse-linear' },
  { divider: true },
  { key: 'internal-task', label: 'Internal Task', icon: 'solar:clipboard-check-linear' },
];

// Kind → the row's leading button, keyed off the menu the row came from.
const INTERVENTION_LABELS = Object.fromEntries(
  INTERVENTION_ITEMS.filter(i => i.key).map(i => [i.key, { label: i.label, icon: i.icon }]),
);

// "execute after" — the due offset, compacted to 7d / 2w.
function dueBadgeLabel(config) {
  if (!config?.dueOffset) return '';
  return `${config.dueOffset}${(config.dueUnit || 'day')[0]}`;
}

// Titles across the library share one ceiling.
const TITLE_MAX = 150;

const UNIT_WORDS = { day: 'Days', week: 'Weeks', month: 'Months', year: 'Years' };

function dueTooltip(config) {
  if (!config?.dueOffset) return null;
  const unit = UNIT_WORDS[config.dueUnit] || 'Days';
  const timing = config.creationTiming;
  const immediate = !timing || timing === 'immediate';
  return {
    primary: `Executes After ${config.dueOffset} ${unit}`,
    secondary: immediate
      ? 'Occurs Immediately'
      : `Occurs Every ${timing.charAt(0).toUpperCase()}${timing.slice(1)}`,
    // "Occurs Immediately" reads as part of the statement, not an aside.
    secondaryMuted: !immediate,
  };
}

const PRIORITIES = [
  { key: 'high', label: 'High' },
  { key: 'medium', label: 'Medium' },
  { key: 'low', label: 'Low' },
];

/**
 * Create New Goals — Figma Care-Plan-Creation 14109:299594.
 * Category → measure → chronic condition → title, with the goal's priority
 * picked from a segment inside the title field.
 */
export function CreateGoalDrawer({ onClose, onSave, goal }) {
  const [category, setCategory] = useState(normalizeCategory(goal?.category));
  const [measure, setMeasure] = useState(goal?.measure || '');
  const [conditions, setConditions] = useState(goal?.conditions || []);
  const [title, setTitle] = useState(goal?.title || '');
  const [priority, setPriority] = useState(goal?.priority || 'medium');
  const [comparator, setComparator] = useState(goal?.comparator || '=');
  const [targetValue, setTargetValue] = useState(goal?.targetValue || '');
  const [targetValue2, setTargetValue2] = useState(goal?.targetValue2 || '');
  const [duration, setDuration] = useState(goal?.duration || '');
  const [durationUnit, setDurationUnit] = useState(goal?.durationUnit || 'Month');
  const [frequency, setFrequency] = useState(goal?.frequency || 'Daily');
  const [targetDate, setTargetDate] = useState(goal?.targetDate || '');
  // "Other" has no predefined measure: the unit is typed and the whole target
  // block is behind a Set Target switch (Figma 14510:196321).
  const [customUnit, setCustomUnit] = useState(goal?.customUnit || '');
  const [setTarget, setSetTarget] = useState(goal ? goal.setTarget !== false : true);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [durationUnitOpen, setDurationUnitOpen] = useState(false);
  // Interventions are staged here and written with the goal, because a new
  // goal has no id to hang them off until it is saved.
  const [interventions, setInterventions] = useState(
    () => (goal?.interventions || []).filter(i => i.kind !== 'barrier'),
  );
  const [barriers, setBarriers] = useState(
    () => (goal?.interventions || []).filter(i => i.kind === 'barrier'),
  );
  const [barrierDraft, setBarrierDraft] = useState('');
  const [barrierEditing, setBarrierEditing] = useState(null);
  const [interventionMenuOpen, setInterventionMenuOpen] = useState(false);
  // Row-level editing: which row's priority menu is open, and which row's
  // title is in its text-field state.
  const [priorityMenuFor, setPriorityMenuFor] = useState(null);
  const [interventionEditing, setInterventionEditing] = useState(null);
  const [interventionDraft, setInterventionDraft] = useState('');
  // { kind, index } — index null while adding, a row index while editing.
  const [interventionDrawer, setInterventionDrawer] = useState(null);
  const durationUnitRef = useRef(null);
  const priorityRef = useRef(null);
  const interventionAddRef = useRef(null);

  const measureCfg = MEASURES[category] || MEASURES[GOAL_CATEGORIES[0]];
  // Others (formerly 'Other') is the catch-all bucket — it hides the
  // measure picker and the measure-driven target-value fields, letting
  // the goal author enter a free-form target instead.
  const isOther = category === 'Others' || category === 'Other';
  // Assessment goals complete-or-not against a named instrument, so the
  // only structured thing to author is the Target Date the completion
  // is expected by. Everything else (Set Target, Current Value, Target
  // Value, Duration, Frequency) is hidden.
  const isAssessment = category === 'Assessment';
  const cfg = MEASURE_CONFIG[measure] || {};
  // "between" also needs a second field, labelled as a range rather than as
  // the measure's own second part (e.g. Height's Ft / in).
  const isRange = comparator === 'between';
  const twoValues = Boolean(cfg.dual) || isRange;
  const units = cfg.dual ? cfg.units : [cfg.unit || '', cfg.unit || ''];
  const placeholders = cfg.dual
    ? cfg.placeholders
    : isRange ? ['From', 'To'] : ['Enter Value', 'Enter Value'];
  const separator = cfg.dual ? (cfg.separator || '/') : 'and';
  // A goal is valid when it names WHAT it tracks (a measure for the structured
  // types; "Other" tracks via a typed unit) and, when a target is set, the
  // value(s) that target needs — so saved goals are structured, not blank.
  const hasMeasure = isOther || measure.trim().length > 0;
  // Others and Assessment carry no target value, so the gate collapses
  // to "always valid" for those buckets. Every other category still
  // enforces a filled target when the Set Target switch is on.
  const hasTargetValue = isOther || isAssessment || !setTarget || (
    targetValue.trim().length > 0 && (!twoValues || targetValue2.trim().length > 0)
  );
  const canSave = title.trim().length > 0 && hasMeasure && hasTargetValue;

  const updateIntervention = (index, patch) => {
    setInterventions(prev => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  const commitInterventionTitle = () => {
    if (interventionEditing === null) return;
    updateIntervention(interventionEditing, { title: interventionDraft.trim() });
    setInterventionEditing(null);
  };

  const addIntervention = (kind, itemTitle, config) => {
    setInterventions(prev => [...prev, { kind, title: itemTitle || '', config: config || {} }]);
  };

  const cancelBarrier = () => { setBarrierEditing(null); setBarrierDraft(''); };
  const removeBarrier = (index) => setBarriers(prev => prev.filter((_, i) => i !== index));
  const editBarrier = (index) => {
    setBarrierEditing(index);
    setBarrierDraft(index === 'new' ? '' : barriers[index].title);
  };
  const saveBarrier = () => {
    const text = barrierDraft.trim();
    if (!text) { cancelBarrier(); return; }
    setBarriers(prev => (barrierEditing === 'new'
      ? [...prev, { kind: 'barrier', title: text, config: {} }]
      : prev.map((b, i) => (i === barrierEditing ? { ...b, title: text } : b))));
    cancelBarrier();
  };

  const barrierInput = (
    <Input
      autoFocus
      value={barrierDraft}
      onChange={e => setBarrierDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') { e.preventDefault(); cancelBarrier(); }
        if (e.key === 'Enter') { e.preventDefault(); saveBarrier(); }
      }}
      onBlur={() => (barrierDraft.trim() ? saveBarrier() : cancelBarrier())}
      placeholder="Add New Barriers"
      aria-label="Add New Barriers"
      maxLength={TITLE_MAX}
      characterLimit={TITLE_MAX}
      trailingText={barrierDraft.trim() ? 'Enter to Save' : 'Esc to Cancel'}
    />
  );

  const headerRight = (
    <>
      <Button
        variant="primary"
        size="L"
        disabled={!canSave}
        onClick={() => onSave?.({ category, measure, conditions, title: title.trim(), priority, comparator, targetValue, targetValue2, customUnit, setTarget, duration, durationUnit, frequency, targetDate, interventions: [...interventions, ...barriers] })}
      >
        Save
      </Button>
      <span className={styles.headerDivider} />
    </>
  );

  return (
    <Drawer title={goal ? 'Edit Goal' : 'Create New Goals'} onClose={onClose} headerRight={headerRight} noCloseDivider>
      <div className={styles.body}>
        <Toggle
          size="S"
          className={styles.categoryToggle}
          items={GOAL_CATEGORIES}
          active={category}
          onChange={(next) => { setCategory(next); setMeasure(''); }}
        />

        {!isOther && (
        <div className={styles.measureRow}>
          <Select
            options={asOptions(measureCfg.options)}
            value={measure}
            onChange={setMeasure}
            placeholder={measureCfg.label}
            className={`${styles.measureSelect} ${WIDE_MEASURE_CATEGORIES.includes(category) ? styles.measureSelectWide : ''}`}
            searchable
            searchPlaceholder={measureCfg.label}
          />
        </div>
        )}

        <div className={styles.field}>
          <ChronicConditionSelect value={conditions} onChange={setConditions} />
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>
            Goal Title<span className={styles.mandatoryDot} aria-hidden="true" />
          </span>
          {/* Priority sits inside the field, divided from the text input —
              the design treats it as one control, not two. */}
          <div className={styles.titleField}>
            <button
              ref={priorityRef}
              type="button"
              className={styles.priorityTrigger}
              aria-label={`Priority: ${priority}`}
              onClick={() => setPriorityOpen(v => !v)}
            >
              <PriorityIcon priority={priority} size={16} />
              <DownChevronIcon size={10} color="var(--neutral-300)" />
            </button>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Enter the Goal Title"
              aria-label="Goal Title"
              maxLength={TITLE_MAX}
              characterLimit={TITLE_MAX}
              className={styles.titleInput}
              wrapperClassName={styles.titleInputWrap}
            />
          </div>
          {priorityOpen && (
            <MenuPopover
              anchorRef={priorityRef}
              align="left"
              width={140}
              ariaLabel="Goal priority"
              items={PRIORITIES.map(p => ({
                key: p.key,
                label: p.label,
                iconElement: <PriorityIcon priority={p.key} size={16} />,
              }))}
              onSelect={setPriority}
              onClose={() => setPriorityOpen(false)}
            />
          )}
        </div>

        {/* Others is a free-form catch-all — no measure, no target value,
            so the Set Target toggle and the target block are hidden. Only
            Duration + Frequency stay so the goal still has a timebox.
            Assessment goes further — it hides Set Target, Current Value,
            Target Value, Duration and Frequency. Only the Target Date the
            instrument should be completed by is authored. */}
        {!isOther && !isAssessment && (
          <Switch checked={setTarget} onChange={setSetTarget} label="Set Target" />
        )}

        {!isOther && !isAssessment && (
        <div className={styles.field}>
          <Input label="Current Value" value="" disabled placeholder="No initial value found" />
        </div>
        )}

        {!isOther && !isAssessment && setTarget && (
        <div className={styles.field}>
          <span className={styles.fieldLabel}>
            Target Value<span className={styles.mandatoryDot} aria-hidden="true" />
          </span>
          <div className={styles.targetRow}>
            <Select
              options={asOptions(COMPARATORS)}
              value={comparator}
              onChange={setComparator}
              className={styles.comparator}
            />
            {cfg.kind === 'select' ? (
              <Select
                options={asOptions(cfg.options)}
                value={targetValue}
                onChange={setTargetValue}
                placeholder="Select Value"
                className={styles.valueSelect}
              />
            ) : (
              <Input
                value={targetValue}
                onChange={e => setTargetValue(e.target.value)}
                placeholder={placeholders[0]}
                trailingText={units[0] || undefined}
                trailingTextSegment={Boolean(units[0])}
                type={cfg.stepper ? 'number' : undefined}
                inputMode={cfg.stepper ? undefined : 'decimal'}
                aria-label={placeholders[0]}
              />
            )}
            {isOther && (
              // The unit is typed here — "Other" has no predefined measure.
              <Input
                value={customUnit}
                onChange={e => setCustomUnit(e.target.value)}
                placeholder="Enter Unit"
                aria-label="Unit"
              />
            )}
            {!isOther && twoValues && cfg.kind !== 'select' && (
              <>
                <span className={styles.targetSlash}>{separator}</span>
                <Input
                  value={targetValue2}
                  onChange={e => setTargetValue2(e.target.value)}
                  placeholder={placeholders[1]}
                  trailingText={units[1] || undefined}
                  trailingTextSegment={Boolean(units[1])}
                  inputMode="decimal"
                  aria-label={placeholders[1]}
                />
              </>
            )}
          </div>
        </div>
        )}

        {/* Duration + Frequency stays visible for Others too — those are
            the only structured fields that category exposes. Assessment
            hides them entirely (only Target Date is authored). */}
        {(isOther || setTarget) && !isAssessment && (
        <div className={styles.twoUp}>
          <div className={styles.field}>
            {/* One field — the unit is the trailing segment, same treatment as
                the mmHg suffix, but it opens a picker. */}
            <Input
              label="Duration"
              required
              value={duration}
              onChange={e => setDuration(e.target.value.replace(/\D/g, ''))}
              placeholder="Enter Duration"
              inputMode="numeric"
              aria-label="Duration"
              trailingTextSegment
              trailingText={(
                <button
                  ref={durationUnitRef}
                  type="button"
                  className={styles.unitTrigger}
                  aria-haspopup="menu"
                  aria-expanded={durationUnitOpen}
                  onClick={() => setDurationUnitOpen(v => !v)}
                >
                  {durationUnit}
                  <DownChevronIcon size={14} color="var(--neutral-300)" />
                </button>
              )}
            />
            {durationUnitOpen && (
              <MenuPopover
                anchorRef={durationUnitRef}
                align="right"
                width={140}
                ariaLabel="Duration unit"
                items={DURATION_UNITS.map(u => ({ key: u, label: u }))}
                onSelect={setDurationUnit}
                onClose={() => setDurationUnitOpen(false)}
              />
            )}
          </div>

          <div className={styles.field}>
            <Select
              label="Frequency"
              required
              options={asOptions(FREQUENCIES)}
              value={frequency}
              onChange={setFrequency}
            />
          </div>
        </div>
        )}

        {/* Target Date shows for every structured category except Others,
            and is the ONLY authored field for Assessment. */}
        {((!isOther && setTarget) || isAssessment) && (
        <div className={styles.field}>
          <div className={styles.targetDate}>
            <DatePicker label="Target Date" value={targetDate} onSelect={setTargetDate} />
          </div>
        </div>
        )}

        <Link className={styles.addRule}>
          <AddIconMinimalist size={14} color="currentColor" />
          Add Rule
        </Link>

        <div className={styles.linkedItems}>
          <span className={styles.sectionTitle}>Linked Items</span>
          <div className={styles.linkedCard}>
            {LINKED_SECTIONS.map(sec => (
              <div key={sec.key} className={styles.linkedSection}>
                <div className={styles.linkedHead}>
                  <span className={styles.linkedLabel}>
                    {sec.label}
                    {sec.key === 'interventions' && interventions.length > 0
                      && <Badge tone="grey" size="S" label={String(interventions.length)} />}
                    {sec.key === 'barriers' && barriers.length > 0
                      && <Badge tone="grey" size="S" label={String(barriers.length)} />}
                  </span>
                  <ActionButton
                    ref={sec.key === 'interventions' ? interventionAddRef : undefined}
                    size="S"
                    tooltip={sec.addTooltip}
                    aria-haspopup={sec.key === 'interventions' ? 'menu' : undefined}
                    aria-expanded={sec.key === 'interventions' ? interventionMenuOpen : undefined}
                    onClick={sec.key === 'interventions'
                      ? () => setInterventionMenuOpen(v => !v)
                      : sec.key === 'barriers'
                        ? () => editBarrier('new')
                        : undefined}
                  >
                    <AddIconMinimalist size={16} color="var(--neutral-300)" />
                  </ActionButton>
                  {sec.key === 'interventions' && interventionMenuOpen && (
                    <MenuPopover
                      anchorRef={interventionAddRef}
                      align="right"
                      width={200}
                      ariaLabel="Add intervention"
                      items={INTERVENTION_ITEMS}
                      onSelect={(key) => {
                        setInterventionMenuOpen(false);
                        setInterventionDrawer({ kind: key, index: null });
                      }}
                      onClose={() => setInterventionMenuOpen(false)}
                    />
                  )}
                </div>
                {sec.key === 'interventions' && interventions.length > 0 && (
                  <div className={styles.interventionList}>
                    {interventions.map((it, i) => {
                      const kind = INTERVENTION_LABELS[it.kind] || { label: it.kind, icon: 'solar:clipboard-check-linear' };
                      const due = dueBadgeLabel(it.config);
                      const tip = dueTooltip(it.config);
                      return (
                        <div
                          key={`${it.kind}-${i}`}
                          className={`${styles.interventionRow} ${INTERVENTION_EDITORS[it.kind] ? styles.interventionRowClickable : ''}`}
                          role={INTERVENTION_EDITORS[it.kind] ? 'button' : undefined}
                          tabIndex={INTERVENTION_EDITORS[it.kind] ? 0 : undefined}
                          onClick={() => INTERVENTION_EDITORS[it.kind]
                            && setInterventionDrawer({ kind: it.kind, index: i })}
                          onKeyDown={(e) => {
                            if ((e.key === 'Enter' || e.key === ' ') && INTERVENTION_EDITORS[it.kind]) {
                              e.preventDefault();
                              setInterventionDrawer({ kind: it.kind, index: i });
                            }
                          }}
                        >
                          <button
                            type="button"
                            className={styles.interventionPriority}
                            aria-label={`Priority: ${it.config?.priority || 'Medium'}`}
                            aria-haspopup="menu"
                            aria-expanded={priorityMenuFor?.index === i}
                            onClick={(e) => { e.stopPropagation(); setPriorityMenuFor(
                              priorityMenuFor?.index === i
                                ? null
                                : { index: i, rect: e.currentTarget.getBoundingClientRect() },
                            ); }}
                          >
                            <PriorityIcon priority={it.config?.priority?.toLowerCase() || 'medium'} size={16} />
                          </button>
                          <span className={styles.interventionKind}>
                            {/* Reads as a cell, not a control — it only names
                                the intervention kind. */}
                            <Button
                              variant="ghost"
                              size="L"
                              leadingIcon={kind.icon}
                              className={styles.interventionKindLabel}
                            >
                              {kind.label}
                            </Button>
                          </span>
                          {interventionEditing === i ? (
                            <span className={styles.interventionText}>
                              <Input
                                value={interventionDraft}
                                onChange={e => setInterventionDraft(e.target.value)}
                                onBlur={commitInterventionTitle}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') commitInterventionTitle();
                                  if (e.key === 'Escape') setInterventionEditing(null);
                                }}
                                aria-label="Intervention name"
                                maxLength={TITLE_MAX}
                                characterLimit={TITLE_MAX}
                                autoFocus
                              />
                            </span>
                          ) : (
                            <button
                              type="button"
                              className={`${styles.interventionText} ${styles.interventionTextButton}`}
                              onClick={(e) => { e.stopPropagation(); setInterventionEditing(i); setInterventionDraft(it.title); }}
                            >
                              <span className={styles.interventionTextInner}>{it.title}</span>
                            </button>
                          )}
                          <span className={styles.interventionActions} onClick={e => e.stopPropagation()}>
                            {!due && <span className={styles.interventionNoDue}>-</span>}
                            {due && (
                              <Tooltip
                                align="right"
                                label={tip && (
                                  <span className={styles.dueTooltip}>
                                    <span>{tip.primary}</span>
                                    <span className={tip.secondaryMuted ? styles.dueTooltipSecondary : undefined}>{tip.secondary}</span>
                                  </span>
                                )}
                              >
                                <Badge
                                  tone="grey"
                                  size="S"
                                  label={due}
                                  trailingIcon="solar:refresh-linear"
                                />
                              </Tooltip>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {sec.key === 'interventions' && priorityMenuFor && (
                  <MenuPopover
                    anchorRect={priorityMenuFor.rect}
                    align="left"
                    width={140}
                    ariaLabel="Intervention priority"
                    items={PRIORITIES.map(p => ({
                      key: p.key,
                      label: p.label,
                      iconElement: <PriorityIcon priority={p.key} size={16} />,
                    }))}
                    onSelect={(key) => {
                      const picked = PRIORITIES.find(p => p.key === key);
                      updateIntervention(priorityMenuFor.index, {
                        config: { ...interventions[priorityMenuFor.index].config, priority: picked?.label || key },
                      });
                      setPriorityMenuFor(null);
                    }}
                    onClose={() => setPriorityMenuFor(null)}
                  />
                )}
                {sec.key === 'barriers' && (barriers.length > 0 || barrierEditing !== null) && (
                  /* The very first barrier is just the field — the white card
                     only earns its place once there is a list to hold. */
                  <div className={barriers.length === 0 ? undefined : styles.linkedList}>
                    {barriers.map((b, i) => (barrierEditing === i ? (
                      <div key={`edit-${i}`}>{barrierInput}</div>
                    ) : (
                      <div key={`${b.title}-${i}`} className={styles.linkedRow}>
                        {/* Only the label opens the editor — the row also
                            carries its own actions, which can't nest here. */}
                        <button
                          type="button"
                          className={styles.linkedRowMain}
                          onClick={() => editBarrier(i)}
                        >
                          <Icon name="custom:barrier" size={16} color="var(--neutral-300)" />
                          <span className={styles.linkedRowLabel}>{b.title}</span>
                        </button>
                        <span className={styles.linkedRowActions}>
                          {(b.config?.linkCount || 0) > 0 && (
                            <>
                              <Badge
                                tone="grey"
                                size="S"
                                icon="solar:link-minimalistic-linear"
                                label={String(b.config.linkCount)}
                              />
                              <span className={styles.headerDivider} />
                            </>
                          )}
                          <ActionButton
                            icon="solar:trash-bin-minimalistic-linear"
                            size="S"
                            tooltip="Delete"
                            onClick={() => removeBarrier(i)}
                          />
                        </span>
                      </div>
                    )))}
                    {barrierEditing === 'new' && barrierInput}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      {interventionDrawer && (() => {
        const Editor = INTERVENTION_EDITORS[interventionDrawer.kind];
        if (!Editor) return null;
        const editing = interventionDrawer.index !== null;
        return (
          <Editor
            kind={interventionDrawer.kind}
            intervention={editing ? interventions[interventionDrawer.index]?.config : undefined}
            onClose={() => setInterventionDrawer(null)}
            onSave={(config) => {
              if (editing) {
                updateIntervention(interventionDrawer.index, { title: config.title, config });
              } else {
                addIntervention(interventionDrawer.kind, config.title, config);
              }
              setInterventionDrawer(null);
            }}
          />
        );
      })()}
    </Drawer>
  );
}
