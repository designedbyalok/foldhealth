import { describe, it, expect } from 'vitest';
import { threadTitle, withForPrefix, activeSession, keepPrefix } from './smsMembers';

const conv = { patient_name: 'John Doe', thread_name: null };
const members = [{ name: 'John Doe' }, { name: 'Liam Johnson' }, { name: 'Ava Carter' }];

describe('threadTitle', () => {
  it('a shared number lists every first name', () => {
    expect(threadTitle(conv, members)).toBe('John, Liam, Ava');
  });
  it('folds names past `max` into "+N"', () => {
    expect(threadTitle(conv, members, { max: 2 })).toBe('John, Liam, +1');
  });
  it('a custom name replaces the names', () => {
    expect(threadTitle({ ...conv, thread_name: 'Garcia Family' }, members, { max: 2 })).toBe('Garcia Family');
  });
  it('a number with one member is just the patient', () => {
    expect(threadTitle(conv, members.slice(0, 1))).toBe('John Doe');
  });
});

describe('withForPrefix', () => {
  it('adds the first name', () => {
    expect(withForPrefix('Your results are in', 'Liam Johnson')).toBe('For Liam: Your results are in');
  });
  it('swaps an existing tag for the new member', () => {
    expect(withForPrefix('For Liam: Your results are in', 'Ava Carter')).toBe('For Ava: Your results are in');
  });
  it('removes the tag when there is no name', () => {
    expect(withForPrefix('For Liam: Your results are in', null)).toBe('Your results are in');
  });
});

describe('activeSession', () => {
  const session = { member_id: 'liam', member_name: 'Liam Johnson', started_at: '2026-10-27T09:00:00Z', until: '2026-10-28T00:00:00Z' };
  it('is on until it ends', () => {
    expect(activeSession({ sms_session: session }, Date.parse('2026-10-27T20:00:00Z'))).toBe(session);
  });
  it('is off after it ends, or with none', () => {
    expect(activeSession({ sms_session: session }, Date.parse('2026-10-28T00:00:01Z'))).toBe(null);
    expect(activeSession({ sms_session: null })).toBe(null);
  });
});

describe('keepPrefix', () => {
  const prefix = 'For Liam: ';
  const prev = 'For Liam: Hello';
  it('leaves an edit after the tag alone', () => {
    expect(keepPrefix('For Liam: Hello!', prefix, prev)).toBe('For Liam: Hello!');
  });
  it('ignores a backspace into the tag', () => {
    expect(keepPrefix('For Liam:Hello', prefix, prev)).toBe('For Liam: Hello');
  });
  it('keeps just the tag after select-all delete', () => {
    expect(keepPrefix('', prefix, prev)).toBe('For Liam: ');
  });
  it('moves text typed before the tag to after it, with one tag', () => {
    expect(keepPrefix('XFor Liam: Hello', prefix, prev)).toBe('For Liam: XHello');
  });
  it('moves text typed inside the tag to after it', () => {
    expect(keepPrefix('For LiXam: Hello', prefix, prev)).toBe('For Liam: XHello');
  });
  it('replaces the text when everything is pasted over', () => {
    expect(keepPrefix('New message', prefix, prev)).toBe('For Liam: New message');
  });
});

describe('activeSession with no end time', () => {
  it('runs until it is cleared', () => {
    const s = { member_id: 'liam', member_name: 'Liam Johnson', started_at: '2026-10-27T09:00:00Z', until: null, ends: 'manual' };
    expect(activeSession({ sms_session: s }, Date.parse('2027-01-01T00:00:00Z'))).toBe(s);
  });
});
