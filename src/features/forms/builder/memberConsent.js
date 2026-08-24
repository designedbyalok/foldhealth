// `mandatory` is retained on each item for backwards compatibility with forms
// already saved with it, but it is no longer author-editable — the per-item
// Required switch was removed, so every default ships non-mandatory. A consent
// question the member is forced to tick isn't consent; the top-level "Is this
// field required?" still governs whether the component itself must be present.
const DEFAULT_ITEMS = [
  {
    id: 'ccm',
    name: 'CCM',
    category: 'program',
    included: true,
    mandatory: false,
    agreement: 'Chronic Care Mamagement (CCM) is offered to all eligible patients who have been diagnosed with two (2) or more chronic conditions that are expected to last at least twelve (12) months and that place patient at significant risk of further decline.',
  },
  {
    id: 'apcm',
    name: 'APCM',
    category: 'program',
    included: true,
    mandatory: false,
    agreement: 'Advanced Primary Care Management (APCM) is offered to all patients. By voluntarily selecting the service you fully understand only one healthcare provider can furnish and be compensated during the calendar month. You also understand cost sharing may apply, and you have the right to stop APCM services at any time.',
  },
  {
    id: 'bhi',
    name: 'BHI',
    category: 'program',
    included: true,
    mandatory: false,
    agreement: 'Behavioral Health Intergration (BHI) is offered to all eligible patients who have services provided for behavioral health disorders, who are participating in psychiatric collaborative care programs, or are receiving behavioral health integration services.',
  },
  {
    id: 'primary-care',
    name: 'Primary Care',
    category: 'service',
    included: true,
    mandatory: false,
    agreement: 'Primary Care provides ongoing, whole-person medical care — routine checkups, preventive screenings, and coordination of the member’s overall treatment.',
  },
  {
    id: 'podiatry',
    name: 'Podiatry',
    category: 'service',
    included: true,
    mandatory: false,
    agreement: 'Podiatry services provide routine and medically necessary foot care from a qualified provider.',
  },
  {
    id: 'mental-health',
    name: 'Mental Health / Psychiatry',
    category: 'service',
    included: true,
    mandatory: false,
    agreement: 'Mental Health and Psychiatry services support emotional, behavioral, or cognitive needs, including medication management.',
  },
  {
    id: 'wound-care',
    name: 'Wound Care',
    category: 'service',
    included: true,
    mandatory: false,
    agreement: 'Wound Care services provide ongoing assessment and treatment for wounds requiring specialized clinical attention.',
  },
  {
    id: 'palliative-care',
    name: 'Palliative Care',
    category: 'service',
    included: true,
    mandatory: false,
    agreement: 'Palliative Care provides specialized support focused on relief from the symptoms and stress of a serious illness, alongside the member’s other treatment.',
  },
  {
    id: 'telehealth',
    name: 'Telehealth',
    category: 'others',
    included: true,
    mandatory: false,
    agreement: 'Telehealth allows the member to receive care remotely by video or phone. The member understands the benefits and limitations of virtual visits and may request an in-person visit at any time.',
  },
];

export const CONSENT_CATEGORY_OPTIONS = [
  { value: 'program', label: 'Care Program' },
  { value: 'service', label: 'Service Line' },
  { value: 'others', label: 'Others' },
];

export function consentQuestion(item) {
  return {
    type: 'choice',
    control: 'consent',
    text: item.name,
    description: item.agreement,
    required: !!item.mandatory,
    consentKey: item.id,
    consentCategory: item.category,
    // A single "I give my consent" checkbox. The matching decline option was
    // removed — an unchecked box already records the absence of consent, so a
    // second box only invited contradictory answers (both ticked).
    options: [
      { value: 'consented', label: `I give my consent for ${item.name}` },
    ],
  };
}

export function makeMemberConsent() {
  const consentItems = [];
  const items = [];
  for (const defaultItem of DEFAULT_ITEMS) {
    const item = { ...defaultItem };
    consentItems.push(item);
    if (item.included) items.push(consentQuestion(item));
  }
  return {
    type: 'group',
    text: 'Member Consent',
    description: 'Check only the services you would like to receive when available and deemed medically necessary.',
    healthKey: 'memberConsent',
    required: true,
    reusable: false,
    shareWithPatient: true,
    consentItems,
    items,
  };
}

export function syncConsentQuestions(existingQuestions, consentItems, assignIds) {
  const existing = new Map(
    (existingQuestions || []).map((question) => [question.consentKey, question]),
  );

  const questions = [];
  for (const item of consentItems || []) {
    if (!item.included) continue;
    const current = existing.get(item.id);
    const next = { ...consentQuestion(item), linkId: current?.linkId };
    questions.push(next.linkId ? next : assignIds(next));
  }
  return questions;
}

export function createCustomConsentItem(name, category, id = `custom-${Date.now()}`) {
  const trimmed = name.trim();
  return {
    id,
    name: trimmed,
    category,
    included: true,
    mandatory: false,
    agreement: `${trimmed} consent authorizes the care team to provide this service. The member may withdraw consent at any time.`,
    custom: true,
  };
}

/**
 * Move an item to another item's slot. Returns the list untouched when the two
 * items sit in different categories, so a care program can never be dragged
 * into the service lines (and vice versa).
 */
export function reorderConsentItems(items, fromId, toId) {
  const list = items || [];
  const from = list.findIndex((item) => item.id === fromId);
  const to = list.findIndex((item) => item.id === toId);
  if (from === -1 || to === -1 || from === to) return list;
  if (list[from].category !== list[to].category) return list;
  const next = [...list];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

/**
 * Place a new item at the end of its own category rather than the end of the
 * list, so a new care program lands under the other care programs instead of
 * below the service lines. Question order follows this array, so the form the
 * member fills matches the grouping the author sees.
 */
export function insertConsentItem(items, item) {
  const list = items || [];
  let after = -1;
  list.forEach((existing, index) => {
    if (existing.category === item.category) after = index;
  });
  if (after === -1) return [...list, item];
  const next = [...list];
  next.splice(after + 1, 0, item);
  return next;
}
