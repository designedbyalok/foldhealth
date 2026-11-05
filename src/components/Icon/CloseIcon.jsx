/**
 * Custom close (cross) icon: replaces all solar close variants for dismiss/close actions.
 *
 * @param {object}  props
 * @param {number}  [props.size=20], Width & height in px
 * @param {string}  [props.color='#6F7A90']: Fill color
 * @param {string}  [props.className]
 */
export function CloseIcon({ size = 20, color = '#6F7A90', className, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      <path
        d="M15.35 5.35C15.55 5.16 15.55 4.84 15.35 4.65C15.16 4.45 14.84 4.45 14.65 4.65L15 5L15.35 5.35ZM4.65 14.65C4.45 14.84 4.45 15.16 4.65 15.35C4.84 15.55 5.16 15.55 5.35 15.35L5 15L4.65 14.65ZM5.35 4.65C5.16 4.45 4.84 4.45 4.65 4.65C4.45 4.84 4.45 5.16 4.65 5.35L5 5L5.35 4.65ZM14.65 15.35C14.84 15.55 15.16 15.55 15.35 15.35C15.55 15.16 15.55 14.84 15.35 14.65L15 15L14.65 15.35ZM15 5L14.65 4.65L9.65 9.65L10 10L10.35 10.35L15.35 5.35L15 5ZM10 10L9.65 9.65L4.65 14.65L5 15L5.35 15.35L10.35 10.35L10 10ZM5 5L4.65 5.35L9.65 10.35L10 10L10.35 9.65L5.35 4.65L5 5ZM10 10L9.65 10.35L14.65 15.35L15 15L15.35 14.65L10.35 9.65L10 10Z"
        fill={color}
      />
    </svg>
  );
}
