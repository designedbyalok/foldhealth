/**
 * Validated clinical instruments: locked Health Components.
 *
 * Each instrument is published, evidence-based screening content: fixed items,
 * fixed per-option point values, and fixed interpretation cutoffs. Dropping one
 * onto the canvas adds its fields AND registers its score + critical triggers,
 * all marked `locked: true` so the points/cutoffs can't be edited in the UI.
 *
 * ⚠ CLINICAL CONTENT: verify against the cited source before production use.
 * Cutoffs are asserted in validatedInstruments.test.js (the review trail).
 *
 * Scoring uses explicit per-option scores (no reverse-score mechanic), so
 * reverse-scored instruments are encoded by assigning the reversed values
 * directly to each option.
 */
import { AGGREGATION, MISSING_POLICY, SEVERITY, OPERATOR, ACTION_TYPE } from '../scoring/types';

// Standard 0–3 frequency scale shared by PHQ/GAD families.
const FREQ_0_3 = [
  { value: 'Not at all', score: 0 },
  { value: 'Several days', score: 1 },
  { value: 'More than half the days', score: 2 },
  { value: 'Nearly every day', score: 3 },
];

const PHQ_INSTRUCTION = 'Over the last 2 weeks, how often have you been bothered by any of the following problems?';

export const INSTRUMENTS = [
  {
    key: 'phq9',
    label: 'PHQ-9 (Depression)',
    icon: 'solar:face-scan-circle-linear',
    source: 'Kroenke K, Spitzer RL, Williams JBW. J Gen Intern Med. 2001;16(9):606-613.',
    instruction: PHQ_INSTRUCTION,
    responseOptions: FREQ_0_3,
    items: [
      { code: 'q1', text: 'Little interest or pleasure in doing things' },
      { code: 'q2', text: 'Feeling down, depressed, or hopeless' },
      { code: 'q3', text: 'Trouble falling or staying asleep, or sleeping too much' },
      { code: 'q4', text: 'Feeling tired or having little energy' },
      { code: 'q5', text: 'Poor appetite or overeating' },
      { code: 'q6', text: 'Feeling bad about yourself: or that you are a failure or have let yourself or your family down' },
      { code: 'q7', text: 'Trouble concentrating on things, such as reading the newspaper or watching television' },
      { code: 'q8', text: 'Moving or speaking so slowly that other people could have noticed, or the opposite, being so fidgety or restless that you have been moving around a lot more than usual' },
      { code: 'q9', text: 'Thoughts that you would be better off dead, or of hurting yourself in some way' },
    ],
    score: {
      label: 'PHQ-9 Total',
      aggregation: AGGREGATION.SUM,
      interpretations: [
        { min: 0, max: 4, label: 'Minimal', severity: SEVERITY.NEUTRAL },
        { min: 5, max: 9, label: 'Mild', severity: SEVERITY.INFO },
        { min: 10, max: 14, label: 'Moderate', severity: SEVERITY.WARNING },
        { min: 15, max: 19, label: 'Moderately severe', severity: SEVERITY.HIGH },
        { min: 20, max: 27, label: 'Severe', severity: SEVERITY.CRITICAL },
      ],
    },
    critical: [{
      code: 'q9',
      condition: { operator: OPERATOR.GT, value: 0 },
      alert: 'Positive response to self-harm item (Q9): assess suicide risk immediately.',
      severity: SEVERITY.CRITICAL,
      actions: [{ type: ACTION_TYPE.FLAG, label: 'Suicide risk', severity: SEVERITY.CRITICAL }],
    }],
  },

  {
    key: 'phq2',
    label: 'PHQ-2 (Depression screen)',
    icon: 'solar:face-scan-circle-linear',
    source: 'Kroenke K, Spitzer RL, Williams JBW. Med Care. 2003;41(11):1284-1292.',
    instruction: PHQ_INSTRUCTION,
    responseOptions: FREQ_0_3,
    items: [
      { code: 'q1', text: 'Little interest or pleasure in doing things' },
      { code: 'q2', text: 'Feeling down, depressed, or hopeless' },
    ],
    score: {
      label: 'PHQ-2 Total',
      aggregation: AGGREGATION.SUM,
      interpretations: [
        { min: 0, max: 2, label: 'Negative screen', severity: SEVERITY.NEUTRAL },
        { min: 3, max: 6, label: 'Positive: administer PHQ-9', severity: SEVERITY.WARNING },
      ],
    },
  },

  {
    key: 'gad7',
    label: 'GAD-7 (Anxiety)',
    icon: 'solar:wind-linear',
    source: 'Spitzer RL, Kroenke K, Williams JBW, Löwe B. Arch Intern Med. 2006;166(10):1092-1097.',
    instruction: PHQ_INSTRUCTION,
    responseOptions: FREQ_0_3,
    items: [
      { code: 'g1', text: 'Feeling nervous, anxious, or on edge' },
      { code: 'g2', text: 'Not being able to stop or control worrying' },
      { code: 'g3', text: 'Worrying too much about different things' },
      { code: 'g4', text: 'Trouble relaxing' },
      { code: 'g5', text: "Being so restless that it's hard to sit still" },
      { code: 'g6', text: 'Becoming easily annoyed or irritable' },
      { code: 'g7', text: 'Feeling afraid, as if something awful might happen' },
    ],
    score: {
      label: 'GAD-7 Total',
      aggregation: AGGREGATION.SUM,
      interpretations: [
        { min: 0, max: 4, label: 'Minimal', severity: SEVERITY.NEUTRAL },
        { min: 5, max: 9, label: 'Mild', severity: SEVERITY.INFO },
        { min: 10, max: 14, label: 'Moderate', severity: SEVERITY.WARNING },
        { min: 15, max: 21, label: 'Severe', severity: SEVERITY.HIGH },
      ],
    },
  },

  {
    key: 'gad2',
    label: 'GAD-2 (Anxiety screen)',
    icon: 'solar:wind-linear',
    source: 'Kroenke K, Spitzer RL, Williams JBW, et al. Ann Intern Med. 2007;146(5):317-325.',
    instruction: PHQ_INSTRUCTION,
    responseOptions: FREQ_0_3,
    items: [
      { code: 'g1', text: 'Feeling nervous, anxious, or on edge' },
      { code: 'g2', text: 'Not being able to stop or control worrying' },
    ],
    score: {
      label: 'GAD-2 Total',
      aggregation: AGGREGATION.SUM,
      interpretations: [
        { min: 0, max: 2, label: 'Negative screen', severity: SEVERITY.NEUTRAL },
        { min: 3, max: 6, label: 'Positive: administer GAD-7', severity: SEVERITY.WARNING },
      ],
    },
  },

  {
    key: 'auditc',
    label: 'AUDIT-C (Alcohol use)',
    icon: 'custom:social-history',
    source: 'Bush K, Kivlahan DR, McDonell MB, et al. Arch Intern Med. 1998;158(16):1789-1795.',
    instruction: 'The following questions are about your use of alcoholic beverages over the past year.',
    // AUDIT-C uses per-item response sets, so options live on each item.
    items: [
      { code: 'c1', text: 'How often do you have a drink containing alcohol?', options: [
        { value: 'Never', score: 0 }, { value: 'Monthly or less', score: 1 },
        { value: '2–4 times a month', score: 2 }, { value: '2–3 times a week', score: 3 },
        { value: '4 or more times a week', score: 4 },
      ] },
      { code: 'c2', text: 'How many standard drinks containing alcohol do you have on a typical day when you are drinking?', options: [
        { value: '1 or 2', score: 0 }, { value: '3 or 4', score: 1 }, { value: '5 or 6', score: 2 },
        { value: '7 to 9', score: 3 }, { value: '10 or more', score: 4 },
      ] },
      { code: 'c3', text: 'How often do you have six or more drinks on one occasion?', options: [
        { value: 'Never', score: 0 }, { value: 'Less than monthly', score: 1 }, { value: 'Monthly', score: 2 },
        { value: 'Weekly', score: 3 }, { value: 'Daily or almost daily', score: 4 },
      ] },
    ],
    score: {
      label: 'AUDIT-C Total',
      aggregation: AGGREGATION.SUM,
      // Sex-specific cutoffs apply (≥4 men, ≥3 women); bands use the more
      // sensitive ≥3 threshold and note this, confirm against local policy.
      interpretations: [
        { min: 0, max: 2, label: 'Low risk', severity: SEVERITY.NEUTRAL },
        { min: 3, max: 12, label: 'Positive: at-risk drinking (≥3 women / ≥4 men)', severity: SEVERITY.WARNING },
      ],
    },
  },
];

// ── instantiation (pure) ─────────────────────────────────────────────────────
let _iid = 0;
const iid = () => `vi${(_iid++).toString(36)}`;

function buildField(inst) {
  const items = [];
  if (inst.instruction) {
    items.push({ linkId: iid(), type: 'display', control: 'paragraph', text: inst.instruction, locked: true });
  }
  for (const it of inst.items) {
    items.push({
      linkId: iid(),
      type: 'choice',
      control: 'radio',
      text: it.text,
      required: true,
      code: it.code,
      instrument: inst.key,
      locked: true,
      options: (it.options || inst.responseOptions).map((o) => ({ ...o })),
    });
  }
  return {
    linkId: iid(),
    type: 'group',
    text: inst.label,
    instrument: inst.key,
    validated: true,
    locked: true,
    source: inst.source,
    items,
  };
}

function computeRange(field) {
  let min = 0;
  let max = 0;
  for (const it of field.items) {
    if (!it.code || !it.options) continue;
    const scores = [];
    for (const o of it.options) {
      if (typeof o.score === 'number') scores.push(o.score);
    }
    if (scores.length) { min += Math.min(...scores); max += Math.max(...scores); }
  }
  return { min, max };
}

/**
 * Returns a ready-to-drop instance: id-assigned `field` (a locked group) plus
 * the `score` and `criticalTriggers` to merge into the form's scoring. Ids are
 * unique per instance so the same instrument can be dropped twice.
 */
export function instantiateInstrument(inst) {
  const field = buildField(inst);
  const instanceId = field.linkId;
  const codeToLinkId = {};
  for (const it of field.items) if (it.code) codeToLinkId[it.code] = it.linkId;

  const score = {
    id: `${inst.key}_${instanceId}`,
    label: inst.score.label,
    aggregation: inst.score.aggregation,
    missingPolicy: MISSING_POLICY.EXCLUDE,
    locked: true,
    instrument: inst.key,
    sources: inst.items.map((it) => ({ linkId: codeToLinkId[it.code] })),
    range: computeRange(field),
    interpretations: inst.score.interpretations.map((b) => ({ ...b })),
  };

  const criticalTriggers = (inst.critical || []).map((c) => ({
    id: `${inst.key}_${c.code}_${instanceId}`,
    linkId: codeToLinkId[c.code],
    condition: { ...c.condition },
    alert: c.alert,
    severity: c.severity,
    locked: true,
    actions: c.actions ? c.actions.map((a) => ({ ...a })) : undefined,
  }));

  return { field, score, criticalTriggers };
}

/**
 * An instrument's questions (and its instruction) as locked fields with fixed
 * linkIds, for a host that renders it outside a form and needs stable answer
 * keys: the Social History drawer renders AUDIT-C this way.
 *
 * @param {string} key          – The instrument's key, e.g. 'auditc'
 * @param {object} linkIdByCode – { [item code]: linkId }
 */
export function instrumentFields(key, linkIdByCode) {
  const inst = INSTRUMENTS.find((i) => i.key === key);
  return buildField(inst).items.map((it) => ({ ...it, linkId: it.code ? linkIdByCode[it.code] : `${key}_instruction` }));
}

/** Palette entries for the validated instruments (rendered in Health tab). */
export function validatedPaletteEntries() {
  return INSTRUMENTS.map((inst) => ({
    key: `validated:${inst.key}`,
    label: inst.label,
    icon: inst.icon,
    validated: true,
    instrument: inst,
  }));
}
