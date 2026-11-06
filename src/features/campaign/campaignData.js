/* Campaign list data shared by the desktop CampaignView and the mobile
   Campaigns screen: the local fallback rows, filters and health rule. */

// ── Static data ───────────────────────────────────────────────────────────────

export const CAMPAIGNS = [
  {
    id: 1, section: 'running',
    channel: 'email', name: 'Resilient Recoveries',
    description: 'A support campaign focused on helping patients recover from injuries or surgeries with personalized care plans.',
    audience: 644, dynamic: true,
    health: 'Good', delivered: 32, opened: 18,
    startDate: '09/07/2024', duration: 15, progress: 40, enabled: true,
  },
  {
    id: 2, section: 'running',
    channel: 'email', name: 'Healthy Moms, Happy Babies',
    description: 'A maternal health initiative providing resources and support for expecting and new mothers.',
    audience: 80, dynamic: false,
    health: 'Moderate', delivered: 56, opened: 49,
    startDate: '09/23/2024', duration: 9, progress: 60, enabled: true,
  },
  {
    id: 3, section: 'paused',
    channel: 'email', name: 'Fit for Life',
    description: 'A wellness program promoting fitness, balanced nutrition, and sustainable healthy lifestyle habits.',
    audience: 916, dynamic: false,
    health: 'Good', delivered: 57, opened: 43,
    startDate: '08/29/2024', duration: 1, progress: 60, enabled: false,
  },
  {
    id: 4, section: 'paused',
    channel: 'email', name: 'Skin Care Savvy',
    description: 'Educational campaign raising awareness about skincare routines and dermatological health.',
    audience: 43, dynamic: false,
    health: 'Good', delivered: 64, opened: 59,
    startDate: '09/19/2024', duration: 1, progress: 70, enabled: false,
  },
  {
    id: 5, section: 'scheduled',
    channel: 'email', name: 'Mind Over Matter',
    description: 'A mental wellness campaign offering mindfulness, stress management, and emotional resilience tools.',
    audience: 191, dynamic: false,
    health: null, delivered: null, opened: null,
    startDate: '09/01/2024', duration: 7, progress: 0, executesIn: 5, enabled: false,
  },
  {
    id: 6, section: 'scheduled',
    channel: 'email', name: 'Resilient Recoveries',
    description: 'A pediatric health campaign encouraging healthy eating, physical activity, and overall child wellness.',
    audience: 830, dynamic: true,
    health: null, delivered: null, opened: null,
    startDate: '09/05/2024', duration: 11, progress: 0, executesIn: 5, enabled: false,
  },
  {
    id: 7, section: 'scheduled',
    channel: 'sms', name: 'Healthy Habits for Kids',
    description: 'A support network campaign providing guidance and emotional support to cancer patients and families.',
    audience: 433, dynamic: false,
    health: null, delivered: null, opened: null,
    startDate: '09/11/2024', duration: 12, progress: 0, executesIn: 5, enabled: false,
  },
  {
    id: 8, section: 'scheduled',
    channel: 'email', name: 'Cancer Companions',
    description: 'A long-term initiative focused on managing chronic illnesses with proactive care and patient education.',
    audience: 529, dynamic: false,
    health: null, delivered: null, opened: null,
    startDate: '09/16/2024', duration: 20, progress: 0, executesIn: 5, enabled: false,
  },
  {
    id: 9, section: 'scheduled',
    channel: 'email', name: 'Chronic Care Campaign',
    description: 'A location-specific campaign targeting patient engagement for the Rosewood clinic region.',
    audience: 396, dynamic: false,
    health: null, delivered: null, opened: null,
    startDate: '09/26/2024', duration: 21, progress: 0, executesIn: 5, enabled: false,
  },
  {
    id: 10, section: 'scheduled',
    channel: 'voice', name: 'Rome Office Patients',
    description: 'An annual seminar covering the latest advancements in health and wellness practices.',
    audience: 7, dynamic: false,
    health: null, delivered: null, opened: null,
    startDate: '09/27/2024', duration: 7, progress: 0, executesIn: 5, enabled: false,
  },
  {
    id: 11, section: 'scheduled',
    channel: 'email', name: 'Health & Wellness Seminar 2025',
    description: 'Helping patients recover from injuries or surgeries with personalized care plans.',
    audience: 795, dynamic: false,
    health: null, delivered: null, opened: null,
    startDate: '08/28/2024', duration: 19, progress: 0, executesIn: 5, enabled: false,
  },
];

export const DRAFTS = [
  {
    id: 20, section: 'draft',
    channel: 'email', name: 'Q3 Diabetic Outreach',
    description: 'Reaching out to patients with HbA1c > 9 over the past 90 days with targeted education resources.',
    audience: 312, dynamic: false,
    health: null, delivered: null, opened: null,
    startDate: null, duration: null, progress: 0, enabled: false,
  },
  {
    id: 21, section: 'draft',
    channel: 'sms', name: 'Fall Prevention Program',
    description: 'A preventive campaign for elderly patients focused on balance training and home safety.',
    audience: 158, dynamic: false,
    health: null, delivered: null, opened: null,
    startDate: null, duration: null, progress: 0, enabled: false,
  },
];

export const ENDED = [
  {
    id: 30, section: 'ended',
    channel: 'email', name: 'Annual Flu Vaccine Drive',
    description: 'Annual influenza vaccination outreach targeting all eligible patients in the practice.',
    audience: 1402, dynamic: false,
    health: 'Good', delivered: 78, opened: 61,
    startDate: '10/01/2023', duration: 30, progress: 100, enabled: false,
  },
  {
    id: 31, section: 'ended',
    channel: 'email', name: 'COVID-19 Booster Reminder',
    description: 'Reminder campaign for eligible patients to schedule their COVID-19 booster shots.',
    audience: 892, dynamic: false,
    health: 'Moderate', delivered: 54, opened: 38,
    startDate: '11/15/2023', duration: 14, progress: 100, enabled: false,
  },
];

export const SECTIONS_META = {
  running:   { label: 'Currently Running', dotColor: 'var(--status-success)' },
  paused:    { label: 'Paused',            icon: 'solar:pause-circle-linear',  color: 'var(--neutral-300)' },
  scheduled: { label: 'Scheduled',         icon: 'solar:clock-circle-linear',  color: 'var(--neutral-200)' },
  draft:     { label: 'Drafts',            icon: 'solar:document-text-linear', color: 'var(--neutral-300)' },
  ended:     { label: 'Ended',             icon: 'solar:check-circle-linear',  color: 'var(--neutral-300)' },
};

export const CHANNEL_ICONS = {
  email: 'solar:letter-linear',
  sms:   'solar:chat-round-line-linear',
  voice: 'solar:phone-linear',
};

export const HEALTH_VARIANT = {
  Good:     'success',
  Moderate: 'warning',
  Poor:     'warning',
};

// `primary: true` → chip renders by default in the shared FilterBar.
export const FILTER_DEFS = [
  { key: 'section', label: 'Status', primary: true, options: [
    { value: 'running',   label: 'Currently Running' },
    { value: 'paused',    label: 'Paused' },
    { value: 'scheduled', label: 'Scheduled' },
  ]},
  { key: 'channel', primary: true, label: 'Channel', options: [
    { value: 'email', label: 'Email' },
    { value: 'sms',   label: 'SMS' },
    { value: 'voice', label: 'Voice' },
  ]},
  { key: 'health', primary: true, label: 'Health', options: [
    { value: 'Good',     label: 'Good' },
    { value: 'Moderate', label: 'Moderate' },
    { value: 'Poor',     label: 'Poor' },
  ]},
  { key: 'audienceType', primary: true, label: 'Audience Type', options: [
    { value: 'dynamic', label: 'Dynamic' },
    { value: 'static',  label: 'Static' },
  ]},
  { key: 'audienceSize', primary: true, label: 'Audience Size', options: [
    { value: 'small',  label: 'Under 100' },
    { value: 'medium', label: '100 – 500' },
    { value: 'large',  label: '500+' },
  ]},
  { key: 'duration', primary: true, label: 'Duration', options: [
    { value: 'short',  label: '< 7 Days' },
    { value: 'medium', label: '7 – 14 Days' },
    { value: 'long',   label: '> 14 Days' },
  ]},
];

/** Good / Moderate / Poor from the delivered-vs-opened gap (null before sending). */
export function computeHealth(delivered, opened) {
  if (delivered == null || opened == null) return null;
  const gap = delivered - opened;
  if (gap <= 10) return 'Good';
  if (gap <= 20) return 'Moderate';
  return 'Poor';
}

/** The Campaigns filter bar's rules (`filters` is { key: value }). */
export function filterCampaigns(baseRows, filters) {
  let rows = baseRows;
  if (filters.section) rows = rows.filter(c => c.section === filters.section);
  if (filters.channel) rows = rows.filter(c => c.channel === filters.channel);
  if (filters.health)  rows = rows.filter(c => computeHealth(c.delivered, c.opened) === filters.health);
  if (filters.audienceType) {
    rows = rows.filter(c => filters.audienceType === 'dynamic' ? c.dynamic : !c.dynamic);
  }
  if (filters.audienceSize) {
    rows = rows.filter(c => {
      if (filters.audienceSize === 'small')  return c.audience < 100;
      if (filters.audienceSize === 'medium') return c.audience >= 100 && c.audience <= 500;
      return c.audience > 500;
    });
  }
  if (filters.duration) {
    rows = rows.filter(c => {
      if (c.duration == null) return false;
      if (filters.duration === 'short')  return c.duration < 7;
      if (filters.duration === 'medium') return c.duration >= 7 && c.duration <= 14;
      return c.duration > 14;
    });
  }
  return rows;
}
