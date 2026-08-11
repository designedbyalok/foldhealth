// Color & gradient helpers for the email builder color picker.
//
// Storage model: a "color value" is either:
//   • a hex string ('#RRGGBB') — solid
//   • a CSS gradient string ('linear-gradient(90deg, #FFFFFF 0%, #000000 100%)')
//
// Helpers below parse, format, and convert between hex/RGB/HSV for the
// custom picker; plus split top-level commas so gradient stops with their
// own commas (e.g. inside rgb()) stay together.

const GRADIENT_RE = /^(?:repeating-)?(?:linear|radial|conic)-gradient\s*\(/i;

export function isGradient(value) {
  return typeof value === 'string' && GRADIENT_RE.test(value.trim());
}

// Split a string by top-level delimiter, respecting parens. Used to split
// gradient stops so `rgb(0, 0, 0)` doesn't get torn apart.
function splitTopLevel(str, delim) {
  const out = [];
  let depth = 0;
  let buf = '';
  for (const ch of str) {
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === delim && depth === 0) {
      out.push(buf);
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf.length) out.push(buf);
  const trimmed = [];
  for (const s of out) {
    const t = s.trim();
    if (t) trimmed.push(t);
  }
  return trimmed;
}

// Parse "linear-gradient(90deg, #FFF 0%, #000 100%)" into a structured object.
// Returns null when the string isn't a (linear|radial)-gradient — callers
// should fall back to solid-color handling in that case.
export function parseGradient(str) {
  if (!isGradient(str)) return null;
  const m = str.trim().match(/^(linear|radial)-gradient\s*\(([\s\S]+)\)\s*$/i);
  if (!m) return null;
  const type = m[1].toLowerCase();
  const parts = splitTopLevel(m[2], ',');
  if (!parts.length) return null;

  let angle = 90;
  let stopParts = parts;
  if (type === 'linear' && /^-?\d+(?:\.\d+)?(?:deg|turn|rad|grad)$/i.test(parts[0])) {
    angle = parseFloat(parts[0]);
    stopParts = parts.slice(1);
  } else if (type === 'linear' && /^to\s+/i.test(parts[0])) {
    angle = 90;
    stopParts = parts.slice(1);
  }

  const stops = stopParts.map((p, i) => {
    const sm = p.match(/^(.+?)\s+(-?\d+(?:\.\d+)?)\s*%$/);
    if (sm) return { color: sm[1].trim(), position: parseFloat(sm[2]) };
    return { color: p.trim(), position: (i / Math.max(1, stopParts.length - 1)) * 100 };
  });

  if (stops.length < 2) {
    stops.push({ color: '#000000', position: 100 });
  }
  return { type, angle, stops };
}

export function formatGradient({ type = 'linear', angle = 90, stops = [] }) {
  const head = type === 'linear' ? `${angle}deg, ` : '';
  const body = stops
    .map(s => `${s.color} ${Math.round(s.position)}%`)
    .join(', ');
  return `${type}-gradient(${head}${body})`;
}

// Pull the first stop's color out of a gradient — used as an email fallback
// when a client can't render gradient text or backgrounds.
export function firstStopColor(gradient) {
  const g = parseGradient(gradient);
  return g?.stops?.[0]?.color || '#000000';
}

// ── HEX / RGB / HSV conversion ───────────────────────────────────────────
// Always returns an opaque 6-digit hex. An 8-digit input has its alpha
// dropped rather than rejected — callers that need the alpha use splitAlpha.
export function normalizeHex(input) {
  if (!input) return '#000000';
  let h = String(input).trim();
  if (!h.startsWith('#')) h = '#' + h;
  if (/^#[0-9a-f]{3,4}$/i.test(h)) {
    h = '#' + h.slice(1, 4).split('').map(c => c + c).join('');
  }
  if (/^#[0-9a-f]{8}$/i.test(h)) h = h.slice(0, 7);
  if (!/^#[0-9a-f]{6}$/i.test(h)) return '#000000';
  return h.toUpperCase();
}

// ── Alpha ────────────────────────────────────────────────────────────────
// Opacity rides along in the value string as an 8-digit hex (#RRGGBBAA), so
// a color stays a single CSS-valid string everywhere it is stored or piped.
export function splitAlpha(input) {
  const raw = String(input ?? '').trim();
  const eight = raw.match(/^#?([0-9a-f]{8})$/i);
  const four = raw.match(/^#?([0-9a-f]{4})$/i);
  if (eight) {
    return { hex: normalizeHex(`#${eight[1].slice(0, 6)}`), alpha: parseInt(eight[1].slice(6), 16) / 255 };
  }
  if (four) {
    const c = four[1];
    return { hex: normalizeHex(`#${c.slice(0, 3)}`), alpha: parseInt(c[3] + c[3], 16) / 255 };
  }
  return { hex: normalizeHex(raw), alpha: 1 };
}

export function withAlpha(hex, alpha = 1) {
  const base = normalizeHex(hex);
  if (alpha >= 1) return base;
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, '0');
  return `${base}${a.toUpperCase()}`;
}

// Matches a translucent hex (#RRGGBBAA or #RGBA) without matching the first
// four characters of an opaque #RRGGBB — the lookahead is what excludes it.
const TRANSLUCENT_HEX = /#(?:[0-9a-f]{8}|[0-9a-f]{4})(?![0-9a-f])/gi;

export function hasTranslucentHex(value) {
  return new RegExp(TRANSLUCENT_HEX.source, 'i').test(String(value ?? ''));
}

// Composite a translucent color onto an opaque backdrop. Needed wherever
// alpha can't be expressed — an opaque approximation beats no color at all.
export function flattenAlpha(value, backdrop = '#FFFFFF') {
  const { hex, alpha } = splitAlpha(value);
  if (alpha >= 1) return hex;
  const fg = hexToRgb(hex);
  const bg = hexToRgb(backdrop);
  return rgbToHex({
    r: fg.r * alpha + bg.r * (1 - alpha),
    g: fg.g * alpha + bg.g * (1 - alpha),
    b: fg.b * alpha + bg.b * (1 - alpha),
  });
}

// '#7C5CFA59' → 'rgba(124, 92, 250, 0.35)'. Opaque input is returned as hex,
// since there's nothing to gain from the longer form.
export function toRgbaCss(value) {
  const { hex, alpha } = splitAlpha(value);
  if (alpha >= 1) return hex;
  const { r, g, b } = hexToRgb(hex);
  const a = Math.round(alpha * 1000) / 1000;
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;
}

// Rewrite every translucent hex inside a CSS value with `fn`. Used to make a
// whole declaration email-safe without having to parse the CSS around it.
export function mapTranslucentHex(value, fn) {
  return String(value ?? '').replace(new RegExp(TRANSLUCENT_HEX.source, 'gi'), (m) => fn(m));
}

export function hexToRgb(hex) {
  const h = normalizeHex(hex);
  return {
    r: parseInt(h.slice(1, 3), 16),
    g: parseInt(h.slice(3, 5), 16),
    b: parseInt(h.slice(5, 7), 16),
  };
}

export function rgbToHex({ r, g, b }) {
  const toHex = (n) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function rgbToHsv({ r, g, b }) {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rr) h = ((gg - bb) / d) % 6;
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h, s, v };
}

export function hsvToRgb({ h, s, v }) {
  const c = v * s;
  const hh = (h % 360) / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (0 <= hh && hh < 1)      { r = c; g = x; b = 0; }
  else if (1 <= hh && hh < 2) { r = x; g = c; b = 0; }
  else if (2 <= hh && hh < 3) { r = 0; g = c; b = x; }
  else if (3 <= hh && hh < 4) { r = 0; g = x; b = c; }
  else if (4 <= hh && hh < 5) { r = x; g = 0; b = c; }
  else                        { r = c; g = 0; b = x; }
  const m = v - c;
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

export function hexToHsv(hex) { return rgbToHsv(hexToRgb(hex)); }
export function hsvToHex(hsv) { return rgbToHex(hsvToRgb(hsv)); }

// ── HSL ──────────────────────────────────────────────────────────────────
export function rgbToHsl({ r, g, b }) {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0, s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === rr) h = ((gg - bb) / d) % 6;
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, l };
}

export function hslToRgb({ h, s, l }) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hh = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hh < 1)      { r = c; g = x; }
  else if (hh < 2) { r = x; g = c; }
  else if (hh < 3) { g = c; b = x; }
  else if (hh < 4) { g = x; b = c; }
  else if (hh < 5) { r = x; b = c; }
  else             { r = c; b = x; }
  const m = l - c / 2;
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

export function hexToHsl(hex) { return rgbToHsl(hexToRgb(hex)); }
export function hslToHex(hsl) { return rgbToHex(hslToRgb(hsl)); }

// ── OKLCH ────────────────────────────────────────────────────────────────
// sRGB ⇄ Oklab per Björn Ottosson's published matrices, then Lab → LCH polar.
const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linearToSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

export function rgbToOklch({ r, g, b }) {
  const lr = srgbToLinear(r / 255), lg = srgbToLinear(g / 255), lb = srgbToLinear(b / 255);
  const l_ = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m_ = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s_ = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
  const C = Math.sqrt(a * a + bb * bb);
  let H = (Math.atan2(bb, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { l: L, c: C, h: C < 1e-6 ? 0 : H };
}

export function oklchToRgb({ l, c, h }) {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  const lr = +4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_;
  const lg = -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_;
  const lb = -0.0041960863 * l_ - 0.7034186147 * m_ + 1.7076147010 * s_;
  const to255 = (v) => Math.max(0, Math.min(255, linearToSrgb(v) * 255));
  return { r: to255(lr), g: to255(lg), b: to255(lb) };
}

export function hexToOklch(hex) { return rgbToOklch(hexToRgb(hex)); }
export function oklchToHex(oklch) { return rgbToHex(oklchToRgb(oklch)); }

// ── Display modes ────────────────────────────────────────────────────────
// The stored value is always a hex (8-digit when translucent); a mode only
// changes how that value is shown and typed in the value field.
export const COLOR_MODES = [
  { value: 'hex', label: 'Hex' },
  { value: 'rgb', label: 'RGB' },
  { value: 'hsl', label: 'HSL' },
  { value: 'hsb', label: 'HSB' },
  { value: 'oklch', label: 'OKLCH' },
  { value: 'css', label: 'CSS' },
];

const r1 = (n) => Math.round(n);
const pct = (n) => `${Math.round(n * 100)}%`;

export function formatColor(hex, alpha, mode) {
  const base = normalizeHex(hex);
  switch (mode) {
    case 'rgb': {
      const { r, g, b } = hexToRgb(base);
      return `${r1(r)}, ${r1(g)}, ${r1(b)}`;
    }
    case 'hsl': {
      const { h, s, l } = hexToHsl(base);
      return `${r1(h)}, ${pct(s)}, ${pct(l)}`;
    }
    case 'hsb': {
      const { h, s, v } = hexToHsv(base);
      return `${r1(h)}, ${pct(s)}, ${pct(v)}`;
    }
    case 'oklch': {
      const { l, c, h } = hexToOklch(base);
      return `${l.toFixed(3)} ${c.toFixed(3)} ${r1(h)}`;
    }
    case 'css': {
      const { r, g, b } = hexToRgb(base);
      // CSS mode is the copy-paste form, so it carries the alpha inline.
      return alpha >= 1
        ? `rgb(${r1(r)} ${r1(g)} ${r1(b)})`
        : `rgb(${r1(r)} ${r1(g)} ${r1(b)} / ${Math.round(alpha * 100)}%)`;
    }
    default:
      return base;
  }
}

// Parse what the user typed for `mode`. Returns { hex, alpha } or null when
// the text isn't complete/valid yet, so callers can keep the draft as-is.
// Alpha only comes back when the syntax carries one (8-digit hex, CSS slash).
export function parseColor(text, mode) {
  const raw = String(text ?? '').trim();
  if (!raw) return null;
  const nums = raw.match(/-?\d*\.?\d+/g)?.map(Number) || [];

  const hexish = raw.match(/^#?([0-9a-f]{3,8})$/i);
  if (mode === 'hex' || (hexish && mode === 'css')) {
    if (!hexish) return null;
    const len = hexish[1].length;
    if (len !== 3 && len !== 4 && len !== 6 && len !== 8) return null;
    return splitAlpha(raw);
  }

  switch (mode) {
    case 'rgb':
      if (nums.length < 3) return null;
      return { hex: rgbToHex({ r: nums[0], g: nums[1], b: nums[2] }) };
    case 'hsl':
      if (nums.length < 3) return null;
      return { hex: hslToHex({ h: nums[0], s: nums[1] / 100, l: nums[2] / 100 }) };
    case 'hsb':
      if (nums.length < 3) return null;
      return { hex: hsvToHex({ h: nums[0], s: nums[1] / 100, v: nums[2] / 100 }) };
    case 'oklch':
      if (nums.length < 3) return null;
      return { hex: oklchToHex({ l: nums[0], c: nums[1], h: nums[2] }) };
    case 'css': {
      // rgb()/rgba() and hsl()/hsla(), with the alpha as 0–1 or a percentage.
      const fn = raw.match(/^(rgba?|hsla?)\(([^)]*)\)$/i);
      if (!fn || nums.length < 3) return null;
      const isPctAlpha = /\/\s*-?\d*\.?\d+\s*%/.test(raw) || /,\s*-?\d*\.?\d+\s*%\s*\)$/.test(raw);
      const alpha = nums.length >= 4 ? Math.max(0, Math.min(1, isPctAlpha ? nums[3] / 100 : nums[3])) : 1;
      const hex = /^hsl/i.test(fn[1])
        ? hslToHex({ h: nums[0], s: nums[1] / 100, l: nums[2] / 100 })
        : rgbToHex({ r: nums[0], g: nums[1], b: nums[2] });
      return { hex, alpha };
    }
    default:
      return null;
  }
}
