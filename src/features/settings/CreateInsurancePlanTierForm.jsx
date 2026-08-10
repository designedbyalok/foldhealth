import { Icon } from '../../components/Icon/Icon';
import { Input } from '../../components/Input/Input';
import { Select } from '../../components/Select/Select';
import { Switch } from '../../components/Switch/Switch';
import { FieldLabel, PrefixInput } from './InsurancePlanFormUtils';
import { formatPhone, numericOnly, COVERAGE_TYPE_OPTIONS } from './CreateInsurancePlanDrawer.utils';
import styles from './CreateInsurancePlanDrawer.module.css';

export function TierForm({ tier, index, expanded, isActive, onToggle, onUpdate, onDelete, isOnly }) {
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
            aria-label="Delete tier"
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

