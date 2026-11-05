/**
 * Custom scalpel icon: the Surgical History section and its empty state.
 * No Solar glyph matches it (Solar has no scalpel or knife).
 *
 * Path and stroke are Figma's (P360 6111:268212) unchanged. The 1.27778 stroke
 * is 1px once drawn: the viewBox is ~31 units where Solar's is 24, so
 * 31/24 ≈ 1.2778 keeps it the weight of every other icon, same reasoning as
 * AllergyIcon.
 *
 * @param {object}  props
 * @param {number}  [props.size=24]                    – Width & height in px
 * @param {string}  [props.color='var(--neutral-200)'] – Stroke color
 * @param {string}  [props.className]
 */
export function ScalpelIcon({ size = 24, color = 'var(--neutral-200)', className, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 30.6667 30.6667"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      <path
        d="M15.1459 21.103C16.0019 20.1634 27.3537 7.55965 27.3537 7.55965C27.8387 7.00992 28.1111 6.26432 28.1111 5.48688C28.1111 4.70945 27.8387 3.96385 27.3537 3.41412C26.8687 2.86439 26.211 2.55556 25.5251 2.55556C24.8393 2.55556 24.1815 2.86439 23.6966 3.41412C23.6966 3.41412 4.49623 24.001 2.72553 26.899C0.954827 29.7971 13.5396 26.8811 16.3034 24.5806C18.4326 22.8083 10.8966 17.9235 10.8966 17.9235"
        stroke={color}
        strokeWidth="1.27778"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
