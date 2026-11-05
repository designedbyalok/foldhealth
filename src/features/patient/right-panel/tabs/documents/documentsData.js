// Patient Documents tab (Figma P360 Revamp 238:47081). Documents live in
// `program_documents`: patient-level rows have no program_code and carry a
// `category` (supabase/program_documents_category_migration.sql).

export const ALL_CATEGORY = 'all';

export const DOC_CATEGORIES = [
  { key: ALL_CATEGORY, label: 'All Documents', icon: 'solar:folder-linear' },
  { key: 'imaging', label: 'Imaging Reports', icon: 'custom:imaging' },
  { key: 'lab', label: 'Lab Reports', icon: 'solar:test-tube-minimalistic-linear' },
  { key: 'physical_therapy', label: 'Physical Therapy', icon: 'solar:document-medicine-linear' },
  { key: 'health_assessment', label: 'Health Assessments', icon: 'solar:medical-kit-linear' },
  { key: 'referral', label: 'Referrals', icon: 'solar:forward-linear' },
  { key: 'report', label: 'Reports', icon: 'solar:file-linear' },
  { key: 'form', label: 'Forms', icon: 'solar:document-add-linear' },
  { key: 'personal_id', label: 'Personal Ids', icon: 'solar:user-id-linear' },
  // What backs a decision maker (Add Family, Caregivers & Decision Makers).
  { key: 'legal_authority', label: 'Legal Authority', icon: 'solar:document-text-linear' },
  { key: 'other', label: 'Others', icon: 'solar:layers-linear' },
];

export const UPLOAD_CATEGORIES = DOC_CATEGORIES.filter(c => c.key !== ALL_CATEGORY);

/** The built-in folders with custom ones ({ key, name }) added just above Others. */
export function withCustomCategories(custom = []) {
  const extra = custom.map(c => ({ key: c.key, label: c.name, icon: 'solar:folder-2-linear' }));
  const others = DOC_CATEGORIES[DOC_CATEGORIES.length - 1];
  return [...DOC_CATEGORIES.slice(0, -1), ...extra, others];
}

export const FILE_TYPES = [
  'Assessment', 'Authorization', 'Consent', 'FaceSheet', 'Form', 'ID Card',
  'Imaging', 'Insurance Card', 'Lab Result', 'Legal Authority', 'Referral', 'Report', 'Other',
];

// Rows from program steps have no category; place them by their file type.
const CATEGORY_BY_TYPE = {
  Imaging: 'imaging',
  'Lab Report': 'lab',
  'Lab Result': 'lab',
  'Physical Therapy': 'physical_therapy',
  Assessment: 'health_assessment',
  Referral: 'referral',
  Authorization: 'referral',
  Report: 'report',
  'Discharge Summary': 'report',
  'Consult Note': 'report',
  Form: 'form',
  Consent: 'form',
  'ID Card': 'personal_id',
  'Insurance Card': 'personal_id',
  'Legal Authority': 'legal_authority',
};

export const categoryOf = doc => doc.category || CATEGORY_BY_TYPE[doc.type] || 'other';

export const DOCUMENTS_DEMO_PATIENT = '11089';

const sample = (id, name, type, category, fileUrl) => ({
  id,
  programCode: null,
  patientId: DOCUMENTS_DEMO_PATIENT,
  name,
  type,
  category,
  updatedBy: 'Dr Aldo Richman',
  updatedDate: '02/19/2024',
  fileUrl,
  ext: 'pdf',
});

/** Annette Brave's documents, matching the Figma sample list. */
export const SAMPLE_PATIENT_DOCUMENTS = [
  sample('pdoc-11089-1', 'AnnetteBrave_20250415_awv_patient_summary.pdf', 'Form', 'form', '/charts/progress-note.pdf'),
  sample('pdoc-11089-2', 'AnnetteBrave_20250315_BRSCI.pdf', 'Assessment', 'health_assessment', '/charts/progress-note.pdf'),
  sample('pdoc-11089-3', 'AnnetteBrave_20250415_HRA_SCAN_Rev1.pdf', 'Form', 'health_assessment', '/charts/progress-note.pdf'),
  sample('pdoc-11089-4', 'AnnetteBrave_20250415_ICP2.pdf', 'Imaging', 'imaging', '/charts/radiology-report.pdf'),
  sample('pdoc-11089-5', 'AnnetteBrave_20250205_DC_StXever.pdf', 'Report', 'report', '/charts/progress-note.pdf'),
  sample('pdoc-11089-6', 'AnnetteBrave_20250205_FS_StXever.pdf', 'FaceSheet', 'other', '/charts/progress-note.pdf'),
  sample('pdoc-11089-7', 'AnnetteBrave_20250205_Auth_StXever.pdf', 'Authorization', 'referral', '/charts/progress-note.pdf'),
  sample('pdoc-11089-8', 'AnnetteBrave_20250205_AWVHRA.pdf', 'Form', 'form', '/charts/laboratory-report.pdf'),
];

export const patientDocumentToRow = d => ({
  id: d.id,
  program_code: d.programCode,
  patient_id: d.patientId,
  name: d.name,
  type: d.type,
  category: d.category,
  updated_by: d.updatedBy,
  updated_date: d.updatedDate,
  file_url: d.fileUrl,
  ext: d.ext,
});
