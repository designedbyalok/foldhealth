import { useId } from 'react';

/**
 * Custom AI/magic sparkle icon — two gradient stars, teal→purple. Used for
 * AI-generated or AI-assisted content and actions (e.g. discharge-summary
 * extraction in Medication Reconciliation) in place of the plain Solar
 * "magic-stick" glyph.
 *
 * @param {object}  props
 * @param {number}  [props.size=16]  — Width & height in px
 * @param {string}  [props.className]
 */
export function AIIcon({ size = 16, className, ...rest }) {
  const uid = useId();
  const gradA = `ai-icon-a-${uid}`;
  const gradB = `ai-icon-b-${uid}`;

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
        d="M5.36 2.44C5.59 1.85 6.41 1.85 6.64 2.44L7.36 4.25C7.43 4.43 7.57 4.57 7.75 4.64L9.56 5.36C10.15 5.59 10.15 6.41 9.56 6.64L7.75 7.36C7.57 7.43 7.43 7.57 7.36 7.75L6.64 9.56C6.41 10.15 5.59 10.15 5.36 9.56L4.64 7.75C4.57 7.57 4.43 7.43 4.25 7.36L2.44 6.64C1.85 6.41 1.85 5.59 2.44 5.36L4.25 4.64C4.43 4.57 4.57 4.43 4.64 4.25L5.36 2.44Z"
        fill={`url(#${gradA})`}
      />
      <path
        d="M10.99 8.9C11.11 8.59 11.55 8.59 11.67 8.9L12.21 10.25C12.25 10.35 12.32 10.42 12.41 10.46L13.77 10.99C14.08 11.11 14.08 11.55 13.77 11.67L12.41 12.21C12.32 12.25 12.25 12.32 12.21 12.41L11.67 13.77C11.55 14.08 11.11 14.08 10.99 13.77L10.46 12.41C10.42 12.32 10.35 12.25 10.25 12.21L8.9 11.67C8.59 11.55 8.59 11.11 8.9 10.99L10.25 10.46C10.35 10.42 10.42 10.35 10.46 10.25L10.99 8.9Z"
        fill={`url(#${gradB})`}
      />
      <defs>
        <linearGradient id={gradA} x1="8" y1="-7.42" x2="-6.3009" y2="1.60898" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1E9DAE" />
          <stop offset="1" stopColor="#D478FF" />
        </linearGradient>
        <linearGradient id={gradB} x1="8" y1="-7.42" x2="-6.3009" y2="1.60898" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1E9DAE" />
          <stop offset="1" stopColor="#D478FF" />
        </linearGradient>
      </defs>
    </svg>
  );
}
