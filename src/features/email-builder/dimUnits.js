// Unit-aware parsing/formatting for `lineHeight` and `letterSpacing` style
// fields. Storage stays backward-compatible: legacy numeric values are
// interpreted with the field's default unit; explicit units use a string
// (e.g. "18px", "120%", "5%"). CSS letter-spacing doesn't natively accept
// percent, so % is translated to em (1em = 100% = font-size).

export function parseLineHeight(value) {
  if (value == null || value === '') return { value: 120, unit: '%' };
  if (typeof value === 'number') return { value: Math.round(value * 100), unit: '%' };
  const num = parseFloat(value);
  if (Number.isNaN(num)) return { value: 120, unit: '%' };
  if (typeof value === 'string') {
    if (value.endsWith('px')) return { value: num, unit: 'px' };
    if (value.endsWith('%')) return { value: num, unit: '%' };
  }
  return { value: Math.round(num * 100), unit: '%' };
}

export function formatLineHeight(value, unit) {
  const num = parseFloat(value);
  if (Number.isNaN(num)) return null;
  if (unit === 'px') return `${num}px`;
  return num / 100; // unitless multiplier, what `style.lineHeight` accepts
}

export function parseLetterSpacing(value) {
  if (value == null || value === '') return { value: 0, unit: 'px' };
  if (typeof value === 'number') return { value, unit: 'px' };
  const num = parseFloat(value);
  if (Number.isNaN(num)) return { value: 0, unit: 'px' };
  if (typeof value === 'string' && value.endsWith('%')) return { value: num, unit: '%' };
  return { value: num, unit: 'px' };
}

export function formatLetterSpacing(value, unit) {
  const num = parseFloat(value);
  if (Number.isNaN(num)) return null;
  return unit === '%' ? `${num}%` : num;
}

// CSS rendering: letter-spacing in CSS doesn't accept %, convert to em.
export function formatLetterSpacingCss(value) {
  if (value == null || value === '') return undefined;
  if (typeof value === 'number') return `${value}px`;
  if (typeof value === 'string' && value.endsWith('%')) {
    const num = parseFloat(value);
    return Number.isNaN(num) ? undefined : `${num / 100}em`;
  }
  return value;
}
