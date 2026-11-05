import { Icon } from '../../components/Icon/Icon';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { FilterChip } from '../../components/FilterChip/FilterChip';
import { DOC_TYPES } from './data/chartDocs';
import diagStyles from './DiagPanel/DiagPanel.module.css';
import styles from './ChartDetailDrawer.module.css';

// Support-only Doc Review toolbar. Mirrors the DiagPanel toolbar 1:1
// (Figma HCC / DiagPanel) with the Coder-only actions stripped:
//   • no Bulk select and no Add ICD (both are coding actions)
//   • no Documents toggle (this drawer's whole right pane IS the docs list)
// Keeps: Search, Filter, Comment, Timeline, More overflow. Toggles map
// to the same shared state the DOS-level buttons used to drive.
const DOC_STATUS_OPTIONS = ['Pending', 'Passed', 'Failed'];
const DATE_PRESETS = ['Today', 'Last 7 days', 'Last 30 days', 'This month'];

export function ChartReviewToolbar({
  searchQuery,
  setSearchQuery,
  filterOpen,
  setFilterOpen,
  docFilters,
  setDocFilter,
  uploadedByOptions,
  commentsCount,
  leftPanel,
  setLeftPanel,
  moreOpen,
  setMoreOpen,
  moreWrapRef,
  actionsLocked,
  actionsLockedTip,
  showUpload,
  onUploadToggle,
}) {
  const activeFilterCount = ['docType', 'status', 'uploadedBy', 'date']
    .reduce((n, k) => n + (docFilters?.[k]?.length ? 1 : 0), 0);
  const commentsActive = leftPanel === 'comments';
  const activityActive = leftPanel === 'activity';
  const toggleLeftPanel = (target) => setLeftPanel(v => v === target ? 'preview' : target);

  return (
    <>
      <div className={diagStyles.toolbar}>
        <div className={diagStyles.toolbarSearch}>
          <Icon name="solar:magnifer-linear" size={14} color="var(--neutral-300)" />
          <input
            aria-label="Search documents"
            type="text"
            placeholder="Search by document name or type"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className={diagStyles.searchClear}
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              <Icon name="solar:close-linear" size={13} color="var(--neutral-300)" />
            </button>
          )}
        </div>
        <div className={diagStyles.toolbarIcons}>
          {onUploadToggle && (
            <>
              <button
                type="button"
                className={[styles.uploadLink, showUpload ? styles.uploadLinkActive : ''].filter(Boolean).join(' ')}
                onClick={actionsLocked ? undefined : onUploadToggle}
                disabled={actionsLocked}
                title={actionsLocked ? actionsLockedTip : undefined}
              >
                <Icon name="solar:upload-minimalistic-linear" size={16} color="var(--primary-300)" />
                Upload
              </button>
              <span className={diagStyles.divider} />
            </>
          )}
          <ActionButton
            icon="custom:filter"
            size="sm"
            tooltip="Filter"
            notification={activeFilterCount > 0}
            count={activeFilterCount > 0 ? String(activeFilterCount) : undefined}
            className={filterOpen ? diagStyles.activeIcon : ''}
            onClick={() => setFilterOpen(v => !v)}
          />
          <span className={diagStyles.divider} />
          <ActionButton
            icon="solar:chat-round-line-linear"
            size="sm"
            tooltip={actionsLocked ? actionsLockedTip : 'Comments'}
            count={commentsCount > 0 ? String(commentsCount) : undefined}
            className={[
              diagStyles.hideBelow540,
              commentsActive ? diagStyles.activeIcon : '',
            ].filter(Boolean).join(' ')}
            onClick={actionsLocked ? undefined : () => toggleLeftPanel('comments')}
            aria-pressed={commentsActive}
            disabled={actionsLocked}
          />
          <span className={[diagStyles.divider, diagStyles.hideBelow540].join(' ')} />
          <ActionButton
            icon="solar:history-linear"
            size="sm"
            tooltip="Timeline"
            className={[
              diagStyles.hideBelow640,
              activityActive ? diagStyles.activeIcon : '',
            ].filter(Boolean).join(' ')}
            onClick={() => toggleLeftPanel('activity')}
            aria-pressed={activityActive}
          />
          <span className={[diagStyles.divider, diagStyles.showToolbarMore].join(' ')} />
          <span className={[diagStyles.toolbarMoreWrap, diagStyles.showToolbarMore].join(' ')} ref={moreWrapRef}>
            <ActionButton
              icon="solar:menu-dots-linear"
              size="sm"
              tooltip="More"
              onClick={(e) => { e.stopPropagation(); setMoreOpen(v => !v); }}
              className={moreOpen ? diagStyles.activeIcon : ''}
            />
            {moreOpen && (
              <div className={diagStyles.toolbarMoreDropdown} role="menu">
                <button
                  type="button"
                  className={[diagStyles.toolbarMoreItem, diagStyles.showBelow540].join(' ')}
                  role="menuitem"
                  disabled={actionsLocked}
                  onClick={() => {
                    setMoreOpen(false);
                    if (!actionsLocked) toggleLeftPanel('comments');
                  }}
                >
                  <Icon name="solar:chat-round-line-linear" size={16} color="var(--neutral-400)" />
                  <span>Comments</span>
                  <span className={diagStyles.toolbarMoreItemCount}>{commentsCount}</span>
                </button>
                <button
                  type="button"
                  className={[diagStyles.toolbarMoreItem, diagStyles.showBelow640].join(' ')}
                  role="menuitem"
                  onClick={() => {
                    setMoreOpen(false);
                    toggleLeftPanel('activity');
                  }}
                >
                  <Icon name="solar:history-linear" size={16} color="var(--neutral-400)" />
                  <span>Timeline</span>
                </button>
              </div>
            )}
          </span>
        </div>
      </div>

      {filterOpen && (
        <div className={styles.toolbarFilterRow}>
          <FilterChip
            label="Document Type"
            options={DOC_TYPES}
            selected={docFilters?.docType || []}
            onChange={(v) => setDocFilter('docType', v)}
            size="S"
          />
          <FilterChip
            label="Status"
            options={DOC_STATUS_OPTIONS}
            selected={docFilters?.status || []}
            onChange={(v) => setDocFilter('status', v)}
            size="S"
          />
          <FilterChip
            label="Uploaded By"
            options={uploadedByOptions || []}
            selected={docFilters?.uploadedBy || []}
            onChange={(v) => setDocFilter('uploadedBy', v)}
            size="S"
            searchable
          />
          <FilterChip
            label="Date"
            options={DATE_PRESETS}
            selected={docFilters?.date || []}
            onChange={(v) => setDocFilter('date', v)}
            size="S"
          />
        </div>
      )}
    </>
  );
}
