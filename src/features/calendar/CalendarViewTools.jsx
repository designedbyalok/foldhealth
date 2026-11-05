import { useState } from 'react';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { SearchBar } from '../../components/SearchBar/SearchBar';
import { SegmentedControl } from '../../components/SegmentedControl/SegmentedControl';
import { ListCollapseIcon, ListExpandIcon } from '../../components/Icon/ListCollapseIcon';
import styles from './CalendarView.module.css';

const GROUP_MODES = [
  { key: 'collapsed', icon: <ListCollapseIcon />, ariaLabel: 'Collapse all', tooltip: 'Collapse all' },
  { key: 'expanded', icon: <ListExpandIcon />, ariaLabel: 'Expand all', tooltip: 'Expand all' },
];

/**
 * A view's own tools, at the end of the Calendar's filter row: search (grows
 * out of its icon), then, for the List view, collapse or expand every provider.
 */
export function CalendarViewTools({ search = '', onSearchChange, placeholder = 'Search', groupsMode, onGroupsModeChange }) {
  // Back on a view with a search still applied, the box opens showing it.
  const [searchOpen, setSearchOpen] = useState(!!search);
  // Closing plays the search box shrinking back into the icon, then swaps.
  const [searchClosing, setSearchClosing] = useState(false);
  const closeSearch = () => {
    setSearchClosing(true);
    setTimeout(() => { setSearchOpen(false); setSearchClosing(false); onSearchChange?.(''); }, 200);
  };
  return (
    <div className={styles.listTools}>
      {searchOpen ? (
        <SearchBar
          className={`${styles.listSearch} ${searchClosing ? styles.listSearchClosing : ''}`}
          placeholder={placeholder}
          value={search}
          onChange={e => onSearchChange?.(e.target.value)}
          onClose={closeSearch}
        />
      ) : (
        <ActionButton icon="solar:magnifer-linear" tooltip="Search" onClick={() => setSearchOpen(true)} />
      )}
      {onGroupsModeChange && (
        <>
          <span className={styles.listToolsDivider} aria-hidden="true" />
          <SegmentedControl items={GROUP_MODES} value={groupsMode} onValueChange={onGroupsModeChange} size="sm" />
        </>
      )}
    </div>
  );
}
