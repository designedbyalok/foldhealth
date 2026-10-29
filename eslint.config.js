// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([globalIgnores([
  'dist', 'storybook-static', 'coverage',
  // Generated bundle (vite.report-viewer.config.js → public/report-viewer), gitignored.
  'public/report-viewer',
  // Patient app build output (vite.patient.config.js).
  'patient/dist',
  // Package build output (e.g. packages/review-kit: npm run build), gitignored.
  'packages/*/dist',
  // Agent tooling installs, not app code (same reason as .claude).
  '.claude', '.agents', '.github/skills',
]), {
  files: ['**/*.{js,jsx}'],
  extends: [
    js.configs.recommended,
    reactHooks.configs.flat.recommended,
    reactRefresh.configs.vite,
  ],
  languageOptions: {
    ecmaVersion: 2020,
    globals: globals.browser,
    parserOptions: {
      ecmaVersion: 'latest',
      ecmaFeatures: { jsx: true },
      sourceType: 'module',
    },
  },
  rules: {
    'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    // ── Design-system guardrails (JSX) ──────────────────────────────────
    // Kept at 'warn' so `bun run lint` stays green against the existing
    // debt; scripts/ds-guardrails.mjs promotes these to BLOCKING but only
    // on lines a change actually touches (CI + pre-commit).
    'no-restricted-syntax': ['warn',
      {
        selector: "JSXAttribute[name.name='style'] Literal[value=/#[0-9a-fA-F]{3,8}\\b/]",
        message: 'Inline hex color — use a design token via CSS Modules (var(--…)), not a raw hex in style={{}}.',
      },
      {
        selector: "JSXAttribute[name.name='style'] TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\\b/]",
        message: 'Inline hex color — use a design token via CSS Modules (var(--…)), not a raw hex in style={{}}.',
      },
      {
        selector: "JSXOpeningElement[name.name='Icon'] JSXAttribute[name.name='name'] Literal[value=/-outline/]",
        message: 'Use the -linear Solar icon variant, never -outline (outline uses heavier fill-based strokes). See CLAUDE.md.',
      },
      {
        // (my branch had an equivalent selector; superseded by foldhealth/main's
        // identical rule below, kept commented per merge-resolution instruction)
        // selector: "JSXOpeningElement[name.name='Icon'] JSXAttribute[name.name='name'] Literal[value=/^(?!solar:|custom:)[a-z]+:/]",
        // message: 'Use Solar (solar:*-linear) icons, or a registered custom:* icon. Other icon sets are not part of the design system.',
        // Allow the `custom:*` namespace for bespoke Fold Health icons that
        // are registered in components/Icon/Icon.jsx (e.g. custom:history,
        // custom:filter, custom:collapse-sidebar). Everything else must be
        // solar:*-linear.
        selector: "JSXOpeningElement[name.name='Icon'] JSXAttribute[name.name='name'] Literal[value=/^(?!solar:|custom:)[a-z]+:/]",
        message: 'Use Solar (solar:*-linear) icons or a registered custom:* icon. Third-party icon sets are not part of the design system.',
      },
      // Filter badges must be consistent app-wide — use the shared
      // src/components/FilterChip. The `.+` prefix matches re-implementations
      // (TaskFilterChip, MyFilterChip, …) while excluding the canonical
      // FilterChip itself. See CONTRIBUTING.md → Filter badges.
      {
        selector: "FunctionDeclaration[id.name=/.+FilterChip$/]",
        message: 'Do not re-implement a filter chip — use the shared src/components/FilterChip so filter badges stay identical app-wide. See CONTRIBUTING.md.',
      },
      {
        selector: "VariableDeclarator[id.name=/.+FilterChip$/][init.callee]",
        message: 'Do not re-implement a filter chip — use the shared src/components/FilterChip so filter badges stay identical app-wide. See CONTRIBUTING.md.',
      },
      {
        selector: "Property[key.name='fontSize'][value.type='Literal'][value.raw=/^\\d/]",
        message: 'Inline fontSize in px — use a rem-based CSS variable (var(--font-…)) via CSS Modules, not a raw number in style={{}}. See src/tokens/tokens.css.',
      },
    ],
  },
}, {
  files: ['vite.config.js', 'vite.patient.config.js', 'vitest.config.js', 'vite-plugin-dev-api.js', 'scripts/**/*.{js,mjs}', 'api/**/*.js', 'api/**/*.jsx'],
  languageOptions: {
    globals: { ...globals.node },
    parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  },
}, {
  // Patient app: never import staff screens or the staff store. Direct imports
  // fail here; transitive ones fail the build (vite.patient.config.js).
  files: ['patient/**/*.{js,jsx}'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [{
        group: ['**/store/**', '@/store/**'],
        message: 'Patient app must not import staff features or the staff store. Move what it needs into src/lib or src/components.',
      }, {
        // Every staff feature except the form renderer (see SHARED_FEATURE_DIRS
        // in vite.patient.config.js).
        regex: '(^|/)features/(?!forms/(render|scoring|builder)/)',
        message: 'Patient app must not import staff features or the staff store. Move what it needs into src/lib or src/components.',
      }],
    }],
  },
}, ...storybook.configs["flat/recommended"]])
