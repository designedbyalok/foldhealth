import { normalizeAiRuleQuery } from './normalizeAiRuleQuery';
import { apiFetch } from '../../../lib/apiFetch';

/**
 * @param {{ prompt: string, messages?: { role: string, content: string }[], currentRule?: object }} params
 * @returns {Promise<{ rule: object, summary: string }>}
 */
export async function fetchRuleFromNaturalLanguage({ prompt, messages, currentRule }) {
  const res = await apiFetch('/api/pop-group-rule-from-nl', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, messages, currentRule }),
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    throw new Error(res.status === 404
      ? 'Rule assistant API is unavailable. Redeploy or run the app with bun run dev.'
      : `Could not generate a rule (${res.status}). Please try again.`);
  }
  if (!res.ok) {
    const msg = data?.error?.message || `Could not generate a rule (${res.status}). Please try again.`;
    const err = new Error(msg);
    err.details = data?.error?.details;
    throw err;
  }
  const { query, errors } = normalizeAiRuleQuery(data.rule);
  if (!query) {
    const err = new Error(errors[0] || 'Generated rule was invalid.');
    err.details = errors;
    throw err;
  }
  return { rule: query, summary: data.summary || '' };
}
