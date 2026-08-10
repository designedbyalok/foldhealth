import { useMemo, useRef, useState, useLayoutEffect } from 'react';
import { Icon } from '../Icon/Icon';
import { DownChevronIcon } from '../Icon/DownChevronIcon';
import { FilterChip } from '../FilterChip/FilterChip';
import { useAppStore } from '../../store/useAppStore';
import { FilterNameDialog } from '../../features/hcc/FilterNameDialog';
import { MoreFiltersPopover } from '../../features/hcc/MoreFiltersPopover';
import styles from './FilterBar.module.css';

// `primary: true` chips render by default; `primary: false` chips are hidden
// until the user opts them in via the More Filters popover. Mirrors HCC's
// PRIMARY_FILTER_KEYS split.
const FILTER_DEFS = [
  { key: 'gender', label: 'Gender', primary: true, options: [
    { value: 'M', label: 'Male' },
    { value: 'F', label: 'Female' },
    { value: 'O', label: 'Other' },
  ]},
  { key: 'language', label: 'Language', primary: true, options: [
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Spanish' },
    { value: 'zh', label: 'Chinese' },
    { value: 'yue', label: 'Cantonese' },
    { value: 'ko', label: 'Korean' },
    { value: 'vi', label: 'Vietnamese' },
  ]},
  { key: 'lace', label: 'LACE Acuity', primary: true, options: [
    { value: 'High', label: 'High' },
    { value: 'Medium', label: 'Medium' },
    { value: 'Low', label: 'Low' },
  ]},
  { key: 'tocStatus', label: 'TOC Status', primary: true, options: [
    { value: 'enrolled', label: 'Enrolled' },
    { value: 'engaged', label: 'Engaged' },
    { value: 'attempted', label: 'Attempted' },
    { value: 'new', label: 'New' },
  ]},
  { key: 'status', label: 'Status', primary: true, options: [
    { value: 'completed', label: 'Completed' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'oncall', label: 'On Call' },
    { value: 'queued', label: 'Queued' },
    { value: 'failed', label: 'Failed' },
  ]},
  { key: 'assignee', label: 'Assigned to', primary: true, optionsFromData: true },
  { key: 'outreachType', label: 'Outreach Window', primary: true, options: [
    { value: '48h', label: 'TOC 48h' },
    { value: '7d', label: 'TOC 7d' },
  ]},
  { key: 'tocType', label: 'Trigger Type', primary: false, options: [
    { value: 'IP', label: 'IP (Inpatient)' },
    { value: 'ED', label: 'ED (Emergency)' },
  ]},
  { key: 'readmission', label: 'Readmission', primary: false, options: [
    { value: 'Yes', label: 'Yes' },
    { value: 'No', label: 'No' },
  ]},
  { key: 'carePlanStatus', label: 'Care Plan', primary: false, options: [
    { value: 'updated', label: 'Updated' },
    { value: 'pending', label: 'Pending' },
    { value: 'none', label: 'No Care Plan' },
  ]},
  { key: 'priority', label: 'Priority', primary: false, options: [
    { value: '1', label: 'Critical' },
    { value: '2', label: 'High' },
    { value: '3', label: 'Medium' },
    { value: '4', label: 'Low' },
  ]},
  { key: 'outreachCategory', label: 'Outreach Category', primary: false, options: [
    { value: 'post-visit', label: 'Post-Visit' },
    { value: 'appointment', label: 'Appointment' },
    { value: 'refill', label: 'Refill' },
    { value: 'care-gap', label: 'Care Gap' },
    { value: 'waitlist', label: 'Waitlist' },
  ]},
  { key: 'agentAssigned', label: 'Agent', primary: false, optionsFromData: true },
];

// Resolve a filter def's options — either static, or derived from the live
// patient rows (optionsFromData). Kept here so the shared FilterChip stays
// data-agnostic.
function resolveOptions(filterDef, patients) {
  if (filterDef.optionsFromData) {
    const unique = [...new Set((patients || []).flatMap(p => { const v = p[filterDef.key]; return v ? [v] : []; }))];
    return unique.sort().map(a => ({ value: a, label: a }));
  }
  return filterDef.options || [];
}

// Merge multiple refs (callback or object) onto a single node.
function mergeRefs(...refs) {
  return (node) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === 'function') ref(node);
      else ref.current = node;
    }
  };
}

// The shared FilterChip is multi-select and takes plain-string options +
// `selected: string[]` + `onChange(string[])`. TOC's filters are stored
// as a single value per key (activeFilters[key] = value). This adapter
// bridges the two: it renders labels in the popover, converts the current
// value → single-element `selected`, and on change picks the last value
// to write back. Passing `null` clears the filter.
function SingleSelectFilter({ label, def, options, current, onSet, onClear }) {
  const valueByLabel = new Map(options.map(o => [o.label, o.value]));
  const labelByValue = new Map(options.map(o => [o.value, o.label]));
  const stringOptions = options.map(o => o.label);
  const selected = current != null && labelByValue.has(current)
    ? [labelByValue.get(current)]
    : [];
  const handleChange = (nextLabels) => {
    if (!nextLabels || nextLabels.length === 0) {
      onClear();
      return;
    }
    // Single-select semantics — keep only the most-recently added label.
    const pick = nextLabels.find(l => !selected.includes(l)) || nextLabels[nextLabels.length - 1];
    const nextValue = valueByLabel.get(pick);
    if (nextValue == null) return;
    onSet(nextValue);
  };
  return (
    <FilterChip
      label={label}
      options={stringOptions}
      selected={selected}
      onChange={handleChange}
      searchable={!!def.optionsFromData || !!def.searchable}
    />
  );
}

// Default (TOC) viewBy toggle — rendered when no `leading` prop is passed.
// Reads viewBy/setViewBy directly from the store.
function DefaultViewByToggle() {
  const viewBy = useAppStore(s => s.viewBy);
  const setViewBy = useAppStore(s => s.setViewBy);
  return (
    <div className={styles.viewByToggle}>
      <button
        className={[styles.viewByBtn, viewBy === 'window' ? styles.active : ''].filter(Boolean).join(' ')}
        onClick={() => setViewBy('window')}
      >
        <Icon name="solar:sort-from-top-to-bottom-bold" size={14} />
        Outreach Window
      </button>
      <button
        className={[styles.viewByBtn, viewBy === 'status' ? styles.active : ''].filter(Boolean).join(' ')}
        onClick={() => setViewBy('status')}
      >
        <Icon name="solar:list-down-bold" size={14} />
        Outreach Status
      </button>
    </div>
  );
}

/**
 * Shared filter bar. Prop-driven, with TOC defaults so a bare `<FilterBar />`
 * keeps its historic behavior for AppLayout.
 *
 * When `autoFit={true}` is passed, FilterBar owns width measurement and
 * overflow: it renders a hidden mirror of every primary chip via `renderChip`
 * and packs inactive primary chips into one row after the always-shown
 * active chips (identical to HCC's original in-caller logic). Callers just
 * provide `filterDefs` (or explicit `primaryKeys`), `filters`, and
 * `renderChip(key, mirror)`.
 *
 * @param {object}  [props]
 * @param {Array}   [props.filterDefs]     – `[{ key, label, primary, options?, optionsFromData? }]`
 * @param {object}  [props.filters]        – current values keyed by filter key (string[] in multi, value|null in single)
 * @param {(key, next) => void} [props.onFilterChange]
 * @param {() => void}          [props.onClearAll]
 * @param {(name: string) => void} [props.onSaveFilter]
 * @param {(def) => Array}      [props.getOptions] – returns string[] (multi) or {value,label}[] (single)
 * @param {boolean} [props.multiSelect=false]
 * @param {string[]}[props.visibleKeys]   – controlled visible-keys
 * @param {(key: string) => void} [props.onToggleVisible]
 * @param {() => void}          [props.onClearVisible]
 * @param {Array}   [props.moreFilterItems]
 * @param {React.ReactNode} [props.leading] – node before the chips (`null` renders nothing)
 * @param {string}  [props.saveDialogTitle='Save Filter']
 * @param {boolean} [props.autoFit=false] – pack chips onto one row; overflow → More Filters
 * @param {string[]}[props.primaryKeys]   – override primary-key derivation (autoFit only)
 */
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
  // Slot props — a caller can render its own chip variants (multi/radio/date/
  // range) via `renderChip(k, mirror)`. `renderChip` must return JUST the chip
  // — FilterBar handles keying and the width-measurement wrapper.
  renderChip,
  chipsRef,
  tailRef,
  mirrorContent,
  hasActive: hasActiveProp,
  // When false, the "Save Filter" button fires `onSaveFilter()` with no args
  // (caller owns its own dialog) instead of opening the internal
  // FilterNameDialog.
  showInternalSaveDialog = true,
  // Hide individual tail-cluster elements when a worklist doesn't need them.
  showMoreFilters = true,
  showSaveFilter = true,
  // Auto-fit mode — pack chips onto one row, overflow into More Filters.
  autoFit = false,
  primaryKeys: primaryKeysProp,
} = {}) {
  // Always call every store hook unconditionally — they only get used when
  // the caller didn't supply the corresponding prop. Keeps hook order stable.
  const storeActiveFilters = useAppStore(s => s.activeFilters);
  const storeSetFilter = useAppStore(s => s.setFilter);
  const storeClearAllFilters = useAppStore(s => s.clearAllFilters);
  const storePatients = useAppStore(s => s.patients);
  const storeActiveSubnavList = useAppStore(s => s.activeSubnavList);
  const storeSaveSavedFilter = useAppStore(s => s.saveSavedFilter);

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  // Uncontrolled visible-keys state — only used when `visibleKeys` prop is
  // absent. `null` = default (auto-fit or full-primary depending on mode).
  const [customVisible, setCustomVisible] = useState(null);

  const moreBtnRef = useRef(null);
  const [moreRect, setMoreRect] = useState(null);

  // Internal refs for auto-fit measurement. Merged with any caller-passed
  // chipsRef/tailRef so external observers still work.
  const internalChipsRef = useRef(null);
  const internalTailRef = useRef(null);
  const measureRef = useRef(null);
  const setChipsRef = mergeRefs(internalChipsRef, chipsRef);
  const setTailRef = mergeRefs(internalTailRef, tailRef);

  // Resolve defaults for anything the caller didn't supply.
  const effectiveDefs = filterDefs ?? FILTER_DEFS;
  const effectiveFilters = filters ?? storeActiveFilters;
  const effectiveGetOptions = getOptions
    ?? ((def) => resolveOptions(def, storePatients));
  const listForSave = storeActiveSubnavList || 'TOC';
  const effectiveOnFilterChange = onFilterChange
    ?? ((key, next) => storeSetFilter(key, next));
  const effectiveOnClearAll = onClearAll ?? storeClearAllFilters;
  const effectiveOnSaveFilter = onSaveFilter
    ?? ((name) => storeSaveSavedFilter(listForSave, name));

  const effectiveMoreItems = moreFilterItems
    ?? effectiveDefs.map(fd => ({ k: fd.key, label: fd.label, primary: fd.primary }));

  const keyOrder = useMemo(
    () => Object.fromEntries(effectiveDefs.map((fd, i) => [fd.key, i])),
    [effectiveDefs],
  );
  const defByKey = useMemo(
    () => Object.fromEntries(effectiveDefs.map(fd => [fd.key, fd])),
    [effectiveDefs],
  );
  const primaryKeys = useMemo(
    () => primaryKeysProp ?? effectiveDefs.filter(fd => fd.primary).map(fd => fd.key),
    [effectiveDefs, primaryKeysProp],
  );

  // Any chip that has a value must remain visible even if it's not in the
  // primary set — otherwise applying a saved filter could hide its own chip.
  const activeKeys = useMemo(() => {
    if (multiSelect) {
      return Object.keys(effectiveFilters).filter(k => (effectiveFilters[k] || []).length > 0);
    }
    return Object.keys(effectiveFilters).filter(k => effectiveFilters[k] != null);
  }, [effectiveFilters, multiSelect]);

  const orderKeys = (keys) => [...new Set(keys)].sort(
    (a, b) => (keyOrder[a] ?? 99) - (keyOrder[b] ?? 99),
  );

  // Auto-fit measurement — which inactive primary chips fit on one row.
  const [autoInactive, setAutoInactive] = useState(null);
  const customized = customVisible !== null;
  const inactivePrimary = useMemo(
    () => primaryKeys.filter(k => !activeKeys.includes(k)),
    [primaryKeys, activeKeys],
  );

  useLayoutEffect(() => {
    if (!autoFit) { setAutoInactive(null); return undefined; }
    if (visibleKeysProp !== undefined || customized) {
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
      activeKeys.forEach(k => { budget -= widthOf(k) + GAP; });
      const fit = new Set();
      for (const k of inactivePrimary) {
        const w = widthOf(k) + GAP;
        if (budget - w >= 0) { budget -= w; fit.add(k); } else break;
      }
      setAutoInactive(fit);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(container);
    return () => ro.disconnect();
  }, [autoFit, visibleKeysProp, customized, activeKeys, inactivePrimary]);

  const visibleKeys = useMemo(() => {
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
  }, [visibleKeysProp, customVisible, activeKeys, primaryKeys, autoFit, autoInactive, inactivePrimary]);

  const toggleVisible = (k) => {
    if (onToggleVisible) {
      onToggleVisible(k);
      return;
    }
    setCustomVisible(prev => {
      // When auto-fit is on and we're not yet customized, seed with what's
      // currently visible so the first toggle keeps the row stable.
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
  const closeMore = () => setMoreRect(null);

  // Uniform "has active" — matches TOC's existing `Object.keys(activeFilters).length`
  // semantics on the single-select side, and the multi-select array-length
  // check on the multi side.
  const computedHasActive = multiSelect
    ? Object.values(effectiveFilters).some(v => Array.isArray(v) && v.length > 0)
    : Object.keys(effectiveFilters).length > 0;
  const hasActive = hasActiveProp !== undefined ? hasActiveProp : computedHasActive;

  // `leading === undefined` → default TOC viewBy toggle.
  // Anything else (including `null`) → render that value.
  const leadingNode = leading === undefined ? <DefaultViewByToggle /> : leading;

  // Render a chip using the caller's `renderChip(k, mirror)` if provided,
  // otherwise fall back to the built-in single/multi select adapters.
  const renderOne = (k, mirror = false) => {
    if (renderChip) return renderChip(k, mirror);
    const fd = defByKey[k];
    if (!fd) return null;
    const opts = effectiveGetOptions(fd) || [];
    if (multiSelect) {
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

  return (
    <div className={styles.filterBar}>
      {/* Row 1: leading node + all filter chips + More/Clear/Save tail cluster */}
      <div className={styles.filterRow} ref={setChipsRef}>
        {leadingNode}

        {visibleKeys.map(k => (
          <span key={k}>{renderOne(k, false)}</span>
        ))}

        {/* Tail cluster — More Filters + Clear All + Save Filter grouped as
            one inline-flex unit immediately after the last chip. */}
        <div className={styles.tail} ref={setTailRef}>
          {showMoreFilters && (
            <button
              ref={moreBtnRef}
              type="button"
              className={[styles.moreBtn, moreRect ? styles.moreBtnActive : ''].join(' ')}
              onClick={moreRect ? closeMore : openMore}
            >
              More Filters
              <DownChevronIcon color={moreRect ? 'var(--primary-300)' : 'var(--neutral-300)'} />
            </button>
          )}

          {hasActive && (
            <>
              {showMoreFilters && <span className={styles.vDivider} />}
              <button className={styles.clearAll} onClick={() => effectiveOnClearAll()}>
                Clear All
              </button>
              {showSaveFilter && (
                <>
                  <span className={styles.vDivider} />
                  <button
                    className={styles.saveFilter}
                    onClick={() => {
                      if (showInternalSaveDialog) setSaveDialogOpen(true);
                      else effectiveOnSaveFilter();
                    }}
                  >
                    Save Filter
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Hidden width mirror for auto-fit — measures every primary chip so
          the greedy packer above knows how many fit. Uses `renderOne` so
          callers can rely on the built-in filterDefs path (AWV) OR override
          per-chip via `renderChip` (HCC/HEDIS/CCM). */}
      {autoFit && (
        <div className={styles.measure} ref={measureRef} aria-hidden="true">
          {primaryKeys.map((k) => (
            <span
              key={k}
              data-mk={k}
              aria-hidden="true"
              style={{ display: 'inline-flex' }}
            >
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
          onToggle={toggleVisible}
          onClear={clearVisible}
          onClose={closeMore}
        />
      )}

      {showInternalSaveDialog && <FilterNameDialog
        open={saveDialogOpen}
        title={saveDialogTitle}
        submitLabel="Save & Apply"
        initialName=""
        onSubmit={(name) => { effectiveOnSaveFilter(name); setSaveDialogOpen(false); }}
        onCancel={() => setSaveDialogOpen(false)}
      />}
    </div>
  );
}
