import { useState, useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Icon } from '../Icon/Icon';
import { Select } from '../Select/Select';
import styles from './Pagination.module.css';

/**
 * Pagination — page navigator + per-page selector + go-to input.
 *
 * Two usage modes:
 *
 * 1. Store-driven (default) — used by the TOC Worklist + HCC worklist.
 *    Reads currentPage / perPage / searchQuery / etc. from useAppStore
 *    and derives the total item count from the active subnav.
 *
 * 2. Controlled — pass currentPage / perPage / totalItems / onPageChange /
 *    onPerPageChange. The store reads are skipped and the caller owns state.
 *    Used by APCM Billing (and any future feature that paginates from
 *    local state).
 */
export function Pagination({
  totalItems: totalItemsProp,
  currentPage: currentPageProp,
  perPage: perPageProp,
  onPageChange,
  onPerPageChange,
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
  // passed `totalItems`, use it as-is — they know better than this generic
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
  const [goToInput, setGoToInput] = useState('');

  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));

  const goTo = (page) => {
    const p = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(p);
  };

  const handlePerPageChange = (val) => {
    setPerPage(Number(val));
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

  // Worklist-specific early returns — only apply in store-driven mode.
  // Don't show pagination for queue with empty state.
  if (!controlled && activeTab === 'toc-queue' && totalItems === 0) return null;
  // Don't show pagination for outreach status grouped view (uses collapsible sections).
  if (!controlled && activeTab === 'toc-worklist' && viewBy === 'status') return null;

  return (
    <div className={styles.pagination}>
      <button
        className={styles.btn}
        onClick={() => goTo(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="Previous page"
      >
        <Icon name="solar:alt-arrow-left-linear" size={18} />
      </button>

      {getPageNumbers().map((p, i) =>
        p === '...' ? (
          <span key={`ellipsis-${i}`} className={styles.ellipsis}>…</span>
        ) : (
          <button
            key={p}
            className={`${styles.btn} ${p === currentPage ? styles.active : ''}`}
            onClick={() => goTo(p)}
            aria-label={`Page ${p}`}
            aria-current={p === currentPage ? 'page' : undefined}
          >
            {p}
          </button>
        )
      )}

      <button
        className={styles.btn}
        onClick={() => goTo(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="Next page"
      >
        <Icon name="solar:alt-arrow-right-linear" size={18} />
      </button>

      <Select
        className={styles.perPage}
        options={[
          { value: '10', label: '10 / Page' },
          { value: '25', label: '25 / Page' },
          { value: '50', label: '50 / Page' },
        ]}
        value={String(perPage)}
        onChange={handlePerPageChange}
      />

      <div className={styles.goToWrapper}>
        <input
          className={styles.goToInput}
          type="number"
          min={1}
          max={totalPages}
          placeholder="#"
          value={goToInput}
          onChange={(e) => setGoToInput(e.target.value)}
          onKeyDown={handleGoToKeyDown}
        />
        <button className={styles.goBtn} onClick={handleGoToPage}>
          Go to Page
        </button>
      </div>
    </div>
  );
}
