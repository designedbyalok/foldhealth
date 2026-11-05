/// <reference types="vitest/config" />
import { defineConfig, mergeConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import path from 'path';
import viteConfig from './vite.config.js';

const dirname = import.meta.dirname;

// Vitest config lives here instead of vite.config.js so `vite` / `bun run dev`
// does not load the Storybook test plugin. That plugin adds optimizeDeps entries
// that crawl story files (and their CSS modules) during dev startup, which
// triggers a harmless but noisy PostCSS `from` warning in Vite 8.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      projects: [{
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.{js,jsx}', 'api/**/*.test.js', 'patient/**/*.test.{js,jsx}'],
        },
      }, {
        extends: true,
        plugins: [
          // See: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({
            configDir: path.join(dirname, '.storybook'),
          }),
        ],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: 'chromium' }],
          },
        },
      }],
    },
  }),
);
