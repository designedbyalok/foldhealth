/**
 * Seed the "New OB Intake" form.
 *
 * Sent automatically at scheduling for new OB patients. Uses the Fold form
 * builder schema (see src/features/forms/builder/componentCatalog.js):
 *   - type:    'string'|'text'|'boolean'|'choice'|'integer'|'date'|'display'|'group'
 *   - control: 'radio'|'checkbox'|'dropdown'|'consent'|'email'|'tel'|'paragraph'
 *   - options: [{ value, score? }] for choice types
 *
 * Idempotent: re-running upserts by form name.
 *
 * Run:
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed_ob_intake_form.js
 */
import { createClient } from '@supabase/supabase-js';

const PROJECT_REF      = 'osnihfqqrcchsaqhagcx';
const SUPABASE_URL     = `https://${PROJECT_REF}.supabase.co`;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const FORM_NAME = 'New OB Intake';

const opt = (value, score) => (score == null ? { value } : { value, score });

const items = [
  {
    linkId: 'ob_lmp',
    type: 'date',
    text: 'Last menstrual period',
    description: 'Calculates estimated due date.',
    required: true,
  },
  {
    linkId: 'ob_prior_pregnancies',
    type: 'choice',
    control: 'dropdown',
    text: 'Prior pregnancies and outcomes',
    description: 'Gravida / Para with outcome detail. If more than one, pick the closest match, we\'ll capture the rest on the next visit.',
    required: true,
    options: [
      opt('G0 P0: first pregnancy'),
      opt('G1 P0: one prior, no live births'),
      opt('G1 P1: one prior live birth'),
      opt('G2 P1: two prior, one live birth'),
      opt('G2 P2: two prior live births'),
      opt('G3+ P2+: three or more prior pregnancies'),
      opt('Prior miscarriage or loss'),
      opt('Prior termination'),
    ],
  },
  {
    linkId: 'ob_history',
    type: 'choice',
    control: 'checkbox',
    repeats: true,
    text: 'Personal or pregnancy history',
    description: 'Select all that apply: flags feed risk stratification instantly.',
    required: false,
    options: [
      opt('Type 1 or Type 2 diabetes'),
      opt('Gestational diabetes (prior pregnancy)'),
      opt('Chronic hypertension'),
      opt('Preeclampsia (prior pregnancy)'),
      opt('Preterm birth (prior pregnancy)'),
      opt('Thyroid disorder'),
      opt('Bleeding or clotting disorder'),
      opt('None of the above'),
    ],
  },
  {
    linkId: 'ob_medications',
    type: 'text',
    text: 'Current medications',
    description: 'Include prescription, over-the-counter, and supplements. Reconciled against the chart at your first visit.',
    placeholder: 'One per line: name, dose, frequency',
    required: false,
  },
  {
    linkId: 'ob_mood',
    type: 'choice',
    control: 'radio',
    text: 'How are you feeling about this pregnancy?',
    description: '0 = very worried or overwhelmed · 10 = very positive. Scores into mood screening.',
    required: true,
    options: [
      opt('0: very worried', 0),
      opt('1', 1),
      opt('2', 2),
      opt('3', 3),
      opt('4', 4),
      opt('5: mixed', 5),
      opt('6', 6),
      opt('7', 7),
      opt('8', 8),
      opt('9', 9),
      opt('10: very positive', 10),
    ],
  },
  {
    linkId: 'ob_insurance',
    type: 'string',
    text: 'Insurance member ID',
    description: 'Photograph the front of your insurance card in the patient app to auto-fill, OCR extracts the member ID for eligibility. You can also type it in.',
    placeholder: 'Member ID',
    required: false,
  },
  {
    linkId: 'ob_consent',
    type: 'boolean',
    control: 'consent',
    text: 'Consent to treat and communicate',
    consentLabel: 'I consent to treatment and to Fold Health communicating with me by phone, text, email, and secure message. I also authorize my partner to access shared pregnancy updates.',
    required: true,
  },
];

const schema = { items };

const scoring = {
  scores: [
    {
      id: 'ob_mood_score',
      label: 'Prenatal mood screening',
      aggregation: 'SUM',
      missingPolicy: 'exclude',
      sources: [{ linkId: 'ob_mood' }],
      range: { min: 0, max: 10 },
      interpretations: [
        { min: 0, max: 3, label: 'High concern: flag for outreach', severity: 'high' },
        { min: 4, max: 6, label: 'Mixed: offer perinatal support resources', severity: 'warning' },
        { min: 7, max: 10, label: 'Positive', severity: 'info' },
      ],
    },
  ],
  criticalTriggers: [],
};

const settings = {
  layout: 'sectioned',
  header: { enabled: true, title: FORM_NAME, subtitle: 'Sent automatically at scheduling' },
  footer: { enabled: false },
  start: { enabled: true, title: 'Welcome', description: 'A few questions before your first OB visit, takes about 3 minutes.', buttonLabel: 'Start' },
  end:   { enabled: true, title: 'Thank you', description: 'We\'ll review your responses before your visit.' },
};

async function main() {
  console.log(`Seeding form "${FORM_NAME}"…`);

  const { data: existing, error: findErr } = await supabase
    .from('forms')
    .select('id')
    .eq('name', FORM_NAME)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(1);

  if (findErr) {
    console.error('✗ Lookup failed:', findErr.message);
    process.exit(1);
  }

  const payload = {
    name: FORM_NAME,
    description: 'Sent automatically at scheduling: captures LMP, obstetric history, medications, mood, insurance, and consent so the first visit is ready to run.',
    category: 'OB',
    status: 'active',
    schema,
    scoring,
    settings,
  };

  if (existing && existing.length) {
    const id = existing[0].id;
    const { error } = await supabase.from('forms').update(payload).eq('id', id);
    if (error) { console.error('✗ Update failed:', error.message); process.exit(1); }
    console.log(`✓ Updated existing form (id=${id})`);
  } else {
    const { data, error } = await supabase.from('forms').insert(payload).select('id').single();
    if (error) { console.error('✗ Insert failed:', error.message); process.exit(1); }
    console.log(`✓ Inserted new form (id=${data.id})`);
  }
}

main();
