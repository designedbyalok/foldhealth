/**
 * Custom check icon: use for save, accept, allow, confirm, and pass/success indicators.
 *
 * @param {object}  props
 * @param {number}  [props.size=24], Width & height in px
 * @param {string}  [props.color='#6F7A90']: Stroke color
 * @param {string}  [props.className]
 */
export function CheckIcon({ size = 24, color = '#6F7A90', className, ...rest }) {
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
        d="M5 12.09L8.71 16.22C9.1 16.64 9.76 16.66 10.16 16.25L18.42 8"
        stroke={color}
        strokeLinecap="round"
      />
    </svg>
  );
}
