import { CRM_CHANNELS } from '../../../data/crmActivity';

// How each stream kind looks on the Timeline: its tile and its label in the
// Type filter. Touchpoint channels reuse the CRM tab's channel tiles.
const CLINICAL = {
  lab:          { label: 'Lab', icon: 'solar:test-tube-linear', color: 'var(--accent-pink)', tint: 'var(--accent-light-pink)' },
  adt:          { label: 'Hospital (ADT)', icon: 'solar:hospital-linear', color: 'var(--status-error)', tint: 'var(--status-error-light)' },
  encounter:    { label: 'Visit', icon: 'solar:stethoscope-linear', color: 'var(--accent-cyan)', tint: 'var(--accent-light-cyan)' },
  diagnosis:    { label: 'Diagnosis', icon: 'solar:clipboard-heart-linear', color: 'var(--accent-purple)', tint: 'var(--accent-light-purple)' },
  procedure:    { label: 'Procedure', icon: 'solar:health-linear', color: 'var(--accent-purple)', tint: 'var(--accent-light-purple)' },
  immunization: { label: 'Immunization', icon: 'solar:syringe-linear', color: 'var(--accent-teal)', tint: 'var(--accent-light-teal)' },
  medication:   { label: 'Medication', icon: 'solar:pill-linear', color: 'var(--accent-blue)', tint: 'var(--accent-light-blue)' },
  med_start:    { label: 'Medication started', icon: 'solar:pill-linear', color: 'var(--accent-blue)', tint: 'var(--accent-light-blue)' },
  med_stop:     { label: 'Medication stopped', icon: 'solar:pill-linear', color: 'var(--accent-blue-grey)', tint: 'var(--accent-light-blue-grey)' },
  device:       { label: 'Device reading', icon: 'solar:smartwatch-linear', color: 'var(--accent-green)', tint: 'var(--accent-light-green-tint)' },
  prom:         { label: 'Patient-reported', icon: 'solar:user-speak-linear', color: 'var(--accent-amber)', tint: 'var(--accent-light-amber)' },
  note:         { label: 'Clinical note', icon: 'solar:notes-linear', color: 'var(--primary-300)', tint: 'var(--primary-100)' },
  assessment:   { label: 'Assessment', icon: 'solar:clipboard-list-linear', color: 'var(--accent-pink)', tint: 'var(--accent-light-pink)' },
  appointment:  { label: 'Appointment', icon: 'solar:calendar-linear', color: 'var(--primary-300)', tint: 'var(--primary-100)' },
  program:      { label: 'Program update', icon: 'solar:checklist-minimalistic-linear', color: 'var(--neutral-300)', tint: 'var(--neutral-50)' },
};

export const STREAM_KINDS = { ...Object.fromEntries(Object.entries(CRM_CHANNELS).map(([k, c]) => [k, c])), ...CLINICAL };

export const kindMeta = kind => STREAM_KINDS[kind] || { label: kind, icon: 'solar:record-linear', color: 'var(--neutral-300)', tint: 'var(--neutral-50)' };

export const TONE_COLOR = {
  success: 'var(--status-success)',
  warning: 'var(--status-warning)',
  error: 'var(--status-error)',
};
