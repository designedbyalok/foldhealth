// Barrier / intervention / result picklists for Med Adherence (MAC/MAD/MAH).
// Seeded from Arine's "Steps Performed" checklist, split into the three kinds
// the team asked to keep apart (barrier ≠ what was done ≠ result). The final
// Fold lists are still pending Monique's outreach-log document.

export const BARRIERS = [
  'Cost Issue',
  'Forgetfulness',
  'Lack of Understanding',
  'Refused to Refill',
  'Side Effects',
  'Transportation',
  'Insurance Coverage',
];

export const INTERVENTIONS = [
  '90/100-day conversion',
  'Autofill Set-Up',
  'Pill Box Sent',
  'CPA Approved for Max DS + Refills',
  'Refill from Manufacturer/Program Assistance',
  'Schedule MD Appointment/Labs',
  'UTC Letter Mailed',
];

// Same icons as the care plan (its tables and History), so a barrier or an
// intervention reads the same wherever it shows.
export const BARRIER_ICON = 'custom:barrier';
export const INTERVENTION_ICON = 'solar:checklist-minimalistic-linear';

// The barrier(s) each intervention addresses. Marking it Done offers to
// resolve them too (still to confirm against Monique's outreach-log list).
export const INTERVENTION_ADDRESSES = {
  '90/100-day conversion': ['Transportation'],
  'Autofill Set-Up': ['Forgetfulness'],
  'Pill Box Sent': ['Forgetfulness'],
  'CPA Approved for Max DS + Refills': ['Cost Issue'],
  'Refill from Manufacturer/Program Assistance': ['Cost Issue'],
  'Schedule MD Appointment/Labs': ['Side Effects'],
  'UTC Letter Mailed': [],
};

export const MEASURE_RESULTS = [
  'Rx Pick Up Confirmed',
  'Rx Pick Up Pending',
  'Pending Refill Approval',
  'Refill Too Soon',
  'Rx Changed/Discontinued by MD or Member',
  'Pending Pharmacist Review',
];
