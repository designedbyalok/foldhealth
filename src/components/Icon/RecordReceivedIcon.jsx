/**
 * Record Received status icon: amber disc with a download arrow.
 * Provided verbatim from Figma (Jan-Feb 2026 file). The fill color comes
 * through as a prop so the icon stays in lockstep with the status spec's
 * `color` field (defaults to `--status-warning`).
 *
 * @param {object}  props
 * @param {number}  [props.size=12], Width & height in px
 * @param {string}  [props.color='#D9A50B']: Disc fill (warning amber)
 * @param {string}  [props.className]
 */
export function RecordReceivedIcon({ size = 12, color = '#D9A50B', className, ...rest }) {
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
      {/* Amber disc */}
      <path
        d="M0 6C0 2.69 2.69 0 6 0C9.31 0 12 2.69 12 6C12 9.31 9.31 12 6 12C2.69 12 0 9.31 0 6Z"
        fill={color}
      />
      {/* White download arrow */}
      <path
        d="M6.375 2.625C6.375 2.42 6.21 2.25 6 2.25C5.79 2.25 5.625 2.42 5.625 2.625H6H6.375ZM6 7.5L5.72 7.75C5.79 7.83 5.89 7.875 6 7.875C6.11 7.875 6.21 7.83 6.28 7.75L6 7.5ZM7.78 6.11C7.92 5.96 7.91 5.72 7.75 5.58C7.6 5.44 7.36 5.45 7.22 5.61L7.5 5.86L7.78 6.11ZM4.78 5.61C4.64 5.45 4.4 5.44 4.25 5.58C4.09 5.72 4.08 5.96 4.22 6.11L4.5 5.86L4.78 5.61ZM7.125 9.375V9H4.875V9.375V9.75H7.125V9.375ZM4.875 9.375V9C4.33 9 3.97 9 3.69 8.96C3.43 8.93 3.3 8.86 3.22 8.78L2.95 9.05L2.69 9.31C2.94 9.56 3.24 9.66 3.59 9.71C3.93 9.75 4.36 9.75 4.875 9.75V9.375ZM2.625 7.125H2.25C2.25 7.64 2.25 8.07 2.29 8.41C2.34 8.76 2.44 9.06 2.69 9.31L2.95 9.05L3.22 8.78C3.14 8.7 3.07 8.57 3.04 8.31C3 8.03 3 7.67 3 7.125H2.625ZM9.375 7.125H9C9 7.67 9 8.03 8.96 8.31C8.93 8.57 8.86 8.7 8.78 8.78L9.05 9.05L9.31 9.31C9.56 9.06 9.66 8.76 9.71 8.41C9.75 8.07 9.75 7.64 9.75 7.125H9.375ZM7.125 9.375V9.75C7.64 9.75 8.07 9.75 8.41 9.71C8.76 9.66 9.06 9.56 9.31 9.31L9.05 9.05L8.78 8.78C8.7 8.86 8.57 8.93 8.31 8.96C8.03 9 7.67 9 7.125 9V9.375ZM6 2.625H5.625V7.5H6H6.375V2.625H6ZM6 7.5L6.28 7.75L7.78 6.11L7.5 5.86L7.22 5.61L5.72 7.25L6 7.5ZM6 7.5L6.28 7.25L4.78 5.61L4.5 5.86L4.22 6.11L5.72 7.75L6 7.5Z"
        fill="white"
      />
    </svg>
  );
}
