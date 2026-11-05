/**
 * Shareable in-app link to a form's fill view (#/f/{id}). Recipients open it
 * inside the app (logged-in). Absolute so it can be copied to clipboard / chat.
 */
export function formShareLink(id) {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#/f/${id}`;
}

/** Extract a form id from a share link (or hash), or null. */
export function formIdFromLink(link) {
  const m = String(link || '').match(/#\/f\/([^/?#]+)/);
  return m ? m[1] : null;
}

/**
 * Copy text to the clipboard reliably. The async Clipboard API silently
 * rejects when the document isn't focused or the context isn't secure, which
 * would leave the user's prior clipboard contents intact: so we fall back to
 * a hidden-textarea + execCommand copy. Returns true on success.
 */
export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through to legacy path */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
