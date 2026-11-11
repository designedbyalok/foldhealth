import { describe, expect, it } from 'vitest';
import { addBusinessDays, contactState, medRecState, relayState, visitState } from './tocDischarge';

// Wednesday 11/11/2026, noon.
const now = new Date(2026, 10, 11, 12);

describe('TOC discharge workflow', () => {
  it('counts business days over a weekend', () => {
    expect(addBusinessDays(new Date(2026, 10, 6), 2).getDate()).toBe(10); // Fri -> Tue
  });

  it('reads the 2-day contact as met, due, today or overdue', () => {
    expect(contactState({ dischargeDate: '11/03/2026', contactMetAt: '11/04/2026' }, now)).toMatchObject({ label: 'Met 11/04', tone: 'success' });
    expect(contactState({ dischargeDate: '11/09/2026' }, now)).toMatchObject({ label: 'Today 5:00 PM', tone: 'danger' });
    expect(contactState({ dischargeDate: '11/10/2026' }, now)).toMatchObject({ label: 'Thu 11/12', tone: 'warning' });
    expect(contactState({ dischargeDate: '11/05/2026' }, now)).toMatchObject({ label: 'Overdue 2d', tone: 'danger' });
  });

  it('sets the visit window by acuity and shows a booking', () => {
    expect(visitState({ dischargeDate: '11/09/2026', lace: 'High' }, now)).toMatchObject({ label: '7-day by Mon 11/16' });
    expect(visitState({ dischargeDate: '11/09/2026', lace: 'Low' }, now)).toMatchObject({ label: '14-day by Mon 11/23', tone: 'neutral' });
    expect(visitState({ dischargeDate: '10/20/2026', lace: 'High' }, now)).toMatchObject({ label: '7-day missed', tone: 'danger' });
    expect(visitState({ dischargeDate: '11/09/2026', visitWindowDays: 7, visitBookedAt: '11/13/2026' }, now)).toMatchObject({ label: '7-day booked 11/13', tone: 'success' });
    // An ED visit isn't TCM: the 7-day ED follow-up, whatever the acuity.
    expect(visitState({ dischargeDate: '11/09/2026', lace: 'Low', tocType: 'ED' }, now)).toMatchObject({ label: 'ED 7-day by Mon 11/16' });
  });

  it('labels the relay and med rec', () => {
    expect(relayState({ relayStatus: 'attempts', relayBy: 'Tara', relayAttempts: 2 })).toMatchObject({ label: 'Tara: 2 attempts', tone: 'warning' });
    expect(relayState({ relayStatus: 'live', relayBy: 'Tara', relayNote: 'Med confusion' })).toMatchObject({ label: 'Tara holding for RN', sub: 'Med confusion' });
    expect(relayState({})).toMatchObject({ label: 'Not started' });
    expect(medRecState({ medRecStatus: 'Done', medRecAt: '11/04/2026' })).toMatchObject({ label: 'Done 11/04', tone: 'success' });
    expect(medRecState({ medRecStatus: 'Pending' }).tone).toBe('warning');
  });
});
