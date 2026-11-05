/**
 * Mock data for Embedded Components settings.
 * Domains, components, and mock patient profiles for preview mode.
 */

export const DOMAIN_CATEGORIES = [
  'Internal',
  'Prior authorization',
  'Care gaps / HEDIS',
  'Analytics',
  'SDOH / referrals',
  'Rx / PBM',
  'Risk stratification',
  'Care management',
  'Other',
];

export const HIPAA_OPTIONS = [
  'Verified',
  'BAA in place',
  'Pending BAA',
  'Verify externally',
];

export const COMPONENT_CATEGORIES = [
  'Prior authorization',
  'Care gaps / HEDIS',
  'Analytics',
  'SDOH / referrals',
  'Rx / PBM',
  'Risk stratification',
  'Care management',
  'Other',
];

export const ICON_OPTIONS = [
  { emoji: '📋', label: 'Clipboard' },
  { emoji: '📊', label: 'Chart' },
  { emoji: '💊', label: 'Pill' },
  { emoji: '🏥', label: 'Hospital' },
  { emoji: '🔍', label: 'Search' },
  { emoji: '📄', label: 'Document' },
  { emoji: '⚙', label: 'Settings' },
  { emoji: '🏠', label: 'Home' },
];

export const VISIBILITY_OPTIONS = [
  'All providers',
  'Physicians only',
  'Care managers only',
  'Clinical + admin staff',
];

export const ACTIVATION_OPTIONS = [
  { value: 'always', label: 'Always show when patient is open' },
  { value: 'conditional', label: 'Only when conditions are met' },
];

export const CONDITION_OPTIONS = [
  'Patient has open prior auth',
  'Patient has open HEDIS gaps',
  'Patient is in a value-based care program',
  'Custom condition via API…',
];

export const TOKEN_LIFETIME_OPTIONS = [
  { value: 5, label: '5 min (default)' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min: for long workflows' },
];

export const CONTEXT_FIELDS = [
  { key: 'patientId', label: 'patientId', locked: true, description: 'always required' },
  { key: 'accountId', label: 'accountId', locked: true, description: 'always required' },
  { key: 'userId', label: 'userId', locked: false },
  { key: 'userEmail', label: 'userEmail', locked: false },
  { key: 'screen', label: 'screen', locked: false },
  { key: 'componentId', label: 'componentId', locked: false },
];

export const WEB_PLACEMENT_OPTIONS = [
  { value: 'p360-tab', label: 'P360 tab', description: 'Full-width patient page' },
  { value: 'side-drawer', label: 'Side-drawer tab', description: 'Tab in patient drawer' },
  { value: 'widget-card', label: 'Widget card', description: 'Card in drawer tab' },
  { value: 'action-menu', label: 'Action menu', description: 'Menu item' },
];

export const SIDECAR_PATIENT_PLACEMENTS = [
  { value: 'tab', label: 'New tab', description: 'Added to Gaps / Insights / Tasks row' },
  { value: 'widget', label: 'Widget in existing tab', description: 'Card within Insights, Gaps, Tasks…' },
];

export const SIDECAR_GLOBAL_PLACEMENTS = [
  'New section in Chat tab',
  'New section in Tasks tab',
  'Pinned top widget (always visible)',
];

export const MOBILE_PLACEMENTS = [
  { value: 'profile-tab', label: 'Patient profile tab', description: 'Tab in Summary / Clinical / Communication row' },
  { value: 'list-action', label: 'Patient list action', description: 'Menu on Members / Leads lists' },
  { value: 'widget-card', label: 'Embedded widget card', description: 'Card within profile tab content' },
  { value: 'home-card', label: 'Home screen card', description: 'Dashboard widget (no patient context)' },
];

export const DRAWER_TAB_OPTIONS = [
  'Gaps', 'Insight', 'Summary', 'Tasks', 'Profile', 'Activity', 'Communication', 'Outreach',
];

export const ACTION_MENU_LOCATIONS = [
  { key: 'my-patients', label: 'My Patients' },
  { key: 'all-patients', label: 'All Patients' },
  { key: 'population-groups', label: 'Population Groups' },
  { key: 'leads-contacts', label: 'Leads & Contacts' },
  { key: 'p360-action', label: 'P360 action menu' },
  { key: 'hedis-worklist', label: 'HEDIS worklist' },
];

export const WORKLIST_OPTIONS = [
  'TOC IP', 'TOC ED', 'HIU', 'HEDIS', 'HCCs', 'DM', 'AWV', 'SNP',
];

/* ── Mock Domains ── */
export const DOMAINS = [
  {
    id: 1,
    vendor: 'Fold (internal)',
    domain: 'fold.health',
    category: 'Internal',
    hipaa: 'Verified',
    activeComponents: 2,
    addedDate: '03/06/2026',
    status: 'active',
  },
  {
    id: 2,
    vendor: 'Availity',
    domain: 'prior-auth.vendor.com',
    category: 'Prior authorization',
    hipaa: 'BAA in place',
    activeComponents: 1,
    addedDate: '03/20/2026',
    status: 'active',
  },
  {
    id: 3,
    vendor: 'Arcadia Analytics',
    domain: 'analytics.arcadia.com',
    category: 'Analytics',
    hipaa: 'Pending BAA',
    activeComponents: 0,
    addedDate: '03/22/2026',
    status: 'active',
  },
  {
    id: 4,
    vendor: 'HEDIS Vendor',
    domain: 'hedis-tool.example.com',
    category: 'Care gaps / HEDIS',
    hipaa: 'BAA in place',
    activeComponents: 1,
    addedDate: '03/10/2026',
    status: 'removed',
  },
];

/* ── Mock Embedded Components ── */
export const COMPONENTS = [
  {
    id: 1,
    name: 'Prior Auth Widget',
    icon: '📋',
    category: 'Prior authorization',
    description: 'Submit and track prior authorization requests for this patient without leaving Fold.',
    domainId: 2,
    domain: 'prior-auth.vendor.com',
    status: 'active',
    surfaces: ['web', 'sidecar'],
    placements: {
      web: 'side-drawer',
      sidecar: 'tab',
    },
    webConfig: {
      drawerWidth: 480,
      opensVia: 'Action menu item only',
      tabContext: 'All patient tabs',
      background: 'Dim patient chart',
    },
    sidecarConfig: {
      view: 'patient',
      placement: 'tab',
      tabLabel: 'Prior Auth',
    },
    url: '/widget/auth',
    stagingUrl: '/widget/auth?env=staging',
    tokenLifetime: 30,
    contextFields: ['patientId', 'accountId', 'userId', 'userEmail', 'screen', 'componentId'],
    visibleTo: 'All providers',
    activation: 'always',
    errors24h: 0,
    lastLoaded: '03/28/2026 09:14',
    enabled: true,
    previewed: true,
  },
  {
    id: 2,
    name: 'Risk Dashboard',
    icon: '📊',
    category: 'Analytics',
    description: 'View risk stratification scores and trending data for this patient.',
    domainId: 3,
    domain: 'analytics.arcadia.com',
    status: 'inactive',
    surfaces: ['web'],
    placements: { web: 'p360-tab' },
    webConfig: { tabLabel: 'Risk Score' },
    url: '/embed/risk-dashboard',
    stagingUrl: '/embed/risk-dashboard?env=staging',
    tokenLifetime: 15,
    contextFields: ['patientId', 'accountId', 'userId'],
    visibleTo: 'Physicians only',
    activation: 'always',
    errors24h: 0,
    lastLoaded: '03/27/2026 14:22',
    enabled: false,
    previewed: true,
  },
  {
    id: 3,
    name: 'HEDIS Gap Tracker',
    icon: '🔍',
    category: 'Care gaps / HEDIS',
    description: 'Track and close HEDIS quality measure gaps for this patient.',
    domainId: 4,
    domain: 'hedis-tool.example.com',
    status: 'error',
    domainRemoved: true,
    surfaces: ['web', 'sidecar'],
    placements: { web: 'widget-card', sidecar: 'widget' },
    webConfig: { drawerTab: 'Gaps', widgetHeight: 'Auto (up to 280px)' },
    url: '/widget/hedis',
    stagingUrl: '/widget/hedis?env=test',
    tokenLifetime: 5,
    contextFields: ['patientId', 'accountId', 'userId', 'userEmail'],
    visibleTo: 'All providers',
    activation: 'conditional',
    condition: 'Patient has open HEDIS gaps',
    errors24h: 5,
    lastLoaded: '03/25/2026 11:30',
    enabled: false,
    previewed: true,
  },
  {
    id: 4,
    name: 'SDOH Screener',
    icon: '🏠',
    category: 'SDOH / referrals',
    description: 'Social determinants of health screening questionnaire with auto-referral.',
    domainId: 1,
    domain: 'fold.health',
    status: 'active',
    surfaces: ['web', 'mobile'],
    placements: { web: 'action-menu', mobile: 'profile-tab' },
    webConfig: {
      actionMenus: ['all-patients', 'p360-action'],
      worklists: ['TOC IP', 'HEDIS'],
      actionTrigger: 'Opens a drawer on the right',
    },
    mobileConfig: { tabLabel: 'SDOH' },
    url: '/tools/sdoh-screener',
    stagingUrl: '/tools/sdoh-screener?env=staging',
    tokenLifetime: 15,
    contextFields: ['patientId', 'accountId', 'userId', 'userEmail', 'screen', 'componentId'],
    visibleTo: 'Care managers only',
    activation: 'always',
    errors24h: 0,
    lastLoaded: '03/28/2026 10:05',
    enabled: true,
    previewed: true,
  },
  {
    id: 5,
    name: 'Medication Review Tool',
    icon: '💊',
    category: 'Rx / PBM',
    description: 'Interactive medication reconciliation and formulary check.',
    domainId: 1,
    domain: 'fold.health',
    status: 'inactive',
    surfaces: ['web'],
    placements: { web: 'side-drawer' },
    webConfig: {
      drawerWidth: 560,
      opensVia: 'Nav tab + action menu',
      tabContext: 'All patient tabs',
      background: 'No dim',
    },
    url: '/tools/med-review',
    stagingUrl: '/tools/med-review?env=staging',
    tokenLifetime: 30,
    contextFields: ['patientId', 'accountId', 'userId', 'userEmail'],
    visibleTo: 'Physicians only',
    activation: 'always',
    errors24h: 1,
    lastLoaded: '03/26/2026 16:45',
    enabled: false,
    previewed: false,
  },
];

/* ── Tab Widgets: existing widgets per patient profile tab (from Excel) ── */
export const TAB_WIDGETS = {
  'Gaps': ['Care Gaps', 'Diagnosis Gaps'],
  'Insight': ['Health Radar', 'Patient Synopsis', 'Care Plan Recommendation', 'Prior Authorization Request', 'Alerts', 'Diagnoses Surfacing', 'Recent Clinical Events', 'PAMI', 'Vitals', 'History', 'Home Monitoring', 'Lab Trends'],
  'Summary': ['Sticky Notes', 'Upcoming Appointments', 'Contact Notes', 'Active Care Journeys', 'Family & Caregivers', 'Primary Care Team', 'Member Groups', 'Active Automations', 'Subscriptions', 'Insurance'],
  'Tasks': ['My Tasks', 'Patient Tasks'],
  'Profile': ['Basic info', 'Contact info', 'Custom fields', 'Address', 'Family and care givers', 'Other info'],
  'Activity': [],
  'Communication': [],
  'Outreach': [],
};

/* ── Mock Patient Profiles for Preview ── */
export const MOCK_PATIENTS = [
  {
    id: 'mp1',
    name: 'Maria Gonzalez',
    initials: 'MG',
    age: 65,
    gender: 'F',
    dob: '03/12/1961',
    memberId: '19401',
    language: 'Spanish',
    conditions: ['Type 2 Diabetes', 'Hypertension'],
    openGaps: 3,
    programs: ['TCM', 'DM'],
    label: 'Diabetic patient with open gaps',
  },
  {
    id: 'mp2',
    name: 'James Whitfield',
    initials: 'JW',
    age: 78,
    gender: 'M',
    dob: '08/22/1947',
    memberId: '18450',
    language: 'English',
    conditions: ['CHF', 'CKD Stage 3', 'COPD', 'A-fib'],
    openGaps: 7,
    programs: ['TCM', 'HCCs', 'SNP'],
    label: 'Complex patient, multiple comorbidities',
  },
  {
    id: 'mp3',
    name: 'Kevin Park',
    initials: 'KP',
    age: 42,
    gender: 'M',
    dob: '11/05/1983',
    memberId: '18451',
    language: 'Korean',
    conditions: [],
    openGaps: 0,
    programs: ['AWV'],
    label: 'Healthy patient, no open gaps',
  },
  {
    id: 'mp4',
    name: 'Sophie Chen',
    initials: 'SC',
    age: 8,
    gender: 'F',
    dob: '06/14/2017',
    memberId: '18452',
    language: 'Chinese',
    conditions: ['Asthma'],
    openGaps: 1,
    programs: [],
    label: 'Pediatric patient',
  },
];
