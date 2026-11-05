// Patient referrals (supabase/patient_referrals_migration.sql): the Orders &
// Referrals tab's Referral view. The sample rows match Figma P360 Revamp
// 54:34442; scripts/seed.js seeds them for the demo patient and the store
// shows them while the table is missing.

export const REFERRAL_STATUSES = ['Signed & Referred', 'Draft', 'Completed'];

const SAMPLE_ATTACHMENT = { name: 'Referral_Letter.pdf', type: 'application/pdf', url: '/charts/progress-note.pdf' };

// [referredBy, referredBySpecialty, referredTo, referredToSpecialty, status, createdAt]
const SAMPLE = [
  ['Dr. JeDee Potter, GP', 'General Practitioner', 'Dr. Leo Alexander', 'Neurologist', 'Signed & Referred', '2024-11-11T11:45:00'],
  ['Dr. Ava Reynolds, DO', 'General Practice Expert', 'Dr. Noah Bennett', 'Child Health Specialist', 'Draft', '2024-11-11T11:45:00'],
  ['Dr. Mia Thompson, MD', 'Family Medicine Specialist', 'Dr. Ethan Carter', 'Pediatrician', 'Completed', '2025-12-12T14:30:00'],
  ['Dr. Sarah Lee, MD', 'Internal Medicine Physician', 'Dr. Noah Kim', 'Cardiologist', 'Completed', '2025-01-01T09:00:00'],
  ['Dr. Olivia Brown, MD', 'Orthopedic Surgeon', 'Dr. Lucas White', 'Dermatologist', 'Completed', '2025-02-02T15:15:00'],
  ['Dr. Ava Green, MD', 'Obstetrician/Gynecologist', 'Dr. Mason Hall', 'Endocrinologist', 'Completed', '2025-03-03T13:45:00'],
  ['Dr. Isabella Scott, MD', 'Gastroenterologist', 'Dr. James Wilson', 'Urologist', 'Completed', '2025-04-04T10:00:00'],
  ['Dr. Charlotte Adams, MD', 'Rheumatologist', 'Dr. Benjamin Clark', 'Hematologist', 'Completed', '2025-05-05T16:30:00'],
  ['Dr. Amelia Turner, MD', 'Psychiatrist', 'Dr. William Young', 'Oncologist', 'Completed', '2025-06-06T11:00:00'],
];

export function sampleReferralsFor(patientId) {
  return SAMPLE.map(([byName, bySpecialty, toName, toSpecialty, status, createdAt], i) => ({
    id: `ref-${patientId}-${i + 1}`,
    patientId: String(patientId),
    referredByName: byName,
    referredBySpecialty: bySpecialty,
    referredToName: toName,
    referredToSpecialty: toSpecialty,
    status,
    reason: '',
    priority: 'Routine',
    note: '',
    attachments: [SAMPLE_ATTACHMENT],
    createdAt: new Date(createdAt).toISOString(),
  }));
}

export const referralToRow = (r) => ({
  id: r.id,
  patient_id: r.patientId,
  referred_by_name: r.referredByName,
  referred_by_specialty: r.referredBySpecialty || null,
  referred_to_name: r.referredToName,
  referred_to_specialty: r.referredToSpecialty || null,
  status: r.status,
  reason: r.reason || null,
  priority: r.priority || 'Routine',
  note: r.note || null,
  attachments: r.attachments || [],
  created_at: r.createdAt,
});

export const rowToReferral = (r) => ({
  id: r.id,
  patientId: r.patient_id,
  referredByName: r.referred_by_name || '',
  referredBySpecialty: r.referred_by_specialty || '',
  referredToName: r.referred_to_name || '',
  referredToSpecialty: r.referred_to_specialty || '',
  status: r.status || 'Draft',
  reason: r.reason || '',
  priority: r.priority || 'Routine',
  note: r.note || '',
  attachments: Array.isArray(r.attachments) ? r.attachments : [],
  createdAt: r.created_at,
});
