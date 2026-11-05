// Reference lookups, one function (see _lib/dispatch.js):
// /api/icd-search, /api/reference/immunizations,
// /api/reference/allergies/substances, and /api/patient-media-url (the
// patient page's chat attachments; here because the plan caps functions).
import { dispatch } from './_lib/dispatch.js';
import icdSearch from './_handlers/icd-search.js';
import immunizations from './_handlers/immunizations.js';
import allergySubstances from './_handlers/allergy-substances.js';
import patientMediaUrl from './_handlers/patient-media-url.js';

export default dispatch(
  { 'icd-search': icdSearch, immunizations, 'allergy-substances': allergySubstances, 'patient-media-url': patientMediaUrl },
  {
    '/api/icd-search': 'icd-search',
    '/api/reference/immunizations': 'immunizations',
    '/api/reference/allergies/substances': 'allergy-substances',
    '/api/patient-media-url': 'patient-media-url',
  },
);
