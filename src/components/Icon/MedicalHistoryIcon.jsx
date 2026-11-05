/**
 * Custom medical-history icon: the medical cross used for the Medical
 * History card and its empty state. The design's own glyph, supplied
 * directly; Solar's medical icons don't match it.
 *
 * A 1px stroke on a 24-unit viewBox, the same grid and weight as Solar.
 *
 * @param {object}  props
 * @param {number}  [props.size=24]                    – Width & height in px
 * @param {string}  [props.color='var(--neutral-200)'] – Stroke color
 * @param {string}  [props.className]
 */
export function MedicalHistoryIcon({ size = 24, color = 'var(--neutral-200)', className, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      <path d="M8.58579 21.4142C9.17157 22 10.1144 22 12 22C13.8856 22 14.8284 22 15.4142 21.4142C16 20.8284 16 19.8856 16 18V16L18 16C19.8856 16 20.8284 16 21.4142 15.4142C22 14.8284 22 13.8856 22 12C22 10.1144 22 9.17157 21.4142 8.58579C20.8284 8 19.8856 8 18 8L16 8V6V5.99999C16 4.11438 16 3.17157 15.4142 2.58579C14.8284 2 13.8856 2 12 2C10.1144 2 9.17157 2 8.58579 2.58579C8 3.17157 8 4.11438 8 6V8L6 8H6C4.11438 8 3.17157 8 2.58579 8.58579C2 9.17157 2 10.1144 2 12C2 13.8856 2 14.8284 2.58579 15.4142C3.17157 16 4.11438 16 5.99999 16H6H8V18C8 19.8856 8 20.8284 8.58579 21.4142Z" stroke={color} strokeWidth="1" />
    </svg>
  );
}
