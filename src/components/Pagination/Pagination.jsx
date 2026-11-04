import { useState, useMemo, useRef, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Icon } from '../Icon/Icon';
import { Badge } from '../Badge/Badge';
import { Button } from '../Button/Button';
import { Input } from '../Input/Input';
import { MenuPopover } from '../MenuPopover/MenuPopover';
import { EnterIcon } from '../Icon/EnterIcon';
import { useAutoPageSize } from './useAutoPageSize';
import styles from './Pagination.module.css';

/**
 * Pagination: page navigator + per-page selector + go-to input.
 *
 * Two usage modes:
 *
 * 1. Store-driven (default): used by the TCM Worklist + HCC worklist.
 *    Reads currentPage / perPage / searchQuery / etc. from useAppStore
 *    and derives the total item count from the active subnav.
 *
 * 2. Controlled: pass currentPage / perPage / totalItems / onPageChange /
 *    onPerPageChange. The store reads are skipped and the caller owns state.
 *    Used by APCM Billing (and any future feature that paginates from
 *    local state).
 *
 * Record count: once a filter or search narrows the table, a badge at the
 * far left reads "x of y records found". Pass `totalCount` (rows before
 * filtering) and `filtered` (a filter or search is active). `filtered`
 * defaults to the count differing from `totalCount`; `filteredCount`
 * overrides x when `totalItems` also counts rows that aren't records.
 * Store-driven mode works both out from the store.
 */
export function Pagination({
  totalItems: totalItemsProp,
  currentPage: currentPageProp,
  perPage: perPageProp,
  onPageChange,
  onPerPageChange,
  totalCount: totalCountProp,
  filtered: filteredProp,
  filteredCount,
} = {}) {
  // True when the caller drives state. In this mode all the worklist-specific
  // derivations (queue early-return, viewBy short-circuit, etc.) are skipped.
  const controlled = currentPageProp != null && onPageChange != null;

  const storeCurrentPage = useAppStore(s => s.currentPage);
  const storePerPage = useAppStore(s => s.perPage);
  const patients = useAppStore(s => s.patients);
  const hccMembers = useAppStore(s => s.hccMembers);
  const activeSubnavList = useAppStore(s => s.activeSubnavList);
  const searchQuery = useAppStore(s => s.searchQuery);
  const activeTab = useAppStore(s => s.activeTab);
  const activeFilters = useAppStore(s => s.activeFilters);
  const viewBy = useAppStore(s => s.viewBy);
  const storeSetCurrentPage = useAppStore(s => s.setCurrentPage);
  const storeSetPerPage = useAppStore(s => s.setPerPage);

  const currentPage = controlled ? currentPageProp : storeCurrentPage;
  const perPage = perPageProp ?? storePerPage;
  const setCurrentPage = onPageChange ?? storeSetCurrentPage;
  const setPerPage = onPerPageChange ?? storeSetPerPage;

  const isHcc = activeSubnavList === 'HCC';
  const isAllPatients = activeSubnavList === 'All Patients';
  const allPatients = useAppStore(s => s.allPatients);

  // Derive the total count based on what's actually being shown. If the caller
  // passed `totalItems`, use it as-is, they know better than this generic
  // pipeline what's currently rendered.
  const totalItemsComputed = useMemo(() => {
    if (isAllPatients) {
      const base = allPatients.length > 0 ? allPatients : [...patients, ...hccMembers];
      if (!searchQuery.trim()) return base.length;
      const q = searchQuery.toLowerCase().trim();
      return base.filter(r =>
        r.name?.toLowerCase().includes(q) ||
        r.memberId?.toString().toLowerCase().includes(q) ||
        r.pcp?.toLowerCase().includes(q)
      ).length;
    }
    // HCC list: just search-filter against hccMembers
    if (isHcc) {
      if (!searchQuery.trim()) return hccMembers.length;
      const q = searchQuery.toLowerCase().trim();
      return hccMembers.filter(m =>
        m.name?.toLowerCase().includes(q) ||
        m.in?.toLowerCase().includes(q) ||
        m.id?.toLowerCase().includes(q)
      ).length;
    }

    let result = patients;

    // For queue tab, only count patients with agents assigned
    if (activeTab === 'toc-queue') {
      result = result.filter(p => p.agentAssigned);
      return result.length;
    }

    // For worklist tab, apply search + filters
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.memberId?.toLowerCase().includes(q) ||
        p.initials?.toLowerCase().includes(q)
      );
    }

    // Apply active filters
    for (const [key, value] of Object.entries(activeFilters)) {
      if (value) {
        result = result.filter(p => p[key] === value);
      }
    }

    return result.length;
  }, [isHcc, isAllPatients, allPatients, hccMembers, patients, searchQuery, activeTab, activeFilters]);

  const totalItems = totalItemsProp != null ? totalItemsProp : totalItemsComputed;

  let totalCount = totalCountProp;
  if (totalCount == null && !controlled && activeTab !== 'toc-queue') {
    if (isAllPatients) totalCount = (allPatients.length > 0 ? allPatients : [...patients, ...hccMembers]).length;
    else totalCount = isHcc ? hccMembers.length : patients.length;
  }
  const storeFiltered = !!searchQuery.trim() || Object.values(activeFilters).some(Boolean);
  const matched = filteredCount ?? totalItems;
  const isFiltered = filteredProp ?? (controlled ? matched !== totalCount : storeFiltered);
  const showCount = isFiltered && totalCount != null;
  const [goToInput, setGoToInput] = useState('');
  const perPageBtnRef = useRef(null);
  const [perPageMenuRect, setPerPageMenuRect] = useState(null);

  // Page size follows the viewport until the user picks an explicit size,
  // so a tall screen fills with rows instead of white space. The choice is
  // a per-user preference persisted in Supabase, not view-local state, so
  // it holds across tables, reloads, and devices.
  const autoPageSize = useAppStore(s => s.autoPageSize);
  const manualPageSize = useAppStore(s => s.manualPageSize);
  const pageSizePrefLoaded = useAppStore(s => s.pageSizePrefLoaded);
  const fetchPageSizePref = useAppStore(s => s.fetchPageSizePref);
  const savePageSizePref = useAppStore(s => s.savePageSizePref);

  useEffect(() => { fetchPageSizePref(); }, [fetchPageSizePref]);

  // Apply a saved manual size to whichever table just mounted. Controlled
  // callers each start from their own useState default, so without this the
  // stored preference would only ever apply to the table it was set on.
  useEffect(() => {
    if (pageSizePrefLoaded && !autoPageSize && perPage !== manualPageSize) {
      setPerPage(manualPageSize);
    }
    // Runs on mount and when the preference changes, deliberately not on
    // every perPage change, which would fight the user mid-interaction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSizePrefLoaded, autoPageSize, manualPageSize]);

  const barRef = useRef(null);
  useAutoPageSize({
    anchorRef: barRef,
    enabled: autoPageSize,
    perPage,
    totalItems,
    onFit: setPerPage,
  });

  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));

  const goTo = (page) => {
    const p = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(p);
  };

  const handlePerPageChange = (val) => {
    if (val === 'auto') {
      savePageSizePref({ auto: true }); // next measure re-fits to the viewport
      return;
    }
    const size = Number(val);
    savePageSizePref({ auto: false, size });
    setPerPage(size);
  };

  const handleGoToPage = () => {
    const page = parseInt(goToInput, 10);
    if (!isNaN(page)) {
      goTo(page);
      setGoToInput('');
    }
  };

  const handleGoToKeyDown = (e) => {
    if (e.key === 'Enter') handleGoToPage();
  };

  // Build page numbers with ellipsis
  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  // Worklist-specific early returns: only apply in store-driven mode.
  // Don't show pagination for queue with empty state.
  if (!controlled && activeTab === 'toc-queue' && totalItems === 0) return null;
  // Don't show pagination for outreach status grouped view (uses collapsible sections).
  if (!controlled && activeTab === 'toc-worklist' && viewBy === 'status') return null;
  // Everything that matches already fits on one page: nothing to page through.
  if (totalItems <= perPage) return null;

  const perPageOptions = [
    { key: 'auto', label: autoPageSize ? `Auto (${perPage})` : 'Auto' },
    { key: '10', label: '10 / Page' },
    { key: '25', label: '25 / Page' },
    { key: '50', label: '50 / Page' },
  ];
  const perPageValue = autoPageSize ? 'auto' : String(perPage);

  return (
    <div className={styles.pagination} ref={barRef}>
      {showCount && (
        <span className={styles.summary}>
          <Badge size="sm" label={`${matched} of ${totalCount} records found`} />
        </span>
      )}

      {/* Figma SNP-Story 2653:877579: one grey group holding the page
          toggles, page size and go-to field. */}
      <div className={styles.group}>
        <button
          type="button"
          className={styles.toggle}
          onClick={() => goTo(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Previous page"
        >
          <Icon name="solar:arrow-left-linear" size={16} />
        </button>

        {getPageNumbers().map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className={styles.toggle} aria-hidden="true">...</span>
          ) : (
            <button
              type="button"
              key={p}
              className={`${styles.toggle} ${p === currentPage ? styles.active : ''}`}
              onClick={() => goTo(p)}
              aria-label={`Page ${p}`}
              aria-current={p === currentPage ? 'page' : undefined}
            >
              {p}
            </button>
          )
        )}

        <button
          type="button"
          className={styles.toggle}
          onClick={() => goTo(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Next page"
        >
          <Icon name="solar:arrow-right-linear" size={16} />
        </button>

        <Button
          ref={perPageBtnRef}
          variant="outline"
          size="sm"
          trailingIcon="solar:alt-arrow-down-linear"
          aria-haspopup="menu"
          aria-expanded={!!perPageMenuRect}
          onClick={() => setPerPageMenuRect(perPageMenuRect ? null : perPageBtnRef.current?.getBoundingClientRect() ?? null)}
        >
          {perPageOptions.find(o => o.key === perPageValue)?.label ?? `${perPage} / Page`}
        </Button>
        {perPageMenuRect && (
          <MenuPopover
            anchorRect={perPageMenuRect}
            anchorRef={perPageBtnRef}
            items={perPageOptions.map(o => ({ ...o, selected: o.key === perPageValue }))}
            onSelect={(key) => { handlePerPageChange(key); setPerPageMenuRect(null); }}
            onClose={() => setPerPageMenuRect(null)}
            ariaLabel="Rows per page"
            width={140}
            align="left"
          />
        )}

        <Input
          inputMode="numeric"
          placeholder="Go to Page"
          aria-label="Go to page number"
          wrapperClassName={styles.goTo}
          value={goToInput}
          onChange={(e) => setGoToInput(e.target.value.replace(/\D/g, ''))}
          onKeyDown={handleGoToKeyDown}
          onStepUp={() => setGoToInput(String(Math.min(totalPages, (parseInt(goToInput, 10) || currentPage) + 1)))}
          onStepDown={() => setGoToInput(String(Math.max(1, (parseInt(goToInput, 10) || currentPage) - 1)))}
          trailingTextSegment
          trailingText={(
            <button type="button" className={styles.enterBtn} onClick={handleGoToPage} aria-label="Go to page">
              <EnterIcon size={16} />
            </button>
          )}
        />
      </div>
    </div>
  );
}
