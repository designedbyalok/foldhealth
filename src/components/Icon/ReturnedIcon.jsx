/**
 * Returned status icon: orange disc with a white return-arrow.
 * Provided verbatim from Figma (Jan-Feb 2026 file). The disc fill comes
 * through as a prop so the icon stays in lockstep with the status spec's
 * `color` field (defaults to `--secondary-300`, the orange "Returned" tone).
 *
 * @param {object}  props
 * @param {number}  [props.size=12], Width & height in px
 * @param {string}  [props.color='#F47A3E']: Disc fill (secondary orange)
 * @param {string}  [props.className]
 */
export function ReturnedIcon({ size = 12, color = '#F47A3E', className, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="-1 -1 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      {/* Orange disc */}
      <path
        d="M0 6C0 2.69 2.69 0 6 0C9.31 0 12 2.69 12 6C12 9.31 9.31 12 6 12C2.69 12 0 9.31 0 6Z"
        fill={color}
      />
      {/* White return-arrow */}
      <path
        d="M3 4.125H7.125C8.16 4.125 9 4.96 9 6C9 7.04 8.16 7.875 7.125 7.875H4.5M4.125 5.25L3 4.125L4.125 3"
        stroke="white"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
