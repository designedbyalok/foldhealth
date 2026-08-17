import { Icon } from '../../../components/Icon/Icon';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { CloseIcon } from '../../../components/Icon/CloseIcon';
import { IcdSearch } from '../../../components/IcdSearch/IcdSearch';
import { makeCard } from './IcdCard.utils';
import { DiagPanelFilterBar } from './DiagPanelFilterBar';
import { EMPTY_FILTERS } from './DiagPanelFilterBar.utils';
import styles from './DiagPanel.module.css';

export function DiagPanelViewToolbar(p) {
  const {
    addIcdMode, gapExcludeCodes, setPendingGaps, exitAddIcdMode, hccUserRole, bulkMode,
    toggleBulkMode, searchQuery, setSearchQuery, setAddIcdMode, filterCount, filterOpen,
    setFilterOpen, docsCount, commentsCount, diagLeftPanel, setDiagLeftPanel, setFocusIdx,
    setDiagTab, openDocsFromToolbar, moreOpen, setMoreOpen, moreWrapRef, filters, setFilters,
    icdsRaw, notLinkedRaw, member, diagActivityIcd,
  } = p;
  return (
    <>
      {/* ── Toolbar: bulk | inline search | + ICD, filter, docs, comments,
          history, more (Paper 1WXT). In addIcdMode the toolbar collapses
          to a single dedicated search row — all sibling actions hide so
          the user's focus stays on adding an ICD. Exit via the X inside
          the search field. */}
      <div className={styles.toolbar}>
        {addIcdMode ? (
          <div className={styles.toolbarAddIcd}>
            <IcdSearch
              placeholder="Search & Add ICD"
              autoFocus
              excludeCodes={gapExcludeCodes}
              onSelect={(icd) => setPendingGaps(prev => [makeCard(icd), ...prev])}
            />
            <button
              type="button"
              className={styles.toolbarAddIcdClose}
              onClick={exitAddIcdMode}
              aria-label="Close ICD search"
            >
              <Icon name="solar:close-circle-linear" size={16} color="var(--neutral-300)" />
            </button>
          </div>
        ) : (
          <>
            {/* Bulk select is an ICD coding action — Support can't code,
                so hide the entry entirely (matches row-level gating). */}
            {hccUserRole !== 'Support' && (
              <>
                <ActionButton
                  icon={bulkMode ? 'custom:bulk-select-close' : 'custom:bulk-select'}
                  size="S"
                  tooltip={bulkMode ? 'Exit bulk select' : 'Bulk select'}
                  className={bulkMode ? styles.toolbarBtnActive : ''}
                  onClick={toggleBulkMode}
                />
                <span className={styles.divider} />
              </>
            )}
            <div className={styles.toolbarSearch}>
              <Icon name="solar:magnifer-linear" size={14} color="var(--neutral-300)" />
              <input aria-label="Search by code or description"
                type="text"
                placeholder="Search by code or description"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className={styles.searchClear}
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  <Icon name="solar:close-linear" size={13} color="var(--neutral-300)" />
                </button>
              )}
            </div>
            <div className={styles.toolbarIcons}>
              {hccUserRole !== 'Support' && (
                <>
                  <span className={styles.addIcdWrap}>
                    <button
                      type="button"
                      className={styles.addIcdBtn}
                      onClick={() => setAddIcdMode(true)}
                      aria-label="Add ICD"
                    >
                      <Icon
                        name="solar:add-circle-linear"
                        size={16}
                        color="var(--primary-300)"
                      />
                      <span>ICD</span>
                    </button>
                  </span>
                  <span className={styles.divider} />
                </>
              )}
              <ActionButton
                icon="custom:filter"
                size="S"
                tooltip="Filter"
                notification={filterCount > 0}
                count={filterCount > 0 ? String(filterCount) : undefined}
                className={filterOpen ? styles.activeIcon : ''}
                onClick={() => setFilterOpen(v => !v)}
              />
              <span className={styles.divider} />
              <ActionButton
                icon="solar:file-text-linear"
                size="S"
                tooltip="Documents"
                count={String(docsCount)}
                className={[
                  styles.hideBelow460,
                  diagLeftPanel === 'documents' && !diagActivityIcd ? styles.activeIcon : '',
                ].filter(Boolean).join(' ')}
                onClick={openDocsFromToolbar}
              />
              <span className={[styles.divider, styles.hideBelow460].join(' ')} />
              <ActionButton
                icon="solar:chat-round-line-linear"
                size="S"
                tooltip="Comments"
                count={String(commentsCount)}
                className={[
                  styles.hideBelow540,
                  diagLeftPanel === 'comments' && !diagActivityIcd ? styles.activeIcon : '',
                ].filter(Boolean).join(' ')}
                onClick={() => setDiagLeftPanel(diagLeftPanel === 'comments' && !diagActivityIcd ? null : 'comments')}
              />
              <span className={[styles.divider, styles.hideBelow540].join(' ')} />
              <ActionButton
                icon="solar:history-linear"
                size="S"
                tooltip="Timeline"
                className={[
                  styles.hideBelow640,
                  diagLeftPanel === 'activity' && !diagActivityIcd ? styles.activeIcon : '',
                ].filter(Boolean).join(' ')}
                onClick={() => {
                  const closing = diagLeftPanel === 'activity' && !diagActivityIcd;
                  // Deselect the currently-focused ICD so the right-pane ICD
                  // card highlight clears at the same time the left panel
                  // drops out of ICD scope.
                  setFocusIdx(-1);
                  setDiagLeftPanel(closing ? null : 'activity');
                }}
              />
              <span className={[styles.divider, styles.showToolbarMore].join(' ')} />
              <span className={[styles.toolbarMoreWrap, styles.showToolbarMore].join(' ')} ref={moreWrapRef}>
                <ActionButton
                  icon="solar:menu-dots-linear"
                  size="S"
                  tooltip="More"
                  onClick={(e) => { e.stopPropagation(); setMoreOpen(v => !v); }}
                  className={moreOpen ? styles.activeIcon : ''}
                />
                {moreOpen && (
                  <div className={styles.toolbarMoreDropdown} role="menu">
                    <button
                      type="button"
                      className={[styles.toolbarMoreItem, styles.showBelow460].join(' ')}
                      role="menuitem"
                      onClick={() => { setMoreOpen(false); openDocsFromToolbar(); }}
                    >
                      <Icon name="solar:file-text-linear" size={16} color="var(--neutral-400)" />
                      <span>Documents</span>
                      <span className={styles.toolbarMoreItemCount}>{docsCount}</span>
                    </button>
                    <button
                      type="button"
                      className={[styles.toolbarMoreItem, styles.showBelow540].join(' ')}
                      role="menuitem"
                      onClick={() => {
                        setMoreOpen(false);
                        setDiagLeftPanel(diagLeftPanel === 'comments' && !diagActivityIcd ? null : 'comments');
                      }}
                    >
                      <Icon name="solar:chat-round-line-linear" size={16} color="var(--neutral-400)" />
                      <span>Comments</span>
                      <span className={styles.toolbarMoreItemCount}>{commentsCount}</span>
                    </button>
                    <button
                      type="button"
                      className={[styles.toolbarMoreItem, styles.showBelow640].join(' ')}
                      role="menuitem"
                      onClick={() => {
                        setMoreOpen(false);
                        setDiagLeftPanel(diagLeftPanel === 'activity' && !diagActivityIcd ? null : 'activity');
                      }}
                    >
                      <Icon name="solar:history-linear" size={16} color="var(--neutral-400)" />
                      <span>Timeline</span>
                    </button>
                  </div>
                )}
              </span>
            </div>
          </>
        )}
      </div>

      {filterOpen && (
        <DiagPanelFilterBar
          filters={filters}
          icds={[...icdsRaw, ...notLinkedRaw]}
          member={member}
          onChange={setFilters}
          onClearAll={() => setFilters(EMPTY_FILTERS)}
        />
      )}
    </>
  );
}
