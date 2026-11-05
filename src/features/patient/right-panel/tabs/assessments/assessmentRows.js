import { leafFields } from '../../../../forms/analytics/aggregate';
import { evaluate } from '../../../../forms/scoring/evaluate';
import { toQuestionnaire } from '../../../../forms/builder/engineAdapter';
import { isAnswered } from '../../../../forms/scoring/util';

const ts = v => (v ? new Date(v).getTime() : 0);
const pad = n => String(n).padStart(2, '0');

/** MM/DD/YYYY, hh:mm AM */
export function fmtDateTime(v) {
  if (!v) return null;
  const d = new Date(v);
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}, ${time}`;
}

/** MM/DD/YY */
export function fmtShortDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${String(d.getFullYear()).slice(-2)}`;
}

/**
 * One row per Forms library form this patient was sent or has responses for.
 *
 * Pending is a count, not a link between sends and responses: a share link
 * doesn't carry the patient, so each send without a matching completed
 * response counts as pending (sends minus completed, never below zero).
 * Signed follows the latest send that needs a signature; none needs one: N/A.
 */
export function buildAssessmentRows({ forms = [], responses = [], sends = [] }) {
  const formById = new Map(forms.map(f => [String(f.id), f]));
  const ids = [...new Set([...responses, ...sends].map(r => r.formId).filter(id => formById.has(id)))];
  return ids.map((formId) => {
    const form = formById.get(formId);
    const formSends = sends.filter(s => s.formId === formId).sort((a, b) => ts(b.sentAt) - ts(a.sentAt));
    const formResponses = responses.filter(r => r.formId === formId)
      .sort((a, b) => ts(b.completedAt || b.createdAt) - ts(a.completedAt || a.createdAt));
    const completed = formResponses.filter(r => r.status === 'completed');
    const signable = formSends.find(s => s.requiresSignature);
    const lastSend = formSends[0] || null;
    return {
      id: formId,
      form,
      name: form.name,
      sends: formSends,
      responses: formResponses,
      lastSend,
      lastSentAt: lastSend?.sentAt || null,
      sentByNames: [...new Set(formSends.map(s => s.sentByName).filter(Boolean))],
      signed: !signable ? 'na' : signable.signedAt ? 'yes' : 'no',
      signedByName: signable?.signedByName || null,
      programs: [...new Set(formSends.flatMap(s => s.programCodes))],
      completedCount: completed.length,
      pendingCount: Math.max(0, formSends.length - completed.length),
      inProgressCount: formResponses.length - completed.length,
      lastActivityAt: Math.max(ts(lastSend?.sentAt), ts(formResponses[0]?.completedAt || formResponses[0]?.createdAt)),
    };
  }).sort((a, b) => b.lastActivityAt - a.lastActivityAt);
}

/*
 * Views:
 *   Sent      - sent and still waiting on a response (pending > 0).
 *   Completed - at least one completed response.
 *   Drafts    - the form is still a draft in the library, or a response was
 *               started but not submitted.
 */
export const VIEWS = [
  { key: 'all', label: 'All' },
  { key: 'sent', label: 'Sent', test: r => r.pendingCount > 0 },
  { key: 'completed', label: 'Completed', test: r => r.completedCount > 0 },
  { key: 'drafts', label: 'Drafts', test: r => r.form.status === 'draft' || r.inProgressCount > 0 },
];

const SIGN_LABEL = { yes: 'Signed', no: 'Not Signed', na: 'N/A' };
const DAY = 24 * 60 * 60 * 1000;
const SENT_WINDOWS = [
  { label: 'Last 7 Days', days: 7 },
  { label: 'Last 30 Days', days: 30 },
  { label: 'Last 90 Days', days: 90 },
];
const sentWithin = (row, label) => {
  const w = SENT_WINDOWS.find(x => x.label === label);
  return !!w && !!row.lastSentAt && Date.now() - ts(row.lastSentAt) <= w.days * DAY;
};
const responseStatuses = r => [r.pendingCount > 0 && 'Pending', r.inProgressCount > 0 && 'In Progress', r.completedCount > 0 && 'Completed'].filter(Boolean);

/**
 * The filters, each with its options from these rows and its test. A filter
 * with nothing to pick from is left out.
 */
export function filterDefsFor(rows) {
  const uniq = list => [...new Set(list.filter(Boolean))].sort();
  const defs = [
    { key: 'createdBy', label: 'Created By', options: uniq(rows.flatMap(r => r.sentByNames)), test: (r, v) => r.sentByNames.some(n => v.includes(n)) },
    { key: 'signedBy', label: 'Signed By', options: uniq(rows.map(r => r.signedByName)), test: (r, v) => v.includes(r.signedByName) },
    { key: 'sign', label: 'Sign', options: rows.some(r => r.signed !== 'na') ? Object.values(SIGN_LABEL) : [], test: (r, v) => v.includes(SIGN_LABEL[r.signed]) },
    { key: 'lastSent', label: 'Last Sent Date', options: rows.some(r => r.lastSentAt) ? SENT_WINDOWS.map(w => w.label) : [], test: (r, v) => v.some(l => sentWithin(r, l)) },
    { key: 'sentFor', label: 'Sent For', options: uniq(rows.flatMap(r => r.programs)), test: (r, v) => r.programs.some(p => v.includes(p)) },
    { key: 'responseStatus', label: 'Response Status', options: uniq(rows.flatMap(responseStatuses)), test: (r, v) => responseStatuses(r).some(s => v.includes(s)) },
  ];
  return defs.filter(d => d.options.length).map(d => ({ ...d, primary: true }));
}

export function applyFilters(rows, defs, filters) {
  return rows.filter(r => defs.every(d => !(filters[d.key] || []).length || d.test(r, filters[d.key])));
}

/** Answered / total questions and the first score group's value and band. */
export function scoreSummary(form, response) {
  const fields = form.schema?.items || [];
  const total = leafFields(fields).length;
  const answered = response.answeredCount ?? leafFields(fields).filter(f => isAnswered(response.answers?.[f.linkId])).length;
  let scores = response.scores?.scores;
  if (!scores?.length && form.scoring?.scores?.length) {
    try {
      scores = evaluate(
        { questionnaire: toQuestionnaire(fields), scores: form.scoring.scores, criticalTriggers: form.scoring.criticalTriggers || [] },
        response.answers || {},
      ).scores;
    } catch {
      scores = [];
    }
  }
  const first = (scores || []).find(s => s.value != null);
  return { answered: Math.min(answered, total), total, score: first?.value ?? null, band: first?.band || null };
}
