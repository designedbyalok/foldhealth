import { useState, useMemo, useId } from 'react';
import { Drawer } from '../../../../components/Drawer/Drawer';
import { Button } from '../../../../components/Button/Button';
import { Input } from '../../../../components/Input/Input';
import { Select } from '../../../../components/Select/Select';
import { ActionButton } from '../../../../components/ActionButton/ActionButton';
import { Icon } from '../../../../components/Icon/Icon';
import { EHR_INSTANCES } from './data/mock';
import styles from './EditLocationDrawer.module.css';

// IANA timezones we support in the Timezone picker. Kept short and
// US-centric — matches the seeded practice locations.
const TIMEZONE_OPTIONS = [
  { value: 'America/New_York',    label: 'America/New_York (ET)' },
  { value: 'America/Detroit',     label: 'America/Detroit (ET)' },
  { value: 'America/Chicago',     label: 'America/Chicago (CT)' },
  { value: 'America/Denver',      label: 'America/Denver (MT)' },
  { value: 'America/Phoenix',     label: 'America/Phoenix (MT)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PT)' },
  { value: 'America/Anchorage',   label: 'America/Anchorage (AKT)' },
  { value: 'Pacific/Honolulu',    label: 'Pacific/Honolulu (HST)' },
];

const DAY_KEYS  = ['Su', 'M', 'T', 'W', 'Th', 'F', 'Sa'];
const DAY_LABEL = { Su: 'S', M: 'M', T: 'T', W: 'W', Th: 'T', F: 'F', Sa: 'S' };

// Blank slot row — Mon-Fri, empty times, no location scope. New drawers open
// with one blank slot ready to fill; Edit drawers hydrate from businessHours.
function blankSlot() {
  return { days: ['M', 'T', 'W', 'Th', 'F'], from: '', to: '', timezone: 'America/New_York', locationId: '' };
}

const EMPTY_ALL_LOCATIONS = [];

/**
 * EditLocationDrawer — used for both "New Location" and "Edit Practice
 * Location". Two-step wizard:
 *   1. Practice location — EHR + address + timezone + phone
 *   2. Business hours    — day chips + time slots
 *
 * Callers supply the initial `location` (null for New) and `onSubmit`; the
 * drawer builds the merged object and hands it back for persistence.
 */
export function EditLocationDrawer({ location, allLocations = EMPTY_ALL_LOCATIONS, onClose, onSubmit }) {
  const uid = useId();
  const isEdit = !!location;
  const [step, setStep] = useState(1);

  const [form, setForm] = useState(() => ({
    id:             location?.id ?? `loc-${Date.now()}`,
    name:           location?.name ?? '',
    ehrInstance:    location?.ehrInstance ?? 'Fold EHR',
    addressLine1:   location?.addressLine1 ?? '',
    addressLine2:   location?.addressLine2 ?? '',
    city:           location?.city ?? '',
    state:          location?.state ?? '',
    zipCode:        location?.zipCode ?? '',
    timezone:       location?.timezone ?? 'America/New_York',
    googleMapLink:  location?.googleMapLink ?? '',
    defaultPhone:   location?.defaultPhone ?? '',
    businessHours:  location?.businessHours?.length
      ? location.businessHours.map(s => ({ ...s, timezone: s.timezone || 'America/New_York', locationId: s.locationId || '' }))
      : [blankSlot()],
  }));

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  // Step 1 required fields. Kept in one place so the Next / Submit button
  // stays honest across both steps.
  const step1Valid = form.name.trim() && form.addressLine1.trim() && form.zipCode.trim() && form.timezone;
  const canSubmit  = step1Valid;

  const toggleDay = (slotIdx, dayKey) => {
    setForm(prev => {
      const next = [...prev.businessHours];
      const s = next[slotIdx];
      const days = s.days.includes(dayKey) ? s.days.filter(d => d !== dayKey) : [...s.days, dayKey];
      next[slotIdx] = { ...s, days };
      return { ...prev, businessHours: next };
    });
  };
  const updateSlot = (slotIdx, key, value) => {
    setForm(prev => {
      const next = [...prev.businessHours];
      next[slotIdx] = { ...next[slotIdx], [key]: value };
      return { ...prev, businessHours: next };
    });
  };
  const addSlot    = () => setForm(prev => ({ ...prev, businessHours: [...prev.businessHours, blankSlot()] }));
  const removeSlot = (slotIdx) => setForm(prev => ({ ...prev, businessHours: prev.businessHours.filter((_, i) => i !== slotIdx) }));

  const locationOptions = useMemo(
    () => allLocations.map(l => ({ value: l.id, label: l.name })),
    [allLocations],
  );

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({ ...form, updatedAt: new Date().toISOString() });
  };

  // Cancel lives on the drawer's shared CloseButton (top-right X) — no need
  // for a duplicate CTA. Step 1 only ships Next; step 2 ships Previous +
  // Submit at the canonical size="L" variant pair.
  const drawerProps = step === 1
    ? {
        primaryAction: <Button variant="primary" size="L" onClick={() => setStep(2)} disabled={!step1Valid}>Next</Button>,
      }
    : {
        secondaryAction: <Button variant="secondary" size="L" onClick={() => setStep(1)}>Previous</Button>,
        primaryAction:   <Button variant="primary"   size="L" onClick={handleSubmit} disabled={!canSubmit}>Submit</Button>,
      };

  return (
    <Drawer
      title={isEdit ? 'Edit Practice Location' : 'New Practice Location'}
      onClose={onClose}
      bodyClassName={styles.drawerBody}
      {...drawerProps}
    >
      {/* Stepper — reads active vs done off the current step. Step 1 flips to
          "done" (checkmark) as soon as the user advances past it. */}
      <div className={styles.stepper}>
        <span className={`${styles.step} ${step === 1 ? styles.stepActive : styles.stepDone}`}>
          <span className={styles.stepDot}>
            {step > 1 ? <Icon name="solar:check-read-linear" size={12} color="currentColor" /> : '1'}
          </span>
          Practice location
        </span>
        <span className={`${styles.stepBar} ${step > 1 ? styles.stepBarDone : ''}`} />
        <span className={`${styles.step} ${step === 2 ? styles.stepActive : ''}`}>
          <span className={styles.stepDot}>2</span>
          Business hours
        </span>
      </div>

      <div className={styles.body}>
        {step === 1 ? (
          <>
            <div className={styles.section}>
              <label className={styles.label} htmlFor={`${uid}-ehr-instance`}>Select EHR Instance</label>
              <Select
                id={`${uid}-ehr-instance`}
                value={form.ehrInstance}
                onChange={(v) => set('ehrInstance', v)}
                options={EHR_INSTANCES.map(e => ({ value: e, label: e }))}
              />
            </div>

            <div className={styles.section}>
              <label className={styles.label} htmlFor={`${uid}-name`}>Name<span className={styles.required}>*</span></label>
              <Input id={`${uid}-name`} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Practice location name" />
            </div>

            <div className={styles.section}>
              <label className={styles.label} htmlFor={`${uid}-address1`}>Address Line 1<span className={styles.required}>*</span></label>
              <Input id={`${uid}-address1`} value={form.addressLine1} onChange={e => set('addressLine1', e.target.value)} placeholder="Street address" />
            </div>

            <div className={styles.section}>
              <label className={styles.label} htmlFor={`${uid}-address2`}>Address Line 2</label>
              <Input id={`${uid}-address2`} value={form.addressLine2} onChange={e => set('addressLine2', e.target.value)} placeholder="Suite, floor, etc." />
            </div>

            <div className={styles.twoCol}>
              <div className={styles.section}>
                <label className={styles.label} htmlFor={`${uid}-zip`}>Zipcode<span className={styles.required}>*</span></label>
                <Input id={`${uid}-zip`} value={form.zipCode} onChange={e => set('zipCode', e.target.value)} placeholder="e.g. 21201" />
              </div>
              <div className={styles.section}>
                <label className={styles.label} htmlFor={`${uid}-timezone`}>Select Timezone<span className={styles.required}>*</span></label>
                <Select id={`${uid}-timezone`} value={form.timezone} onChange={(v) => set('timezone', v)} options={TIMEZONE_OPTIONS} searchable />
              </div>
            </div>

            <div className={styles.twoCol}>
              <div className={styles.section}>
                <label className={styles.label} htmlFor={`${uid}-city`}>City</label>
                <Input id={`${uid}-city`} value={form.city} onChange={e => set('city', e.target.value)} placeholder="City" />
              </div>
              <div className={styles.section}>
                <label className={styles.label} htmlFor={`${uid}-state`}>State</label>
                <Input id={`${uid}-state`} value={form.state} onChange={e => set('state', e.target.value)} placeholder="State" />
              </div>
            </div>

            <div className={styles.section}>
              <label className={styles.label} htmlFor={`${uid}-map-link`}>Google Map Link</label>
              <Input id={`${uid}-map-link`} value={form.googleMapLink} onChange={e => set('googleMapLink', e.target.value)} placeholder="Enter Google Map Link" />
            </div>

            <div className={styles.section}>
              <label className={styles.label} htmlFor={`${uid}-default-phone`}>Default Communication Number</label>
              <Input id={`${uid}-default-phone`} value={form.defaultPhone} onChange={e => set('defaultPhone', e.target.value)} placeholder="+1 (555) 000-0000" />
              <p className={styles.empty}>Set the location default communication phone number to enable automation to send SMS to patients based on their assigned location.</p>
            </div>
          </>
        ) : (
          <>
            <div className={styles.slotBar}>
              <Button variant="secondary" size="S" leadingIcon="solar:add-circle-linear" onClick={addSlot}>Add Slots</Button>
            </div>

            {form.businessHours.map((slot, idx) => (
              <div key={idx} className={styles.slotCard}>
                <div className={styles.slotHeader}>
                  <div className={styles.dayChips}>
                    {DAY_KEYS.map(dk => {
                      const active = slot.days.includes(dk);
                      return (
                        <button
                          key={dk}
                          type="button"
                          className={`${styles.dayChip} ${active ? styles.dayChipActive : ''}`}
                          onClick={() => toggleDay(idx, dk)}
                        >{DAY_LABEL[dk]}</button>
                      );
                    })}
                  </div>
                  <span style={{ flex: 1 }} />
                  <span className={styles.label}>Timezone:</span>
                  <div style={{ minWidth: 200 }}>
                    <Select
                      value={slot.timezone}
                      onChange={(v) => updateSlot(idx, 'timezone', v)}
                      options={TIMEZONE_OPTIONS}
                      searchable
                    />
                  </div>
                  <ActionButton
                    icon="solar:trash-bin-minimalistic-linear"
                    size="S"
                    tooltip="Remove slot"
                    onClick={() => removeSlot(idx)}
                    disabled={form.businessHours.length === 1}
                  />
                </div>
                <div className={styles.slotFooter}>
                  <div className={styles.slotFieldStack}>
                    <span className={styles.label}>From time</span>
                    <Input
                      type="time"
                      value={slot.from}
                      onChange={e => updateSlot(idx, 'from', e.target.value)}
                    />
                  </div>
                  <div className={styles.slotFieldStack}>
                    <span className={styles.label}>To time</span>
                    <Input
                      type="time"
                      value={slot.to}
                      onChange={e => updateSlot(idx, 'to', e.target.value)}
                    />
                  </div>
                  <div className={styles.slotFieldStack}>
                    <span className={styles.label}>Location</span>
                    <Select
                      value={slot.locationId}
                      onChange={(v) => updateSlot(idx, 'locationId', v)}
                      options={[{ value: '', label: 'This location' }, ...locationOptions]}
                      placeholder="This location"
                    />
                  </div>
                  <div className={styles.slotTrash} />
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </Drawer>
  );
}
