import { useState, useRef, useEffect } from 'react';
import { Drawer }          from '../../components/Drawer/Drawer';
import { Button }          from '../../components/Button/Button';
import { Input }           from '../../components/Input/Input';
import { Select } from '../../components/Select/Select';
import { Switch }          from '../../components/Switch/Switch';
import { RadioButton }     from '../../components/RadioButton/RadioButton';
import { AVERGENT_THEME, PROMINENCE_THEME, NO_THEME } from './CardThemePicker';
import { FieldLabel, PrefixInput, CollapsibleSection, RichTextNote, DateRangePicker } from './InsurancePlanFormUtils';
import { InsuranceCardPreview } from './InsuranceCardPreview';
import { Icon }            from '../../components/Icon/Icon';
import avergentLogoUrl     from './assets/avergent-logo.png';
import prominenceLogoUrl   from './assets/prominence-logo.svg?url';
import { ConfirmDialog } from '../../components/ConfirmDialog/ConfirmDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../components/ShadcnDialog/ShadcnDialog';
import styles from './CreateInsurancePlanDrawer.module.css';

/* ── Option lists ── */
const MEDICAL_BENEFITS_OPTIONS = [
  'HMO', 'PPO', 'EPO', 'POS', 'HDHP', 'HSA-Qualified HDHP',
].map(t => ({ value: t, label: t }));

const COVERAGE_TYPE_OPTIONS = [
  { value: 'Individual',        label: 'Individual' },
  { value: 'Employee+Spouse',   label: 'Employee + Spouse' },
  { value: 'Employee+Child',    label: 'Employee + Child' },
  { value: 'Employee+Children', label: 'Employee + Children' },
  { value: 'Family',            label: 'Family' },
];

/* ── Field info tooltips ── */
const FIELD_INFO = {
  groupNumber: "The identifier assigned by the insurance company to the employer or organization's specific benefit plan, used to link a member to their group's coverage terms.",
  externalId: "A unique identifier used to reference the member or record in an external system (e.g., a payer's or third-party system's internal ID), distinct from the insurer's own member ID.",
  ediPayerId: 'A unique code assigned to an insurance payer for electronic claims submission (EDI transactions), used to route claims to the correct payer.',
  rxBin: 'RxBIN 6-digit code that routes your prescription claim to the right Prescription Benefits benefit manager.',
  rxPcn: 'Rx PCN Secondary routing code that identifies your specific plan within that benefit manager.',
  rxGroup: "Rx Group identifies your employer's drug benefit group, used to apply your exact copays and formulary.",
};

/* ── Required fields for step 1 (Plan Information) ── */
const REQUIRED_FIELDS = [
  { key: 'planName',             label: 'Plan Name' },
  { key: 'groupNumber',          label: 'Group Number' },
  { key: 'ediPayerId',           label: 'EDI Payer ID' },
  { key: 'memberSupportPhone',   label: 'Member Support Phone Number' },
  { key: 'providerSupportPhone', label: 'Provider Support Phone Number' },
  { key: 'addressLine1',         label: 'Address Line 1' },
  { key: 'zipcode',              label: 'Zipcode' },
  { key: 'city',                 label: 'City' },
  { key: 'state',                label: 'State' },
];

/* ── Formatters ── */
function formatPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function numericOnly(value) {
  return value.replace(/[^0-9.]/g, '');
}

/* ── Per-tier empty state (Figma 632:99112) ── */
function emptyTier(id) {
  return {
    id,
    tierName: '',
    coverageFamily: false,
    familyAccumulator: false,
    coverageType: '',
    // In Network Coverage
    inNetDeductible: '', inNetOopMax: '',
    inNetDeductibleFam: '', inNetOopMaxFam: '',
    inNetCopayPcp: '', inNetCopaySpecialist: '', inNetCopayUrgent: '', inNetCopayEr: '',
    inNetCopayInpatient: '', inNetCopayOutpatientSurgical: '',
    inNetCopayRoutineXray: '', inNetCopayAdvancedDiag: '', inNetCopayCTMRI: '',
    inNetCoinsurancePcp: '', inNetCoinsuranceSpecialist: '', inNetCoinsuranceUrgent: '', inNetCoinsuranceEr: '',
    // Out of Network Coverage
    outNetDeductible: '', outNetOopMax: '',
    outNetDeductibleFam: '', outNetOopMaxFam: '',
    outNetCopayPcp: '', outNetCopaySpecialist: '', outNetCopayUrgent: '', outNetCopayEr: '',
    outNetCopayInpatient: '', outNetCopayOutpatientSurgical: '',
    outNetCopayRoutineXray: '', outNetCopayAdvancedDiag: '', outNetCopayCTMRI: '',
    outNetCoinsurancePcp: '', outNetCoinsuranceSpecialist: '', outNetCoinsuranceUrgent: '', outNetCoinsuranceEr: '',
  };
}

const EMPTY_FORM = {
  planName: '', planType: 'Medical', groupNumber: '', externalId: '',
  ediPayerId: '', providerNetworkName: '', planLogoUrl: '',
  planStartDate: '', planEndDate: '',
  providerPortal: '', medicalBenefits: '',
  memberSupportPhone: '', providerSupportPhone: '',
  addressLine1: '', addressLine2: '', zipcode: '', city: '', state: '',
  planWebsiteUrl: '', additionalNote: '',
  pbmName: '', pbmPhone: '', pbmUrl: '',
  rxBin: '', rxPcn: '', rxGroup: '',
  planMotto: 'Right Care - Right Provider - Right Price',
};

/* ── Tier accordion item (Figma 632:99112) ── */
function TierForm({ tier, index, expanded, isActive, onToggle, onUpdate, onDelete, isOnly }) {
  const setTierField = (key) => (e) => onUpdate(tier.id, key, e.target.value);
  const setTierCurrency = (key) => (e) => onUpdate(tier.id, key, numericOnly(e.target.value));
  const setTierBool = (key) => (val) => onUpdate(tier.id, key, val);
  const setTierVal = (key) => (val) => onUpdate(tier.id, key, val);

  /* Single field cell — $ prefix, numeric only */
  const cell = (key, label, { required = false } = {}) => (
    <div className={styles.field}>
      <FieldLabel required={required}>{label}</FieldLabel>
      <PrefixInput
        prefix="$"
        placeholder="Enter Value"
        value={tier[key]}
        onChange={setTierCurrency(key)}
      />
    </div>
  );

  /* In / Out network coverage — identical structure (net = 'inNet' | 'outNet') */
  const coverageSection = (net, title) => (
    <div className={styles.coverageSection}>
      <div className={styles.coverageSectionTitle}>{title}</div>
      <div className={styles.coverageSectionBody}>
        <div className={styles.grid3}>
          {cell(`${net}Deductible`, 'Deductible', { required: true })}
          {tier.coverageFamily && cell(`${net}DeductibleFam`, 'Family Deductible', { required: true })}
          {cell(`${net}OopMax`, 'OOP Max', { required: true })}
          {tier.coverageFamily && cell(`${net}OopMaxFam`, 'Family OOP Max', { required: true })}
        </div>

        <div className={styles.coverageSubGroup}>
          <span className={styles.coverageSubLabel}>Copays</span>
          <div className={styles.grid3}>
            {cell(`${net}CopayPcp`, 'PCP', { required: true })}
            {cell(`${net}CopaySpecialist`, 'Specialist', { required: true })}
            {cell(`${net}CopayUrgent`, 'Urgent Care', { required: true })}
            {cell(`${net}CopayEr`, 'ER', { required: true })}
            {cell(`${net}CopayInpatient`, 'In-Patient')}
            {cell(`${net}CopayOutpatientSurgical`, 'Outpatient Surgical')}
            {cell(`${net}CopayRoutineXray`, 'Routine X-Ray & Diagnostic')}
            {cell(`${net}CopayAdvancedDiag`, 'Advanced Diagnostic')}
            {cell(`${net}CopayCTMRI`, 'CT-Scan & MRI')}
          </div>
        </div>

        <div className={styles.coverageSubGroup}>
          <span className={styles.coverageSubLabel}>Coinsurance</span>
          <div className={styles.grid3}>
            {cell(`${net}CoinsurancePcp`, 'PCP', { required: true })}
            {cell(`${net}CoinsuranceSpecialist`, 'Specialist', { required: true })}
            {cell(`${net}CoinsuranceUrgent`, 'Urgent Care', { required: true })}
            {cell(`${net}CoinsuranceEr`, 'ER', { required: true })}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`${styles.tierAccordion} ${expanded ? styles.tierAccordionExpanded : ''} ${isActive ? styles.tierAccordionActive : ''}`}>
      {/* Tier header */}
      <div className={styles.tierHeader} onClick={onToggle}>
        <Icon
          name={expanded ? 'solar:alt-arrow-down-linear' : 'solar:alt-arrow-right-linear'}
          size={16}
          color="var(--neutral-300)"
        />
        <span className={styles.tierHeaderLabel}>Tier {index + 1}:</span>
        <div className={styles.tierNameInputWrap} onClick={e => e.stopPropagation()}>
          <Input
            placeholder="Enter Tier Name"
            value={tier.tierName}
            onChange={setTierField('tierName')}
          />
        </div>
        {!isOnly && (
          <button
            className={styles.tierDeleteBtn}
            onClick={e => { e.stopPropagation(); onDelete(tier.id); }}
          >
            <Icon name="solar:trash-bin-2-linear" size={16} color="var(--neutral-300)" className={styles.tierTrashIcon} />
          </button>
        )}
      </div>

      {expanded && (
        <div className={styles.tierBody}>
          {/* Family coverage toggle */}
          <div className={styles.coverageSwitchRow}>
            <Switch checked={tier.coverageFamily} onChange={setTierBool('coverageFamily')} />
            <span className={`${styles.coverageSwitchLabel} ${tier.coverageFamily ? styles.coverageSwitchLabelOn : ''}`}>Coverage Applies to Subscriber's Family</span>
          </div>

          {tier.coverageFamily && (
            <>
              <div className={styles.coverageSwitchRow}>
                <Switch checked={tier.familyAccumulator} onChange={setTierBool('familyAccumulator')} />
                <div className={styles.coverageSwitchTextGroup}>
                  <span className={`${styles.coverageSwitchLabel} ${tier.familyAccumulator ? styles.coverageSwitchLabelOn : ''}`}>Family accumulators must be met for families</span>
                  <span className={styles.coverageSwitchDesc}>Individual deductibles and OOP limits won't apply until the family's shared totals are met first.</span>
                </div>
              </div>
              <div className={styles.field}>
                <FieldLabel>Coverage Type</FieldLabel>
                <Select
                  options={COVERAGE_TYPE_OPTIONS}
                  value={tier.coverageType || undefined}
                  onChange={setTierVal('coverageType')}
                  placeholder="Select Coverage Type"
                />
              </div>
            </>
          )}

          {coverageSection('inNet', 'In Network Coverage')}
          {coverageSection('outNet', 'Out of Network Coverage')}
        </div>
      )}
    </div>
  );
}

/* ── Main component ── */
export function CreateInsurancePlanDrawer({ onClose, onSave = () => {}, initialPlan, mode = 'create' }) {
  const isEdit = mode === 'edit';

  /* Derive initial logoChoice from saved plan */
  function initLogoChoice() {
    if (!initialPlan) return 'avergent';
    if (initialPlan.logoChoice) return initialPlan.logoChoice;
    if (initialPlan.logoPreviewUrl === avergentLogoUrl) return 'avergent';
    if (initialPlan.logoPreviewUrl === prominenceLogoUrl) return 'prominence';
    if (initialPlan.logoPreviewUrl) return 'custom';
    return 'avergent';
  }

  const [step,              setStep]            = useState(1);
  const [showPreview,       setShowPreview]      = useState(true);
  const [logoChoice,        setLogoChoice]       = useState(initLogoChoice);

  /* Theme driven by logo, overrideable */
  const initTheme = () => {
    if (initialPlan?.cardTheme) return initialPlan.cardTheme;
    return AVERGENT_THEME;
  };
  const [cardTheme,         setCardTheme]        = useState(initTheme);

  const [tpaLogoFile,       setTpaLogoFile]      = useState(null);
  const [tpaLogoPreviewUrl, setTpaLogoPreviewUrl] = useState(initialPlan?.tpaLogoPreviewUrl || null);

  /* Custom logo state (only for logoChoice === 'custom') */
  const [customLogoFile,    setCustomLogoFile]    = useState(null);
  const [customLogoUrl,     setCustomLogoUrl]     = useState(initialPlan?.logoPreviewUrl && initLogoChoice() === 'custom' ? initialPlan.logoPreviewUrl : null);

  const [tiers,             setTiers]            = useState(() => {
    if (initialPlan?.tiers?.length) return initialPlan.tiers;
    return [emptyTier(1)];
  });
  const [expandedTiers,     setExpandedTiers]    = useState(() => new Set([tiers[0]?.id ?? 1]));
  const [activeTierId,      setActiveTierId]     = useState(() => tiers[0]?.id ?? 1);
  const [scrollTierId,      setScrollTierId]     = useState(null);

  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [showSaveDialog,    setShowSaveDialog]   = useState(false);
  const [showErrors,        setShowErrors]       = useState(false);
  const [zipInvalid,        setZipInvalid]       = useState(false);
  const isDirty   = useRef(false);
  const fileInputRef    = useRef(null);
  const tpaFileInputRef = useRef(null);
  const tierIdRef = useRef(tiers.length + 1);
  const tierRefs  = useRef({});

  /* Scroll a newly-added tier into view once it has rendered */
  useEffect(() => {
    if (scrollTierId == null) return;
    tierRefs.current[scrollTierId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setScrollTierId(null);
  }, [scrollTierId]);

  const [form, setForm] = useState(initialPlan ? { ...EMPTY_FORM, ...initialPlan } : EMPTY_FORM);

  /* ── Input helpers ── */
  const set = (key) => (e) => {
    isDirty.current = true;
    setForm(f => ({ ...f, [key]: e.target.value }));
  };
  const setVal = (key) => (val) => {
    isDirty.current = true;
    setForm(f => ({ ...f, [key]: val }));
  };
  const setPhone = (key) => (e) => {
    isDirty.current = true;
    setForm(f => ({ ...f, [key]: formatPhone(e.target.value) }));
  };

  const handleZipChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 5);
    isDirty.current = true;
    if (val.length === 5) {
      setForm(f => ({ ...f, zipcode: val }));
      fetch(`https://api.zippopotam.us/us/${val}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.places?.[0]) {
            const p = data.places[0];
            setZipInvalid(false);
            setForm(f => ({
              ...f,
              city: p['place name'] || '',
              state: p['state abbreviation'] || '',
            }));
          } else {
            // Valid 5 digits but no matching US zipcode → invalid
            setZipInvalid(true);
            setForm(f => ({ ...f, city: '', state: '' }));
          }
        })
        .catch(() => { setZipInvalid(true); setForm(f => ({ ...f, city: '', state: '' })); });
    } else {
      // Incomplete zipcode → not "invalid", just clear derived City/State (placeholders show)
      setZipInvalid(false);
      setForm(f => ({ ...f, zipcode: val, city: '', state: '' }));
    }
  };

  /* ── Logo selection ──
     Theme drives the footer: Avergent = orange bar, No Theme = grey bar,
     Prominence = no bar (footerBg null). The motto persists across themes so
     each card renders its footer exactly as in Figma. */
  function handleLogoChoice(choice) {
    isDirty.current = true;
    setLogoChoice(choice);
    if (choice === 'avergent') setCardTheme(AVERGENT_THEME);
    else if (choice === 'prominence') setCardTheme(PROMINENCE_THEME);
    else setCardTheme(NO_THEME);
  }

  /* The logo URL to show on the card */
  const activeLogoUrl = logoChoice === 'avergent'
    ? avergentLogoUrl
    : logoChoice === 'prominence'
    ? prominenceLogoUrl
    : customLogoUrl;

  /* ── Custom logo upload ── */
  const handleCustomLogoDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      isDirty.current = true;
      setCustomLogoFile(file.name);
      setCustomLogoUrl(URL.createObjectURL(file));
    }
  };
  const handleCustomLogoPick = (e) => {
    const file = e.target.files[0];
    if (file) {
      isDirty.current = true;
      setCustomLogoFile(file.name);
      setCustomLogoUrl(URL.createObjectURL(file));
    }
  };

  /* ── Tier helpers ── */
  const updateTier = (id, key, value) => {
    isDirty.current = true;
    setTiers(ts => ts.map(t => t.id === id ? { ...t, [key]: value } : t));
  };
  const addTier = () => {
    const newId = ++tierIdRef.current;
    const newTier = emptyTier(newId);
    setTiers(ts => [...ts, newTier]);
    setExpandedTiers(prev => new Set([...prev, newId]));
    setActiveTierId(newId);
    setScrollTierId(newId);
    isDirty.current = true;
  };
  const deleteTier = (id) => {
    setTiers(ts => {
      const next = ts.filter(t => t.id !== id);
      if (id === activeTierId) setActiveTierId(next[next.length - 1]?.id ?? null);
      return next;
    });
    setExpandedTiers(prev => { const s = new Set(prev); s.delete(id); return s; });
    isDirty.current = true;
  };
  const toggleTier = (id) => {
    setActiveTierId(id);
    setExpandedTiers(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  /* ── Validation ── */
  const hasLogo = logoChoice === 'avergent' || logoChoice === 'prominence' || (logoChoice === 'custom' && !!customLogoUrl);

  const missingFields = REQUIRED_FIELDS.filter(f => !String(form[f.key] ?? '').trim());
  const canSave = missingFields.length === 0 && hasLogo;

  /* True when a required field is empty AND the user has attempted to proceed */
  const err = (key) => showErrors && !String(form[key] ?? '').trim();

  /* Validate step 1; advance to Cost Sharing only when complete */
  const goToStep2 = () => {
    if (!canSave) { setShowErrors(true); return; }
    setShowErrors(false);
    setStep(2);
  };

  /* ── Build save payload ── */
  const buildPlanData = () => ({
    ...(isEdit && initialPlan?.id ? { id: initialPlan.id } : {}),
    ...form,
    logoPreviewUrl: activeLogoUrl,
    logoChoice,
    tpaLogoPreviewUrl,
    cardTheme,
    tiers,
  });

  const handleSave = () => {
    if (!canSave) { setShowErrors(true); setStep(1); return; }
    onSave(buildPlanData());
    onClose();
  };

  const handleClose = () => {
    if (!isDirty.current) { onClose(); return; }
    if (isEdit) setShowSaveDialog(true);
    else setShowDiscardDialog(true);
  };

  /* Card preview data — use first tier's deductible/OOP */
  const firstTier = tiers[0] ?? {};
  const previewData = {
    ...form,
    ...firstTier,
    coverageType: firstTier.coverageType || (firstTier.coverageFamily ? 'Family' : 'Individual'),
  };

  return (
    <>
      <Drawer
        title={isEdit ? 'Edit Insurance Plan' : 'New Insurance Plan'}
        onClose={handleClose}
        headerRight={
          <>
            {showPreview ? (
              <Button
                variant="secondary"
                size="L"
                leadingIcon="solar:eye-closed-linear"
                onClick={() => setShowPreview(false)}
              >
                Hide ID Preview
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="L"
                leadingIcon="solar:eye-linear"
                onClick={() => setShowPreview(true)}
              >
                Show ID Preview
              </Button>
            )}
            <span className={styles.headerDivider} />
            <Button variant="primary" size="L" onClick={handleSave} style={canSave ? undefined : { opacity: 0.5 }}>Save</Button>
            <span className={styles.headerDivider} />
          </>
        }
        className={`insurancePlanPanel ${showPreview ? styles.widePanel : styles.narrowPanel}`}
        bodyClassName={styles.drawerBody}
        headerStyle={{ padding: '8px 12px 8px 16px', borderBottom: '0.5px solid var(--neutral-150)' }}
        titleStyle={{ fontSize: 16, fontWeight: 500 }}
      >

        {/* ── Left: form panel ── */}
        <div className={styles.leftPanel}>

          {/* Stage indicator */}
          <div className={styles.stageNavRow}>
            <div className={styles.stageNav}>
              <button className={styles.stageItem} onClick={() => setStep(1)}>
                <span className={`${styles.stageBadge} ${step === 1 ? styles.stageBadgeActive : styles.stageBadgeInactive}`}>1</span>
                <span className={`${styles.stageLabel} ${step === 1 ? styles.stageLabelActive : styles.stageLabelInactive}`}>Plan Information</span>
              </button>
              <span className={styles.stageConnector} />
              <button
                className={styles.stageItem}
                onClick={() => (step === 1 ? goToStep2() : setStep(2))}
                style={{ cursor: 'pointer' }}
              >
                <span className={`${styles.stageBadge} ${step === 2 ? styles.stageBadgeActive : styles.stageBadgeInactive}`}>2</span>
                <span className={`${styles.stageLabel} ${step === 2 ? styles.stageLabelActive : styles.stageLabelInactive}`}>Cost Sharing(Tier)</span>
              </button>
            </div>
            <div className={styles.stageNavRight}>
              {step === 1 ? (
                <Button variant="primary" size="L" onClick={goToStep2} style={canSave ? undefined : { opacity: 0.5 }}>
                  Next
                </Button>
              ) : (
                <Button variant="secondary" size="L" onClick={() => setStep(1)}>
                  Previous
                </Button>
              )}
            </div>
          </div>

          {/* Tier header bar — fixed below the stage bar (does not scroll) */}
          {step === 2 && (
            <div className={styles.tiersHeaderRow}>
              <div className={styles.tiersHeaderLeft}>
                <Icon name="solar:layers-minimalistic-linear" size={16} color="var(--primary-300)" />
                <span className={styles.tiersHeaderLabel}>Tier</span>
              </div>
              <Button
                variant="tertiary"
                size="S"
                leadingIcon="solar:add-circle-linear"
                onClick={addTier}
              >
                Add New
              </Button>
            </div>
          )}

          <div className={styles.leftScroll}>
          {step === 1 ? (
            <>
              {/* ── Plan Identifiers ── */}
              <CollapsibleSection icon="solar:shield-user-linear" title="Plan Identifiers">

                <div className={styles.row}>
                  <div className={styles.field}>
                    <FieldLabel required>Plan Name</FieldLabel>
                    <Input placeholder="Enter Plan Name" value={form.planName} onChange={set('planName')} variant={err('planName') ? 'error' : 'default'} />
                    {err('planName') && <span className={styles.errorText}>Plan Name is required</span>}
                  </div>
                  <div className={styles.field}>
                    <FieldLabel required>Plan Type</FieldLabel>
                    <Input value={form.planType} disabled readOnly />
                  </div>
                </div>

                {/* Plan Validity (half width) + Group Number */}
                <div className={styles.row}>
                  <div className={styles.field}>
                    <FieldLabel>Plan Validity</FieldLabel>
                    <DateRangePicker
                      startDate={form.planStartDate}
                      endDate={form.planEndDate}
                      onChange={({ start, end }) => {
                        isDirty.current = true;
                        setForm(f => ({ ...f, planStartDate: start, planEndDate: end }));
                      }}
                    />
                  </div>
                  <div className={styles.field}>
                    <FieldLabel required info={FIELD_INFO.groupNumber}>Group Number</FieldLabel>
                    <Input placeholder="Enter Group Number" value={form.groupNumber} onChange={set('groupNumber')} variant={err('groupNumber') ? 'error' : 'default'} />
                    {err('groupNumber') && <span className={styles.errorText}>Group Number is required</span>}
                  </div>
                </div>

                <div className={styles.row}>
                  <div className={styles.field}>
                    <FieldLabel required info={FIELD_INFO.externalId}>External ID</FieldLabel>
                    <Input placeholder="Enter External ID" value={form.externalId} onChange={set('externalId')} variant={err('externalId') ? 'error' : 'default'} />
                    {err('externalId') && <span className={styles.errorText}>External ID is required</span>}
                  </div>
                  <div className={styles.field}>
                    <FieldLabel required info={FIELD_INFO.ediPayerId}>EDI Payer ID</FieldLabel>
                    <Input placeholder="Enter EDI Payer ID" value={form.ediPayerId} onChange={set('ediPayerId')} variant={err('ediPayerId') ? 'error' : 'default'} />
                    {err('ediPayerId') && <span className={styles.errorText}>EDI Payer ID is required</span>}
                  </div>
                </div>

                <div className={styles.row}>
                  <div className={styles.field}>
                    <FieldLabel>Provider Network Name</FieldLabel>
                    <Input placeholder="Enter Provider Network Name" value={form.providerNetworkName} onChange={set('providerNetworkName')} />
                  </div>
                  <div className={styles.field}>
                    <FieldLabel>Provider Portal</FieldLabel>
                    <Input placeholder="Enter Provider Portal URL" value={form.providerPortal} onChange={set('providerPortal')} />
                  </div>
                </div>

                <div className={styles.row}>
                  <div className={styles.field}>
                    <FieldLabel>Medical Benefits</FieldLabel>
                    <Select
                      options={MEDICAL_BENEFITS_OPTIONS}
                      value={form.medicalBenefits || undefined}
                      onChange={setVal('medicalBenefits')}
                      placeholder="Select Medical Benefits"
                    />
                  </div>
                  {/* empty half to keep Medical Benefits at half width */}
                  <div className={styles.field} aria-hidden="true" />
                </div>

                {/* Plan Logo — 3 radio tiles (Figma 2012:44664) */}
                <div className={styles.fieldFull}>
                  <FieldLabel required>Choose Plan Logo (Front of Card)</FieldLabel>
                  <div className={styles.logoTileRow}>
                    {/* Avergent tile */}
                    <div
                      className={`${styles.logoTile} ${logoChoice === 'avergent' ? styles.logoTileSelected : ''}`}
                      onClick={() => handleLogoChoice('avergent')}
                      role="button"
                    >
                      <RadioButton checked={logoChoice === 'avergent'} onChange={() => handleLogoChoice('avergent')} />
                      <img src={avergentLogoUrl} alt="Avergent Health" className={styles.logoTileImgAvergent} />
                      <span className={styles.logoRadioSpacer} />
                    </div>
                    {/* Prominence tile */}
                    <div
                      className={`${styles.logoTile} ${logoChoice === 'prominence' ? styles.logoTileSelected : ''}`}
                      onClick={() => handleLogoChoice('prominence')}
                      role="button"
                    >
                      <RadioButton checked={logoChoice === 'prominence'} onChange={() => handleLogoChoice('prominence')} />
                      <img src={prominenceLogoUrl} alt="Prominence Health" className={styles.logoTileImgProminence} />
                      <span className={styles.logoRadioSpacer} />
                    </div>
                    {/* Upload File tile */}
                    <div
                      className={`${styles.logoTile} ${logoChoice === 'custom' ? styles.logoTileSelected : ''}`}
                      onClick={() => handleLogoChoice('custom')}
                      role="button"
                    >
                      <RadioButton checked={logoChoice === 'custom'} onChange={() => handleLogoChoice('custom')} />
                      <span className={styles.logoTileUploadLabel}>Upload File</span>
                      <span className={styles.logoRadioSpacer} />
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".svg,image/*"
                      style={{ display: 'none' }}
                      onChange={handleCustomLogoPick}
                    />
                  </div>
                  {showErrors && !hasLogo && <span className={styles.errorText}>Plan Logo is required</span>}

                  {/* Upload states — shown when "Upload File" is selected (mirrors TPA upload) */}
                  {logoChoice === 'custom' && (
                    customLogoUrl ? (
                      <div className={styles.logoPreviewContainer} style={{ marginTop: 8 }}>
                        <div className={styles.logoImgWrap}>
                          <img src={customLogoUrl} alt="Custom Logo" className={styles.logoPreviewImg} />
                        </div>
                        <div className={styles.logoActions}>
                          <button className={styles.logoActionBtn} onClick={() => fileInputRef.current?.click()}>
                            <Icon name="solar:restart-linear" size={12} color="var(--neutral-300)" />
                            <span>Replace</span>
                          </button>
                          <button
                            className={`${styles.logoActionBtn} ${styles.logoDeleteBtn}`}
                            onClick={() => { setCustomLogoFile(null); setCustomLogoUrl(null); isDirty.current = true; }}
                          >
                            <Icon name="solar:trash-bin-2-linear" size={12} color="#D72825" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div
                          className={styles.dropZone}
                          style={{ marginTop: 8 }}
                          onDragOver={e => e.preventDefault()}
                          onDrop={handleCustomLogoDrop}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Icon name="solar:upload-minimalistic-linear" size={24} color="var(--neutral-200)" />
                          <div className={styles.dropZoneText}>
                            Drag and drop file here or <span className={styles.dropZoneLink}>Choose file</span>
                          </div>
                        </div>
                        <div className={styles.dropZoneMeta}>
                          <span className={styles.dropZoneMetaText}>Supported formats: SVG</span>
                          <span className={styles.dropZoneMetaText}>Max size: 5 MB</span>
                        </div>
                      </>
                    )
                  )}
                </div>

                {/* TPA Logo */}
                <div className={styles.fieldFull}>
                  <FieldLabel>Choose Third Party Administrator Logo (Back of Card)</FieldLabel>
                  {tpaLogoPreviewUrl ? (
                    <div className={styles.logoPreviewContainer}>
                      <div className={styles.logoImgWrap}>
                        <img src={tpaLogoPreviewUrl} alt="TPA Logo" className={styles.logoPreviewImg} />
                      </div>
                      <div className={styles.logoActions}>
                        <button className={styles.logoActionBtn} onClick={() => tpaFileInputRef.current?.click()}>
                          <Icon name="solar:restart-linear" size={12} color="var(--neutral-300)" />
                          <span>Replace</span>
                        </button>
                        <button
                          className={`${styles.logoActionBtn} ${styles.logoDeleteBtn}`}
                          onClick={() => { setTpaLogoFile(null); setTpaLogoPreviewUrl(null); isDirty.current = true; }}
                        >
                          <Icon name="solar:trash-bin-2-linear" size={12} color="#D72825" />
                          <span>Delete</span>
                        </button>
                      </div>
                      <input ref={tpaFileInputRef} type="file" accept=".svg,image/*" style={{ display: 'none' }}
                        onChange={e => { const f = e.target.files[0]; if (f) { isDirty.current = true; setTpaLogoFile(f.name); setTpaLogoPreviewUrl(URL.createObjectURL(f)); } }} />
                    </div>
                  ) : (
                    <>
                      <div
                        className={styles.dropZone}
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { isDirty.current = true; setTpaLogoFile(f.name); setTpaLogoPreviewUrl(URL.createObjectURL(f)); } }}
                        onClick={() => tpaFileInputRef.current?.click()}
                      >
                        <Icon name="solar:upload-minimalistic-linear" size={24} color="var(--neutral-200)" />
                        <div className={styles.dropZoneText}>
                          Drag and drop file here or <span className={styles.dropZoneLink}>Choose file</span>
                        </div>
                        <input ref={tpaFileInputRef} type="file" accept=".svg,image/*" style={{ display: 'none' }}
                          onChange={e => { const f = e.target.files[0]; if (f) { isDirty.current = true; setTpaLogoFile(f.name); setTpaLogoPreviewUrl(URL.createObjectURL(f)); } }} />
                      </div>
                      <div className={styles.dropZoneMeta}>
                        <span className={styles.dropZoneMetaText}>Supported formats: SVG</span>
                        <span className={styles.dropZoneMetaText}>Max size: 5 MB</span>
                      </div>
                    </>
                  )}
                </div>

              </CollapsibleSection>

              {/* ── Support Info ── */}
              <CollapsibleSection icon="solar:phone-calling-linear" title="Support Info">

                <div className={styles.row}>
                  <div className={styles.field}>
                    <FieldLabel required>Member Support Phone Number</FieldLabel>
                    <Input placeholder="Enter Phone Number" value={form.memberSupportPhone} onChange={setPhone('memberSupportPhone')} variant={err('memberSupportPhone') ? 'error' : 'default'} />
                    {err('memberSupportPhone') && <span className={styles.errorText}>Member Support Phone Number is required</span>}
                  </div>
                  <div className={styles.field}>
                    <FieldLabel required>Provider Support Phone Number</FieldLabel>
                    <Input placeholder="Enter Phone Number" value={form.providerSupportPhone} onChange={setPhone('providerSupportPhone')} variant={err('providerSupportPhone') ? 'error' : 'default'} />
                    {err('providerSupportPhone') && <span className={styles.errorText}>Provider Support Phone Number is required</span>}
                  </div>
                </div>

                <div className={styles.sectionDivider} />

                {/* Claims Mailing Address */}
                <div className={styles.claimsGroup}>
                  <span className={styles.groupHeading}>Claims Mailing Address</span>
                  <div className={styles.addressStack}>
                    <div className={styles.fieldFull}>
                      <FieldLabel required>Address Line 1</FieldLabel>
                      <Input placeholder="Address Line 1" value={form.addressLine1} onChange={set('addressLine1')} variant={err('addressLine1') ? 'error' : 'default'} />
                      {err('addressLine1') && <span className={styles.errorText}>Address Line 1 is required</span>}
                    </div>
                    <div className={styles.fieldFull}>
                      <FieldLabel>Address Line 2</FieldLabel>
                      <Input placeholder="Address Line 2" value={form.addressLine2} onChange={set('addressLine2')} />
                    </div>
                    <div className={styles.row}>
                      <div className={styles.field}>
                        <FieldLabel required>Zipcode</FieldLabel>
                        <Input placeholder="Enter Zipcode" value={form.zipcode} onChange={handleZipChange} maxLength={5} variant={(zipInvalid || err('zipcode')) ? 'error' : 'default'} />
                        {zipInvalid
                          ? <span className={styles.errorText}>Please enter valid zipcode</span>
                          : err('zipcode') && <span className={styles.errorText}>Zipcode is required</span>}
                      </div>
                      <div className={styles.field}>
                        <FieldLabel required>City</FieldLabel>
                        <Input placeholder="City" value={form.city} disabled readOnly />
                      </div>
                      <div className={styles.field}>
                        <FieldLabel required>State</FieldLabel>
                        <Input placeholder="State" value={form.state} disabled readOnly />
                      </div>
                    </div>
                  </div>
                </div>

                <div className={styles.sectionDivider} />

                <div className={styles.fieldFull}>
                  <FieldLabel>Plan Website URL</FieldLabel>
                  <Input placeholder="Paste Website URL" value={form.planWebsiteUrl} onChange={set('planWebsiteUrl')} />
                </div>

                <div className={styles.fieldFull}>
                  <FieldLabel>Additional Note</FieldLabel>
                  <RichTextNote
                    value={form.additionalNote}
                    onChange={(html) => { isDirty.current = true; setForm(f => ({ ...f, additionalNote: html })); }}
                    placeholder="Add Additional Note"
                    maxLength={150}
                  />
                </div>

              </CollapsibleSection>

              {/* ── Prescription Benefits ── */}
              <CollapsibleSection icon="solar:pill-linear" title="Prescription Benefits">

                <div className={styles.row}>
                  <div className={styles.field}>
                    <FieldLabel>Pharmacy Benefits Manager Name</FieldLabel>
                    <Input placeholder="Select Pharmacy Benefits Manager" value={form.pbmName} onChange={set('pbmName')} />
                  </div>
                  <div className={styles.field}>
                    <FieldLabel>Pharmacy Benefits Manager Phone</FieldLabel>
                    <Input placeholder="Enter Pharmacy Benefits Manager Phone" value={form.pbmPhone} onChange={setPhone('pbmPhone')} />
                  </div>
                </div>

                <div className={styles.row}>
                  <div className={styles.field}>
                    <FieldLabel>Pharmacy Benefits Manager URL</FieldLabel>
                    <Input placeholder="Select Pharmacy Benefits Manager URL" value={form.pbmUrl} onChange={set('pbmUrl')} />
                  </div>
                  <div className={styles.field}>
                    <FieldLabel info={FIELD_INFO.rxBin}>Rx BIN</FieldLabel>
                    <Input placeholder="Enter RxBIN" value={form.rxBin} onChange={e => { isDirty.current = true; setForm(f => ({ ...f, rxBin: numericOnly(e.target.value) })); }} />
                  </div>
                </div>

                <div className={styles.row}>
                  <div className={styles.field}>
                    <FieldLabel info={FIELD_INFO.rxPcn}>Rx PCN</FieldLabel>
                    <Input placeholder="Enter RxPCN" value={form.rxPcn} onChange={set('rxPcn')} />
                  </div>
                  <div className={styles.field}>
                    <FieldLabel info={FIELD_INFO.rxGroup}>Rx Group</FieldLabel>
                    <Input placeholder="Enter RxGroup" value={form.rxGroup} onChange={set('rxGroup')} />
                  </div>
                </div>

              </CollapsibleSection>
            </>
          ) : (
            /* ── Step 2: Cost Sharing (Tiers) ── */
            <div className={styles.costSharingContent}>

              {/* Tiers */}
              {tiers.map((tier, index) => (
                <div key={tier.id} ref={el => { tierRefs.current[tier.id] = el; }} style={{ scrollMarginTop: 8 }}>
                  <TierForm
                    tier={tier}
                    index={index}
                    expanded={expandedTiers.has(tier.id)}
                    isActive={tier.id === activeTierId}
                    onToggle={() => toggleTier(tier.id)}
                    onUpdate={updateTier}
                    onDelete={deleteTier}
                    isOnly={tiers.length === 1}
                  />
                </div>
              ))}
            </div>
          )}
          </div>

        </div>

        {/* ── Right: card preview panel ── */}
        {showPreview && (
          <div className={styles.rightPanel}>
            <div className={styles.previewHeader}>
              <span className={styles.previewTitle}>Card Preview</span>
            </div>
            <InsuranceCardPreview
              data={previewData}
              logoPreviewUrl={activeLogoUrl}
              tpaLogoPreviewUrl={tpaLogoPreviewUrl}
              cardTheme={cardTheme}
              onThemeChange={setCardTheme}
              logoChoice={logoChoice}
              coverageFamily={firstTier.coverageFamily ?? false}
            />
          </div>
        )}

      </Drawer>

      {showDiscardDialog && (
        <ConfirmDialog
          variant="destructive"
          title="Discard Information?"
          description="This action will discard all information you have entered for the plan. Please confirm if you want to proceed."
          confirmLabel="Discard"
          onCancel={() => setShowDiscardDialog(false)}
          onConfirm={() => { setShowDiscardDialog(false); onClose(); }}
        />
      )}

      {/* Save changes dialog (edit mode) */}
      <Dialog open={showSaveDialog} onOpenChange={open => !open && setShowSaveDialog(false)}>
        <DialogContent style={{ zIndex: 600 }}>
          <DialogHeader>
            <DialogTitle>Save Changes?</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            Please confirm to save the changes you made for this plan.
          </DialogDescription>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <Button variant="secondary" size="L" onClick={() => { setShowSaveDialog(false); onClose(); }}>
              Discard
            </Button>
            <Button
              variant="primary"
              size="L"
              onClick={() => { setShowSaveDialog(false); handleSave(); }}
            >
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
