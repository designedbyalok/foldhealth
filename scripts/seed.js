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
import { CARE_PLAN_MOCK } from '../src/features/patient/data/carePlanMock.js';
import { CARE_PLAN_BARRIER_LIBRARY, carePlanBarrierLibraryToRow } from '../src/features/settings/care-plan-library/data/barrierLibrarySeed.js';
import { CARE_PLAN_GOAL_LIBRARY, carePlanGoalLibraryToRow, carePlanGoalLibraryLinkRows } from '../src/features/settings/care-plan-library/data/carePlanGoalLibrarySeed.js';
import { CARE_PLAN_INTERVENTION_LIBRARY } from '../src/features/settings/care-plan-library/data/carePlanInterventionLibrarySeed.js';
import { CARE_PLAN_BARRIER_STRUCTURED_LIBRARY } from '../src/features/settings/care-plan-library/data/carePlanBarrierStructuredSeed.js';
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

  console.log('Seeding care_plan_barriers (library)...');
  const barrierLibraryRows = CARE_PLAN_BARRIER_LIBRARY.map(carePlanBarrierLibraryToRow);
  const { error: cplbErr } = await supabase
    .from('care_plan_barriers')
    .upsert(barrierLibraryRows, { onConflict: 'id' });
  if (cplbErr) {
    if (cplbErr.code === '42P01' || cplbErr.code === 'PGRST205') {
      console.log('  ⚠ care_plan_barriers table missing — run supabase/care_plan_library_migration.sql first');
    } else {
      console.error('  ✗', cplbErr.message);
    }
  } else {
    console.log(`  ✓ ${barrierLibraryRows.length} library barriers`);
  }

  // Structured GIB library (seeded from structured_care_plan_goals_library.md).
  console.log('Seeding care_plan_barriers (structured library)...');
  const { error: cpbsErr } = await supabase
    .from('care_plan_barriers')
    .upsert(CARE_PLAN_BARRIER_STRUCTURED_LIBRARY, { onConflict: 'id' });
  if (cpbsErr) console.error('  ✗', cpbsErr.message);
  else console.log(`  ✓ ${CARE_PLAN_BARRIER_STRUCTURED_LIBRARY.length} structured barriers`);

  console.log('Seeding care_plan_intervention_templates (library)...');
  const { error: cpitErr } = await supabase
    .from('care_plan_intervention_templates')
    .upsert(CARE_PLAN_INTERVENTION_LIBRARY, { onConflict: 'id' });
  if (cpitErr) {
    if (cpitErr.code === '42P01' || cpitErr.code === 'PGRST205') {
      console.log('  ⚠ care_plan_intervention_templates missing — run supabase/care_plan_intervention_templates_migration.sql');
    } else console.error('  ✗', cpitErr.message);
  } else console.log(`  ✓ ${CARE_PLAN_INTERVENTION_LIBRARY.length} intervention templates`);

  console.log('Seeding care_plan_goals (library)...');
  const goalLibraryRows = CARE_PLAN_GOAL_LIBRARY.map(carePlanGoalLibraryToRow);
  const { error: cpgErr } = await supabase
    .from('care_plan_goals')
    .upsert(goalLibraryRows, { onConflict: 'id' });
  if (cpgErr) console.error('  ✗', cpgErr.message);
  else console.log(`  ✓ ${goalLibraryRows.length} library goals`);

  console.log('Seeding care_plan_interventions (goal GIB links)...');
  const goalLinkRows = CARE_PLAN_GOAL_LIBRARY.flatMap(carePlanGoalLibraryLinkRows);
  const { error: cpglErr } = await supabase
    .from('care_plan_interventions')
    .upsert(goalLinkRows, { onConflict: 'id' });
  if (cpglErr) console.error('  ✗', cpglErr.message);
  else console.log(`  ✓ ${goalLinkRows.length} goal-linked interventions/barriers`);

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
      .select('id, patient_id, age, sex_at_birth, gender_identity, state, zipcode, problems, diagnoses, diagnosis_groups, immunizations, medication_orders, procedures, lab_results, wearables, forms_submitted, membership_status, past_membership_status, engagement_level');
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

      // Core demographic criteria fields (age / sex / gender / state / zip)
      // derive from the profile's identity row — patients for p# ids,
      // all_patients for FOLD# / ap-# — falling back to deterministic values.
      // Without these the rule builder's Personal Info and Location
      // conditions have nothing to evaluate against.
      const { data: idPts } = await supabase.from('patients').select('id, age, dob, gender, state');
      const { data: idAps } = await supabase.from('all_patients').select('id, age, dob, gender, state, zip');
      const identityById = new Map();
      (idPts || []).forEach(p => identityById.set(p.id, p));
      (idAps || []).forEach(p => identityById.set(p.id, p));
      const STATES = ['CA', 'TX', 'NY', 'FL', 'WA', 'AZ', 'IL', 'CO'];
      const parseAge = (v) => { const m = String(v ?? '').match(/\d{1,3}/); return m ? Number(m[0]) : null; };
      const ageFromDob = (dob) => {
        if (!dob) return null;
        const d = new Date(dob);
        if (Number.isNaN(d.getTime())) return null;
        const now = new Date();
        let a = now.getFullYear() - d.getFullYear();
        if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) a--;
        return a > 0 && a < 120 ? a : null;
      };
      const mapSex = (g) => {
        const s = String(g || '').toLowerCase();
        return s.startsWith('m') ? 'Male' : s.startsWith('f') ? 'Female' : null;
      };

      let filled = 0;
      for (const row of profiles || []) {
        const key = row.patient_id || row.id;
        const idr = identityById.get(row.patient_id) || {};
        const wants = {
          age: ageFromDob(idr.dob) ?? parseAge(idr.age) ?? (25 + hash(key) % 65),
          sex_at_birth: mapSex(idr.gender) || pick(key + 's', ['Male', 'Female'])[0],
          gender_identity: mapSex(idr.gender) || pick(key + 's', ['Male', 'Female'])[0],
          state: idr.state || pick(key + 'st', STATES)[0],
          zipcode: idr.zip || String(90001 + hash(key + 'z') % 9000),
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

  // ── Population group activity log ──
  // Give every group a "created" entry stamped at its created_at so the
  // History drawer has a trail from day one. Skips groups that already have
  // any activity, so re-runs never duplicate and real history is preserved.
  {
    const { data: groups, error: gErr } = await supabase
      .from('population_groups').select('id, name, group_type, created_at');
    const { data: acts, error: aErr } = gErr ? { data: null, error: gErr }
      : await supabase.from('pop_group_activity').select('group_id');
    if (gErr || aErr) {
      console.log(`  ✗ pop_group_activity: ${(gErr || aErr).message} — run supabase/pop_group_activity_migration.sql first`);
    } else {
      const have = new Set((acts || []).map(a => a.group_id));
      const rows = (groups || [])
        .filter(g => !have.has(g.id))
        .map(g => ({
          group_id: g.id,
          action: 'create',
          title: 'Population Group Created',
          detail: `"${g.name}" (${g.group_type})`,
          actor: 'Fold Demo',
          created_at: g.created_at,
        }));
      if (rows.length === 0) {
        console.log('  ✓ pop_group_activity (all groups already have history)');
      } else {
        const { error } = await supabase.from('pop_group_activity').insert(rows);
        console.log(error ? `  ✗ pop_group_activity: ${error.message}` : `  ✓ pop_group_activity (${rows.length} created entries)`);
      }
    }
  }

  // ── Rule templates for the Import Rule drawer ──
  {
    const TEMPLATES = [
      {
        name: 'Diabetes Management',
        description: 'Patients with diabetes diagnosis and HbA1c above target',
        category: 'Chronic Care',
        rule: { combinator: 'and', rules: [
          { id: 'tpl-dm-1', field: 'diagnosis', operator: 'contains', value: { text: 'Diabetes' } },
          { id: 'tpl-dm-2', field: 'labResult', operator: 'contains', value: { text: 'HbA1c' } },
        ] },
      },
      {
        name: 'Fall Risk — Age 65+',
        description: 'Seniors at elevated fall risk: age ≥ 65 with a fall-risk problem',
        category: 'Risk Management',
        rule: { combinator: 'and', rules: [
          { id: 'tpl-fr-1', field: 'patientAge', operator: '>=', value: { amount: 65, asOfMode: 'today' } },
          { id: 'tpl-fr-2', field: 'problem', operator: 'contains', value: { text: 'Fall Risk' } },
        ] },
      },
      {
        name: 'Hypertension Screening',
        description: 'Active patients with hypertension diagnosis',
        category: 'Chronic Care',
        rule: { combinator: 'and', rules: [
          { id: 'tpl-ht-1', field: 'diagnosis', operator: 'contains', value: { text: 'Hypertension' } },
          { id: 'tpl-ht-2', field: 'membershipStatus', operator: '=', value: { text: 'Active' } },
        ] },
      },
      {
        name: 'Disengaged Patients',
        description: 'Low-engagement patients who may need outreach',
        category: 'Care Coordination',
        rule: { combinator: 'and', rules: [
          { id: 'tpl-de-1', field: 'patientEngagement', operator: '=', value: { text: 'Low' } },
          { id: 'tpl-de-2', field: 'membershipStatus', operator: '=', value: { text: 'Active' } },
        ] },
      },
      {
        name: 'Preventive — Women 50+',
        description: 'Female patients 50+ for preventive screenings (mammography, colonoscopy)',
        category: 'Preventive Care',
        rule: { combinator: 'and', rules: [
          { id: 'tpl-pw-1', field: 'patientAge', operator: '>=', value: { amount: 50, asOfMode: 'today' } },
          { id: 'tpl-pw-2', field: 'sexAtBirth', operator: '=', value: { text: 'Female' } },
        ] },
      },
      {
        name: 'Uncontrolled Diabetes (ICD-10)',
        description: 'Patients with Type 2 diabetes (E11.x) and HbA1c ≥ 9.0% in the last 12 months',
        category: 'Chronic Care',
        rule: { combinator: 'and', rules: [
          { id: 'tpl-ud-1', field: 'codedDiagnosis', operator: 'hasCode', value: { code: 'E11.9', display: 'Type 2 diabetes mellitus, without complications', system: 'icd10' } },
          { id: 'tpl-ud-2', field: 'observation', operator: '>=', value: { analyte: { code: '4548-4', display: 'Hemoglobin A1c/Hemoglobin.total', system: 'loinc' }, numericValue: 9.0, unit: '%', lookback: { amount: 12, unit: 'months' } } },
        ] },
      },
      {
        name: 'Frequent ED Utilizers',
        description: 'Patients with 2+ emergency department visits in the last 6 months',
        category: 'Risk Management',
        rule: { combinator: 'and', rules: [
          { id: 'tpl-ed-1', field: 'eventCount', operator: '>=', value: { eventType: 'encounter', count: 2, lookback: { amount: 6, unit: 'months' } } },
          { id: 'tpl-ed-2', field: 'membershipStatus', operator: '=', value: { text: 'Active' } },
        ] },
      },
      {
        name: 'Statin Therapy Candidates',
        description: 'Patients on statin medication with LDL ≥ 190 mg/dL',
        category: 'Preventive Care',
        rule: { combinator: 'and', rules: [
          { id: 'tpl-st-1', field: 'codedMedication', operator: 'hasCode', value: { code: '36567', display: 'Atorvastatin 40 MG Oral Tablet', system: 'rxnorm' } },
          { id: 'tpl-st-2', field: 'observation', operator: '>=', value: { analyte: { code: '2089-1', display: 'LDL Cholesterol', system: 'loinc' }, numericValue: 190, unit: 'mg/dL', lookback: { amount: 12, unit: 'months' } } },
        ] },
      },
      {
        name: 'Overdue AWV (65+)',
        description: 'Medicare patients 65+ with no Annual Wellness Visit in the last 18 months',
        category: 'Preventive Care',
        rule: { combinator: 'and', rules: [
          { id: 'tpl-awv-1', field: 'patientAge', operator: '>=', value: { amount: 65, asOfMode: 'today' } },
          { id: 'tpl-awv-2', field: 'codedProcedure', operator: 'notHasCode', value: { code: 'G0438', display: 'Annual wellness visit, initial', system: 'cpt', lookback: { amount: 18, unit: 'months' } } },
        ] },
      },
    ];
    const { data: existing, error: exErr } = await supabase
      .from('pop_group_rule_templates')
      .select('name');
    if (exErr) {
      console.log(`  ✗ pop_group_rule_templates: ${exErr.message} — run supabase/pop_group_rule_templates_migration.sql first`);
    } else {
      const have = new Set((existing || []).map(t => t.name));
      const rows = TEMPLATES.filter(t => !have.has(t.name));
      if (rows.length === 0) {
        console.log(`  ✓ pop_group_rule_templates (all ${TEMPLATES.length} templates already present)`);
      } else {
        const { error: tErr } = await supabase.from('pop_group_rule_templates').insert(rows);
        console.log(tErr
          ? `  ✗ pop_group_rule_templates: ${tErr.message}`
          : `  ✓ pop_group_rule_templates (${rows.length} added)`);
      }
    }
  }

  /* ── patient_clinical_events (coded terminology events for healthcare rules) ── */
  {
    const CLINICAL_EVENTS = [
      // Annette Brave — diabetes, labs, medications
      { patient_id: 'p1', event_type: 'diagnosis', code: 'E11.9', code_system: 'icd10', display: 'Type 2 diabetes mellitus, without complications', effective_date: '2025-08-15', status: 'active' },
      { patient_id: 'p1', event_type: 'diagnosis', code: 'I10', code_system: 'icd10', display: 'Essential (primary) hypertension', effective_date: '2024-03-10', status: 'active' },
      { patient_id: 'p1', event_type: 'lab', code: '4548-4', code_system: 'loinc', display: 'Hemoglobin A1c/Hemoglobin.total', effective_date: '2026-05-20', numeric_value: 9.2, unit: '%' },
      { patient_id: 'p1', event_type: 'lab', code: '2345-7', code_system: 'loinc', display: 'Glucose [Mass/volume] in Serum or Plasma', effective_date: '2026-05-20', numeric_value: 210, unit: 'mg/dL' },
      { patient_id: 'p1', event_type: 'medication', code: '860975', code_system: 'rxnorm', display: 'Metformin hydrochloride 500 MG', effective_date: '2025-01-15', status: 'active' },
      { patient_id: 'p1', event_type: 'encounter', code: '99213', code_system: 'cpt', display: 'Office or other outpatient visit', effective_date: '2026-06-01' },
      { patient_id: 'p1', event_type: 'encounter', code: '99281', code_system: 'cpt', display: 'Emergency department visit, level 1', effective_date: '2026-04-12' },
      { patient_id: 'p1', event_type: 'encounter', code: '99282', code_system: 'cpt', display: 'Emergency department visit, level 2', effective_date: '2026-03-05' },

      // William Jammy — COPD, labs
      { patient_id: 'p2', event_type: 'diagnosis', code: 'J44.1', code_system: 'icd10', display: 'Chronic obstructive pulmonary disease with acute exacerbation', effective_date: '2025-11-20', status: 'active' },
      { patient_id: 'p2', event_type: 'diagnosis', code: 'E78.5', code_system: 'icd10', display: 'Dyslipidemia, unspecified', effective_date: '2024-06-15', status: 'active' },
      { patient_id: 'p2', event_type: 'lab', code: '2089-1', code_system: 'loinc', display: 'LDL Cholesterol', effective_date: '2026-02-10', numeric_value: 195, unit: 'mg/dL' },
      { patient_id: 'p2', event_type: 'medication', code: '36567', code_system: 'rxnorm', display: 'Atorvastatin 40 MG Oral Tablet', effective_date: '2025-06-01', status: 'active' },
      { patient_id: 'p2', event_type: 'procedure', code: 'G0438', code_system: 'cpt', display: 'Annual wellness visit, initial', effective_date: '2025-09-15' },

      // Grace Hill — CHF, multiple encounters
      { patient_id: 'p3', event_type: 'diagnosis', code: 'I50.9', code_system: 'icd10', display: 'Heart failure, unspecified', effective_date: '2025-04-02', status: 'active' },
      { patient_id: 'p3', event_type: 'lab', code: '4548-4', code_system: 'loinc', display: 'Hemoglobin A1c/Hemoglobin.total', effective_date: '2026-06-15', numeric_value: 7.1, unit: '%' },
      { patient_id: 'p3', event_type: 'encounter', code: '99283', code_system: 'cpt', display: 'Emergency department visit, level 3', effective_date: '2026-05-20' },
      { patient_id: 'p3', event_type: 'encounter', code: '99284', code_system: 'cpt', display: 'Emergency department visit, level 4', effective_date: '2026-07-01' },
      { patient_id: 'p3', event_type: 'encounter', code: '99285', code_system: 'cpt', display: 'Emergency department visit, level 5', effective_date: '2026-04-05' },
      { patient_id: 'p3', event_type: 'immunization', code: '135', code_system: 'cvx', display: 'Influenza, high dose', effective_date: '2025-10-01' },

      // Kevin Brown — CKD, labs, meds
      { patient_id: 'p4', event_type: 'diagnosis', code: 'N18.3', code_system: 'icd10', display: 'Chronic kidney disease, stage 3', effective_date: '2025-07-10', status: 'active' },
      { patient_id: 'p4', event_type: 'diagnosis', code: 'E11.65', code_system: 'icd10', display: 'Type 2 diabetes mellitus with hyperglycemia', effective_date: '2025-01-20', status: 'active' },
      { patient_id: 'p4', event_type: 'lab', code: '4548-4', code_system: 'loinc', display: 'Hemoglobin A1c/Hemoglobin.total', effective_date: '2026-07-10', numeric_value: 10.1, unit: '%' },
      { patient_id: 'p4', event_type: 'lab', code: '2160-0', code_system: 'loinc', display: 'Creatinine [Mass/volume] in Serum or Plasma', effective_date: '2026-07-10', numeric_value: 2.1, unit: 'mg/dL' },
      { patient_id: 'p4', event_type: 'medication', code: '860975', code_system: 'rxnorm', display: 'Metformin hydrochloride 500 MG', effective_date: '2025-03-01', status: 'active' },
      { patient_id: 'p4', event_type: 'medication', code: '36567', code_system: 'rxnorm', display: 'Atorvastatin 40 MG Oral Tablet', effective_date: '2025-03-01', status: 'active' },

      // Jessica Clark — healthy, preventive care
      { patient_id: 'p5', event_type: 'diagnosis', code: 'Z00.00', code_system: 'icd10', display: 'Encounter for general adult medical exam without abnormal findings', effective_date: '2026-01-15' },
      { patient_id: 'p5', event_type: 'procedure', code: '77067', code_system: 'cpt', display: 'Screening mammography, bilateral', effective_date: '2026-01-15' },
      { patient_id: 'p5', event_type: 'lab', code: '2089-1', code_system: 'loinc', display: 'LDL Cholesterol', effective_date: '2026-01-15', numeric_value: 120, unit: 'mg/dL' },
      { patient_id: 'p5', event_type: 'immunization', code: '213', code_system: 'cvx', display: 'SARS-COV-2 (COVID-19) vaccine', effective_date: '2025-11-01' },
    ];

    const { data: existing, error: exErr } = await supabase
      .from('patient_clinical_events')
      .select('id')
      .limit(1);
    if (exErr) {
      console.log(`  ✗ patient_clinical_events: ${exErr.message} — run supabase/patient_clinical_events_migration.sql first`);
    } else if (existing?.length) {
      console.log(`  ✓ patient_clinical_events (already seeded)`);
    } else {
      const { error: insErr } = await supabase
        .from('patient_clinical_events')
        .insert(CLINICAL_EVENTS);
      console.log(insErr
        ? `  ✗ patient_clinical_events: ${insErr.message}`
        : `  ✓ patient_clinical_events (${CLINICAL_EVENTS.length} events seeded)`);
    }
  }

  // ── Notifications (bell feed) ──
  // Normally these are written by the `tasks_emit_notifications` trigger, not
  // by hand — assigning a task or @mentioning someone produces them. This
  // block only backfills a couple of rows for the demo account so the bell
  // has something in it on a fresh database, before anyone has touched a task.
  {
    const { data: probe, error: probeErr } = await supabase
      .from('notifications')
      .select('id')
      .limit(1);
    if (probeErr) {
      console.log(`  ✗ notifications: ${probeErr.message} — run supabase/notifications_migration.sql first`);
    } else if (probe?.length) {
      console.log('  ✓ notifications (already present)');
    } else {
      // Recipient is the dev/demo identity the app signs in as; actor is any
      // other profile so the row doesn't read as self-inflicted.
      const { data: demo } = await supabase
        .from('profiles').select('id, full_name').eq('email', 'demo@fold.health').maybeSingle();
      const { data: actor } = await supabase
        .from('profiles').select('id, full_name').eq('email', 'alokk@fold.health').maybeSingle();
      const { data: someTasks } = await supabase
        .from('tasks').select('id, name').order('id', { ascending: true }).limit(2);

      if (!demo?.id || !someTasks?.length) {
        console.log('  ⤵ notifications skipped (needs the demo profile + at least one task)');
      } else {
        const rows = someTasks.map((t, i) => ({
          recipient_id: demo.id,
          actor_id: actor?.id || null,
          actor_name: actor?.full_name || 'Alok Kumar',
          type: i === 0 ? 'task.assigned' : 'task.mentioned',
          title: i === 0 ? 'You were assigned a task' : 'You were mentioned in a task',
          body: t.name,
          action: 'openTask',
          task_id: t.id,
          read: false,
        }));
        const { error: insErr } = await supabase.from('notifications').insert(rows);
        console.log(insErr
          ? `  ✗ notifications: ${insErr.message}`
          : `  ✓ notifications (${rows.length} seeded for demo@fold.health)`);
      }
    }
  }

  // ── Patient Care Plan (demo) ──
  // The Care Plan step is Supabase-backed (patient_care_plan_* tables). There is
  // no seeded patient/program to attach to at build time, so we instantiate one
  // live plan against the first real patient — enough to prove the pipeline. All
  // other programs fall back to CARE_PLAN_MOCK in the UI until a user edits them.
  console.log('\nSeeding patient care plan (demo)...');
  {
    const { data: firstPatient, error: fpErr } = await supabase
      .from('patients').select('id, name').order('id', { ascending: true }).limit(1).maybeSingle();
    if (fpErr || !firstPatient) {
      console.log(`  ✗ patient_care_plan: ${fpErr?.message || 'no patients found — seed patients first'}`);
    } else {
      const patientId = firstPatient.id;
      const programId = `pcp-${patientId}-CCM`;
      // Make sure the program exists so the plan is reachable in the UI.
      const { error: progErr } = await supabase.from('patient_care_programs').upsert({
        id: programId, patient_id: patientId, code: 'CCM',
        name: 'Chronic Care Management (CCM)', status: 'Enrolled',
        status_color: 'var(--status-success)', progress: 0,
      }, { onConflict: 'id' });
      if (progErr) console.log(`  ✗ demo program: ${progErr.message}`);

      const { data: planRow, error: planErr } = await supabase.from('patient_care_plans').upsert({
        patient_id: patientId, program_id: programId, program_code: 'CCM',
        created_by: CARE_PLAN_MOCK.createdBy,
        conditions: CARE_PLAN_MOCK.conditions.map(c => c.label),
        condition_total: CARE_PLAN_MOCK.conditionTotal,
      }, { onConflict: 'patient_id,program_id' }).select().single();

      if (planErr) {
        console.log(`  ✗ patient_care_plans: ${planErr.message} — run supabase/patient_care_plan_migration.sql first`);
      } else {
        // Delete-then-insert children keeps re-runs idempotent without needing
        // deterministic child ids (same pattern as HCC gaps above).
        await supabase.from('patient_care_plan_goals').delete().eq('plan_id', planRow.id);
        await supabase.from('patient_care_plan_interventions').delete().eq('plan_id', planRow.id);
        await supabase.from('patient_care_plan_barriers').delete().eq('plan_id', planRow.id);
        await supabase.from('patient_care_plan_automations').delete().eq('plan_id', planRow.id);
        await supabase.from('care_plan_audit').delete().eq('patient_id', patientId).eq('program_id', programId);

        const bpTitle = 'Target an average blood pressure';
        const goalRows = CARE_PLAN_MOCK.goals.map((g, idx) => ({
          plan_id: planRow.id, title: g.title, subtitle: g.subtitle || '',
          icon: g.icon, priority: g.priority || 'medium',
          current_value: g.currentValue || '', trend: g.trend || '-',
          status: g.title === bpTitle ? 'In Progress' : (g.status || 'Not Started'),
          progress: g.title === bpTitle ? 70 : 0,
          updated_by: g.title === bpTitle ? 'Ivy Ralph' : null,
          conditions: g.title === bpTitle ? ['Hypertension', 'Diabetes Mellitus Type 2'] : [],
          custom_unit: g.title === bpTitle ? 'mmHg' : '',
          sort_order: idx,
        }));
        const { data: insertedGoals, error: gErr } = await supabase
          .from('patient_care_plan_goals').insert(goalRows).select();

        const bpGoal = (insertedGoals || []).find(g => g.title === bpTitle);

        const intvRows = CARE_PLAN_MOCK.interventions.map((i, idx) => ({
          plan_id: planRow.id, kind: 'internal-task', title: i.title,
          icon: i.icon, duration: i.duration || null,
          goal_id: bpGoal?.id || null,
          assignee_name: i.assignee?.name || 'Unassigned',
          assignee_initials: i.assignee?.initials || '',
          status: i.status || 'Not Started', adherence: i.adherence || '-', sort_order: idx,
        }));
        const { error: iErr } = await supabase.from('patient_care_plan_interventions').insert(intvRows);

        const { error: bErr } = await supabase.from('patient_care_plan_barriers').insert(
          CARE_PLAN_MOCK.barriers.map((b, idx) => ({
            plan_id: planRow.id, goal_id: bpGoal?.id || null,
            title: b.title, description: b.description || '',
            status: b.status || 'Not Started', priority: b.priority || 'medium', sort_order: idx,
          })),
        );

        let mErr = null;
        let aErr = null;
        let auditErr = null;
        if (bpGoal) {
          const now = Date.now();
          const DAY = 86400000;
          const { error } = await supabase.from('patient_care_plan_goal_measurements').insert([
            { goal_id: bpGoal.id, value: '145/90', unit: 'mmHg', favorable: true,  taken_at: new Date(now - 30 * DAY).toISOString(), sort_order: 0 },
            { goal_id: bpGoal.id, value: '130/80', unit: 'mmHg', favorable: false, taken_at: new Date(now - 18 * DAY).toISOString(), sort_order: 1 },
            { goal_id: bpGoal.id, value: '120/80', unit: 'mmHg', favorable: false, taken_at: new Date(now - 7 * DAY).toISOString(), sort_order: 2 },
            { goal_id: bpGoal.id, value: '139/90', unit: 'mmHg', favorable: true,  taken_at: new Date(now - 3 * DAY).toISOString(), sort_order: 3 },
            { goal_id: bpGoal.id, value: '128/85', unit: 'mmHg', favorable: false, taken_at: new Date(now - 10 * 3600000).toISOString(), sort_order: 4 },
          ]);
          mErr = error;
          if (!mErr) {
            await supabase.from('patient_care_plan_goals').update({
              current_value: '128/85 mmHg',
              trend: '↓',
            }).eq('id', bpGoal.id);
          }
          const auto = await supabase.from('patient_care_plan_automations').insert({
            plan_id: planRow.id, goal_id: bpGoal.id,
            title: 'Notify my care team if systolic BP has 5% deviation',
            icon: 'solar:bolt-linear', enabled: true, sort_order: 0,
          });
          aErr = auto.error;
          const actor = 'Ivy Ralph';
          const audit = await supabase.from('care_plan_audit').insert([
            { patient_id: patientId, program_id: programId, program_code: 'CCM', entity_type: 'goal', entity_id: bpGoal.id, action: 'created', summary: bpTitle, detail: '', actor, created_at: new Date(now - 8 * DAY).toISOString() },
            { patient_id: patientId, program_id: programId, program_code: 'CCM', entity_type: 'goal', entity_id: bpGoal.id, action: 'status_changed', summary: bpTitle, detail: 'Not Started → In Progress', actor, created_at: new Date(now - 6 * DAY).toISOString() },
            { patient_id: patientId, program_id: programId, program_code: 'CCM', entity_type: 'goal', entity_id: bpGoal.id, action: 'note', summary: `Note on ${bpTitle}`, detail: "Patient's BP at the start of goal tracking was 145/90. Initial focus to be on lifestyle adjustments before considering medication changes.", actor, created_at: new Date(now - 5 * DAY).toISOString() },
            { patient_id: patientId, program_id: programId, program_code: 'CCM', entity_type: 'goal', entity_id: bpGoal.id, action: 'progress_changed', summary: bpTitle, detail: '0% - Poor → 70% - Moderate', actor, created_at: new Date(now - 2 * DAY).toISOString() },
            { patient_id: patientId, program_id: programId, program_code: 'CCM', entity_type: 'goal', entity_id: bpGoal.id, action: 'value_changed', summary: bpTitle, detail: '160/110 → 140/90', actor, created_at: new Date(now - DAY).toISOString() },
          ]);
          auditErr = audit.error;
        }

        const skipMissing = (err) => err && err.code !== '42P01' && err.code !== 'PGRST205' ? err : null;
        const childErr = gErr || iErr || skipMissing(bErr) || skipMissing(mErr) || skipMissing(aErr) || skipMissing(auditErr);
        console.log(childErr
          ? `  ✗ care plan children: ${childErr.message}`
          : `  ✓ patient care plan for "${firstPatient.name}" (${goalRows.length} goals, ${intvRows.length} interventions${bpGoal ? ', BP readings + activity' : ''})`);
      }

      // SNP plans already have live goals — enrich the Figma BP goal so Goal
      // Details can show 70% progress, mmHg readings, and typed activity.
      const snpBpTitle = 'Target an average blood pressure';
      const { data: snpProgs } = await supabase
        .from('patient_care_programs').select('id, patient_id').eq('code', 'SNP');
      let snpEnriched = 0;
      for (const prog of snpProgs || []) {
        const { data: snpPlan } = await supabase.from('patient_care_plans')
          .select('id').eq('patient_id', prog.patient_id).eq('program_id', prog.id).maybeSingle();
        if (!snpPlan) continue;
        const { data: snpGoals } = await supabase.from('patient_care_plan_goals')
          .select('id, title').eq('plan_id', snpPlan.id);
        const snpBp = (snpGoals || []).find(g => g.title === snpBpTitle);
        if (!snpBp) continue;
        await supabase.from('patient_care_plan_goals').update({
          status: 'In Progress', progress: 70, updated_by: 'Ivy Ralph',
          conditions: ['Hypertension', 'Diabetes Mellitus Type 2'], custom_unit: 'mmHg',
        }).eq('id', snpBp.id);
        await supabase.from('patient_care_plan_goal_measurements').delete().eq('goal_id', snpBp.id);
        const snpNow = Date.now();
        const DAY = 86400000;
        const mm = await supabase.from('patient_care_plan_goal_measurements').insert([
          { goal_id: snpBp.id, value: '145/90', unit: 'mmHg', favorable: true,  taken_at: new Date(snpNow - 30 * DAY).toISOString(), sort_order: 0 },
          { goal_id: snpBp.id, value: '130/80', unit: 'mmHg', favorable: false, taken_at: new Date(snpNow - 18 * DAY).toISOString(), sort_order: 1 },
          { goal_id: snpBp.id, value: '120/80', unit: 'mmHg', favorable: false, taken_at: new Date(snpNow - 7 * DAY).toISOString(), sort_order: 2 },
          { goal_id: snpBp.id, value: '139/90', unit: 'mmHg', favorable: true,  taken_at: new Date(snpNow - 3 * DAY).toISOString(), sort_order: 3 },
          { goal_id: snpBp.id, value: '128/85', unit: 'mmHg', favorable: false, taken_at: new Date(snpNow - 10 * 3600000).toISOString(), sort_order: 4 },
        ]);
        if (mm.error && mm.error.code !== '42P01' && mm.error.code !== 'PGRST205') {
          console.log(`  ✗ SNP BP readings: ${mm.error.message}`);
          continue;
        }
        await supabase.from('patient_care_plan_goals').update({
          current_value: '128/85 mmHg',
          trend: '↓',
        }).eq('id', snpBp.id);
        await supabase.from('patient_care_plan_automations').delete().eq('plan_id', snpPlan.id).eq('goal_id', snpBp.id);
        await supabase.from('patient_care_plan_automations').insert({
          plan_id: snpPlan.id, goal_id: snpBp.id,
          title: 'Notify my care team if systolic BP has 5% deviation',
          icon: 'solar:bolt-linear', enabled: true, sort_order: 0,
        });
        await supabase.from('care_plan_audit').delete().eq('patient_id', prog.patient_id).eq('program_id', prog.id).eq('entity_id', snpBp.id);
        const actor = 'Ivy Ralph';
        await supabase.from('care_plan_audit').insert([
          { patient_id: prog.patient_id, program_id: prog.id, program_code: 'SNP', entity_type: 'goal', entity_id: snpBp.id, action: 'created', summary: snpBpTitle, detail: '', actor, created_at: new Date(snpNow - 8 * DAY).toISOString() },
          { patient_id: prog.patient_id, program_id: prog.id, program_code: 'SNP', entity_type: 'goal', entity_id: snpBp.id, action: 'status_changed', summary: snpBpTitle, detail: 'Not Started → In Progress', actor, created_at: new Date(snpNow - 6 * DAY).toISOString() },
          { patient_id: prog.patient_id, program_id: prog.id, program_code: 'SNP', entity_type: 'goal', entity_id: snpBp.id, action: 'note', summary: `Note on ${snpBpTitle}`, detail: "Patient's BP at the start of goal tracking was 145/90. Initial focus to be on lifestyle adjustments before considering medication changes.", actor, created_at: new Date(snpNow - 5 * DAY).toISOString() },
          { patient_id: prog.patient_id, program_id: prog.id, program_code: 'SNP', entity_type: 'goal', entity_id: snpBp.id, action: 'progress_changed', summary: snpBpTitle, detail: '0% - Poor → 70% - Moderate', actor, created_at: new Date(snpNow - 2 * DAY).toISOString() },
          { patient_id: prog.patient_id, program_id: prog.id, program_code: 'SNP', entity_type: 'goal', entity_id: snpBp.id, action: 'value_changed', summary: snpBpTitle, detail: '160/110 → 140/90', actor, created_at: new Date(snpNow - DAY).toISOString() },
        ]);
        snpEnriched += 1;
      }
      if (snpEnriched) console.log(`  ✓ SNP Goal Details demo data (${snpEnriched} BP goal${snpEnriched === 1 ? '' : 's'})`);
    }
  }

  console.log('\n✅  Seed complete. Run `bun run dev` to verify.\n');
}

main().catch(err => {
  console.error('\n❌  Fatal:', err.message);
  process.exit(1);
});
