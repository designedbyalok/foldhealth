/**
 * Social-history icon: a wine glass, for the Social History card and its
 * empty state. This is Solar's `wineglass-linear` (Solar by 480 Design,
 * CC BY 4.0), kept in the repo so it sits with the other PAMI/Hx history
 * icons and doesn't depend on the Iconify CDN.
 *
 * Solar ships linear icons at a 1.5 stroke, and the app's global rule that
 * thins them to 1px only matches `svg.iconify`, which a local copy isn't: so
 * the 1px stroke is set here directly.
 *
 * @param {object}  props
 * @param {number}  [props.size=24]                    – Width & height in px
 * @param {string}  [props.color='var(--neutral-200)'] – Stroke color
 * @param {string}  [props.className]
 */
export function SocialHistoryIcon({ size = 24, color = 'var(--neutral-200)', className, ...rest }) {
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
      <g fill="none" stroke={color} strokeLinecap="round" strokeWidth="1">
        <path d="M12 15.2856V20.9999M12 20.9999H15.75M12 20.9999H8.25M5 4.89474C5 3.8483 5.8483 3 6.89474 3H17.1053C18.1517 3 19 3.8483 19 4.89474V8C19 11.866 15.866 15 12 15C8.13401 15 5 11.866 5 8V4.89474Z" />
        <path d="M5.5 9.0001C5.5 9.0001 7.58115 8.08736 9 8.0001C11.4652 7.84847 12.5348 10.1517 15 10.0001C16.4188 9.91283 18.5 9.0001 18.5 9.0001" />
      </g>
    </svg>
  );
}
