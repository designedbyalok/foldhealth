import { useRef, useState } from 'react';
import { Drawer } from '../../../../../components/Drawer/Drawer';
import { Button } from '../../../../../components/Button/Button';
import { SegmentedControl } from '../../../../../components/SegmentedControl/SegmentedControl';
import { Badge } from '../../../../../components/Badge/Badge';
import { Icon } from '../../../../../components/Icon/Icon';
import { Select } from '../../../../../components/Select/Select';
import { Switch } from '../../../../../components/Switch/Switch';
import { Input } from '../../../../../components/Input/Input';
import { DatePicker } from '../../../../../components/DatePicker/DatePicker';
import { MenuPopover } from '../../../../../components/MenuPopover/MenuPopover';
import { Tooltip } from '../../../../../components/Tooltip/Tooltip';
import { INTERVENTION_EDITORS } from '../../interventions';
import { AddInterventionsDrawer } from '../../interventions/AddInterventionsDrawer';
import { AddBarriersDrawer } from '../../barriers/AddBarriersDrawer/AddBarriersDrawer';
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
      // Nutrient targets: simple, action-oriented labels so goals read
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
  // No Others entry: the measure row is hidden for Others so a free-
  // form target is authored instead. `measureCfg` falls back to
  // GOAL_CATEGORIES[0] (`Vitals`) if the map is ever consulted, but
  // isOther gates every consumer of that config.
};

// Chronic conditions come from the NLM Clinical Table Search Service, a
// public terminology lookup. Only the typed search term leaves the app; no
// patient data is sent.
// Select takes { value, label } pairs, plain strings render blank rows.
const asOptions = (list) => (list || []).map(v => ({ value: v, label: v }));

/* Lab and assessment names run long, they need a wider field. */
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

/* Figma 14109:303516, the intervention types a goal can link to. */
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

// "execute after", the due offset, compacted to 7d / 2w.
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
 * Create New Goals: Figma Care-Plan-Creation 14109:299594.
 * Category → measure → chronic condition → title, with the goal's priority
 * picked from a segment inside the title field.
 */
export function CreateGoalDrawer({ onClose, onSave, goal }) {
  const [category, setCategory] = useState(() => normalizeCategory(goal?.category));
  const [measure, setMeasure] = useState(goal?.measure || '');
  const [conditions, setConditions] = useState(goal?.conditions || []);
  const [title, setTitle] = useState(goal?.title || '');
  const [priority, setPriority] = useState(goal?.priority || 'medium');
  const [comparator, setComparator] = useState(goal?.comparator || '=');
  const [targetValue, setTargetValue] = useState(goal?.targetValue || '');
  const [targetValue2, setTargetValue2] = useState(goal?.targetValue2 || '');
  // Vitals authors an Initial Value alongside the Target Value when
  // Set Target is on: the shipped baseline the goal starts from.
  // Kept as two slots so a dual measure (Blood Pressure, Height) can
  // capture both parts the same way targetValue2 handles the target
  // side. Other categories don't collect this today.
  const [initialValue, setInitialValue] = useState(goal?.initialValue || '');
  const [initialValue2, setInitialValue2] = useState(goal?.initialValue2 || '');
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
  // Height carries multiple valid unit systems (Ft/In, cm, m). The
  // Vitals two-up renders a dropdown on the trailing unit segment so
  // the reviewer can flip between them; the pick reshapes the field
  // between the dual Ft/In layout and the single cm / m layout.
  const [heightUnit, setHeightUnit] = useState(goal?.heightUnit || 'Ft/In');
  const [heightUnitOpen, setHeightUnitOpen] = useState(false);
  const heightUnitRef = useRef(null);
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
  // The "+" opens the library picker; the kind menu it used to open now
  // lives inside that picker's New Intervention.
  const [addInterventionsOpen, setAddInterventionsOpen] = useState(false);
  // The barriers "+" picks from the library; the inline input stays for
  // renaming a staged row.
  const [addBarriersOpen, setAddBarriersOpen] = useState(false);
  // Row-level editing: which row's priority menu is open, and which row's
  // title is in its text-field state.
  const [priorityMenuFor, setPriorityMenuFor] = useState(null);
  const [interventionEditing, setInterventionEditing] = useState(null);
  const [interventionDraft, setInterventionDraft] = useState('');
  // { kind, index }, index null while adding, a row index while editing.
  const [interventionDrawer, setInterventionDrawer] = useState(null);
  const durationUnitRef = useRef(null);
  const priorityRef = useRef(null);

  const measureCfg = MEASURES[category] || MEASURES[GOAL_CATEGORIES[0]];
  // Others (formerly 'Other') is the catch-all bucket: it hides the
  // measure picker and the measure-driven target-value fields, letting
  // the goal author enter a free-form target instead.
  const isOther = category === 'Others' || category === 'Other';
  // Assessment goals complete-or-not against a named instrument, so the
  // only structured thing to author is the Target Date the completion
  // is expected by. Everything else (Set Target, Current Value, Target
  // Value, Duration, Frequency) is hidden.
  const isAssessment = category === 'Assessment';
  // Vitals uses the dedicated Initial Value + Target Value two-up
  // reveal (Figma reference) and keeps Duration + Frequency + Target
  // Date visible even when Set Target is off, because those two
  // define the cadence the goal tracks against regardless of a
  // named baseline / target.
  const isVitals = category === 'Vitals';
  const isHeight = measure === 'Height';
  const HEIGHT_UNITS = ['Ft/In', 'cm', 'm'];
  // Height carries multiple valid unit systems. The base MEASURE_CONFIG
  // entry is dual Ft/in, but the reviewer picks between Ft/In (dual),
  // cm (single), and m (single) via the trailing unit dropdown. Every
  // downstream helper (twoValues, units, placeholders, separator) then
  // reads from this override instead of the raw config so the two-up
  // reshapes itself around the chosen unit.
  const heightCfgOverride = isHeight
    ? (heightUnit === 'Ft/In'
        ? { dual: true, units: ['Ft', 'in'], placeholders: ['Ft', 'in'], separator: '/' }
        : heightUnit === 'cm'
          ? { unit: 'cm', placeholder: 'Enter height' }
          : { unit: 'm', placeholder: 'Enter height' })
    : null;
  const cfg = heightCfgOverride || MEASURE_CONFIG[measure] || {};
  // "between" also needs a second field, labelled as a range rather than as
  // the measure's own second part (e.g. Height's Ft / in).
  const isRange = comparator === 'between';
  const twoValues = Boolean(cfg.dual) || isRange;
  // Others types the unit by hand, and a goal saved under Others can still
  // carry a measure from an earlier category, so that measure's config must
  // not supply a unit of its own on top of the typed one.
  const units = isOther ? ['', ''] : cfg.dual ? cfg.units : [cfg.unit || '', cfg.unit || ''];
  const placeholders = cfg.dual
    ? cfg.placeholders
    : isRange ? ['From', 'To'] : [cfg.placeholder || 'Enter Value', cfg.placeholder || 'Enter Value'];
  const separator = cfg.dual ? (cfg.separator || '/') : 'and';
  // For the Vitals two-up (Initial + Target) we render one merged
  // input per side even when the measure is dual (Blood Pressure,
  // Height). The user types "120/80" and we split on save; visually
  // this reads exactly like the Figma reference where "Sys/Dia" is
  // a single field with a single mmHg trailing. When the underlying
  // placeholder is generic ("Enter Value"), fall back to the unit
  // labels so the dual placeholder reads as "Ft/in" instead of
  // "Enter/Enter".
  const SHORT_DUAL_PLACEHOLDER = {
    'Systolic BP': 'Sys',
    'Diastolic BP': 'Dia',
  };
  const isGenericPh = (p) => !p || /^Enter\b/i.test(p);
  const shortenDualPh = (p) => SHORT_DUAL_PLACEHOLDER[p] || (p || '').split(' ')[0];
  const dualPlaceholder = twoValues
    ? (isGenericPh(placeholders[0]) && isGenericPh(placeholders[1])
        ? `${units[0]}${separator}${units[1]}`
        : `${shortenDualPh(placeholders[0])}${separator}${shortenDualPh(placeholders[1])}`)
    : placeholders[0];
  // Sanitize whatever the user types into a dual-value input into
  // "<digits>[<separator><digits>]", non-digit characters (letters,
  // punctuation) are stripped, and each half is capped so the pair
  // stays inside a realistic Blood Pressure / Height envelope. First 3
  // digits ⇒ part A (systolic / feet), remainder up to 3 digits ⇒
  // part B (diastolic / inches). The separator auto-inserts itself
  // when the user rolls past 3 digits so they don't have to type it.
  const DUAL_MAX_PER_PART = 3;
  const splitDualDigits = (raw) => {
    const digits = String(raw ?? '').replace(/\D/g, '').slice(0, DUAL_MAX_PER_PART * 2);
    const a = digits.slice(0, DUAL_MAX_PER_PART);
    const b = digits.slice(DUAL_MAX_PER_PART);
    return { a, b };
  };
  const composeDualDisplay = (a, b) => {
    if (twoValues && !cfg.stepper && (a || b)) {
      // Once the first part is full, keep the separator visible even
      // if the reviewer hasn't started the second half yet, so the
      // "/" reads as a boundary and hints at how many more digits are
      // expected.
      if (b) return `${a}${separator}${b}`;
      if ((a || '').length >= DUAL_MAX_PER_PART) return `${a}${separator}`;
      return a;
    }
    return [a, b].filter(v => v && String(v).length).join(separator);
  };
  const mergedInitial = twoValues
    ? composeDualDisplay(initialValue, initialValue2)
    : initialValue;
  const mergedTarget = twoValues
    ? composeDualDisplay(targetValue, targetValue2)
    : targetValue;
  const commitMergedInitial = (raw) => {
    if (!twoValues) { setInitialValue(raw); return; }
    const { a, b } = splitDualDigits(raw);
    setInitialValue(a);
    setInitialValue2(b);
  };
  const commitMergedTarget = (raw) => {
    if (!twoValues) { setTargetValue(raw); return; }
    const { a, b } = splitDualDigits(raw);
    setTargetValue(a);
    setTargetValue2(b);
  };
  // A goal is valid when it names WHAT it tracks (a measure for the structured
  // types; "Other" tracks via a typed unit) and, when a target is set, the
  // value(s) that target needs: so saved goals are structured, not blank.
  const hasMeasure = isOther || measure.trim().length > 0;
  // Others and Assessment carry no target value, so the gate collapses
  // to "always valid" for those buckets. Every other category still
  // enforces a filled target when the Set Target switch is on.
  const hasTargetValue = isOther || isAssessment || !setTarget || (
    targetValue.trim().length > 0 && (!twoValues || targetValue2.trim().length > 0)
  );
  // Vitals requires both baseline and target when Set Target is on, a
  // goal like "Blood Pressure < 120/80 mmHg" is only actionable when
  // the current reading is captured too.
  const hasInitialValue = !isVitals || !setTarget || (
    initialValue.trim().length > 0 && (!twoValues || initialValue2.trim().length > 0)
  );
  const canSave = title.trim().length > 0 && hasMeasure && hasTargetValue && hasInitialValue;

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
    if (barriers.some((b, i) => i !== barrierEditing
      && b.title.trim().toLowerCase() === text.toLowerCase())) return;
    setBarriers(prev => (barrierEditing === 'new'
      ? [...prev, { kind: 'barrier', title: text, config: {} }]
      : prev.map((b, i) => (i === barrierEditing ? { ...b, title: text } : b))));
    cancelBarrier();
  };

  // Same name as one already staged on this goal, excluding the row being
  // edited, which is allowed to keep its own title.
  const duplicateBarrier = barriers.some((b, i) => i !== barrierEditing
    && b.title.trim().toLowerCase() === barrierDraft.trim().toLowerCase())
    && barrierDraft.trim().length > 0;

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
      placeholder={`Add New Barriers (${TITLE_MAX} characters max)`}
      aria-label="Add New Barriers"
      maxLength={TITLE_MAX}
      errorText={duplicateBarrier
        ? 'A barrier with this name already exists'
        : (barrierDraft.length >= TITLE_MAX
          ? `Character limit reached - ${TITLE_MAX}/${TITLE_MAX}`
          : undefined)}
      trailingText={barrierDraft.trim() ? 'Enter to Save' : 'Esc to Cancel'}
    />
  );

  const headerRight = (
    <>
      <Button
        disabled={!canSave}
        onClick={() => onSave?.({ category, measure, conditions, title: title.trim(), priority, comparator, targetValue, targetValue2, initialValue, initialValue2, customUnit, setTarget, duration, durationUnit, frequency, targetDate, heightUnit: isHeight ? heightUnit : undefined, interventions: [...interventions, ...barriers] })}
      >
        Save
      </Button>
      <span className={styles.headerDivider} />
    </>
  );

  return (
    <Drawer title={goal ? 'Edit Goal' : 'Create New Goals'} onClose={onClose} headerRight={headerRight} noCloseDivider>
      <div className={styles.body}>
        <SegmentedControl
          size="sm"
          className={styles.categoryToggle}
          items={GOAL_CATEGORIES}
          value={category}
          onValueChange={(next) => { setCategory(next); setMeasure(''); }}
        />

        {!isOther && (
        <div className={styles.measureRow}>
          <Select
            options={asOptions(measureCfg.options)}
            value={measure}
            onValueChange={setMeasure}
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
          {/* Priority sits inside the field, divided from the text input,
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

        {/* Others has no predefined measure but still authors a target, the
            value is free text with a typed unit. Assessment goes the other
            way: no target value at all, only the date the instrument should
            be completed by. */}
        {!isAssessment && (
          <Switch checked={setTarget} onChange={setSetTarget} label="Set Target" />
        )}

        {/* Current Value read-only placeholder: used by every structured
            category except Vitals. Vitals author an editable Initial
            Value inside the Set Target reveal below instead. */}
        {!isOther && !isAssessment && !isVitals && (
        <div className={styles.field}>
          <Input label="Current Value" value="" disabled placeholder="No initial value found" />
        </div>
        )}

        {/* Vitals reveal on Set Target = on, Initial Value + Target
            Value share one row (Figma reference). Each column carries
            the same trailing-unit chrome the single-column Target Value
            uses, so a dual measure like Blood Pressure still splits
            into Systolic / Diastolic on each side. Height's trailing
            unit is a dropdown that switches between Ft/In (dual), cm
            and m (both single-value) so the reviewer picks the system
            they measured in. */}
        {isVitals && setTarget && (() => {
          // Trailing unit for the Height dropdown, same visual as the
          // Duration unit chevron. Non-Height measures reuse the
          // regular unit string.
          const heightTrigger = isHeight ? (
            <button
              ref={heightUnitRef}
              type="button"
              className={styles.unitTrigger}
              aria-haspopup="menu"
              aria-expanded={heightUnitOpen}
              onClick={() => setHeightUnitOpen(v => !v)}
            >
              {heightUnit}
              <DownChevronIcon size={14} color="var(--neutral-300)" />
            </button>
          ) : null;
          const trailing = heightTrigger || units[0] || undefined;
          const trailingSegment = Boolean(heightTrigger) || Boolean(units[0]);
          return (
        <div className={styles.twoUp}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>
              Initial Value<span className={styles.mandatoryDot} aria-hidden="true" />
            </span>
            <div className={styles.targetRow}>
              {cfg.kind === 'select' ? (
                <Select
                  options={asOptions(cfg.options)}
                  value={initialValue}
                  onValueChange={setInitialValue}
                  placeholder="Select Value"
                  className={styles.valueSelect}
                />
              ) : (
                /* One merged input even for dual measures, the user
                   types "120/80" and the string is split on the
                   configured separator on commit so the underlying
                   `initialValue` / `initialValue2` state contract
                   stays intact for downstream code. Placeholder
                   collapses to "Sys/Dia" (or the first-word slice
                   for unknown duals) so the field reads compactly
                   in a two-column column. */
                <span className={styles.dualInput}>
                  <Input
                    value={mergedInitial}
                    onChange={e => commitMergedInitial(e.target.value)}
                    placeholder={dualPlaceholder}
                    trailingText={trailing}
                    trailingTextSegment={trailingSegment}
                    type={!twoValues && cfg.stepper ? 'number' : undefined}
                    inputMode="decimal"
                    aria-label={`Initial ${dualPlaceholder}`}
                  />
                </span>
              )}
            </div>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>
              Target Value<span className={styles.mandatoryDot} aria-hidden="true" />
            </span>
            <div className={styles.targetRow}>
              <Select
                options={asOptions(COMPARATORS)}
                value={comparator}
                onValueChange={setComparator}
                className={twoValues ? styles.comparatorCompact : styles.comparator}
              />
              {cfg.kind === 'select' ? (
                <Select
                  options={asOptions(cfg.options)}
                  value={targetValue}
                  onValueChange={setTargetValue}
                  placeholder="Select Value"
                  className={styles.valueSelect}
                />
              ) : (
                <span className={styles.dualInput}>
                  <Input
                    value={mergedTarget}
                    onChange={e => commitMergedTarget(e.target.value)}
                    placeholder={dualPlaceholder}
                    trailingText={trailing}
                    trailingTextSegment={trailingSegment}
                    type={!twoValues && cfg.stepper ? 'number' : undefined}
                    inputMode="decimal"
                    aria-label={dualPlaceholder}
                  />
                </span>
              )}
            </div>
          </div>
          {isHeight && heightUnitOpen && (
            <MenuPopover
              anchorRef={heightUnitRef}
              align="right"
              width={140}
              ariaLabel="Height unit"
              items={HEIGHT_UNITS.map(u => ({ key: u, label: u }))}
              onSelect={(next) => {
                setHeightUnit(next);
                // Clear the dual second half when switching to a
                // single-value unit: it would otherwise ride along
                // as a stale digit stored under initialValue2 /
                // targetValue2 that nothing renders.
                if (next !== 'Ft/In') { setInitialValue2(''); setTargetValue2(''); }
                setHeightUnitOpen(false);
              }}
              onClose={() => setHeightUnitOpen(false)}
            />
          )}
        </div>
          );
        })()}

        {/* Legacy single-column Target Value: every non-Vitals,
            non-Assessment category still uses this shape. */}
        {!isAssessment && !isVitals && setTarget && (
        <div className={styles.field}>
          <span className={styles.fieldLabel}>
            Target Value<span className={styles.mandatoryDot} aria-hidden="true" />
          </span>
          <div className={styles.targetRow}>
            <Select
              options={asOptions(COMPARATORS)}
              value={comparator}
              onValueChange={setComparator}
              className={styles.comparator}
            />
            {cfg.kind === 'select' ? (
              <Select
                options={asOptions(cfg.options)}
                value={targetValue}
                onValueChange={setTargetValue}
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
              // The unit is typed here: "Other" has no predefined measure.
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

        {/* Duration + Frequency: always visible for Vitals since those
            two define the cadence the goal tracks against regardless
            of a target being set. Every other category still reveals
            them only when Set Target is on. Assessment hides them. */}
        {!isAssessment && (setTarget || isVitals) && (
        <div className={styles.twoUp}>
          <div className={styles.field}>
            {/* One field: the unit is the trailing segment, same treatment as
                the mmHg suffix, but it opens a picker. */}
            <Input
              label="Target Duration"
              required
              value={duration}
              onChange={e => setDuration(e.target.value.replace(/\D/g, ''))}
              placeholder="Enter Target Duration"
              inputMode="numeric"
              aria-label="Target Duration"
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
            {/* Caption reads the Duration back as a relative date so
                the reviewer sees, in the moment, what "3 Months" or
                "1 Week" will resolve to once the Care Plan is signed.
                Mirrors the way the intervention Due Date summarises
                `dueOffset` + `dueUnit`. */}
            <span className={styles.durationHint}>
              {duration
                ? `${duration} ${Number(duration) === 1
                    ? durationUnit.toLowerCase()
                    : `${durationUnit.toLowerCase()}s`} after Care Plan creation date`
                : 'After Care Plan creation date'}
            </span>
          </div>

          <div className={styles.field}>
            <Select
              label="Frequency"
              required
              options={asOptions(FREQUENCIES)}
              value={frequency}
              onValueChange={setFrequency}
            />
          </div>
        </div>
        )}

        {/* Assessment goals still need a concrete deadline (they don't
            author a Target Duration), so keep the DatePicker there.
            Every other structured category derives its Target Date
            from Care Plan sign date + Target Duration, same rule the
            intervention Due Date uses, so no separate date field is
            authored here. */}
        {isAssessment && (
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
                      && <Badge size="sm" label={String(interventions.length)} />}
                    {sec.key === 'barriers' && barriers.length > 0
                      && <Badge size="sm" label={String(barriers.length)} />}
                  </span>
                  <ActionButton
                    size="sm"
                    tooltip={sec.addTooltip}
                    onClick={sec.key === 'interventions'
                      ? () => setAddInterventionsOpen(true)
                      : sec.key === 'barriers'
                        ? () => setAddBarriersOpen(true)
                        : undefined}
                  >
                    <AddIconMinimalist size={16} color="var(--neutral-300)" />
                  </ActionButton>
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
                            {/* Reads as a cell, not a control, it only names
                                the intervention kind. */}
                            <Button
                              variant="ghost"
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
                                  size="sm"
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
                  /* The very first barrier is just the field, the white card
                     only earns its place once there is a list to hold. */
                  <div className={barriers.length === 0 ? undefined : styles.linkedList}>
                    {barriers.map((b, i) => (barrierEditing === i ? (
                      <div key={`edit-${i}`}>{barrierInput}</div>
                    ) : (
                      <div key={`${b.title}-${i}`} className={styles.linkedRow}>
                        {/* Only the label opens the editor, the row also
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
                                size="sm"
                                icon="solar:link-minimalistic-linear"
                                label={String(b.config.linkCount)}
                              />
                              <span className={styles.headerDivider} />
                            </>
                          )}
                          <ActionButton
                            icon="solar:trash-bin-minimalistic-linear"
                            size="sm"
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
      {addBarriersOpen && (
        <AddBarriersDrawer
          existingBarriers={barriers}
          primaryLabel="Add to Goal"
          onClose={() => setAddBarriersOpen(false)}
          onAdd={(picked) => {
            const staged = new Set(barriers.map(b => b.title.trim().toLowerCase()));
            const fresh = (picked || []).filter(b => !staged.has((b.title || '').trim().toLowerCase()));
            if (fresh.length) {
              setBarriers(prev => [
                ...prev,
                ...fresh.map(b => ({ kind: 'barrier', title: b.title, config: {} })),
              ]);
            }
            setAddBarriersOpen(false);
          }}
        />
      )}

      {addInterventionsOpen && (
        <AddInterventionsDrawer
          primaryLabel="Add to Goal"
          onClose={() => setAddInterventionsOpen(false)}
          onAdd={(picked) => {
            picked.forEach(i => addIntervention(i.kind, i.title, { description: i.description || '' }));
            setAddInterventionsOpen(false);
          }}
        />
      )}

      {interventionDrawer && (() => {
        const Editor = INTERVENTION_EDITORS[interventionDrawer.kind];
        if (!Editor) return null;
        const editing = interventionDrawer.index !== null;
        return (
          <Editor
            kind={interventionDrawer.kind}
            taskTemplate
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
