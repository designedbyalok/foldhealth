import { useState } from 'react';
import { Icon } from '../Icon/Icon';
import { Input } from '../Input/Input';
import { SideNav } from '../SideNav/SideNav';
import { Tooltip } from '../Tooltip/Tooltip';
import { FoldHealthLogo } from '../FoldhealthLogo/FoldhealthLogo';
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
}) {
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
    >
      <div className={styles.rail}>
        <div className={styles.logo}>{logo || <OmniLogo />}</div>
        <div className={styles.railItems}>
          {items?.map(item => (
            <RailTile
              key={item.key}
              item={item}
              active={item.key === activeKey}
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
function RailTile({ item, active, onClick }) {
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
        <Icon name={iconName} size={24} color="currentColor" />
        {item.badge > 0 && (
          <span className={styles.tileBadge} aria-hidden>{item.badge > 99 ? '99+' : item.badge}</span>
        )}
      </button>
    </Tooltip>
  );
}

/* ── Default Omni-style logo chip (Figma 1256:45238) ──
 * Nested rounded containers framing the Fold mark so it reads as a
 * premium brand chip instead of a bare SVG. Three layers:
 *   - Outer 44×44 with the dark fill carrying the rail's shadow
 *   - Mid 37×37 with a hairline white border
 *   - Inner 31×31 pedestal that holds the Fold mark */
function OmniLogo() {
  return (
    <div className={styles.omni}>
      <div className={styles.omniRing}>
        <div className={styles.omniPedestal}>
          <FoldHealthLogo size={22} color="var(--neutral-0)" />
        </div>
      </div>
    </div>
  );
}
