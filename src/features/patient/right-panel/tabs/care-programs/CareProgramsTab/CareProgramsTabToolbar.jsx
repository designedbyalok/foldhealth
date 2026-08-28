import { Icon } from '../../../../../../components/Icon/Icon';
import { AddIconMinimalist } from '../../../../../../components/Icon/AddIconMinimalist';
import { DownChevronIcon } from '../../../../../../components/Icon/DownChevronIcon';
import { MenuPopover } from '../../../../../../components/MenuPopover/MenuPopover';
import { SearchBar } from '../../../../../../components/SearchBar/SearchBar';
import { FilterChip } from '../../../../../../components/FilterChip/FilterChip';
import { ActionButton } from '../../../../../../components/ActionButton/ActionButton';
import { Button } from '../../../../../../components/Button/Button';
import { SearchListPopover } from '../../../../../../components/SearchListPopover/SearchListPopover';
import { CP_SUB_TABS, CP_FILTERS } from '../../../../data/programActivityMock';
import { PROGRAM_STATUS_OPTIONS } from '../../../../data/programStatus';
import { ROW_MENU_ITEMS } from './CareProgramsTab.utils';
import styles from './CareProgramsTab.module.css';

export function CareProgramsTabToolbar({
  searchMode, setSearchMode, searchText, setSearchText,
  activeSubTab, setActiveSubTab, showFilters, setShowFilters,
  filters, filterOptionsFor, setFilter, clearFilters,
  npOpen, setNpOpen, npBtnRef, programOptions, handleAddProgram,
  onOpenSummary,
}) {
  const summaryControl = (
    <Button variant="secondary" size="L" leadingIcon="solar:document-text-linear" onClick={onOpenSummary}>
      Care Plan
    </Button>
  );
  const newProgramControl = (align = 'left') => (
    <div className={styles.npWrap}>
      <Button
        ref={npBtnRef}
        variant="tertiary"
        size="L"
        leadingIconElement={<AddIconMinimalist size={16} />}
        trailingIconElement={<DownChevronIcon size={16} />}
        onClick={() => setNpOpen(o => !o)}
      >
        New Program
      </Button>
      {npOpen && (
        <SearchListPopover
          anchorRect={npBtnRef.current?.getBoundingClientRect()}
          align={align}
          options={programOptions}
          onSelect={handleAddProgram}
          onClose={() => setNpOpen(false)}
          searchPlaceholder="Search programs"
          emptyText="No programs found"
        />
      )}
    </div>
  );

  return (
    <div className={styles.topArea}>
      {searchMode ? (
        <div className={styles.subTabBar}>
          <div className={styles.searchWrap}>
            <SearchBar
              className={styles.searchBox350}
              placeholder="Search programs"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              onClose={() => { setSearchMode(false); setSearchText(''); }}
            />
          </div>
          {summaryControl}
          {newProgramControl('right')}
          <span style={{ width: 0.5, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />
          <ActionButton icon="solar:filter-linear" size="S" tooltip="Filter" tooltipLeft
            iconColor={showFilters ? 'var(--primary-300)' : undefined}
            onClick={() => setShowFilters(v => !v)} />
        </div>
      ) : (
        <div className={styles.subTabBar}>
          <div className={styles.subTabs}>
            <ActionButton icon="solar:magnifer-linear" size="S" tooltip="Search" onClick={() => setSearchMode(true)} />
            <span style={{ width: 0.5, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />
            {CP_SUB_TABS.map(tab => (
              <button key={tab} className={`${styles.subTab} ${activeSubTab === tab ? styles.subTabActive : ''}`}
                onClick={() => setActiveSubTab(tab)}>{tab}</button>
            ))}
          </div>
          {summaryControl}
          {newProgramControl('right')}
          <span style={{ width: 0.5, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />
          <ActionButton icon="solar:filter-linear" size="S" tooltip="Filter" tooltipLeft
            iconColor={showFilters ? 'var(--primary-300)' : undefined}
            onClick={() => setShowFilters(v => !v)} />
        </div>
      )}
      {showFilters && (
        <div className={styles.filterBar}>
          {CP_FILTERS.map(f => (
            <FilterChip key={f.key} label={f.label} options={filterOptionsFor(f.key)}
              selected={filters[f.key]} onChange={vals => setFilter(f.key, vals)} />
          ))}
          <button className={styles.clearAll} onClick={clearFilters}>
            <Icon name="solar:backspace-linear" size={16} color="var(--primary-300)" />
            Clear All
          </button>
        </div>
      )}
    </div>
  );
}

export function CareProgramsTabMenus({ statusMenu, setStatusMenu, rowMenu, setRowMenu, visible, changeStatus, handleRowAction }) {
  return (
    <>
      {statusMenu && (
        <MenuPopover
          anchorRect={statusMenu.rect}
          align="left"
          width={180}
          ariaLabel="Change status"
          items={PROGRAM_STATUS_OPTIONS.map(s => ({
            key: s,
            label: <span style={{ color: 'var(--neutral-400)' }}>{s}</span>,
          }))}
          onSelect={(status) => {
            const program = visible.find(p => p.id === statusMenu.id);
            if (program) changeStatus(program, status);
          }}
          onClose={() => setStatusMenu(null)}
        />
      )}
      {rowMenu && (
        <MenuPopover
          anchorRect={rowMenu.rect}
          align="right"
          width={180}
          ariaLabel="Program actions"
          items={ROW_MENU_ITEMS}
          onSelect={(key) => {
            const program = visible.find(p => p.id === rowMenu.id);
            if (program) handleRowAction(key, program);
          }}
          onClose={() => setRowMenu(null)}
        />
      )}
    </>
  );
}
