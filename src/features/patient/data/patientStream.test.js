import { describe, expect, it } from 'vitest';
import {
  buildPatientStream, filterStream, fromAppointment, fromClinicalEvent, fromClinicalNote, fromCrmActivity, fromMedication, parseDateTime,
} from './patientStream';

describe('parseDateTime', () => {
  it('reads US and ISO dates with a 12- or 24-hour time', () => {
    expect(parseDateTime('10-08-2026', '2:00 pm')).toEqual(new Date(2026, 9, 8, 14, 0));
    expect(parseDateTime('10/08/2026', '12:15 am')).toEqual(new Date(2026, 9, 8, 0, 15));
    expect(parseDateTime('2026-10-08', '13:30')).toEqual(new Date(2026, 9, 8, 13, 30));
    expect(parseDateTime('2026-10-08')).toEqual(new Date(2026, 9, 8));
    expect(parseDateTime('soon')).toBeNull();
  });
});

describe('fromClinicalEvent', () => {
  it('flags a lab outside its range', () => {
    const e = fromClinicalEvent({ id: 1, event_type: 'lab', display: 'HbA1c', numeric_value: 9.4, unit: '%', reference_high: 5.6, effective_date: '2026-05-20' });
    expect(e).toMatchObject({ category: 'clinical', title: 'HbA1c 9.4 %', outcome: 'Out of range', tone: 'error', detail: 'Range 5.6 %' });
    expect(e.at).toBe(new Date(2026, 4, 20).getTime());
    expect(e.facts.filter(f => f.value)).toEqual([{ label: 'Result', value: '9.4 %' }, { label: 'High', value: '5.6 %' }]);
  });

  it('reads ADT events from raw_meta', () => {
    const e = fromClinicalEvent({ id: 2, event_type: 'adt', display: 'CHF exacerbation', effective_date: '2026-08-21', raw_meta: { action: 'discharge', facility: 'Mercy General', disposition: 'Home', followUp: 'TCM call due' } });
    expect(e).toMatchObject({ title: 'Discharged: Mercy General', detail: 'CHF exacerbation · Disposition: Home', outcome: 'TCM call due' });
    expect(e.facts.filter(f => f.value).map(f => f.label)).toEqual(['Facility', 'Reason', 'Disposition', 'Follow-up']);
  });
});

describe('other sources', () => {
  it('turns a medication into start and stop events', () => {
    expect(fromMedication({ id: 'm', name: 'Losartan', start: '09/18/2026', stop: '2026-09-22', stopReason: 'Adverse Reaction' }).map(e => e.title))
      .toEqual(['Started Losartan', 'Stopped Losartan']);
  });

  it('keeps a touchpoint’s program, billing program, duration and vendor', () => {
    const e = fromCrmActivity({ id: 'c', channel: 'call', title: 'Outgoing call', status: 'Completed', performedBy: 'Tara', performedByRole: 'Agent', occurredAt: '2026-10-20T10:00:00Z', programCode: 'TCM', billingProgram: 'CCM', durationSeconds: 252, vendorName: 'Astrana' });
    expect(e).toMatchObject({ category: 'touchpoint', kind: 'call', program: 'TCM', billingProgram: 'CCM', durationSeconds: 252, vendor: 'Astrana', tone: 'success' });
  });

  it('reads a note title from its form type', () => {
    expect(fromClinicalNote({ id: 'n', form_type: 'consolidated_visit_note', created_at: '2026-10-01T00:00:00Z' }).title).toBe('Consolidated visit note');
    expect(fromClinicalNote({ id: 'n', form_type: 'SOAP', created_at: '2026-10-01T00:00:00Z' }).title).toBe('SOAP note');
  });

  it('marks no-show appointments', () => {
    expect(fromAppointment({ id: 'a', appointment_type_name: 'Follow-up', date: '10-08-2026', time_start: '9:00 am', status: 'No Show' }).tone).toBe('error');
  });
});

describe('buildPatientStream / filterStream', () => {
  const stream = buildPatientStream({
    clinicalEvents: [{ id: 1, event_type: 'lab', display: 'LDL', numeric_value: 142, effective_date: '2026-05-20' }],
    crm: [{ id: 'c', channel: 'sms', title: 'Reminder', occurredAt: '2026-10-01T09:00:00Z', programCode: 'CCM' }],
    calls: [{ id: 'x', dir: 'incoming', created_at: 'not a date' }],
    programActivity: [{ id: 'p', title: 'CCM Program Status Change', occurredAt: '2026-09-01T09:00:00Z', programCode: 'CCM' }],
  });

  it('merges sources newest first and drops events without a time', () => {
    expect(stream.map(e => e.id)).toEqual(['crm-c', 'pa-p', 'ce-1']);
  });

  it('filters by category, kind and program', () => {
    expect(filterStream(stream, { categories: ['clinical'] }).map(e => e.id)).toEqual(['ce-1']);
    expect(filterStream(stream, { programs: ['CCM'] }).map(e => e.id)).toEqual(['crm-c', 'pa-p']);
    expect(filterStream(stream, { kinds: ['sms'] }).map(e => e.id)).toEqual(['crm-c']);
  });
});
