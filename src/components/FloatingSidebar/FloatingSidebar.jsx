import { useState } from 'react';
import { Icon } from '../Icon/Icon';
import { Input } from '../Input/Input';
import { SideNav } from '../SideNav/SideNav';
import { Tooltip } from '../Tooltip/Tooltip';
import styles from './FloatingSidebar.module.css';

/**
 * Fold Health FloatingSidebar.
 *
 * Variant of the primary navigation chrome where the rail and the active
 * section's sub-nav float together as one rounded panel (Figma Fold-Pixel
 * node 1255:42011). The dark `--primary-500` rail sits on the left as a
 * compact 52px icon-only column, the white sub-nav attaches to the right at
 * ~190px with a search input and collapsible sections, and the whole thing
 * carries one 0.5px `--neutral-100` border + 8px radius so it reads as a
 * single floating card.
 *
 * The rail here is deliberately a different beast from `components/Sidebar`:
 * no inline text labels (names surface in a hover tooltip with the keyboard
 * shortcut), no sliding pill, no help popover. That shell owns the full
 * labeled 72px experience; this one is the compact floating variant designers
 * reach for when there's an always-on sub-nav next to it.
 *
 * Props:
 *   - `items` — top-level rail items. `{ key, icon, filledIcon?, label,
 *       shortcut?, badge? }`. Required: `key` (identity), `icon` (Solar
 *       `*-linear` name), `label` (tooltip + a11y name). `filledIcon` paints
 *       the active tile; falls back to `icon`. `shortcut` renders in the
 *       hover tooltip (e.g. '⌘1'); omit for items with no shortcut.
 *   - `activeKey` / `onNavigate(key, item)` — controlled selection for the rail.
 *   - `bottomItems` — same shape as `items`, pinned to the rail's bottom.
 *   - `logo` — slot for the brand mark. Pass a custom node to override;
 *       omit to render the default Omni-style Fold mark (Figma 1256:45238).
 *   - `sections` / `activeSubKey` / `onSubSelect(key, item)` — forwarded straight
 *       to `<SideNav>`. Same shape, same semantics: pass the sub-nav the
 *       feature needs.
 *   - `searchable` (default true) — show the search input above the sections.
 *       `searchPlaceholder` / `searchValue` / `onSearchChange` let the caller
 *       control it; uncontrolled by default so the Storybook demos stay simple.
 *   - `showSubNav` (default true) — hide the right panel for icon-only mode.
 *   - `subPanel` — overrides the built-in search + sections sub-panel. Pass
 *       any node (e.g. the live `<SubNav />` so the floating variant shares
 *       exactly the same section data as the standard layout). When set,
 *       `sections` / `activeSubKey` / `onSubSelect` / `searchable` are
 *       ignored.
 *   - `width` (default 240) — total panel width when the sub-nav is on. The
 *       rail stays 52px; the sub-nav takes the rest (minimum 160px).
 */
export function FloatingSidebar({
  items,
  bottomItems,
  activeKey,
  onNavigate,
  logo,
  sections,
  activeSubKey,
  onSubSelect,
  searchable = true,
  searchPlaceholder = 'Search',
  searchValue,
  onSearchChange,
  showSubNav = true,
  subPanel,
  width = 240,
  className,
  // Figma variant 1256:42013. 'comfortable' = 24px icons, 1.5 stroke,
  // 12px tile radius (the default). 'compact' = 18px icons, 1px stroke,
  // 8px tile radius. The CSS half of this reads `data-floating-density`
  // off <html> (same attr the ThemePicker toggle sets); the prop just
  // controls icon size on the React side.
  density = 'comfortable',
}) {
  const iconSize = density === 'compact' ? 20 : 24;
  // Uncontrolled search fallback so Storybook / demo callers can skip wiring
  // state through. When the parent supplies `searchValue`, we respect it.
  const [internalSearch, setInternalSearch] = useState('');
  const search = searchValue != null ? searchValue : internalSearch;
  const setSearch = (v) => {
    if (searchValue == null) setInternalSearch(v);
    onSearchChange?.(v);
  };

  // Collapsing a `sections` list by matching against the search text. Keep
  // sections whose label matches OR which have at least one matching item,
  // so an empty query returns everything untouched.
  const filteredSections = (() => {
    if (!search?.trim() || !sections) return sections;
    const q = search.trim().toLowerCase();
    return sections
      .map(sec => ({
        ...sec,
        items: (sec.items || []).filter(it => (it.label || '').toLowerCase().includes(q)),
      }))
      .filter(sec => sec.items.length > 0 || (sec.label || '').toLowerCase().includes(q));
  })();

  const frameStyle = showSubNav ? { width } : undefined;

  return (
    <div
      className={[styles.frame, showSubNav ? '' : styles.railOnly, className || ''].filter(Boolean).join(' ')}
      style={frameStyle}
      data-float-shell
      /* Flat right edge when the shell has NO internal sub-panel, so an
         adjacent feature SideNav (Settings / Analytics / Calls / Comms)
         visually joins the rail as one card. */
      data-rail-only={showSubNav ? undefined : 'true'}
    >
      <div className={styles.rail}>
        <div className={styles.logo}>{logo || <OmniLogo />}</div>
        <div className={styles.railItems}>
          {items?.map(item => (
            <RailTile
              key={item.key}
              item={item}
              active={item.key === activeKey}
              iconSize={iconSize}
              onClick={() => onNavigate?.(item.key, item)}
            />
          ))}
        </div>
        {bottomItems?.length > 0 && (
          <div className={styles.railBottom}>
            {bottomItems.map(item => (
              <RailTile
                key={item.key}
                item={item}
                active={item.key === activeKey}
                iconSize={iconSize}
                onClick={() => onNavigate?.(item.key, item)}
              />
            ))}
          </div>
        )}
      </div>
      {showSubNav && (
        subPanel
          ? <div className={styles.subPanel}>{subPanel}</div>
          : (
            <div className={styles.subPanel}>
              {searchable && (
                <div className={styles.searchWrap}>
                  <Input
                    type="search"
                    placeholder={searchPlaceholder}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
              )}
              <div className={styles.subNavWrap}>
                <SideNav
                  className={styles.subNav}
                  sections={filteredSections || []}
                  activeKey={activeSubKey}
                  onSelect={onSubSelect}
                  sectionLabelVariant="title"
                  width="100%"
                />
              </div>
            </div>
          )
      )}
    </div>
  );
}

/* ── Rail tile ──
 * One tile = one Solar icon in a 44×44 painted card. Hover / focus pops a
 * portaled tooltip with the item's label and keyboard shortcut (if any),
 * so the icon-only rail still reads for new users and keyboard reachers. */
function RailTile({ item, active, onClick, iconSize = 24 }) {
  const iconName = active && item.filledIcon ? item.filledIcon : item.icon;
  const tooltipLabel = (
    <span className={styles.tipLabel}>
      <span>{item.label}</span>
      {item.shortcut && <span className={styles.tipShortcut}>{item.shortcut}</span>}
    </span>
  );

  return (
    <Tooltip label={tooltipLabel} placement="right">
      <button
        type="button"
        className={[styles.tile, active ? styles.tileActive : ''].filter(Boolean).join(' ')}
        aria-label={item.label}
        aria-current={active ? 'page' : undefined}
        onClick={onClick}
      >
        <Icon name={iconName} size={iconSize} color="currentColor" />
        {item.badge > 0 && (
          <span className={styles.tileBadge} aria-hidden>{item.badge > 99 ? '99+' : item.badge}</span>
        )}
      </button>
    </Tooltip>
  );
}

/* ── Default Omni-style logo chip (Figma 1256:45238) ──
 * Glass-stack brand mark: three nested rounded panels with layered
 * backdrop blur over a soft green gradient, each panel edged with a
 * low-opacity white hairline, and the Fold mark pedestalled on top.
 * Rendered as one inline SVG so the gradient, blurs, and inner shadows
 * stay crisp at the rail's 44×44 target. */
function OmniLogo() {
  return (
    <svg
      className={styles.omniSvg}
      width="44"
      height="44"
      viewBox="0 0 269 269"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <foreignObject x="-6.86646e-05" y="-7.62939e-06" width="268.571" height="268.571">
        <div xmlns="http://www.w3.org/1999/xhtml" style={{ backdropFilter: 'blur(6.8px)', clipPath: 'url(#bgblur_1_8835_2226_clip_path)', height: '100%', width: '100%' }} />
      </foreignObject>
      <g filter="url(#filter0_di_8835_2226)" data-figma-bg-blur-radius="13.5987">
        <g clipPath="url(#clip0_8835_2226)">
          <rect x="34.2856" y="29.7528" width="200" height="200" rx="65.7143" fill="url(#paint0_linear_8835_2226)" fillOpacity="0.1" shapeRendering="crispEdges" />
          <foreignObject x="14.2858" y="14.2858" width="240" height="240">
            <div xmlns="http://www.w3.org/1999/xhtml" style={{ backdropFilter: 'blur(6.8px)', clipPath: 'url(#bgblur_2_8835_2226_clip_path)', height: '100%', width: '100%' }} />
          </foreignObject>
          <g filter="url(#filter1_di_8835_2226)" data-figma-bg-blur-radius="13.5987">
            <rect x="48.5715" y="44.0386" width="171.429" height="171.429" rx="51.4286" fill="white" fillOpacity="0.05" shapeRendering="crispEdges" />
            <rect x="48.8548" y="44.3219" width="170.862" height="170.862" rx="51.1453" stroke="white" strokeOpacity="0.1" strokeWidth="0.566612" shapeRendering="crispEdges" />
          </g>
          <foreignObject x="25.4608" y="20.9278" width="217.65" height="217.65">
            <div xmlns="http://www.w3.org/1999/xhtml" style={{ backdropFilter: 'blur(18.7px)', clipPath: 'url(#bgblur_3_8835_2226_clip_path)', height: '100%', width: '100%' }} />
          </foreignObject>
          <g filter="url(#filter2_d_8835_2226)" data-figma-bg-blur-radius="37.3964">
            <rect x="62.8572" y="58.3242" width="142.857" height="142.857" rx="37.1429" fill="white" fillOpacity="0.1" shapeRendering="crispEdges" />
          </g>
          <g clipPath="url(#clip4_8835_2226)">
            <path d="M184.286 129.753C184.286 134.611 182.356 139.27 178.921 142.705C175.486 146.14 170.827 148.07 165.969 148.07H134.286C131.642 148.07 129.058 148.854 126.86 150.322C124.662 151.791 122.948 153.879 121.937 156.321C120.925 158.763 120.66 161.451 121.176 164.044C121.692 166.636 122.965 169.018 124.834 170.887C126.704 172.757 129.085 174.03 131.678 174.545C134.271 175.061 136.958 174.797 139.401 173.785C141.843 172.773 143.931 171.06 145.399 168.862C146.868 166.664 147.652 164.08 147.652 161.436V153.02C147.652 152.364 147.913 151.734 148.377 151.27C148.841 150.806 149.471 150.545 150.127 150.545C150.784 150.545 151.413 150.806 151.877 151.27C152.342 151.734 152.602 152.364 152.602 153.02V161.436C152.602 165.059 151.528 168.6 149.516 171.612C147.503 174.624 144.642 176.972 141.295 178.359C137.948 179.745 134.265 180.108 130.712 179.401C127.159 178.694 123.895 176.95 121.334 174.388C118.772 171.826 117.028 168.563 116.321 165.009C115.614 161.456 115.977 157.773 117.363 154.426C118.749 151.079 121.097 148.219 124.109 146.206C127.122 144.193 130.663 143.119 134.286 143.119H165.969C169.514 143.119 172.914 141.711 175.42 139.204C177.927 136.698 179.335 133.298 179.335 129.753C179.335 126.208 177.927 122.808 175.42 120.301C172.914 117.795 169.514 116.386 165.969 116.386H157.553C156.896 116.386 156.267 116.126 155.803 115.661C155.339 115.197 155.078 114.568 155.078 113.911C155.078 113.255 155.339 112.625 155.803 112.161C156.267 111.697 156.896 111.436 157.553 111.436H165.969C170.827 111.436 175.486 113.366 178.921 116.801C182.356 120.236 184.286 124.895 184.286 129.753V129.753ZM120.919 121.337C120.919 120.68 120.659 120.051 120.194 119.587C119.73 119.123 119.101 118.862 118.444 118.862C117.788 118.862 117.158 119.123 116.694 119.587C116.23 120.051 115.969 120.68 115.969 121.337V129.753C115.969 132.396 115.185 134.981 113.716 137.179C112.247 139.377 110.16 141.09 107.718 142.102C105.275 143.113 102.588 143.378 99.9948 142.862C97.402 142.347 95.0204 141.074 93.1511 139.204C91.2817 137.335 90.0087 134.953 89.493 132.36C88.9772 129.768 89.2419 127.08 90.2536 124.638C91.2653 122.195 92.9785 120.108 95.1765 118.639C97.3746 117.17 99.9589 116.386 102.602 116.386H142.701C143.354 116.374 143.976 116.109 144.438 115.647C144.899 115.186 145.164 114.564 145.177 113.911C145.177 113.255 144.916 112.625 144.452 112.161C143.988 111.697 143.358 111.436 142.701 111.436H102.602C98.9798 111.436 95.4384 112.51 92.4262 114.523C89.414 116.536 87.0663 119.396 85.6799 122.743C84.2936 126.09 83.9308 129.773 84.6376 133.326C85.3444 136.879 87.0889 140.143 89.6505 142.705C92.2122 145.266 95.4759 147.011 99.029 147.718C102.582 148.424 106.265 148.062 109.612 146.675C112.959 145.289 115.82 142.941 117.832 139.929C119.845 136.917 120.919 133.376 120.919 129.753V121.337ZM118.444 108.961C119.097 108.948 119.719 108.683 120.18 108.222C120.642 107.76 120.907 107.138 120.919 106.485V98.0696C120.919 94.5247 122.328 91.1249 124.834 88.6182C127.341 86.1115 130.741 84.7033 134.286 84.7033C137.831 84.7033 141.23 86.1115 143.737 88.6182C146.244 91.1249 147.652 94.5247 147.652 98.0696V138.169C147.652 138.825 147.913 139.455 148.377 139.919C148.841 140.383 149.471 140.644 150.127 140.644C150.78 140.631 151.402 140.366 151.863 139.905C152.325 139.443 152.59 138.821 152.602 138.169V98.0696C152.602 95.6642 152.129 93.2824 151.208 91.0601C150.288 88.8378 148.938 86.8186 147.238 85.1177C145.537 83.4168 143.518 82.0676 141.295 81.1471C139.073 80.2266 136.691 79.7528 134.286 79.7528C131.88 79.7528 129.498 80.2266 127.276 81.1471C125.054 82.0676 123.035 83.4168 121.334 85.1177C119.633 86.8186 118.284 88.8378 117.363 91.0601C116.443 93.2824 115.969 95.6642 115.969 98.0696V106.485C115.969 107.142 116.23 107.772 116.694 108.236C117.158 108.7 117.788 108.961 118.444 108.961Z" fill="white" />
          </g>
        </g>
        <rect x="34.569" y="30.0361" width="199.433" height="199.433" rx="65.431" stroke="white" strokeOpacity="0.2" strokeWidth="0.566612" shapeRendering="crispEdges" />
      </g>
      <defs>
        <filter id="filter0_di_8835_2226" x="-6.86646e-05" y="-7.62939e-06" width="268.571" height="268.571" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
          <feOffset dy="4.5329" />
          <feGaussianBlur stdDeviation="17.1429" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.136615 0 0 0 0 0.142693 0 0 0 0 0.179167 0 0 0 1 0" />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_8835_2226" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_8835_2226" result="shape" />
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
          <feOffset dx="-4.5329" dy="4.5329" />
          <feGaussianBlur stdDeviation="15.2985" />
          <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
          <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.1 0" />
          <feBlend mode="normal" in2="shape" result="effect2_innerShadow_8835_2226" />
        </filter>
        <clipPath id="bgblur_1_8835_2226_clip_path" transform="translate(6.86646e-05 7.62939e-06)">
          <rect x="34.2856" y="29.7528" width="200" height="200" rx="65.7143" />
        </clipPath>
        <filter id="filter1_di_8835_2226" x="14.2858" y="14.2858" width="240" height="240" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
          <feOffset dy="4.5329" />
          <feGaussianBlur stdDeviation="17.1429" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.136615 0 0 0 0 0.142693 0 0 0 0 0.179167 0 0 0 1 0" />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_8835_2226" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_8835_2226" result="shape" />
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
          <feOffset dx="-4.5329" dy="4.5329" />
          <feGaussianBlur stdDeviation="15.2985" />
          <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
          <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.2 0" />
          <feBlend mode="normal" in2="shape" result="effect2_innerShadow_8835_2226" />
        </filter>
        <clipPath id="bgblur_2_8835_2226_clip_path" transform="translate(-14.2858 -14.2858)">
          <rect x="48.5715" y="44.0386" width="171.429" height="171.429" rx="51.4286" />
        </clipPath>
        <filter id="filter2_d_8835_2226" x="25.4608" y="20.9278" width="217.65" height="217.65" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
          <feOffset dy="4.5329" />
          <feGaussianBlur stdDeviation="2.26645" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.05 0" />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_8835_2226" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_8835_2226" result="shape" />
        </filter>
        <clipPath id="bgblur_3_8835_2226_clip_path" transform="translate(-25.4608 -20.9278)">
          <rect x="62.8572" y="58.3242" width="142.857" height="142.857" rx="37.1429" />
        </clipPath>
        <linearGradient id="paint0_linear_8835_2226" x1="134.286" y1="29.7528" x2="134.286" y2="229.753" gradientUnits="userSpaceOnUse">
          <stop stopColor="#669D89" />
          <stop offset="1" stopColor="#12241E" />
        </linearGradient>
        <clipPath id="clip0_8835_2226">
          <rect x="34.2856" y="29.7528" width="200" height="200" rx="65.7143" fill="white" />
        </clipPath>
        <clipPath id="clip4_8835_2226">
          <rect width="100" height="100" fill="white" transform="translate(84.2856 79.7528)" />
        </clipPath>
      </defs>
    </svg>
  );
}
