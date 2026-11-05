/**
 * Subtask glyph: a small connected-dots mark used to introduce a subtask
 * affordance (e.g. the compact "+ Add Subtask" link on the care-plan Add
 * Task drawer). Solar has no direct equivalent, so this is the design-
 * system source of truth. Reach for it via `custom:subtask` from `<Icon>`
 * (or import directly) instead of re-drawing per feature.
 *
 * @param {object} props
 * @param {number} [props.size=16]
 * @param {string} [props.color='var(--neutral-300)']: stroke color
 * @param {string} [props.className]
 */
export function SubtaskIcon({ size = 16, color = 'var(--neutral-300)', className, ...rest }) {
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
      <path
        d="M15 18C15 19.6569 16.3431 21 18 21C19.6569 21 21 19.6569 21 18C21 16.3431 19.6569 15 18 15C16.3431 15 15 16.3431 15 18ZM15 18C12.6131 18 9.18783 18.1878 7.5 16.5C5.81217 14.8122 6 11.3869 6 9M6 9C7.65685 9 9 7.65685 9 6C9 4.34315 7.65685 3 6 3C4.34315 3 3 4.34315 3 6C3 7.65685 4.34315 9 6 9Z"
        stroke={color}
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
