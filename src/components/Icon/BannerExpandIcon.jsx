/**
 * Banner expand icon: filled primary circle with a white chevron inside.
 * Used in PatientBanner's expand/collapse affordance (and any other banner
 * with the same expand UX). Rotates 180° when expanded; the rotation is
 * applied by the caller via a `className` whose transform flips the SVG.
 *
 * Per CLAUDE.md the platform standard is `solar:*-linear` icons rendered at
 * 1px stroke. This one is intentionally a filled-disc affordance (not an
 * icon glyph): a stronger expand cue than a bare chevron in the banner
 * row. Reuse the component anywhere this pattern recurs; don't rebuild it.
 *
 * @param {object}  props
 * @param {number}  [props.size=20], Width & height in px
 * @param {string}  [props.color='var(--primary-300)']: Disc fill colour
 * @param {string}  [props.className]
 */
export function BannerExpandIcon({ size = 20, color = 'var(--primary-300)', className, ...rest }) {
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
        d="M10 17C13.87 17 17 13.87 17 10C17 6.13 13.87 3 10 3C6.13 3 3 6.13 3 10C3 13.87 6.13 17 10 17Z"
        fill={color}
      />
      <path
        d="M13 9L10 12L7 9"
        stroke="white"
        strokeWidth="1.16667"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
