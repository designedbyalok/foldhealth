import { createClient } from '@supabase/supabase-js';
import { SUPABASE_PROJECTS, jwtProjectRef } from '../../src/lib/supabaseConfig.js';

/**
 * Service-role Supabase client for server routes that must act past RLS
 * (account lockout, password reset). Null when the server env is missing
 * SUPABASE_SERVICE_ROLE_KEY; callers answer 500 then.
 *
 * Also null when the key belongs to another project than the URL: local dev
 * loads production's key from `.env` next to the Foldhealth Dev URL in
 * `.env.development.local`, and that pair fails every request with "Invalid
 * API key". requireUser then reads the profile as the user instead.
 */
const configuredUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const url = process.env.VERCEL_ENV === 'preview' && (!configuredUrl || configuredUrl.includes('osnihfqqrcchsaqhagcx'))
  ? SUPABASE_PROJECTS.dev.url
  : configuredUrl;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const urlRef = /^https:\/\/([a-z0-9]+)\.supabase\.co\b/i.exec(url || '')?.[1] || null;
const keyRef = jwtProjectRef(key);
const keyMismatch = Boolean(urlRef && keyRef && urlRef !== keyRef);
if (keyMismatch) {
  console.warn(`[serviceClient] SUPABASE_SERVICE_ROLE_KEY is for project ${keyRef}, not ${urlRef}; running without the service key`);
}

export const serviceClient = url && key && !keyMismatch
  ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
  : null;

const ADMIN_ROLES = ['Admin/Practice Manager', 'Business/Practice Owner'];

/** Same rule as public.is_profile_admin: an active practice admin. */
export function isPracticeAdmin(profile) {
  if (!profile || profile.status !== 'Active') return false;
  return ADMIN_ROLES.includes(profile.admin_role)
    || (profile.clinical_roles || []).includes('Admin/Practice Manager');
}
