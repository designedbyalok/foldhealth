/** Care plan GBI link affordance: Figma SNP-Story link chip. */
export function LinkIcon({ size = 24, color = '#6F7A90', className, style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path
        d="M14.1625 19.4876L13.4417 20.2084C11.053 22.5971 7.18019 22.5971 4.79151 20.2084C2.40283 17.8198 2.40283 13.9469 4.79151 11.5583L5.51236 10.8374M9.8374 15.1625L14.1625 10.8374M9.8374 6.51236L10.5583 5.79151C12.9469 3.40283 16.8198 3.40283 19.2084 5.79151C21.5971 8.18019 21.5971 12.053 19.2084 14.4417L18.4876 15.1625"
        stroke={color}
        strokeLinecap="round"
      />
    </svg>
  );
}
