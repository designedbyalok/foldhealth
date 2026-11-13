/* Section 1557 (45 CFR 92.201): a patient who needs an interpreter is offered
   a qualified one; an adult family member interprets only when the patient
   asks for it after that offer, and the choice is documented. */

/**
 * Where a patient's interpreter offer stands, from their preferences, or null
 * when they don't need an interpreter.
 *   tone  'warning' (not offered yet) | 'success' (qualified) | 'neutral' (patient's own choice)
 *   label the full line (banner tooltip, call header)
 *   short the chip text
 */
export function interpreterStatus(prefs) {
  if (!prefs?.needsInterpreter) return null;
  const language = prefs.preferredLanguage || 'Interpreter';
  const offer = prefs.interpreterOffer;
  if (offer?.status === 'qualified') {
    return { tone: 'success', short: `${language} · Qualified interpreter`, label: `${language}: qualified interpreter, offered and accepted` };
  }
  if (offer?.status === 'declined') {
    const who = [offer.name, offer.relationship && `(${offer.relationship.toLowerCase()})`].filter(Boolean).join(' ') || 'a family member';
    return { tone: 'neutral', short: `${language} · ${offer.name || 'Family'} at patient's request`, label: `${language}: qualified interpreter offered and declined; ${who} interprets at the patient's request` };
  }
  return { tone: 'warning', short: `${language} · Interpreter not offered`, label: `${language}: offer a qualified interpreter and record the patient's choice` };
}

/** The interpreter_offer record to save. */
export function offerRecord({ status, language, name = '', relationship = '', recordedBy, now = new Date() }) {
  return {
    status,
    language: language || null,
    ...(status === 'declined' ? { name: name.trim(), relationship: relationship.trim() } : {}),
    recordedBy: recordedBy || null,
    recordedAt: now.toISOString(),
  };
}
