// Local-time display formats shared by the app and the component library.
const pad = (n) => String(n).padStart(2, '0');

/** "09/11/2026" */
export function formatDate(v) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;
}

/** "09/11/2026, 02:00AM" */
export function formatDateTime(v) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const h = d.getHours() % 12 || 12;
  return `${formatDate(d)}, ${pad(h)}:${pad(d.getMinutes())}${d.getHours() < 12 ? 'AM' : 'PM'}`;
}
