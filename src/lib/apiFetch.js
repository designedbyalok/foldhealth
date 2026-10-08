import { supabase } from './supabase';

/**
 * `fetch` for our own authenticated `/api/*` routes: attaches the current
 * Supabase session's access token as `Authorization: Bearer …`, which the
 * routes check with `requireUser` (api/_lib/requireUser.js). Same signature
 * and return value as `fetch`.
 */
export async function apiFetch(path, init = {}) {
  const { data } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  const token = data?.session?.access_token;
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(path, { ...init, headers });
}
