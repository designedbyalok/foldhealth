/**
 * Pure aggregation helpers for the form Analytics tab (Insight / Report /
 * Responses). No React. Operate on the saved field tree + the list of
 * form_responses rows returned by `fetchFormResponses`.
 *
 * A response row: { id, answers:{linkId:value}, scores:{scores:[{id,value,band}], criticalsTriggered:[]}, createdAt, submittedByName }
 */
import { isAnswered } from '../scoring/util';
import { isNpsField, npsScore } from '../builder/rating';

/** Split raw responses into completed submissions and in-progress (Pending) fills. */
export function splitByStatus(responses) {
  const completed = (responses || []).filter((r) => r.status !== 'in_progress');
  const pending = (responses || []).filter((r) => r.status === 'in_progress');
  return { completed, pending };
}

/** Drop-off = started-but-not-completed / started. */
export function dropOffStats(completed, pending) {
  const c = completed.length;
  const p = pending.length;
  const started = c + p;
  return { completed: c, pending: p, started, dropOffRate: started ? Math.round((p / started) * 100) : 0 };
}

/** Flatten the field tree to answerable, non-display leaves. */
export function leafFields(fields) {
  const out = [];
  const walk = (list) => (list || []).forEach((f) => {
    if (f.items) walk(f.items);
    else if (f.type !== 'display') out.push(f);
  });
  walk(fields);
  return out;
}

const present = (v) => isAnswered(v);

/**
 * Per-question drop-off (migration-free, derived from partial answers).
 * For each leaf in base order: `reached` = responses that got at least to it
 * (answered the previous question), `dropped` = in-progress responses whose
 * first unanswered question is this one (their bail point). Drop-off is
 * dropped / reached. Branching is approximated via base order (v1).
 */
export function perQuestionDropoff(fields, completed, pending) {
  const leaves = leafFields(fields);
  const furthest = (r) => {
    let mx = -1;
    leaves.forEach((f, i) => { if (present(r.answers?.[f.linkId])) mx = Math.max(mx, i); });
    return mx;
  };
  const completedFurthest = completed.map(furthest);
  const pendingFurthest = pending.map(furthest);
  return leaves.map((f, i) => {
    let reached = 0;
    let dropped = 0;
    completedFurthest.forEach((fu) => { if (fu >= i - 1) reached += 1; });
    pendingFurthest.forEach((fu) => { if (fu >= i - 1) reached += 1; if (fu + 1 === i) dropped += 1; });
    return { linkId: f.linkId, text: f.text, reached, dropped, dropOff: reached ? Math.round((dropped / reached) * 100) : 0 };
  });
}

/**
 * Completion breakdown across all responses.
 * Responded = every leaf answered; In Progress = some but not all; Not Started =
 * none. completionRate is the average answered-ratio across responses.
 */
export function completionStats(fields, responses) {
  const leaves = leafFields(fields);
  const total = responses.length;
  let responded = 0;
  let inProgress = 0;
  let notStarted = 0;
  let ratioSum = 0;

  responses.forEach((r) => {
    const answeredLeaves = leaves.filter((f) => present(r.answers?.[f.linkId])).length;
    ratioSum += leaves.length ? answeredLeaves / leaves.length : 0;
    if (answeredLeaves === 0) notStarted += 1;
    else if (answeredLeaves === leaves.length) responded += 1;
    else inProgress += 1;
  });

  const completionRate = total ? Math.round((ratioSum / total) * 100) : 0;
  return { responded, inProgress, notStarted, total, completionRate, questionCount: leaves.length };
}

/** What kind of breakdown a field gets in the question-wise Report. */
export function questionKind(field) {
  if (isNpsField(field)) return 'nps';
  if (field.type === 'choice') return 'choice';
  if (field.type === 'integer' || field.type === 'decimal') return 'numeric';
  return 'text';
}

const mode = (counts) => {
  let best = null;
  let bestN = -1;
  counts.forEach((c) => { if (c.count > bestN) { bestN = c.count; best = c; } });
  return best;
};

/**
 * Per-question statistics for the Report view.
 * @returns {{answeredCount,total,kind,distribution?,values?,answers?,mostVoted?,average?}}
 */
export function questionStats(field, responses) {
  const total = responses.length;
  const raw = [];
  for (const r of responses) {
    const v = r.answers?.[field.linkId];
    if (present(v)) raw.push(v);
  }
  const answeredCount = raw.length;
  const kind = questionKind(field);

  if (kind === 'nps') {
    // Every point 0–10 in order, so the bar chart shows the gaps too.
    const distribution = (field.options || []).map((o) => ({
      label: o.value,
      count: raw.filter((v) => v === o.value).length,
    }));
    const points = raw.map(Number).filter(Number.isFinite);
    return { answeredCount, total, kind, distribution, nps: npsScore(points) };
  }

  if (kind === 'choice') {
    const opts = field.options || [];
    const distribution = opts.map((o) => ({
      label: o.value,
      count: raw.filter((v) => (Array.isArray(v) ? v.includes(o.value) : v === o.value)).length,
    }));
    return { answeredCount, total, kind, distribution, mostVoted: mode(distribution) };
  }

  if (kind === 'numeric') {
    const nums = [];
    for (const v of raw) {
      const n = Number(v);
      if (Number.isFinite(n)) nums.push(n);
    }
    const byVal = new Map();
    nums.forEach((n) => byVal.set(n, (byVal.get(n) || 0) + 1));
    const distribution = [...byVal.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([label, count]) => ({ label: String(label), value: label, count }));
    const average = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
    return { answeredCount, total, kind, distribution, mostVoted: mode(distribution), average };
  }

  return { answeredCount, total, kind, answers: raw.map(String) };
}

/** Mean of a score across responses + its interpretation band. */
export function scoreGroupStats(scoring, responses) {
  const defs = scoring?.scores || [];
  return defs.map((def) => {
    const vals = [];
    for (const r of responses) {
      const v = (r.scores?.scores || []).find((s) => s.id === def.id)?.value;
      if (typeof v === 'number' && Number.isFinite(v)) vals.push(v);
    }
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    const band = avg == null ? null
      : (def.interpretations || []).find((b) => avg >= b.min && avg <= b.max) || null;
    return { id: def.id, label: def.label, average: avg, count: vals.length, band };
  });
}

/** Month label like "Mar 23" from an ISO timestamp. */
function monthKey(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return { key: `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`, label: d.toLocaleString('en-US', { month: 'short', year: '2-digit' }), order: d.getFullYear() * 12 + d.getMonth() };
}

/** Average value of the primary score per month, for the Insight line chart. */
export function averageScoreSeries(scoring, responses) {
  const primary = (scoring?.scores || [])[0];
  if (!primary) return [];
  const buckets = new Map();
  responses.forEach((r) => {
    const v = (r.scores?.scores || []).find((s) => s.id === primary.id)?.value;
    if (typeof v !== 'number' || !Number.isFinite(v)) return;
    const mk = monthKey(r.createdAt);
    if (!mk) return;
    if (!buckets.has(mk.key)) buckets.set(mk.key, { label: mk.label, order: mk.order, sum: 0, n: 0 });
    const b = buckets.get(mk.key);
    b.sum += v;
    b.n += 1;
  });
  return [...buckets.values()]
    .sort((a, b) => a.order - b.order)
    .map((b) => ({ month: b.label, value: Math.round((b.sum / b.n) * 10) / 10 }));
}

/** An NPS as shown: signed, e.g. "+40", "-15", "0"; "-" with no answers. */
export function formatNps(score) {
  if (score == null) return '-';
  return score > 0 ? `+${score}` : String(score);
}

/** Display string for the "Avg." column in the Responses detail. */
export function answerAverage(field, responses) {
  const stats = questionStats(field, responses);
  if (stats.kind === 'nps') return formatNps(stats.nps.score);
  if (stats.kind === 'numeric') return stats.average == null ? '-' : `~${Math.round(stats.average)}`;
  if (stats.kind === 'choice') return stats.mostVoted?.count ? stats.mostVoted.label : '-';
  return '-';
}

/** Per-response completion: answered / total leaf counts. */
export function responseCompletion(fields, response) {
  const leaves = leafFields(fields);
  const answered = leaves.filter((f) => present(response.answers?.[f.linkId])).length;
  return { answered, total: leaves.length, notAnswered: leaves.length - answered };
}
