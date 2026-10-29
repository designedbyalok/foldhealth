import { createLogger, defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'fs';
import path from 'path';
import { devApiPlugin } from './vite-plugin-dev-api.js';

// https://vite.dev/config/
const dirname = import.meta.dirname;

// Vite 8's dep optimizer crawls CSS modules (with url()) through postcss-modules,
// which omits PostCSS's `from` option. Harmless, but noisy; upstream:
// https://github.com/tailwindlabs/tailwindcss/issues/20452
const logger = createLogger();
const warnOnce = logger.warnOnce.bind(logger);
logger.warnOnce = (msg, options) => {
  if (typeof msg === 'string' && msg.includes('PostCSS plugin did not pass the `from` option')) return;
  warnOnce(msg, options);
};

// Stable build identifier — the git commit SHA when running on Vercel (or
// GitHub Actions), a timestamp locally. Baked into the bundle as
// __APP_VERSION__ and mirrored in /version.json so the running client can
// detect a fresh deploy and prompt the user to reload before their lazy
// imports 404.
const APP_VERSION = process.env.VERCEL_GIT_COMMIT_SHA
  || process.env.GITHUB_SHA
  || String(Date.now());

// The update card lists what changed. The newest bold lead-ins under
// README "Recent Changes" are the release notes we already keep, so the
// card reads them instead of a second, hand-maintained list.
function readReleaseHighlights(limit = 3) {
  try {
    const readme = fs.readFileSync(path.join(dirname, 'README.md'), 'utf8');
    const section = readme.split(/^## Recent Changes\s*$/m)[1]?.split(/^## /m)[0] || '';
    return [...section.matchAll(/^- \*\*([\s\S]+?)\*\*/gm)]
      .map(m => m[1].replace(/\s+/g, ' ').trim().replace(/\.$/, ''))
      .slice(0, limit);
  } catch {
    return [];
  }
}

// Writes /version.json into the built output. Served fresh (no immutable
// cache) so the update-checker poller sees the new SHA seconds after a
// deploy completes. The old tab reads the new build's highlights from it.
function emitVersionJsonPlugin() {
  return {
    name: 'emit-version-json',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version: APP_VERSION, highlights: readReleaseHighlights() }),
      });
    },
  };
}

export default defineConfig({
  customLogger: logger,
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    // Vercel preview builds are production-mode Vite builds. Mark them so the
    // Supabase fallback is Foldhealth Dev, not the production project.
    __DEPLOY_TARGET__: JSON.stringify(process.env.VERCEL_ENV === 'preview' ? 'dev' : ''),
  },
  plugins: [tailwindcss(), react(), devApiPlugin(), emitVersionJsonPlugin()],
  server: {
    // Honor the harness-assigned PORT so the preview browser and the actual
    // dev server always agree — without this, Vite's default 5173 collides
    // with other sessions and silently auto-increments to a port the
    // harness never learns about.
    port: Number(process.env.PORT) || 5173,
  },
  resolve: {
    alias: {
      '@': path.resolve(dirname, './src'),
      // Standalone review widget, kept as its own package (packages/review-kit).
      'review-dock': path.resolve(dirname, './packages/review-kit/src'),
    }
  },
  build: {
    // No manualChunks. Earlier attempts to group recharts into a
    // 'vendor-charts' chunk caused Rolldown's CJS interop to hoist React's
    // require_* wrappers into that chunk, which then dragged vendor-charts
    // into the entry's static import graph — defeating lazy-loading and
    // forcing recharts onto the first-paint critical path.
    //
    // Auto-chunking respects the lazy() boundaries in AppLayout: recharts
    // lands in its own chunk that only loads when an analytics view mounts.
    chunkSizeWarningLimit: 1000,
  },
});