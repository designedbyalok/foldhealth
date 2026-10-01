/**
 * Sample holiday configurations, dated around `now` so past, ongoing and
 * upcoming all show, at the reassignment demo's departments. Used by
 * `bun run seed` and, until the table exists, by the store.
 */
const PLAN = [
  // [id, name, day offset, start hour, length (hours), locations, auto reply]
  ['hol-sample-1', 'Labour Day', -26, 0, 24, ['7 Hills Department', 'Home Health Centre', 'Mary Health'], ''],
  ['hol-sample-2', 'Staff Wellness Afternoon', 0, 13, 5, ['Mary Health'], 'Our team is away this afternoon. We will reply first thing tomorrow.'],
  ['hol-sample-3', 'Diwali', 7, 0, 48, ['7 Hills Department', 'Palm Health Centre', 'Sunrise Medical', 'Lifeline Clinic'], 'Happy Diwali! We are closed and will connect with you after the holiday.'],
  ['hol-sample-4', 'Veterans Day', 41, 0, 24, ['Home Health Centre', 'Rockwell Health', 'Green Valley Clinic'], ''],
  ['hol-sample-5', 'Thanksgiving', 57, 0, 48, ['7 Hills Department', 'Home Health Centre', 'Palm Health Centre', 'Mary Health', 'Sunrise Medical'], 'Happy Thanksgiving! We will be back on Monday.'],
  ['hol-sample-6', 'Christmas', 85, 0, 48, ['7 Hills Department', 'Home Health Centre', 'Palm Health Centre', 'Mary Health', 'Sunrise Medical', 'Lifeline Clinic', 'Rockwell Health', 'Green Valley Clinic'], 'Merry Christmas! We will make sure to connect with you after Christmas.'],
];

export function sampleHolidays(now = new Date()) {
  const at = (days, hour) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, hour, 0);
  return PLAN.map(([id, name, day, hour, hours, locations, autoReplyMessage]) => {
    const start = at(day, hour);
    return {
      id,
      name,
      startAt: start.toISOString(),
      endAt: new Date(start.getTime() + hours * 3600000).toISOString(),
      locations,
      autoReplyMessage,
      createdBy: null,
      createdAt: at(day - 30, 10).toISOString(),
      updatedAt: at(day - 30, 10).toISOString(),
    };
  });
}

/** Holiday ↔ holiday_configurations row. */
export const holidayToRow = (h) => ({
  id: h.id,
  name: h.name,
  start_at: h.startAt,
  end_at: h.endAt,
  locations: h.locations || [],
  auto_reply_message: h.autoReplyMessage || '',
  created_by: h.createdBy || null,
  created_at: h.createdAt || new Date().toISOString(),
  updated_at: h.updatedAt || new Date().toISOString(),
});

export const rowToHoliday = (r) => ({
  id: r.id,
  name: r.name,
  startAt: r.start_at,
  endAt: r.end_at,
  locations: r.locations || [],
  autoReplyMessage: r.auto_reply_message || '',
  createdBy: r.created_by,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
