import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../Icon/Icon';
import { Button } from '../Button/Button';
import { ActionButton } from '../ActionButton/ActionButton';
import { SearchBar } from '../SearchBar/SearchBar';
import { SearchIconButton } from '../SearchIconButton/SearchIconButton';
import { Toggle } from '../Toggle/Toggle';
import { FilterChip } from '../FilterChip/FilterChip';
import styles from './SectionTitleBar.module.css';

/**
 * Fold Health SectionTitleBar — shared header bar sitting between SubNav and
 * page content across the demo platform.
 *
 * Four left-side variants:
 *   • variant="tabs"              — Tab strip; auto-collapses to a "More ▾"
 *                                    dropdown when the tabs don't fit next to
 *                                    the right-side actions.
 *   • variant="titleOnly"         — Just a title. No tabs, no dropdown, no
 *                                    toggle.
 *   • variant="titleWithDropdown" — Static title + attached dropdown chip
 *                                    (e.g. `HCC List  Due Date ⌄`).
 *   • variant="titleWithToggle"   — Static title + segmented toggle
 *                                    (e.g. `SNP List  Enrolled | Eligible`).
 *
 * Right-side actions are opt-in via `show*` flags so each page picks the
 * exact icon set it needs (Search, Filter, History, Upload, Download,
 * Saved Filters). `rightExtras` renders custom content before the icon
 * cluster for page-specific controls.
 */
export function SectionTitleBar({
  variant = 'tabs',

  // Tabs variant
  tabs = [],
  activeTab,
  onTabChange,

  // Title (used by titleOnly, titleWithDropdown, titleWithToggle)
  title,

  // TitleWithDropdown variant — uses shared FilterChip (see CLAUDE.md).
  // `dropdownValue` accepts either a single string or a string[] to stay
  // aligned with FilterChip's array-shaped onChange contract.
  dropdownLabel = 'Filter',
  dropdownValue,
  dropdownOptions = [],
  onDropdownChange,

  // TitleWithToggle variant
  toggleItems = [],
  toggleActive,
  onToggleChange,

  // Right side action flags
  showSearch = false,
  showFilter = false,
  showHistory = false,
  showUpload = false,
  showDownload = false,
  showSavedFilters = false,

  // Right side handlers
  onSearch,
  onFilter,
  onHistory,
  onUpload,
  onDownload,
  onSavedFilters,

  // Optional customisation
  searchPlaceholder = 'Search…',
  searchValue = '',
  onSearchChange,
  filterActive = false,
  filterBadgeCount,
  savedFiltersLabel = 'Saved Filters',
  savedFiltersActive = false,
  uploadLabel = 'Upload Record',
  uploadHasDropdown = false,
  rightExtras,
  leftExtras,
  className,
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const barRef = useRef(null);
  const rightRef = useRef(null);

  const cls = [styles.tabBar, className || ''].filter(Boolean).join(' ');

  return (
    <div className={cls} ref={barRef}>
      <div className={styles.left}>
        {variant === 'tabs' && (
          <TabsSection
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={onTabChange}
            barRef={barRef}
            rightRef={rightRef}
          />
        )}
        {variant === 'titleOnly' && (
          <div className={styles.titleRow}>
            <span className={styles.title}>{title}</span>
          </div>
        )}
        {variant === 'titleWithDropdown' && (
          <TitleDropdownSection
            title={title}
            label={dropdownLabel}
            value={dropdownValue}
            options={dropdownOptions}
            onChange={onDropdownChange}
          />
        )}
        {variant === 'titleWithToggle' && (
          <TitleToggleSection
            title={title}
            items={toggleItems}
            active={toggleActive}
            onChange={onToggleChange}
          />
        )}
        {leftExtras}
      </div>

      <div className={styles.right} ref={rightRef}>
        {rightExtras}

        {showSavedFilters && (
          <>
            <Button
              variant="secondary"
              size="L"
              trailingIcon="solar:alt-arrow-down-linear"
              onClick={onSavedFilters}
              className={savedFiltersActive ? styles.savedFiltersActive : ''}
            >
              {savedFiltersLabel}
            </Button>
            <span className={styles.iconDivider} />
          </>
        )}

        {showSearch && (
          <>
            <div className={styles.searchWrap}>
              {searchOpen ? (
                <SearchBar
                  placeholder={searchPlaceholder}
                  value={searchValue}
                  onChange={e => onSearchChange && onSearchChange(e.target.value)}
                  onClose={() => {
                    setSearchOpen(false);
                    if (onSearchChange) onSearchChange('');
                  }}
                />
              ) : (
                <SearchIconButton
                  title="Search"
                  tooltipBelow
                  onClick={() => {
                    setSearchOpen(true);
                    if (onSearch) onSearch();
                  }}
                />
              )}
            </div>
            <span className={styles.iconDivider} />
          </>
        )}

        {showFilter && (
          <>
            <ActionButton
              icon="custom:filter"
              size="L"
              tooltip="Filter"
              tooltipBelow
              notification={typeof filterBadgeCount === 'number' && filterBadgeCount > 0}
              count={typeof filterBadgeCount === 'number' && filterBadgeCount > 0 ? String(filterBadgeCount) : undefined}
              className={filterActive ? styles.iconActive : ''}
              onClick={onFilter}
            />
            <span className={styles.iconDivider} />
          </>
        )}

        {showDownload && (
          <>
            <ActionButton
              icon="solar:download-minimalistic-linear"
              size="L"
              tooltip="Download"
              tooltipBelow
              onClick={onDownload}
            />
            <span className={styles.iconDivider} />
          </>
        )}

        {showUpload && (
          <>
            <Button
              variant="primary"
              size="L"
              leadingIcon="solar:upload-minimalistic-linear"
              trailingIcon={uploadHasDropdown ? 'solar:alt-arrow-down-linear' : undefined}
              onClick={onUpload}
            >
              {uploadLabel}
            </Button>
            <span className={styles.iconDivider} />
          </>
        )}

        {showHistory && (
          <ActionButton
            icon="solar:history-linear"
            size="L"
            tooltip="History"
            tooltipBelow
            onClick={onHistory}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────── Left-side sections ────────────────────────────

/**
 * Tab strip with overflow handling. Measures each tab against the space
 * available between the container's left edge and the right-side action
 * cluster; anything that doesn't fit rolls into a `More ▾` dropdown. When
 * the currently-active tab lands in the overflow bucket we swap it with
 * the last visible tab so the active label always stays on screen.
 */
function TabsSection({ tabs, activeTab, onTabChange, barRef, rightRef }) {
  const [visibleCount, setVisibleCount] = useState(tabs.length);
  const [moreOpen, setMoreOpen] = useState(false);
  const measurerRef = useRef(null);
  const moreBtnRef = useRef(null);
  const rowRef = useRef(null);
  const tabRefs = useRef(new Map());
  // Sliding underline geometry — kept in state so the indicator animates via
  // transition on transform/width. `ready` gates the first paint so the
  // indicator doesn't fly in from 0 when the bar mounts.
  const [indicator, setIndicator] = useState({ x: 0, w: 0, ready: false });

  const measure = useCallback(() => {
    const measurer = measurerRef.current;
    const bar = barRef.current;
    const rightBox = rightRef.current;
    if (!measurer || !bar) return;
    // Available width for the tabs = bar width minus the right cluster minus
    // horizontal padding + a small breathing gap so nothing crowds the divider.
    const rightWidth = rightBox?.offsetWidth ?? 0;
    const available = bar.offsetWidth - rightWidth - 32;
    let total = 0;
    const widths = [];
    for (const child of measurer.querySelectorAll('[data-tab-item]')) {
      // +12px for the row gap between tabs.
      const w = child.offsetWidth + 12;
      widths.push(w);
      total += w;
    }
    if (total <= available) {
      setVisibleCount(tabs.length);
      return;
    }
    // Reserve ~72px for the "More ▾" chip when we know it will render.
    let running = 0;
    let count = 0;
    for (const w of widths) {
      if (running + w > available - 72) break;
      running += w;
      count += 1;
    }
    setVisibleCount(Math.max(1, count));
  }, [barRef, rightRef, tabs.length]);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure, tabs]);

  useEffect(() => {
    if (!moreOpen) return;
    const close = (e) => { if (!moreBtnRef.current?.contains(e.target)) setMoreOpen(false); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [moreOpen]);

  // Slide the underline to the active tab. `useLayoutEffect` measures after
  // the DOM has committed but before paint, so the indicator lands on the
  // right tab in the same frame the tab renders. Re-runs on visibleCount /
  // active swap so overflow re-layouts stay in sync.
  useLayoutEffect(() => {
    const row = rowRef.current;
    const el = tabRefs.current.get(activeTab);
    if (!row || !el) return;
    const rowRect = row.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    setIndicator({ x: elRect.left - rowRect.left, w: elRect.width, ready: true });
  }, [activeTab, visibleCount, tabs]);

  // Keep the active tab always visible by swapping it with the last slot in
  // the visible bucket when it would otherwise live in overflow.
  const activeIdx = tabs.findIndex(t => t.key === activeTab);
  let displayTabs = tabs;
  if (activeIdx >= visibleCount) {
    displayTabs = [...tabs];
    const swapIdx = visibleCount - 1;
    [displayTabs[swapIdx], displayTabs[activeIdx]] = [displayTabs[activeIdx], displayTabs[swapIdx]];
  }
  const visible = displayTabs.slice(0, visibleCount);
  const overflow = displayTabs.slice(visibleCount);
  const overflowHasActive = overflow.some(t => t.key === activeTab);

  return (
    <div className={styles.tabsRow} ref={rowRef}>
      {/* Hidden measurer — all tabs at their natural width so we can decide
          how many actually fit before rendering the visible row. */}
      <div
        ref={measurerRef}
        aria-hidden
        style={{ position: 'absolute', visibility: 'hidden', display: 'flex', gap: 12, pointerEvents: 'none', whiteSpace: 'nowrap' }}
      >
        {tabs.map(tab => (
          <div key={tab.key} data-tab-item className={styles.tabItem}>{tab.label}</div>
        ))}
      </div>

      {visible.map(tab => (
        <div
          key={tab.key}
          ref={(el) => {
            if (el) tabRefs.current.set(tab.key, el);
            else tabRefs.current.delete(tab.key);
          }}
          className={[styles.tabItem, activeTab === tab.key ? styles.active : ''].filter(Boolean).join(' ')}
          onClick={() => onTabChange && onTabChange(tab.key)}
        >
          {tab.label}
          {tab.notif && <span className={styles.notifDot} title="New activity" />}
        </div>
      ))}

      {/* Sliding underline — one shared element that transitions between the
          active tab's position + width. Hidden until measured so it doesn't
          animate in from x=0 on first paint. */}
      <span
        className={styles.tabUnderline}
        aria-hidden
        style={{
          transform: `translateX(${indicator.x}px)`,
          width: indicator.w,
          opacity: indicator.ready && !overflowHasActive ? 1 : 0,
        }}
      />

      {overflow.length > 0 && (
        <div className={styles.moreWrap} ref={moreBtnRef}>
          <div
            className={[styles.tabItem, styles.tabMore, overflowHasActive ? styles.active : ''].filter(Boolean).join(' ')}
            onClick={() => setMoreOpen(v => !v)}
            role="button"
            tabIndex={0}
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            aria-label={`Show ${overflow.length} more tab${overflow.length === 1 ? '' : 's'}`}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMoreOpen(v => !v); } }}
          >
            More
            <Icon name="solar:alt-arrow-down-linear" size={12} color="currentColor" />
          </div>
          {moreOpen && moreBtnRef.current && createPortal(
            <div
              className={styles.moreDropdown}
              role="menu"
              style={{
                position: 'fixed',
                top: moreBtnRef.current.getBoundingClientRect().bottom + 4,
                left: moreBtnRef.current.getBoundingClientRect().left,
              }}
            >
              {overflow.map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  role="menuitem"
                  className={[styles.moreItem, activeTab === tab.key ? styles.moreItemActive : ''].filter(Boolean).join(' ')}
                  onClick={() => { onTabChange && onTabChange(tab.key); setMoreOpen(false); }}
                >
                  {tab.label}
                </button>
              ))}
            </div>,
            document.body,
          )}
        </div>
      )}
    </div>
  );
}

function TitleDropdownSection({ title, label, value, options, onChange }) {
  const selected = Array.isArray(value) ? value : value == null || value === '' ? [] : [value];
  return (
    <div className={styles.titleRow}>
      <span className={styles.title}>{title}</span>
      <FilterChip
        label={label}
        options={options}
        selected={selected}
        singleSelect
        size="S"
        onChange={(next) => onChange && onChange(next[0] ?? null)}
      />
    </div>
  );
}

function TitleToggleSection({ title, items, active, onChange }) {
  const hasToggle = Array.isArray(items) && items.length > 1;
  return (
    <div className={styles.titleRow}>
      <span className={styles.title}>{title}</span>
      {hasToggle && (
        <Toggle items={items} active={active} onChange={onChange} size="S" />
      )}
    </div>
  );
}
