import { describe, expect, it } from 'vitest';
import {
  appointmentForDrawer, findWorklistMember, gapForHighlight, icdFromText, openOverviewGap, toDrawerDate,
} from './overviewItemActions';

describe('overview item openers', () => {
  it('turns banner dates into the appointment drawer format', () => {
    expect(toDrawerDate('09/11/2024')).toBe('09-11-2024');
    expect(toDrawerDate('2024-09-11')).toBe('09-11-2024');
    expect(toDrawerDate('9-5-2024')).toBe('09-05-2024');
  });

  it('uses the stored appointment when the visit matches', () => {
    const stored = {
      id: 'a1',
      patient_id: '11089',
      appointment_type_name: 'Follow up',
      date: '09-15-2024',
      time_start: '12:30 pm',
    };
    const row = appointmentForDrawer(
      { type: 'Follow up', date: '09/15/2024', time: '12:30 PM', provider: 'Dr. Robert' },
      { patientId: '11089', appointments: [stored] },
    );
    expect(row).toBe(stored);
  });

  it('still opens a banner visit that is not on the calendar', () => {
    const row = appointmentForDrawer(
      { type: 'Care Plan Review', date: '09/11/2024', time: '9:30 AM', program: 'HIU', provider: 'Ivy Ralph' },
      { patientId: '11089', patientName: 'Annette Brave', appointments: [] },
    );
    expect(row.id).toBeUndefined();
    expect(row.date).toBe('09-11-2024');
    expect(row.time_start).toBe('9:30 am');
    expect(row.patient_name).toBe('Annette Brave');
    expect(row.appointment_type_name).toBe('Care Plan Review');
  });

  it('matches a worklist member by id or name', () => {
    const members = [{ id: 'h1', memberId: '11089', name: 'Annette Brave' }];
    expect(findWorklistMember(members, { id: 'other', memberId: '11089' })).toBe(members[0]);
    expect(findWorklistMember(members, { id: 'x', name: 'annette brave' })).toBe(members[0]);
    expect(findWorklistMember(members, { id: 'x', name: 'Someone Else' })).toBeNull();
  });

  it('reads an ICD out of a gap title and ignores HCC numbers', () => {
    expect(icdFromText('Diabetes with chronic complications (E11.65)')).toBe('E11.65');
    expect(icdFromText('HCC 37')).toBeNull();
  });

  it('opens a quality gap against the matching HEDIS member', () => {
    const member = { id: 'm1', name: 'Annette Brave' };
    let opened = null;
    const ok = openOverviewGap(
      { category: 'quality', code: 'EED', title: 'Diabetic eye exam' },
      {
        patient: { name: 'Annette Brave' },
        hedisMembers: [member],
        hedisLoading: false,
        setCareGap: (next) => { opened = next; },
      },
    );
    expect(ok).toBe(true);
    expect(opened.member).toBe(member);
    expect(opened.gapCode).toBe('EED');
    expect(opened.year).toBe(new Date().getFullYear());
  });

  it('pairs a lab highlight with the gap that names the same measure', () => {
    const gaps = [
      { id: 'g1', category: 'quality', code: 'EED', title: 'Diabetic eye exam' },
      { id: 'g2', category: 'quality', code: 'HBD', title: 'HbA1c control (<8%)' },
    ];
    expect(gapForHighlight({ title: 'HbA1c 8.2%, up from 7.6%' }, gaps)?.code).toBe('HBD');
    expect(gapForHighlight({ title: 'ER visit: chest pain' }, gaps)).toBeNull();
  });
});
