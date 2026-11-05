// Fold Patient ID helpers.
//
// Every patient/worklist table's `id` and `member_id` columns now hold the
// SAME bare-number Fold ID (see supabase/patient_id_unification_migration.sql),
// there is no separate registry lookup anymore. These helpers just format
// that number for display/search and handle the click-to-copy interaction.

/** Format a Fold ID for display: 10234 → "#10234". No "F-", bare number
 *  behind the "#" so it stays trivially searchable (strip one char). */
export function formatFoldId(id) {
  return id == null || id === '' ? '-' : `#${id}`;
}

/**
 * True when `query` matches a patient's Fold ID. Accepts a bare number or
 * one with a leading "#"; matches on prefix so "100" finds "#10023".
 */
export function matchesFoldId(id, query) {
  if (id == null) return false;
  const q = (query || '').trim().replace(/^#/, '');
  if (!/^\d{2,}$/.test(q)) return false;
  return String(id).startsWith(q);
}

/** Copy a Fold ID to the clipboard and report success/failure to the
 *  caller so it can show the right toast.
 *
 *  Tries the legacy `document.execCommand('copy')` path FIRST because it
 *  runs synchronously inside the click handler's user-gesture window,
 *  which is the only way it works in sandboxed iframes (e.g. Storybook's
 *  preview) where the async Clipboard API is blocked. Only falls back to
 *  the modern async Clipboard API if execCommand isn't available or
 *  refuses (e.g. some no-textarea browser configs). */
export async function copyFoldId(id) {
  const text = String(id);
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    if (ok) return true;
  } catch {
    // fall through to Clipboard API
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
