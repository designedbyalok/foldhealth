import { createClient } from '@supabase/supabase-js';
import { supabaseTarget } from './supabaseConfig';

// Vite bakes __DEPLOY_TARGET__ at build time: "dev" on Vercel preview,
// empty otherwise. Local `vite` dev also uses Foldhealth Dev.
// eslint-disable-next-line no-undef
const previewBuild = typeof __DEPLOY_TARGET__ !== 'undefined' && __DEPLOY_TARGET__ === 'dev';
const { url: supabaseUrl, anonKey: supabaseAnonKey } = supabaseTarget({
  useDev: import.meta.env.DEV || previewBuild,
  url: import.meta.env.VITE_SUPABASE_URL,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
});

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: 'public' },
});
