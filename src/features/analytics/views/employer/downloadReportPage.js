/**
 * Print → Download HTML: the Employer Impact page as one self-contained,
 * interactive file. The report viewer (src/report-viewer, built into
 * public/report-viewer) is inlined with a snapshot of the page: its
 * filters, layout and data. The file opens offline, read-only.
 */
const VIEWER = ['report-viewer.js', 'report-viewer.css'];

const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

/**
 * @param {{ state: object, filters: object, rows: object[] }} snapshot – From EmployerImpactView
 * @param {string} title – The file's <title>
 * @returns {Promise<Blob>} text/html; rejects if the viewer isn't built
 */
export async function buildReportPage(snapshot, title) {
  const base = `${import.meta.env.BASE_URL || '/'}report-viewer/`;
  const [js, css] = await Promise.all(VIEWER.map(file => fetch(base + file).then((r) => {
    if (!r.ok) throw new Error(`Report viewer not built (${file})`);
    return r.text();
  })));
  // Inside <script>: "<" escaped in the data, and "</script" in the code,
  // so nothing can end the tag early.
  const data = JSON.stringify(snapshot).replace(/</g, '\\u003c');
  const code = js.replace(/<\/script/gi, '<\\/script');
  const html = `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<script>window.__FOLD_REPORT__ = ${data};</script>
<script>${code}</script>
</body>
</html>`;
  return new Blob([html], { type: 'text/html;charset=utf-8' });
}
