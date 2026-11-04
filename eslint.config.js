// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'
import { readFileSync } from 'node:fs'

// Component layers (src/components/layers.json). A primitive may only import
// other primitives; a pattern may import primitives and patterns. Neither may
// reach into the app (store, features, layouts), so the library can be lifted
// into its own package. See docs/components/library-contract.mdx.
const LAYERS = JSON.parse(readFileSync(new URL('./src/components/layers.json', import.meta.url), 'utf8'))
const APP_CODE = {
  regex: '(^|/)(store|features|layouts)/|(^|/)lib/(supabase|apiFetch)$',
  message: 'Library components (primitives, patterns) must not import the store, features, layouts or the network. Take the data as props; put the connected wrapper in the feature. See docs/components/library-contract.mdx.',
}
// Renamed or merged components: the old folder only re-exports the new one.
const DEPRECATED = Object.entries(LAYERS.$deprecated || {})
  .filter(([old]) => !old.startsWith('$'))
  .map(([old, next]) => ({
    regex: `(^|/)${old}/${old}$`,
    message: `${old} is now ${next}: import it from src/components/${next.split(' ')[0]}. See docs/components/library-contract.mdx.`,
  }))
const layerImports = (owner, banned) => ({
  files: LAYERS[owner].map(d => `src/components/${d}/**/*.{js,jsx}`),
  ignores: ['**/*.stories.jsx'],
  rules: {
    'no-restricted-imports': ['warn', {
      patterns: [APP_CODE, ...DEPRECATED, {
        regex: `^(\\.\\./)+(${banned.flatMap(l => LAYERS[l]).join('|')})/`,
        message: `A ${owner === 'primitives' ? 'primitive' : 'pattern'} must not import ${banned.join(' or ')} components (src/components/layers.json). Pass it in as a prop or slot instead.`,
      }],
    }],
  },
})

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
        message: 'Inline hex color: use a design token via CSS Modules (var(--…)), not a raw hex in style={{}}.',
      },
      {
        selector: "JSXAttribute[name.name='style'] TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\\b/]",
        message: 'Inline hex color: use a design token via CSS Modules (var(--…)), not a raw hex in style={{}}.',
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
      // Filter badges must be consistent app-wide, use the shared
      // src/components/FilterChip. The `.+` prefix matches re-implementations
      // (TaskFilterChip, MyFilterChip, …) while excluding the canonical
      // FilterChip itself. See CONTRIBUTING.md → Filter badges.
      {
        selector: "FunctionDeclaration[id.name=/.+FilterChip$/]",
        message: 'Do not re-implement a filter chip, use the shared src/components/FilterChip so filter badges stay identical app-wide. See CONTRIBUTING.md.',
      },
      {
        selector: "VariableDeclarator[id.name=/.+FilterChip$/][init.callee]",
        message: 'Do not re-implement a filter chip, use the shared src/components/FilterChip so filter badges stay identical app-wide. See CONTRIBUTING.md.',
      },
      // Variant / tone / size vocabulary (docs/components/library-contract.mdx).
      // The components still accept the old names at runtime, so these only
      // stop new code from adding them.
      {
        selector: "JSXOpeningElement[name.name='Button'] > JSXAttribute[name.name='variant'] > Literal[value=/^(primary|secondary|tertiary|alt|success|danger|dangerFilled|info|error)$/]",
        message: 'Button variant names changed: variant is solid | soft | outline | ghost, intent goes in tone (primary | neutral | success | warning | danger | info). E.g. secondary → variant="outline", danger → variant="soft" tone="danger". See docs/components/library-contract.mdx.',
      },
      {
        selector: "JSXOpeningElement[name.name=/^(Button|ActionButton)$/] > JSXAttribute[name.name='size'] > Literal[value=/^(S|M|L|XL|s)$/]",
        message: 'Sizes are sm | md | lg, and md is the default (S → sm, L → leave it out, XL → lg). See docs/components/library-contract.mdx.',
      },
      {
        selector: "JSXOpeningElement[name.name='Badge'] > JSXAttribute[name.name='tone'] > Literal[value=/^(grey|white|ghost|error|disabled|green)$/]",
        message: 'Badge tone names changed: grey → (default neutral), white → variant="outline", ghost → variant="ghost", error → tone="danger", disabled → disabled. See docs/components/library-contract.mdx.',
      },
      {
        selector: "JSXOpeningElement[name.name='Badge'] > JSXAttribute[name.name='variant'] > Literal:not([value=/^(soft|outline|ghost|solid)$/])",
        message: 'Badge variant is emphasis only: soft | outline | ghost | solid. A status look is a tone the feature picks (e.g. TOC Enrolled → tone="success"). See docs/components/library-contract.mdx.',
      },
      {
        selector: "JSXOpeningElement[name.name='Badge'] > JSXAttribute[name.name='size'] > Literal[value=/^(XS|S|M|L)$/]",
        message: 'Badge sizes are xs | sm | md | lg. See docs/components/library-contract.mdx.',
      },
      {
        selector: "JSXOpeningElement[name.name=/^(Input|Select|Textarea)$/] > JSXAttribute[name.name='variant'] Literal[value=/^(error|default|quiet)$/]",
        message: 'Field looks changed: variant="error" → invalid (invalid={cond} for a condition), "default" → (default outline), "quiet" → variant="ghost". See docs/components/library-contract.mdx.',
      },
      {
        selector: "JSXOpeningElement[name.name='Select'] > JSXAttribute[name.name=/^(onChange|ariaLabel)$/]",
        message: 'Select reports picks through onValueChange(value), and takes aria-label like any element. See docs/components/library-contract.mdx.',
      },
      {
        selector: "JSXOpeningElement[name.name='Textarea']:has(> JSXAttribute[name.name=/^(title|showInfo|info|mandatory|supportingText|richText|maxLength)$/]) > JSXAttribute[name.name='onChange']",
        message: 'A labelled or rich Textarea reports its text through onValueChange (onChange is the native event, and rich text has none). See docs/components/library-contract.mdx.',
      },
      {
        selector: "JSXOpeningElement[name.name=/^(Toggle|SubTabs)$/] > JSXAttribute[name.name=/^(active|activeKey|onChange)$/]",
        message: 'Toggle and SubTabs take value / defaultValue / onValueChange. See docs/components/library-contract.mdx.',
      },
      {
        selector: "JSXOpeningElement[name.name=/^(Toggle|SubTabs|Input|Select)$/] > JSXAttribute[name.name='size'] > Literal[value=/^(S|M)$/]",
        message: 'Sizes are sm | md (md is the default). See docs/components/library-contract.mdx.',
      },
      {
        selector: "JSXOpeningElement[name.name='ActionButton'] > JSXAttribute[name.name='state']",
        message: 'ActionButton has no state prop: use disabled, or tone="danger" for the destructive look. See docs/components/library-contract.mdx.',
      },
      {
        selector: "Property[key.name='fontSize'][value.type='Literal'][value.raw=/^\\d/]",
        message: 'Inline fontSize in px: use a rem-based CSS variable (var(--font-…)) via CSS Modules, not a raw number in style={{}}. See src/tokens/tokens.css.',
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
}, {
  // Layer blocks below repeat DEPRECATED: a later block's rule options replace
  // this one's for the files they cover.
  files: ['src/**/*.{js,jsx}'],
  rules: { 'no-restricted-imports': ['warn', { patterns: DEPRECATED }] },
},
  layerImports('primitives', ['patterns', 'app', 'domain']),
  layerImports('patterns', ['app', 'domain']),
  ...storybook.configs["flat/recommended"]])
