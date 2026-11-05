/**
 * Add Icon (Minimalist): a simple plus (+) in a 16×16 viewBox.
 * Designed for use on colored backgrounds (default fill: white).
 */
export function AddIconMinimalist({ size = 16, color = 'white', className, style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path
        d="M12 8.5C12.28 8.5 12.5 8.28 12.5 8C12.5 7.72 12.28 7.5 12 7.5V8V8.5ZM4 7.5C3.72 7.5 3.5 7.72 3.5 8C3.5 8.28 3.72 8.5 4 8.5V8V7.5ZM8.5 4C8.5 3.72 8.28 3.5 8 3.5C7.72 3.5 7.5 3.72 7.5 4L8 4L8.5 4ZM7.5 12C7.5 12.28 7.72 12.5 8 12.5C8.28 12.5 8.5 12.28 8.5 12H8H7.5ZM12 8V7.5H8V8V8.5H12V8ZM8 8V7.5H4V8V8.5H8V8ZM8 4L7.5 4L7.5 8L8 8H8.5L8.5 4L8 4ZM8 8H7.5V12H8H8.5V8H8Z"
        fill={color}
      />
    </svg>
  );
}
