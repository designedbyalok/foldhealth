// Practice location form options, shared by EditLocationDrawer and the phone.

// IANA timezones we support in the Timezone picker. Kept short and
// US-centric: matches the seeded practice locations.
export const TIMEZONE_OPTIONS = [
  { value: 'America/New_York',    label: 'America/New_York (ET)' },
  { value: 'America/Detroit',     label: 'America/Detroit (ET)' },
  { value: 'America/Chicago',     label: 'America/Chicago (CT)' },
  { value: 'America/Denver',      label: 'America/Denver (MT)' },
  { value: 'America/Phoenix',     label: 'America/Phoenix (MT)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PT)' },
  { value: 'America/Anchorage',   label: 'America/Anchorage (AKT)' },
  { value: 'Pacific/Honolulu',    label: 'Pacific/Honolulu (HST)' },
];

export const DAY_KEYS  = ['Su', 'M', 'T', 'W', 'Th', 'F', 'Sa'];
export const DAY_LABEL = { Su: 'S', M: 'M', T: 'T', W: 'W', Th: 'T', F: 'F', Sa: 'S' };

// Blank slot row: Mon-Fri, empty times, no location scope. New drawers open
// with one blank slot ready to fill; Edit drawers hydrate from businessHours.
export function blankSlot() {
  return { days: ['M', 'T', 'W', 'Th', 'F'], from: '', to: '', timezone: 'America/New_York', locationId: '' };
}
