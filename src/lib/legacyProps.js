// Old prop names keep working while call sites move to the library contract
// (docs/components/library-contract.mdx); each one warns once in development.
const warned = new Set();

export function warnDeprecated(component, prop, value, next) {
  const key = `${component}.${prop}=${value}`;
  if (!import.meta.env?.DEV || warned.has(key)) return;
  warned.add(key);
  console.warn(`${component}: ${prop}${value === true ? '' : `="${value}"`} is deprecated; use ${next}. See docs/components/library-contract.mdx.`);
}

const LEGACY_FIELD_VARIANT = { default: 'outline', quiet: 'ghost' };
const LEGACY_FIELD_SIZE = { S: 'sm', M: 'md' };

/**
 * Text fields (Input, Select, Textarea) share one look vocabulary:
 * `variant` 'outline' | 'ghost', `invalid`, `size` 'sm' | 'md'.
 * Maps the old `variant="error" | "default" | "quiet"` onto it.
 */
export function resolveFieldLook(component, { variant, invalid, size }) {
  let v = variant ?? 'outline';
  let bad = Boolean(invalid);
  if (v === 'error') {
    warnDeprecated(component, 'variant', v, 'invalid');
    v = 'outline';
    bad = true;
  } else if (LEGACY_FIELD_VARIANT[v]) {
    const next = LEGACY_FIELD_VARIANT[v];
    if (v !== 'default') warnDeprecated(component, 'variant', v, `variant="${next}"`);
    v = next;
  }
  let z = size ?? 'md';
  if (LEGACY_FIELD_SIZE[z]) {
    warnDeprecated(component, 'size', z, `size="${LEGACY_FIELD_SIZE[z]}"`);
    z = LEGACY_FIELD_SIZE[z];
  }
  return { variant: v, invalid: bad, size: z };
}

/** Toggle / SubTabs: `size="S" | "M"` → 'sm' | 'md'. */
export function resolveSize(component, size) {
  if (!LEGACY_FIELD_SIZE[size]) return size;
  warnDeprecated(component, 'size', size, `size="${LEGACY_FIELD_SIZE[size]}"`);
  return LEGACY_FIELD_SIZE[size];
}
