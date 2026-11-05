// The Supabase projects' URLs and public anon keys (RLS applies), shared by
// the browser client and the API's sign-in check so both fall back to the
// same project when VITE_SUPABASE_* aren't set: local dev and Vercel preview
// use Foldhealth Dev, so those builds cannot reach production by accident.
// Production deployments use production. Plain module: no
// import.meta, safe in Node. See docs/getting-started/dev-database.mdx.
export const SUPABASE_PROJECTS = {
  dev: {
    url: 'https://uwswpbiyhlmpnubxtipc.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3c3dwYml5aGxtcG51Ynh0aXBjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1NzkxNDYsImV4cCI6MjEwODE1NTE0Nn0.aeDSmCbStTBDWPjP_72Xi8JzpRZpkY5jB9yNQojp4qE',
  },
  prod: {
    url: 'https://osnihfqqrcchsaqhagcx.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zbmloZnFxcmNjaHNhcWhhZ2N4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNTI0NTksImV4cCI6MjA4OTgyODQ1OX0.ZuJQLMriqBcmf_nqLqcwu05x9BM5G_CAWz4R180xZ-w',
  },
};

const DEV_REF = 'uwswpbiyhlmpnubxtipc';
const PRODUCTION_REF = 'osnihfqqrcchsaqhagcx';

// Anon and service-role keys are JWTs. The `ref` claim is the project they
// belong to.
export function jwtProjectRef(token) {
  if (!token || typeof token !== 'string') return null;
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const body = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = body + '='.repeat((4 - (body.length % 4)) % 4);
    const json = JSON.parse(atob(padded));
    return typeof json.ref === 'string' ? json.ref : null;
  } catch {
    return null;
  }
}

// Local dev and every Vercel preview deployment use Foldhealth Dev. A
// production URL that leaked into those environments is replaced, so a
// preview build cannot reach the production project by accident. A dev URL
// paired with another project's anon key (the production key left in `.env`)
// is replaced too: every request would fail, worklists would fall back to
// mocks, and the overview row would never match.
export function supabaseTarget({ useDev, url, anonKey }) {
  const fallback = useDev ? SUPABASE_PROJECTS.dev : SUPABASE_PROJECTS.prod;
  const resolvedUrl = url || fallback.url;
  if (!useDev) return { url: resolvedUrl, anonKey: anonKey || fallback.anonKey };
  if (resolvedUrl.includes(PRODUCTION_REF)) return SUPABASE_PROJECTS.dev;
  const keyRef = jwtProjectRef(anonKey);
  if (resolvedUrl.includes(DEV_REF) && keyRef && keyRef !== DEV_REF) return SUPABASE_PROJECTS.dev;
  return { url: resolvedUrl, anonKey: anonKey || fallback.anonKey };
}
