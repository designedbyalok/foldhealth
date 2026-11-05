/**
 * Article (Figma "🔆/Article", 16×16): a newspaper page. Solar has no
 * article glyph, so this is the Figma asset at a 1px stroke.
 */
export function ArticleIcon({ size = 16, color = 'var(--neutral-300)', className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path
        d="M6.41 4.04H8.5M6.41 6.02H8.5M6.08 8.45H12.71M6.08 10.37H12.71M6.08 12.3H12.71M4.21 14.89C2.85 14.89 2.17 14.89 1.75 14.58C1.33 14.26 1.33 13.76 1.33 12.76V11.33C1.33 10.33 1.33 9.82 1.75 9.51C1.9 9.4 2.07 9.33 2.3 9.29M10.91 6.19H12.04C12.43 6.19 12.63 6.19 12.76 6.08C12.88 5.98 12.88 5.81 12.88 5.48V4.53C12.88 4.19 12.88 4.02 12.76 3.92C12.63 3.82 12.43 3.82 12.04 3.82H10.91C10.51 3.82 10.31 3.82 10.19 3.92C10.06 4.02 10.06 4.19 10.06 4.53V5.48C10.06 5.81 10.06 5.98 10.19 6.08C10.31 6.19 10.51 6.19 10.91 6.19ZM8.79 1.33H9.97C12.18 1.33 13.29 1.33 13.98 2.13C14.67 2.92 14.67 4.2 14.67 6.76V9.47C14.67 12.02 14.67 13.3 13.98 14.1C13.29 14.89 12.18 14.89 9.97 14.89H4.23C4.16 14.89 4.09 14.83 4.09 14.75V6.76C4.09 4.2 4.09 2.92 4.78 2.13C5.47 1.33 6.58 1.33 8.79 1.33Z"
        stroke={color}
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}
