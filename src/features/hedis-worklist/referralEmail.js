// Draft the Send Referral email. UnityAI (/api/referral-email, a server-side
// Gemini proxy) writes it; when that isn't reachable (no key in local dev,
// outage) the same details fill a plain template so Generate always works.

function templateDraft(d) {
  const who = d.providerName ? `Dear ${d.providerName},` : 'Hello,';
  const demo = [d.patientAge, d.patientSex].filter(Boolean).join(', ');
  const patient = demo ? `${d.patientName} (${demo})` : d.patientName;
  const files = (d.attachments || []).length
    ? `I've attached ${d.attachments.join(', ')} for your review.`
    : '';
  return {
    subject: d.gap ? `Patient referral: ${d.gap}` : 'Patient referral',
    body: [
      who,
      '',
      `I'm referring our patient ${patient}${d.providerSpecialty ? ` for ${d.providerSpecialty.toLowerCase()} evaluation` : ''}${d.gap ? ` related to ${d.gap}` : ''}.${d.reason?.trim() ? ` ${d.reason.trim()}` : ''}`,
      '',
      [files, 'Please let us know once the patient is scheduled, and send your findings back to our office.'].filter(Boolean).join(' '),
      '',
      'Thank you,',
    ].join('\n'),
  };
}

/** @returns {Promise<{ subject: string, body: string, source: 'ai'|'template' }>} */
export async function draftReferralEmail(details) {
  try {
    const res = await fetch('/api/referral-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(details),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.email?.body) return { ...json.email, source: 'ai' };
  } catch { /* fall through to the template */ }
  return { ...templateDraft(details), source: 'template' };
}
