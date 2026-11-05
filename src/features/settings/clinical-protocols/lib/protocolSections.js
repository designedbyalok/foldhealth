import {
  CADENCE_KINDS,
  CADENCE_UNITS,
  COMPARATORS,
  REFERENCE_KINDS,
  TITRATION_ACTIONS,
  formatCadence,
  formatThreshold,
} from './protocolSchema';

/* The review drawer's sections: what each holds in plain words (about),
   how each kind of protocol item reads in a row (title + detail) and which
   fields its editor shows. One config, so every section edits and displays
   the same way. */

const opts = values => values.map(v => (typeof v === 'string' ? { value: v, label: v } : v));
const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);

export const PROTOCOL_SECTIONS = [
  {
    key: 'thresholds',
    label: 'Thresholds',
    about: 'The numbers that sort patients, like a blood pressure cut-off, and what each band means or sets off.',
    icon: 'solar:danger-triangle-linear',
    title: t => formatThreshold(t),
    detail: t => [t.label, t.action].filter(Boolean).join(' · '),
    fields: [
      { key: 'measure', label: 'Measure', type: 'text', required: true },
      { key: 'comparator', label: 'Comparator', type: 'select', options: opts(COMPARATORS) },
      { key: 'value', label: 'Value', type: 'number', required: true },
      { key: 'value2', label: 'Upper value (between)', type: 'number', showWhen: t => t.comparator === 'between' },
      { key: 'unit', label: 'Unit', type: 'text' },
      { key: 'label', label: 'Category', type: 'text' },
      { key: 'action', label: 'Action', type: 'textarea' },
    ],
    blank: () => ({ measure: '', comparator: '>=', value: null, value2: null, unit: '', label: '', action: '' }),
  },
  {
    key: 'decisionRules',
    label: 'Decision Rules',
    about: 'If-then steps the care team follows: when something happens, what to do next.',
    icon: 'solar:routing-2-linear',
    title: r => `When ${r.when}`,
    detail: r => `Then ${r.then}`,
    fields: [
      { key: 'when', label: 'When', type: 'textarea', required: true },
      { key: 'then', label: 'Then', type: 'textarea', required: true },
    ],
    blank: () => ({ when: '', then: '' }),
  },
  {
    key: 'cadence',
    label: 'Cadence',
    about: 'How often things happen: check-ins, home readings, labs, visits and medication reviews.',
    icon: 'solar:calendar-linear',
    title: c => `${formatCadence(c)} · ${c.activity}`,
    detail: c => [CADENCE_KINDS.find(k => k.value === c.kind)?.label, c.appliesWhen].filter(Boolean).join(' · '),
    fields: [
      { key: 'activity', label: 'Activity', type: 'text', required: true },
      { key: 'kind', label: 'Kind', type: 'select', options: CADENCE_KINDS },
      { key: 'times', label: 'Times', type: 'number' },
      { key: 'every', label: 'Every', type: 'number', required: true },
      { key: 'unit', label: 'Unit', type: 'select', options: opts(CADENCE_UNITS) },
      { key: 'appliesWhen', label: 'Applies when', type: 'textarea' },
    ],
    blank: () => ({ activity: '', kind: 'check_in', times: 1, every: 1, unit: 'week', appliesWhen: '' }),
  },
  {
    key: 'titration',
    label: 'Medication Titration',
    about: 'The order to start, raise, add or switch medicines, with doses as the document writes them.',
    icon: 'solar:pill-linear',
    title: m => `Step ${m.step} · ${cap(m.action)} ${m.medication}${m.dose ? ` ${m.dose}` : ''}`,
    detail: m => [m.drugClass, m.criteria, m.monitoring && `Monitor: ${m.monitoring}`].filter(Boolean).join(' · '),
    fields: [
      { key: 'step', label: 'Step', type: 'number', required: true },
      { key: 'action', label: 'Action', type: 'select', options: TITRATION_ACTIONS.map(a => ({ value: a, label: cap(a) })) },
      { key: 'medication', label: 'Medication', type: 'text', required: true },
      { key: 'drugClass', label: 'Drug class', type: 'text' },
      { key: 'dose', label: 'Dose', type: 'text' },
      { key: 'criteria', label: 'Criteria', type: 'textarea' },
      { key: 'monitoring', label: 'Monitoring', type: 'textarea' },
    ],
    blank: () => ({ step: 1, action: 'start', medication: '', drugClass: '', dose: '', criteria: '', monitoring: '' }),
  },
  {
    key: 'crossReferences',
    label: 'Cross-references',
    about: 'Other guidelines, policies or order sets the document points to.',
    icon: 'solar:link-linear',
    title: x => x.title,
    detail: x => [REFERENCE_KINDS.find(k => k.value === x.kind)?.label, x.citation].filter(Boolean).join(' · '),
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'kind', label: 'Kind', type: 'select', options: REFERENCE_KINDS },
      { key: 'citation', label: 'Citation', type: 'text' },
    ],
    blank: () => ({ title: '', kind: 'guideline', citation: '' }),
  },
];

/** Whether an edited item has its required fields. */
export function itemComplete(section, item) {
  return section.fields
    .filter(f => f.required && (!f.showWhen || f.showWhen(item)))
    .every(f => (f.type === 'number' ? Number.isFinite(item[f.key]) : String(item[f.key] ?? '').trim()));
}
