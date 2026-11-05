// Patient lab and imaging orders (supabase/patient_orders_migration.sql): the
// Orders & Referrals tab's Lab and Imaging views. scripts/seed.js seeds the
// sample orders below for the demo patient.

export const ORDER_PRIORITIES = ['Routine', 'Urgent', 'STAT'];
export const ORDER_STATUSES = ['Draft', 'Ordered', 'Completed'];

export const LAB_TESTS = [
  'CBC', 'CMP', 'BMP', 'HbA1c', 'Lipid Panel', 'TSH', 'Urinalysis', 'Vitamin D', 'PSA', 'eGFR', 'UACR',
];
export const IMAGING_STUDIES = [
  'Chest X-Ray', 'CT Head', 'CT Abdomen/Pelvis', 'MRI Brain', 'MRI Spine', 'Ultrasound Abdomen', 'Mammogram', 'DEXA Scan', 'Echocardiogram',
];

export const ORDER_TYPES = {
  lab: { title: 'New Lab Order', fieldLabel: 'Test', options: LAB_TESTS },
  imaging: { title: 'New Imaging Order', fieldLabel: 'Study', options: IMAGING_STUDIES },
};

// [type, name, reason, priority, status, orderedBy, dueDate, createdAt]
const SAMPLE = [
  ['lab', 'HbA1c', 'E11.9 Type 2 diabetes mellitus without complications', 'Routine', 'Completed', 'Dr. JeDee Potter, GP', '2025-08-15', '2025-08-01T10:15:00'],
  ['lab', 'Lipid Panel', 'E78.5 Hyperlipidemia, unspecified', 'Routine', 'Ordered', 'Dr. JeDee Potter, GP', '2025-11-20', '2025-11-04T09:30:00'],
  ['lab', 'UACR', 'Kidney function check for diabetes care', 'Urgent', 'Draft', 'Dr. Ava Reynolds, DO', null, '2025-11-10T14:00:00'],
  ['imaging', 'DEXA Scan', 'Osteoporosis screening', 'Routine', 'Ordered', 'Dr. JeDee Potter, GP', '2025-12-02', '2025-11-05T11:45:00'],
  ['imaging', 'Chest X-Ray', 'R05.9 Cough, unspecified', 'Urgent', 'Completed', 'Dr. Mia Thompson, MD', '2025-06-12', '2025-06-10T16:20:00'],
];

export function sampleOrdersFor(patientId) {
  return SAMPLE.map(([type, name, reason, priority, status, orderedBy, dueDate, createdAt], i) => ({
    id: `00000000-0000-4000-9000-${String(i + 1).padStart(12, '0')}`,
    patientId: String(patientId),
    type,
    name,
    reason,
    priority,
    status,
    orderedBy,
    dueDate,
    notes: '',
    createdAt: new Date(createdAt).toISOString(),
  }));
}

export const orderToRow = (o) => ({
  id: o.id,
  patient_id: o.patientId,
  order_type: o.type,
  name: o.name,
  reason: o.reason || null,
  priority: o.priority || 'Routine',
  status: o.status,
  ordered_by: o.orderedBy || null,
  due_date: o.dueDate || null,
  notes: o.notes || null,
  created_at: o.createdAt,
});

export const rowToOrder = (r) => ({
  id: r.id,
  patientId: r.patient_id,
  type: r.order_type,
  name: r.name || '',
  reason: r.reason || '',
  priority: r.priority || 'Routine',
  status: r.status || 'Draft',
  orderedBy: r.ordered_by || '',
  dueDate: r.due_date || null,
  notes: r.notes || '',
  createdAt: r.created_at,
});
