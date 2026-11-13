import { describe, expect, it } from 'vitest';
import { autoReplyPlan } from './oooAutoReply';

const now = new Date('2026-11-13T10:00:00Z');
const record = {
  id: 'ooo-1', userId: 'u-dev', userName: 'Devanshi Sharma',
  startAt: '2026-11-12T00:00:00Z', endAt: '2026-11-20T00:00:00Z',
  autoReply: true, autoReplyMessage: 'Hi! I\'m out of office.',
};
const out = (extra) => ({ id: 'm-out', direction: 'out', sender_id: 'u-dev', sender_name: 'Devanshi Sharma', created_at: '2026-11-10T09:00:00Z', ...extra });
const inbound = { id: 'm-in', direction: 'in', sender_name: 'Amy Phillips', created_at: '2026-11-13T09:59:00Z' };

describe('autoReplyPlan', () => {
  it('replies for the staff member the patient was last talking to, while they are out', () => {
    expect(autoReplyPlan({ messages: [out(), inbound], inbound, records: [record], now })).toEqual({
      record, staff: { id: 'u-dev', name: 'Devanshi Sharma' }, body: 'Hi! I\'m out of office.',
    });
  });

  it('replies only once per conversation for a record', () => {
    const sent = out({ id: 'm-auto', created_at: '2026-11-12T09:00:00Z', meta: { ooo_auto_reply: true, ooo_record_id: 'ooo-1' } });
    expect(autoReplyPlan({ messages: [out(), sent, inbound], inbound, records: [record], now })).toBeNull();
  });

  it('does nothing without an auto-reply message, or when the person is not out', () => {
    expect(autoReplyPlan({ messages: [out(), inbound], inbound, records: [{ ...record, autoReply: false }], now })).toBeNull();
    expect(autoReplyPlan({ messages: [out(), inbound], inbound, records: [{ ...record, autoReplyMessage: '  ' }], now })).toBeNull();
    expect(autoReplyPlan({ messages: [out(), inbound], inbound, records: [{ ...record, startAt: '2026-11-14T00:00:00Z' }], now })).toBeNull();
  });

  it('ignores our own messages, internal notes and threads nobody has answered', () => {
    expect(autoReplyPlan({ messages: [out()], inbound: out(), records: [record], now })).toBeNull();
    expect(autoReplyPlan({ messages: [out(), { ...inbound, internal: true }], inbound: { ...inbound, internal: true }, records: [record], now })).toBeNull();
    expect(autoReplyPlan({ messages: [inbound], inbound, records: [record], now })).toBeNull();
  });

  it('goes by the latest person who wrote, not an earlier one', () => {
    const later = out({ id: 'm-2', sender_id: 'u-other', sender_name: 'Megan Miller', created_at: '2026-11-12T08:00:00Z' });
    expect(autoReplyPlan({ messages: [out(), later, inbound], inbound, records: [record], now })).toBeNull();
  });
});
