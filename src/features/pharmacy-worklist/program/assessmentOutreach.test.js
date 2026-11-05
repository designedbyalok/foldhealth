import { describe, expect, it } from 'vitest';
import { assessmentCallDetails, assessmentSummary, callTypeForStakeholder, nameFromRecipient } from './assessmentOutreach';

describe('assessmentSummary', () => {
  it('names who was contacted, how, and what was ticked per gap', () => {
    const text = assessmentSummary({
      party: 'Pharmacy', contact: 'CVS Pharmacy #9921', action: 'Telephonic', direction: 'Outbound', contactOutcome: 'Reached',
      outcomes: { MAD: ['Cost or insurance coverage issues'], MAH: ['Pending: Pick up', 'New 90/100DS conversion'], MAC: [] },
      note: 'Tech will call back',
    });
    expect(text.split('\n')).toEqual([
      'Assessment with Pharmacy: CVS Pharmacy #9921 (Telephonic, Outbound), reached.',
      'MAD: Cost or insurance coverage issues',
      'MAH: Pending: Pick up, New 90/100DS conversion',
      'Note: Tech will call back',
    ]);
  });

  it('says how the call ended when the contact was not reached', () => {
    expect(assessmentSummary({ party: 'Member', contact: 'Linda Washington', action: 'Telephonic', direction: 'Outbound', contactOutcome: 'UTC', outcomes: {} }))
      .toBe('Assessment with Member: Linda Washington (Telephonic, Outbound), UTC.');
  });

  it('falls back to the per-drug answers of an assessment saved before the schema form', () => {
    expect(assessmentSummary({
      party: 'Pharmacy', contact: 'Rite Aid #5532', direction: 'Outbound',
      items: [{ measure: 'MAD', drug: 'Metformin 1000 MG', steps: ['Last fill 09/20/2026 confirmed', 'Not refilled'] }],
    }).split('\n')).toEqual([
      'Assessment with Pharmacy: Rite Aid #5532 (Outbound), reached.',
      'MAD Metformin 1000 MG: Last fill 09/20/2026 confirmed, Not refilled',
    ]);
  });
});

describe('assessmentCallDetails', () => {
  it('maps an outreach call to the stakeholder, contact and direction', () => {
    expect(assessmentCallDetails({ callType: 'Prescriber', direction: 'incoming', calledTo: 'Dr. Grace Lin (626 555-0188)' }))
      .toEqual({ stakeholder: 'Provider Office', contact: 'Dr. Grace Lin', direction: 'Inbound' });
    expect(assessmentCallDetails({ callType: 'Patient', direction: 'outgoing', calledTo: '' }))
      .toEqual({ stakeholder: 'Member', contact: null, direction: 'Outbound' });
  });

  it('keeps the round trip for the stakeholders a call type names', () => {
    expect(callTypeForStakeholder('Provider Office')).toBe('Prescriber');
    expect(callTypeForStakeholder('Facility')).toBeNull();
    expect(nameFromRecipient('CVS Pharmacy #9921')).toBe('CVS Pharmacy #9921');
  });
});
