/* The Fold clinical protocol: a client's clinical practice guidance as a
   structured object. Shared by the parser (api/_handlers/clinical-protocol-parse.js),
   the JSON importer, the store and the Care Plan Library > Clinical Protocols screens,
   so a protocol means the same thing everywhere. Plain JS, no React.

   Every extracted item carries `source` (the passage it came from, verbatim)
   and `page` when the file had pages, so a reviewer can check it against the
   document before approving. */

export const PROTOCOL_SCHEMA_VERSION = 1;

/** Characters of document text sent to the parser (about 40k tokens). */
export const PROTOCOL_TEXT_MAX = 150000;
/** Largest file the upload accepts (the bucket's limit too). */
export const PROTOCOL_FILE_MAX = 25 * 1024 * 1024;

export const PROTOCOL_STATUSES = [
  { value: 'processing', label: 'Processing', tone: 'grey' },
  { value: 'draft', label: 'Needs Review', tone: 'warning' },
  { value: 'active', label: 'Active', tone: 'success' },
  { value: 'superseded', label: 'Superseded', tone: 'grey' },
  { value: 'retired', label: 'Retired', tone: 'grey' },
  { value: 'failed', label: 'Parse Failed', tone: 'error' },
];
const STATUS_BY_VALUE = Object.fromEntries(PROTOCOL_STATUSES.map(s => [s.value, s]));
export const protocolStatus = (value) => STATUS_BY_VALUE[value] || STATUS_BY_VALUE.draft;

// 'fold': Fold's former built-in protocols, retired by retire_legacy_clinical_protocols.sql.
export const SOURCE_KINDS = ['pdf', 'docx', 'json', 'fold'];

export const COMPARATORS = ['<', '<=', '>', '>=', '=', 'between'];
const COMPARATOR_TEXT = { '<': '<', '<=': '≤', '>': '>', '>=': '≥', '=': '=' };

export const CADENCE_KINDS = [
  { value: 'check_in', label: 'Check-in' },
  { value: 'measurement', label: 'Measurement' },
  { value: 'lab', label: 'Lab' },
  { value: 'visit', label: 'Visit' },
  { value: 'medication_review', label: 'Medication review' },
  { value: 'other', label: 'Other' },
];
export const CADENCE_UNITS = ['day', 'week', 'month', 'year'];

export const TITRATION_ACTIONS = ['start', 'increase', 'decrease', 'add', 'switch', 'hold', 'stop'];

export const REFERENCE_KINDS = [
  { value: 'guideline', label: 'Guideline' },
  { value: 'protocol', label: 'Protocol' },
  { value: 'policy', label: 'Policy' },
  { value: 'order_set', label: 'Order set' },
  { value: 'other', label: 'Other' },
];

// ── Gemini response schema (OpenAPI subset) ──

const sourced = {
  source: { type: 'string' },
  page: { type: 'integer', nullable: true },
  // What a reviewer should check about this one item, or null.
  check: { type: 'string', nullable: true },
};

export const PROTOCOL_PARSE_SCHEMA = {
  type: 'object',
  properties: {
    metadata: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        organization: { type: 'string', nullable: true },
        conditions: { type: 'array', items: { type: 'string' } },
        programCodes: { type: 'array', items: { type: 'string' } },
        effectiveDate: { type: 'string', nullable: true },
        reviewDate: { type: 'string', nullable: true },
        author: { type: 'string', nullable: true },
        version: { type: 'string', nullable: true },
      },
      required: ['title', 'conditions', 'programCodes'],
    },
    summary: { type: 'string' },
    scope: {
      type: 'object',
      properties: {
        conditions: {
          type: 'array',
          items: {
            type: 'object',
            properties: { name: { type: 'string' }, code: { type: 'string', nullable: true } },
            required: ['name'],
          },
        },
        population: { type: 'string', nullable: true },
        exclusions: { type: 'array', items: { type: 'string' } },
      },
      required: ['conditions', 'exclusions'],
    },
    thresholds: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          measure: { type: 'string' },
          comparator: { type: 'string', enum: COMPARATORS },
          value: { type: 'number' },
          value2: { type: 'number', nullable: true },
          unit: { type: 'string', nullable: true },
          label: { type: 'string', nullable: true },
          action: { type: 'string', nullable: true },
          ...sourced,
        },
        required: ['measure', 'comparator', 'value', 'source'],
      },
    },
    decisionRules: {
      type: 'array',
      items: {
        type: 'object',
        properties: { when: { type: 'string' }, then: { type: 'string' }, ...sourced },
        required: ['when', 'then', 'source'],
      },
    },
    cadence: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          activity: { type: 'string' },
          kind: { type: 'string', enum: CADENCE_KINDS.map(k => k.value) },
          times: { type: 'integer' },
          every: { type: 'integer' },
          unit: { type: 'string', enum: CADENCE_UNITS },
          appliesWhen: { type: 'string', nullable: true },
          ...sourced,
        },
        required: ['activity', 'kind', 'times', 'every', 'unit', 'source'],
      },
    },
    titration: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          medication: { type: 'string' },
          drugClass: { type: 'string', nullable: true },
          step: { type: 'integer' },
          action: { type: 'string', enum: TITRATION_ACTIONS },
          dose: { type: 'string', nullable: true },
          criteria: { type: 'string', nullable: true },
          monitoring: { type: 'string', nullable: true },
          ...sourced,
        },
        required: ['medication', 'step', 'action', 'source'],
      },
    },
    crossReferences: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          kind: { type: 'string', enum: REFERENCE_KINDS.map(k => k.value) },
          citation: { type: 'string', nullable: true },
          ...sourced,
        },
        required: ['title', 'kind', 'source'],
      },
    },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['metadata', 'summary', 'scope', 'thresholds', 'decisionRules', 'cadence', 'titration', 'crossReferences', 'warnings'],
};

const clip = (s, n) => (typeof s === 'string' ? s.slice(0, n) : '');

/**
 * The parser prompt. `programs` is [{ code, name }]: the program codes the
 * model may tag (it must not invent others).
 */
export function buildProtocolParsePrompt(text, { programs = [], fileName = '' } = {}) {
  return [
    'You extract structured clinical protocols from clinical practice guidance written by a healthcare organization. A clinical supervisor reviews every item before the protocol is used, and each item is shown next to the passage you quote, so accuracy matters more than coverage.',
    '',
    'Rules:',
    '- Extract only what the document states. Never add clinical knowledge, numbers, drugs, doses or intervals that are not in the text. If a section is not covered, return an empty list.',
    '- Copy every number and unit exactly as written (140 stays 140, mmHg stays mmHg). A range ("130-139") is comparator "between" with value and value2.',
    '- Every item needs `source`: the shortest verbatim passage (under 300 characters) that supports it. `page` is the number from the nearest preceding "[Page N]" marker, or null.',
    '- thresholds: a measured value with a cut-off and what it means or triggers (label, e.g. "Stage 2 hypertension"; action, e.g. "Same-day provider review").',
    '- decisionRules: if/then logic in plain sentences ("when" is the condition, "then" the action).',
    '- cadence: recurring activities (check-ins, measurements, labs, visits, medication reviews) as `times` per `every` `unit`, with appliesWhen if they only apply in some situations. "Twice daily" is times 2, every 1, unit day; "every 2 weeks" is times 1, every 2, unit week; "every 3 to 6 months" uses the shorter interval and says the range in appliesWhen.',
    '- titration: medication steps in order (step 1, 2, 3…). Keep the dose text as written.',
    '- crossReferences: other guidelines, protocols, policies or order sets the document cites.',
    '- metadata: title as the document names itself; organization that issued it; conditions it covers by common clinical name; effectiveDate and reviewDate as YYYY-MM-DD only if stated, else null; author (person or committee) and version only if stated.',
    `- metadata.programCodes: only codes from this list, and only when the document clearly applies to that program: ${JSON.stringify(programs)}. Otherwise an empty list.`,
    '- check: when one item is uncertain (a conflicting value, unclear wording, an apparent typo, a missing cut-off or dose), put one short, plain sentence a nurse can act on (under 160 characters) on that item\'s `check`; otherwise null. Put every concern about a specific item there, not in warnings.',
    '- warnings: only concerns about the document as a whole that belong to no single item (unreadable or truncated text, a table you could not interpret). Each one short, plain sentence, naming the page when you can.',
    '- summary: two plain sentences on what the protocol covers.',
    '',
    `Document${fileName ? ` (${clip(fileName, 200)})` : ''}:`,
    clip(text, PROTOCOL_TEXT_MAX),
  ].join('\n');
}

// ── Normalizing parser output and Fold JSON imports ──

const str = (v, n = 500) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const strOrNull = (v, n = 500) => str(v, n) || null;
const num = (v) => {
  if (v == null || (typeof v === 'string' && !v.trim())) return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};
const int = (v) => {
  const n = num(v);
  return n == null ? null : Math.round(n);
};
const oneOf = (v, allowed, fallback) => (allowed.includes(v) ? v : fallback);
const list = (v) => (Array.isArray(v) ? v : []);
const pageOf = (v) => {
  const n = int(v);
  return n != null && n > 0 ? n : null;
};
const sourceOf = (item) => ({ source: str(item?.source, 600), page: pageOf(item?.page), check: strOrNull(item?.check, 400) });

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
/** A real calendar date as YYYY-MM-DD, else null. */
export function isoDateOrNull(v) {
  const m = ISO_DATE.exec(String(v || '').trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3])
    ? m[0] : null;
}

const uniqueStrings = (values, max, len = 120) => {
  const seen = new Set();
  const out = [];
  for (const v of list(values)) {
    const s = str(v, len);
    if (s && !seen.has(s.toLowerCase())) { seen.add(s.toLowerCase()); out.push(s); }
    if (out.length >= max) break;
  }
  return out;
};

const withIds = (items, prefix) => items.map((x, i) => ({ id: `${prefix}${i + 1}`, ...x }));

function normalizeThreshold(t) {
  const measure = str(t?.measure, 160);
  const value = num(t?.value);
  if (!measure || value == null) return null;
  const comparator = oneOf(t?.comparator, COMPARATORS, '>=');
  const value2 = comparator === 'between' ? num(t?.value2) : null;
  if (comparator === 'between' && value2 == null) return null;
  return {
    measure, comparator, value, value2,
    unit: strOrNull(t?.unit, 40),
    label: strOrNull(t?.label, 160),
    action: strOrNull(t?.action, 400),
    ...sourceOf(t),
  };
}

function normalizeRule(r) {
  const when = str(r?.when, 500);
  const then = str(r?.then, 500);
  return when && then ? { when, then, ...sourceOf(r) } : null;
}

function normalizeCadence(c) {
  const activity = str(c?.activity, 160);
  const every = int(c?.every);
  if (!activity || !every || every < 1) return null;
  return {
    activity,
    kind: oneOf(c?.kind, CADENCE_KINDS.map(k => k.value), 'other'),
    times: Math.max(1, int(c?.times) || 1),
    every,
    unit: oneOf(c?.unit, CADENCE_UNITS, 'week'),
    appliesWhen: strOrNull(c?.appliesWhen, 300),
    ...sourceOf(c),
  };
}

function normalizeTitration(t) {
  const medication = str(t?.medication, 160);
  if (!medication) return null;
  return {
    medication,
    drugClass: strOrNull(t?.drugClass, 120),
    step: Math.max(1, int(t?.step) || 1),
    action: oneOf(t?.action, TITRATION_ACTIONS, 'start'),
    dose: strOrNull(t?.dose, 200),
    criteria: strOrNull(t?.criteria, 400),
    monitoring: strOrNull(t?.monitoring, 400),
    ...sourceOf(t),
  };
}

function normalizeReference(r) {
  const title = str(r?.title, 200);
  if (!title) return null;
  return {
    title,
    kind: oneOf(r?.kind, REFERENCE_KINDS.map(k => k.value), 'other'),
    citation: strOrNull(r?.citation, 400),
    ...sourceOf(r),
  };
}

const keep = (items, fn) => list(items).map(fn).filter(Boolean);

/**
 * Parser output (or a Fold JSON import) → { metadata, protocol, warnings }.
 * Drops items missing what makes them usable, coerces enums and numbers,
 * keeps program codes to `programCodes` and dates to real YYYY-MM-DD.
 */
export function normalizeProtocol(raw, { programCodes = null } = {}) {
  const m = raw?.metadata || {};
  const allowed = programCodes ? new Set(programCodes) : null;
  // Warnings are sentences a reviewer reads in full, not tags.
  const warnings = uniqueStrings(raw?.warnings, 20, 400);

  const metadata = {
    title: str(m.title, 200),
    organization: strOrNull(m.organization, 160),
    conditions: uniqueStrings(m.conditions, 12),
    programCodes: uniqueStrings(m.programCodes, 12).filter(c => !allowed || allowed.has(c)),
    effectiveDate: isoDateOrNull(m.effectiveDate),
    reviewDate: isoDateOrNull(m.reviewDate),
    author: strOrNull(m.author, 160),
    version: strOrNull(m.version, 40),
  };
  if (metadata.reviewDate && metadata.effectiveDate && metadata.reviewDate < metadata.effectiveDate) {
    warnings.push(`Review date ${metadata.reviewDate} is before the effective date; it was cleared.`);
    metadata.reviewDate = null;
  }

  const scope = raw?.scope || {};
  const titration = keep(raw?.titration, normalizeTitration)
    .sort((a, b) => a.medication.localeCompare(b.medication) || a.step - b.step);
  const protocol = {
    schemaVersion: PROTOCOL_SCHEMA_VERSION,
    summary: str(raw?.summary, 1200),
    scope: {
      conditions: list(scope.conditions)
        .map(c => (typeof c === 'string' ? { name: str(c, 160), code: null } : { name: str(c?.name, 160), code: strOrNull(c?.code, 20) }))
        .filter(c => c.name)
        .slice(0, 20),
      population: strOrNull(scope.population, 600),
      exclusions: uniqueStrings(scope.exclusions, 30),
    },
    thresholds: withIds(keep(raw?.thresholds, normalizeThreshold), 't'),
    decisionRules: withIds(keep(raw?.decisionRules, normalizeRule), 'r'),
    cadence: withIds(keep(raw?.cadence, normalizeCadence), 'c'),
    titration: withIds(titration, 'm'),
    crossReferences: withIds(keep(raw?.crossReferences, normalizeReference), 'x'),
  };
  return { metadata, protocol, warnings };
}

/** True for a structured JSON upload already in the Fold protocol shape. */
export const isFoldProtocolJson = (obj) => !!obj && typeof obj === 'object' && obj.foldProtocol === PROTOCOL_SCHEMA_VERSION;

/** A starting point for clients writing protocols as JSON (Download template). */
export function foldProtocolJsonTemplate() {
  return {
    foldProtocol: PROTOCOL_SCHEMA_VERSION,
    metadata: {
      title: 'Hypertension Clinical Practice Guidance',
      organization: 'Your organization',
      conditions: ['Hypertension'],
      programCodes: ['DM'],
      effectiveDate: '2026-01-01',
      reviewDate: '2027-01-01',
      author: 'Clinical Quality Committee',
      version: '1.0',
    },
    summary: 'What the protocol covers, in a sentence or two.',
    scope: { conditions: [{ name: 'Essential hypertension', code: 'I10' }], population: 'Adults 18 and older', exclusions: ['Pregnancy'] },
    thresholds: [{ measure: 'Systolic BP', comparator: '>=', value: 180, unit: 'mmHg', label: 'Hypertensive urgency', action: 'Same-day provider review', source: 'Quote the passage this comes from.', page: 1 }],
    decisionRules: [{ when: 'Two consecutive readings above goal', then: 'Notify the PCP within 2 business days', source: '…', page: 1 }],
    cadence: [
      { activity: 'Care manager check-in', kind: 'check_in', times: 1, every: 2, unit: 'week', appliesWhen: 'Until at goal', source: '…', page: 2 },
      { activity: 'Home BP reading', kind: 'measurement', times: 2, every: 1, unit: 'day', appliesWhen: '7 days before each provider visit', source: '…', page: 2 },
    ],
    titration: [{ medication: 'Lisinopril', drugClass: 'ACE inhibitor', step: 1, action: 'start', dose: '10 mg daily', criteria: 'BP above goal', monitoring: 'BMP in 2 weeks', source: '…', page: 3 }],
    crossReferences: [{ title: '2017 ACC/AHA High Blood Pressure Guideline', kind: 'guideline', citation: 'Hypertension. 2018;71:e13-e115', source: '…', page: 4 }],
    warnings: [],
  };
}

// ── Display ──

const fmtNum = (n) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

/** "Systolic BP ≥ 140 mmHg", "Systolic BP 130–139 mmHg". */
export function formatThreshold(t) {
  const unit = t.unit ? ` ${t.unit}` : '';
  if (t.comparator === 'between') return `${t.measure} ${fmtNum(t.value)}–${fmtNum(t.value2)}${unit}`;
  return `${t.measure} ${COMPARATOR_TEXT[t.comparator] || t.comparator} ${fmtNum(t.value)}${unit}`;
}

const TIMES_WORD = { 1: 'Once', 2: 'Twice' };
const PER_UNIT = { day: 'daily', week: 'weekly', month: 'monthly', year: 'yearly' };
/** "Every 2 weeks", "Every month", "Twice daily", "3 times every 2 weeks". */
export function formatCadence(c) {
  const times = Math.max(1, c.times || 1);
  const span = c.every === 1 ? c.unit : `${c.every} ${c.unit}s`;
  if (times === 1) return `Every ${span}`;
  const count = TIMES_WORD[times] || `${times} times`;
  return c.every === 1 ? `${count} ${PER_UNIT[c.unit]}` : `${count} every ${span}`;
}

/** Characters of protocol guidance a care plan draft request carries. */
export const PROTOCOL_GUIDANCE_MAX = 8000;

/**
 * A protocol as plain guidance lines for the care plan template drafter:
 * scope, thresholds, decision rules, cadence and titration, most useful
 * first, clipped to `max` characters on a line boundary.
 */
export function protocolGuidanceText(protocol, { max = PROTOCOL_GUIDANCE_MAX } = {}) {
  const p = protocol || {};
  const lines = [];
  if (p.summary) lines.push(`Summary: ${p.summary}`);
  const scope = p.scope || {};
  const conditions = list(scope.conditions).map(c => (c.code ? `${c.name} (${c.code})` : c.name));
  if (conditions.length) lines.push(`Conditions: ${conditions.join('; ')}`);
  if (scope.population) lines.push(`Population: ${scope.population}`);
  if (list(scope.exclusions).length) lines.push(`Exclusions: ${scope.exclusions.join('; ')}`);
  const section = (title, items, fmt) => {
    if (!list(items).length) return;
    lines.push('', `${title}:`);
    for (const x of items) lines.push(`- ${fmt(x)}`);
  };
  section('Thresholds', p.thresholds, t => [formatThreshold(t), t.label, t.action].filter(Boolean).join(' | '));
  section('Decision rules', p.decisionRules, r => `When ${r.when}, then ${r.then}`);
  section('Cadence', p.cadence, c => [`${formatCadence(c)}: ${c.activity}`, c.appliesWhen].filter(Boolean).join(' | '));
  section('Medication titration', [...list(p.titration)].sort((a, b) => a.step - b.step),
    m => [`Step ${m.step} ${m.action} ${m.medication}`, m.dose, m.criteria].filter(Boolean).join(' | '));
  let out = '';
  for (const line of lines) {
    if (out.length + line.length + 1 > max) break;
    out += `${out ? '\n' : ''}${line}`;
  }
  return out;
}

/** Item counts per section, for list rows and review badges. */
export function protocolCounts(protocol) {
  const p = protocol || {};
  const counts = {
    thresholds: list(p.thresholds).length,
    decisionRules: list(p.decisionRules).length,
    cadence: list(p.cadence).length,
    titration: list(p.titration).length,
    crossReferences: list(p.crossReferences).length,
  };
  return { ...counts, total: Object.values(counts).reduce((a, b) => a + b, 0) };
}

// ── Rows ──

export function rowToProtocol(r) {
  return {
    id: r.id,
    title: r.title,
    organization: r.organization || '',
    conditions: r.condition_tags || [],
    programCodes: r.program_codes || [],
    effectiveDate: r.effective_date || null,
    reviewDate: r.review_date || null,
    author: r.author || '',
    version: r.version || '',
    status: r.status || 'draft',
    sourceKind: r.source_kind || null,
    sourceName: r.source_name || '',
    sourcePath: r.source_path || null,
    sourceSize: r.source_size || null,
    protocol: r.protocol || {},
    parseMeta: r.parse_meta || {},
    parseError: r.parse_error || null,
    supersedesId: r.supersedes_id || null,
    uploadedBy: r.uploaded_by || '',
    approvedBy: r.approved_by || '',
    approvedAt: r.approved_at || null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Metadata + protocol fields → columns (source text and file columns are written separately). */
export function protocolToRow(p) {
  return {
    title: p.title,
    organization: p.organization || null,
    condition_tags: p.conditions || [],
    program_codes: p.programCodes || [],
    effective_date: p.effectiveDate || null,
    review_date: p.reviewDate || null,
    author: p.author || null,
    version: p.version || null,
    status: p.status,
    protocol: p.protocol || {},
    parse_meta: p.parseMeta || {},
    parse_error: p.parseError || null,
    supersedes_id: p.supersedesId || null,
  };
}
