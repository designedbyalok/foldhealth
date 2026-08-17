#!/usr/bin/env bun
/**
 * Fold Health — Database Seed
 *
 * Creates hedis_members + apcm_patients tables (if they don't exist) and
 * upserts all mock data into Supabase.
 *
 * Usage:    bun run seed
 * Requires: SUPABASE_SERVICE_ROLE_KEY + SUPABASE_DB_PASSWORD in .env
 */

import pg from 'pg';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { HEDIS_MEMBERS } from '../src/features/hedis-worklist/data/mock.js';
import { APCM_PATIENTS } from '../src/features/apcm-billing/data/mock.js';
import { FALLBACK_ICDS } from '../src/lib/icd/catalog.js';
import { POS_CODES } from '../src/features/hcc/data/posCodes.js';
import { ICDS, NOT_LINKED, getIcdsForMember, getNotLinkedForMember } from '../src/features/hcc/data/icds.js';
import { HCC_MEMBER_BY_NAME } from '../src/features/hcc/data/mock.js';
import { POP_GROUPS } from '../src/features/population-groups/PopulationGroupsView.utils.js';
import { CCM_BILLING_PERIODS, CCM_BILLABLE_ACTIVITIES, CCM_BILLING_REPORTS } from '../src/features/patient/data/ccmBillingMock.js';
import { CCM_WORKLIST_MEMBERS } from '../src/features/ccm-worklist/data/mock.js';
import { SNP_WORKLIST_MEMBERS } from '../src/features/snp-worklist/data/mock.js';
import { CAREGAP_ACTIVITY_MOCK } from '../src/features/hedis-worklist/data/caregapActivityMock.js';
import { PRACTICE_LOCATIONS } from '../src/features/settings/account/locations/data/mock.js';

// Care-program letters library. Metadata mirrors PROGRAM_LETTERS_MOCK; the PDF
// bytes are read from supabase/seed-assets/letters and stored base64 in the
// `letters` table (see supabase/letters_migration.sql).
const LETTERS = [
  { id: 'l-1',  file_name: 'Intro or Welcome Letter - Patient', file_type: 'Letter', sent_via: ['Email', 'SMS'], last_sent: '07/02/2025', sent_by: 'Mark Emard',          source_file: '01_Welcome_Letter_Patient.pdf' },
  { id: 'l-2',  file_name: 'Consent letter - Patient',          file_type: 'Letter', sent_via: ['Email'],        last_sent: '07/01/2025', sent_by: 'Faye Romaguera',      source_file: '02_Consent_Letter_Patient.pdf' },
  { id: 'l-3',  file_name: 'ICT Invite - Member',               file_type: 'Form',   sent_via: ['Email'],        last_sent: '06/29/2025', sent_by: 'Melinda Effertz',     source_file: '03_ICT_Invite_Member.pdf' },
  { id: 'l-4',  file_name: 'ICT Invite - PCP',                  file_type: 'Letter', sent_via: ['SMS'],          last_sent: '06/15/2025', sent_by: 'Rachael Jast',        source_file: '04_ICT_Invite_PCP.pdf' },
  { id: 'l-5',  file_name: 'ICP Letter - Member',               file_type: 'Letter', sent_via: ['Email'],        last_sent: '06/14/2025', sent_by: 'Lewis Bogisich',      source_file: '05_ICP_Letter_Member.pdf' },
  { id: 'l-6',  file_name: 'ICP Letter - Provider',             file_type: 'Letter', sent_via: ['Mailroom'],     last_sent: '05/30/2025', sent_by: 'Domingo Toy',         source_file: '06_ICP_Letter_Provider.pdf' },
  { id: 'l-7',  file_name: 'UTR Letter',                        file_type: 'Letter', sent_via: ['Email'],        last_sent: '05/23/2025', sent_by: 'Ernestine Leffler',   source_file: '07_UTR_Letter.pdf' },
  { id: 'l-8',  file_name: 'Member Flyers',                     file_type: 'Flyer',  sent_via: ['Email'],        last_sent: '05/18/2025', sent_by: 'Priscilla Romaguera', source_file: '08_Member_Flyer.pdf' },
  { id: 'l-9',  file_name: 'Enrollment Confirmation - Patient', file_type: 'Letter', sent_via: ['Email'],        last_sent: '05/12/2025', sent_by: 'Damaris Kunze',       source_file: '09_Enrollment_Confirmation_Patient.pdf' },
  { id: 'l-10', file_name: 'Enrollment Confirmation - PCP',     file_type: 'Letter', sent_via: ['Mailroom'],     last_sent: '05/08/2025', sent_by: 'Otho Hyatt',          source_file: '10_Enrollment_Confirmation_PCP.pdf' },
];

function letterToRow(l, i) {
  const bytes = readFileSync(new URL(`../supabase/seed-assets/letters/${l.source_file}`, import.meta.url));
  return { ...l, content_base64: bytes.toString('base64'), sort_order: i };
}

// Patients whose HCC diagnosis gaps have been modernized to V28 + 2025/26
// dates (see docs/features/hcc-coding-workflow.md). Re-seeding rewrites just
// these members' gaps from the mock so the DB matches the source of truth.
const HCC_MODERNIZED = ['Annette Brave', 'William Jammy', 'Grace Hill', 'Kevin Brown', 'Jessica Clark'];

// ── Config ─────────────────────────────────────────────────────────────────────

const PROJECT_REF      = 'osnihfqqrcchsaqhagcx';
const SUPABASE_URL     = `https://${PROJECT_REF}.supabase.co`;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DB_PASSWORD      = process.env.SUPABASE_DB_PASSWORD;

if (!SERVICE_ROLE_KEY || !DB_PASSWORD) {
  console.error('\n❌  Missing env vars. Ensure .env has:');
  console.error('    SUPABASE_SERVICE_ROLE_KEY');
  console.error('    SUPABASE_DB_PASSWORD\n');
  process.exit(1);
}

// ── Table DDL ──────────────────────────────────────────────────────────────────

const HEDIS_DDL = `
CREATE TABLE IF NOT EXISTS hedis_members (
  id                text PRIMARY KEY,
  initials          text,
  name              text NOT NULL,
  gender            text,
  age               text,
  member_id         text,
  language          text DEFAULT 'en',
  gaps              jsonb DEFAULT '[]',
  assignee          text,
  assignee_initials text,
  start_date        text,
  adv_illness       int  DEFAULT 0,
  frailty           int  DEFAULT 0,
  risk_level        text,
  tasks             int,
  outreach_dots     jsonb DEFAULT '[]',
  outreach_date     text,
  member_status     text DEFAULT 'Active',
  phone             text,
  dob               text,
  ipa               text,
  hp_code           text,
  zip               text,
  city              text,
  state             text,
  created_at        timestamptz DEFAULT now()
);
ALTER TABLE hedis_members DISABLE ROW LEVEL SECURITY;
`;

const APCM_DDL = `
CREATE TABLE IF NOT EXISTS apcm_patients (
  id                          text PRIMARY KEY,
  name                        text NOT NULL,
  member_id                   text,
  language                    text DEFAULT 'en',
  ehr_id                      text,
  billing_month               text,
  date_of_service             text,
  is_qmb                      boolean DEFAULT false,
  chronic_condition_count     int     DEFAULT 0,
  cpt_code                    text,
  icd_codes                   jsonb DEFAULT '[]',
  last_encounter_date         text,
  reasons                     jsonb DEFAULT '[]',
  rendering_provider          text,
  rendering_provider_initials text,
  comment                     text DEFAULT '',
  tab                         text,
  billing_status              text DEFAULT 'pending',
  program_id                  text,
  created_at                  timestamptz DEFAULT now()
);
ALTER TABLE apcm_patients DISABLE ROW LEVEL SECURITY;
`;

const ICD_DDL = `
CREATE TABLE IF NOT EXISTS icd_codes (
  code        text PRIMARY KEY,
  title       text NOT NULL,
  chapter     text,
  hcc         text,
  entity_id   text,
  source      text DEFAULT 'seed',
  updated_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_icd_codes_title ON icd_codes USING gin (to_tsvector('english', title));
ALTER TABLE icd_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on icd_codes" ON icd_codes;
DROP POLICY IF EXISTS "Read icd_codes" ON icd_codes;
CREATE POLICY "Read icd_codes" ON icd_codes FOR SELECT USING (true);
`;

const POS_DDL = `
CREATE TABLE IF NOT EXISTS pos_codes (
  code        text PRIMARY KEY,
  name        text NOT NULL,
  updated_at  timestamptz DEFAULT now()
);
ALTER TABLE pos_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on pos_codes" ON pos_codes;
DROP POLICY IF EXISTS "Read pos_codes" ON pos_codes;
CREATE POLICY "Read pos_codes" ON pos_codes FOR SELECT USING (true);
`;

// CCM Billing tables — mirrored in supabase/ccm_billing_migration.sql. Keep
// column names + defaults in sync so a fresh `bun run seed` on an empty
// project produces the same shape the migration would.
const CCM_PERIODS_DDL = `
CREATE TABLE IF NOT EXISTS ccm_billing_periods (
  id                text PRIMARY KEY,
  patient_id        text NOT NULL,
  program_id        text,
  year_month        text NOT NULL,
  complexity        text DEFAULT 'moderate',
  required_minutes  int  DEFAULT 20,
  bill_status       text DEFAULT 'draft',
  claim_status      text DEFAULT 'unsent',
  generated_at      timestamptz,
  sent_at           timestamptz,
  created_at        timestamptz DEFAULT now(),
  UNIQUE (patient_id, year_month)
);
ALTER TABLE ccm_billing_periods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for ccm_billing_periods" ON ccm_billing_periods;
CREATE POLICY "Allow all for ccm_billing_periods" ON ccm_billing_periods FOR ALL USING (true);
`;

const CCM_ACTIVITIES_DDL = `
CREATE TABLE IF NOT EXISTS ccm_billable_activities (
  id                  text PRIMARY KEY,
  period_id           text REFERENCES ccm_billing_periods(id) ON DELETE CASCADE,
  patient_id          text NOT NULL,
  activity_type       text NOT NULL,
  description         text DEFAULT '',
  duration_seconds    int  NOT NULL DEFAULT 0,
  logged_by           text,
  logged_by_initials  text,
  occurred_at         timestamptz NOT NULL,
  is_unlogged         boolean DEFAULT false,
  created_at          timestamptz DEFAULT now()
);
ALTER TABLE ccm_billable_activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for ccm_billable_activities" ON ccm_billable_activities;
CREATE POLICY "Allow all for ccm_billable_activities" ON ccm_billable_activities FOR ALL USING (true);
`;

const CCM_WORKLIST_DDL = `
CREATE TABLE IF NOT EXISTS ccm_worklist_members (
  id                    text PRIMARY KEY,
  initials              text,
  name                  text NOT NULL,
  gender                text,
  age                   text,
  member_id             text,
  language              text DEFAULT 'en',
  status                text NOT NULL,
  next_action_due       text,
  next_action_overdue   boolean DEFAULT false,
  outreach_status       text,
  outreach_date         text,
  assignee_id           text,
  assignee_name         text,
  assignee_initials     text,
  start_date            text,
  last_admission        text,
  risk_level            text,
  task_count            int DEFAULT 0,
  care_plan_status      text,
  billable_seconds      int DEFAULT 0,
  unlogged_seconds      int DEFAULT 0,
  dob                   text,
  utr_flag              text DEFAULT 'No',
  utr_age_days          int DEFAULT 0,
  program_due_date      text,
  last_outreach_outcome text,
  assignment_date       text,
  ipa                   text,
  hp_code               text,
  member_status         text DEFAULT 'Active',
  patient_id            text,
  created_at            timestamptz DEFAULT now()
);
ALTER TABLE ccm_worklist_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for ccm_worklist_members" ON ccm_worklist_members;
CREATE POLICY "Allow all for ccm_worklist_members" ON ccm_worklist_members FOR ALL USING (true);
`;

const SNP_WORKLIST_DDL = `
CREATE TABLE IF NOT EXISTS snp_worklist_members (
  id                  text PRIMARY KEY,
  initials            text,
  name                text NOT NULL,
  gender              text,
  age                 text,
  member_id           text,
  language            text DEFAULT 'en',
  program_sub_status  text,
  care_plan_status    text,
  next_action_due     text,
  outreach            jsonb,
  assignee_id         text,
  assignee_name       text,
  assignee_initials   text,
  assignee_role       text,
  trigger_date        text,
  last_admission      text,
  trigger             text,
  risk_iq             text DEFAULT 'Undetermined',
  tags                jsonb DEFAULT '[]'::jsonb,
  tags_more           int  DEFAULT 0,
  task_count          int  DEFAULT 0,
  patient_id          text,
  created_at          timestamptz DEFAULT now()
);
ALTER TABLE snp_worklist_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for snp_worklist_members" ON snp_worklist_members;
CREATE POLICY "Allow all for snp_worklist_members" ON snp_worklist_members FOR ALL USING (true);
`;

const CAREGAP_ACTIVITY_DDL = `
CREATE TABLE IF NOT EXISTS caregap_activity (
  id         text PRIMARY KEY,
  member_id  text NOT NULL,
  at         timestamptz NOT NULL DEFAULT now(),
  actor      text,
  t          text,
  title      text,
  payload    jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE caregap_activity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for caregap_activity" ON caregap_activity;
CREATE POLICY "Allow all for caregap_activity" ON caregap_activity FOR ALL USING (true);
CREATE INDEX IF NOT EXISTS idx_caregap_activity_member ON caregap_activity (member_id, at DESC);
`;

const CCM_REPORTS_DDL = `
CREATE TABLE IF NOT EXISTS ccm_billing_reports (
  id                        text PRIMARY KEY,
  report_number             int  NOT NULL,
  patient_id                text NOT NULL,
  period_id                 text REFERENCES ccm_billing_periods(id) ON DELETE SET NULL,
  year_month                text NOT NULL,
  generated_at              timestamptz NOT NULL,
  est_billing_amount        numeric(10,2) NOT NULL,
  total_seconds             int NOT NULL DEFAULT 0,
  integrated_ehr            text,
  provider_name             text,
  provider_initials         text,
  medical_decision_making   text DEFAULT 'moderate',
  cpt_codes                 jsonb DEFAULT '[]',
  created_at                timestamptz DEFAULT now()
);
ALTER TABLE ccm_billing_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for ccm_billing_reports" ON ccm_billing_reports;
CREATE POLICY "Allow all for ccm_billing_reports" ON ccm_billing_reports FOR ALL USING (true);
`;

const PRACTICE_LOCATIONS_DDL = `
CREATE TABLE IF NOT EXISTS practice_locations (
  id                text PRIMARY KEY,
  name              text NOT NULL,
  ehr_instance      text,
  address_line_1    text,
  address_line_2    text,
  city              text,
  state             text,
  zip_code          text,
  timezone          text,
  google_map_link   text,
  default_phone     text,
  business_hours    jsonb DEFAULT '[]',
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  deleted_at        timestamptz
);
ALTER TABLE practice_locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for practice_locations" ON practice_locations;
CREATE POLICY "Allow all for practice_locations" ON practice_locations FOR ALL USING (true);
`;

// ── Row mappers (JS shape → DB columns) ───────────────────────────────────────

// Fold ID resolution — every worklist row's `member_id` column is written as
// the bare-number Fold ID from patient_registry (e.g. "10014"), not the raw
// payer id from the mock (e.g. "#2468029990001"). Mocks predate the Fold-ID
// scheme; we bridge at seed time so the DB always matches what the app shows.
// See supabase/patient_registry_migration.sql and patient_id_unification_migration.sql.
const normalizeMemberId = (raw) => String(raw || '').replace(/^#/, '').trim().toLowerCase();

async function resolveFoldIdMap(supabase, rawIds) {
  const normalized = [...new Set(rawIds.map(normalizeMemberId).filter(Boolean))];
  if (!normalized.length) return new Map();

  // Insert any missing normalized ids — patient_registry auto-mints fold_id
  // via nextval('patient_fold_id_seq'). onConflict/ignoreDuplicates keeps
  // existing assignments stable.
  await supabase
    .from('patient_registry')
    .upsert(normalized.map((m) => ({ member_id: m })), { onConflict: 'member_id', ignoreDuplicates: true });

  const { data, error } = await supabase
    .from('patient_registry')
    .select('member_id, fold_id')
    .in('member_id', normalized);
  if (error) throw new Error(`patient_registry read failed: ${error.message}`);

  return new Map(data.map((r) => [r.member_id, String(r.fold_id)]));
}

function resolveMemberId(rawId, foldIdMap) {
  const key = normalizeMemberId(rawId);
  const foldId = foldIdMap.get(key);
  if (!foldId) {
    console.warn(`  ⚠  No Fold ID for member_id="${rawId}" — falling back to raw`);
    return rawId ?? null;
  }
  return foldId;
}

function hedisToRow(m, foldIdMap) {
  return {
    id:                m.id,
    initials:          m.in,
    name:              m.name,
    gender:            m.gender,
    age:               m.age,
    member_id:         resolveMemberId(m.memberId, foldIdMap),
    language:          m.language || 'en',
    gaps:              m.gaps ?? [],
    assignee:          m.assignee ?? null,
    assignee_initials: m.assigneeInitials ?? null,
    start_date:        m.startDate ?? null,
    adv_illness:       m.advIllness ?? 0,
    frailty:           m.frailty ?? 0,
    risk_level:        m.riskLevel ?? null,
    tasks:             m.tasks ?? null,
    outreach_dots:     m.outreachDots ?? [],
    outreach_date:     m.outreachDate ?? null,
    member_status:     m.memberStatus || 'Active',
    phone:             m.phone ?? null,
    dob:               m.dob ?? null,
    ipa:               m.ipa ?? null,
    hp_code:           m.hpCode ?? null,
    zip:               m.zip ?? null,
    city:              m.city ?? null,
    state:             m.state ?? null,
  };
}

function practiceLocationToRow(l) {
  return {
    id:              l.id,
    name:            l.name,
    ehr_instance:    l.ehrInstance ?? null,
    address_line_1:  l.addressLine1 ?? null,
    address_line_2:  l.addressLine2 ?? null,
    city:            l.city ?? null,
    state:           l.state ?? null,
    zip_code:        l.zipCode ?? null,
    timezone:        l.timezone ?? null,
    google_map_link: l.googleMapLink ?? null,
    default_phone:   l.defaultPhone ?? null,
    business_hours:  l.businessHours ?? [],
  };
}

function apcmToRow(p) {
  return {
    id:                          p.id,
    name:                        p.name,
    member_id:                   p.memberId,
    language:                    p.language || 'en',
    ehr_id:                      p.ehrId,
    billing_month:               p.billingMonth,
    date_of_service:             p.dateOfService,
    is_qmb:                      p.isQmb,
    chronic_condition_count:     p.chronicConditionCount,
    cpt_code:                    p.cptCode,
    icd_codes:                   p.icdCodes ?? [],
    last_encounter_date:         p.lastEncounterDate,
    reasons:                     p.reasons ?? [],
    rendering_provider:          p.renderingProvider,
    rendering_provider_initials: p.renderingProviderInitials,
    comment:                     p.comment || '',
    tab:                         p.tab,
    billing_status:              p.billingStatus || 'pending',
    program_id:                  p.programId,
  };
}

function icdToRow(i) {
  return {
    code:    i.code,
    title:   i.title,
    hcc:     i.hcc || null,
    chapter: i.chapter || null,
    source:  'seed',
  };
}

function ccmPeriodToRow(p) {
  return {
    id:               p.id,
    patient_id:       p.patientId,
    program_id:       p.programId ?? null,
    year_month:       p.yearMonth,
    complexity:       p.complexity || 'moderate',
    required_minutes: p.requiredMinutes ?? 20,
    bill_status:      p.billStatus || 'draft',
    claim_status:     p.claimStatus || 'unsent',
    generated_at:     p.generatedAt ?? null,
    sent_at:          p.sentAt ?? null,
  };
}

function ccmActivityToRow(a) {
  return {
    id:                 a.id,
    period_id:          a.periodId,
    patient_id:         a.patientId,
    activity_type:      a.activityType,
    description:        a.description || '',
    duration_seconds:   a.durationSeconds ?? 0,
    logged_by:          a.loggedBy ?? null,
    logged_by_initials: a.loggedByInitials ?? null,
    occurred_at:        a.occurredAt,
    is_unlogged:        !!a.isUnlogged,
  };
}

function ccmWorklistToRow(m, foldIdMap) {
  return {
    id:                   m.id,
    initials:             m.initials ?? null,
    name:                 m.name,
    gender:               m.gender ?? null,
    age:                  m.age ?? null,
    member_id:            resolveMemberId(m.memberId, foldIdMap),
    language:             m.language || 'en',
    status:               m.status,
    next_action_due:      m.nextActionDue ?? null,
    next_action_overdue:  !!m.nextActionOverdue,
    outreach_status:      m.outreachStatus ?? null,
    outreach_date:        m.outreachDate ?? null,
    assignee_id:          m.assigneeId ?? null,
    assignee_name:        m.assigneeName ?? null,
    assignee_initials:    m.assigneeInitials ?? null,
    start_date:           m.startDate ?? null,
    last_admission:       m.lastAdmission ?? null,
    risk_level:           m.riskLevel ?? null,
    task_count:           m.taskCount ?? 0,
    care_plan_status:     m.carePlanStatus ?? null,
    billable_seconds:     m.billableSeconds ?? 0,
    unlogged_seconds:     m.unloggedSeconds ?? 0,
    dob:                  m.dob ?? null,
    utr_flag:             m.utrFlag || 'No',
    utr_age_days:         m.utrAgeDays ?? 0,
    program_due_date:     m.programDueDate ?? null,
    last_outreach_outcome: m.lastOutreachOutcome ?? null,
    assignment_date:      m.assignmentDate ?? null,
    ipa:                  m.ipa ?? null,
    hp_code:              m.hpCode ?? null,
    member_status:        m.memberStatus || 'Active',
    patient_id:           m.patientId ?? null,
  };
}

function snpWorklistToRow(m, foldIdMap) {
  return {
    id:                 m.id,
    initials:           m.initials ?? null,
    name:               m.name,
    gender:             m.gender ?? null,
    age:                m.age ?? null,
    member_id:          resolveMemberId(m.memberId, foldIdMap),
    language:           m.language || 'en',
    program_sub_status: m.programSubStatus ?? null,
    care_plan_status:   m.carePlanStatus ?? null,
    next_action_due:    m.nextActionDue ?? null,
    outreach:           m.outreach ?? null,
    assignee_id:        m.assigneeId ?? null,
    assignee_name:      m.assigneeName ?? null,
    assignee_initials:  m.assigneeInitials ?? null,
    assignee_role:      m.assigneeRole ?? null,
    trigger_date:       m.triggerDate ?? null,
    last_admission:     m.lastAdmission ?? null,
    trigger:            m.trigger ?? null,
    risk_iq:            m.riskIq || 'Undetermined',
    tags:               m.tags ?? [],
    tags_more:          m.tagsMore ?? 0,
    task_count:         m.taskCount ?? 0,
    patient_id:         m.patientId ?? null,
  };
}

// Mirrors caregapActivityToRow in useAppStore.js — common columns lifted out,
// variant-specific fields ride in payload jsonb.
function caregapActivityToRow(memberId, e) {
  const { id, when, at, actor, t, title, ...payload } = e;
  return {
    id:        String(id),
    member_id: memberId,
    at:        when ?? at ?? new Date().toISOString(),
    actor:     actor ?? null,
    t:         t ?? null,
    title:     title ?? null,
    payload,
  };
}

function ccmReportToRow(r) {
  return {
    id:                       r.id,
    report_number:            r.reportNumber,
    patient_id:               r.patientId,
    period_id:                r.periodId ?? null,
    year_month:               r.yearMonth,
    generated_at:             r.generatedAt,
    est_billing_amount:       r.estBillingAmount,
    total_seconds:            r.totalSeconds ?? 0,
    integrated_ehr:           r.integratedEhr ?? null,
    provider_name:            r.providerName ?? null,
    provider_initials:        r.providerInitials ?? null,
    medical_decision_making:  r.medicalDecisionMaking || 'moderate',
    cpt_codes:                r.cptCodes ?? [],
  };
}

// Mock ICD → hcc_diagnosis_gaps row. Deterministic id (member::code) makes
// the re-seed idempotent.
function gapToRow(name, i, isLinked) {
  return {
    id:               `${name}::${i.code}`,
    member_name:      name,
    code:             i.code,
    description:      i.desc,
    hcc_category:     i.hcc,
    status:           i.status || 'New',
    type:             i.type ?? null,
    docs_count:       i.docs ?? 0,
    comments_count:   i.cmts ?? 0,
    notes_count:      i.notes ?? 0,
    raf_weight:       i.raf ?? 0,
    last_activity:    i.last ?? null,
    last_activity_by: i.by ?? null,
    dismiss_reason:   i.dismissReason ?? null,
    is_linked:        isLinked,
  };
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🌱  Fold Health — DB Seed\n');

  // 1. Create tables via direct Postgres connection (best-effort — tables may already exist)
  console.log('Creating tables (if not exist)...');
  try {
    const db = new pg.Client({
      host: `db.${PROJECT_REF}.supabase.co`,
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password: DB_PASSWORD,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 6000,
    });
    await db.connect();
    await db.query(HEDIS_DDL);
    console.log('  ✓ hedis_members — created / already exists');
    await db.query(APCM_DDL);
    console.log('  ✓ apcm_patients — created / already exists');
    await db.query(ICD_DDL);
    console.log('  ✓ icd_codes — created / already exists');
    await db.query(POS_DDL);
    console.log('  ✓ pos_codes — created / already exists');
    await db.query(CCM_PERIODS_DDL);
    console.log('  ✓ ccm_billing_periods — created / already exists');
    await db.query(CCM_ACTIVITIES_DDL);
    console.log('  ✓ ccm_billable_activities — created / already exists');
    await db.query(CCM_REPORTS_DDL);
    console.log('  ✓ ccm_billing_reports — created / already exists');
    await db.query(CCM_WORKLIST_DDL);
    console.log('  ✓ ccm_worklist_members — created / already exists');
    await db.query(SNP_WORKLIST_DDL);
    console.log('  ✓ snp_worklist_members — created / already exists');
    await db.query(CAREGAP_ACTIVITY_DDL);
    console.log('  ✓ caregap_activity — created / already exists');
    await db.query(PRACTICE_LOCATIONS_DDL);
    console.log('  ✓ practice_locations — created / already exists');
    await db.end();
  } catch (e) {
    console.warn(`  ⚠  Could not connect via pg (${e.message})`);
    console.warn('     Tables must already exist — continuing to upsert data.\n');
  }

  // 2. Upsert data via supabase-js (service role bypasses RLS)
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Bridge raw payer ids → Fold IDs from patient_registry so worklist rows
  // land with the same identifier the app displays via <FoldIdTag>. Mints
  // fold_ids for any mock member missing from the registry.
  console.log('\nResolving Fold IDs for HEDIS / CCM / SNP members...');
  const foldIdMap = await resolveFoldIdMap(supabase, [
    ...HEDIS_MEMBERS.map((m) => m.memberId),
    ...CCM_WORKLIST_MEMBERS.map((m) => m.memberId),
    ...SNP_WORKLIST_MEMBERS.map((m) => m.memberId),
  ]);
  console.log(`  ✓ ${foldIdMap.size} Fold IDs available in patient_registry`);

  console.log('\nSeeding hedis_members...');
  const hedisRows = HEDIS_MEMBERS.map((m) => hedisToRow(m, foldIdMap));
  const { error: he } = await supabase
    .from('hedis_members')
    .upsert(hedisRows, { onConflict: 'id' });
  if (he) { console.error('  ✗', he.message); } else { console.log(`  ✓ ${hedisRows.length} members`); }

  console.log('Seeding apcm_patients...');
  const apcmRows = APCM_PATIENTS.map(apcmToRow);
  const { error: ae } = await supabase
    .from('apcm_patients')
    .upsert(apcmRows, { onConflict: 'id' });
  if (ae) { console.error('  ✗', ae.message); } else { console.log(`  ✓ ${apcmRows.length} patients`); }

  console.log('Seeding icd_codes...');
  const icdRows = FALLBACK_ICDS.map(icdToRow);
  const { error: ie } = await supabase
    .from('icd_codes')
    .upsert(icdRows, { onConflict: 'code' });
  if (ie) { console.error('  ✗', ie.message); } else { console.log(`  ✓ ${icdRows.length} ICD codes`); }

  console.log('Seeding pos_codes...');
  const { error: pe } = await supabase
    .from('pos_codes')
    .upsert(POS_CODES.map(p => ({ code: p.code, name: p.name })), { onConflict: 'code' });
  if (pe) { console.error('  ✗', pe.message); } else { console.log(`  ✓ ${POS_CODES.length} POS codes`); }

  console.log('Seeding ccm_billing_periods...');
  const periodRows = CCM_BILLING_PERIODS.map(ccmPeriodToRow);
  const { error: cpe } = await supabase
    .from('ccm_billing_periods')
    .upsert(periodRows, { onConflict: 'id' });
  if (cpe) { console.error('  ✗', cpe.message); } else { console.log(`  ✓ ${periodRows.length} periods`); }

  console.log('Seeding ccm_billable_activities...');
  const activityRows = CCM_BILLABLE_ACTIVITIES.map(ccmActivityToRow);
  const { error: cae } = await supabase
    .from('ccm_billable_activities')
    .upsert(activityRows, { onConflict: 'id' });
  if (cae) { console.error('  ✗', cae.message); } else { console.log(`  ✓ ${activityRows.length} activities`); }

  console.log('Seeding ccm_billing_reports...');
  const reportRows = CCM_BILLING_REPORTS.map(ccmReportToRow);
  const { error: cre } = await supabase
    .from('ccm_billing_reports')
    .upsert(reportRows, { onConflict: 'id' });
  if (cre) { console.error('  ✗', cre.message); } else { console.log(`  ✓ ${reportRows.length} reports`); }

  console.log('Seeding ccm_worklist_members...');
  const worklistRows = CCM_WORKLIST_MEMBERS.map((m) => ccmWorklistToRow(m, foldIdMap));
  const { error: cwe } = await supabase
    .from('ccm_worklist_members')
    .upsert(worklistRows, { onConflict: 'id' });
  if (cwe) { console.error('  ✗', cwe.message); } else { console.log(`  ✓ ${worklistRows.length} worklist members`); }

  console.log('Seeding snp_worklist_members...');
  const snpWorklistRows = SNP_WORKLIST_MEMBERS.map((m) => snpWorklistToRow(m, foldIdMap));
  const { error: swe } = await supabase
    .from('snp_worklist_members')
    .upsert(snpWorklistRows, { onConflict: 'id' });
  if (swe) { console.error('  ✗', swe.message); } else { console.log(`  ✓ ${snpWorklistRows.length} SNP worklist members`); }

  console.log('Seeding practice_locations...');
  const locationRows = PRACTICE_LOCATIONS.map(practiceLocationToRow);
  const { error: ple } = await supabase
    .from('practice_locations')
    .upsert(locationRows, { onConflict: 'id' });
  if (ple) { console.error('  ✗', ple.message); } else { console.log(`  ✓ ${locationRows.length} practice locations`); }

  console.log('Seeding caregap_activity...');
  const caregapRows = Object.entries(CAREGAP_ACTIVITY_MOCK).flatMap(
    ([memberId, entries]) => entries.map(e => caregapActivityToRow(memberId, e)),
  );
  const { error: cge } = await supabase
    .from('caregap_activity')
    .upsert(caregapRows, { onConflict: 'id' });
  if (cge) { console.error('  ✗', cge.message); } else { console.log(`  ✓ ${caregapRows.length} care gap activity entries`); }

  // Re-seed HCC gaps + member DOS dates for the modernized patients. The
  // gaps table has no (member_name, code) unique key, so we delete-then-
  // insert per member (deterministic ids keep it idempotent).
  console.log('Re-seeding HCC diagnosis gaps (V28) for modernized patients...');
  for (const name of HCC_MODERNIZED) {
    const byId = new Map();
    for (const i of (ICDS[name] || [])) byId.set(`${name}::${i.code}`, gapToRow(name, i, true));
    for (const i of (NOT_LINKED[name] || [])) {
      const id = `${name}::${i.code}`;
      if (!byId.has(id)) byId.set(id, gapToRow(name, i, false));
    }
    const rows = [...byId.values()];
    await supabase.from('hcc_diagnosis_gaps').delete().eq('member_name', name);
    const { error: ge } = await supabase.from('hcc_diagnosis_gaps').insert(rows);
    if (ge) { console.error(`  ✗ ${name}:`, ge.message); continue; }
    const mem = HCC_MEMBER_BY_NAME[name];
    if (mem?.dos_list?.length) {
      const { error: me } = await supabase
        .from('hcc_members')
        .update({ dos_list: mem.dos_list })
        .eq('name', name);
      if (me) console.error(`  ✗ ${name} dos_list:`, me.message);
    }
    console.log(`  ✓ ${name} — ${rows.length} gaps`);
  }

  // Ensure EVERY worklist member has diagnosis gaps — curated where available,
  // deterministically generated (getIcdsForMember/getNotLinkedForMember) for the
  // rest — so no patient opens an empty drawer or an empty Open-ICDs popover.
  console.log('\nSeeding diagnosis gaps for all remaining members...');
  const { data: allMembers, error: mErr } = await supabase
    .from('hcc_members')
    .select('id, name, visit_type');
  if (mErr) {
    console.error('  ✗ could not read hcc_members:', mErr.message);
  } else {
    // Give every record a visit type from the canonical set (Figma
    // 4240-110502) so the Visit Type filter surfaces the real vocabulary
    // instead of a single value. Deterministic per record id.
    const VT_CANON = [
      'AWV - Annual Wellness Visit', 'IPPE - Initial Preventive Physical Exam',
      'APE - Annual Physical Exam', 'New Patient Office Visit',
      'Established Patient Office Visit', 'Telehealth Visit', 'Specialist Visit / Consult',
    ];
    const seedHash = (s) => { let h = 2166136261; for (let i = 0; i < String(s).length; i++) { h ^= String(s).charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
    let vtUpdated = 0;
    for (const m of (allMembers || [])) {
      const vt = VT_CANON[seedHash(m.id) % VT_CANON.length];
      const { error: ve } = await supabase.from('hcc_members').update({ visit_type: vt }).eq('id', m.id);
      if (!ve) vtUpdated++;
    }
    console.log(`  ✓ visit types set for ${vtUpdated} records`);

    const names = [...new Set((allMembers || []).map(m => m.name).filter(Boolean))]
      .filter(n => !HCC_MODERNIZED.includes(n)); // modernized already re-seeded above
    let seeded = 0;
    for (const name of names) {
      const byId = new Map();
      for (const i of getIcdsForMember(name)) byId.set(`${name}::${i.code}`, gapToRow(name, i, true));
      for (const i of getNotLinkedForMember(name)) {
        const id = `${name}::${i.code}`;
        if (!byId.has(id)) byId.set(id, gapToRow(name, i, false));
      }
      const rows = [...byId.values()];
      if (!rows.length) continue;
      await supabase.from('hcc_diagnosis_gaps').delete().eq('member_name', name);
      const { error: ge } = await supabase.from('hcc_diagnosis_gaps').insert(rows);
      if (ge) { console.error(`  ✗ ${name}:`, ge.message); continue; }
      seeded++;
    }
    console.log(`  ✓ seeded gaps for ${seeded} members`);
  }

  // ── Letters library (PDFs stored base64 in the `letters` table) ──
  const letterRows = LETTERS.map(letterToRow);
  const { error: lettersErr } = await supabase
    .from('letters')
    .upsert(letterRows, { onConflict: 'id' });
  console.log(lettersErr
    ? `  ✗ letters: ${lettersErr.message}`
    : `  ✓ letters (${letterRows.length})`);

  // ── Population Groups ──
  // The demo groups used to be concatenated onto the DB rows at render time,
  // which put rows in the table that Edit and Delete could never persist —
  // they had no row to write to. They live here instead so every group on
  // screen is a real record. Matched on name (id is a generated uuid), so
  // re-running never duplicates and never clobbers edits to other columns.
  {
    const { data: existing, error: exErr } = await supabase
      .from('population_groups')
      .select('name');
    if (exErr) {
      console.log(`  ✗ population_groups: ${exErr.message}`);
    } else {
      const have = new Set((existing || []).map(r => r.name));
      const missing = POP_GROUPS.filter(g => !have.has(g.name));
      if (missing.length === 0) {
        console.log(`  ✓ population_groups (all ${POP_GROUPS.length} demo groups already present)`);
      } else {
        // created_at comes from the mock's own date so the demo keeps its
        // spread of dates; updated_at matches it because a freshly seeded
        // group has never been edited. (The mock's own `updated` predates its
        // `created`, which is impossible — don't carry that over.)
        const rows = missing.map(g => {
          const createdIso = new Date(g.created).toISOString();
          return {
            name: g.name,
            group_type: g.type || 'Static',
            member_status: 'All Status',
            member_ids: [],
            active_count: g.count ?? 0,
            inactive_count: g.inactive ?? 0,
            created_at: createdIso,
            updated_at: createdIso,
          };
        });
        const { error: pgErr } = await supabase.from('population_groups').insert(rows);
        console.log(pgErr
          ? `  ✗ population_groups: ${pgErr.message}`
          : `  ✓ population_groups (${rows.length} added)`);
      }
    }
  }

  // ── Rule-builder patient-profile criteria fields ──
  // The dynamic group rule builder filters on p360_profiles columns added by
  // supabase/pop_group_rule_builder_migration.sql. Backfill deterministic
  // demo values per patient, but only where NULL/empty so hand-crafted rows
  // survive re-runs (same contract as seed_p360_banner.js).
  {
    const { data: profiles, error: pErr } = await supabase
      .from('p360_profiles')
      .select('id, patient_id, problems, diagnoses, diagnosis_groups, immunizations, medication_orders, procedures, lab_results, wearables, forms_submitted, membership_status, past_membership_status, engagement_level');
    if (pErr) {
      console.log(`  ✗ p360 criteria fields: ${pErr.message} — run supabase/pop_group_rule_builder_migration.sql first`);
    } else {
      // Deterministic pick: hash the patient id so re-runs are stable.
      const hash = (s) => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
      const pick = (id, arr, n = 1) => {
        const h = hash(id);
        return Array.from({ length: n }, (_, i) => arr[(h + i * 13) % arr.length]);
      };
      const PROBLEMS = ['Hypertension', 'Obesity', 'Chronic pain', 'Insomnia', 'Anxiety', 'Hyperlipidemia'];
      const DIAGNOSES = ['E11.9 Type 2 diabetes', 'I10 Essential hypertension', 'E78.5 Hyperlipidemia', 'J44.9 COPD', 'N18.3 CKD stage 3', 'F32.9 Major depressive disorder'];
      const DX_GROUPS = ['Cardiometabolic', 'Respiratory', 'Behavioral Health', 'Renal', 'Musculoskeletal'];
      const IMMUNIZATIONS = ['Influenza', 'COVID-19', 'Pneumococcal', 'Shingles', 'Tdap'];
      const MED_ORDERS = ['Metformin 500mg', 'Lisinopril 10mg', 'Atorvastatin 20mg', 'Albuterol inhaler', 'Sertraline 50mg'];
      const PROCEDURES = ['Colonoscopy', 'Echocardiogram', 'Knee arthroscopy', 'Cataract surgery', 'Skin biopsy'];
      const LABS = ['HbA1c 8.2%', 'LDL 130 mg/dL', 'eGFR 52', 'TSH 3.1', 'HbA1c 6.4%'];
      const WEARABLES = ['Fitbit', 'Apple Watch', 'Oura Ring', 'Dexcom G7'];
      const FORMS = ['PHQ-9', 'Annual Wellness HRA', 'GAD-7', 'Fall Risk Assessment'];
      const MEMBERSHIP = ['Active', 'Active', 'Active', 'Inactive', 'Pending']; // weighted toward Active
      const PAST = ['Active', 'Inactive', 'Churned', 'Pending'];
      const ENGAGEMENT = ['High', 'Medium', 'Low', 'Unreachable'];

      let filled = 0;
      for (const row of profiles || []) {
        const key = row.patient_id || row.id;
        const wants = {
          problems: pick(key, PROBLEMS, 2),
          diagnoses: pick(key, DIAGNOSES, 2),
          diagnosis_groups: pick(key, DX_GROUPS, 1),
          immunizations: pick(key, IMMUNIZATIONS, 2),
          medication_orders: pick(key, MED_ORDERS, 2),
          procedures: pick(key, PROCEDURES, 1),
          lab_results: pick(key, LABS, 1),
          wearables: pick(key + 'w', WEARABLES, 1),
          forms_submitted: pick(key + 'f', FORMS, 1),
          membership_status: pick(key + 'm', MEMBERSHIP, 1)[0],
          past_membership_status: pick(key + 'p', PAST, 1)[0],
          engagement_level: pick(key + 'e', ENGAGEMENT, 1)[0],
        };
        // Only fill columns that are still empty on this row.
        const patch = {};
        for (const [col, val] of Object.entries(wants)) {
          const cur = row[col];
          if (cur == null || (Array.isArray(cur) && cur.length === 0) || cur === '') patch[col] = val;
        }
        if (Object.keys(patch).length === 0) { continue; }
        const { error: uErr } = await supabase.from('p360_profiles').update(patch).eq('id', row.id);
        if (!uErr) filled++;
      }
      console.log(`  ✓ p360 criteria fields (${filled} profiles backfilled)`);
    }
  }

  console.log('\n✅  Seed complete. Run `bun run dev` to verify.\n');
}

main().catch(err => {
  console.error('\n❌  Fatal:', err.message);
  process.exit(1);
});
