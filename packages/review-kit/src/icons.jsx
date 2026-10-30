// Clean outline icon set — one confident 1.75px stroke, round caps and joins,
// no fills, no overlapping shapes. Drawn on a 24x24 canvas at currentColor so
// they pick up the host theme. Hosts can replace any slot via the `icons` prop.
const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

// Pick / select — a corner-marked frame with an arrow in it.
export const PickIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M4 9V6a2 2 0 0 1 2-2h3" />
    <path d="M20 9V6a2 2 0 0 0-2-2h-3" />
    <path d="M4 15v3a2 2 0 0 0 2 2h3" />
    <path d="m12 11 7 2.5-3 1.3-1.3 3z" />
  </svg>
);

// Screenshot — a clean camera outline.
export const CameraIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M4 9a2 2 0 0 1 2-2h2l1.5-2h5l1.5 2h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
    <circle cx="12" cy="13" r="3.25" />
  </svg>
);

// Upload — tray with an arrow pointing up.
export const UploadIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M12 15V4" />
    <path d="m7.5 8.5 4.5-4.5 4.5 4.5" />
    <path d="M4 14v3.5A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5V14" />
  </svg>
);

// Close — a clean X.
export const CloseIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

// Minimize — a single bar.
export const CollapseIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M5 12h14" />
  </svg>
);

// Chevron — a clean arrow, rotatable.
export const ChevronIcon = ({ direction = 'left', ...p }) => (
  <svg
    {...base}
    {...p}
    style={{
      ...(p.style || {}),
      transform: { right: 'rotate(180deg)', up: 'rotate(90deg)', down: 'rotate(-90deg)' }[direction],
    }}
  >
    <path d="M14.5 6.5 9 12l5.5 5.5" />
  </svg>
);

// Grip handle — six solid dots.
export const GripIcon = (p) => (
  <svg {...base} {...p} fill="currentColor" stroke="none">
    <circle cx="9" cy="7" r="1.3" />
    <circle cx="15" cy="7" r="1.3" />
    <circle cx="9" cy="12" r="1.3" />
    <circle cx="15" cy="12" r="1.3" />
    <circle cx="9" cy="17" r="1.3" />
    <circle cx="15" cy="17" r="1.3" />
  </svg>
);

// Pen — clean pencil outline.
export const PenIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M4 20l1-4.5L15.8 4.7a1.4 1.4 0 0 1 2 0l1.5 1.5a1.4 1.4 0 0 1 0 2L8.5 19z" />
    <path d="m14 5.5 4 4" />
  </svg>
);

// Bold — a clean B shape, no overlapping fills.
export const BoldIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M7 5h6a3.5 3.5 0 0 1 0 7H7z" />
    <path d="M7 12h7a3.5 3.5 0 0 1 0 7H7z" />
  </svg>
);

// Italic — slant with serif bars.
export const ItalicIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M10 5h8" />
    <path d="M6 19h8" />
    <path d="M14 5l-4 14" />
  </svg>
);

// Underline — U with a baseline.
export const UnderlineIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M7 4v7a5 5 0 0 0 10 0V4" />
    <path d="M5 20h14" />
  </svg>
);

// Strike — bar with soft terminals.
export const StrikeIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M4 12h16" />
    <path d="M16.5 7.5C16 5.6 14.2 4.5 12 4.5c-2.6 0-4.5 1.4-4.5 3.3 0 1.5 1 2.5 3 3.2" />
    <path d="M8 16.5c.5 1.9 2.3 3 4.5 3 2.6 0 4.5-1.4 4.5-3.3" />
  </svg>
);

// Bullet list — solid dots + bars.
export const BulletListIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M10 6h10M10 12h10M10 18h10" />
    <circle cx="5" cy="6" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="5" cy="12" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="5" cy="18" r="1.3" fill="currentColor" stroke="none" />
  </svg>
);

// Ordered list — simple 1 / 2 markers + bars.
export const OrderedListIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M10 6h10M10 12h10M10 18h10" />
    <path d="M4.5 4.5 5.5 4v4" />
    <path d="M4 13.5c0-.8.6-1.5 1.5-1.5s1.5.6 1.5 1.3c0 1.2-3 1.7-3 3.2h3" />
  </svg>
);

// Link — two chain segments.
export const LinkIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </svg>
);

// Code — angle brackets.
export const CodeIcon = (p) => (
  <svg {...base} {...p}>
    <path d="m8.5 7.5-5 4.5 5 4.5" />
    <path d="m15.5 7.5 5 4.5-5 4.5" />
  </svg>
);

// Plus — clean +.
export const PlusIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
