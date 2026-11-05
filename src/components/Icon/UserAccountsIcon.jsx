/**
 * Stacked user cards (Figma 3540:64851, bxs:user-account): the illustration
 * on the shared-number "Log For" coachmark. Custom SVG asset, 48×48 viewBox.
 */
export function UserAccountsIcon({ size = 48, color = 'var(--primary-300)', className, style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path
        d="M40 4H16C14.94 4 13.92 4.42 13.17 5.17C12.42 5.92 12 6.94 12 8V32C12 33.06 12.42 34.08 13.17 34.83C13.92 35.58 14.94 36 16 36H40C41.06 36 42.08 35.58 42.83 34.83C43.58 34.08 44 33.06 44 32V8C44 6.94 43.58 5.92 42.83 5.17C42.08 4.42 41.06 4 40 4ZM28 9C29.33 9 30.6 9.53 31.54 10.46C32.47 11.4 33 12.67 33 14C33 15.33 32.47 16.6 31.54 17.54C30.6 18.47 29.33 19 28 19C26.67 19 25.4 18.47 24.46 17.54C23.53 16.6 23 15.33 23 14C23 12.67 23.53 11.4 24.46 10.46C25.4 9.53 26.67 9 28 9ZM38 30H18V29.5C18 25.8 22.51 22 28 22C33.49 22 38 25.8 38 29.5V30Z"
        fill={color}
      />
      <path d="M8 16H4V40C4 42.21 5.79 44 8 44H32V40H8V16Z" fill={color} />
    </svg>
  );
}
