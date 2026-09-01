// Template-based care plan export (roadmap #13). The download is a formatted
// document generated from a template, not a raw dump — today there is one
// "standard" template; the format id is carried through so more can be added.
// The file is a self-contained HTML document (inline styles) so it opens and
// prints anywhere without the app.

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
));

function goalRows(goals) {
  if (!goals.length) return '<tr><td colspan="3" class="empty">No goals included.</td></tr>';
  return goals.map(g => `
    <tr>
      <td>${esc(g.title)}${g.subtitle ? `<div class="sub">${esc(g.subtitle)}</div>` : ''}</td>
      <td>${esc(g.currentValue || '—')}</td>
      <td>${esc(g.status || '—')}</td>
    </tr>`).join('');
}

function interventionRows(interventions) {
  if (!interventions.length) return '<tr><td colspan="3" class="empty">No interventions included.</td></tr>';
  return interventions.map(i => `
    <tr>
      <td>${esc(i.title)}</td>
      <td>${esc(i.assignee?.name || '—')}</td>
      <td>${esc(i.status || '—')}</td>
    </tr>`).join('');
}

function barrierRows(barriers) {
  if (!barriers.length) return '<tr><td colspan="2" class="empty">No barriers included.</td></tr>';
  return barriers.map(b => `
    <tr>
      <td>${esc(b.title)}${b.description ? `<div class="sub">${esc(b.description)}</div>` : ''}</td>
      <td>${esc(b.status || '—')}</td>
    </tr>`).join('');
}

/**
 * Build the export document HTML from the selected elements.
 * @param {{patientName?:string, programName?:string, sharedBy?:string, date?:string}} meta
 * @param {{conditions:string[], goals:Array, interventions:Array, barriers?:Array}} selection
 */
export function buildCarePlanHtml(meta, selection) {
  const { patientName = 'Patient', programName = '', sharedBy = '', date = '' } = meta;
  const conditions = selection.conditions.length
    ? selection.conditions.map(c => `<span class="chip">${esc(c)}</span>`).join('')
    : '<span class="muted">None recorded</span>';

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Care Plan — ${esc(patientName)}</title>
<style>
  :root { color-scheme: light; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1a2320; margin: 0; padding: 40px; background: #fff; }
  .wrap { max-width: 760px; margin: 0 auto; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .meta { color: #5a6a65; font-size: 13px; margin-bottom: 24px; }
  h2 { font-size: 15px; margin: 28px 0 10px; border-bottom: 1px solid #e2e8e5; padding-bottom: 6px; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { border: 1px solid #cfe0da; border-radius: 999px; padding: 2px 10px; font-size: 12px; color: #2f6b5e; }
  .muted { color: #97a4a0; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; color: #5a6a65; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; padding: 6px 8px; border-bottom: 1px solid #e2e8e5; }
  td { padding: 10px 8px; border-bottom: 1px solid #eef2f0; vertical-align: top; }
  td .sub { color: #7a8783; font-size: 12px; margin-top: 2px; }
  td.empty { color: #97a4a0; text-align: center; padding: 16px; }
  footer { margin-top: 32px; color: #97a4a0; font-size: 11px; }
</style></head>
<body><div class="wrap">
  <h1>Care Plan</h1>
  <div class="meta">${esc(patientName)}${programName ? ` · ${esc(programName)}` : ''}${date ? ` · ${esc(date)}` : ''}${sharedBy ? ` · Prepared by ${esc(sharedBy)}` : ''}</div>

  <h2>Conditions</h2>
  <div class="chips">${conditions}</div>

  <h2>Goals</h2>
  <table><thead><tr><th>Goal</th><th>Current Value</th><th>Status</th></tr></thead>
  <tbody>${goalRows(selection.goals)}</tbody></table>

  <h2>Interventions</h2>
  <table><thead><tr><th>Intervention</th><th>Assigned To</th><th>Status</th></tr></thead>
  <tbody>${interventionRows(selection.interventions)}</tbody></table>

  <h2>Barriers</h2>
  <table><thead><tr><th>Barrier</th><th>Status</th></tr></thead>
  <tbody>${barrierRows(selection.barriers || [])}</tbody></table>

  <footer>Generated from Fold Health. This document reflects the selected elements of the care plan at export time.</footer>
</div></body></html>`;
}

// Trigger a browser download of the document. Same blob-anchor pattern the
// letters download uses.
export function downloadCarePlanDocument(html, filename) {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
