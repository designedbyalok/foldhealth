// ─── Analytics Data & Constants ───

export const PAGES = [
  { section: 'OVERVIEW', items: [
    { id: 'executive', label: 'Executive Dashboard', icon: 'solar:chart-linear' },
    { id: 'employer', label: 'Employer Impact Report', icon: 'solar:buildings-2-linear' },
  ]},
  { section: 'ANALYTICS', items: [
    { id: 'population', label: 'Population Overview', icon: 'solar:users-group-two-rounded-linear' },
    { id: 'financial', label: 'Financial Analytics', icon: 'solar:wallet-2-linear' },
    { id: 'risk', label: 'Risk & Revenue', icon: 'solar:shield-warning-linear' },
    { id: 'quality', label: 'Quality Management', icon: 'solar:verified-check-linear' },
    { id: 'utilization', label: 'Utilization Mgmt', icon: 'solar:hospital-linear' },
  ]},
  { section: 'CARE PROGRAMS', items: [
    { id: 'care', label: 'Care Management', icon: 'solar:clipboard-text-linear' },
    { id: 'network', label: 'Network Analytics', icon: 'solar:global-linear' },
    { id: 'pharmacy', label: 'Pharmacy Adherence', icon: 'solar:pill-linear' },
  ]},
  { section: 'BUSINESS OUTCOMES', items: [
    { id: 'shared', label: 'Shared Savings', icon: 'solar:hand-money-linear' },
    { id: 'roi', label: 'ROI & Simulators', icon: 'solar:calculator-linear' },
  ]},
  { section: 'OPERATIONS', items: [
    { id: 'tools', label: 'Tool Usage', icon: 'solar:widget-2-linear' },
    { id: 'platformops', label: 'Platform Ops', icon: 'solar:server-2-linear' },
    { id: 'aianalytics', label: 'AI Analytics', icon: 'custom:ai' },
    { id: 'sdoh', label: 'SDoH & Equity', icon: 'solar:heart-pulse-2-linear' },
    { id: 'actionrules', label: 'Action Rules', icon: 'solar:bolt-circle-linear' },
  ]},
];

export const VIEW_TITLES = {
  executive:    { title: 'Executive Dashboard', sub: 'KPIs, trends & priorities' },
  employer:     { title: 'Employer Impact Report', sub: 'Savings, engagement & outcomes by employer' },
  population:   { title: 'Population Overview', sub: 'Risk stratification & chronic conditions' },
  financial:    { title: 'Financial Analytics', sub: 'TCOC, PMPM & benchmark comparisons' },
  risk:         { title: 'Risk & Revenue', sub: 'RAF scores, HCC suspects & coding accuracy' },
  quality:      { title: 'Quality Management', sub: 'HEDIS measures, gap closure & performance' },
  utilization:  { title: 'Utilization Management', sub: 'Admissions, readmissions, ED & SNF' },
  care:         { title: 'Care Management', sub: 'Program ROI, productivity & team metrics' },
  network:      { title: 'Network Analytics', sub: 'Provider scorecards & referral leakage' },
  pharmacy:     { title: 'Pharmacy Adherence', sub: 'MAC, MAD & MAH outcomes, productivity & claim data quality' },
  shared:       { title: 'Shared Savings', sub: 'MSSP benchmark & trajectory' },
  roi:          { title: 'ROI & Simulators', sub: 'What-if modeling & scenario planning' },
  tools:        { title: 'Tool Usage', sub: 'Sidecar adoption & automation performance' },
  platformops:  { title: 'Platform Ops', sub: 'Data pipeline health & integration uptime' },
  aianalytics:  { title: 'AI Analytics', sub: 'Fold Unity NLQ, anomalies & predictions' },
  sdoh:         { title: 'SDoH & Equity', sub: 'Social determinants & health equity' },
  actionrules:  { title: 'Action Rules', sub: 'Automated rules engine & agent workflows' },
};

export const PERSONA_ACCESS = {
  exec: null, // all access
  manager_risk: ['population','financial','risk','network','sdoh','platformops'],
  manager_quality: ['population','quality','care','sdoh','pharmacy'],
  manager_care: ['population','care','quality','sdoh','actionrules','pharmacy'],
  manager_utilization: ['population','financial','utilization','care','network','platformops'],
  analyst: null, // all access (SQL overlay)
};

export const PERSONA_LABELS = {
  exec: 'Executive',
  manager_risk: 'Risk Manager',
  manager_quality: 'Quality Manager',
  manager_care: 'Care Manager',
  manager_utilization: 'Utilization Manager',
  analyst: 'Analyst',
};

export const ORGANIZATIONS = [
  { value: 'aco', label: 'Northside ACO Network (MSSP)' },
  { value: 'payer', label: 'BlueCross VBC Plan (MA)' },
  { value: 'provider', label: 'Meridian Health System (FFS)' },
  { value: 'fqhc', label: 'Eastside FQHC (FFS/UDS)' },
  { value: 'mso', label: 'Summit MSO (MSSP+REACH)' },
];

export const QUARTERS = [
  { value: 'Q4-2025', label: 'Q4 2025 (Oct\u2013Dec)' },
  { value: 'Q3-2025', label: 'Q3 2025' },
  { value: 'YTD-2025', label: 'YTD 2025' },
  { value: 'FY-2024', label: 'FY 2024' },
];

export const PERSONA_DETAILS = {
  exec: { name: 'Dr. Ramesh', role: 'Executive \u00B7 Head of Pop Health', dot: '#0284C7' },
  manager_risk: { name: 'Sarah Patel', role: 'Risk Manager', dot: '#DC2626' },
  manager_quality: { name: 'Maria Chen', role: 'Quality Manager', dot: '#059669' },
  manager_care: { name: 'John Torres', role: 'Care Manager', dot: '#D97706' },
  manager_utilization: { name: 'Linda Kim', role: 'Utilization Manager', dot: '#7C3AED' },
  analyst: { name: 'Alex Wong', role: 'Data Analyst', dot: 'var(--neutral-300)' },
};

export const QUALITY_MEASURES = [
  { name: 'Annual Wellness Visit (AWV)', rate: 61, target: 80, tag: 'Stars', trend: 'up' },
  { name: 'Diabetes HbA1c Control (<8%)', rate: 72, target: 80, tag: 'HEDIS', trend: 'flat' },
  { name: 'Controlling Blood Pressure', rate: 64, target: 75, tag: 'ACO', trend: 'down' },
  { name: 'Colorectal Cancer Screening', rate: 58, target: 70, tag: 'Stars', trend: 'up' },
  { name: 'Breast Cancer Screening', rate: 71, target: 80, tag: 'HEDIS', trend: 'up' },
  { name: 'Depression Screening (PHQ-9)', rate: 83, target: 85, tag: 'ACO', trend: 'up' },
  { name: 'Statin Therapy (ASCVD)', rate: 71, target: 80, tag: 'Stars', trend: 'flat' },
  { name: 'Medication Adherence – Diabetes', rate: 78, target: 80, tag: 'Stars', trend: 'up' },
  { name: 'Medication Adherence – HTN', rate: 75, target: 80, tag: 'Stars', trend: 'flat' },
  { name: 'Medication Adherence – Statins', rate: 77, target: 80, tag: 'Stars', trend: 'up' },
  { name: 'Fall Risk Assessment (65+)', rate: 44, target: 60, tag: 'HEDIS', trend: 'down' },
  { name: 'Care Plan After Discharge', rate: 62, target: 75, tag: 'ACO', trend: 'up' },
  { name: 'Tobacco Cessation Counseling', rate: 69, target: 80, tag: 'HEDIS', trend: 'flat' },
];
