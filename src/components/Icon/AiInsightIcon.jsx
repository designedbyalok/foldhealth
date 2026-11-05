/**
 * AI Insight Icon: lightbulb with gradient sparkle stars.
 * Used on the AI Insight Summary banner in analytics and the Overview Recap.
 * Pass `tint` for a single-colour version (white on the Unity gradient). It
 * isn't `color` because Button hands leading icons `color="currentColor"`,
 * which would flatten the gradient stars.
 */
export function AiInsightIcon({ size = 24, tint, className, style }) {
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
        d="M14 19c.276 0 .5.224.5.5s-.224.5-.5.5v-.5V19Zm-4 1a.5.5 0 0 1 0-1v.5V20Zm3.334 1.5a.5.5 0 0 1 0 1v-.5-1Zm-2.667 1a.5.5 0 0 1 0-1v.5 1Zm5.923-9.82.344.364-.002.001-.343-.364ZM5 8.218h.5v-.04H5v.04Zm0 .084h.5l.001-.002H5Zm2.41 5.379-.342.364-.002-.002.344-.363ZM12 1.5a.5.5 0 0 1 0 1V2v-.5ZM8.515 14.72l-.343.364h-.001l.344-.364Zm6.97 0 .343.364.001 0-.343-.364ZM15 15.843h-.5.5Zm3.456-6.81a.5.5 0 1 1 .993.117l-.497-.059-.496-.058ZM14 19.5V20h-4v-.5V19h4v.5Zm-.667 2V22.5h-2.666V22v-1.5h2.666V22ZM5 8.218l.5-.001.001.084H5l-.5.002V8.218Zm0 .084.5-.003a7.9 7.9 0 0 0 2.755 5.017l-.344.363-.344.363A8.9 8.9 0 0 1 4.5 8.304L5 8.302ZM12 2v.5c-3.646 0-6.5 2.636-6.5 5.718H5h-.5C4.5 4.478 7.914 1.5 12 1.5V2Zm-1.843 15V16.5h3.686V17v.5h-3.686V17Zm4.843-1.157h-.5c0-.563.233-1.101.643-1.488l.343.364.343.364a1.16 1.16 0 0 0-.328.76H15ZM9 15.843h-.5c0-.288-.119-.562-.328-.76l.343-.364.343-.364c.41.386.643.924.643 1.488H9Zm4.843 1.157V16.5c.363 0 .657-.294.657-.657H15h.5c0 .915-.742 1.657-1.657 1.657V17Zm-3.686 0v.5a1.157 1.157 0 0 1-1.157-1.157H9h.5c0 .363.294.657.657.657V17Zm5.328-2.32-.343-.363 1.105-1.04.343.365.343.364-1.105 1.04-.343-.365Zm-6.97 0-.343.364-1.105-1.04.343-.364.343-.363 1.105 1.04-.343.364Zm6.97 0-.344-.363a7.62 7.62 0 0 0 2.314-4.648l.497.058.496.059a8.62 8.62 0 0 1-2.619 5.258l-.344-.364Z"
        fill={tint || '#6F7A90'}
      />
      <path
        d="M18.144.439c-.23-.585-1.058-.585-1.289 0l-.714 1.812a.75.75 0 0 1-.39.39l-1.813.714c-.585.231-.585 1.058 0 1.29l1.812.714a.75.75 0 0 1 .39.39l.715 1.812c.23.585 1.058.585 1.289 0l.715-1.812a.75.75 0 0 1 .39-.39l1.812-.715c.585-.23.585-1.058 0-1.289l-1.812-.714a.75.75 0 0 1-.39-.39L18.144.439Z"
        fill={tint || 'url(#aiInsight_g1)'}
      />
      <path
        d="M12.508 6.899a.375.375 0 0 0-.683 0l-.533 1.353a.375.375 0 0 1-.207.207l-1.353.534a.375.375 0 0 0 0 .682l1.353.534a.375.375 0 0 1 .207.206l.533 1.354a.375.375 0 0 0 .683 0l.533-1.354a.375.375 0 0 1 .207-.206l1.353-.534a.375.375 0 0 0 0-.682l-1.353-.534a.375.375 0 0 1-.207-.207l-.533-1.353Z"
        fill={tint || 'url(#aiInsight_g2)'}
      />
      <defs>
        <linearGradient id="aiInsight_g1" x1="15.5" y1="-9.42" x2="29.801" y2="-.391" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1E9DAE" />
          <stop offset="1" stopColor="#D478FF" />
        </linearGradient>
        <linearGradient id="aiInsight_g2" x1="15.5" y1="-9.42" x2="29.801" y2="-.391" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1E9DAE" />
          <stop offset="1" stopColor="#D478FF" />
        </linearGradient>
      </defs>
    </svg>
  );
}
