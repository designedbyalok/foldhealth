// Instances of one care gap: every gap on the member with the same code.
// Add Care Gaps inserts a new instance before the old one, so the array runs
// newest first and instances are numbered oldest first (1, 2, ...). A number
// never changes once given, so activity can be tagged with it.

export function gapInstances(gaps, code) {
  return (gaps || []).filter(g => g.code === code);
}

export function latestInstanceNo(gaps, code) {
  return gapInstances(gaps, code).length || 1;
}

// The gap's instance number, or null when the gap has only one instance.
export function gapInstanceNo(gaps, gap) {
  const all = gapInstances(gaps, gap.code);
  return all.length < 2 ? null : all.length - all.indexOf(gap);
}

// Activity is logged against one gap instance. An entry with a gap code but
// no instance belongs to that gap's latest instance at the time it's logged.
export function tagGapInstance(gaps, entry) {
  if (!entry?.gapCode || entry.instanceNo != null) return entry;
  return { ...entry, instanceNo: latestInstanceNo(gaps, entry.gapCode) };
}

// Entries for the instance on screen. Untagged entries come from before
// activity was tagged by gap; they stay visible on every gap.
export function activityForInstance(entries, code, instanceNo, latestNo) {
  return (entries || []).filter(e => !e.gapCode
    || (e.gapCode === code && (e.instanceNo ?? latestNo) === instanceNo));
}

const isClosedStatus = (status) => status === 'Completed' || String(status || '').startsWith('Closed');
const todayMdY = () => new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

// A gap moved to Completed or a Closed status gets today as its closed date
// (instances list it); reopening clears it.
export function withStatus(gap, status) {
  if (isClosedStatus(status)) return { ...gap, status, closedDate: isClosedStatus(gap.status) && gap.closedDate ? gap.closedDate : todayMdY() };
  const { closedDate: _closed, ...rest } = gap;
  return { ...rest, status };
}
