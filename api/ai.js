// AI drafting and summaries, one function (see _lib/dispatch.js):
// /api/pop-group-rule-from-nl, /api/care-plan-summary,
// /api/care-plan-template-draft, /api/care-plan-individualized,
// /api/patient-recap-summary, /api/clinical-protocol-parse,
// /api/template-optimization.
import { dispatch } from './_lib/dispatch.js';
import popGroupRuleFromNl from './_handlers/pop-group-rule-from-nl.js';
import carePlanSummary from './_handlers/care-plan-summary.js';
import carePlanTemplateDraft from './_handlers/care-plan-template-draft.js';
import carePlanIndividualized from './_handlers/care-plan-individualized.js';
import patientRecapSummary from './_handlers/patient-recap-summary.js';
import clinicalProtocolParse from './_handlers/clinical-protocol-parse.js';
import templateOptimization from './_handlers/template-optimization.js';

export default dispatch(
  {
    'pop-group-rule-from-nl': popGroupRuleFromNl,
    'care-plan-summary': carePlanSummary,
    'care-plan-template-draft': carePlanTemplateDraft,
    'care-plan-individualized': carePlanIndividualized,
    'patient-recap-summary': patientRecapSummary,
    'clinical-protocol-parse': clinicalProtocolParse,
    'template-optimization': templateOptimization,
  },
  {
    '/api/pop-group-rule-from-nl': 'pop-group-rule-from-nl',
    '/api/care-plan-summary': 'care-plan-summary',
    '/api/care-plan-template-draft': 'care-plan-template-draft',
    '/api/care-plan-individualized': 'care-plan-individualized',
    '/api/patient-recap-summary': 'patient-recap-summary',
    '/api/clinical-protocol-parse': 'clinical-protocol-parse',
    '/api/template-optimization': 'template-optimization',
  },
);
