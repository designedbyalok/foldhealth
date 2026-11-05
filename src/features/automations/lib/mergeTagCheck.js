/* Merge tags an email uses that the merge-tag engine can't resolve (the
   Figma's "Dr. Name merge tag is not found in your system"). A tag counts as
   unknown when applyMergeTags leaves it untouched. */

import { applyMergeTags, SAMPLE_CONTEXT } from '../../email-builder/mergeTags';

const TAG_RE = /\{\{\s*[^{}]+?\s*\}\}|\{\s*[A-Za-z][A-Za-z0-9 _'/&.-]*?\s*\}|\[[A-Z][A-Za-z ./&-]*?\]/g;

/** ['Dr. Name', 'Clinic/Hospital Name'] for every unresolvable tag in the texts. */
export function unknownMergeTags(...texts) {
  const out = new Set();
  for (const text of texts) {
    if (typeof text !== 'string') continue;
    for (const m of text.match(TAG_RE) || []) {
      // Square-bracket placeholders ([Date]) are never tokens: always flag them.
      const bracket = m.startsWith('[');
      if (bracket || applyMergeTags(m, SAMPLE_CONTEXT) === m) out.add(m.replace(/^[{[]+\s*|\s*[}\]]+$/g, ''));
    }
  }
  return [...out];
}
