import { useId } from 'react';

/**
 * PriorityIcon: task priority glyph shared across the tasks module, the
 * patient profile drawer's Tasks tab, and anywhere else a task priority
 * needs an at-a-glance indicator.
 *
 * Variants (Figma Fold-Pixel-1.0 task priority set):
 *   • high: coral stacked double-chevron-up (gradient #FF623E → #ED876F)
 *   • medium: amber double-bar (#FFAB00)
 *   • low: blue stacked double-chevron-down (gradient #6AA3F9 → #0065FF)
 *   • none / undefined: neutral outlined circle
 *
 * Props:
 *   • priority: 'high' | 'medium' | 'low' | 'none'
 *   • size: number (px). Default 16.
 *   • title: optional accessible title. When omitted the icon is
 *                aria-hidden (decorative), matching the row-P-column use
 *                where the priority is already announced elsewhere.
 */
export function PriorityIcon({ priority, size = 16, title }) {
  // Unique IDs per render: two icons on the same page were sharing the
  // static `priorityHigh` / `priorityLow` gradient defs, which merges
  // fine visually but is invalid HTML.
  const uid = useId().replace(/:/g, '');
  const gradHighId = `priorityHigh-${uid}`;
  const gradLowId = `priorityLow-${uid}`;

  const svgProps = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    style: { flexShrink: 0 },
    role: title ? 'img' : undefined,
    'aria-label': title || undefined,
    'aria-hidden': title ? undefined : true,
  };

  if (priority === 'high') {
    return (
      <svg {...svgProps}>
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M19.71 12.2C19.46 12.37 19.12 12.47 18.762 12.47C18.41 12.47 18.06 12.37 17.81 12.2L12.04 8.13L6.28 12.2C6.02 12.37 5.68 12.46 5.33 12.462C4.98 12.46 4.64 12.36 4.39 12.18C4.14 12.01 4 11.77 4 11.52C4 11.27 4.13 11.04 4.38 10.86L11.09 6.12C11.35 5.94 11.69 5.84 12.04 5.84C12.4 5.84 12.74 5.94 12.99 6.12L19.71 10.86C19.96 11.03 20.11 11.28 20.11 11.53C20.11 11.78 19.96 12.02 19.71 12.2ZM19.71 17.88C19.46 18.06 19.12 18.16 18.762 18.16C18.41 18.16 18.06 18.06 17.81 17.88L12.04 13.81L6.28 17.88C6.02 18.05 5.68 18.15 5.33 18.15C4.98 18.14 4.64 18.04 4.39 17.869C4.14 17.69 4 17.46 4 17.21C4 16.96 4.13 16.72 4.38 16.54L11.09 11.8C11.35 11.63 11.69 11.53 12.04 11.53C12.4 11.53 12.74 11.63 12.99 11.8L19.71 16.54C19.96 16.72 20.11 16.96 20.11 17.21C20.11 17.46 19.96 17.7 19.71 17.88Z"
          fill={`url(#${gradHighId})`}
        />
        <defs>
          <linearGradient id={gradHighId} x1="12.0526" y1="5.8421" x2="12.0526" y2="18.1579" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FF623E" />
            <stop offset="1" stopColor="#ED876F" />
          </linearGradient>
        </defs>
      </svg>
    );
  }
  if (priority === 'medium') {
    return (
      <svg {...svgProps}>
        <path
          d="M4.5 13C3.81 13 3.25 13.56 3.25 14.25C3.25 14.94 3.81 15.5 4.5 15.5H19.5C20.19 15.5 20.75 14.94 20.75 14.25C20.75 13.56 20.19 13 19.5 13H4.5ZM4.5 8C3.81 8 3.25 8.56 3.25 9.25C3.25 9.94 3.81 10.5 4.5 10.5H19.5C20.19 10.5 20.75 9.94 20.75 9.25C20.75 8.56 20.19 8 19.5 8H4.5Z"
          fill="#FFAB00"
        />
      </svg>
    );
  }
  if (priority === 'low') {
    return (
      <svg {...svgProps}>
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M20.58 12.293C20.32 12.11 19.96 12 19.58 12C19.21 12 18.85 12.11 18.58 12.293L12.49 16.59L6.4 12.293C6.14 12.11 5.78 12.01 5.41 12.01C5.03 12.01 4.68 12.12 4.42 12.31C4.15 12.49 4 12.74 4 13C4 13.27 4.14 13.52 4.4 13.707L11.49 18.71C11.75 18.89 12.12 19 12.49 19C12.87 19 13.23 18.89 13.49 18.71L20.58 13.707C20.85 13.52 21 13.27 21 13C21 12.73 20.85 12.48 20.58 12.293ZM20.58 6.29C20.32 6.11 19.96 6 19.58 6C19.21 6 18.85 6.11 18.58 6.29L12.49 10.59L6.4 6.29C6.14 6.11 5.78 6.01 5.41 6.01C5.03 6.01 4.68 6.12 4.42 6.3C4.15 6.49 4 6.74 4 7C4 7.27 4.14 7.52 4.4 7.71L11.49 12.707C11.75 12.89 12.12 13 12.49 13C12.87 13 13.23 12.89 13.49 12.707L20.58 7.71C20.85 7.52 21 7.26 21 7C21 6.73 20.85 6.48 20.58 6.29Z"
          fill={`url(#${gradLowId})`}
        />
        <defs>
          <linearGradient id={gradLowId} x1="12.5" y1="6" x2="12.5" y2="19" gradientUnits="userSpaceOnUse">
            <stop stopColor="#6AA3F9" />
            <stop offset="1" stopColor="#0065FF" />
          </linearGradient>
        </defs>
      </svg>
    );
  }
  return (
    <svg {...svgProps}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 5.35C8.33 5.35 5.35 8.33 5.35 12C5.35 15.67 8.33 18.65 12 18.65C15.67 18.65 18.65 15.67 18.65 12C18.65 8.33 15.67 5.35 12 5.35ZM3 12C3 7.03 7.03 3 12 3C16.97 3 21 7.03 21 12C21 16.97 16.97 21 12 21C7.03 21 3 16.97 3 12Z"
        fill="#6F7A90"
      />
    </svg>
  );
}
