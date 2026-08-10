import { getSection } from './_lib/ogSections.js';

/**
 * GET /s/<slug>  (rewritten to /api/share?s=<slug> in vercel.json)
 *
 * Returns a tiny HTML document whose <head> carries section-specific OpenGraph
 * and Twitter tags — this is what link-preview crawlers (Slack, iMessage, X,
 * LinkedIn, WhatsApp, Discord) read, since they never execute JS or see the
 * SPA's `#/…` hash route. A human browser is immediately bounced into the real
 * hash route via a meta-refresh + `location.replace`.
 */

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// JSON.stringify does not HTML-escape, so a `</script>` (or a bare `<`) in the
// value would close the surrounding <script> block and execute as markup. The
// origin here is derived from request headers, which a client controls, so the
// value reaching this sink is untrusted. Escaping `<` as < keeps the JSON
// semantically identical while making it inert inside HTML.
function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, '\\u003C');
}

function resolveOrigin(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'foldhealth.vercel.app';
  const proto = req.headers['x-forwarded-proto'] || (host.includes('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export default function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const slug = url.searchParams.get('s') || '';
  const section = getSection(slug);

  const origin = resolveOrigin(req);
  const appUrl = `${origin}/#${section.hash}`;
  const shareUrl = `${origin}/s/${encodeURIComponent(slug || 'home')}`;
  const imageUrl = `${origin}/api/og${slug ? `?s=${encodeURIComponent(slug)}` : ''}`;

  const title = section.title === 'Fold Health' ? 'Fold Health' : `${section.title} · Fold Health`;
  const desc = section.description;

  const t = escapeHtml(title);
  const d = escapeHtml(desc);
  const img = escapeHtml(imageUrl);

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${t}</title>
<meta name="description" content="${d}" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="canonical" href="${escapeHtml(appUrl)}" />

<meta property="og:type" content="website" />
<meta property="og:site_name" content="Fold Health" />
<meta property="og:title" content="${t}" />
<meta property="og:description" content="${d}" />
<meta property="og:url" content="${escapeHtml(shareUrl)}" />
<meta property="og:image" content="${img}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${t}" />
<meta name="twitter:description" content="${d}" />
<meta name="twitter:image" content="${img}" />

<meta http-equiv="refresh" content="0; url=${escapeHtml(appUrl)}" />
<script>location.replace(${jsonForScript(appUrl)});</script>
</head>
<body style="font-family:system-ui,sans-serif;color:#6B6B80;padding:40px">
Redirecting to ${t}…
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600');
  return res.status(200).send(html);
}
