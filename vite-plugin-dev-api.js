/**
 * Vite dev plugin — runs the Vercel `api/` handlers locally so the SPA can
 * fetch them in development. Without this, `/api/send-test-email` 404s and
 * Test Mail silently fails because Vite's dev server is SPA-only.
 *
 * Hot-reloads the handler module each request so edits land without
 * restarting the dev server. Production keeps using Vercel's own runtime
 * via `api/send-test-email.js`.
 */
import { loadEnv } from 'vite';

// Vercel's res.status/json/send helpers on a plain Node response.
function withVercelHelpers(res) {
  return Object.assign(res, {
    status(code) { res.statusCode = code; return this; },
    json(payload) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(payload));
      return this;
    },
    send(payload) {
      if (typeof payload === 'object') return this.json(payload);
      res.end(String(payload));
      return this;
    },
  });
}

export function devApiPlugin() {
  return {
    name: 'dev-api',
    apply: 'serve',
    config(_config, { mode }) {
      // Push every env var from .env, .env.local, .env.<mode> etc. into the
      // dev server process so the API handlers (which read process.env) can
      // see RESEND_API_KEY, RESEND_FROM, etc.
      const env = loadEnv(mode, process.cwd(), '');
      for (const [key, value] of Object.entries(env)) {
        if (process.env[key] === undefined) process.env[key] = value;
      }
    },
    configureServer(server) {
      // If the local env doesn't have the keys the handlers need, proxy the
      // request to the deployed Vercel URL instead. Lets the dev SPA test
      // the live API without copying production secrets onto your laptop.
      const proxyBase = process.env.VITE_DEV_API_PROXY || 'https://foldagent.vercel.app';
      const hasResendKey = !!process.env.RESEND_API_KEY;

      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next();

        // Collect the body once — needed for both the in-process handler and
        // the proxy fallback.
        let raw = '';
        if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          raw = Buffer.concat(chunks).toString('utf8');
        }

        // For send-test-email specifically: if there's no local key, fall
        // back to the deployed API which already has RESEND_API_KEY set.
        if (req.url.startsWith('/api/send-test-email') && !hasResendKey) {
          // Check the token locally too, so dev rejects what production would.
          const { requireUser } = await server.ssrLoadModule(`${process.cwd()}/api/_lib/requireUser.js`);
          if (!(await requireUser(req, withVercelHelpers(res)))) return;
          try {
            const upstream = await fetch(`${proxyBase}${req.url}`, {
              method: req.method,
              headers: {
                'Content-Type': req.headers['content-type'] || 'application/json',
                Authorization: req.headers.authorization,
              },
              body: raw || undefined,
            });
            const text = await upstream.text();
            res.statusCode = upstream.status;
            res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
            res.end(text);
          } catch (err) {
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              error: { message: `Dev proxy to ${proxyBase} failed: ${err?.message || err}` },
            }));
          }
          return;
        }

        // Otherwise run the handler in-process from the local api/ folder.
        const pathPart = req.url.split('?')[0].replace(/\/+$/, '');
        const handlerPath = `${process.cwd()}${pathPart}.js`;
        try {
          const mod = await server.ssrLoadModule(handlerPath);
          const handler = mod.default;
          if (typeof handler !== 'function') return next();
          let body = null;
          if (raw) {
            try { body = JSON.parse(raw); } catch { body = raw; }
          }
          const adaptedReq = Object.assign(req, { body });
          await handler(adaptedReq, withVercelHelpers(res));
        } catch (err) {
          console.error('[dev-api] handler error:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: { message: err?.message || 'dev-api crashed' } }));
        }
      });
    },
  };
}
