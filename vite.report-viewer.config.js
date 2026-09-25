import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

/**
 * Report viewer build: the Employer Impact page as one IIFE script plus one
 * stylesheet in public/report-viewer, inlined by Print → Download HTML into
 * a self-contained file (see src/report-viewer/main.jsx).
 *
 * The app store and the two drawers are swapped for stand-ins, so the
 * bundle carries no Supabase, jsPDF or app state. Every asset is inlined
 * (fonts, images) because the downloaded file has no server to fetch from.
 */
const dirname = import.meta.dirname;
const stub = (file) => path.resolve(dirname, 'src/report-viewer', file);

function viewerStubs() {
  const swaps = [
    [/\/store\/useAppStore(\.js)?$/, stub('snapshotStore.js')],
    [/\/PrintReportDrawer(\.jsx)?$/, stub('noDrawer.js')],
    [/\/UpdateDashboardDrawer(\.jsx)?$/, stub('noDrawer.js')],
  ];
  return {
    name: 'report-viewer-stubs',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer || importer.includes('/src/report-viewer/')) return null;
      const hit = swaps.find(([re]) => re.test(source));
      return hit ? hit[1] : null;
    },
  };
}

export default defineConfig({
  plugins: [viewerStubs(), tailwindcss(), react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    __APP_VERSION__: JSON.stringify('report-viewer'),
  },
  resolve: { alias: { '@': path.resolve(dirname, './src') } },
  publicDir: false,
  build: {
    outDir: 'public/report-viewer',
    emptyOutDir: true,
    assetsInlineLimit: 100 * 1024 * 1024,
    cssCodeSplit: false,
    lib: {
      entry: path.resolve(dirname, 'src/report-viewer/main.jsx'),
      formats: ['iife'],
      name: 'FoldReportViewer',
      fileName: () => 'report-viewer.js',
      cssFileName: 'report-viewer',
    },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
