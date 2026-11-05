import { describe, expect, it } from 'vitest';
import { SUPABASE_PROJECTS, supabaseTarget } from './supabaseConfig';

describe('supabaseTarget', () => {
  it('sends local dev to Foldhealth Dev when the URL is production', () => {
    expect(supabaseTarget({
      useDev: true,
      url: SUPABASE_PROJECTS.prod.url,
      anonKey: SUPABASE_PROJECTS.prod.anonKey,
    })).toEqual(SUPABASE_PROJECTS.dev);
  });

  it('replaces a dev URL paired with the production anon key', () => {
    expect(supabaseTarget({
      useDev: true,
      url: SUPABASE_PROJECTS.dev.url,
      anonKey: SUPABASE_PROJECTS.prod.anonKey,
    })).toEqual(SUPABASE_PROJECTS.dev);
  });

  it('keeps a matching dev key', () => {
    const got = supabaseTarget({
      useDev: true,
      url: SUPABASE_PROJECTS.dev.url,
      anonKey: SUPABASE_PROJECTS.dev.anonKey,
    });
    expect(got).toEqual({ url: SUPABASE_PROJECTS.dev.url, anonKey: SUPABASE_PROJECTS.dev.anonKey });
  });

  it('keeps production outside local dev', () => {
    const got = supabaseTarget({
      useDev: false,
      url: SUPABASE_PROJECTS.prod.url,
      anonKey: SUPABASE_PROJECTS.prod.anonKey,
    });
    expect(got.url).toBe(SUPABASE_PROJECTS.prod.url);
    expect(got.anonKey).toBe(SUPABASE_PROJECTS.prod.anonKey);
  });
});
