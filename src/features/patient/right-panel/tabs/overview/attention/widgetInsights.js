// Which Overview widget each attention signal belongs to, and the one line
// that widget's Unity strip leads with. Signals come from attentionSignals.js.

const WIDGET_OF_KIND = {
  appointment: 'appointments',
  vital: 'vitals',
  lab: 'vitals',
  reply: 'awaitingReply',
  tasks: 'tasks',
  gap: 'gaps',
  medication: 'medications',
  risk: 'riskAcuity',
  adt: 'highlights',
};

/** Recap step order and names, one per widget. */
export const INSIGHT_WIDGETS = [
  { key: 'highlights', title: 'Hospital Events', icon: 'solar:hospital-linear' },
  { key: 'appointments', title: 'Appointments', icon: 'solar:calendar-mark-linear' },
  { key: 'vitals', title: 'Vitals & Labs', icon: 'solar:heart-pulse-linear' },
  { key: 'awaitingReply', title: 'Messages', icon: 'solar:chat-unread-linear' },
  { key: 'medications', title: 'Medications', icon: 'solar:pill-linear' },
  { key: 'tasks', title: 'Tasks', icon: 'solar:checklist-minimalistic-linear' },
  { key: 'gaps', title: 'Care Gaps', icon: 'solar:danger-triangle-linear' },
  { key: 'riskAcuity', title: 'Risk & Acuity', icon: 'solar:graph-up-linear' },
];

export const ACTION_ICON = {
  schedule: 'solar:calendar-add-linear',
  addTask: 'solar:clipboard-add-linear',
  reviewMeds: 'solar:pill-linear',
  openTasks: 'solar:checklist-minimalistic-linear',
  reply: 'solar:chat-round-line-linear',
};

export const widgetOf = signal => WIDGET_OF_KIND[signal.kind] || null;

/** { [widgetKey]: signals[] }, keeping the ranked order inside each widget. */
export function signalsByWidget(signals) {
  const out = {};
  (signals || []).forEach((s) => {
    const key = widgetOf(s);
    if (!key) return;
    (out[key] ||= []).push(s);
  });
  return out;
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const list = names => (names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

/** The widget's headline: what changed or is open, in one sentence. */
export function widgetInsightSummary(widgetKey, signals) {
  if (!signals?.length) return '';
  const first = signals[0];
  switch (widgetKey) {
    case 'appointments':
      return signals.length === 1
        ? `${first.title} on ${first.detail.split(' • ')[0]} is not rebooked.`
        : `${plural(signals.length, 'missed visit')} are not rebooked.`;
    case 'vitals': {
      const labs = signals.filter(s => s.kind === 'lab');
      const vitals = signals.filter(s => s.kind === 'vital');
      const parts = [];
      if (labs.length) parts.push(`${plural(labs.length, 'abnormal lab')} since the last visit`);
      if (vitals.length) {
        const names = vitals.map(v => v.label || v.title);
        parts.push(`${list(names)} ${vitals.length === 1 ? 'is' : 'are'} above goal`);
      }
      return `${parts.join('; ')}.`;
    }
    case 'awaitingReply':
      return `${first.title}. ${first.detail.split(' • ')[0]}.`;
    case 'tasks':
      return `${first.title.replace(/^(\d+) overdue (task|tasks)$/, (_, n, t) => `${n} ${t} ${n === '1' ? 'is' : 'are'} past due`)}.`;
    case 'gaps':
      return `${plural(signals.length, 'care gap')} ${signals.length === 1 ? 'is' : 'are'} past the due date.`;
    case 'medications':
      return signals.length === 1 ? `${first.title} since the last visit.` : `${plural(signals.length, 'medication change')} since the last visit.`;
    case 'riskAcuity':
      return `${first.title.replace(/^RAF up/, 'RAF rose')} since the last score.`;
    case 'highlights':
      return signals.length === 1 ? `${first.title} since the last visit.` : `${plural(signals.length, 'hospital event')} since the last visit.`;
    default:
      return first.title;
  }
}
