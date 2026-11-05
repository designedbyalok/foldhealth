/**
 * Outreach status for worklist Outreach columns (Figma SNP-Story 8602:333343).
 * Every worklist stores outreach differently; these turn each shape into
 * `{ type, result, date, attempts }` for <OutreachStatus>.
 *
 *   type      'call' | 'in-person' | 'video' | 'sms' | 'app' | 'email' | 'letter'
 *   result    'success' | 'failed' | 'followup' | 'removed' | null (no outreach yet)
 *   attempts  1 to 3: how many attempt dots are used
 */

const MAX_ATTEMPTS = 3;
const clampAttempts = n => Math.max(1, Math.min(MAX_ATTEMPTS, n || 1));

// Dot arrays as stored: 'success' / 'blue' = reached, 'failed' / 'red' = not reached.
const isSuccessDot = d => d === 'success' || d === 'blue';
const isFailedDot = d => d === 'failed' || d === 'red';

/** TOC / TCM / HEDIS: a dots array, an outreach date and maybe an `attended` flag. */
export function outreachFromDots(dots, { date = null, attended = false, type = 'call' } = {}) {
  const list = Array.isArray(dots) ? dots : [];
  const used = list.filter(d => isSuccessDot(d) || isFailedDot(d)).length;
  if (!used && !attended) return { type, result: null, date: null, attempts: 0 };
  const result = attended || list.some(isSuccessDot) ? 'success' : 'failed';
  return { type, result, date, attempts: clampAttempts(used) };
}

/** Annual Visit / JSA / CMP: an attempt count, the program sub status and the last outreach date. */
export function outreachFromCount(count, subStatus, date, type = 'call') {
  if (!count) return { type, result: null, date: null, attempts: 0 };
  const s = String(subStatus || '').toLowerCase();
  const result = s === 'engaged' ? 'success'
    : s.includes('unable') ? 'failed'
      : 'followup';
  return { type, result, date, attempts: clampAttempts(count) };
}

/** SNP: `{ kind, status, date, dots }`, or null. */
export function outreachFromSummary(outreach) {
  if (!outreach) return { type: 'call', result: null, date: null, attempts: 0 };
  const type = outreach.kind === 'letter' ? 'letter' : (outreach.kind || 'call');
  const s = String(outreach.status || '').toLowerCase();
  const result = /attend|success|engag|complete/.test(s) ? 'success'
    : /follow/.test(s) ? 'followup'
      : /remov/.test(s) ? 'removed'
        : 'failed';
  const used = (outreach.dots || []).filter(d => isSuccessDot(d) || isFailedDot(d)).length;
  return { type, result, date: outreach.date || null, attempts: clampAttempts(used) };
}
