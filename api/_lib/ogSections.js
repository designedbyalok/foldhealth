/**
 * OpenGraph section registry: single source of truth for per-section link
 * previews. Both the image function (`api/og.jsx`) and the share responder
 * (`api/share.js`) read from here.
 *
 * `hash` is the in-app SPA route (hash-router path) a human is bounced to when
 * they open a /s/<slug> link: it must match a route `hashToState` understands
 * in `src/lib/router.js`.
 */

const DEFAULT_DESCRIPTION =
  'AI-native care coordination platform: worklists, HCC coding, outreach, and analytics.';

export const DEFAULT_SECTION = {
  eyebrow: 'Fold Health',
  title: 'Fold Health',
  description: DEFAULT_DESCRIPTION,
  hash: '/home',
};

const SECTIONS = {
  home: { eyebrow: 'Fold Health', title: 'Home', description: 'Your daily overview: alerts, tasks, calendar, and notes at a glance.', hash: '/home' },

  // Population worklists
  population: { eyebrow: 'Population', title: 'TCM Worklist', description: 'Prioritized worklist of patients in transitional care management.', hash: '/population/tcm' },
  toc: { eyebrow: 'Population', title: 'TOC IP', description: 'Agent-led outreach queue for transition-of-care inpatients.', hash: '/population/toc' },
  tcm: { eyebrow: 'Population', title: 'TCM Worklist', description: 'Prioritized worklist of patients in transitional care management.', hash: '/population/tcm' },
  'tcm-queue': { eyebrow: 'Population', title: 'TCM Queue', description: 'Queue of patients awaiting agent-led outreach.', hash: '/population/tcm-queue' },
  'toc-queue': { eyebrow: 'Population', title: 'TCM Queue', description: 'Queue of patients awaiting agent-led outreach.', hash: '/population/tcm-queue' },
  hcc: { eyebrow: 'Population · Risk Adjustment', title: 'HCC Coding', description: 'Risk-adjustment coding worklist with the per-DOS review pipeline: Support → Coder → QA → Compliance → ASM.', hash: '/population/hcc' },
  hedis: { eyebrow: 'Population · Quality', title: 'HEDIS', description: 'Quality-measure gap worklist and clinical note review.', hash: '/hedis' },
  awv: { eyebrow: 'Population', title: 'AWV Worklist', description: 'Annual Wellness Visit worklist and scheduling.', hash: '/population/awv' },
  'all-patients': { eyebrow: 'Population', title: 'All Patients', description: 'Unified roster across TOC and HCC populations.', hash: '/population/all-patients' },

  // Top-level workspaces
  calendar: { eyebrow: 'Fold Health', title: 'Calendar', description: 'View and schedule patient appointments by type.', hash: '/calendar' },
  tasks: { eyebrow: 'Fold Health', title: 'Tasks', description: 'View, filter, and manage tasks in list or kanban board.', hash: '/tasks' },
  messages: { eyebrow: 'Fold Health', title: 'Messages', description: 'View and reply to patient SMS and chat messages.', hash: '/messages' },
  calls: { eyebrow: 'Fold Health', title: 'Calls', description: 'Manage call lines and review sessions with live transcripts.', hash: '/calls' },
  campaign: { eyebrow: 'Fold Health', title: 'Campaigns', description: 'Design and run patient outreach campaigns.', hash: '/campaign' },
  analytics: { eyebrow: 'Fold Health', title: 'Analytics', description: 'Executive, financial, risk, quality, and operational dashboards.', hash: '/analytics' },
  settings: { eyebrow: 'Fold Health', title: 'Settings', description: 'Configure agents, messaging, embedded components, and your account.', hash: '/settings/agents' },
};

/** Resolve a slug to a section, falling back to the branded default. */
export function getSection(slug) {
  if (!slug) return DEFAULT_SECTION;
  const key = String(slug).toLowerCase();
  return SECTIONS[key] || DEFAULT_SECTION;
}

export { SECTIONS };
