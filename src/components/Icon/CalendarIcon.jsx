/**
 * Calendar icon — custom SVG rendered inside `src/components/DatePicker`
 * so date fields show the Fold-brand calendar mark instead of the
 * browser's native `::-webkit-calendar-picker-indicator`. Filled paths
 * (not stroked) — the outline is drawn by the paint order, so pass a
 * solid `color` rather than a stroke width.
 *
 * @param {object} props
 * @param {number} [props.size=16]                       – Width & height in px
 * @param {string} [props.color='var(--placeholder-text)'] – Fill color
 * @param {string} [props.className]
 */
export function CalendarIcon({ size = 16, color = 'var(--placeholder-text)', className, ...rest }) {
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
        d="M6.5 3.54C6.5 3.81 6.72 4.04 7 4.04C7.28 4.04 7.5 3.81 7.5 3.54H6.5ZM7.5 2C7.5 1.72 7.28 1.5 7 1.5C6.72 1.5 6.5 1.72 6.5 2H7.5ZM16.5 3.54C16.5 3.81 16.72 4.04 17 4.04C17.28 4.04 17.5 3.81 17.5 3.54H16.5ZM17.5 2C17.5 1.72 17.28 1.5 17 1.5C16.72 1.5 16.5 1.72 16.5 2H17.5ZM2.5 8.17C2.22 8.17 2 8.39 2 8.67C2 8.94 2.22 9.17 2.5 9.17V8.17ZM21.5 9.17C21.78 9.17 22 8.94 22 8.67C22 8.39 21.78 8.17 21.5 8.17V9.17ZM10 4.04H14V3.04H10V4.04ZM21.5 11.74V13.79H22.5V11.74H21.5ZM14 21.5H10V22.5H14V21.5ZM2.5 13.79V11.74H1.5V13.79H2.5ZM10 21.5C8.1 21.5 6.73 21.5 5.68 21.35C4.65 21.21 4.01 20.94 3.53 20.45L2.81 21.15C3.51 21.86 4.4 22.19 5.54 22.35C6.67 22.5 8.13 22.5 10 22.5V21.5ZM1.5 13.79C1.5 15.71 1.5 17.2 1.65 18.36C1.8 19.53 2.12 20.44 2.81 21.15L3.53 20.45C3.05 19.96 2.78 19.3 2.64 18.23C2.5 17.15 2.5 15.74 2.5 13.79H1.5ZM21.5 13.79C21.5 15.74 21.5 17.15 21.36 18.23C21.22 19.3 20.95 19.96 20.47 20.45L21.19 21.15C21.88 20.44 22.2 19.53 22.35 18.36C22.5 17.2 22.5 15.71 22.5 13.79H21.5ZM14 22.5C15.87 22.5 17.33 22.5 18.46 22.35C19.6 22.19 20.49 21.86 21.19 21.15L20.47 20.45C19.99 20.94 19.35 21.21 18.32 21.35C17.27 21.5 15.9 21.5 14 21.5V22.5ZM14 4.04C15.9 4.04 17.27 4.04 18.32 4.18C19.35 4.33 19.99 4.6 20.47 5.09L21.19 4.39C20.49 3.68 19.6 3.35 18.46 3.19C17.33 3.04 15.87 3.04 14 3.04V4.04ZM22.5 11.74C22.5 9.82 22.5 8.33 22.35 7.18C22.2 6.01 21.88 5.1 21.19 4.39L20.47 5.09C20.95 5.58 21.22 6.24 21.36 7.31C21.5 8.38 21.5 9.8 21.5 11.74H22.5ZM10 3.04C8.13 3.04 6.67 3.04 5.54 3.19C4.4 3.35 3.51 3.68 2.81 4.39L3.53 5.09C4.01 4.6 4.65 4.33 5.68 4.18C6.73 4.04 8.1 4.04 10 4.04V3.04ZM2.5 11.74C2.5 9.8 2.5 8.38 2.64 7.31C2.78 6.24 3.05 5.58 3.53 5.09L2.81 4.39C2.12 5.1 1.8 6.01 1.65 7.18C1.5 8.33 1.5 9.82 1.5 11.74H2.5ZM7.5 3.54V2H6.5V3.54H7.5ZM17.5 3.54V2H16.5V3.54H17.5ZM2.5 9.17H21.5V8.17H2.5V9.17Z"
        fill={color}
      />
    </svg>
  );
}
