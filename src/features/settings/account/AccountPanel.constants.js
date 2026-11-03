export const HCC_ROLES = ['Support', 'Coder', 'QA', 'Compliance'];

export const ROLE_COLORS = {
  'Support':                       'warning',
  'Coder':                         'primary',
  'QA':                            'success',
  'Compliance':                    'warning',
  'Physician/Doctor':              'primary', 'Nurse': 'info', 'Medical Assistant': 'info',
  'Admin/Practice Manager':        'primary', 'Billing Specialist': 'warning',
  'Front Desk Staff/Receptionist': 'neutral', 'Lab Technician': 'warning',
  'Pharmacist':                    'success', 'Health Information Manager (HIM)': 'primary',
  'Radiologist':                   'info', 'Phlebotomist': 'warning', 'Patient': 'neutral',
};

export function getInitials(name) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] || '') + (parts[parts.length - 1]?.[0] || '');
}
