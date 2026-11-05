/** @type { import('@storybook/react-vite').StorybookConfig } */
const config = {
  stories: [
    '../src/components/**/*.stories.@(js|jsx)',
    '../src/features/**/*.stories.@(js|jsx)',
  ],
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-a11y',
    '@storybook/addon-vitest'
  ],
  framework: '@storybook/react-vite',
  // Force Vite to pre-bundle @testing-library/dom's CJS transitive deps.
  // Their CJS output declares named exports via patterns Vite's runtime
  // cjs-module-lexer can't detect (chained `exports.X = exports.Y = void 0`,
  // then `var X = exports.X = value`): esbuild's dep-optimizer handles them
  // correctly, so pre-bundling routes past the runtime interop. Fixes
  // @storybook/addon-vitest failing to import
  // setup-file-with-project-annotations.js in browser mode.
  async viteFinal(cfg) {
    cfg.optimizeDeps ||= {};
    cfg.optimizeDeps.include = [
      ...(cfg.optimizeDeps.include || []),
      'aria-query',
      'lz-string',
      'dom-accessibility-api',
      'pretty-format',
    ];
    return cfg;
  },
};
export default config;
