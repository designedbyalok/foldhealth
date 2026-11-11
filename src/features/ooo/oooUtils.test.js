import { describe, expect, it } from 'vitest';
import { fromPickerValue, toPickerValue, activeOooFor, canDelete, canEdit, daySpan, formatDateTime, oooStatus, rangeChange, recordsOnDate, overlapPlan, recordsFor, samePerson, peopleOptions, sortRecords, validateOoo, describeRange, appointmentsToReassign, coveringPeople, phoneTreeOnCall } from './oooUtils';

const at = (d, h = 0, m = 0) => new Date(2026, 8, d, h, m).toISOString(); // Sept 2026, local time
const rec = (id, s, e, userName = 'Richard Willson') => ({ id, userName, startAt: s, endAt: e });
const now = new Date(2026, 8, 10, 12, 0);

describe('oooStatus', () => {
  it('is Upcoming, Ongoing or Past relative to now', () => {
    expect(oooStatus(rec('a', at(11), at(12)), now)).toBe('Upcoming');
    expect(oooStatus(rec('b', at(10), at(11)), now)).toBe('Ongoing');
    expect(oooStatus(rec('c', at(5), at(6)), now)).toBe('Past');
  });
  it('lets ongoing records be edited but only upcoming ones deleted', () => {
    const ongoing = rec('b', at(10), at(11));
    expect(canEdit(ongoing, now)).toBe(true);
    expect(canDelete(ongoing, now)).toBe(false);
    expect(canEdit(rec('c', at(5), at(6)), now)).toBe(false);
  });
});

describe('activeOooFor', () => {
  it('finds the ongoing record by name, ignoring case', () => {
    const list = [rec('x', at(11), at(12)), rec('y', at(9), at(11))];
    expect(activeOooFor(list, 'richard willson', now)?.id).toBe('y');
    expect(activeOooFor(list, 'Someone Else', now)).toBeNull();
  });
});

describe('recordsOnDate and daySpan', () => {
  const r = rec('a', at(8, 18), at(10, 6));
  it('matches every day the record touches', () => {
    expect(recordsOnDate([r], '2026-09-08')).toHaveLength(1);
    expect(recordsOnDate([r], '2026-09-10')).toHaveLength(1);
    expect(recordsOnDate([r], '2026-09-11')).toHaveLength(0);
  });
  it('gives the part of each day that is out of office', () => {
    expect(daySpan(r, '2026-09-08')).toEqual({ start: 0.75, end: 1 });
    expect(daySpan(r, '2026-09-09')).toEqual({ start: 0, end: 1 });
    expect(daySpan(r, '2026-09-10')).toEqual({ start: 0, end: 0.25 });
  });
});

describe('rangeChange', () => {
  const original = rec('a', at(11), at(20));
  it('flags removed dates as reduced and new dates as extended', () => {
    expect(rangeChange(original, { startAt: at(11), endAt: at(18) })).toEqual({ reduced: true, extended: false });
    expect(rangeChange(original, { startAt: at(11), endAt: at(24) })).toEqual({ reduced: false, extended: true });
    expect(rangeChange(original, { startAt: at(13), endAt: at(24) })).toEqual({ reduced: true, extended: true });
    expect(rangeChange(original, { startAt: at(11), endAt: at(20) })).toEqual({ reduced: false, extended: false });
  });
});

describe('appointmentsToReassign', () => {
  it('counts the provider\'s upcoming, uncancelled appointments inside the dates', () => {
    const r = rec('a', at(10), at(13));
    const appts = [
      { primary_user: 'Richard Willson', date: '09-11-2026', time_start: '9:00 am', status: 'Scheduled' },
      { primary_user: 'richard willson', date: '09-12-2026', time_start: '2:30 pm', status: 'Scheduled' },
      { primary_user: 'Richard Willson', date: '09-12-2026', time_start: '3:00 pm', status: 'Cancelled' },
      { primary_user: 'Richard Willson', date: '09-10-2026', time_start: '9:00 am', status: 'Scheduled' }, // before now
      { primary_user: 'Richard Willson', date: '09-13-2026', time_start: '9:00 am', status: 'Scheduled' }, // after the end
      { primary_user: 'Someone Else', date: '09-11-2026', time_start: '9:00 am', status: 'Scheduled' },
    ];
    expect(appointmentsToReassign(r, appts, now)).toHaveLength(2);
  });
});

describe('describeRange', () => {
  it('ends whole days on the last day out, and shows short spans in minutes', () => {
    expect(describeRange(new Date(2026, 9, 2), new Date(2026, 9, 15))).toEqual({ span: '10/02/2026 – 10/14/2026', length: '13 days' });
    expect(describeRange(new Date(2026, 9, 2), new Date(2026, 9, 3)).span).toBe('10/02/2026');
    expect(describeRange(new Date(2026, 9, 2, 9), new Date(2026, 9, 2, 9, 20)).length).toBe('20 minutes');
  });
});

describe('validateOoo', () => {
  it('rejects dates that overlap the same provider\'s other records', () => {
    const existing = [rec('x', at(12), at(15)), rec('y', at(12), at(15), 'Someone Else')];
    const base = { userName: 'Richard Willson' };
    expect(validateOoo({ ...base, startAt: at(14), endAt: at(16) }, { now, existing }).overlap).toMatch(/already exists/);
    // Touching end to start is fine, as is another provider's time or the record itself.
    expect(validateOoo({ ...base, startAt: at(15), endAt: at(16) }, { now, existing })).toEqual({});
    expect(validateOoo({ userName: 'Someone Else 2', startAt: at(13), endAt: at(14) }, { now, existing })).toEqual({});
    expect(validateOoo({ ...base, startAt: at(12), endAt: at(16) }, { now, existing, original: existing[0] })).toEqual({});
  });
  it('allows today, not earlier days, and needs the end after the start', () => {
    expect(validateOoo({ startAt: at(10, 8), endAt: at(12) }, { now })).toEqual({});
    expect(validateOoo({ startAt: at(9, 8), endAt: at(12) }, { now }).startAt).toBeTruthy();
    expect(validateOoo({ startAt: at(12), endAt: at(11) }, { now }).endAt).toBeTruthy();
  });
  it('keeps an ongoing record\'s past start valid when editing', () => {
    const original = rec('b', at(8), at(12));
    expect(validateOoo({ startAt: original.startAt, endAt: at(14) }, { now, original })).toEqual({});
  });
  it('treats the auto reply message as optional', () => {
    expect(validateOoo({ startAt: at(11), endAt: at(12), autoReply: true, autoReplyMessage: ' ' }, { now }).autoReplyMessage).toBeUndefined();
  });
});

describe('sortRecords and formatDateTime', () => {
  it('orders ongoing, upcoming (soonest first), then past (latest first)', () => {
    const list = [rec('past1', at(1), at(2)), rec('up2', at(20), at(21)), rec('on', at(9), at(11)), rec('up1', at(12), at(13)), rec('past2', at(5), at(6))];
    expect(sortRecords(list, now).map(r => r.id)).toEqual(['on', 'up1', 'up2', 'past2', 'past1']);
  });
  it('formats like the Figma', () => {
    expect(formatDateTime(at(11, 2))).toBe('09/11/2026, 02:00AM');
    expect(formatDateTime(at(18, 23, 30))).toBe('09/18/2026, 11:30PM');
  });
});

describe('picker values', () => {
  it('leaves an unset date empty so the placeholder shows', () => {
    expect(toPickerValue(null)).toBe('');
    expect(toPickerValue(undefined)).toBe('');
  });
  it('round-trips through the DateTimePicker format', () => {
    expect(toPickerValue(at(11, 14, 5))).toBe('09/11/2026, 14:05');
    expect(fromPickerValue('09/11/2026, 14:05')).toBe(at(11, 14, 5));
    expect(fromPickerValue('')).toBeNull();
  });
});

describe('overlapPlan', () => {
  const iso = (d, h = 0) => new Date(2026, 9, d, h).toISOString();
  const name = 'Abhay Chaudhary';
  const existing = [
    { id: 'a', userName: name, startAt: iso(2), endAt: iso(15) },
    { id: 'b', userName: name, startAt: iso(15), endAt: iso(20) },
    { id: 'c', userName: name, startAt: iso(20, 9), endAt: iso(20, 13) },
  ];
  it('finds the covered part and the time left after it', () => {
    const p = overlapPlan({ userName: name, startAt: iso(8), endAt: iso(22) }, existing);
    expect(p.covered).toEqual({ from: new Date(iso(8)).getTime(), to: new Date(iso(20, 13)).getTime() });
    // 10/20 midnight to 9am is a gap between records; extending fills it too.
    expect(p.gaps.map(g => [new Date(g.from).getDate(), new Date(g.from).getHours()])).toEqual([[20, 0], [20, 13]]);
    expect(p.extend).toEqual([
      { record: existing[1], startAt: existing[1].startAt, endAt: iso(20, 9) },
      { record: existing[2], startAt: existing[2].startAt, endAt: iso(22) },
    ]);
  });
  it('extends the last record to the new end, or the first back to the new start', () => {
    const tail = overlapPlan({ userName: name, startAt: iso(3), endAt: iso(17) }, [existing[0]]);
    expect(tail.extend).toEqual([{ record: existing[0], startAt: existing[0].startAt, endAt: iso(17) }]);
    expect(tail.gaps).toEqual([{ from: new Date(iso(15)).getTime(), to: new Date(iso(17)).getTime() }]);
    const head = overlapPlan({ userName: name, startAt: iso(1), endAt: iso(10) }, [existing[0]]);
    expect(head.extend).toEqual([{ record: existing[0], startAt: iso(1), endAt: existing[0].endAt }]);
  });
  it('is null with no clash, and ignores the record being edited', () => {
    expect(overlapPlan({ userName: name, startAt: iso(23), endAt: iso(24) }, existing)).toBeNull();
    expect(overlapPlan({ userName: name, startAt: iso(3), endAt: iso(4) }, existing, 'a')).toBeNull();
  });
});

describe('people with the same name', () => {
  const iso = (d) => new Date(2026, 9, d).toISOString();
  const a = { id: 'u-1', name: 'John Smith' };
  const b = { id: 'u-2', name: 'John Smith' };
  const recA = { id: 'r1', userId: 'u-1', userName: 'John Smith', startAt: iso(10), endAt: iso(12) };
  it('tells them apart by id, and falls back to the name only without one', () => {
    expect(samePerson(a, b)).toBe(false);
    expect(samePerson(a, { id: 'u-1', name: 'J. Smith' })).toBe(true);
    expect(samePerson('John Smith', b)).toBe(true);
  });
  it("keeps one person's records and appointments off the other's", () => {
    expect(recordsFor([recA], b)).toEqual([]);
    expect(recordsFor([recA], a)).toEqual([recA]);
    const now = new Date(2026, 9, 1);
    const appts = [
      { id: 'x', primary_user: 'John Smith', primary_user_id: 'u-1', date: '10-10-2026', time_start: '9:00 am', time_end: '9:30 am' },
      { id: 'y', primary_user: 'John Smith', primary_user_id: 'u-2', date: '10-10-2026', time_start: '10:00 am', time_end: '10:30 am' },
    ];
    expect(appointmentsToReassign(recA, appts, now).map(x => x.id)).toEqual(['x']);
  });
  it("doesn't call one person's new dates a clash with the other's record", () => {
    const now = new Date(2026, 9, 1);
    expect(validateOoo({ userId: 'u-2', userName: 'John Smith', startAt: iso(10), endAt: iso(12) }, { now, existing: [recA] }).overlap).toBeUndefined();
    expect(validateOoo({ userId: 'u-1', userName: 'John Smith', startAt: iso(10), endAt: iso(12) }, { now, existing: [recA] }).overlap).toBeTruthy();
  });
  it('labels shared names with their email', () => {
    expect(peopleOptions([{ ...a, email: 'john1@x.com' }, { ...b, email: 'john2@x.com' }, { id: 'u-3', name: 'Ann Lee' }]).map(o => o.label))
      .toEqual(['John Smith (john1@x.com)', 'John Smith (john2@x.com)', 'Ann Lee']);
  });
});

describe('coveringPeople', () => {
  it('groups a provider covering several locations into one entry', () => {
    const people = coveringPeople([
      { userId: 'u1', userName: 'Abhijit Gupta', location: 'Downtown Clinic' },
      { userId: 'u2', userName: 'Navin Jethwani', location: 'Riverside Clinic' },
      { userId: 'u1', userName: 'Abhijit Gupta', location: 'SEB Office' },
    ]);
    expect(people).toEqual([
      { id: 'u1', name: 'Abhijit Gupta', locations: ['Downtown Clinic', 'SEB Office'] },
      { id: 'u2', name: 'Navin Jethwani', locations: ['Riverside Clinic'] },
    ]);
  });

  it('is empty for no coverage and skips entries without a name', () => {
    expect(coveringPeople(undefined)).toEqual([]);
    expect(coveringPeople([{ userId: 'u1', location: 'SEB Office' }])).toEqual([]);
  });
});

describe('phoneTreeOnCall', () => {
  const sch = (id, userName, fromDate, toDate, extra = {}) => ({ id, userName, phoneTreeType: 'Out of Office', fromDate, toDate, days: [], ...extra });
  const from = new Date(2026, 8, 14).getTime(), to = new Date(2026, 8, 16).getTime(); // Mon 14, Tue 15
  it('picks Out of Office schedules on the dates, per location or for every location', () => {
    const rows = phoneTreeOnCall([
      sch('a', 'Ann', '2026-09-10', '2026-09-14', { location: 'North' }),
      sch('b', 'Bob', '2026-09-15', '2026-09-20'),
      sch('c', 'Cy', '2026-09-16', '2026-09-20', { location: 'North' }),
      sch('d', 'Dee', '2026-09-14', '2026-09-20', { phoneTreeType: 'Holiday Hours' }),
    ], ['North', 'South'], { from, to });
    expect(rows).toEqual([{ location: 'North', people: ['Ann', 'Bob'] }, { location: 'South', people: ['Bob'] }]);
  });
  it('honours weekdays and leaves out the away user', () => {
    const rows = phoneTreeOnCall([
      sch('a', 'Ann', '2026-09-01', '2026-09-30', { days: [0, 6] }),
      sch('b', 'Bob', '2026-09-01', '2026-09-30'),
    ], [], { from, to, away: { name: 'Bob' } });
    expect(rows).toEqual([{ location: null, people: [] }]);
  });
});
