// featurebase-jwt: mints a Featurebase identity-verification JWT for the
// signed-in user. The FEATUREBASE_IDENTITY_SECRET must never reach the
// client, so signing happens here; the app passes the returned JWT to
// FeaturebaseProvider (featurebaseJwt) and the feedback widget admits the
// user as verified. Deployed with JWT verification ON, so only callers with
// a valid Supabase session can mint.
import { createClient } from "npm:@supabase/supabase-js@2";

const enc = new TextEncoder();
const b64url = (data: Uint8Array | string) => {
  const bytes = typeof data === "string" ? enc.encode(data) : data;
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const secret = Deno.env.get("FEATUREBASE_IDENTITY_SECRET");
  if (!secret) {
    return new Response(JSON.stringify({ error: "FEATUREBASE_IDENTITY_SECRET not configured" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({
    email: user.email,
    name: user.user_metadata?.full_name || user.email.split("@")[0],
    userId: user.id,
    iat: now,
    exp: now + 60 * 60 * 24, // 24h, the app re-mints on each session load
  }));
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(`${header}.${payload}`)));

  return new Response(JSON.stringify({ jwt: `${header}.${payload}.${b64url(sig)}` }), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
