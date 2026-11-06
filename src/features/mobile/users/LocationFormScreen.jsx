import { useState } from 'react';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Button } from '../../../components/Button/Button';
import { Icon } from '../../../components/Icon/Icon';
import { Input } from '../../../components/Input/Input';
import { useAppStore } from '../../../store/useAppStore';
import { EHR_INSTANCES } from '../../settings/account/locations/data/mock';
import { DAY_KEYS, DAY_LABEL, TIMEZONE_OPTIONS, blankSlot } from '../../settings/account/locations/locationForm';
import { deleteLocation, saveLocation } from '../../settings/account/locations/locationActions';
import { ConfirmSheet } from '../care/CarePlanSheets';
import { MobileEmpty } from '../MobileParts';
import { useMobileNav } from '../MobileNavContext';
import { FieldGroup, FormScreen, PickerField } from '../patient/FormScreen';
import { NoAccountAccess } from './accountAccess';
import { useAccountAccess } from './useAccountAccess';
import settings from '../settings/settings.module.css';

const DAY_NAME = { Su: 'Sunday', M: 'Monday', T: 'Tuesday', W: 'Wednesday', Th: 'Thursday', F: 'Friday', Sa: 'Saturday' };

/**
 * New or edit practice location (desktop EditLocationDrawer): the location
 * fields and its business-hour slots on one screen, the same required
 * fields, and the same practice_locations upsert / soft delete.
 */
export function LocationFormScreen(props) {
  const allowed = useAccountAccess();
  if (!allowed) return <NoAccountAccess title="Location" />;
  return <LocationForm {...props} />;
}

function LocationForm({ locationId }) {
  const { pop } = useMobileNav();
  const locations = useAppStore(s => s.practiceLocations);
  const upsertLocation = useAppStore(s => s.upsertPracticeLocation);
  const removeLocation = useAppStore(s => s.removePracticeLocation);
  const fetchLocations = useAppStore(s => s.fetchPracticeLocations);
  const showToast = useAppStore(s => s.showToast);
  const location = locationId ? locations.find(l => l.id === locationId) : null;
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
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (key) => (v) => setForm(f => ({ ...f, [key]: v }));
  const setSlot = (i, patch) => setForm(f => ({ ...f, businessHours: f.businessHours.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const valid = form.name.trim() && form.addressLine1.trim() && form.zipCode.trim() && form.timezone;
  const otherLocations = [{ value: '', label: 'This location' }, ...locations.filter(l => l.id !== form.id).map(l => ({ value: l.id, label: l.name }))];

  if (locationId && !location) {
    return (
      <FormScreen title="Location">
        <MobileEmpty icon="solar:map-point-linear" title="Location not found" description="It may have been deleted." />
      </FormScreen>
    );
  }

  const submit = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      await saveLocation({ ...form, updatedAt: new Date().toISOString() }, { upsertLocation, fetchLocations, showToast });
    } finally {
      setSaving(false);
    }
    pop();
  };

  return (
    <FormScreen
      title={location ? 'Edit location' : 'New location'}
      subtitle={location?.name}
      actions={location ? <ActionButton icon="solar:trash-bin-minimalistic-linear" size="lg" aria-label="Delete location" onClick={() => setConfirmDelete(true)} /> : null}
      footer={<Button size="lg" disabled={!valid} loading={saving} onClick={submit}>{location ? 'Save' : 'Add location'}</Button>}
    >
      <FieldGroup label="Practice location">
        <PickerField label="EHR instance" options={EHR_INSTANCES.map(e => ({ value: e, label: e }))} value={form.ehrInstance} onChange={set('ehrInstance')} />
        <Input size="lg" label="Name" required placeholder="Practice location name" value={form.name} onValueChange={set('name')} />
        <Input size="lg" label="Address line 1" required placeholder="Street address" value={form.addressLine1} onValueChange={set('addressLine1')} />
        <Input size="lg" label="Address line 2" placeholder="Suite, floor, etc." value={form.addressLine2} onValueChange={set('addressLine2')} />
        <div className={settings.row2}>
          <Input size="lg" label="Zip code" required inputMode="numeric" placeholder="e.g. 21201" value={form.zipCode} onValueChange={set('zipCode')} />
          <Input size="lg" label="City" placeholder="City" value={form.city} onValueChange={set('city')} />
        </div>
        <Input size="lg" label="State" placeholder="State" value={form.state} onValueChange={set('state')} />
        <PickerField label="Timezone" required options={TIMEZONE_OPTIONS} value={form.timezone} onChange={set('timezone')} />
        <Input size="lg" type="url" inputMode="url" autoCapitalize="none" label="Google Map link" placeholder="Enter Google Map Link" value={form.googleMapLink} onValueChange={set('googleMapLink')} />
        <Input size="lg" type="tel" label="Default phone" placeholder="+1 (555) 000-0000" value={form.defaultPhone} onValueChange={set('defaultPhone')} />
      </FieldGroup>

      <FieldGroup label="Business hours">
        {form.businessHours.map((slot, i) => (
          <div key={i} className={settings.slot}>
            <div className={settings.slotHead}>
              <span>Slot {i + 1}</span>
              <button
                type="button"
                className={settings.iconBtn}
                aria-label={`Remove slot ${i + 1}`}
                disabled={form.businessHours.length === 1}
                onClick={() => setForm(f => ({ ...f, businessHours: f.businessHours.filter((_, j) => j !== i) }))}
              >
                <Icon name="solar:trash-bin-minimalistic-linear" size={24} color="currentColor" />
              </button>
            </div>
            <div className={settings.days} role="group" aria-label={`Slot ${i + 1} days`}>
              {DAY_KEYS.map(dk => {
                const on = slot.days.includes(dk);
                return (
                  <button
                    key={dk}
                    type="button"
                    aria-pressed={on}
                    aria-label={DAY_NAME[dk]}
                    className={[settings.day, on ? settings.dayOn : ''].filter(Boolean).join(' ')}
                    onClick={() => setSlot(i, { days: on ? slot.days.filter(d => d !== dk) : [...slot.days, dk] })}
                  >
                    {DAY_LABEL[dk]}
                  </button>
                );
              })}
            </div>
            <div className={settings.row2}>
              <Input size="lg" type="time" label="From" value={slot.from} onValueChange={(v) => setSlot(i, { from: v })} />
              <Input size="lg" type="time" label="To" value={slot.to} onValueChange={(v) => setSlot(i, { to: v })} />
            </div>
            <PickerField label="Timezone" options={TIMEZONE_OPTIONS} value={slot.timezone} onChange={(v) => setSlot(i, { timezone: v })} />
            <PickerField label="Location" options={otherLocations} value={slot.locationId} onChange={(v) => setSlot(i, { locationId: v })} />
          </div>
        ))}
        <Button size="lg" variant="outline" leadingIcon="solar:add-circle-linear" onClick={() => setForm(f => ({ ...f, businessHours: [...f.businessHours, blankSlot()] }))}>
          Add slot
        </Button>
      </FieldGroup>

      {confirmDelete && (
        <ConfirmSheet
          title="Delete location?"
          text={`Please confirm if you want to permanently delete "${location.name}" from the system.`}
          confirmLabel="Delete location"
          onClose={() => setConfirmDelete(false)}
          onConfirm={async () => {
            setConfirmDelete(false);
            await deleteLocation(location, { removeLocation, fetchLocations, showToast });
            pop();
          }}
        />
      )}
    </FormScreen>
  );
}
