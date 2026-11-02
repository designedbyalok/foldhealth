/**
 * Tags a practice puts on its members (Settings > Member/Leads > Tags, Figma
 * Settings 516:2137). The table contact_tags holds the practice's list; this
 * is the fallback until it exists, and what the seed writes. A tag's colour
 * is data (the admin picks it), so it's a hex, applied inline.
 */
export const DEFAULT_TAGS = [
  { id: 'tag-high-risk', name: 'High-Risk', description: 'Members at high risk of hospitalisation or a poor outcome, who need closer follow-up.', color: '#E81E63' },
  { id: 'tag-l1', name: 'L1', description: 'Level 1 outreach: the first tier of the practice’s outreach plan.', color: '#5800FF' },
  { id: 'tag-dm-program', name: 'DM Program', description: 'Enrolled in the Disease Management program.', color: '#009688' },
  { id: 'tag-cardiology', name: 'Cardiology', description: 'This tag is associated with cardiology-related information, such as heart health, cardiac diseases, and treatments.', color: '#E81E63' },
  { id: 'tag-pediatrics', name: 'Pediatrics', description: 'Use this tag for pediatric healthcare, children’s health, and related topics, including pediatricians and child development.', color: '#5800FF' },
  { id: 'tag-mental-health', name: 'Mental Health', description: 'This tag is for content related to mental health, including mental disorders, therapies, and emotional well-being.', color: '#009688' },
  { id: 'tag-nutrition', name: 'Nutrition', description: 'Nutrition-related tag for information on healthy eating, diets, and nutritional guidance.', color: '#EEB200' },
  { id: 'tag-fitness', name: 'Fitness', description: 'Use this tag for fitness-related content, including exercise routines, workout tips, and physical wellness.', color: '#9C27B0' },
  { id: 'tag-womens-health', name: 'Women’s Health', description: 'Tag for topics related to women’s health, including pregnancy, gynecology, and reproductive health.', color: '#E81E63' },
  { id: 'tag-mens-health', name: 'Men’s Health', description: 'Men’s health-related tag, covering topics like prostate health, testosterone, and sexual wellness.', color: '#109CAE' },
  { id: 'tag-dental-care', name: 'Dental Care', description: 'This tag is for dental health information, including oral hygiene, dental treatments, and dental care tips.', color: '#009688' },
  { id: 'tag-aging-well', name: 'Aging Well', description: 'Tag for aging and senior health, covering topics like geriatrics, elder care, and healthy aging.', color: '#607D8B' },
  { id: 'tag-follow-up', name: 'Follow-Up', description: 'Members with a follow-up due after a visit, discharge, or outreach.', color: '#2196F3' },
  { id: 'tag-telehealth', name: 'Telehealth', description: 'Members who prefer or are set up for telehealth visits.', color: '#109CAE' },
  { id: 'tag-home-care', name: 'Home Care', description: 'Members receiving care at home.', color: '#795548' },
  { id: 'tag-preventive', name: 'Preventive', description: 'Members with preventive screenings or immunizations due.', color: '#8BC34A' },
];

export const DEFAULT_TAG_COLOR = '#009688';

// The colour picker's Suggested Colors: the design system's accent colours,
// in Figma's order (Mar-Present 2026 215:25).
export const TAG_COLOR_SUGGESTIONS = [
  { value: '#607D8B', label: 'Blue Grey' },
  { value: '#795548', label: 'Brown' },
  { value: '#EEB200', label: 'Amber' },
  { value: '#8BC34A', label: 'Light Green' },
  { value: '#009688', label: 'Teal' },
  { value: '#2196F3', label: 'Blue' },
  { value: '#5800FF', label: 'Persian Blue' },
  { value: '#9C27B0', label: 'Purple' },
  { value: '#E81E63', label: 'Pink' },
  { value: '#109CAE', label: 'Cyan' },
];

export const tagToRow = (t, i = 0) => ({ id: t.id, name: t.name, description: t.description || '', color: t.color, sort_order: t.sortOrder ?? i + 1, active: true });
export const rowToTag = (r) => ({ id: r.id, name: r.name, description: r.description || '', color: r.color, sortOrder: r.sort_order });

/** The tag pill's colours: the tag colour as text on a 10% tint of it. */
export const tagBadgeStyle = (color) => ({
  color,
  background: `color-mix(in srgb, ${color} 10%, var(--neutral-0))`,
  borderColor: `color-mix(in srgb, ${color} 20%, transparent)`,
});
