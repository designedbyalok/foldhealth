/**
 * Three horizontal stroke-only circles. Lighter visual weight than the
 * Solar `menu-dots-bold` (filled discs) or `menu-dots-linear` (wider spacing),
 * matching the Fold custom spec.
 *
 * Usage: <Icon name="custom:menu-dots" size={16} color="var(--neutral-300)" />
 */
export function MenuDotsIcon({ size = 16, color = 'var(--neutral-300)' }) {
  // Three horizontal stroke-only circles. The user's reference SVG used a
  // 24×24 viewBox with tiny radius-1.33 circles that disappeared at 16px,
  // so we render scaled-up circles (radius 2 in a 4-unit-tall band) and
  // crop the viewBox to (4, 4)–(20, 20) so the dots fill ≈92% of the box.
  // Result: dots are ~4px each at 16px render, comparable density to
  // Solar's filled icons at the same `size` prop while keeping the
  // lighter outlined aesthetic spec'd by Figma.
  return (
    <svg width={size} height={size} viewBox="4 4 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="6.66" cy="12" r="2" stroke={color} strokeWidth="1" />
      <circle cx="12"   cy="12" r="2" stroke={color} strokeWidth="1" />
      <circle cx="17.33" cy="12" r="2" stroke={color} strokeWidth="1" />
    </svg>
  );
}
