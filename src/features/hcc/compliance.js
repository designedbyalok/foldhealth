/**
 * HCC Compliance Engine
 *
 * Three-layer model:
 *
 *   1. OCR quality tier (document level)
 *        clean: born-digital or OCR confidence ≥ ~95%
 *        degraded: scanned but readable (≥ ~70%)
 *        unreadable: OCR failed; short-circuits to Support for re-scan
 *
 *   2. 5-point compliance checklist (document level)
 *        Per the Astrana spec. Each check carries an actor (ai | support),
 *        timestamp, and (for manual pass/fail) a reason.
 *
 *   3. Per-record extraction confidence (record level, lives in confidence.js)
 *        Prioritization only: never permission.
 *
 * Tier policy (from product decision, 2026-03):
 *   - Unreadable  → no compliance, no extraction. Routes to Support.
 *   - Degraded    → AI never auto-passes; every check pending → Support review.
 *                   Rationale: borderline OCR = audit trail must say a human read this.
 *   - Clean       → AI auto-passes checks where the evidence is unambiguous;
 *                   uncertain checks (signature-only Provider, anything Legible-adjacent)
 *                   stay pending → Support review.
 */

// ─── Check definitions ─────────────────────────────────────────────────

// 7-point document-review checklist (Figma 6:5838). Order matches the
// dropdown so the strip and popover read top-to-bottom identically.
export const CHECK_KEYS = [
  'correctPatient',
  'legible',
  'dosCharted',
  'posAvailable',
  'requiredFields',
  'signaturePresent',
  'providerName',
];

export const CHECK_LABELS = {
  correctPatient: 'Document belongs to the correct patient',
  legible: 'Document is legible',
  dosCharted: 'Date of Service (DOS) is charted',
  posAvailable: 'Place of Service (POS) is available',
  requiredFields: 'All required fields are complete',
  signaturePresent: 'Required signature is present',
  providerName: 'Provider name is present',
};

// Short labels for the per-doc dot strip / blocker hints.
export const CHECK_SHORT_LABELS = {
  correctPatient: 'Patient',
  legible: 'Legible',
  dosCharted: 'DOS',
  posAvailable: 'POS',
  requiredFields: 'Fields',
  signaturePresent: 'Signature',
  providerName: 'Provider',
};

// ─── OCR tier ──────────────────────────────────────────────────────────

export const OCR_TIERS = ['clean', 'degraded', 'unreadable'];

export const OCR_TIER_LABEL = {
  clean: 'Clean',
  degraded: 'Degraded',
  unreadable: 'Unreadable',
};

// Tone tokens map onto the Badge component variants the rest of the app uses.
export const OCR_TIER_TONE = {
  clean: 'success',
  degraded: 'warning',
  unreadable: 'error',
};

// ─── Standard rejection reasons ────────────────────────────────────────
// Per check. "Other (free text)" is always implicit: the reason dialog
// presents the list as a Select plus a Textarea for free text. Both manual
// pass and manual fail require a reason.
export const STANDARD_REASONS = {
  correctPatient: [
    'Wrong patient on document',
    'Patient identifiers do not match',
    'Unable to confirm patient',
  ],
  legible: [
    'Document quality too poor',
    'Partial page / cut off',
    'Handwriting not legible',
  ],
  dosCharted: [
    'DOS missing',
    'DOS conflicts with claim',
    'DOS not legible',
  ],
  posAvailable: [
    'POS missing',
    'POS unclear',
    'POS does not match claim',
  ],
  requiredFields: [
    'Missing required field',
    'Field illegible',
    'Conflicting values',
  ],
  signaturePresent: [
    'No signature on document',
    'Signature only, no printed attestation',
    'Signature illegible',
  ],
  providerName: [
    'Provider name not printed',
    'Provider name illegible',
    'Wrong provider on document',
  ],
};

// ─── OCR tier evaluation (mock) ────────────────────────────────────────
// Deterministic: same filename always produces the same tier so demos
// reload to a stable state. Real backend will compute this from raw OCR
// confidence over the page set.
export function evaluateOcrTier(fileName) {
  const name = (fileName || '').toLowerCase();

  // Explicit demo overrides: let the QA team trigger each tier on demand.
  if (name.includes('demo-unreadable') || name.includes('demo-fax')) {
    return 'unreadable';
  }
  if (name.includes('demo-degraded') || name.includes('demo-scan')) {
    return 'degraded';
  }
  // Bundle demo docs (the "N Documents" chips) get the realistic hashed
  // distribution so a batch shows a natural mix of Added / Needs Review /
  // Unreadable: deterministic per index, so reloads are stable.
  if (name.includes('demo-patient-')) {
    const b = hash(name) % 100;
    if (b < 8) return 'unreadable';
    if (b < 30) return 'degraded';
    return 'clean';
  }
  // Any other demo file is deterministically Clean so the sample picker
  // produces predictable categorization for walkthroughs.
  if (name.includes('demo-')) {
    return 'clean';
  }

  // Realistic distribution: ~80% clean, ~15% degraded, ~5% unreadable.
  // Hashed so the distribution is stable across reloads but varies by file.
  const h = hash(name);
  const bucket = h % 100;
  if (bucket < 5) return 'unreadable';
  if (bucket < 20) return 'degraded';
  return 'clean';
}

// ─── Compliance evaluation ─────────────────────────────────────────────
// Returns a compliance object keyed by CHECK_KEYS. Each entry:
//   { status: 'pass' | 'fail' | 'pending', source: 'ai' | 'support' | null,
//     actor: string | null, at: ISO string | null, reason: { code, freeText } | null }
//
// Inputs:
//   ocrTier: from evaluateOcrTier()
//   sample: a representative encounter from the OCR result, used to
//             check which fields populated (drives AI's pass/fail).
//             Pass null if there are no extractable encounters (e.g.
//             unreadable doc).
export function evaluateCompliance(ocrTier, sample) {
  const now = new Date().toISOString();

  // Unreadable: nothing to evaluate. All pending; will route to Support
  // with the implicit recommendation to re-scan / re-request.
  if (ocrTier === 'unreadable') {
    return Object.fromEntries(CHECK_KEYS.map(k => [k, pending()]));
  }

  // Degraded: by product policy, AI never auto-passes. Every check
  // pending → Support review.
  if (ocrTier === 'degraded') {
    return Object.fromEntries(CHECK_KEYS.map(k => [k, pending()]));
  }

  // Clean: AI evaluates per check. Checks AI cannot be confident about,
  // completeness of every required field, and presence of a valid
  // signature: stay pending so a human confirms them (matches Figma
  // 6:5838 where those two sit unchecked on an otherwise-clean doc).
  const s = sample || {};
  const result = {};

  // correctPatient: pass if OCR matched a Fold member with no ID mismatch.
  result.correctPatient = (s.patient?.matchedMemberId && !s.patient?.idMismatch)
    ? aiPass(now)
    : aiFail(now);

  // legible: on Clean docs AI auto-passes (the tier itself implies it).
  result.legible = aiPass(now);

  // dosCharted: pass if DOS field populated; fail if missing.
  result.dosCharted = s.dos ? aiPass(now) : aiFail(now);

  // posAvailable: pass if POS populated; fail otherwise.
  result.posAvailable = s.pos ? aiPass(now) : aiFail(now);

  // requiredFields: completeness is a human judgement; AI defers.
  result.requiredFields = pending();

  // signaturePresent: AI can't reliably confirm a wet/e-signature.
  result.signaturePresent = pending();

  // providerName: pass if a printed provider name was extracted.
  result.providerName = s.provider ? aiPass(now) : aiFail(now);

  return result;
}

// ─── State machine helpers ─────────────────────────────────────────────

export function checkPassed(check) {
  return check?.status === 'pass';
}

export function allChecksPassed(compliance) {
  if (!compliance) return false;
  return CHECK_KEYS.every(k => checkPassed(compliance[k]));
}

export function anyCheckFailed(compliance) {
  if (!compliance) return false;
  return CHECK_KEYS.some(k => compliance[k]?.status === 'fail');
}

export function anyCheckPending(compliance) {
  if (!compliance) return false;
  return CHECK_KEYS.some(k => compliance[k]?.status === 'pending');
}

// AI vs Support distinction is preserved on each check so the audit trail
// can answer "who passed this?" for HCC submission audits.
export function isAiPassed(check) {
  return check?.status === 'pass' && check?.source === 'ai';
}

export function isSupportPassed(check) {
  return check?.status === 'pass' && check?.source === 'support';
}

// Apply a manual Support decision to a single check. Reason is required
// for both pass and fail (per product policy).
export function applyManualDecision(check, { decision, actor, reason }) {
  if (!['pass', 'fail'].includes(decision)) {
    throw new Error(`applyManualDecision: decision must be 'pass' or 'fail', got ${decision}`);
  }
  if (!reason || (!reason.code && !reason.freeText)) {
    throw new Error('applyManualDecision: reason (code or freeText) is required');
  }
  return {
    status: decision,
    source: 'support',
    actor: actor || 'Support',
    at: new Date().toISOString(),
    reason: { code: reason.code || null, freeText: reason.freeText || '' },
  };
}

// ─── DOS-level gate ────────────────────────────────────────────────────
// A DOS may be marked Complete (and transition to the Coder) only if every
// attached document has every check passed. UI consults this to enable /
// disable the "Mark DOS Complete" affordance and to show a hint listing
// what's still blocking.
export function canCompleteDos(docs) {
  if (!docs || docs.length === 0) {
    // No documents on the DOS: cannot release to coder yet.
    return { ok: false, reason: 'No documents attached to this DOS yet.' };
  }
  const unreadable = docs.filter(d => d.ocrTier === 'unreadable');
  if (unreadable.length) {
    return {
      ok: false,
      reason: `${unreadable.length} unreadable document${unreadable.length > 1 ? 's' : ''} need re-scan or re-request.`,
    };
  }
  const blockers = [];
  for (const d of docs) {
    if (!d.compliance) {
      blockers.push(`${d.fileName}: compliance not evaluated`);
      continue;
    }
    const failing = CHECK_KEYS.filter(k => d.compliance[k]?.status === 'fail');
    const pending = CHECK_KEYS.filter(k => d.compliance[k]?.status === 'pending');
    if (failing.length) blockers.push(`${d.fileName}: ${failing.map(k => CHECK_SHORT_LABELS[k]).join(', ')} failing`);
    else if (pending.length) blockers.push(`${d.fileName}: ${pending.map(k => CHECK_SHORT_LABELS[k]).join(', ')} pending Support review`);
  }
  if (blockers.length) {
    return { ok: false, reason: blockers.join(' · ') };
  }
  return { ok: true, reason: null };
}

// ─── Internals ─────────────────────────────────────────────────────────

function aiPass(now) {
  return { status: 'pass', source: 'ai', actor: 'AI', at: now, reason: null };
}

function aiFail(now) {
  return { status: 'fail', source: 'ai', actor: 'AI', at: now, reason: null };
}

function pending() {
  return { status: 'pending', source: null, actor: null, at: null, reason: null };
}

function hash(s) {
  let h = 0;
  const str = String(s || '');
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h);
}
