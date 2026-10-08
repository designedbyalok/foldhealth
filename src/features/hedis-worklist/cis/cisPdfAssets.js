import interRegularUrl from '../../../assets/fonts/inter/Inter-Regular.ttf?url';
import interMediumUrl from '../../../assets/fonts/inter/Inter-Medium.ttf?url';

// Branded PDF assets for the CIS-CMB10 schedule / record (Patient Summary
// report layout): Inter, the Trailhead and Astrana logos, and the footer's
// contact icons. Loaded once per session; anything that fails to load is
// left out and the PDF falls back (Helvetica, the brand name as text).
const TRAILHEAD_LOGO = '/brand/trailhead-clinics-logo.png';
const ASTRANA_LOGO = '/brand/astrana-health-logo.svg';
const ICONS = {
  phone: '/brand/icon-phone-white.svg',
  mail: '/brand/icon-mail-white.svg',
  map: '/brand/icon-map-point-white.svg',
};

const toBase64 = (buf) => {
  let bin = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
};
const font = (url) => fetch(url).then(r => r.arrayBuffer()).then(toBase64);

// The logo is already a PNG: passed through as a data URL.
const dataUrl = (url) => fetch(url).then(r => r.arrayBuffer())
  .then(buf => ({ dataUrl: `data:image/png;base64,${toBase64(buf)}` }))
  .catch(() => null);
// jsPDF places PNGs only, so each SVG is drawn to a canvas (4x, or more
// for a small wordmark).
const png = (url, scale = 4) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    resolve({ dataUrl: canvas.toDataURL('image/png'), width: img.naturalWidth, height: img.naturalHeight });
  };
  img.onerror = () => resolve(null);
  img.src = url;
});

let cache = null;

/** @returns {Promise<{ fonts: { regular, medium } | null, logos: { trailhead, astrana }, icons: { phone, mail, map } }>} */
export function loadCisPdfAssets() {
  cache ||= Promise.all([
    Promise.all([font(interRegularUrl), font(interMediumUrl)])
      .then(([regular, medium]) => ({ regular, medium }))
      .catch(() => null),
    Promise.all([dataUrl(TRAILHEAD_LOGO), png(ASTRANA_LOGO, 8)]).then(([trailhead, astrana]) => ({ trailhead, astrana })),
    Promise.all(Object.entries(ICONS).map(([k, url]) => png(url).then(v => [k, v]))).then(Object.fromEntries),
  ]).then(([fonts, logos, icons]) => ({ fonts, logos, icons }));
  return cache;
}
