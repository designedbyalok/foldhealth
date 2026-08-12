import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../../../../../store/useAppStore';
import { DownChevronIcon } from '../../../../../../components/Icon/DownChevronIcon';
import { ActionButton } from '../../../../../../components/ActionButton/ActionButton';
import { Badge } from '../../../../../../components/Badge/Badge';
import { CardSkeleton } from '../../../../../../components/CardSkeleton/CardSkeleton';
import { Toggle } from '../../../../../../components/Toggle/Toggle';
import styles from './ProfileTab.module.css';

const PROFILE_VIEWS = [
  { key: 'demographics', label: 'Demographics' },
  { key: 'insurance',    label: 'Insurance' },
];

/** Compact "y m" age from a MM/DD/YYYY string; blank if it can't parse. */
function ageFromDob(dob) {
  if (!dob) return '';
  const [m, d, y] = dob.split('/').map(Number);
  if (!m || !d || !y) return '';
  const now = new Date();
  let years = now.getFullYear() - y;
  let months = now.getMonth() + 1 - m;
  if (now.getDate() < d) months -= 1;
  if (months < 0) { years -= 1; months += 12; }
  return years >= 0 ? `${years}y ${months}m` : '';
}

/** Collapsible section wrapper — matches the Figma section pattern:
 * title + optional edit button on the right, and a grid of label/value
 * cells below that flow into 2 columns on wider layouts. */
function Section({ title, actionIcon = 'solar:pen-linear', onEdit, children }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <button
          type="button"
          className={styles.sectionTitleBtn}
          onClick={() => setCollapsed((v) => !v)}
          aria-expanded={!collapsed}
        >
          <span className={styles.sectionTitle}>{title}</span>
          {/* Shared DownChevronIcon — rotated -90° when collapsed so a single
              chevron primitive covers both expanded (down) and collapsed
              (right) states without two separate icon glyphs. */}
          <DownChevronIcon
            size={12}
            className={collapsed ? styles.chevronCollapsed : undefined}
          />
        </button>
        {onEdit && (
          <ActionButton icon={actionIcon} size="S" tooltip={`Edit ${title.toLowerCase()}`} onClick={onEdit} />
        )}
      </div>
      {!collapsed && <div className={styles.grid}>{children}</div>}
    </div>
  );
}

/** Two-line label/value cell used across every section. */
function Field({ label, value }) {
  return (
    <div className={styles.field}>
      <div className={styles.fieldLabel}>{label}</div>
      <div className={styles.fieldValue}>{value || '-'}</div>
    </div>
  );
}

/** Contact card for family/caregiver — first line is name + relation +
 * optional Primary/Caregiver badge, second line is phone + hours. */
function ContactField({ contact }) {
  return (
    <div className={styles.field}>
      <div className={styles.contactHead}>
        <span className={styles.fieldLabel}>
          {contact.name}{contact.relation ? ` (${contact.relation})` : ''}
        </span>
        {contact.role && <Badge tone="grey" label={contact.role} size="S" />}
      </div>
      <div className={styles.fieldValue}>
        {contact.phone}
        {contact.phone_hours && <span className={styles.hours}> ({contact.phone_hours})</span>}
      </div>
    </div>
  );
}

/**
 * Profile tab — the demographic / contact / address panel behind the
 * left-panel's "Profile" sub-tab in PatientDetailView. Reads from the
 * p360_profiles Supabase table via the store's fetchP360Profile action,
 * falls back to whatever slim identity fields already live on the
 * patient object (from the worklist row) so the tab is never blank.
 *
 * Figma: Fold-Pixel 1.0 node 6820:269258.
 */
export function ProfileTab({ patient }) {
  const patientId = patient?.id;
  const p360Profile = useAppStore((s) => (patientId ? s.p360ProfilesById[patientId] : null));
  const p360Loading = useAppStore((s) => s.p360Loading);
  const fetchP360Profile = useAppStore((s) => s.fetchP360Profile);
  const openEdit = useAppStore((s) => s.openPatientEdit);
  // Two-view segmented control: Demographics (current sections) vs Insurance
  // (Primary Insurance + Plan Benefits). Local state — persistence isn't
  // needed since the tab-switch is transient viewing chrome.
  const [view, setView] = useState('demographics');

  useEffect(() => {
    if (patientId) fetchP360Profile(patientId);
  }, [patientId, fetchP360Profile]);

  // Profile row we're rendering — the fetched p360 row wins on every field
  // it defines, but fall through to the worklist row so a patient without
  // an extended profile still shows something usable.
  const p = p360Profile && p360Profile.patient_id === patientId ? p360Profile : null;

  const email       = p?.emails?.[0] || patient?.email || '';
  const primaryPhone = p?.plan_numbers_primary?.[0] || patient?.phone || '';
  const contacts    = Array.isArray(p?.family_members) ? p.family_members : [];

  const basic = useMemo(() => ({
    Name:              patient?.name || '',
    'Chosen Name':     p?.chosen_name,
    'Date of Birth':   p?.date_of_birth || patient?.dob,
    Age:               p?.date_of_birth ? ageFromDob(p.date_of_birth) : (patient?.age || ''),
    Gender:            p?.gender_identity || patient?.gender,
    Pronoun:           p?.pronoun,
    'Sex at Birth':    p?.sex_at_birth,
    'Sexual Orientation': p?.sexual_orientation,
    'Primary Language':   p?.primary_language || p?.language_preference || patient?.language,
    'Secondary Language': p?.secondary_language,
    'Blood Group':     p?.blood_group,
    'Marital Status':  p?.marital_status,
    Race:              p?.race,
    Ethnicity:         p?.ethnicity,
    IPA:               p?.ipa || patient?.ipa,
  }), [p, patient]);

  const address = useMemo(() => ({
    'Address Line 1': p?.address_line1,
    'Address Line 2': p?.address_line2,
    State:            p?.state || patient?.state,
    City:             p?.city  || patient?.city,
    Zipcode:          p?.zipcode,
    Location:         p?.location_landmark || p?.location,
  }), [p, patient]);

  const other = useMemo(() => ({
    Source:      p?.profile_source || patient?.source,
    'Created on': p?.profile_created_on,
    Employer:    p?.employer,
  }), [p, patient]);

  // Insurance — Figma P360 Revamp node 526:334385. First block is the
  // insurance identity + eligibility window; second is the plan-benefits
  // detail. All values fall through to '-' when the p360 row is missing
  // that field (identical shape to the demographics sections above).
  const insuranceFields = useMemo(() => ({
    'Insurance Carrier':      p?.insurance_carrier_name,
    'Plan Name':              p?.insurance_plan_name,
    'Member ID':              p?.insurance_member_id,
    'SNP Type':               p?.insurance_snp_type,
    'LOB':                    p?.insurance_lob,
    'Employment Status':      p?.insurance_employment_status,
    'Eligibility Start Date': p?.insurance_eligibility_start,
    'Eligibility End Date':   p?.insurance_eligibility_end,
  }), [p]);

  const planBenefitFields = useMemo(() => ({
    'Benefits Effective Date': p?.insurance_benefits_effective,
    'Benefits Termed':         p?.insurance_benefits_termed,
    'Cost Sharing Level':      p?.insurance_cost_sharing_level,
    'Part D LIS Level':        p?.insurance_part_d_lis_level,
    'Deductible':              p?.insurance_deductible,
    'Max Out-of-Pocket':       p?.insurance_max_oop,
    'Copays':                  p?.insurance_copay,
    'Extra Benefits':          p?.insurance_extra_benefits,
  }), [p]);

  if (p360Loading && !p) {
    return <div className={styles.wrapper}><CardSkeleton /></div>;
  }

  return (
    <div className={styles.wrapper}>
      {/* Top row — Demographics/Insurance segmented control on the left,
          single Edit action on the right. The per-section edit pencils were
          removed; this one button opens the drawer scrolled to a sensible
          starting section for the active view (basic for Demographics,
          insurance for Insurance). */}
      <div className={styles.viewRow}>
        <Toggle
          items={PROFILE_VIEWS}
          active={view}
          onChange={setView}
          size="S"
          className={styles.viewToggle}
        />
        <ActionButton
          icon="solar:pen-linear"
          size="S"
          tooltip={view === 'insurance' ? 'Edit insurance' : 'Edit profile'}
          onClick={() => openEdit(view === 'insurance' ? 'insurance' : 'basic', patient)}
        />
      </div>

      {view === 'demographics' ? (
        <>
          <Section title="Contact Info">
            <Field label="Email"        value={email} />
            <Field label="Phone Number" value={primaryPhone} />
            {contacts.map((c) => (
              <ContactField key={`${c.name}-${c.relation}`} contact={c} />
            ))}
          </Section>

          <Section title="Basic Info">
            {Object.entries(basic).map(([label, value]) => (
              <Field key={label} label={label} value={value} />
            ))}
          </Section>

          <Section title="Address">
            {Object.entries(address).map(([label, value]) => (
              <Field key={label} label={label} value={value} />
            ))}
          </Section>

          <Section title="Other Info">
            {Object.entries(other).map(([label, value]) => (
              <Field key={label} label={label} value={value} />
            ))}
          </Section>
        </>
      ) : (
        // Insurance view — matches Figma P360 Revamp node 526:334385.
        // Primary Insurance is a single collapsible block whose body holds
        // both the identity fields and a nested "Plan Benefits" heading +
        // grid. Edit routes through the top-row action button, not a
        // per-section pencil.
        <Section title="Primary Insurance">
          {Object.entries(insuranceFields).map(([label, value]) => (
            <Field key={label} label={label} value={value} />
          ))}
          <div className={styles.planBenefitsHeader}>Plan Benefits</div>
          {Object.entries(planBenefitFields).map(([label, value]) => (
            <Field key={label} label={label} value={value} />
          ))}
        </Section>
      )}

    </div>
  );
}
