// Deterministic sampling helpers for the HCC assignment engine.
//
// AC-4 (Reviewer → Reviewer 2) requires a 10% sample. This rate must be
// **configurable per client** (story implementation note #3). There is no
// further tier to sample into: "Reviewer 3" does not exist in this
// workflow, so Reviewer 2 is always the last possible review stage.
//
// We pick "deterministic" sampling rather than `Math.random()` so that:
//   - the same DOS always yields the same sampling decision across reloads,
//   - tests are reproducible,
//   - the activity log doesn't show ghost flips.
//
// Hashing strategy: a tiny FNV-1a 32-bit hash over the DOS's composite key
// (patient + date + provider + POS), modulo 10_000 → a stable integer in
// [0, 10000). The integer is compared against `rate * 10_000`. Using 10_000
// gives us 0.01% resolution which is plenty for the ~10% rate the story
// calls for. Hashing the full composite key (not just patient+date) means
// two DOS rows sharing a date but differing provider/POS get independent
// sampling outcomes, matching the composite-key invariant.

// Default sampling rate from the story (AC-4). Fall-back value used if the
// client config doesn't override.
export const DEFAULT_SAMPLING_RATES = {
  reviewer2: 0.10, // 10% of Reviewer-completed DOSs are promoted to Reviewer 2
};

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    // 32-bit multiply by 16777619, kept inside int32 with Math.imul
    h = Math.imul(h, 0x01000193);
  }
  // Force unsigned
  return h >>> 0;
}

// Public: returns true if the given (patient, dos, provider, pos) should be
// promoted to the next sample tier. Pass either `'reviewer2'` (uses default
// rate) or a numeric rate to override.
export function isSampled(patientId, dosDate, renderingProvider, pos, rateOrTier) {
  const rate = typeof rateOrTier === 'number'
    ? rateOrTier
    : DEFAULT_SAMPLING_RATES[rateOrTier] ?? 0;
  if (!rate || rate <= 0) return false;
  if (rate >= 1) return true;
  const bucket = fnv1a(`${patientId}::${dosDate}::${renderingProvider || '-'}::${pos || '-'}`) % 10_000;
  return bucket < Math.round(rate * 10_000);
}

// Convenience wrapper: easier to read at the call site in lifecycle.js.
export function sampledForReviewer2(patientId, dosDate, renderingProvider, pos, rates = DEFAULT_SAMPLING_RATES) {
  return isSampled(patientId, dosDate, renderingProvider, pos, rates.reviewer2);
}

// ── Phase 0 (WR7) config guard ───────────────────────────────────────────
//
// The requirements doc's "minimum two reviews before ASM generation" rule
// does not exist in this codebase yet, and must not be implemented without
// a product decision from Nalu: it's mathematically incompatible with the
// current ~10% Reviewer→Reviewer2 sampling rate (the overwhelming majority
// of DOS would only ever get ONE review, since Reviewer entry is 100% but
// promotion to Reviewer 2 is sampled). This function is a dormant tripwire:
// `config.minReviewsBeforeAsm` doesn't exist anywhere else in the app today
// (always falsy), so this is a no-op call until someone wires that flag up,
// at which point it stops a broken combination from shipping silently.
export function validateAsmReadinessConfig(config = {}) {
  const minReviewsBeforeAsm = !!config.minReviewsBeforeAsm;
  if (!minReviewsBeforeAsm) return { ok: true };

  const rates = config.samplingRates || DEFAULT_SAMPLING_RATES;
  const reviewer2Rate = rates.reviewer2 ?? 0;
  // Since Reviewer entry is unconditional (100%), the fraction of DOS that
  // would ever receive a SECOND review is just the Reviewer2 sampling rate.
  if (reviewer2Rate < 0.99) {
    const msg = `[HCC ASM CONFIG] minReviewsBeforeAsm=true is incompatible with the ` +
      `current Reviewer→Reviewer2 sampling rate (${reviewer2Rate}). Only ~` +
      `${(reviewer2Rate * 100).toFixed(2)}% of DOS would ever receive a second review, ` +
      `so most DOS would never reach Billing Ready under a "minimum two reviews" rule. ` +
      `This requires a product decision (raise sampling to ~100%, or drop the ` +
      `minimum-two-reviews rule) before minReviewsBeforeAsm can ship. See WR7.`;
    console.error(msg);
    return { ok: false, reason: msg };
  }
  return { ok: true };
}
