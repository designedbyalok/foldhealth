/**
 * The "SNP Snapshot" form: the SNP program's Snapshot step (Trigger
 * Information, Member & Eligibility, Outreach & Engagement, Care Plan (ICP),
 * Transitions of Care (TOC), Risk Stratification). It lives in
 * Settings > Content > Forms like any other form, so it can be edited in the
 * Form builder; this definition seeds it (scripts/seed.js,
 * supabase/snp_snapshot_form_migration.sql) and stands in until it's seeded.
 *
 * Builder schema (src/features/forms/builder/componentCatalog.js), plus two
 * Snapshot keys: `readOnly` (shown greyed, filled from the member's record)
 * and the section `columns` count the Snapshot lays its fields out in.
 */

import { SNP_TRIGGER_TYPES } from '../../patient/data/snpTriggerTypes.js';

export const SNAPSHOT_FORM_SUFFIX = 'Snapshot';
/** The Snapshot form a program uses: "<CODE> Snapshot", e.g. "SNP Snapshot". */
export const snapshotFormName = code => `${code} ${SNAPSHOT_FORM_SUFFIX}`;
export const SNP_SNAPSHOT_FORM_NAME = snapshotFormName('SNP');

const YES_NO = [{ value: 'Yes' }, { value: 'No' }];
const date = (linkId, text) => ({ linkId, type: 'date', text });
const readOnly = (linkId, text) => ({ linkId, type: 'string', text, placeholder: text, readOnly: true });
const yesNo = (linkId, text) => ({ linkId, type: 'choice', control: 'radio', text, options: YES_NO });
const section = (linkId, text, items) => ({ linkId, type: 'group', text, columns: 3, items });

const items = [
  section('trigger', 'Trigger Information', [
    {
      linkId: 'trigger_type', type: 'choice', control: 'dropdown', text: 'Trigger Type', readOnly: true,
      options: SNP_TRIGGER_TYPES.map(value => ({ value })),
    },
    date('trigger_date', 'Trigger Date'),
    date('first_outreach_due', 'First Outreach Due Date'),
    date('icp_due', 'ICP Due Date'),
    date('ict_due', 'ICT Due Date'),
    date('managed_by_hp', 'Managed by HP'),
  ]),
  section('eligibility', 'Member & Eligibility', [
    readOnly('medicaid_id', 'Medicaid ID'),
    readOnly('health_plan', 'Health Plan Name'),
    readOnly('ppg_region', 'PPG Region Code'),
    readOnly('ipa', 'IPA'),
    date('enrollment_date', 'Enrollment Date'),
    date('termed_date', 'Termed Date'),
    readOnly('state_of_residence', 'State of Residence'),
    readOnly('dsnp_id', 'DSNP ID'),
    date('ppg_effective', 'PPG Effective Date'),
    date('cm_assignment', 'Current CM Assignment Date'),
    date('initial_hra', 'Initial HRA'),
    date('latest_hra', 'Latest HRA'),
    date('prior_year_hra', 'Prior Year HRA'),
  ]),
  section('outreach', 'Outreach & Engagement', [
    date('first_call', 'First Initial Call'),
    date('second_call', 'Second Call'),
    date('last_utc', 'Last UTC Date and Time'),
    readOnly('ict_coordination_notes', 'Notes of ICT Coordination with Member'),
  ]),
  section('care_plan', 'Care Plan (ICP)', [
    date('initial_care_plan', 'Initial Care Plan Date'),
    date('latest_care_plan', 'Latest Care Plan Date'),
    date('icp_on_hra', 'ICP based on HRA (Latest Date)'),
    yesNo('icp_within_90', 'ICP within 90 days'),
    {
      linkId: 'care_plan_type', type: 'choice', control: 'dropdown', text: 'Care Plan Type',
      options: [{ value: 'NA' }, { value: 'Chronic Care Plan' }, { value: 'Comprehensive Care Plan' }, { value: 'Transition Care Plan' }],
    },
    date('care_plan_to_pcp', 'Care Plan Sent to PCP'),
    date('care_plan_to_member', 'Care Plan Shared With Member'),
  ]),
  section('toc', 'Transitions of Care (TOC)', [
    date('toc_date', 'TOC Date'),
    date('icp_after_toc', 'ICP Shared after TOC'),
    yesNo('toc_outreached', 'TOC Outreached'),
    yesNo('toc_education', 'TOC Education'),
    date('toc_ict', 'TOC ICT'),
    date('toc_icp_facility', 'TOC - ICP Shared with Facility'),
    date('toc_icp_member', 'TOC - ICP Shared with Member/Main POC'),
    date('initial_ict', 'Initial ICT'),
    date('latest_ict', 'Latest ICT'),
  ]),
  section('risk', 'Risk Stratification', [
    {
      linkId: 'acuity_level', type: 'choice', control: 'dropdown', text: 'Acuity Level',
      options: [{ value: 'Low' }, { value: 'Medium' }, { value: 'High' }, { value: 'Very High' }],
    },
    date('risk_start', 'Risk Stratification Start Date'),
    date('risk_end', 'Risk Stratification End Date'),
  ]),
];

export const SNP_SNAPSHOT_FORM = {
  name: SNP_SNAPSHOT_FORM_NAME,
  description: 'SNP program Snapshot: trigger, eligibility, outreach, care plan, transitions of care and risk stratification.',
  category: 'Program',
  formType: 'Other',
  status: 'active',
  schema: { items },
  scoring: { scores: [], criticalTriggers: [] },
  settings: { layout: 'sectioned', header: { enabled: true, title: SNP_SNAPSHOT_FORM_NAME }, footer: { enabled: false } },
};

/** Supabase `forms` row for the seed. */
export const snpSnapshotFormRow = () => ({
  name: SNP_SNAPSHOT_FORM.name,
  description: SNP_SNAPSHOT_FORM.description,
  category: SNP_SNAPSHOT_FORM.category,
  form_type: SNP_SNAPSHOT_FORM.formType,
  status: SNP_SNAPSHOT_FORM.status,
  schema: SNP_SNAPSHOT_FORM.schema,
  scoring: SNP_SNAPSHOT_FORM.scoring,
  settings: SNP_SNAPSHOT_FORM.settings,
});
