/**
 * In Progress status icon: pie chart at 50%, half-filled with the
 * status-warning amber. Used by `statusSpec.js` for the "In Progress"
 * row across worklist cells, the DiagPanel status pill, and the legend.
 *
 * Provided verbatim from Figma (Jan-Feb 2026 file). The colour comes
 * through as a prop so it can stay in lockstep with the spec's `color`
 * field: both the half-fill and the surrounding ring use the same tone.
 *
 * @param {object}  props
 * @param {number}  [props.size=12], Width & height in px
 * @param {string}  [props.color='#D9A50B']: Fill + stroke (warning amber)
 * @param {string}  [props.className]
 */
export function InProgressIcon({ size = 12, color = '#D9A50B', className, ...rest }) {
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
      {/* Base white disc */}
      <path
        d="M0 6C0 2.69 2.69 0 6 0C9.31 0 12 2.69 12 6C12 9.31 9.31 12 6 12C2.69 12 0 9.31 0 6Z"
        fill="white"
      />
      {/* Right-half progress fill */}
      <path
        d="M6 0C6.85 1.01e-08 7.69 0.18 8.46 0.53C9.24 0.88 9.93 1.39 10.49 2.03C11.06 2.66 11.48 3.41 11.73 4.22C11.98 5.03 12.06 5.89 11.955 6.73C11.85 7.58 11.57 8.39 11.13 9.11C10.69 9.84 10.1 10.47 9.4 10.95C8.7 11.43 7.9 11.75 7.06 11.9C6.23 12.06 5.37 12.03 4.54 11.82L6 6V0Z"
        fill={color}
      />
      {/* Outer ring */}
      <path
        d="M6 0.375C9.11 0.375 11.625 2.89 11.625 6C11.625 9.11 9.11 11.625 6 11.625C2.89 11.625 0.375 9.11 0.375 6C0.375 2.89 2.89 0.375 6 0.375Z"
        stroke={color}
        strokeWidth="1"
      />
    </svg>
  );
}
