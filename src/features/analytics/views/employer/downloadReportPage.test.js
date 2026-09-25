import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildReportPage } from './downloadReportPage';

afterEach(() => vi.unstubAllGlobals());

describe('Download HTML', () => {
  it('inlines the viewer with the page snapshot, safely', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => ({
      ok: true,
      text: async () => (url.endsWith('.js') ? 'console.log("</script>")' : '.x{color:red}'),
    })));
    const snapshot = { state: { scope: 'patient', employerName: 'Northwind </script>' }, filters: {}, rows: [{ m: 'calls', v: 3 }] };
    const html = await (await buildReportPage(snapshot, 'Report <b>')).text();
    expect(html).toContain('<title>Report &lt;b&gt;</title>');
    expect(html).toContain('.x{color:red}');
    expect(html).toContain('window.__FOLD_REPORT__ = ');
    // Neither the data nor the code can close a <script> early.
    expect(html.match(/<\/script>/g)).toHaveLength(2);
    const data = html.match(/window.__FOLD_REPORT__ = (.*);<\/script>/)[1];
    expect(JSON.parse(data).state.employerName).toBe('Northwind </script>');
  });

  it('fails clearly when the viewer is not built', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
    await expect(buildReportPage({}, 'R')).rejects.toThrow('Report viewer not built');
  });
});
