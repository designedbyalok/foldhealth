// ── Preview / send render helper ──────────────────────────────────────────
// renderEmailHtml() produces the raw template HTML (tokens still literal).
// Everywhere we show the email as a recipient would see it — the device
// preview, the test send, the campaign preview — we go through this helper so
// three things always happen together and identically:
//   1. the compliance footer (unsubscribe + physical address) is appended,
//   2. the preheader is injected (handled inside renderEmailHtml),
//   3. merge tags are resolved against a recipient context.
// The block canvas and the code tab deliberately skip this: they show the
// author the template with tokens intact.

import { renderEmailHtml } from './patchEmailHtml';
import { applyMergeTags, SAMPLE_CONTEXT } from './mergeTags';
import { useAppStore } from '../../store/useAppStore';

// Fallback used until fetchEmailComplianceSettings() populates the store (or
// when the Supabase row is missing). CAN-SPAM requires a real physical
// mailing address and a working unsubscribe mechanism on every send.
export const DEFAULT_COMPLIANCE = {
  clinicName: 'Fold Health',
  physicalAddress: '2261 Market Street #4471, San Francisco, CA 94114',
  unsubscribeUrl: 'https://fold.health/unsubscribe?e={{email}}',
};

export function getComplianceSettings() {
  return useAppStore.getState().emailComplianceSettings || DEFAULT_COMPLIANCE;
}

/**
 * Render an email for a recipient-facing surface.
 * @param {object} doc  – the email document
 * @param {object} opts
 * @param {'light'|'dark'|'auto'} [opts.theme]
 * @param {object} [opts.recipient]   – merge-tag context (defaults to sample data)
 * @param {object|null} [opts.compliance] – override; null omits the footer
 * @param {string} [opts.wrapperPadding]
 */
export function renderPreviewHtml(doc, opts = {}) {
  const {
    theme = 'light',
    recipient = SAMPLE_CONTEXT,
    compliance = getComplianceSettings(),
    wrapperPadding,
  } = opts;
  const html = renderEmailHtml(doc, {
    theme,
    compliance,
    ...(wrapperPadding !== undefined ? { wrapperPadding } : {}),
  });
  return applyMergeTags(html, recipient);
}
