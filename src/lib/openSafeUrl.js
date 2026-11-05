// Opens a stored document URL in a new tab. These URLs come from the database
// (note PDFs, uploaded files), and window.open runs a `javascript:` URL with
// the app's origin, so only https, blob and same-origin URLs open. A base64
// PDF data URL is turned into a blob URL first. A private patient file opens
// through a signed URL (src/lib/storageUrl.js).
import { parseStorageUrl, signStorageUrl } from './storageUrl';

const PDF_DATA_URL = /^data:application\/pdf(;[^,]*)?;base64,/i;

function pdfBlobUrl(dataUrl) {
  const bytes = Uint8Array.from(atob(dataUrl.slice(dataUrl.indexOf(',') + 1)), c => c.charCodeAt(0));
  return URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
}

// Signing is async, and a window.open after an await is no longer part of
// the click, so popup blockers stop it. The tab opens blank right away and
// moves to the signed URL once it is ready. `noopener` would make
// window.open return null, so the opener is cut by hand instead.
function openSignedStorageUrl(url, features, sign) {
  const rest = (features || '').split(',').map(f => f.trim())
    .filter(f => f && !/^no(opener|referrer)$/i.test(f)).join(',');
  const w = window.open('', '_blank', rest || undefined);
  if (!w) return null;
  try { w.opener = null; } catch { /* already cut */ }
  signStorageUrl(url, undefined, sign)
    .then((signed) => { w.location.replace(signed); })
    // Not signable (no session, or the bucket is still public because the
    // migration hasn't run): the stored URL is the only thing left to try.
    .catch((err) => {
      console.warn('[openSafeUrl] could not sign the file URL:', err?.message || err);
      w.location.replace(url);
    });
  return w;
}

/** Returns the opened window, or null when the URL isn't safe to open. */
export function openSafeUrl(url, features, sign) {
  if (typeof url !== 'string' || !url) return null;
  if (parseStorageUrl(url)) return openSignedStorageUrl(url, features, sign);
  let target = url;
  if (PDF_DATA_URL.test(url)) {
    try { target = pdfBlobUrl(url); } catch { return null; }
  } else {
    let parsed;
    try { parsed = new URL(url, window.location.href); } catch { return null; }
    const sameOrigin = parsed.origin === window.location.origin;
    if (!(parsed.protocol === 'https:' || parsed.protocol === 'blob:' || sameOrigin)) {
      console.warn('[openSafeUrl] refused to open a non-https URL');
      return null;
    }
  }
  const w = window.open(target, '_blank', features);
  try { w?.focus(); } catch { /* popup blocker */ }
  return w;
}

/**
 * onClick for an <a target="_blank"> to a stored file: a private patient
 * file opens through a signed URL instead of its dead public link.
 */
export function openStoredLink(e, url, sign) {
  if (!parseStorageUrl(url)) return;
  e.preventDefault();
  openSafeUrl(url, 'noopener', sign);
}
