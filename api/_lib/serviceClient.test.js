import { afterEach, describe, expect, it, vi } from 'vitest';

// Unsigned stand-ins with only the `ref` claim; the real keys never leave the env files.
const fakeKey = (ref) => `x.${Buffer.from(JSON.stringify({ ref, role: 'service_role' })).toString('base64url')}.x`;
const DEV_URL = 'https://uwswpbiyhlmpnubxtipc.supabase.co';
const PROD_URL = 'https://osnihfqqrcchsaqhagcx.supabase.co';

async function loadWith(env) {
  vi.resetModules();
  vi.stubEnv('VERCEL_ENV', '');
  vi.stubEnv('VITE_SUPABASE_URL', '');
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  return (await import('./serviceClient.js')).serviceClient;
}

describe('serviceClient', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('is null when the service key belongs to another project than the URL', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const client = await loadWith({ SUPABASE_URL: DEV_URL, SUPABASE_SERVICE_ROLE_KEY: fakeKey('osnihfqqrcchsaqhagcx') });
    expect(client).toBeNull();
    expect(console.warn).toHaveBeenCalledOnce();
  });

  it('keeps a production key against the production URL', async () => {
    const client = await loadWith({ SUPABASE_URL: PROD_URL, SUPABASE_SERVICE_ROLE_KEY: fakeKey('osnihfqqrcchsaqhagcx') });
    expect(client).not.toBeNull();
  });

  it('keeps a dev key against the dev URL', async () => {
    const client = await loadWith({ SUPABASE_URL: DEV_URL, SUPABASE_SERVICE_ROLE_KEY: fakeKey('uwswpbiyhlmpnubxtipc') });
    expect(client).not.toBeNull();
  });

  it('keeps keys whose project it cannot read', async () => {
    const client = await loadWith({ SUPABASE_URL: DEV_URL, SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_abc123' });
    expect(client).not.toBeNull();
  });

  it('is null without a service key', async () => {
    const client = await loadWith({ SUPABASE_URL: DEV_URL, SUPABASE_SERVICE_ROLE_KEY: '' });
    expect(client).toBeNull();
  });
});
