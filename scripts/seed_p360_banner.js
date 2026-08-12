#!/usr/bin/env bun
/**
 * Fold Health — P360 banner data seed
 *
 * Gives every patient in `patients` a meaningful p360_profiles row so the
 * patient-profile banner (collapsed metrics + expanded 4-column panel) shows
 * real-looking data instead of the single Annette-Brave fallback mock.
 *
 * - Deterministic: each patient's data is generated from a PRNG seeded by
 *   their id, so re-running produces identical rows.
 * - Non-destructive: upserts with `coalesce(existing, excluded)` — existing
 *   hand-crafted values (p1 / p2 / p17) are kept; only NULL fields are filled.
 * - Requires supabase/p360_upcoming_appointments_migration.sql to have run.
 *
 * Usage:    bun run scripts/seed_p360_banner.js
 * Requires: SUPABASE_DB_PASSWORD in .env
 */

import pg from 'pg';
import { readFileSync } from 'node:fs';

const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;
if (!DB_PASSWORD) { console.error('SUPABASE_DB_PASSWORD missing — add it to .env'); process.exit(1); }

let poolerHost = 'aws-1-ap-southeast-1.pooler.supabase.com';
let poolerUser = 'postgres.osnihfqqrcchsaqhagcx';
try {
  const u = new URL(readFileSync(new URL('../supabase/.temp/pooler-url', import.meta.url), 'utf8').trim());
  poolerHost = u.hostname;
  poolerUser = decodeURIComponent(u.username);
} catch { /* fall back to the hardcoded pooler */ }

// mulberry32 — tiny deterministic PRNG so seeds are stable per patient
function rngFor(seedStr) {
  let h = 1779033703;
  for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const between = (rng, lo, hi) => lo + rng() * (hi - lo);
const int = (rng, lo, hi) => Math.floor(between(rng, lo, hi + 1));

// "Today" for date math — anchored so re-runs stay deterministic.
const TODAY = new Date('2026-08-12T12:00:00');
const fmtDate = (d) => `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
const fmtDateShort = (d) => fmtDate(d).replace(/\/\d\d(\d\d)$/, '/$1');
const daysFromToday = (n) => { const d = new Date(TODAY); d.setDate(d.getDate() + n); return d; };

// ── Pools ──────────────────────────────────────────────────────────────────

const LANGUAGES = {
  en:  ['English'],
  es:  ['Spanish', 'English'],
  zh:  ['Chinese', 'English'],
  yue: ['Cantonese', 'English'],
  vi:  ['Vietnamese', 'English'],
  ko:  ['Korean', 'English'],
  hi:  ['Hindi', 'English'],
  pa:  ['Punjabi', 'English'],
};

// Family given-name pools per language so relatives read as one household
const GIVEN_NAMES = {
  en:  { M: ['James', 'Michael', 'David', 'Thomas', 'Daniel'], F: ['Emily', 'Sarah', 'Karen', 'Laura', 'Susan'] },
  es:  { M: ['Luis', 'Mateo', 'Diego', 'Javier'], F: ['Elena', 'Sofia', 'Carmen', 'Lucia'] },
  zh:  { M: ['Wei', 'Jun', 'Ming'], F: ['Mei', 'Lin', 'Xiu'] },
  yue: { M: ['Wei', 'Ka-ming', 'Chun'], F: ['Mei', 'Wing', 'Ling'] },
  vi:  { M: ['Minh', 'Huy', 'Anh'], F: ['Lan', 'Mai', 'Thu'] },
  ko:  { M: ['Min-jun', 'Ji-hoon', 'Dong-hyun'], F: ['Soo-ah', 'Ji-woo', 'Eun-ji'] },
  hi:  { M: ['Raj', 'Arjun', 'Vikram'], F: ['Priya', 'Anita', 'Neha'] },
  pa:  { M: ['Arjun', 'Harpreet', 'Gurdeep'], F: ['Simran', 'Jasleen', 'Amrit'] },
};

const CITIES = ['Los Angeles, CA', 'San Diego, CA', 'Fresno, CA', 'Sacramento, CA', 'Long Beach, CA', 'Pasadena, CA', 'Riverside, CA', 'Anaheim, CA'];

// Clinical archetypes — conditions, tags and vitals stay internally consistent
const ARCHETYPES = [
  { conditions: ['Diabetes Type 2', 'Hypertension'],        tags: ['Diabetes', 'Hypertension'],  hba1c: [7.1, 8.4], bp: [[132, 152], [82, 94]] },
  { conditions: ['CHF (Class II)', 'Atrial Fibrillation'],  tags: ['CHF', 'AFib'],               hba1c: [5.6, 6.4], bp: [[110, 128], [68, 80]] },
  { conditions: ['CKD Stage 3', 'Hypertension'],            tags: ['CKD', 'Hypertension'],       hba1c: [5.7, 6.8], bp: [[134, 154], [84, 96]] },
  { conditions: ['COPD', 'Chronic Bronchitis'],             tags: ['COPD'],                      hba1c: [5.5, 6.2], bp: [[118, 136], [72, 84]] },
  { conditions: ['Hyperlipidemia', 'Obesity'],              tags: ['Hyperlipidemia'],            hba1c: [5.8, 6.9], bp: [[122, 140], [76, 88]] },
  { conditions: ['Depression', 'Generalized Anxiety'],      tags: ['Behavioral Health'],         hba1c: [5.4, 6.0], bp: [[112, 128], [70, 82]] },
  { conditions: ['Osteoarthritis', 'Chronic Back Pain'],    tags: ['Chronic Pain'],              hba1c: [5.5, 6.3], bp: [[118, 134], [74, 86]] },
];
const SDOH_TAGS = ['Needs Transportation', 'Lives Alone', 'Fall Risk', 'Hard of Hearing'];

const CARE_TEAM_POOL = [
  { name: 'Katy Moss',        role: 'Plan PCP', title: 'Physician' },
  { name: 'Michael Chen',     role: 'PCP',      title: 'Physician' },
  { name: 'Sarah Kim',        role: '',         title: 'RN Care Manager' },
  { name: 'Aldo Richman',     role: '',         title: 'Care Coordinator' },
  { name: 'Emily Carter',     role: '',         title: 'Behavioral Health' },
  { name: 'Marcus Lee',       role: '',         title: 'Clinical Pharmacist' },
];
const PROVIDERS = ['Dr. Michael Chen', 'Dr. Robert Wilson', 'Dr. Emily Carter', 'Ivy Ralph', 'Dr. Sarah Thompson'];
const APPT_TYPES = [
  { type: 'Annual Wellness Visit',      program: 'AWV' },
  { type: 'Care Plan Review',           program: 'CCM' },
  { type: 'Follow up',                  program: 'TOC' },
  { type: 'Medication Reconciliation',  program: 'TCM' },
  { type: 'Lab Work',                   program: 'HIU' },
  { type: 'Telehealth Check-in',        program: 'CCM' },
];
const PLANS = [
  { name: 'FoldHealth',       desc: 'SCAN Insurance Handler' },
  { name: 'SCAN Health Plan', desc: 'SCAN Insurance Handler' },
  { name: 'CCPP Health',      desc: 'CCPP Managed Care' },
];
const AREA_CODES = ['213', '310', '323', '415', '562', '619', '626', '818', '916'];

// ── Generator ──────────────────────────────────────────────────────────────

const initialsOf = (name) => name.split(/\s+/).filter(w => /^[A-Za-z]/.test(w)).map(w => w[0]).slice(0, 2).join('').toUpperCase();
const phone = (rng) => `(${pick(rng, AREA_CODES)}) 555-0${int(rng, 100, 199)}`;

function generateProfile(patient) {
  const rng = rngFor(patient.id);
  const lang = LANGUAGES[patient.language] ? patient.language : 'en';
  const surname = patient.name.split(/\s+/).filter(w => !/^(Ms|Mr|Mrs|Dr)\.?$/i.test(w)).pop();
  const first = patient.name.split(/\s+/).filter(w => !/^(Ms|Mr|Mrs|Dr)\.?$/i.test(w))[0];
  const ageYears = parseInt(patient.age, 10) || 55;

  // Acuity correlates with age; RAF correlates with acuity
  const acuityRoll = rng() + (ageYears >= 65 ? 0.25 : 0);
  const acuity = acuityRoll > 0.8 ? 'High-Risk' : acuityRoll > 0.45 ? 'Rising-Risk' : 'Low-Risk';
  const raf = acuity === 'High-Risk' ? between(rng, 2.7, 4.6) : acuity === 'Rising-Risk' ? between(rng, 1.5, 2.6) : between(rng, 0.6, 1.4);
  const rafChange = acuity === 'Low-Risk' || rng() < 0.35 ? 0 : Math.round(between(rng, 0.2, 0.8) * 10) / 10;

  const arch = pick(rng, ARCHETYPES);
  const tags = [...arch.tags, ...(rng() < 0.4 ? [pick(rng, SDOH_TAGS)] : [])];

  // Appointments: 1–3 future visits, soonest first; banner "Next Appt." = first
  const apptCount = int(rng, 1, 3);
  let cursor = int(rng, 3, 14);
  const appts = Array.from({ length: apptCount }, () => {
    const a = pick(rng, APPT_TYPES);
    const d = daysFromToday(cursor);
    cursor += int(rng, 7, 21);
    return { ...a, date: fmtDate(d), time: rng() < 0.75 ? `${int(rng, 8, 15) % 12 || 12}:${pick(rng, ['00', '30'])} ${cursor % 2 ? 'AM' : 'PM'}` : '', provider: pick(rng, PROVIDERS) };
  });

  // Family: spouse + up to 2 relatives sharing the surname & language
  const names = GIVEN_NAMES[lang];
  const spouseGender = patient.gender === 'M' ? 'F' : patient.gender === 'F' ? 'M' : pick(rng, ['M', 'F']);
  const spouseRelation = patient.gender === 'M' ? 'Wife' : patient.gender === 'F' ? 'Husband' : 'Partner';
  const famPool = [
    { g: spouseGender, relation: spouseRelation },
    { g: 'M', relation: 'Son' }, { g: 'F', relation: 'Daughter' },
    { g: 'M', relation: 'Brother' }, { g: 'F', relation: 'Sister' },
  ];
  const famCount = int(rng, 1, 3);
  const caregiverIdx = int(rng, 0, famCount - 1);
  const usedGiven = new Set([first]);
  const family = famPool.slice(0, famCount).map((f, i) => {
    let given = pick(rng, names[f.g]);
    while (usedGiven.has(given)) given = pick(rng, names[f.g]);
    usedGiven.add(given);
    const name = `${given} ${surname}`;
    return { name, relation: i === caregiverIdx ? `${f.relation} (Caregiver)` : f.relation, initials: initialsOf(name), role: i === caregiverIdx ? 'Caregiver' : (i === 0 ? 'Primary' : null), phone: phone(rng), phone_hours: 'Mon-Sun, 9am-9pm' };
  });

  // Care team: a PCP plus 1–2 supporting members
  const pcp = pick(rng, CARE_TEAM_POOL.slice(0, 2));
  const others = CARE_TEAM_POOL.slice(2).filter(() => rng() < 0.5).slice(0, 2);
  const careTeam = [pcp, ...(others.length ? others : [CARE_TEAM_POOL[2]])].map(m => ({ ...m, initials: initialsOf(m.name) }));

  const vitalsDate = daysFromToday(-int(rng, 5, 30));
  const sys = int(rng, arch.bp[0][0], arch.bp[0][1]);
  const dia = int(rng, arch.bp[1][0], arch.bp[1][1]);
  const weight = patient.gender === 'F' ? int(rng, 128, 190) : int(rng, 150, 235);
  const plan = pick(rng, PLANS);
  const primaryPhone = phone(rng);
  const emailName = `${first}.${surname}`.toLowerCase().replace(/[^a-z.]/g, '');

  return {
    profile_type: 'Central Profile',
    health_plan_name: plan.name,
    health_plan_desc: plan.desc,
    consent_given: int(rng, 1, 4),
    consent_total: 4,
    acuity,
    raf_score: Math.round(raf * 1000) / 1000,
    raf_change: rafChange,
    next_appointment_date: appts[0].date,
    last_contact_type: pick(rng, ['Call', 'SMS', 'Email', 'UTR']),
    last_contact_days: int(rng, 2, 45),
    programs: [...new Set(appts.map(a => a.program))],
    patient_type: pick(rng, ['New Patient', 'Established']),
    condition_tags: tags,
    location: pick(rng, CITIES),
    location_count: int(rng, 0, 2),
    languages: LANGUAGES[lang],
    language_preference: LANGUAGES[lang][0],
    emails: [`${emailName}@email.com`],
    plan_numbers_primary: [primaryPhone],
    plan_numbers_secondary: rng() < 0.6 ? [phone(rng)] : [],
    chronic_conditions: arch.conditions,
    recent_vitals: {
      date: fmtDateShort(vitalsDate),
      bp: `${sys}/${dia} mmHg`,
      weight: `${weight} lbs`,
      pulse: `${int(rng, 62, 92)} bpm`,
      hba1c: `${between(rng, arch.hba1c[0], arch.hba1c[1]).toFixed(1)}%`,
    },
    opted_out_comms: rng() < 0.35 ? [`${phone(rng)} (Call)`] : ['None'],
    family_caregiver_count: rng() < 0.3 ? int(rng, 1, 2) : 0,
    family_members: family,
    care_team: careTeam,
    care_team_profile_type: 'Central Profile',
    upcoming_appointments: appts,
  };
}

// ── Upsert ─────────────────────────────────────────────────────────────────

const JSONB_COLS = new Set(['programs', 'condition_tags', 'languages', 'emails', 'plan_numbers_primary', 'plan_numbers_secondary', 'chronic_conditions', 'recent_vitals', 'opted_out_comms', 'family_members', 'care_team', 'upcoming_appointments']);

async function upsertProfile(db, patientId, profile) {
  const cols = Object.keys(profile);
  const params = [patientId, ...cols.map(c => JSONB_COLS.has(c) ? JSON.stringify(profile[c]) : profile[c])];
  const placeholders = cols.map((c, i) => JSONB_COLS.has(c) ? `$${i + 2}::jsonb` : `$${i + 2}`);
  // Only unfilled fields get filled — hand-crafted rows survive re-seeds.
  // "Unfilled" = NULL, or (for jsonb) an empty array left by column defaults.
  const setClause = cols.map(c => JSONB_COLS.has(c)
    ? `${c} = case when p360_profiles.${c} is null or p360_profiles.${c} = '[]'::jsonb then excluded.${c} else p360_profiles.${c} end`
    : `${c} = coalesce(p360_profiles.${c}, excluded.${c})`);
  const { rows } = await db.query(
    `insert into p360_profiles (patient_id, ${cols.join(', ')})
     values ($1, ${placeholders.join(', ')})
     on conflict (patient_id) do update
     set ${setClause.join(', ')}
     returning (xmax = 0) as was_insert`,
    params,
  );
  return rows[0]?.was_insert;
}

// Banner fields carried over when an All Patients row mirrors a patients-table
// member — copying keeps the two entry points showing identical data.
const BANNER_COLS = ['profile_type', 'health_plan_name', 'health_plan_desc', 'consent_given', 'consent_total', 'acuity', 'raf_score', 'raf_change', 'next_appointment_date', 'last_contact_type', 'last_contact_days', 'programs', 'patient_type', 'condition_tags', 'location', 'location_count', 'languages', 'language_preference', 'emails', 'plan_numbers_primary', 'plan_numbers_secondary', 'chronic_conditions', 'recent_vitals', 'opted_out_comms', 'family_caregiver_count', 'family_members', 'care_team', 'care_team_profile_type', 'upcoming_appointments'];

async function main() {
  console.log('\n🌱  P360 banner seed\n');
  const db = new pg.Client({ host: poolerHost, port: 5432, database: 'postgres', user: poolerUser, password: DB_PASSWORD, ssl: { rejectUnauthorized: false } });
  await db.connect();

  const { rows: patients } = await db.query('select id, name, gender, age, language from patients order by id');
  console.log(`${patients.length} patients found`);

  let inserted = 0, merged = 0;
  for (const patient of patients) {
    const profile = generateProfile(patient);
    (await upsertProfile(db, patient.id, profile)) ? inserted++ : merged++;
    console.log(`  ✓ ${patient.id.padEnd(4)} ${patient.name.padEnd(20)} ${profile.acuity.padEnd(12)} RAF ${profile.raf_score}`);
  }

  // ── All Patients union members ────────────────────────────────────────────
  // The banner is keyed by the id the surface passes (all_patients.id for the
  // All Patients worklist), so those members need their own p360 rows too.
  // Members mirrored from the patients table get an exact copy of that
  // profile; the rest are generated, with the row's real contact/clinical
  // data (email, phone, city/state, chronic conditions, PCP) taking priority
  // over generated values.
  const { rows: apMembers } = await db.query(
    `select id, name, gender, age, language, member_id, email, phone, city, state,
            chronic_conditions, pcp, pcp_initials
       from all_patients order by id`,
  );
  const { rows: mirrored } = await db.query(
    `select a.id as ap_id, pp.*
       from all_patients a
       join patients p on p.member_id::text = a.member_id::text
       join p360_profiles pp on pp.patient_id = p.id`,
  );
  const mirroredByApId = new Map(mirrored.map(r => [r.ap_id, r]));
  console.log(`\n${apMembers.length} all_patients members (${mirroredByApId.size} mirror a patients-table row)`);

  let apInserted = 0, apMerged = 0;
  for (const m of apMembers) {
    let profile;
    const source = mirroredByApId.get(m.id);
    if (source) {
      profile = Object.fromEntries(BANNER_COLS.map(c => [c, source[c]]));
    } else {
      profile = generateProfile(m);
      if (m.city && m.state) profile.location = `${m.city}, ${m.state}`;
      if (m.email) profile.emails = [m.email];
      if (m.phone) profile.plan_numbers_primary = [m.phone];
      if (m.chronic_conditions?.length) {
        profile.chronic_conditions = m.chronic_conditions;
        profile.condition_tags = [...m.chronic_conditions.slice(0, 2), ...profile.condition_tags.slice(-1)];
      }
      if (m.pcp) {
        const pcpInitials = m.pcp_initials || initialsOf(m.pcp);
        profile.care_team = [{ name: m.pcp, role: 'Plan PCP', title: 'Physician', initials: pcpInitials }, ...profile.care_team.slice(1)];
      }
    }
    (await upsertProfile(db, m.id, profile)) ? apInserted++ : apMerged++;
  }
  console.log(`  ✓ all_patients: ${apInserted} inserted, ${apMerged} merged`);

  console.log(`\nDone — patients: ${inserted} inserted / ${merged} merged; all_patients: ${apInserted} inserted / ${apMerged} merged.\n`);
  await db.end();
}

main().catch((err) => { console.error('Seed failed:', err.message); process.exit(1); });
