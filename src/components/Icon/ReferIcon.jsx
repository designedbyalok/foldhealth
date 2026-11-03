/**
 * Custom refer icon: the Referrals empty state. Solar's forward arrows are
 * single strokes; the design's is an outlined arrow (P360 6111:268154).
 *
 * Path is Figma's unchanged. The viewBox is 46 units where Solar's is 24, so
 * a 46/24 ≈ 1.9167 stroke keeps it the weight of every other icon, same
 * reasoning as ScalpelIcon.
 *
 * @param {object}  props
 * @param {number}  [props.size=24]                    – Width & height in px
 * @param {string}  [props.color='var(--neutral-200)'] – Stroke color
 * @param {string}  [props.className]
 */
export function ReferIcon({ size = 24, color = 'var(--neutral-200)', className, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 46 46"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      <path
        d="M26.8333 37.0477V30.9063C26.8333 29.944 26.0499 29.1617 25.0877 29.1726C16.107 29.2743 11.4475 30.3854 5.50428 38.8911C5.00348 39.6078 3.8677 39.255 3.91774 38.3821C5.05595 18.5285 17.4429 16.1472 25.0946 15.9032C26.0564 15.8726 26.8333 15.0978 26.8333 14.1354V7.99404C26.8333 7.19893 27.811 6.81936 28.3475 7.40617L40.0167 20.1694C41.234 21.5007 41.234 23.541 40.0167 24.8723L28.3475 37.6355C27.811 38.2224 26.8333 37.8428 26.8333 37.0477Z"
        stroke={color}
        strokeWidth="1.9167"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
