/* Template Type choices for the care plan library editors. */

export const TEMPLATE_TYPE_CHOICES = [
  {
    value: 'general',
    label: 'General',
    hint: 'Ongoing care that isn’t tied to one condition.',
  },
  {
    value: 'chronic',
    label: 'For Chronic Conditions',
    hint: 'Ongoing care for a long-term condition. Recommended for patients who have it.',
  },
  {
    value: 'episodic',
    label: 'Episodic (event-based)',
    hint: 'Care for one event, such as a hospital discharge or a home health stay. Ends on its own after a set number of days.',
  },
];

/** The type a saved template was authored as. */
export function templateTypeOf(template) {
  if (template?.episodic) return 'episodic';
  return (template?.conditions || []).length ? 'chronic' : 'general';
}
