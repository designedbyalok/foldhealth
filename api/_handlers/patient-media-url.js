import { serviceClient } from '../_lib/serviceClient.js';

/**
 * POST /api/patient-media-url  { token, path }  → { signedUrl }
 *
 * The signed-out patient page (/#/p/<token>) can't sign `chat-media` files
 * itself: the bucket is private and the page has no session. This signs one
 * file for 10 minutes, and only a file the patient can already see: an
 * attachment on a non-internal, non-draft message in the chat conversation
 * that owns the token. Staff chat uploads go to comms/<conversation id>/, so
 * anything outside that prefix is refused before the lookup.
 */
const BUCKET = 'chat-media';
const EXPIRES_IN = 600;
const TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;
const PUBLIC_PATH_RE = /\/storage\/v1\/object\/public\/chat-media\/(.+)$/;

function attachmentPath(url) {
  if (typeof url !== 'string') return null;
  try {
    const m = PUBLIC_PATH_RE.exec(new URL(url).pathname);
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

function fail(res, status, message) {
  return res.status(status).json({ error: { message } });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'Method not allowed');
  if (!serviceClient) return fail(res, 500, "File links aren't configured on the server (SUPABASE_SERVICE_ROLE_KEY).");
  res.setHeader('Cache-Control', 'no-store');

  const token = req.body?.token;
  const path = req.body?.path;
  if (typeof token !== 'string' || !TOKEN_RE.test(token)) return fail(res, 404, 'This link is no longer active.');
  if (typeof path !== 'string' || path.length > 1024 || path.includes('..') || path.includes('\\')) {
    return fail(res, 400, 'That file is not available.');
  }

  try {
    const { data: conv, error: convErr } = await serviceClient
      .from('patient_conversations')
      .select('id')
      .eq('channel', 'chat')
      .eq('patient_token', token)
      .maybeSingle();
    if (convErr) throw convErr;
    if (!conv) return fail(res, 404, 'This link is no longer active.');
    if (!path.startsWith(`comms/${conv.id}/`)) return fail(res, 403, 'That file is not available.');

    // Same visibility rule as comms_patient_thread: the patient only sees
    // non-internal, non-draft messages, so only their attachments sign.
    const { data: rows, error: msgErr } = await serviceClient
      .from('patient_messages')
      .select('meta')
      .eq('conversation_id', conv.id)
      .eq('kind', 'message')
      .eq('internal', false)
      .neq('status', 'draft')
      .not('meta->attachment', 'is', null);
    if (msgErr) throw msgErr;
    if (!(rows || []).some(r => attachmentPath(r.meta?.attachment?.url) === path)) {
      return fail(res, 403, 'That file is not available.');
    }

    const { data, error } = await serviceClient.storage.from(BUCKET).createSignedUrl(path, EXPIRES_IN);
    if (error || !data?.signedUrl) throw error || new Error('no signed URL');
    return res.status(200).json({ signedUrl: data.signedUrl, expiresIn: EXPIRES_IN });
  } catch (err) {
    console.error('[patient-media-url]', err?.message || err);
    return fail(res, 500, "The file couldn't be opened. Try again in a moment.");
  }
}
