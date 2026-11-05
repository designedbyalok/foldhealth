/**
 * Small filled right caret (Figma "Chevron/Right(L)", 10×10): sits after a
 * name that opens more detail, e.g. the comms chat header.
 */
export function CaretRightIcon({ size = 10, color = 'var(--neutral-300)', className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path d="M7 5L3 1L3 9L7 5Z" fill={color} stroke={color} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
