import DOMPurify from 'dompurify';

/**
 * Central HTML sanitizers.
 *
 * Any HTML that did not originate in this codebase — an uploaded document, a
 * remote-fetched asset, a rich-text field, a row read back from Supabase —
 * must pass through one of these before it reaches `dangerouslySetInnerHTML`
 * or `innerHTML`. Keeping the policy here means there is one place to review
 * and one place to tighten.
 *
 * These are NOT for the email builder's deliberate HTML-authoring surfaces
 * (InlineEditable, the RawHtml block): there the user is intentionally writing
 * markup for their own email, and sanitizing would break the feature.
 */

// Rich text: formatting, links, lists, tables and images, but no scripts, no
// event handlers, no <iframe>/<object>/<embed>, no <style>.
//
// `strike` is deprecated but kept deliberately: document.execCommand
// ('strikeThrough') still emits <strike> in Chrome, so the rich-text editors
// that round-trip their own output through here would lose a user's existing
// strikethrough without it. Purely presentational, no attack surface.
const RICH_TEXT = {
  ALLOWED_TAGS: [
    'a', 'b', 'blockquote', 'br', 'caption', 'code', 'div', 'em', 'h1', 'h2',
    'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'li', 'ol', 'p', 'pre', 's',
    'small', 'span', 'strike', 'strong', 'sub', 'sup', 'table', 'tbody', 'td',
    'tfoot', 'th', 'thead', 'tr', 'u', 'ul',
  ],
  ALLOWED_ATTR: ['href', 'title', 'alt', 'src', 'width', 'height', 'colspan', 'rowspan', 'align', 'style'],
  // Block javascript:/vbscript: URLs; data: is kept for inline document images.
  ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|data:image\/(?:png|jpe?g|gif|webp|svg\+xml);|#|\/)/i,
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'link', 'meta', 'base'],
};

/** Uploaded documents, rich-text fields, and DB-authored copy. */
export function sanitizeRichText(html) {
  if (typeof html !== 'string' || html === '') return '';
  return DOMPurify.sanitize(html, RICH_TEXT);
}

/**
 * Email HTML pasted into the builder's RawHtml block, sanitized for the
 * in-app preview only.
 *
 * The preview renders inside our own origin, so in a shared workspace a
 * `<script>` pasted by one teammate would execute for anyone who opens the
 * campaign. Email markup legitimately needs `<style>` blocks, table layout
 * and presentational attributes, so this profile keeps those and removes only
 * the executable surface. DOMPurify strips `on*` handlers on every profile.
 *
 * Note this is deliberately NOT applied to the exported email — see
 * renderEmailHtml / patchEmailHtml, which still serialize the author's
 * original markup.
 */
export function sanitizeEmailHtml(html) {
  if (typeof html !== 'string' || html === '') return '';
  // DOMPurify drops <style> when sanitizing a fragment but keeps it under
  // WHOLE_DOCUMENT (where the parser hoists it into <head>). Email markup
  // routinely depends on a <style> block, so sanitize as a document and then
  // re-flatten head styles + body back into a fragment. Everything below has
  // already been through DOMPurify; DOMParser is inert and only reads it back.
  const clean = DOMPurify.sanitize(html, {
    WHOLE_DOCUMENT: true,
    ADD_ATTR: [
      'target', 'bgcolor', 'cellpadding', 'cellspacing', 'border', 'valign',
      'background',
    ],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'link', 'meta', 'base'],
    FORBID_ATTR: ['srcdoc', 'formaction'],
  });
  const doc = new DOMParser().parseFromString(clean, 'text/html');
  const styles = Array.from(doc.head.querySelectorAll('style'))
    .map(el => el.outerHTML)
    .join('');
  return styles + doc.body.innerHTML;
}

/**
 * SVG markup fetched from a remote URL or uploaded by the user. SVG is a
 * scripting host — `<script>`, `on*` handlers and `<foreignObject>` all
 * execute — so it gets its own profile that permits shapes and nothing else.
 */
export function sanitizeSvg(svg) {
  if (typeof svg !== 'string' || svg === '') return '';
  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ['script', 'foreignObject', 'a', 'use'],
    // on* handlers are dropped by DOMPurify already; being explicit documents intent.
    FORBID_ATTR: ['onload', 'onerror', 'onclick', 'onmouseover'],
  });
}
