/**
 * Fonts offered for the report cover's title and introduction. Inter is
 * always loaded for the PDF; the others (Google Fonts, OFL, in
 * src/assets/fonts) are fetched only when picked.
 */
const FILES = import.meta.glob('../../../../assets/fonts/*/*.ttf', { query: '?url', import: 'default', eager: true });

const WEIGHT_FILES = { regular: 'Regular', medium: 'Medium', semibold: 'SemiBold', bold: 'Bold' };

export const REPORT_FONTS = [
  { value: 'Inter', label: 'Inter', kind: 'sans' },
  { value: 'Roboto', label: 'Roboto', kind: 'sans', dir: 'roboto', file: 'Roboto' },
  { value: 'Open Sans', label: 'Open Sans', kind: 'sans', dir: 'open-sans', file: 'OpenSans' },
  { value: 'Montserrat', label: 'Montserrat', kind: 'sans', dir: 'montserrat', file: 'Montserrat' },
  { value: 'Poppins', label: 'Poppins', kind: 'sans', dir: 'poppins', file: 'Poppins' },
  { value: 'Lora', label: 'Lora', kind: 'serif', dir: 'lora', file: 'Lora' },
  { value: 'Playfair Display', label: 'Playfair Display', kind: 'serif', dir: 'playfair-display', file: 'PlayfairDisplay' },
  { value: 'Source Serif 4', label: 'Source Serif 4', kind: 'serif', dir: 'source-serif-4', file: 'SourceSerif4' },
  { value: 'EB Garamond', label: 'EB Garamond', kind: 'serif', dir: 'eb-garamond', file: 'EBGaramond' },
];

const fontUrl = (font, weight) => FILES[`../../../../assets/fonts/${font.dir}/${font.file}-${WEIGHT_FILES[weight]}.ttf`];

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

const pdfCache = new Map();
/**
 * A family's four weights as base64 TTFs for jsPDF, or null for Inter (already
 * loaded) or when they can't be fetched (the cover then uses Inter).
 */
export function loadReportFont(family) {
  const font = REPORT_FONTS.find(f => f.value === family);
  if (!font?.dir) return Promise.resolve(null);
  if (!pdfCache.has(family)) {
    pdfCache.set(family, Promise.all(Object.keys(WEIGHT_FILES).map(w => fetch(fontUrl(font, w))
      .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(family))))
      .then(buf => [w, toBase64(buf)])))
      .then(Object.fromEntries)
      .catch(() => null));
  }
  return pdfCache.get(family);
}

let previewsPromise = null;
/** Registers each font's Regular in the page, so the dropdown can show names in their own font. */
export function loadFontPreviews() {
  if (!previewsPromise) {
    previewsPromise = Promise.all(REPORT_FONTS.filter(f => f.dir).map((f) => {
      const face = new FontFace(f.value, `url(${fontUrl(f, 'regular')})`);
      return face.load().then(() => document.fonts.add(face)).catch(() => {});
    }));
  }
  return previewsPromise;
}
