/**
 * Cancel an appointment: Solar's calendar with a cross in it. Solar has no
 * calendar + cross icon; this is solar:calendar-linear's outline with the
 * cross drawn in the same 1px stroke. Colour follows `color`.
 */
export function CalendarCrossIcon({ size = 16, color = 'currentColor', className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <g stroke={color} strokeWidth="1" strokeLinecap="round" fill="none">
        <path d="M2 12C2 8.22876 2 6.34315 3.17157 5.17157C4.34315 4 6.22876 4 10 4H14C17.7712 4 19.6569 4 20.8284 5.17157C22 6.34315 22 8.22876 22 12V14C22 17.7712 22 19.6569 20.8284 20.8284C19.6569 22 17.7712 22 14 22H10C6.22876 22 4.34315 22 3.17157 20.8284C2 19.6569 2 17.7712 2 14V12Z" />
        <path d="M7 4V2.5" />
        <path d="M17 4V2.5" />
        <path d="M2.5 9H21.5" />
        <path d="M10 13.5L14 17.5M14 13.5L10 17.5" />
      </g>
    </svg>
  );
}
