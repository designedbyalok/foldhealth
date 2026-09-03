// One-off generator for the care-plan template library seed.
// Composes 50 templates out of the EXISTING goal / intervention / barrier
// libraries — no new clinical text is invented here.
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { CARE_PLAN_GOAL_LIBRARY as GOALS } from '../src/features/settings/care-plan-library/data/carePlanGoalLibrarySeed.js';
import { CARE_PLAN_INTERVENTION_LIBRARY as INTERVENTIONS } from '../src/features/settings/care-plan-library/data/carePlanInterventionLibrarySeed.js';
import { CARE_PLAN_BARRIER_STRUCTURED_LIBRARY as BARRIERS } from '../src/features/settings/care-plan-library/data/carePlanBarrierStructuredSeed.js';

// Stable ids so re-running the generator upserts instead of duplicating.
const uuid = (seed) => {
  const h = createHash('sha1').update(`care-plan-template:${seed}`).digest('hex');
  return [h.slice(0,8), h.slice(8,12), '5'+h.slice(13,16),
    ((parseInt(h.slice(16,18),16) & 0x3f) | 0x80).toString(16) + h.slice(18,20),
    h.slice(20,32)].join('-');
};

const TEMPLATES = [
  ['LTSS Support Plan', ['Functional limitation','Long-term services and supports'], ['adl','mobility','assistive','caregiver','self-care','home safety']],
  ['Chronic Pain Management', ['Chronic pain'], ['pain','rescue interventions']],
  ['Home Safety Plan', ['Safety risk'], ['home safety','fall','emergency care plan','emergency contacts']],
  ['Housing Instability Support', ['Social determinant of health'], ['housing','community resources','food insecurity']],
  ['Asthma Control Plan', ['Asthma'], ['asthma','inhaler','respiratory','warning signs']],
  ['Cholesterol Management', ['Hyperlipidemia'], ['lipid','cardiovascular risk','activity','nutrition']],
  ['Diabetes Management', ['Diabetes'], ['glucose','a1c','diabetes','hypoglycemia','renal risk']],
  ['Diabetes — Intensive Monitoring', ['Diabetes'], ['glucose','a1c','self-monitoring','labs','nutrition']],
  ['Post-Stroke Recovery', ['Stroke'], ['mobility','balance','adl','blood pressure','specialty follow-up']],
  ['Hearing and Sensory Support', ['Sensory impairment'], ['understanding of condition','community resources','appointment','engagement']],
  ['Disability Support Plan', ['Functional limitation'], ['adl','mobility','independence','assistive','caregiver']],
  ['Heart Disease Management', ['Cardiovascular risk'], ['cardiovascular','heart rate','blood pressure','lipid','tobacco']],
  ['Heart Failure Management', ['Heart failure'], ['heart failure','daily weight','warning signs','medication adherence']],
  ['Arthritis and Joint Health', ['Arthritis'], ['pain','mobility','balance','activity']],
  ['Hypertension Management', ['Hypertension'], ['blood pressure','medication adherence','activity','nutrition']],
  ['Hypertension — Uncontrolled', ['Hypertension'], ['blood pressure','self-monitoring','medication adherence','warning signs']],
  ['Polypharmacy Review', ['Polypharmacy'], ['medication','refill','simplify','adverse effects','reconciliation']],
  ['SDOH Support Plan', ['Social determinants of health'], ['food insecurity','housing','transportation','community resources','social isolation']],
  ['Transitions of Care (TOC)', ['Care transition'], ['post-discharge','discharge','readmission','follow-up','reconciliation']],
  ['Transportation Access', ['Care access'], ['transportation','missed appointments','community resources','primary care']],
  ['Unable to Reach (UTR) Outreach', ['Care management'], ['outreach','emergency contacts','engagement','missed appointments']],
  ['ADL Support Plan', ['Functional limitation'], ['adl','self-care','independence','mobility']],
  ['Advance Directive Planning', ['Care planning'], ['advance care planning','emergency care plan','participation in care']],
  ['Cognitive Decline Support', ['Cognitive impairment'], ['cognitive','organization','home safety','caregiver']],
  ['Declined Care Management Follow-up', ['Care management'], ['engagement','outreach','participation in care','care-plan']],
  ['DME and Assistive Equipment', ['Mobility limitation'], ['assistive','mobility','home safety','adl']],
  ['ER Visit Reduction', ['Recent hospitalization'], ['urgent-care','readmission','warning signs','post-discharge']],
  ['Fall Risk Reduction', ['Fall risk'], ['fall','balance','mobility','home safety']],
  ['Flu Shot and Immunization', ['Preventive care'], ['immunization','preventive','wellness visit']],
  ['COPD Management', ['COPD'], ['copd','inhaler','respiratory','oxygen']],
  ['Chronic Kidney Disease', ['Chronic kidney disease'], ['kidney','renal','labs','blood pressure']],
  ['Wound Care Plan', ['Wound'], ['wound','skin breakdown','nutrition']],
  ['Nutrition and Food Security', ['Nutrition risk'], ['nutrition','food insecurity','hydration','weight loss']],
  ['Weight Management', ['Obesity / metabolic risk'], ['weight','activity','nutrition']],
  ['Tobacco Cessation', ['Tobacco use'], ['tobacco','cardiovascular risk','respiratory']],
  ['Behavioral Health Support', ['Behavioral health'], ['mood','behavioral-health','social engagement','sleep']],
  ['Social Isolation Outreach', ['Social isolation'], ['social isolation','social engagement','community resources','caregiver']],
  ['Sleep and Fatigue', ['Sleep difficulty'], ['sleep','energy','activity']],
  ['Medication Adherence', ['Medication management'], ['medication adherence','refill','simplify','organization']],
  ['Medication Reconciliation', ['Medication management'], ['reconciliation','discrepancies','adverse effects','medication adherence']],
  ['Annual Wellness and Prevention', ['Preventive care'], ['wellness visit','preventive','immunization','labs']],
  ['Preventive Screening Plan', ['Preventive care'], ['screening','preventive services','labs']],
  ['Caregiver Support Plan', ['Caregiver need'], ['caregiver','social engagement','community resources','adl']],
  ['Post-Discharge Follow-up', ['Recent hospitalization'], ['post-discharge','discharge','follow-up','care coordination']],
  ['Readmission Prevention', ['Recent hospitalization'], ['readmission','post-discharge','warning signs','medication plan']],
  ['Specialty Referral Follow-up', ['Care coordination'], ['specialty follow-up','referral loop','appointment']],
  ['Primary Care Access', ['Care access'], ['primary care','appointment','transportation','continuity']],
  ['Health Literacy and Self-Management', ['Chronic disease'], ['understanding of condition','self-monitoring','warning signs','participation in care']],
  ['Appointment Adherence', ['Care management'], ['missed appointments','appointment','transportation','outreach']],
  ['Complex Care Management', ['Multiple chronic conditions'], ['care management','care-plan','chronic disease','coordination','goal attainment']],
];

const hay = (o) => [o.title, o.description, ...(o.conditions || [])].join(' ').toLowerCase();
const pick = (list, keywords, cap) => {
  const scored = list
    .map(item => ({ item, score: keywords.reduce((n, k) => n + (hay(item).includes(k) ? 1 : 0), 0) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title));
  return scored.slice(0, cap).map(x => x.item);
};

const byId = new Map(INTERVENTIONS.map(i => [i.id, i]));
// A goal's `links` carry its barriers too — only the intervention kinds
// belong in a template's Interventions section.
const INTERVENTION_KINDS = new Set(['send-form', 'patient-education', 'measure-vital', 'patient-task', 'internal-task']);

const rows = TEMPLATES.map(([name, conditions, keywords]) => {
  const goals = pick(GOALS, keywords, 6);
  // Interventions come from the goals' own links — the combination the goal
  // library already asserts, rather than a second keyword guess.
  const seen = new Set();
  const interventions = [];
  for (const g of goals) {
    for (const link of g.links || []) {
      if (!INTERVENTION_KINDS.has(link.kind)) continue;
      const full = byId.get(link.id);
      const title = full?.title || link.title;
      // Two goals can link separate rows with the same title — dedupe on the
      // title so a template doesn't list the same intervention twice.
      const key = `${link.kind}|${title.toLowerCase()}`;
      if (seen.has(link.id) || seen.has(key)) continue;
      seen.add(link.id);
      seen.add(key);
      interventions.push({ id: link.id, kind: link.kind, title });
      if (interventions.length >= 8) break;
    }
    if (interventions.length >= 8) break;
  }
  // Barriers come from the same goals' links, so a template's barriers are the
  // ones its goals actually name — that also lets a barrier row report which
  // goals point at it. Keyword matching is only the fallback.
  const barrierSeen = new Set();
  const barriers = [];
  for (const g of goals) {
    for (const link of g.links || []) {
      if (link.kind !== 'barrier') continue;
      const key = link.title.toLowerCase();
      if (barrierSeen.has(link.id) || barrierSeen.has(key)) continue;
      barrierSeen.add(link.id);
      barrierSeen.add(key);
      barriers.push({ id: link.id, title: link.title, description: '' });
      if (barriers.length >= 6) break;
    }
    if (barriers.length >= 6) break;
  }
  if (!barriers.length) {
    barriers.push(...pick(BARRIERS, keywords, 4)
      .map(b => ({ id: b.id, title: b.title, description: b.description || '' })));
  }
  return {
    id: uuid(name),
    name,
    conditions,
    goals: goals.map(g => ({
      id: g.id, title: g.title, subtitle: g.description || '',
      category: g.category || '', priority: g.priority || 'medium',
    })),
    interventions,
    barriers,
  };
});

const empty = rows.filter(r => !r.goals.length);
if (empty.length) { console.error('templates with no goals:', empty.map(r => r.name)); process.exit(1); }

const header = `// Care Plan Template Library
// Generated by scripts/genCarePlanTemplates.mjs from the existing goal,
// intervention and barrier libraries — every entry references a real library
// row by id, so nothing here invents clinical content. Upserted by
// \`bun run seed\` (onConflict: 'id'). Do not hand-edit — regenerate instead.

export const CARE_PLAN_TEMPLATE_LIBRARY = ${JSON.stringify(rows, null, 2)};

export function carePlanTemplateLibraryToRow(t) {
  return {
    id: t.id,
    name: t.name,
    conditions: t.conditions,
    goals: t.goals,
    interventions: t.interventions,
    barriers: t.barriers,
  };
}
`;
writeFileSync(process.argv[2], header);
console.log('templates:', rows.length);
console.log('goals/template:', (rows.reduce((n,r)=>n+r.goals.length,0)/rows.length).toFixed(1));
console.log('intv/template:', (rows.reduce((n,r)=>n+r.interventions.length,0)/rows.length).toFixed(1));
console.log('barriers/template:', (rows.reduce((n,r)=>n+r.barriers.length,0)/rows.length).toFixed(1));
console.log('no-barrier templates:', rows.filter(r=>!r.barriers.length).map(r=>r.name).join(', ') || 'none');
