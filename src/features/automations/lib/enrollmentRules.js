/* Automations triggered by care program enrollment, read back as the rules
   clinicalCriteria.js evaluates (the shape Settings > Automation Rules used).
   The migration turned each automation_rules row into one of these:
   trigger (programCodes) → clinical criteria → attach care plan templates. */

import { getNode } from './graph';

export function enrollmentRulesOf(automations) {
  return (automations || [])
    .filter(a => a.status === 'active' && getNode(a.graph, 'trigger')?.type === 'careProgramEnrolled')
    .map(a => {
      const nodes = a.graph.nodes;
      const criteria = nodes.find(n => n.type === 'clinicalCriteria');
      const attach = nodes.find(n => n.type === 'attachCarePlan');
      return {
        id: a.id,
        name: a.name,
        enabled: true,
        programCodes: getNode(a.graph, 'trigger')?.config?.programCodes || [],
        match: criteria?.config?.match === 'any' ? 'any' : 'all',
        conditions: criteria?.config?.criteria || [],
        templateIds: attach?.config?.templateIds || [],
        reviewer: attach?.config?.reviewer?.name ? attach.config.reviewer : null,
        criteriaNodeId: criteria?.id || null,
        attachNodeId: attach?.id || null,
      };
    });
}
