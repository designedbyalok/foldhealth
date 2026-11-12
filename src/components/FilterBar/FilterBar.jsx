import { useMemo, useRef, useState, useLayoutEffect } from 'react';
import { FilterChip } from '../FilterChip/FilterChip';
import { FilterNameDialog } from './FilterNameDialog';
import { MoreFiltersPopover } from './MoreFiltersPopover';
import { mergeRefs } from './filterBarUtils';
import { SingleSelectFilter } from './SingleSelectFilter';
import { FilterBarTail } from './FilterBarTail';
import styles from './FilterBar.module.css';

const NO_DEFS = [];
const NO_FILTERS = {};

export function FilterBar({
  filterDefs,
  filters,
  onFilterChange,
  onClearAll,
  onSaveFilter,
  getOptions,
  multiSelect = false,
  visibleKeys: visibleKeysProp,
  onToggleVisible,
  onClearVisible,
  moreFilterItems,
  leading,
  saveDialogTitle = 'Save Filter',
  renderChip,
  chipsRef,
  tailRef,
  mirrorContent,
  hasActive: hasActiveProp,
  showInternalSaveDialog = true,
  showMoreFilters = true,
  showSaveFilter = true,
  autoFit = false,
  primaryKeys: primaryKeysProp,
  // A selected saved filter (see useSavedFilterActions): Clear All's and
  // Save Filter's labels, and the Save Filter ⌄ menu ([{ key, label }] +
  // onSelect(key)).
  clearAllLabel,
  saveLabel,
  // Spec mode (worklist filter allocation): the primary chips that fit on the
  // first line (next to More Filters / Clear All / Save Filter) show, in
  // roster order; the rest move into More Filters (under "Primary", above the
  // secondary filters grouped by `group` / domain). Filters picked there, or
  // with a value but not among those primaries, follow them and wrap onto
  // more lines as needed, so they never push a primary out. Unchecking a pick
  // clears its value. Picks are kept here, not in `visibleKeys`, so an old
  // stored visible set can't reshuffle the primaries.
  pinPrimary = false,
  saveMenuItems,
  onSaveMenuSelect,
  // 'inline': the bar sits inside a section (P360 tabs, Figma 6063:261110)
  // rather than under a page header: no border or background, tighter
  // spacing, and Clear All as a primary link with its icon.
  variant = 'page',
  // More Filters' grouped layout: the order of the domain headings.
  groupOrder,
  // The worklist's filter row is closed: show only the filters that have a
  // value (still clearable) and Clear All, so the user can see what's
  // narrowing the list. Nothing renders when no filter is set.
  collapsed = false,
} = {}) {

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [customVisible, setCustomVisible] = useState(null);
  const moreBtnRef = useRef(null);
  const [moreRect, setMoreRect] = useState(null);
  const internalChipsRef = useRef(null);
  const internalTailRef = useRef(null);
  const measureRef = useRef(null);
  const leadingRef = useRef(null);
  const setChipsRef = mergeRefs(internalChipsRef, chipsRef);
  const setTailRef = mergeRefs(internalTailRef, tailRef);

  // Memoised: filterDefsForList builds new defs each call, and the auto-fit
  // effect below depends on them.
  const effectiveDefs = filterDefs ?? NO_DEFS;
  const effectiveFilters = filters ?? NO_FILTERS;
  const effectiveGetOptions = getOptions ?? ((def) => def.options ?? []);
  const effectiveOnFilterChange = onFilterChange ?? (() => {});
  const effectiveOnClearAll = onClearAll ?? (() => {});
  const effectiveOnSaveFilter = onSaveFilter ?? (() => {});
  const effectiveMoreItems = moreFilterItems ?? effectiveDefs.map(fd => ({ k: fd.key, label: fd.label, primary: fd.primary, group: fd.group }));
  const fitToRow = autoFit || pinPrimary;
  // Spec mode: the filters picked from More Filters.
  const picks = useMemo(() => (pinPrimary ? customVisible ?? [] : []), [pinPrimary, customVisible]);

  const keyOrder = useMemo(
    () => Object.fromEntries(effectiveDefs.map((fd, i) => [fd.key, i])),
    [effectiveDefs],
  );
  const defByKey = useMemo(
    () => Object.fromEntries(effectiveDefs.map(fd => [fd.key, fd])),
    [effectiveDefs],
  );
  const primaryKeys = useMemo(() => {
    if (primaryKeysProp) return primaryKeysProp;
    const keys = [];
    for (const fd of effectiveDefs) {
      if (fd.primary) keys.push(fd.key);
    }
    return keys;
  }, [effectiveDefs, primaryKeysProp]);

  const activeKeys = useMemo(() => {
    if (multiSelect) {
      return Object.keys(effectiveFilters).filter(k => (effectiveFilters[k] || []).length > 0);
    }
    return Object.keys(effectiveFilters).filter(k => effectiveFilters[k] != null);
  }, [effectiveFilters, multiSelect]);

  const orderKeys = (keys) => [...new Set(keys)].sort(
    (a, b) => (keyOrder[a] ?? 99) - (keyOrder[b] ?? 99),
  );

  const [autoInactive, setAutoInactive] = useState(null);
  const customized = customVisible !== null;
  const activeKeySet = useMemo(() => new Set(activeKeys), [activeKeys]);
  const inactivePrimary = useMemo(
    () => primaryKeys.filter(k => !activeKeySet.has(k)),
    [primaryKeys, activeKeySet],
  );

  useLayoutEffect(() => {
    if (!fitToRow) { setAutoInactive(null); return undefined; }
    if (!pinPrimary && (visibleKeysProp !== undefined || customized)) {
      setAutoInactive(null);
      return undefined;
    }
    const container = internalChipsRef.current;
    const mirror = measureRef.current;
    if (!container || !mirror) return undefined;
    const GAP = 6;
    const widthOf = (k) => mirror.querySelector(`[data-mk="${k}"]`)?.offsetWidth ?? 0;
    const compute = () => {
      const avail = container.clientWidth;
      let budget = avail;
      const tailW = internalTailRef.current?.offsetWidth ?? 0;
      if (tailW) budget -= tailW + GAP;
      const leadW = leadingRef.current?.offsetWidth ?? 0;
      if (leadW) budget -= leadW + GAP;
      const fit = new Set();
      if (pinPrimary) {
        // First line: primaries in roster order (with their values) until
        // one doesn't fit. Picks and other values go on the second line.
        for (const k of primaryKeys) {
          const w = widthOf(k) + GAP;
          if (budget - w >= 0) { budget -= w; fit.add(k); } else break;
        }
        setAutoInactive(prev => (prev && prev.size === fit.size && [...fit].every(k => prev.has(k)) ? prev : fit));
        return;
      }
      activeKeys.forEach(k => { budget -= widthOf(k) + GAP; });
      for (const k of inactivePrimary) {
        const w = widthOf(k) + GAP;
        if (budget - w >= 0) { budget -= w; fit.add(k); } else break;
      }
      // Same chips as last time: keep the old set so nothing re-renders.
      setAutoInactive(prev => (prev && prev.size === fit.size && [...fit].every(k => prev.has(k)) ? prev : fit));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(container);
    return () => ro.disconnect();
  }, [fitToRow, pinPrimary, primaryKeys, effectiveFilters, visibleKeysProp, customized, activeKeys, inactivePrimary]);


  // Spec mode: the primaries that fit, then everything else that shows
  // (picks, values on other filters).
  const { firstLine, secondLine } = useMemo(() => {
    if (!pinPrimary) return { firstLine: [], secondLine: [] };
    const first = autoInactive ? primaryKeys.filter(k => autoInactive.has(k)) : primaryKeys;
    const firstSet = new Set(first);
    return { firstLine: first, secondLine: orderKeys([...activeKeys, ...picks]).filter(k => !firstSet.has(k)) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinPrimary, autoInactive, primaryKeys, activeKeys, picks]);

  const visibleKeys = useMemo(() => {
    if (pinPrimary) return [...firstLine, ...secondLine];
    if (visibleKeysProp !== undefined) {
      return orderKeys([...visibleKeysProp, ...activeKeys]);
    }
    if (autoFit) {
      if (customized) return orderKeys([...customVisible, ...activeKeys]);
      const shownInactive = autoInactive
        ? inactivePrimary.filter(k => autoInactive.has(k))
        : inactivePrimary;
      return orderKeys([...activeKeys, ...shownInactive]);
    }
    const base = customVisible ?? primaryKeys;
    return orderKeys([...base, ...activeKeys]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinPrimary, firstLine, secondLine, visibleKeysProp, customVisible, activeKeys, primaryKeys, autoFit, autoInactive, inactivePrimary]);

  // Spec mode: primaries already in the row that weren't picked from More
  // Filters (they fit, or a value put them there). More Filters leaves these
  // out; everything else is listed there.
  const inRow = useMemo(() => {
    if (!pinPrimary) return new Set();
    const primarySet = new Set(primaryKeys);
    const pickSet = new Set(picks);
    return new Set(visibleKeys.filter(k => primarySet.has(k) && !pickSet.has(k)));
  }, [pinPrimary, primaryKeys, visibleKeys, picks]);

  const clearValue = (k) => effectiveOnFilterChange(k, multiSelect ? [] : null);

  const toggleVisible = (k) => {
    if (pinPrimary) {
      if (inRow.has(k)) return;
      const shown = visibleKeys.includes(k);
      // Unchecking clears the filter's value, as on HCC.
      if (shown && activeKeySet.has(k)) clearValue(k);
      // Shown only because it had a value: clearing it is enough.
      if (shown && !picks.includes(k)) return;
      setCustomVisible(prev => {
        const next = new Set(prev ?? []);
        if (next.has(k)) next.delete(k); else next.add(k);
        return [...next];
      });
      return;
    }
    if (onToggleVisible) {
      // Pass the current computed visible set so callers can toggle *just this
      // key* against auto-fit's live selection: otherwise, when `visibleKeys`
      // is uncontrolled and auto-fit has narrowed the row to a subset, the
      // caller has no way to know which chips were shown and typically falls
      // back to the full primary list, which reveals every hidden chip at once.
      onToggleVisible(k, visibleKeys);
      return;
    }
    setCustomVisible(prev => {
      const base = prev
        ?? (autoFit
              ? [...activeKeys, ...(autoInactive
                    ? inactivePrimary.filter(x => autoInactive.has(x))
                    : inactivePrimary)]
              : primaryKeys);
      const next = new Set(base);
      if (next.has(k)) next.delete(k); else next.add(k);
      return [...next];
    });
  };

  const clearVisible = () => {
    // Spec mode: Clear Selection unchecks everything picked in More Filters
    // and clears those values.
    if (pinPrimary) {
      activeKeys.filter(k => !inRow.has(k)).forEach(clearValue);
      setCustomVisible([]);
      return;
    }
    if (onClearVisible) {
      onClearVisible();
      return;
    }
    setCustomVisible([]);
  };

  const openMore = () => {
    const rect = moreBtnRef.current?.getBoundingClientRect();
    if (rect) setMoreRect(rect);
  };

  const computedHasActive = multiSelect
    ? Object.values(effectiveFilters).some(v => Array.isArray(v) && v.length > 0)
    : Object.keys(effectiveFilters).length > 0;
  const hasActive = hasActiveProp !== undefined ? hasActiveProp : computedHasActive;
  const tailActions = useMemo(() => {
    const next = [];
    if (showMoreFilters) next.push('moreFilters');
    if (showSaveFilter) next.push(showInternalSaveDialog ? 'saveFilterDialog' : 'saveFilter');
    return next;
  }, [showMoreFilters, showSaveFilter, showInternalSaveDialog]);
  const leadingNode = leading ?? null;

  const renderOne = (k, mirror = false) => {
    if (renderChip) return renderChip(k, mirror);
    const fd = defByKey[k];
    if (!fd) return null;
    const opts = effectiveGetOptions(fd) || [];
    // `multi` on a def: that one filter picks several values (string options)
    // even when the bar is single-select.
    if (multiSelect || fd.multi) {
      return (
        <FilterChip
          label={fd.label}
          options={opts}
          selected={effectiveFilters[fd.key] || []}
          onChange={(vals) => effectiveOnFilterChange(fd.key, vals)}
        />
      );
    }
    return (
      <SingleSelectFilter
        label={fd.label}
        def={fd}
        options={opts}
        current={effectiveFilters[fd.key] || null}
        onSet={(val) => effectiveOnFilterChange(fd.key, val)}
        onClear={() => effectiveOnFilterChange(fd.key, null)}
      />
    );
  };

  // More Filters | Clear All | Save Filter: always after the last chip.
  const tailNode = (
    <FilterBarTail
      tailRef={setTailRef}
      moreBtnRef={moreBtnRef}
      actions={tailActions}
      moreRect={moreRect}
      onOpenMore={openMore}
      onCloseMore={() => setMoreRect(null)}
      hasActive={hasActive}
      onClearAll={() => effectiveOnClearAll()}
      onSaveFilter={() => effectiveOnSaveFilter()}
      onOpenSaveDialog={() => setSaveDialogOpen(true)}
      clearAllLabel={clearAllLabel}
      clearAllIcon={variant === 'inline'}
      saveLabel={saveLabel}
      saveMenuItems={saveMenuItems}
      onSaveMenuSelect={(key) => (key === 'new' && showInternalSaveDialog ? setSaveDialogOpen(true) : onSaveMenuSelect?.(key))}
    />
  );

  if (collapsed) {
    if (!hasActive || activeKeys.length === 0) return null;
    return (
      <div className={[styles.filterBar, variant === 'inline' ? styles.inline : ''].filter(Boolean).join(' ')}>
        <div className={styles.filterRow}>
          {orderKeys(activeKeys).map(k => (
            <span key={k}>{renderOne(k, false)}</span>
          ))}
          <FilterBarTail
            actions={[]}
            hasActive
            onClearAll={() => effectiveOnClearAll()}
            clearAllLabel={clearAllLabel}
            clearAllIcon={variant === 'inline'}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={[styles.filterBar, variant === 'inline' ? styles.inline : ''].filter(Boolean).join(' ')}>
      <div className={styles.filterRow} ref={setChipsRef}>
        {leadingNode && <span ref={leadingRef} className={styles.leading}>{leadingNode}</span>}
        {visibleKeys.map(k => (
          <span key={k}>{renderOne(k, false)}</span>
        ))}
        {tailNode}
      </div>

      {fitToRow && (
        <div className={styles.measure} ref={measureRef} aria-hidden="true">
          {[...new Set([...primaryKeys, ...activeKeys, ...picks])].map((k) => (
            <span key={k} data-mk={k} aria-hidden="true" style={{ display: 'inline-flex' }}>
              {renderOne(k, true)}
            </span>
          ))}
        </div>
      )}

      {mirrorContent}

      {moreRect && (
        <MoreFiltersPopover
          anchorRect={moreRect}
          visibleKeys={visibleKeys}
          moreFilterItems={effectiveMoreItems}
          grouped={pinPrimary}
          groupOrder={groupOrder}
          hiddenKeys={inRow}
          onToggle={toggleVisible}
          onClear={clearVisible}
          onClose={() => setMoreRect(null)}
        />
      )}

      {showInternalSaveDialog && (
        <FilterNameDialog
          open={saveDialogOpen}
          title={saveDialogTitle}
          submitLabel="Save & Apply"
          initialName=""
          onSubmit={(name) => { effectiveOnSaveFilter(name); setSaveDialogOpen(false); }}
          onCancel={() => setSaveDialogOpen(false)}
        />
      )}
    </div>
  );
}
