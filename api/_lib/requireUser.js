import { createClient } from '@supabase/supabase-js';

/**
 * Gate for serverless routes that send mail or spend on paid APIs.
 *
 *   const user = await requireUser(req, res);
 *   if (!user) return;
 *
 * Reads `Authorization: Bearer <supabase access token>` and verifies it with
 * Supabase Auth. Resolves to the Supabase user, or writes a 401 (500 when the
 * server is missing its Supabase env) and resolves to null. The browser side
 * is `apiFetch` in src/lib/apiFetch.js.
 *
 * VITE_SUPABASE_* come first because they name the project the browser signs
 * into; a token from any other project fails verification.
 */
const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = url && key
  ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
  : null;

function unauthorized(res) {
  res.status(401).json({ error: { message: 'You need to be signed in to do this.' } });
  return null;
}

export async function requireUser(req, res) {
  if (!supabase) {
    console.error('[requireUser] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set');
    res.status(500).json({ error: { message: 'Sign-in check isn\'t configured on the server.' } });
    return null;
  }
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers?.authorization || '');
  if (!match) return unauthorized(res);
  try {
    const { data, error } = await supabase.auth.getUser(match[1]);
    if (error || !data?.user) return unauthorized(res);
    return data.user;
  } catch {
    return unauthorized(res);
  }
}
