import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../Icon/Icon';
import { DownChevronIcon } from '../Icon/DownChevronIcon';
import { Button } from '../Button/Button';
import { ActionButton } from '../ActionButton/ActionButton';
import { SearchBar } from '../SearchBar/SearchBar';
import { SearchIconButton } from '../SearchIconButton/SearchIconButton';
import { Toggle } from '../Toggle/Toggle';
import { FilterChip } from '../FilterChip/FilterChip';
import { TabStrip } from '../TabStrip/TabStrip';
import tabStripStyles from '../TabStrip/TabStrip.module.css';
import styles from './SectionTitleBar.module.css';

/**
 * Fold Health SectionTitleBar: shared header bar sitting between SubNav and
 * page content across the demo platform.
 *
 * Four left-side variants:
 *   • variant="tabs", Tab strip; auto-collapses to a "More ▾"
 *                                    dropdown when the tabs don't fit next to
 *                                    the right-side actions.
 *   • variant="titleOnly", Just a title. No tabs, no dropdown, no
 *                                    toggle.
 *   • variant="titleWithDropdown", Static title + attached dropdown chip
 *                                    (e.g. `HCC List  Due Date ⌄`).
 *   • variant="titleWithToggle", Static title + segmented toggle
 *                                    (e.g. `SNP List  Enrolled | Eligible`).
 *
 * Right-side actions are opt-in via the `actions` array so each page picks
 * the exact icon set it needs (`'search'`, `'filter'`, `'history'`,
 * `'upload'`, `'download'`, `'savedFilters'`). `rightExtras` renders
 * custom content before the icon cluster for page-specific controls;
 * `trailingExtras` renders after the primary action (e.g. a help button).
 */
export function SectionTitleBar({
  variant = 'tabs',

  // Tabs variant
  tabs = [],
  activeTab,
  onTabChange,

  // Title (used by titleOnly, titleWithDropdown, titleWithToggle)
  title,

  // TitleWithDropdown variant: uses shared FilterChip (see CLAUDE.md).
  // `dropdownValue` accepts either a single string or a string[] to stay
  // aligned with FilterChip's array-shaped onChange contract. When the
  // picker is never-empty (Measurement Year, etc.) pass `dropdownNoClear`
  // so the trailing glyph reads as a chevron instead of a clear X, and
  // `dropdownSize` overrides the default compact chip size.
  dropdownLabel = 'Filter',
  dropdownValue,
  dropdownOptions = [],
  onDropdownChange,
  dropdownNoClear = false,
  // When `dropdownNoClear` is on, the pill defaults to a neutral info-
  // display palette; pass `dropdownNoClearNeutral={false}` to keep the
  // primary active tint on a headline picker (e.g. HEDIS Year chip).
  dropdownNoClearNeutral = true,
  dropdownSize,

  // TitleWithToggle variant
  toggleItems = [],
  toggleActive,
  onToggleChange,

  // Right side actions: e.g. ['search', 'filter', 'history']
  actions = [],

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

  // Primary action button: renders after the icon cluster. Used across
  // tasks / campaigns / settings for the "New X / Invite / Add" secondary
  // button. Pass `rightExtras` for anything more complex (Toggle, menus).
  primaryActionLabel,
  primaryActionIcon = 'solar:add-circle-linear',
  primaryActionVariant = 'outline',
  primaryActionDisabled = false,
  onPrimaryAction,

  rightExtras,
  // Rendered after the primary action, e.g. a help button.
  trailingExtras,
  leftExtras,
  // Rendered at the very start of the left cluster, used by every worklist
  // to inject the shared SubnavToggle so a "collapse sidebar" handle appears
  // consistently before the title.
  leadingElement,
  className,
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const barRef = useRef(null);
  const rightRef = useRef(null);
  const hasAction = (key) => actions.includes(key);

  const cls = [
    styles.tabBar,
    leadingElement ? styles.hasLeading : '',
    className || '',
  ].filter(Boolean).join(' ');

  return (
    <div className={cls} ref={barRef}>
      <div className={styles.left}>
        {leadingElement}
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
            noClear={dropdownNoClear}
            noClearNeutral={dropdownNoClearNeutral}
            size={dropdownSize}
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

        {hasAction('savedFilters') && (
          <>
            <Button
              variant="outline"
              trailingIconElement={<DownChevronIcon />}
              onClick={onSavedFilters}
              className={savedFiltersActive ? styles.savedFiltersActive : ''}
            >
              {savedFiltersLabel}
            </Button>
            <span className={styles.iconDivider} />
          </>
        )}

        {hasAction('search') && (
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

        {hasAction('filter') && (
          <>
            <ActionButton
              icon="custom:filter"
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

        {hasAction('download') && (
          <>
            <ActionButton
              icon="solar:download-minimalistic-linear"
              tooltip="Download"
              tooltipBelow
              onClick={onDownload}
            />
            <span className={styles.iconDivider} />
          </>
        )}

        {hasAction('upload') && (
          <>
            <Button
              leadingIcon="solar:upload-minimalistic-linear"
              trailingIcon={uploadHasDropdown ? 'solar:alt-arrow-down-linear' : undefined}
              onClick={onUpload}
            >
              {uploadLabel}
            </Button>
            <span className={styles.iconDivider} />
          </>
        )}

        {hasAction('history') && (
          <ActionButton
            icon="solar:history-linear"
            tooltip="History"
            tooltipBelow
            onClick={onHistory}
          />
        )}

        {primaryActionLabel && (
          <Button
            variant={primaryActionVariant}
            leadingIcon={primaryActionIcon || undefined}
            disabled={primaryActionDisabled}
            onClick={onPrimaryAction}
          >
            {primaryActionLabel}
          </Button>
        )}
        {trailingExtras}
      </div>
    </div>
  );
}

// ─────────────────────────── Left-side sections ────────────────────────────

/**
 * Tab strip with overflow handling. Delegates the tab row + sliding underline
 * to `<TabStrip embedded>` (the shared primitive), and layers on the overflow
 * measurement + "More ▾" dropdown that only the SectionTitleBar context
 * needs. When the active tab would land in the overflow bucket we swap it
 * with the last visible slot so the active label always stays on screen.
 */
function TabsSection({ tabs, activeTab, onTabChange, barRef, rightRef }) {
  const [visibleCount, setVisibleCount] = useState(tabs.length);
  const [moreOpen, setMoreOpen] = useState(false);
  const measurerRef = useRef(null);
  const moreBtnRef = useRef(null);

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
    // The right cluster changes width without a window resize (the search
    // box opening, a filter count appearing); re-measure so tabs fold into
    // "More" instead of being cut off.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => measure()) : null;
    if (ro) {
      if (rightRef.current) ro.observe(rightRef.current);
      if (barRef.current) ro.observe(barRef.current);
    }
    return () => {
      window.removeEventListener('resize', measure);
      ro?.disconnect();
    };
  }, [measure, tabs, barRef, rightRef]);

  useEffect(() => {
    if (!moreOpen) return;
    const close = (e) => { if (!moreBtnRef.current?.contains(e.target)) setMoreOpen(false); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [moreOpen]);

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
    <div className={styles.tabsRow}>
      {/* Hidden measurer: renders every tab at its natural width using
          TabStrip's own tab-item class so widths match what TabStrip will
          actually paint. Drives the overflow calc without a second mount. */}
      <div
        ref={measurerRef}
        aria-hidden
        style={{ position: 'absolute', visibility: 'hidden', display: 'flex', gap: 12, pointerEvents: 'none', whiteSpace: 'nowrap' }}
      >
        {tabs.map(tab => (
          <div key={tab.key} data-tab-item className={tabStripStyles.tabItem}>{tab.label}</div>
        ))}
      </div>

      <TabStrip
        items={visible}
        activeKey={activeTab}
        onChange={onTabChange}
        embedded
      />

      {overflow.length > 0 && (
        <div className={styles.moreWrap} ref={moreBtnRef}>
          <div
            className={[tabStripStyles.tabItem, styles.tabMore, overflowHasActive ? tabStripStyles.active : ''].filter(Boolean).join(' ')}
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

function TitleDropdownSection({ title, label, value, options, onChange, noClear = false, noClearNeutral = true, size }) {
  const selected = Array.isArray(value) ? value : value == null || value === '' ? [] : [value];
  return (
    <div className={styles.titleRow}>
      {title && <span className={styles.title}>{title}</span>}
      <FilterChip
        label={label}
        options={options}
        selected={selected}
        singleSelect
        size={size || 'S'}
        noClear={noClear}
        noClearNeutral={noClearNeutral}
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
        <Toggle items={items} value={active} onValueChange={onChange} size="sm" />
      )}
    </div>
  );
}
