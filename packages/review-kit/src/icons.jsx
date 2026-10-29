// Outline icons at a 1px stroke, so the kit has no icon-set dependency.
const base = {
  width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
};

export const PickIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M4 4h5M4 4v5M20 4h-5M20 4v5M4 20h5M4 20v-5" />
    <path d="M11 11l8 3.2-3.4 1.4L14.2 19z" />
  </svg>
);

export const CameraIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.3l1.4-2h5.6l1.4 2h1.3A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" />
    <circle cx="12" cy="12.5" r="3.5" />
  </svg>
);

export const UploadIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" />
    <path d="M4 15v2.5A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5V15" />
  </svg>
);

export const CloseIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const CollapseIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M5 12h14" />
  </svg>
);

export const ChevronIcon = ({ direction = 'left', ...p }) => (
  <svg {...base} {...p} style={{ transform: direction === 'right' ? 'rotate(180deg)' : undefined }}>
    <path d="M14.5 6.5 9 12l5.5 5.5" />
  </svg>
);

export const GripIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="9" cy="7" r="0.8" /><circle cx="15" cy="7" r="0.8" />
    <circle cx="9" cy="12" r="0.8" /><circle cx="15" cy="12" r="0.8" />
    <circle cx="9" cy="17" r="0.8" /><circle cx="15" cy="17" r="0.8" />
  </svg>
);

export const BoldIcon = (p) => (
  <svg {...base} {...p}><path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z" /></svg>
);

export const ItalicIcon = (p) => (
  <svg {...base} {...p}><path d="M10 5h8M6 19h8M14 5l-4 14" /></svg>
);

export const UnderlineIcon = (p) => (
  <svg {...base} {...p}><path d="M7 4v7a5 5 0 0 0 10 0V4M5 20h14" /></svg>
);

export const StrikeIcon = (p) => (
  <svg {...base} {...p}><path d="M4 12h16M16.5 7.5C16 5.6 14.2 4.5 12 4.5c-2.6 0-4.5 1.4-4.5 3.3 0 1.5 1 2.5 3 3.2M8 16.5c.5 1.9 2.3 3 4.5 3 2.6 0 4.5-1.4 4.5-3.3" /></svg>
);

export const BulletListIcon = (p) => (
  <svg {...base} {...p}><path d="M10 6h10M10 12h10M10 18h10" /><circle cx="5" cy="6" r="1" /><circle cx="5" cy="12" r="1" /><circle cx="5" cy="18" r="1" /></svg>
);

export const OrderedListIcon = (p) => (
  <svg {...base} {...p}><path d="M10 6h10M10 12h10M10 18h10M4.5 4.5 5.5 4v4M4 13.5c0-.8.6-1.5 1.5-1.5s1.5.6 1.5 1.3c0 1.2-3 1.7-3 3.2h3" /></svg>
);

export const LinkIcon = (p) => (
  <svg {...base} {...p}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>
);

export const CodeIcon = (p) => (
  <svg {...base} {...p}><path d="m8.5 7.5-5 4.5 5 4.5M15.5 7.5l5 4.5-5 4.5" /></svg>
);

export const PlusIcon = (p) => (
  <svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>
);
