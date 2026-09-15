// ── Campaign audience resolution + simulated delivery ─────────────────────
// Resolves a campaign's audienceInclude/Exclude segments to a deduped list of
// real recipients from all_patients, and assigns each a deterministic
// simulated delivery status. No real email is sent to demo patients; the send
// engine (store.sendCampaignNow) writes these to the campaign_sends log and
// rolls the results up into the campaign's delivered/opened stats.

import { supabase } from '../../lib/supabase';

const asText = v => (v == null ? '' : typeof v === 'string' ? v : JSON.stringify(v));

// Predicates keyed by a segment's resolver_key (see audience_segments table).
// Each takes an all_patients row and returns whether the patient is in-segment.
export const SEGMENT_PREDICATES = {
  all: () => true,
  diabetic: p => /diab/i.test(asText(p.chronic_conditions)) || /diab/i.test(asText(p.tags)),
  cardiac: p => /(cardi|heart|chf|hyperten)/i.test(asText(p.chronic_conditions)) || /(cardi|heart|chf|hyperten)/i.test(asText(p.tags)),
  seniors: p => Number(p.age) >= 65,
  pediatric: p => p.age != null && Number(p.age) < 18,
  nj: p => /,\s*NJ\b/i.test(asText(p.location)) || String(p.state || '').toUpperCase() === 'NJ',
  ny: p => /,\s*NY\b/i.test(asText(p.location)) || String(p.state || '').toUpperCase() === 'NY',
};

const SELECT_COLS = 'member_id,id,name,email,age,location,state,chronic_conditions,tags,active_care_program,city,dob,language';

export async function fetchAudiencePool() {
  const { data, error } = await supabase
    .from('all_patients')
    .select(SELECT_COLS)
    .not('email', 'is', null);
  if (error) {
    console.warn('[audience] all_patients fetch failed:', error.message);
    return [];
  }
  return (data || []).filter(p => p.email && p.email.includes('@'));
}

function keyFor(segId, segmentKeyById) {
  return segmentKeyById[segId] || segId;
}

/**
 * Resolve a campaign to a deduped recipient list from all_patients.
 * @param {object} campaign  – must carry audienceInclude / audienceExclude
 * @param {object} opts
 * @param {Array}  [opts.segments] – audience_segments rows ({ id, resolverKey })
 *                                   to map segment ids to predicate keys.
 * @returns {Promise<Array<{memberId, name, email, patient}>>}
 */
export async function resolveCampaignAudience(campaign, { segments } = {}) {
  const pool = await fetchAudiencePool();
  const segmentKeyById = {};
  (segments || []).forEach(s => { segmentKeyById[s.id] = s.resolverKey; });

  const clean = arr => (arr || []).filter(v => v && v !== '__placeholder__');
  const inc = clean(campaign.audienceInclude);
  const exc = clean(campaign.audienceExclude);

  const matches = (p, segId) => {
    const pred = SEGMENT_PREDICATES[keyFor(segId, segmentKeyById)];
    return pred ? pred(p) : false;
  };

  const includesAll = inc.length === 0 || inc.includes('all-patients');
  let list = includesAll ? pool : pool.filter(p => inc.some(s => matches(p, s)));
  if (exc.length) list = list.filter(p => !exc.some(s => matches(p, s)));

  const seen = new Set();
  const out = [];
  for (const p of list) {
    const memberId = p.member_id || p.id;
    if (!memberId || seen.has(memberId)) continue;
    seen.add(memberId);
    out.push({ memberId, name: p.name, email: p.email, patient: p });
  }
  return out;
}

// Deterministic FNV-1a hash so a recipient's simulated status is stable across
// re-runs (the delivery log is idempotent, not randomly flaky each send).
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

const DELIVERED_RATE = 96; // % of recipients whose mail is delivered
const OPEN_RATE = 44;      // % of delivered mail that gets opened

/** Simulated delivery status for one recipient of one campaign. */
export function simulateStatus(campaignId, memberId) {
  // Two independent hashes (different suffixes) so the delivery and open draws
  // are uncorrelated — a single hash's shifted bits skew the open rate.
  const deliveredRoll = hashStr(`${campaignId}:${memberId}:delivered`) % 100;
  const openRoll = hashStr(`${campaignId}:${memberId}:open`) % 100;
  if (deliveredRoll >= DELIVERED_RATE) return 'bounced';
  return openRoll < OPEN_RATE ? 'opened' : 'delivered';
}
