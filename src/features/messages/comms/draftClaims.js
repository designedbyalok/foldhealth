/* A drafted message to a patient must not say something happened when it
   hasn't. These checks run on the draft against the sender's notes: a
   sentence that says something is booked, confirmed or sent, or names a
   date or time, is flagged unless the notes say the same. */

const DONE_WORDS = ['booked', 'confirmed', 'scheduled', 'arranged', 'sent', 'ordered', 'approved', 'set up', 'all set', 'reserved'];
const DATE_TIME = /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b|\b\d{1,2}(?::\d{2})?\s?(?:am|pm)\b|\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi;

// Paragraphs can arrive joined with no space ("9:45 am.Warm regards"), so a
// capital straight after a full stop also starts a sentence.
const sentences = text => String(text || '').split(/(?<=[.!?])\s+|(?<=[.!?])(?=[A-Z])|\n+/).map(s => s.trim()).filter(Boolean);
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ');

/**
 * Sentences in `body` that state a completed action or a specific date or time
 * the `notes` don't support. Returns [{ sentence, reason }].
 */
export function unsupportedClaims(body, notes) {
  const n = norm(notes);
  // Claim words the notes don't use; a sentence with one of them is unsupported.
  const unbacked = DONE_WORDS.filter(w => !new RegExp(`\\b${w}\\b`).test(n));
  const claimRe = unbacked.length ? new RegExp(`\\b(${unbacked.join('|')})\\b`) : null;
  const out = [];
  for (const sentence of sentences(body)) {
    const hit = claimRe && norm(sentence).match(claimRe);
    if (hit) { out.push({ sentence, reason: `says “${hit[1]}”, but your notes don’t` }); continue; }
    for (const when of sentence.match(DATE_TIME) || []) {
      if (n.indexOf(norm(when)) === -1) { out.push({ sentence, reason: `names ${when}, which isn’t in your notes` }); break; }
    }
  }
  return out;
}
