import { SearchBar } from '../../../../../../components/SearchBar/SearchBar';
import { ActionButton } from '../../../../../../components/ActionButton/ActionButton';
import styles from './CareManagementToolbar.module.css';

const Divider = () => <span className={styles.vDivider} />;

/**
 * Shared Care Management toolbar row — identical across every sub-tab:
 * [search] | [sub-tabs] … [per-tab CTA] | [filter]. Only the `cta` (and the
 * `filterBar` it toggles) change per tab; search and filter are always present.
 *
 * Search + filter state is owned by the calling tab so each tab searches and
 * filters its own content; this component is purely the layout.
 */
export function CareManagementToolbar({
  header,
  searchMode, setSearchMode, searchText, setSearchText, searchPlaceholder = 'Search',
  cta,
  showFilters, setShowFilters,
  filterBar,
}) {
  const filterBtn = (
    <ActionButton
      icon="solar:filter-linear"
      size="S"
      tooltip="Filter"
      tooltipLeft
      iconColor={showFilters ? 'var(--primary-300)' : undefined}
      onClick={() => setShowFilters(v => !v)}
    />
  );

  return (
    <div className={styles.topArea}>
      {searchMode ? (
        <div className={styles.subTabBar}>
          <div className={styles.searchWrap}>
            <SearchBar
              className={styles.searchBox350}
              placeholder={searchPlaceholder}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              onClose={() => { setSearchMode(false); setSearchText(''); }}
            />
          </div>
          {cta}
          <Divider />
          {filterBtn}
        </div>
      ) : (
        <div className={styles.subTabBar}>
          <ActionButton icon="solar:magnifer-linear" size="S" tooltip="Search" onClick={() => setSearchMode(true)} />
          <Divider />
          <div className={styles.subTabs}>{header}</div>
          {cta}
          <Divider />
          {filterBtn}
        </div>
      )}
      {showFilters && filterBar}
    </div>
  );
}
