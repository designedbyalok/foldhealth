import { cloneElement, isValidElement, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Drawer } from '../../../../../../components/Drawer/Drawer';
import { Button } from '../../../../../../components/Button/Button';
import { Input } from '../../../../../../components/Input/Input';
import { Select } from '../../../../../../components/Select/Select';
import { Textarea } from '../../../../../../components/Textarea/Textarea';
import { Switch } from '../../../../../../components/Switch/Switch';
import { DatePicker } from '../../../../../../components/DatePicker/DatePicker';
import { Icon } from '../../../../../../components/Icon/Icon';
import { useAppStore } from '../../../../../../store/useAppStore';
import styles from './EditPatientDrawer.module.css';

/** MM/DD/YYYY ↔ YYYY-MM-DD helpers — the form stores DOB the way the
 * Profile tab renders it, but the native <input type="date"> only speaks
 * ISO. Convert on the boundary so both stay in their preferred format. */
const isoFromMdy = (s) => {
  const [m, d, y] = (s || '').split('/');
  return (m && d && y) ? `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` : '';
};
const mdyFromIso = (s) => {
  const [y, m, d] = (s || '').split('-');
  return (y && m && d) ? `${m}/${d}/${y}` : '';
};

// ── Enum option catalogs ───────────────────────────────────────
// Kept co-located so the drawer works standalone without a DB round-trip.
// Any of these could later swap to fetched-from-Supabase lookup tables.
const opt = (arr) => arr.map((v) => ({ value: v, label: v }));

const GENDER_OPTIONS       = opt(['Male', 'Female', 'Non-binary', 'Prefer not to say']);
const PRONOUN_OPTIONS      = opt(['He/Him', 'She/Her', 'They/Them', 'Ze/Zir', 'Other']);
const SEX_AT_BIRTH_OPTIONS = opt(['Male', 'Female', 'Intersex', 'Unknown']);
const ORIENTATION_OPTIONS  = opt(['Straight', 'Gay', 'Lesbian', 'Bisexual', 'Queer', 'Prefer not to say', '-']);
const LANGUAGE_OPTIONS     = opt(['En(US-Native)', 'Es(US-Native)', 'Chinese (Yue-Basic)', 'Chinese (Mandarin)', 'French', 'Vietnamese', 'Tagalog', 'Korean', 'Arabic']);
const BLOOD_GROUP_OPTIONS  = opt(['O +ve', 'O -ve', 'A +ve', 'A -ve', 'B +ve', 'B -ve', 'AB +ve', 'AB -ve']);
const MARITAL_OPTIONS      = opt(['Single', 'Married', 'Divorced', 'Widowed', 'Separated', 'Partnered']);
const RACE_OPTIONS         = opt(['White', 'Black or African American', 'Asian', 'American Indian or Alaska Native', 'Native Hawaiian or Pacific Islander', 'Hispanic', 'Other']);
const ETHNICITY_OPTIONS    = opt(['Hispanic', 'Non-Hispanic', 'Chinese', 'Latino', 'Filipino', 'Korean', 'Vietnamese', 'Other']);
const IPA_OPTIONS          = opt(['LA Care', 'JADE Health', 'Preferred IPA', 'Alignment IPA', 'Regal Medical', 'HealthCare Partners']);
const US_STATES            = opt(['California', 'New York', 'Texas', 'Florida', 'Illinois', 'Washington', 'Massachusetts', 'Georgia']);
const CITY_OPTIONS         = opt(['Los Angeles', 'New York', 'San Francisco', 'Chicago', 'Miami', 'Seattle', 'Boston', 'Atlanta', 'Houston']);
const EMPLOYER_OPTIONS     = opt(['Fox Valley Tools & Die', 'Ramirez Landscaping Co.', 'Self-employed', 'Retired', 'Other']);
const PRACTICE_OPTIONS     = opt(['Central Community Clinic', 'North Valley Clinic', 'West Side Clinic', 'Downtown Medical Center']);
const TAGS_OPTIONS         = opt(['Diabetes', 'Hypertension', 'Needs Transportation', 'Language Barrier', 'Hearing Impaired', 'Bariatric']);

/** Slim initial form state derived from the patient + p360 profile row. */
function initialForm(patient, p) {
  return {
    // Basic Info
    name:               patient?.name || '',
    chosen_name:        p?.chosen_name || '',
    date_of_birth:      p?.date_of_birth || patient?.dob || '',
    age:                p?.age || patient?.age || '',
    gender_identity:    p?.gender_identity || patient?.gender || '',
    pronoun:            p?.pronoun || '',
    sex_at_birth:       p?.sex_at_birth || '',
    sexual_orientation: p?.sexual_orientation || '',
    primary_language:   p?.primary_language || p?.language_preference || patient?.language || '',
    secondary_language: p?.secondary_language || '',
    blood_group:        p?.blood_group || '',
    marital_status:     p?.marital_status || '',
    race:               p?.race || '',
    ethnicity:          p?.ethnicity || '',
    ipa:                p?.ipa || patient?.ipa || '',

    // Contact Info
    email:              p?.emails?.[0] || patient?.email || '',
    phone:              p?.plan_numbers_primary?.[0] || patient?.phone || '',

    // Address
    address_line1:      p?.address_line1 || '',
    address_line2:      p?.address_line2 || '',
    city:               p?.city  || patient?.city || '',
    state:              p?.state || patient?.state || '',
    zipcode:            p?.zipcode || '',
    location_landmark:  p?.location_landmark || p?.location || '',

    // Extra language / phone-number rows added via the "+ Add" links.
    extra_languages:    Array.isArray(p?.extra_languages) ? p.extra_languages : [],
    extra_phones:       Array.isArray(p?.extra_phones)    ? p.extra_phones    : [],

    // Custom Fields — arbitrary label/value rows
    custom_fields:      Array.isArray(p?.custom_fields) ? p.custom_fields : [],

    // Additional Info
    tags:               Array.isArray(p?.tags) ? p.tags : (p?.condition_tags || []),
    employer:           p?.employer || '',
    practice_location:  p?.practice_location || '',
    notes:              p?.additional_notes || '',
    profile_source:     p?.profile_source || patient?.source || '',
    profile_created_on: p?.profile_created_on || '',
  };
}

/**
 * A single label-above-control cell used everywhere in the drawer body.
 * Keeps label typography and vertical spacing consistent between Input,
 * Select and Textarea children.
 */
function Field({ label, required, children, className }) {
  // Every Field in this drawer wraps a single Input / Select / Textarea /
  // DatePicker, all of which take an `id`, so the wrapper owns the
  // label↔control wiring rather than repeating it at 18 call sites.
  const controlId = useId();
  const single = isValidElement(children);
  const control = single && !children.props.id
    ? cloneElement(children, { id: controlId })
    : children;
  const labelFor = single ? (children.props.id || controlId) : undefined;
  const text = (
    <>
      {label}
      {required && <span className={styles.required}>*</span>}
    </>
  );
  return (
    <div className={[styles.field, className || ''].filter(Boolean).join(' ')}>
      {labelFor
        ? <label className={styles.fieldLabel} htmlFor={labelFor}>{text}</label>
        : <span className={styles.fieldLabel}>{text}</span>}
      {control}
    </div>
  );
}

/**
 * EditPatientDrawer — one drawer for every "Edit …" entry-point on the
 * Profile tab (Contact / Basic Info / Address / Other Info) and the
 * P360 banner's "Edit Details" overflow-menu item. Persists via
 * updateP360Profile so every field lands on the p360_profiles row.
 *
 * Figma: Fold-Pixel P360 Revamp node 6821:297875.
 */
export function EditPatientDrawer({
  patient,
  initialSection = 'basic',   // 'basic' | 'contact' | 'address' | 'custom' | 'other'
  onClose,
}) {
  const patientId = patient?.id;
  const p360Profile = useAppStore((s) => s.p360Profile);
  const updateP360Profile = useAppStore((s) => s.updateP360Profile);
  const p = p360Profile && p360Profile.patient_id === patientId ? p360Profile : null;

  const [tab, setTab] = useState('member');         // 'member' | 'insurance'
  const [showEligibility, setShowEligibility] = useState(false);
  const [form, setForm] = useState(() => initialForm(patient, p));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(initialForm(patient, p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, p?.updated_at]);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const bodyRef = useRef(null);
  const sectionRefs = {
    basic:   useRef(null),
    contact: useRef(null),
    address: useRef(null),
    custom:  useRef(null),
    other:   useRef(null),
  };
  useEffect(() => {
    if (initialSection === 'basic') return;
    const t = setTimeout(() => {
      sectionRefs[initialSection]?.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSection]);

  const handleSave = async () => {
    if (!patientId) return;
    setSaving(true);
    const ok = await updateP360Profile(patientId, {
      chosen_name:        form.chosen_name || null,
      date_of_birth:      form.date_of_birth || null,
      age:                form.age || null,
      gender_identity:    form.gender_identity || null,
      pronoun:            form.pronoun || null,
      sex_at_birth:       form.sex_at_birth || null,
      sexual_orientation: form.sexual_orientation || null,
      primary_language:   form.primary_language || null,
      secondary_language: form.secondary_language || null,
      blood_group:        form.blood_group || null,
      marital_status:     form.marital_status || null,
      race:               form.race || null,
      ethnicity:          form.ethnicity || null,
      ipa:                form.ipa || null,
      emails:             form.email ? [form.email] : [],
      plan_numbers_primary: form.phone ? [form.phone] : [],
      address_line1:      form.address_line1 || null,
      address_line2:      form.address_line2 || null,
      city:               form.city || null,
      state:              form.state || null,
      zipcode:            form.zipcode || null,
      location_landmark:  form.location_landmark || null,
      custom_fields:      form.custom_fields || [],
      extra_languages:    form.extra_languages || [],
      extra_phones:       form.extra_phones || [],
      tags:               form.tags || [],
      employer:           form.employer || null,
      practice_location:  form.practice_location || null,
      additional_notes:   form.notes || null,
      profile_source:     form.profile_source || null,
      profile_created_on: form.profile_created_on || null,
    });
    setSaving(false);
    if (ok) onClose?.();
  };

  const addCustomField  = () => set('custom_fields', [...form.custom_fields, { label: 'Custom Field', value: '' }]);
  const removeCustomField = (idx) => set('custom_fields', form.custom_fields.filter((_, i) => i !== idx));
  const editCustomField = (idx, patch) => set('custom_fields',
    form.custom_fields.map((cf, i) => (i === idx ? { ...cf, ...patch } : cf)));

  // "+ Add Languages" — append an empty entry that the user picks a
  // value for. Save persists as `extra_languages` JSONB.
  const addLanguage    = () => set('extra_languages', [...form.extra_languages, '']);
  const editLanguage   = (idx, value) => set('extra_languages', form.extra_languages.map((v, i) => (i === idx ? value : v)));
  const removeLanguage = (idx) => set('extra_languages', form.extra_languages.filter((_, i) => i !== idx));

  // "+ Add Phone Numbers" — same pattern for a { number, hours } row.
  const addPhone       = () => set('extra_phones', [...form.extra_phones, { number: '', hours: '' }]);
  const editPhone      = (idx, patch) => set('extra_phones', form.extra_phones.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  const removePhone    = (idx) => set('extra_phones', form.extra_phones.filter((_, i) => i !== idx));

  const tabs = useMemo(() => ([
    { key: 'member',    label: 'Member Details',    step: 1 },
    { key: 'insurance', label: 'Insurance Details', step: 2 },
  ]), []);

  const linkBtn = (text, onClick) => (
    <button type="button" className={styles.linkBtn} onClick={onClick}>
      <Icon name="solar:add-square-linear" size={14} color="currentColor" />
      <span>{text}</span>
    </button>
  );

  return (
    <Drawer
      title="Update Member"
      onClose={onClose}
      primaryAction={
        <Button variant="primary" size="L" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      }
    >
      {/* ── Tab bar — numbered pills + connector + eligibility toggle ── */}
      <div className={styles.tabBar}>
        <div className={styles.tabsGroup}>
          {tabs.map((t, i) => (
            <button
              key={t.key}
              type="button"
              className={`${styles.tab} ${tab === t.key ? styles.tabActive : ''}`}
              onClick={() => setTab(t.key)}
            >
              <span className={styles.tabDot}>{t.step}</span>
              <span>{t.label}</span>
              {i < tabs.length - 1 && <span className={styles.tabConnector} aria-hidden="true" />}
            </button>
          ))}
        </div>
        <Switch
          checked={showEligibility}
          onChange={setShowEligibility}
          label="View eligibility details"
        />
      </div>

      {tab === 'insurance' ? (
        <div className={styles.placeholder}>
          <Icon name="solar:shield-user-linear" size={32} color="var(--neutral-200)" />
          <p>Insurance details editor — coming soon.</p>
        </div>
      ) : (
        <div className={styles.body} ref={bodyRef}>
          {/* ── Basic Info ── */}
          <section ref={sectionRefs.basic} className={styles.section}>
            <h3 className={styles.sectionTitle}>Basic Info</h3>
            <div className={styles.grid}>
              <Input label="Name" required value={form.name} onChange={e => set('name', e.target.value)} />
              <Input label="Chosen Name" value={form.chosen_name} onChange={e => set('chosen_name', e.target.value)} />
              <Field label="Date of Birth">
                <DatePicker
                  value={isoFromMdy(form.date_of_birth)}
                  onSelect={(iso) => set('date_of_birth', mdyFromIso(iso))}
                  placeholder="MM/DD/YYYY"
                />
              </Field>
              <Input label="Age" value={form.age} onChange={e => set('age', e.target.value)} />
              <Field label="Gender">
                <Select options={GENDER_OPTIONS} value={form.gender_identity} onChange={(v) => set('gender_identity', v)} placeholder="Select gender" />
              </Field>
              <Field label="Pronouns">
                <Select options={PRONOUN_OPTIONS} value={form.pronoun} onChange={(v) => set('pronoun', v)} placeholder="Select pronoun" />
              </Field>
              <Field label="Sex at Birth">
                <Select options={SEX_AT_BIRTH_OPTIONS} value={form.sex_at_birth} onChange={(v) => set('sex_at_birth', v)} placeholder="Select" />
              </Field>
              <Field label="Sexual Orientation">
                <Select options={ORIENTATION_OPTIONS} value={form.sexual_orientation} onChange={(v) => set('sexual_orientation', v)} placeholder="Select" />
              </Field>
              <Field label="Primary Language">
                <Select options={LANGUAGE_OPTIONS} value={form.primary_language} onChange={(v) => set('primary_language', v)} placeholder="Select language" searchable />
              </Field>
              <Field label="Secondary Language">
                <Select options={LANGUAGE_OPTIONS} value={form.secondary_language} onChange={(v) => set('secondary_language', v)} placeholder="Select language" searchable />
              </Field>
            </div>
            {form.extra_languages.length > 0 && (
              <div className={styles.grid}>
                {form.extra_languages.map((lang, idx) => (
                  <div key={idx} className={styles.removableRow}>
                    <Field label={`Additional Language ${idx + 1}`}>
                      <Select
                        options={LANGUAGE_OPTIONS}
                        value={lang}
                        onChange={(v) => editLanguage(idx, v)}
                        placeholder="Select language"
                        searchable
                      />
                    </Field>
                    <button type="button" className={styles.removeBtn} onClick={() => removeLanguage(idx)} aria-label={`Remove language ${idx + 1}`}>
                      <Icon name="solar:close-circle-linear" size={16} color="var(--neutral-300)" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className={styles.linkRow}>{linkBtn('Add Languages', addLanguage)}</div>
            <div className={styles.grid}>
              <Field label="Blood Group">
                <Select options={BLOOD_GROUP_OPTIONS} value={form.blood_group} onChange={(v) => set('blood_group', v)} placeholder="Select" />
              </Field>
              <Field label="Marital Status">
                <Select options={MARITAL_OPTIONS} value={form.marital_status} onChange={(v) => set('marital_status', v)} placeholder="Select" />
              </Field>
              <Field label="Race">
                <Select options={RACE_OPTIONS} value={form.race} onChange={(v) => set('race', v)} placeholder="Select" />
              </Field>
              <Field label="Ethnicity">
                <Select options={ETHNICITY_OPTIONS} value={form.ethnicity} onChange={(v) => set('ethnicity', v)} placeholder="Select" />
              </Field>
            </div>
            <div className={styles.gridFull}>
              <Field label="IPA">
                <Select options={IPA_OPTIONS} value={form.ipa} onChange={(v) => set('ipa', v)} placeholder="Select IPA" searchable />
              </Field>
            </div>
          </section>

          {/* ── Contact Info ── */}
          <section ref={sectionRefs.contact} className={styles.section}>
            <h3 className={styles.sectionTitle}>Contact Info</h3>
            <div className={styles.gridFull}>
              <Input type="email" label="Email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="name@email.com" />
              <Input type="tel"   label="Phone Number" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(555) 555-0100" helperText="Mon-Sun, 9am-9pm" />
            </div>
            {form.extra_phones.length > 0 && (
              <div className={styles.gridFull}>
                {form.extra_phones.map((p, idx) => (
                  <div key={idx} className={styles.removableRow}>
                    <div className={styles.grid}>
                      <Input
                        type="tel"
                        label={`Phone Number ${idx + 2}`}
                        value={p.number}
                        onChange={(e) => editPhone(idx, { number: e.target.value })}
                        placeholder="(555) 555-0100"
                      />
                      <Input
                        label="Availability"
                        value={p.hours}
                        onChange={(e) => editPhone(idx, { hours: e.target.value })}
                        placeholder="Mon-Sun, 9am-9pm"
                      />
                    </div>
                    <button type="button" className={styles.removeBtn} onClick={() => removePhone(idx)} aria-label={`Remove phone ${idx + 2}`}>
                      <Icon name="solar:close-circle-linear" size={16} color="var(--neutral-300)" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className={styles.linkRow}>{linkBtn('Add Phone Numbers', addPhone)}</div>
          </section>

          {/* ── Address ── */}
          <section ref={sectionRefs.address} className={styles.section}>
            <h3 className={styles.sectionTitle}>Address</h3>
            <div className={styles.gridFull}>
              <Input label="Address Line 1" value={form.address_line1} onChange={e => set('address_line1', e.target.value)} placeholder="Street address" />
              <Input label="Address Line 2" value={form.address_line2} onChange={e => set('address_line2', e.target.value)} placeholder="Enter address" />
            </div>
            <div className={styles.grid}>
              <Field label="City">
                <Select options={CITY_OPTIONS} value={form.city} onChange={(v) => set('city', v)} placeholder="Select city" searchable />
              </Field>
              <Field label="State">
                <Select options={US_STATES} value={form.state} onChange={(v) => set('state', v)} placeholder="Select state" searchable />
              </Field>
            </div>
            <div className={styles.gridFull}>
              <Input label="Zipcode" value={form.zipcode} onChange={e => set('zipcode', e.target.value)} placeholder="ZIP" />
            </div>
          </section>

          {/* ── Custom Fields ── */}
          <section ref={sectionRefs.custom} className={styles.section}>
            <h3 className={styles.sectionTitle}>Custom Fields</h3>
            {form.custom_fields.length === 0 && (
              <p className={styles.emptyHint}>No custom fields yet — click "Add Custom Fields" to create one.</p>
            )}
            {form.custom_fields.map((cf, idx) => (
              <div key={idx} className={styles.customRow}>
                <Input
                  label={cf.label || 'Custom Field'}
                  value={cf.value}
                  onChange={e => editCustomField(idx, { value: e.target.value })}
                  placeholder="Value"
                />
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={() => removeCustomField(idx)}
                  aria-label={`Remove ${cf.label || 'custom field'}`}
                >
                  <Icon name="solar:close-circle-linear" size={16} color="var(--neutral-300)" />
                </button>
              </div>
            ))}
            <div className={styles.linkRow}>{linkBtn('Add Custom Fields', addCustomField)}</div>
          </section>

          {/* ── Additional Info ── */}
          <section ref={sectionRefs.other} className={styles.section}>
            <h3 className={styles.sectionTitle}>Additional Info</h3>
            <div className={styles.gridFull}>
              <Field label="Tags">
                <Select
                  multiple
                  options={TAGS_OPTIONS}
                  value={form.tags}
                  onChange={(v) => set('tags', v)}
                  placeholder="Select tags"
                  searchable
                />
              </Field>
            </div>
            <div className={styles.grid}>
              <Field label="Employer">
                <Select options={EMPLOYER_OPTIONS} value={form.employer} onChange={(v) => set('employer', v)} placeholder="Select employer" searchable />
              </Field>
              <Field label="Practice Location">
                <Select options={PRACTICE_OPTIONS} value={form.practice_location} onChange={(v) => set('practice_location', v)} placeholder="Select practice location" searchable />
              </Field>
            </div>
            <div className={styles.gridFull}>
              <Textarea label="Notes" value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="Enter notes" />
            </div>
          </section>
        </div>
      )}
    </Drawer>
  );
}
