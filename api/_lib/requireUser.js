import { createClient } from '@supabase/supabase-js';
import { supabaseTarget } from '../../src/lib/supabaseConfig.js';
import { serviceClient } from './serviceClient.js';

/**
 * Gate for serverless routes that send mail or spend on paid APIs.
 *
 *   const user = await requireUser(req, res);
 *   if (!user) return;
 *
 * Reads `Authorization: Bearer <supabase access token>` and verifies it with
 * Supabase Auth, then checks the user's profile is Active: anyone can sign up,
 * so a valid session alone isn't enough (a pending or deactivated account
 * gets a 403). Resolves to the Supabase user, or writes a 401/403 (500 when
 * the server is missing its Supabase env) and resolves to null. The browser side
 * is `apiFetch` in src/lib/apiFetch.js.
 *
 * VITE_SUPABASE_* come first because they name the project the browser signs
 * into; a token from any other project fails verification. Without them it
 * uses the same built-in project as the browser client: Foldhealth Dev for
 * local dev and Vercel preview, production only for production deploys.
 */
const { url, anonKey: key } = supabaseTarget({
  useDev: process.env.VERCEL_ENV === 'preview' || process.env.NODE_ENV !== 'production',
  url: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  anonKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
});

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
  let user;
  try {
    const { data, error } = await supabase.auth.getUser(match[1]);
    if (error || !data?.user) return unauthorized(res);
    user = data.user;
  } catch {
    return unauthorized(res);
  }
  // Approved staff only. Read with the service key when the server has it,
  // otherwise as the user themself (they can read their own profile).
  try {
    const db = serviceClient || createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${match[1]}` } },
    });
    const { data: profile, error } = await db.from('profiles').select('status').eq('id', user.id).maybeSingle();
    if (error) throw error;
    if (profile?.status !== 'Active') {
      res.status(403).json({ error: { message: 'Your account is not active yet.' } });
      return null;
    }
  } catch (err) {
    console.error('[requireUser] profile check failed', err);
    res.status(503).json({ error: { message: 'Could not check your account. Try again.' } });
    return null;
  }
  return user;
}
