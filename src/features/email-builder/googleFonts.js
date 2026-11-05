// Google Fonts catalogue used by the email builder.
//
// Each entry maps the value stored on a block (style.fontFamily) to:
//  - label:   what shows in the dropdown
//  - stack:   the CSS font-family stack (Google family name + fallbacks)
//  - googleFamily: the Google Fonts family name + weight axis, used to build
//                  the stylesheet URL (omit for system fonts that don't need
//                  to load anything from Google)
//
// Legacy values from the original Builder.js theme keys (MODERN_SANS,
// BOOK_SANS, etc.) are kept as aliases so existing documents keep rendering.

const SYSTEM_SANS = `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
const SYSTEM_SERIF = `Georgia, "Times New Roman", serif`;
const SYSTEM_MONO = `"Consolas", "Courier New", monospace`;

export const GOOGLE_FONTS = [
  { value: 'Inter',               label: 'Inter',               stack: `'Inter', ${SYSTEM_SANS}`,               googleFamily: 'Inter:wght@400;500;600;700' },
  { value: 'Roboto',              label: 'Roboto',              stack: `'Roboto', ${SYSTEM_SANS}`,              googleFamily: 'Roboto:wght@400;500;700' },
  { value: 'Open Sans',           label: 'Open Sans',           stack: `'Open Sans', ${SYSTEM_SANS}`,           googleFamily: 'Open+Sans:wght@400;600;700' },
  { value: 'Lato',                label: 'Lato',                stack: `'Lato', ${SYSTEM_SANS}`,                googleFamily: 'Lato:wght@400;700' },
  { value: 'Poppins',             label: 'Poppins',             stack: `'Poppins', ${SYSTEM_SANS}`,             googleFamily: 'Poppins:wght@400;500;600;700' },
  { value: 'Montserrat',          label: 'Montserrat',          stack: `'Montserrat', ${SYSTEM_SANS}`,          googleFamily: 'Montserrat:wght@400;500;600;700' },
  { value: 'Nunito',              label: 'Nunito',              stack: `'Nunito', ${SYSTEM_SANS}`,              googleFamily: 'Nunito:wght@400;600;700' },
  { value: 'Nunito Sans',         label: 'Nunito Sans',         stack: `'Nunito Sans', ${SYSTEM_SANS}`,         googleFamily: 'Nunito+Sans:wght@400;600;700' },
  { value: 'Raleway',             label: 'Raleway',             stack: `'Raleway', ${SYSTEM_SANS}`,             googleFamily: 'Raleway:wght@400;500;700' },
  { value: 'Work Sans',           label: 'Work Sans',           stack: `'Work Sans', ${SYSTEM_SANS}`,           googleFamily: 'Work+Sans:wght@400;500;700' },
  { value: 'DM Sans',             label: 'DM Sans',             stack: `'DM Sans', ${SYSTEM_SANS}`,             googleFamily: 'DM+Sans:wght@400;500;700' },
  { value: 'Manrope',             label: 'Manrope',             stack: `'Manrope', ${SYSTEM_SANS}`,             googleFamily: 'Manrope:wght@400;500;600;700' },
  { value: 'Plus Jakarta Sans',   label: 'Plus Jakarta Sans',   stack: `'Plus Jakarta Sans', ${SYSTEM_SANS}`,   googleFamily: 'Plus+Jakarta+Sans:wght@400;500;600;700' },
  { value: 'Source Sans 3',       label: 'Source Sans',         stack: `'Source Sans 3', ${SYSTEM_SANS}`,       googleFamily: 'Source+Sans+3:wght@400;600;700' },
  { value: 'IBM Plex Sans',       label: 'IBM Plex Sans',       stack: `'IBM Plex Sans', ${SYSTEM_SANS}`,       googleFamily: 'IBM+Plex+Sans:wght@400;500;600;700' },
  { value: 'Quicksand',           label: 'Quicksand',           stack: `'Quicksand', ${SYSTEM_SANS}`,           googleFamily: 'Quicksand:wght@400;500;600;700' },
  { value: 'Mulish',              label: 'Mulish',              stack: `'Mulish', ${SYSTEM_SANS}`,              googleFamily: 'Mulish:wght@400;500;700' },
  { value: 'Karla',               label: 'Karla',               stack: `'Karla', ${SYSTEM_SANS}`,               googleFamily: 'Karla:wght@400;500;700' },
  { value: 'PT Sans',             label: 'PT Sans',             stack: `'PT Sans', ${SYSTEM_SANS}`,             googleFamily: 'PT+Sans:wght@400;700' },
  { value: 'Rubik',               label: 'Rubik',               stack: `'Rubik', ${SYSTEM_SANS}`,               googleFamily: 'Rubik:wght@400;500;700' },

  { value: 'Playfair Display',    label: 'Playfair Display',    stack: `'Playfair Display', ${SYSTEM_SERIF}`,   googleFamily: 'Playfair+Display:wght@400;600;700' },
  { value: 'Merriweather',        label: 'Merriweather',        stack: `'Merriweather', ${SYSTEM_SERIF}`,       googleFamily: 'Merriweather:wght@400;700' },
  { value: 'Lora',                label: 'Lora',                stack: `'Lora', ${SYSTEM_SERIF}`,               googleFamily: 'Lora:wght@400;500;700' },
  { value: 'PT Serif',            label: 'PT Serif',            stack: `'PT Serif', ${SYSTEM_SERIF}`,           googleFamily: 'PT+Serif:wght@400;700' },
  { value: 'Source Serif 4',      label: 'Source Serif',        stack: `'Source Serif 4', ${SYSTEM_SERIF}`,     googleFamily: 'Source+Serif+4:wght@400;600;700' },
  { value: 'Crimson Text',        label: 'Crimson Text',        stack: `'Crimson Text', ${SYSTEM_SERIF}`,       googleFamily: 'Crimson+Text:wght@400;600;700' },
  { value: 'Cormorant Garamond',  label: 'Cormorant Garamond',  stack: `'Cormorant Garamond', ${SYSTEM_SERIF}`, googleFamily: 'Cormorant+Garamond:wght@400;500;600;700' },
  { value: 'EB Garamond',         label: 'EB Garamond',         stack: `'EB Garamond', ${SYSTEM_SERIF}`,        googleFamily: 'EB+Garamond:wght@400;500;700' },

  { value: 'JetBrains Mono',      label: 'JetBrains Mono',      stack: `'JetBrains Mono', ${SYSTEM_MONO}`,      googleFamily: 'JetBrains+Mono:wght@400;500;700' },
  { value: 'Fira Code',           label: 'Fira Code',           stack: `'Fira Code', ${SYSTEM_MONO}`,           googleFamily: 'Fira+Code:wght@400;500;700' },
  { value: 'IBM Plex Mono',       label: 'IBM Plex Mono',       stack: `'IBM Plex Mono', ${SYSTEM_MONO}`,       googleFamily: 'IBM+Plex+Mono:wght@400;500;700' },
];

// Legacy theme keys → Google font equivalents. Existing documents stored these
// strings; resolve them so old emails keep their original visual feel.
const LEGACY_ALIASES = {
  MODERN_SANS:    'Inter',
  BOOK_SANS:      'Open Sans',
  ORGANIC_SANS:   'Lato',
  GEOMETRIC_SANS: 'DM Sans',
  HEAVY_SANS:     'Montserrat',
  ROUNDED_SANS:   'Nunito',
  MODERN_SERIF:   'Playfair Display',
  BOOK_SERIF:     'Merriweather',
  MONOSPACE:      'JetBrains Mono',
};

const BY_VALUE = new Map(GOOGLE_FONTS.map(f => [f.value, f]));

// Resolve any stored fontFamily value into the canonical Google font entry.
// Falls back to Inter when the value is unknown so the email keeps rendering.
export function resolveFont(value) {
  if (!value) return BY_VALUE.get('Inter');
  if (BY_VALUE.has(value)) return BY_VALUE.get(value);
  const aliased = LEGACY_ALIASES[value];
  if (aliased && BY_VALUE.has(aliased)) return BY_VALUE.get(aliased);
  return BY_VALUE.get('Inter');
}

// CSS font stack for a stored value, used by InlineEditable + patchEmailHtml.
export function getFontStack(value) {
  return resolveFont(value).stack;
}

// Build a Google Fonts stylesheet URL covering every family in the catalogue.
// Passing it through display=swap means the system fallback shows immediately
// and the web font fades in once loaded.
export function getGoogleFontsHref() {
  const families = GOOGLE_FONTS.map(f => `family=${f.googleFamily}`).join('&');
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

// Inject the Google Fonts stylesheet into the host document exactly once so
// the canvas + InlineEditable previews render with the actual web fonts.
let injected = false;
export function injectGoogleFonts() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = getGoogleFontsHref();
  document.head.appendChild(link);
}

// Canonical names for the standard CSS font-weight axis. Used by the
// weight dropdown in the Properties panel so the user sees "SemiBold 600"
// rather than a bare number.
const WEIGHT_LABELS = {
  100: 'Thin',
  200: 'ExtraLight',
  300: 'Light',
  400: 'Regular',
  500: 'Medium',
  600: 'SemiBold',
  700: 'Bold',
  800: 'ExtraBold',
  900: 'Black',
};

// Parse a font's `googleFamily` axis string (e.g. "Inter:wght@400;500;700")
// and return [{ value: '400', label: 'Regular 400' }, …] for every weight
// that family actually ships. Falls back to Regular/Bold when the entry
// has no axis info (system fonts).
export function availableWeights(value) {
  const font = resolveFont(value);
  const axis = font?.googleFamily || '';
  const m = axis.match(/wght@([\d;]+)/);
  const weights = m
    ? m[1].split(';').map(n => Number(n)).filter(n => Number.isFinite(n))
    : [400, 700];
  return weights.map(w => ({
    value: String(w),
    label: `${WEIGHT_LABELS[w] || w} ${w}`,
  }));
}

// Legacy weight tokens ('normal', 'bold') stored on existing documents
// resolve to numeric weights so the dropdown can match them.
export function normalizeWeight(w) {
  if (w == null) return '400';
  const s = String(w).trim();
  if (s === 'normal') return '400';
  if (s === 'bold') return '700';
  if (/^\d+$/.test(s)) return s;
  return '400';
}
