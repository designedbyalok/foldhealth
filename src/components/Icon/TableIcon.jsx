/**
 * Table / spreadsheet glyph. Solar has no table icon, so this is the
 * design-system source of truth for one, reach for it (or `custom:table`
 * via `<Icon>`) instead of re-drawing a table SVG per feature.
 *
 * @param {object}  props
 * @param {number}  [props.size=21]
 * @param {string}  [props.color='var(--neutral-300)'] – Stroke color
 * @param {string}  [props.className]
 */
export function TableIcon({ size = 21, color = 'var(--neutral-300)', className, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 21 21"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      <path
        d="M1 6.56H20M0.5 13.42H20.5M10.5 6.92V20.5M8.5 20.5C8.33 20.5 8.16 20.5 8 20.5C6.3 20.5 5.01 20.48 4 20.32C2.97 20.15 2.24 19.83 1.67 19.2C0.5 17.9 0.5 15.8 0.5 11.61V9.39C0.5 5.2 0.5 3.1 1.67 1.8C2.84 0.5 4.73 0.5 8.5 0.5H12.5C16.27 0.5 18.16 0.5 19.33 1.8C20.5 3.1 20.5 5.2 20.5 9.39V11.61C20.5 15.8 20.5 17.9 19.33 19.2C18.59 20.01 17.58 20.32 16 20.432C15.056 20.5 13.91 20.5 12.5 20.5H8.5Z"
        stroke={color}
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
