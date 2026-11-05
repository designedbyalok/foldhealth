import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

/**
 * Patient app build (patients.foldhealth.org). Same design system as the
 * staff app: it imports src/components, src/tokens and src/lib, with its own
 * layouts under patient/.
 *
 * It must never bundle staff code. src/store/useAppStore loads every
 * worklist, and src/features/* are staff screens, so either one would ship
 * staff logic (and its queries) to patients. Many shared components import
 * the staff store, so a lint rule on direct imports is not enough:
 * staffCodeGuard fails dev and build on any import, direct or transitive,
 * that resolves into those folders.
 */
const dirname = import.meta.dirname;
const STAFF_DIRS = ['src/features', 'src/store'].map((d) => path.resolve(dirname, d) + path.sep);
// The form renderer, so patients can fill forms their care team sends. It
// never imports the staff store; if it ever does, src/store above still fails
// the build.
const SHARED_FEATURE_DIRS = [
  'src/features/forms/render', 'src/features/forms/builder', 'src/features/forms/scoring', 'src/features/email-builder',
].map((d) => path.resolve(dirname, d) + path.sep);
const isStaffCode = (id) => STAFF_DIRS.some((dir) => id.startsWith(dir))
  && !SHARED_FEATURE_DIRS.some((dir) => id.startsWith(dir));

function staffCodeGuard() {
  return {
    name: 'patient-staff-code-guard',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!importer) return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (resolved && isStaffCode(resolved.id)) {
        this.error(
          `Patient app imported staff code: ${path.relative(dirname, resolved.id)}\n`
          + `  from ${path.relative(dirname, importer)}\n`
          + '  Move what the patient app needs into src/lib or src/components.',
        );
      }
      return resolved;
    },
  };
}

const APP_VERSION = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || String(Date.now());

export default defineConfig({
  root: path.resolve(dirname, 'patient'),
  publicDir: path.resolve(dirname, 'public'),
  envDir: dirname,
  plugins: [staffCodeGuard(), tailwindcss(), react()],
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    // Same contract as vite.config.js: Vercel preview builds use Foldhealth Dev.
    __DEPLOY_TARGET__: JSON.stringify(process.env.VERCEL_ENV === 'preview' ? 'dev' : ''),
  },
  server: { port: Number(process.env.PORT) || 5175 },
  resolve: { alias: { '@': path.resolve(dirname, './src') } },
  build: {
    outDir: path.resolve(dirname, 'patient/dist'),
    emptyOutDir: true,
  },
});
