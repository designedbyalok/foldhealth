// Fallback P360 profile data used when DB hasn't loaded yet
export const FALLBACK_P360 = {
  profile_type: 'Central Profile',
  health_plan_name: 'FoldHealth',
  // Intentionally null — the profile card falls back to the patient's real
  // Fold ID (patient.memberId) instead of a made-up plan number.
  health_plan_id: null,
  health_plan_desc: 'SCAN Insurance Handler',
  consent_given: 2,
  consent_total: 4,
  acuity: 'High-Risk',
  raf_score: 4.234,
  raf_change: 0.5,
  next_appointment_date: '07/23/2025',
  last_contact_type: 'UTR',
  last_contact_days: 45,
  programs: ['AWV', 'HIU'],
  patient_type: 'New Patient',
  condition_tags: ['Diabetes', 'Hypertension', 'Needs Transportation'],

  // Expanded: Demographics
  location: 'Los Angeles, CA',
  location_count: 2,
  languages: ['English', 'Chinese'],
  language_preference: 'English',
  emails: ['annetteBrave09@email.com'],
  plan_numbers_primary: ['(123) 456-7890', '(234) 567-8901'],
  plan_numbers_secondary: ['(456) 789-0123', '(345) 678-9012'],

  // Expanded: Health Status
  chronic_conditions: ['Diabetes Type 1', 'Hypertension'],
  recent_vitals: { date: '05/02/25', bp: '138/85 mmHg', weight: '165 lbs', pulse: '78 bpm', hba1c: '7.2%' },
  opted_out_comms: ['(581) 824-7666 (Call)', '(581) 824-7667 (Call)'],

  // Expanded: Family & Caregiver
  family_caregiver_count: 2,
  family_members: [
    { name: 'John Lane', relation: 'Brother', initials: 'JL' },
    { name: 'Nina Rogers', relation: 'Sister (Caregiver)', initials: 'NR' },
  ],
  care_team: [
    { name: 'Katy Moss', role: 'Plan PCP', title: 'Physician', initials: 'KM' },
    { name: 'Willie Murazik', role: '', title: 'Business/Practice Owner', initials: 'WM' },
  ],
  care_team_profile_type: 'Central Profile',

  // Insurance profiles for dropdown
  insurance_profiles: [
    { id: 'central', name: 'Central Profile', subtitle: 'Athena ID: 939393939393', selected: true },
    { id: 'fold', name: 'FoldHealth', subtitle: 'Member ID: 939393939393', enrolledOn: '02/01/2025', insurance: 'LOB008', hpCode: 'MOLS', hpDesc: 'SCAN Insurance Handler' },
    { id: 'ccpp', name: 'CCPP Health', subtitle: 'Member ID: 939393939393', enrolledOn: '02/01/2025', insurance: 'LOB008', hpCode: 'MOLS', hpDesc: 'SCAN Insurance Handler' },
  ],

  // Expanded: Upcoming Appointments (shown in banner)
  upcoming_appointments: [
    { type: 'Care Plan Review', date: '09/11/2024', time: '9:30 AM', program: 'HIU', provider: 'Ivy Ralph' },
    { type: 'Follow up', date: '09/15/2024', time: '12:30 PM', program: 'TCM', provider: 'Dr. Robert' },
    { type: 'Follow up', date: '10/15/2024', time: '', program: 'SDoH', provider: 'Dr. Dom' },
  ],
};
