/**
 * Which automations (and templates) send a Content > Emails row. A step uses
 * an email when its `config.templateId` matches the email id. Both the
 * published graph and an unpublished draft count, so deleting an email never
 * silently breaks a draft someone is about to publish.
 */
const usesEmail = (graph, ids) => (graph?.nodes || []).some(n => n.config?.templateId != null && ids.has(String(n.config.templateId)));

const idSet = (emailIds) => new Set((Array.isArray(emailIds) ? emailIds : [emailIds]).filter(v => v != null).map(String));

/** Automations whose graph or draft graph sends any of the given email ids. */
export function automationsUsingEmail(automations, emailIds) {
  const ids = idSet(emailIds);
  if (!ids.size) return [];
  return (automations || []).filter(a => usesEmail(a.graph, ids) || usesEmail(a.draftGraph, ids));
}

/** Templates whose graph sends any of the given email ids. */
export function templatesUsingEmail(templates, emailIds) {
  const ids = idSet(emailIds);
  if (!ids.size) return [];
  return (templates || []).filter(t => usesEmail(t.graph, ids));
}

export const activeCount = (automations) => automations.filter(a => a.status === 'active').length;

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Dialog body: "Deleting this email affects 3 automations, 2 of them active. ..." */
export function usageMessage(automations, emailCount = 1) {
  const n = automations.length;
  const m = activeCount(automations);
  const subject = emailCount > 1 ? 'these emails' : 'this email';
  const active = n === 1 ? (m ? 'and it is active' : 'and it is not active') : `${m} of them active`;
  const them = emailCount > 1 ? 'them' : 'it';
  return `Deleting ${subject} affects ${plural(n, 'automation')}, ${active}. Steps that send ${them} will stop working until you pick another email.`;
}

export const usedByLabel = (n) => `Used by ${plural(n, 'automation')}`;
