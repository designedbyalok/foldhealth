import { useContext, useState, useRef, useEffect } from 'react';
import { Icon } from '../Icon/Icon';
import { Badge } from '../Badge/Badge';
import { Button } from '../Button/Button';
import { Input } from '../Input/Input';
import { MenuPopover } from '../MenuPopover/MenuPopover';
import { EnterIcon } from '../Icon/EnterIcon';
import { useAutoPageSize } from './useAutoPageSize';
import { PageSizePreference } from './PageSizePreference';
import styles from './Pagination.module.css';

/**
 * Pagination: page navigator + per-page selector + go-to input.
 *
 * Controlled with `currentPage` + `onPageChange` (and `perPage` +
 * `onPerPageChange`), or left to keep its own page. `totalItems` is the
 * number of rows being paged.
 *
 * Page size follows the user's preference (PageSizePreference): fit to the
 * viewport, or a size they picked, which the app saves per user.
 *
 * Record count: once a filter or search narrows the table, a badge at the
 * far left reads "x of y records found". Pass `totalCount` (rows before
 * filtering) and `filtered` (a filter or search is active). `filtered`
 * defaults to the count differing from `totalCount`; `filteredCount`
 * overrides x when `totalItems` also counts rows that aren't records.
 */
const MIN_PAGE_SIZE = 10;

export function Pagination({
  totalItems = 0,
  currentPage: currentPageProp,
  perPage: perPageProp,
  onPageChange,
  onPerPageChange,
  totalCount,
  filtered: filteredProp,
  filteredCount,
} = {}) {
  const pref = useContext(PageSizePreference);
  const [ownPage, setOwnPage] = useState(1);
  const [ownPerPage, setOwnPerPage] = useState(pref.size || 10);
  const currentPage = currentPageProp ?? ownPage;
  const perPage = perPageProp ?? ownPerPage;
  const setCurrentPage = onPageChange ?? setOwnPage;
  const setPerPage = onPerPageChange ?? setOwnPerPage;

  const matched = filteredCount ?? totalItems;
  const isFiltered = filteredProp ?? matched !== totalCount;
  const showCount = isFiltered && totalCount != null;
  const [goToInput, setGoToInput] = useState('');
  const perPageBtnRef = useRef(null);
  const [perPageMenuRect, setPerPageMenuRect] = useState(null);

  // Page size follows the viewport until the user picks an explicit size,
  // so a tall screen fills with rows instead of white space. The choice is
  // a per-user preference persisted in Supabase, not view-local state, so
  // it holds across tables, reloads, and devices.
  const { auto: autoPageSize, size: manualPageSize, loaded: pageSizePrefLoaded, load: fetchPageSizePref, save: savePageSizePref } = pref;

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

  // Hidden only when the rows fit on one page at the smallest size. Hiding it
  // whenever they fit the current size also hid the page-size menu, so a table
  // left on 50 / Page with 19 rows had no way back to 10.
  if (totalItems <= Math.min(perPage, MIN_PAGE_SIZE)) return null;

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
