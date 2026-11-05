/**
 * Down chevron: used across FilterChip, FilterBar's More Filters trigger,
 * SectionTitleBar's Saved Filters button, and any other trigger that opens a
 * popover downward. 1.5px stroke, rounded caps.
 *
 * @param {object}  props
 * @param {number}  [props.size=16]              – Width & height in px
 * @param {string}  [props.color='var(--neutral-300)'] – Stroke color
 * @param {string}  [props.className]
 */
export function DownChevronIcon({ size = 16, color = 'var(--neutral-300)', className, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      <path
        d="M12 6L8.00001 10L4 6"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
