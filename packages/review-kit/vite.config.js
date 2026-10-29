// Library build: dist/index.js (ESM) + dist/index.cjs (CommonJS), with
// sourcemaps. React and every dependency stay external, so the host app's
// copies are used and nothing is bundled twice. CSS ships separately
// (dist/styles.css, built by scripts/build-css.mjs).
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const deps = [...Object.keys(pkg.peerDependencies || {}), ...Object.keys(pkg.dependencies || {})];
const isExternal = (id) => deps.some(dep => id === dep || id.startsWith(`${dep}/`));

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    minify: false,
    lib: {
      entry: 'src/index.js',
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'index.js' : 'index.cjs'),
    },
    rolldownOptions: {
      external: isExternal,
      // The widget uses browser APIs and hooks: mark it a client component
      // for React Server Components frameworks (Next.js app router).
      output: { banner: "'use client';" },
    },
  },
});
