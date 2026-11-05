/**
 * Recall / piping: interpolate `{{…}}` tokens in titles, descriptions, and
 * screen copy with live answers, scores, and hidden-field values.
 *
 *   {{field:linkId}}   → the respondent's answer to that field
 *   {{hidden:name}}    → a hidden / URL-parameter value
 *   {{score:scoreId}}  → a computed score value   (alias: {{var:scoreId}})
 *
 * Pure. Unknown / unanswered tokens resolve to an empty string (Typeform
 * behavior), so partially-filled forms never show raw `{{…}}`.
 */
const TOKEN = /\{\{\s*(field|hidden|score|var)\s*:\s*([a-zA-Z0-9_-]+)\s*\}\}/g;

function display(v) {
  if (v == null || v === '') return '';
  if (Array.isArray(v)) return v.filter((x) => x != null && x !== '').join(', ');
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}

/** True if `text` contains at least one recall token (cheap pre-check). */
export function hasRecall(text) {
  return typeof text === 'string' && text.indexOf('{{') !== -1;
}

/**
 * @param {string} text
 * @param {{answers?:object, scores?:object, hidden?:object}} ctx
 *   answers: linkId→value · scores: scoreId→value · hidden: name→value
 */
export function resolveRecall(text, ctx = {}) {
  if (!hasRecall(text)) return text;
  const { answers = {}, scores = {}, hidden = {} } = ctx;
  return text.replace(TOKEN, (_m, kind, key) => {
    let v;
    if (kind === 'field') v = answers[key];
    else if (kind === 'hidden') v = hidden[key] != null ? hidden[key] : answers[key];
    else v = scores[key]; // score | var
    return display(v);
  });
}
