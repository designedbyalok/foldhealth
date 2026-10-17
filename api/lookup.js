// Reference lookups, one function (see _lib/dispatch.js):
// /api/icd-search, /api/reference/immunizations,
// /api/reference/allergies/substances.
import { dispatch } from './_lib/dispatch.js';
import icdSearch from './_handlers/icd-search.js';
import immunizations from './_handlers/immunizations.js';
import allergySubstances from './_handlers/allergy-substances.js';

export default dispatch(
  { 'icd-search': icdSearch, immunizations, 'allergy-substances': allergySubstances },
  {
    '/api/icd-search': 'icd-search',
    '/api/reference/immunizations': 'immunizations',
    '/api/reference/allergies/substances': 'allergy-substances',
  },
);
