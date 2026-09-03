/**
 * Hash-based router for the Fold Health prototype.
 * Bidirectional sync between URL hash and Zustand store.
 */
import { PROFILE_TABS } from '../features/patient/data/programActivityMock';
import { getFirstWorklistLabel, tabPatchForWorklist } from './worklistDefaults';

// ── Parse hash into structured route ──
export function parseHash() {
  // Strip any `?query` (e.g. hidden-field params like #/f/12?mrn=A123) before
  // splitting into path segments — the query is read separately by the view.
  const raw = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  const segments = raw.split('/').filter(Boolean);
  return {
    page: segments[0] || 'population',
    section: segments[1] || null,
    tab: segments[2] || null,
    id: segments[3] || null,
    sub: segments[4] || null,
    extra: segments[5] || null,
    // Deepest patient URLs need a 7th/8th segment:
    // #/population/<list>/patient/<memberId>/care-management/care-programs/<program>/<step>
    extra2: segments[6] || null,
    extra3: segments[7] || null,
  };
}

// ── Build hash from parts ──
export function buildHash(...parts) {
  const clean = parts.filter(p => p != null && p !== '');
  return '#/' + clean.join('/');
}

// Every store slice that can back a patient profile view. Order doesn't
// matter — memberId is unique across the whole set post-unification.
const PATIENT_SLICES = ['patients', 'hccMembers', 'awvMembers', 'jsaMembers', 'ccmWorklistMembers', 'snpWorklistMembers', 'hedisMembers', 'allPatients'];

// ── Patient profile tab slugs ──
// The right-panel tab, the open care program, and its active step each get a
// URL segment so a refresh restores the exact spot:
//   #/population/<list>/patient/<memberId>[/<tab>[/<program>[/<step>]]]
// Slugs are derived from PROFILE_TABS so the two lists can't drift.
const tabSlug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const SLUG_TO_PROFILE_TAB = Object.fromEntries(PROFILE_TABS.map(t => [tabSlug(t), t]));

// Care Programs is now a sub-tab of Care Management (alongside the
// comprehensive plan and the activity log).
const CM_SUBTABS = ['Care Programs', 'Comprehensive Care Plan', 'Program Activity Log'];
const SLUG_TO_CM_SUBTAB = Object.fromEntries(CM_SUBTABS.map(t => [tabSlug(t), t]));

// The open program / step ride under the Care Programs sub-tab. 'summary' is
// the legacy cross-program view — now the Comprehensive Care Plan sub-tab.
function applyCareProgramsProgram(updates, programSeg, stepSeg) {
  if (programSeg === 'summary') {
    updates.careManagementTab = 'Comprehensive Care Plan';
    updates.selectedCareProgramKey = null;
    updates.careProgramStep = null;
    return;
  }
  updates.selectedCareProgramKey = programSeg || null;
  updates.careProgramStep = stepSeg || null;
}

// Applies the tab / (Care Management sub-tab) / program / step segments of a
// patient URL onto a `hashToState` updates object. Unknown tab slugs fall back
// to Overview.
function applyPatientSubRoute(updates, tabSeg, seg1, seg2, seg3) {
  updates.selectedCareProgramKey = null;
  updates.careProgramStep = null;
  updates.carePlanSummaryOpen = false;

  // Backward-compat: the old top-level `care-programs` tab (…/care-programs/
  // <program>/<step>) is now Care Management → Care Programs.
  if (tabSeg === 'care-programs') {
    updates.patientProfileTab = 'Care Management';
    updates.careManagementTab = 'Care Programs';
    applyCareProgramsProgram(updates, seg1, seg2);
    return;
  }

  const tab = (tabSeg && SLUG_TO_PROFILE_TAB[tabSeg]) || 'Overview';
  updates.patientProfileTab = tab;
  if (tab !== 'Care Management') return;

  // …/care-management/<sub-tab>[/<program>[/<step>]]
  const sub = (seg1 && SLUG_TO_CM_SUBTAB[seg1]) || 'Care Programs';
  updates.careManagementTab = sub;
  if (sub === 'Care Programs') applyCareProgramsProgram(updates, seg2, seg3);
}

// The tab / sub-tab / program / step tail of a patient URL, from store state.
function patientSubSegments(state) {
  const tab = state.patientProfileTab || 'Overview';
  if (tab === 'Overview') return [];
  const segs = [tabSlug(tab)];
  if (tab === 'Care Management') {
    const sub = state.careManagementTab || 'Care Programs';
    segs.push(tabSlug(sub));
    if (sub === 'Care Programs' && state.selectedCareProgramKey) {
      segs.push(state.selectedCareProgramKey);
      if (state.careProgramStep) segs.push(state.careProgramStep);
    }
  }
  return segs;
}

// Given a store row id, look up its memberId (Fold ID) across every slice.
// Returns null when no row matches — the caller falls back to the raw id.
function findPatientMemberId(state, id) {
  if (!id) return null;
  for (const key of PATIENT_SLICES) {
    const row = state[key]?.find?.(m => m?.id === id);
    if (row?.memberId) return String(row.memberId);
  }
  return null;
}

// Reverse of the above: given a memberId (from the URL), find the store
// row id we should set as selectedPatientId. Returns null if unknown so
// the caller can pass the raw URL value through unchanged.
function findPatientIdByMemberId(state, memberId) {
  if (!memberId) return null;
  const s = String(memberId);
  for (const key of PATIENT_SLICES) {
    const row = state[key]?.find?.(m => String(m?.memberId) === s);
    if (row?.id) return row.id;
  }
  return null;
}

// ── Derive hash from store state ──
export function stateToHash(state) {
  const { activePage, activeTab, settingsNavItem, settingsTab, messageTab,
    goalDetailId, goalWizardOpen, goalWizardEditId,
    chatGroupDetailId, agentRulesGroupId, businessHoursOpen } = state;

  // Shareable form fill-view wins over everything — it's a focused takeover.
  if (state.formViewId) {
    return buildHash('f', String(state.formViewId));
  }
  if (activePage === 'builder') {
    const agentId = state.builderAgent?.id;
    return agentId ? buildHash('settings', 'agents', 'edit', String(agentId)) : buildHash('builder');
  }
  if (activePage === 'analytics') {
    const view = state.analyticsView || 'executive';
    return view === 'executive' ? buildHash('analytics') : buildHash('analytics', view);
  }
  if (activePage === 'calendar') return buildHash('calendar');
  if (state.editingCampaignId) {
    // Email builder opened from Settings → Content keeps the settings path so
    // the URL is sharable AND the close action falls back to #/settings/content/emails.
    if (state.activePage === 'settings' && state.settingsNavItem === 'content') {
      return buildHash('settings', 'content', 'emails', String(state.editingCampaignId));
    }
    return buildHash('email', String(state.editingCampaignId));
  }
  if (state.editingFormId) {
    // Form builder is always opened from Settings → Content → Forms; keep the
    // settings path so closing falls back to #/settings/content/forms. Each
    // builder tab gets its own path, and Analytics carries its sub-tab too:
    //   …/forms/{id}/{mode}            (edit|score|preview|analytics)
    //   …/forms/{id}/analytics/{tab}   (insight|report|responses)
    const mode = state.formBuilderMode || 'edit';
    const parts = ['settings', 'content', 'forms', String(state.editingFormId), mode];
    if (mode === 'analytics') parts.push(state.formAnalyticsTab || 'insight');
    return buildHash(...parts);
  }
  if (state.campaignBuilderId) {
    return buildHash('campaign', String(state.campaignBuilderId));
  }
  if (activePage === 'campaign') {
    const tab = state.campaignTab || 'active';
    return tab === 'active' ? buildHash('campaign') : buildHash('campaign', tab);
  }
  if (activePage === 'home') return buildHash('home');
  if (activePage === 'messages') return buildHash('messages');
  if (activePage === 'calls') return buildHash('calls');
  if (activePage === 'tasks') return buildHash('tasks');

  if (activePage === 'settings') {
    if (settingsNavItem === 'messages') {
      if (businessHoursOpen) return buildHash('settings', 'messages', 'business-hours');
      if (agentRulesGroupId) return buildHash('settings', 'messages', 'chat-settings', agentRulesGroupId, 'rules');
      if (chatGroupDetailId) return buildHash('settings', 'messages', 'chat-settings', chatGroupDetailId);
      return buildHash('settings', 'messages', messageTab || 'chat-settings');
    }
    if (settingsNavItem === 'embedded-components') {
      const ecTab = state.embeddedComponentsTab || 'domain-registry';
      return buildHash('settings', 'embedded-components', ecTab);
    }
    if (settingsNavItem === 'content') {
      const cTab = state.contentTab || 'emails';
      return buildHash('settings', 'content', cTab);
    }
    if (settingsNavItem === 'account') {
      const acTab = state.accountTab || 'users';
      return buildHash('settings', 'account', acTab);
    }
    if (settingsNavItem === 'billing') {
      return buildHash('settings', 'billing');
    }
    if (settingsNavItem === 'member/leads') {
      const mlTab = state.memberLeadsTab || 'care-team';
      return buildHash('settings', 'member-leads', mlTab);
    }
    if (settingsNavItem === 'care-plan-library') {
      if (state.carePlanCreateOpen) return buildHash('settings', 'care-plan-library', 'create');
      const cplTab = state.carePlanTab || 'template';
      return buildHash('settings', 'care-plan-library', CARE_PLAN_TABS.includes(cplTab) ? cplTab : 'template');
    }
    // Sections without a panel yet still get a real path — clicking them
    // used to fall through to the agents branch, which yanked the user to
    // whatever agents tab was last active. ('agents' itself is excluded —
    // its own branch below carries the internal tab in the URL.)
    const section = SETTINGS_NAV_TO_SECTION[settingsNavItem];
    if (section && section !== 'agents') return buildHash('settings', section);
    // Agents section
    if (goalWizardOpen) return buildHash('settings', 'agents', 'goals', goalWizardEditId ? String(goalWizardEditId) : 'new');
    if (goalDetailId) return buildHash('settings', 'agents', 'goals', String(goalDetailId));
    if (settingsTab && settingsTab !== 'agents') return buildHash('settings', 'agents', settingsTab.replace(/ /g, '-'));
    return buildHash('settings', 'agents');
  }

  const LIST_TO_URL = {
    'TOC IP': 'toc',
    'TCM': 'tcm',
    'Day Optimizer': 'day-optimizer',
    'Review HRA': 'review-hra',
    'IP Visits': 'ip-visits',
    'High Risk': 'high-risk',
    'High Cost': 'high-cost',
    'SNP': 'snp',
    'Annual Visit': 'awv',
    'HCC': 'hcc',
    'HCC (Archived)': 'hcc-archived',
    'HEDIS': 'hedis',
    'CCM': 'ccm',
    'JSA': 'jsa',
    'High Utilizers': 'high-utilizers',
    'DM': 'dm',
    'My Patients': 'my-patients',
    'All Patients': 'all-patients',
    'pg:All': 'population-groups',
    'pg:Static': 'population-groups-static',
    'pg:Dynamic': 'population-groups-dynamic'
  };

  // Dynamic group rule/detail screen — survives refresh:
  // #/population/<pgSlug>/rule/<groupId>
  if (state.pgRuleBuilder?.groupId) {
    const listSlug = LIST_TO_URL[state.activeSubnavList];
    const pgSlug = listSlug && listSlug.startsWith('population-groups') ? listSlug : 'population-groups';
    return buildHash('population', pgSlug, 'rule', state.pgRuleBuilder.groupId);
  }

  // Patient detail view
  if (state.selectedPatientId) {
    // Prefer the fold/member id in the URL — it survives worklist ids
    // being renamed and matches what the user sees in the UI.
    const memberId = findPatientMemberId(state, state.selectedPatientId);
    const listSlug = LIST_TO_URL[state.activeSubnavList];
    const patientKey = memberId || state.selectedPatientId;
    const subSegs = patientSubSegments(state);
    // HEDIS keeps its own top-level path (`#/hedis`) — mirror that for the
    // patient URL so it's not double-prefixed with `population`.
    if (state.activeSubnavList === 'HEDIS') {
      return buildHash('hedis', 'patient', patientKey, ...subSegs);
    }
    if (listSlug) {
      return buildHash('population', listSlug, 'patient', patientKey, ...subSegs);
    }
    return buildHash('population', 'patient', patientKey, ...subSegs);
  }

  if (state.activeSubnavList === 'TOC IP') {
    return buildHash('population', 'toc');
  }
  if (state.activeSubnavList === 'TCM') {
    return buildHash('population', activeTab === 'toc-queue' ? 'tcm-queue' : 'tcm');
  }
  if (state.activeSubnavList && state.activeSubnavList !== 'TOC IP') {
    // HEDIS has its own top-level path
    if (state.activeSubnavList === 'HEDIS') {
      return buildHash('hedis');
    }
    const section = LIST_TO_URL[state.activeSubnavList];
    if (section) {
      return buildHash('population', section);
    }
  }

  return buildHash('population', activeTab || 'toc-worklist');
}

// ── Settings section slugs ⇄ store nav keys ──
// Single source so stateToHash / hashToState / the sub-nav can't drift.
// Keys missing here (e.g. legacy raw-label keys) fall through to the
// agents branch — same as before routing existed for them.
const SETTINGS_SECTION_TO_NAV = {
  'member-leads': 'member/leads',
  'calendar': 'calendar',
  'tasks': 'tasks',
  'messages': 'messages',
  'calls': 'calls',
  'care-plan-library': 'care-plan-library',
  'crm-widgets': 'crm-widgets',
  'embedded-components': 'embedded-components',
  'content': 'content',
  'wearables': 'wearables',
  'journeys': 'journeys',
  'agents': 'agents',
  'automations': 'automations',
  'cost-template': 'cost-template',
  'memberships': 'memberships',
  'billing': 'billing',
  'account': 'account',
};
const SETTINGS_NAV_TO_SECTION = Object.fromEntries(
  Object.entries(SETTINGS_SECTION_TO_NAV).map(([slug, nav]) => [nav, slug]),
);

// Sections whose single tab strip lives in the store and rides the URL.
const CARE_PLAN_TABS = ['template', 'goals', 'interventions', 'barriers'];

function tabForListSlug(section, list) {
  if (list === 'TOC IP' || section === 'tcm-queue' || section === 'toc-queue') return 'toc-queue';
  return 'toc-worklist';
}

// ── Map parsed route → store state updates ──
export function hashToState(route, state = null) {
  // Always clear all drawer/overlay states on any navigation
  const updates = {
    goalDetailId: null, goalWizardOpen: false, goalWizardEditId: null,
    chatGroupDetailId: null, agentRulesGroupId: null, businessHoursOpen: false,
    formViewId: null,
    carePlanCreateOpen: false,
    carePlanSummaryOpen: false,
  };

  // Shareable form fill-view: #/f/{id}
  if (route.page === 'f' && route.section) {
    const numId = isNaN(Number(route.section)) ? route.section : Number(route.section);
    updates.formViewId = numId;
    return updates;
  }
  if (route.page === 'builder') { updates.activePage = 'builder'; return updates; }
  if (route.page === 'analytics') {
    updates.activePage = 'analytics';
    updates.analyticsView = route.section || 'executive';
    return updates;
  }
  if (route.page === 'calendar') { updates.activePage = 'calendar'; return updates; }
  if (route.page === 'home') { updates.activePage = 'home'; return updates; }
  if (route.page === 'messages') { updates.activePage = 'messages'; return updates; }
  if (route.page === 'calls') { updates.activePage = 'calls'; return updates; }
  if (route.page === 'tasks') { updates.activePage = 'tasks'; return updates; }
  if (route.page === 'hedis') {
    updates.activePage = 'population';
    updates.activeSubnavList = 'HEDIS';
    updates.activeTab = 'toc-worklist';
    updates._subnavNavigated = true;
    // #/hedis/patient/<memberId>[/<tab>[/<program>[/<step>]]]
    if (route.section === 'patient' && route.tab) {
      updates.selectedPatientId = findPatientIdByMemberId(state, route.tab) || route.tab;
      applyPatientSubRoute(updates, route.id, route.sub, route.extra, route.extra2);
    }
    return updates;
  }
  if (route.page === 'email' && route.section) {
    updates.activePage = 'campaign';
    const numId = isNaN(Number(route.section)) ? route.section : Number(route.section);
    updates.editingCampaignId = numId;
    updates._pendingEmailEditId = route.section;
    return updates;
  }
  if (route.page === 'campaign') {
    updates.activePage = 'campaign';
    if (route.section === 'edit' && route.tab) {
      const numId = isNaN(Number(route.tab)) ? route.tab : Number(route.tab);
      updates.editingCampaignId = numId;
      updates._pendingEmailEditId = route.tab;
      return updates;
    }
    if (route.section && !['active', 'drafts', 'ended'].includes(route.section)) {
      const numId = isNaN(Number(route.section)) ? route.section : Number(route.section);
      updates.campaignBuilderId = numId;
      updates._pendingCampaignBuilderId = route.section;
      return updates;
    }
    const tab = route.section || 'active';
    updates.campaignTab = ['active', 'drafts', 'ended'].includes(tab) ? tab : 'active';
    return updates;
  }

  if (route.page === 'settings') {
    updates.activePage = 'settings';
    if (route.section === 'messages') {
      updates.settingsNavItem = 'messages';
      if (route.tab === 'business-hours') {
        updates.businessHoursOpen = true; updates.chatGroupDetailId = null; updates.agentRulesGroupId = null;
      } else if (route.tab === 'chat-settings' && route.id) {
        if (route.sub === 'rules') {
          updates.agentRulesGroupId = isNaN(route.id) ? route.id : Number(route.id);
          updates.chatGroupDetailId = null; updates.businessHoursOpen = false;
        } else {
          updates.chatGroupDetailId = route.id === 'new' ? 'new' : (isNaN(route.id) ? route.id : Number(route.id));
          updates.agentRulesGroupId = null; updates.businessHoursOpen = false;
        }
      } else {
        updates.messageTab = route.tab || 'chat-settings';
        updates.chatGroupDetailId = null; updates.agentRulesGroupId = null; updates.businessHoursOpen = false;
      }
      return updates;
    }
    // Embedded Components section
    if (route.section === 'embedded-components') {
      updates.settingsNavItem = 'embedded-components';
      updates.embeddedComponentsTab = route.tab || 'domain-registry';
      return updates;
    }
    // Content section
    if (route.section === 'content') {
      updates.settingsNavItem = 'content';
      updates.contentTab = route.tab || 'emails';
      // Per-email edit: #/settings/content/emails/{id} re-opens the email
      // builder on top of the listing page (AppLayout hydration uses
      // _pendingEmailEditId to call openEmailBuilder after the campaign loads).
      if (route.tab === 'emails' && route.id) {
        updates._pendingEmailEditId = route.id;
      }
      // Per-form edit: #/settings/content/forms/{id}/{mode}[/{analyticsTab}]
      // re-opens the form builder on top of the listing page (AppLayout
      // hydration uses _pendingFormEditId; openFormBuilder applies the mode).
      if (route.tab === 'forms' && route.id) {
        updates._pendingFormEditId = route.id;
        const mode = ['edit', 'logic', 'score', 'preview', 'analytics'].includes(route.sub) ? route.sub : 'edit';
        updates._pendingFormMode = mode;
        updates._pendingFormAnalyticsTab = mode === 'analytics' && ['insight', 'report', 'responses'].includes(route.extra)
          ? route.extra : 'insight';
      }
      return updates;
    }
    // Account / IAM section
    if (route.section === 'account') {
      updates.settingsNavItem = 'account';
      updates.accountTab = route.tab || 'users';
      return updates;
    }
    // APCM Billing section
    if (route.section === 'billing') {
      updates.settingsNavItem = 'billing';
      return updates;
    }
    // Member/Leads section (settings → automation → member/leads)
    if (route.section === 'member-leads') {
      updates.settingsNavItem = 'member/leads';
      updates.memberLeadsTab = route.tab || 'care-team';
      return updates;
    }
    // Care Plan Library — tab + create overlay rides the URL so refresh restores it.
    if (route.section === 'care-plan-library') {
      updates.settingsNavItem = 'care-plan-library';
      if (route.tab === 'create') {
        updates.carePlanTab = 'template';
        updates.carePlanCreateOpen = true;
        return updates;
      }
      updates.carePlanTab = CARE_PLAN_TABS.includes(route.tab) ? route.tab : 'template';
      updates.carePlanCreateOpen = false;
      return updates;
    }
    // Every other known section slug (incl. not-yet-built panels) restores
    // its section on refresh instead of bouncing to the last agents tab.
    if (SETTINGS_SECTION_TO_NAV[route.section]) {
      updates.settingsNavItem = SETTINGS_SECTION_TO_NAV[route.section];
      return updates;
    }
    // Agent edit (builder) route: #/settings/agents/edit/{id}
    if (route.section === 'agents' && route.tab === 'edit' && route.id) {
      updates.activePage = 'builder';
      updates._pendingAgentId = route.id;
      return updates;
    }
    // Agents section
    updates.settingsNavItem = 'agents';
    if (route.section === 'agents' && route.tab === 'goals') {
      if (route.id === 'new') {
        updates.goalWizardOpen = true; updates.goalWizardEditId = null; updates.goalDetailId = null;
      } else if (route.id) {
        updates.goalDetailId = isNaN(Number(route.id)) ? route.id : Number(route.id);
        updates.goalWizardOpen = false;
      } else {
        updates.settingsTab = 'goals'; updates.goalDetailId = null; updates.goalWizardOpen = false;
      }
    } else if (route.section === 'agents' && route.tab) {
      updates.settingsTab = route.tab.replace(/-/g, ' ');
    } else {
      updates.settingsTab = 'agents';
    }
    return updates;
  }

  // Population — patient detail or worklist/queue/hcc
  updates.activePage = 'population';

  const URL_TO_LIST = {
    'toc': 'TOC IP',
    'tcm': 'TCM',
    'tcm-queue': 'TCM',
    'toc-worklist': 'TCM',
    'toc-queue': 'TCM',
    'day-optimizer': 'Day Optimizer',
    'review-hra': 'Review HRA',
    'ip-visits': 'IP Visits',
    'high-risk': 'High Risk',
    'high-cost': 'High Cost',
    'snp': 'SNP',
    'awv': 'Annual Visit',
    'hcc': 'HCC',
    'hcc-archived': 'HCC (Archived)',
    'hedis': 'HEDIS',
    'ccm': 'CCM',
    'jsa': 'JSA',
    'high-utilizers': 'High Utilizers',
    'dm': 'DM',
    'my-patients': 'My Patients',
    'all-patients': 'All Patients',
    'population-groups': 'pg:All',
    'population-groups-static': 'pg:Static',
    'population-groups-dynamic': 'pg:Dynamic'
  };

  // Legacy patient URL: #/population/patient/<id>[/<tab>[/<program>[/<step>]]]
  if (route.section === 'patient' && route.tab) {
    updates.selectedPatientId = findPatientIdByMemberId(state, route.tab) || route.tab;
    applyPatientSubRoute(updates, route.id, route.sub, route.extra, route.extra2);
    return updates;
  }
  // Dynamic group detail deep link: #/population/<pgSlug>/rule/<groupId>.
  // The group row may not be fetched yet, so this only records the id —
  // usePopulationGroupsView opens the builder once popGroups arrive.
  if (route.section && URL_TO_LIST[route.section] && route.tab === 'rule' && route.id) {
    updates.activePage = 'population';
    updates.activeSubnavList = URL_TO_LIST[route.section];
    updates.activeTab = tabForListSlug(route.section, URL_TO_LIST[route.section]);
    updates._subnavNavigated = true;
    updates.pgRuleRestoreId = route.id;
    return updates;
  }

  // New patient URL: #/population/<listSlug>/patient/<memberId>[/<tab>[/<program>[/<step>]]]
  if (route.section && URL_TO_LIST[route.section] && route.tab === 'patient' && route.id) {
    updates.activeSubnavList = URL_TO_LIST[route.section];
    updates.activeTab = tabForListSlug(route.section, URL_TO_LIST[route.section]);
    updates._subnavNavigated = true;
    updates.selectedPatientId = findPatientIdByMemberId(state, route.id) || route.id;
    applyPatientSubRoute(updates, route.sub, route.extra, route.extra2, route.extra3);
    return updates;
  }
  updates.selectedPatientId = null;

  if (route.section && URL_TO_LIST[route.section]) {
    updates.activeSubnavList = URL_TO_LIST[route.section];
    updates.activeTab = tabForListSlug(route.section, URL_TO_LIST[route.section]);
    updates._subnavNavigated = true;
    return updates;
  }

  // Bare #/population (or unknown section) lands on the first sidenav worklist.
  const first = state?.worklistOrder?.[0] || getFirstWorklistLabel();
  updates.activeSubnavList = first;
  Object.assign(updates, tabPatchForWorklist(first));
  updates._subnavNavigated = false;
  return updates;
}

// ── Push current store state to hash (called from store setters) ──
let _syncing = false;

export function updateHash(getState) {
  if (_syncing) return;
  _syncing = true;
  try {
    const state = typeof getState === 'function' ? getState() : getState;
    const hash = stateToHash(state);
    if (window.location.hash !== hash) {
      window.location.hash = hash;
    }
  } finally {
    _syncing = false;
  }
}

// ── Sync hash → store (on hashchange or initial load) ──
export function syncFromHash(setState, getState) {
  if (_syncing) return;
  _syncing = true;
  try {
    const route = parseHash();
    const currentState = typeof getState === 'function' ? getState() : null;
    const updates = hashToState(route, currentState);
    if (Object.keys(updates).length > 0) {
      if (updates.activePage) sessionStorage.setItem('activePage', updates.activePage);
      if (updates.activeTab) sessionStorage.setItem('activeTab', updates.activeTab);
      if (updates.settingsTab) sessionStorage.setItem('settingsTab', updates.settingsTab);
      if (updates.settingsNavItem) sessionStorage.setItem('settingsNavItem', updates.settingsNavItem);
      setState(updates);
    }
  } finally {
    _syncing = false;
  }
}

// ── Initialize: hashchange listener + initial sync ──
export function initRouter(store) {
  // On initial load
  if (window.location.hash && window.location.hash !== '#/' && window.location.hash !== '#') {
    syncFromHash(store.setState.bind(store), store.getState.bind(store));
  } else {
    updateHash(store.getState.bind(store));
  }

  // Browser back/forward
  window.addEventListener('hashchange', () => {
    syncFromHash(store.setState.bind(store), store.getState.bind(store));
  });
}
