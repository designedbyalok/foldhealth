/**
 * Sentry tunnel: forwards browser SDK envelopes to Sentry so requests
 * leave the user's browser as `/api/monitoring` instead of `*.ingest.sentry.io`,
 * bypassing ad/privacy blockers that match the public Sentry host.
 *
 * Hardened: validates the envelope's DSN against an allowlist so this
 * function can't be turned into an open relay for other Sentry projects.
 *
 * Docs: https://docs.sentry.io/platforms/javascript/troubleshooting/#using-the-tunnel-option
 */

// Allowed Sentry project: matches src/main.jsx Sentry.init DSN.
const SENTRY_HOST = 'o4511450529529856.ingest.us.sentry.io';
const ALLOWED_PROJECT_IDS = ['4511450531037184'];
const MAX_ENVELOPE_BYTES = 1024 * 1024;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Vercel parses JSON bodies by default, but the envelope is newline-
    // delimited NDJSON, so accept whatever form the body arrives in.
    let envelope;
    if (typeof req.body === 'string') {
      envelope = req.body;
    } else if (Buffer.isBuffer(req.body)) {
      envelope = req.body.toString('utf8');
    } else if (req.body && typeof req.body === 'object') {
      // Body parser already consumed it: re-serialize. Sentry SDK always
      // sends a JSON header on line 1, so this shape can still be safely
      // reassembled into NDJSON.
      envelope = JSON.stringify(req.body);
    } else {
      // No body parser ran: read the stream ourselves.
      // Unauthenticated, so stop reading once it's clearly not a normal envelope.
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_ENVELOPE_BYTES) return res.status(413).json({ error: 'Envelope too large' });
        chunks.push(chunk);
      }
      envelope = Buffer.concat(chunks).toString('utf8');
    }

    // First line is the envelope header, a JSON object containing `dsn`.
    const headerLine = envelope.split('\n', 1)[0];
    const header = JSON.parse(headerLine);
    const dsn = new URL(header.dsn);
    const projectId = dsn.pathname.replace(/^\//, '');

    if (dsn.host !== SENTRY_HOST || !ALLOWED_PROJECT_IDS.includes(projectId)) {
      return res.status(400).json({ error: 'Invalid Sentry DSN' });
    }

    const upstream = await fetch(
      `https://${SENTRY_HOST}/api/${projectId}/envelope/`,
      {
        method: 'POST',
        body: envelope,
        headers: { 'Content-Type': 'application/x-sentry-envelope' },
      }
    );

    res.status(upstream.status);
    return res.end();
  } catch (err) {
    console.error('Sentry tunnel error:', err);
    return res.status(500).json({ error: 'Tunnel failed' });
  }
}
