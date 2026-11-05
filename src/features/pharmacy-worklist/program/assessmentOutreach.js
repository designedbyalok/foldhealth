// How an Assessment and the outreach it belongs to share what they know: the
// outreach's call details fill the Assessment's Contact Details, and a saved
// Assessment's summary goes into the outreach note.

// Outreach "Call Type" (who was called) → the schema's stakeholder, and back.
const STAKEHOLDER_FOR_CALL_TYPE = {
  Pharmacy: 'Pharmacy', Prescriber: 'Provider Office', Provider: 'Provider Office',
  Patient: 'Member', Caregiver: 'Caregiver', Family: 'Caregiver',
};
const CALL_TYPE_FOR_STAKEHOLDER = {
  Pharmacy: 'Pharmacy', 'Provider Office': 'Prescriber', Member: 'Patient', Caregiver: 'Caregiver',
};
export const callTypeForStakeholder = (stakeholder) => CALL_TYPE_FOR_STAKEHOLDER[stakeholder] || null;

// "Dr. Grace Lin (626 555-0188)" → "Dr. Grace Lin".
export const nameFromRecipient = (s) => (s || '').replace(/\s*\([^)]*\)\s*$/, '').trim();

// What a call outreach says about the call, in the Assessment's terms.
// `call`: { callType, direction: 'outgoing' | 'incoming', calledTo }.
export function assessmentCallDetails(call) {
  if (!call) return null;
  return {
    stakeholder: STAKEHOLDER_FOR_CALL_TYPE[call.callType] || null,
    contact: nameFromRecipient(call.calledTo) || null,
    direction: call.direction === 'incoming' ? 'Inbound' : 'Outbound',
  };
}

// A saved Assessment as a few lines for the outreach note: who was contacted
// and how, what was ticked per gap, and the call note.
export function assessmentSummary(call) {
  const how = [call.action, call.direction].filter(Boolean).join(', ');
  const reached = !call.contactOutcome || call.contactOutcome === 'Reached' ? 'reached' : call.contactOutcome;
  const head = `Assessment with ${call.party || 'Pharmacy'}: ${call.contact}${how ? ` (${how})` : ''}, ${reached}.`;
  const picks = Object.entries(call.outcomes || {})
    .filter(([, labels]) => labels?.length)
    .map(([code, labels]) => `${code}: ${labels.join(', ')}`);
  // Assessments saved before the schema form kept per-drug answers instead.
  if (!picks.length) picks.push(...(call.items || []).map(it => `${it.measure} ${it.drug}: ${(it.steps || []).join(', ')}`));
  return [head, ...picks, call.note ? `Note: ${call.note}` : null].filter(Boolean).join('\n');
}
