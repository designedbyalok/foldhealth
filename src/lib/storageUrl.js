import { useEffect, useState } from 'react';
import { supabase } from './supabase';

// Patient-file buckets are private (supabase/private_phi_buckets_migration.sql).
// Rows still store the public-format URL getPublicUrl() returns, which no
// longer loads, so every display swaps it for a short-lived signed URL.
const PHI_BUCKETS = ['chart-uploads', 'program-documents', 'chat-media'];
const PUBLIC_PATH_RE = /\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/;
// Re-sign a minute early so a URL handed out never dies right after use.
const EXPIRY_MARGIN_MS = 60 * 1000;

/** { bucket, path } for a public-format URL into a patient-file bucket, else null. */
export function parseStorageUrl(url) {
  if (typeof url !== 'string' || !url) return null;
  let pathname;
  try { pathname = new URL(url).pathname; } catch { return null; }
  const m = PUBLIC_PATH_RE.exec(pathname);
  if (!m || !PHI_BUCKETS.includes(m[1])) return null;
  try { return { bucket: m[1], path: decodeURIComponent(m[2]) }; } catch { return null; }
}

async function signWithSession(bucket, path, expiresIn) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) throw error || new Error('Could not sign the file URL.');
  return data.signedUrl;
}

const cache = new Map();
const inflight = new Map();

function cachedSignedUrl(url) {
  const hit = cache.get(url);
  return hit && hit.expiresAt - EXPIRY_MARGIN_MS > Date.now() ? hit.signedUrl : null;
}

/**
 * Resolves to a signed URL for a patient-file URL, or the URL unchanged for
 * anything else. `sign(bucket, path, expiresIn)` replaces the signed-in
 * client's signer (the signed-out patient page signs through the API).
 */
export function signStorageUrl(url, expiresIn = 600, sign = signWithSession) {
  const parsed = parseStorageUrl(url);
  if (!parsed) return Promise.resolve(url);
  const hit = cachedSignedUrl(url);
  if (hit) return Promise.resolve(hit);
  const key = `${expiresIn}|${url}`;
  if (inflight.has(key)) return inflight.get(key);
  const startedAt = Date.now();
  const p = sign(parsed.bucket, parsed.path, expiresIn)
    .then((signedUrl) => {
      cache.set(url, { signedUrl, expiresAt: startedAt + expiresIn * 1000 });
      return signedUrl;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/**
 * The URL to render for a stored file: null while a patient file is being
 * signed, the URL unchanged for anything else.
 */
export function useStorageUrl(url, sign) {
  const phi = !!parseStorageUrl(url);
  const [signed, setSigned] = useState({ url: null, value: null });

  useEffect(() => {
    if (!phi) return undefined;
    let alive = true;
    signStorageUrl(url, undefined, sign)
      .then((value) => { if (alive) setSigned({ url, value }); })
      // Not signable (no session, or the bucket is still public because the
      // migration hasn't run): the stored URL is the only thing left to try.
      .catch(() => { if (alive) setSigned({ url, value: url }); });
    return () => { alive = false; };
  }, [url, phi, sign]);

  if (!phi) return url ?? null;
  if (signed.url === url) return signed.value;
  return cachedSignedUrl(url);
}
