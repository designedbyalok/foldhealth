import { useEffect, useMemo } from 'react';
import { FilterChip } from '../../components/FilterChip/FilterChip';
import { FilterBar } from '../worklists/FilterBar';
import { RangeSliderPopover } from '../../components/RangeSliderPopover/RangeSliderPopover';
import { DateRangePopover } from '../../components/DateRangePopover/DateRangePopover';
import { dobRangeSummary } from '../../components/DateRangePopover/yearSpan';
import { useSavedFilterActions } from './useSavedFilterActions';
import { useAppStore } from '../../store/useAppStore';
import {
  FILTER_DEF_MAP as HCC_FILTER_DEF_MAP,
  MORE_FILTER_ITEMS as HCC_MORE_FILTER_ITEMS,
  PRIMARY_FILTER_KEYS as HCC_PRIMARY_FILTER_KEYS,
} from './filters';

/**
 * Wrap a state mutation in document.startViewTransition when the browser
 * supports it, so the HCC worklist tbody crossfades between filter sets
 * (paired with the view-transition-name in HccWorklistRow.module.css).
 * Falls back to a direct call when the API is unavailable (Firefox pre-129,
 * Safari pre-18): filter still applies, just without the crossfade.
 *
 * Rapid filter changes abort in-flight transitions; the API surfaces that
 * as InvalidStateError on the ready/finished promises. We swallow those
 * rejections so an intentional abort doesn't spam the console.
 */
function withViewTransition(fn) {
  if (typeof document !== 'undefined' && document.startViewTransition) {
    const t = document.startViewTransition(fn);
    t.ready?.catch(() => {});
    t.finished?.catch(() => {});
  } else {
    fn();
  }
}

/**
 * HCC/HEDIS filter chip row. Delegates its visual shell, one-line auto-fit,
 * More Filters trigger, tail cluster, and hidden width mirror to the shared
 * <FilterBar autoFit />; keeps its own per-chip type dispatch (multi / radio /
 * date / range) via the `renderChip` slot.
 */
const STORE_SELECTORS_BY_LIST = {
  HCC: {
    filters:       'hccFilters',
    setFilter:     'setHccFilter',
    clearFilters:  'clearHccFilters',
    visibleKeys:   'hccVisibleFilterKeys',
    setVisible:    'setHccVisibleFilterKeys',
    clearVisible:  'clearHccVisibleFilters',
  },
  HEDIS: {
    filters:       'hedisFilters',
    setFilter:     'setHedisFilter',
    clearFilters:  'clearHedisFilters',
    visibleKeys:   'hedisVisibleFilterKeys',
    setVisible:    'setHedisVisibleFilterKeys',
    clearVisible:  'clearHedisVisibleFilters',
  },
  Pharmacy: {
    filters:       'pharmacyFilters',
    setFilter:     'setPharmacyFilter',
    clearFilters:  'clearPharmacyFilters',
    visibleKeys:   'pharmacyVisibleFilterKeys',
    setVisible:    'setPharmacyVisibleFilterKeys',
    clearVisible:  'clearPharmacyVisibleFilters',
  },
};

export function FilterChipBar({
  list = 'HCC',
  filterDefMap = HCC_FILTER_DEF_MAP,
  moreFilterItems = HCC_MORE_FILTER_ITEMS,
  primaryFilterKeys = HCC_PRIMARY_FILTER_KEYS,
  dynamicOpts: dynamicOptsProp,
  onSaveFilter,
  collapsed = false,
}) {
  const sel = STORE_SELECTORS_BY_LIST[list] || STORE_SELECTORS_BY_LIST.HCC;

  const filters             = useAppStore(s => s[sel.filters]);
  const setFilter           = useAppStore(s => s[sel.setFilter]);
  const clearFilters        = useAppStore(s => s[sel.clearFilters]);
  const storedVisible       = useAppStore(s => s[sel.visibleKeys]);
  const setVisibleFilterKeys= useAppStore(s => s[sel.setVisible]);
  const clearVisibleFilters = useAppStore(s => s[sel.clearVisible]);
  // A selected saved filter stays selected while edited: Go Back / Update it.
  const savedActions = useSavedFilterActions(list, filters, clearFilters, onSaveFilter);

  const showToast = useAppStore(s => s.showToast);
  const hccMembers = useAppStore(s => s.hccMembers);
  const platformUsers = useAppStore(s => s.platformUsers);
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  useEffect(() => { fetchPlatformUsers(); }, [fetchPlatformUsers]);

  const hccDynamicOpts = useMemo(() => {
    const vt = new Set();
    const rp = new Set();
    const pcp = new Set();
    const ipa = new Set();
    const hp = new Set();
    const city = new Set();
    const state = new Set();
    const tin = new Set();
    for (const m of hccMembers) {
      const v = m.visitType || m.vt;
      if (v) vt.add(v);
      if (m.rp) rp.add(m.rp);
      if (m.pcp) pcp.add(m.pcp);
      if (m.ipa) ipa.add(m.ipa);
      if (m.hp) hp.add(m.hp);
      if (m.city) city.add(m.city);
      if (m.state) state.add(m.state);
      if (m.tin) tin.add(m.tin);
    }
    const supU = [];
    const cdrU = [];
    const r1u = [];
    const r2u = [];
    for (const u of platformUsers) {
      const roles = u.clinicalRoles;
      if (!roles) continue;
      if (roles.includes('Support')) supU.push(u.name);
      if (roles.includes('Coder')) cdrU.push(u.name);
      if (roles.includes('QA')) r1u.push(u.name);
      if (roles.includes('Compliance')) r2u.push(u.name);
    }
    return {
      vt:   [...vt].toSorted().concat('No Visit Type'),
      asgn: platformUsers.map(u => u.name),
      supU,
      cdrU,
      r1u,
      r2u,
      rp:    [...rp].toSorted(),
      pcp:   [...pcp].toSorted(),
      ipa:   [...ipa].toSorted(),
      hp:    [...hp].toSorted(),
      city:  [...city].toSorted(),
      state: [...state].toSorted(),
      tin:   [...tin].toSorted(),
    };
  }, [hccMembers, platformUsers]);
  const dynamicOpts = dynamicOptsProp || (list === 'HCC' ? hccDynamicOpts : {});
  const optsFor = (def) => {
    const dynKey = def?.dynamic;
    if (dynKey && dynamicOpts[dynKey]?.length) return dynamicOpts[dynKey];
    return def?.opts || [];
  };

  // FilterDefs for the shared bar: moreFilterItems shape ({k,label}) plus a
  // `primary` flag driven by PRIMARY_FILTER_KEYS, and matching `key` prop.
  const primaryKeySet = useMemo(() => new Set(primaryFilterKeys), [primaryFilterKeys]);

  const filterDefs = useMemo(
    () => moreFilterItems.map(item => ({
      key: item.k,
      label: item.label,
      primary: primaryKeySet.has(item.k),
    })),
    [moreFilterItems, primaryKeySet],
  );

  const activeKeys = useMemo(() => {
    const keys = [];
    for (const x of moreFilterItems) {
      if ((filters[x.k] || []).length > 0) keys.push(x.k);
    }
    return keys;
  }, [filters, moreFilterItems]);

  // Toggle a chip's visibility from the More Filters popover. Base priority:
  //   1. The user's persisted custom set (they've customized before).
  //   2. Whatever FilterBar is *currently* showing after auto-fit narrowed
  //      the row (passed in as `currentVisible`): so toggling one chip on
  //      only reveals that chip, not every hidden primary at once.
  //   3. Primary set (very first open, before auto-fit measured anything).
  const toggleVisible = (k, currentVisible) => {
    const base = storedVisible ?? currentVisible ?? primaryFilterKeys;
    const next = new Set(base);
    if (next.has(k)) next.delete(k); else next.add(k);
    setVisibleFilterKeys([...next]);
  };

  const KEY_ORDER = useMemo(
    () => Object.fromEntries(moreFilterItems.map((x, i) => [x.k, i])),
    [moreFilterItems],
  );
  const orderKeys = (keys) => [...new Set(keys)]
    .sort((a, b) => (KEY_ORDER[a] ?? 99) - (KEY_ORDER[b] ?? 99));

  // Only pass `visibleKeys` when the user has customized the set; when null,
  // FilterBar's auto-fit picks the visible chips from the primary set.
  const controlledVisibleKeys = storedVisible != null
    ? orderKeys([...storedVisible, ...activeKeys])
    : undefined;

  const renderChip = (k /* , mirror */) => {
    const item = moreFilterItems.find(x => x.k === k);
    if (!item) return null;
    const def = filterDefMap[k];
    const vals = filters[k] || [];
    const active = vals.length > 0;
    const summary = active ? summarize(k, vals, def) : undefined;
    const setVals = list === 'HCC'
      ? (next) => withViewTransition(() => setFilter(k, next))
      : (next) => setFilter(k, next);

    if (!def || !['multi', 'radio', 'range', 'date'].includes(def?.type)) {
      return (
        <FilterChip
          label={item.label}
          active={false}
          renderPopover={({ onClose }) => {
            showToast(
              def ? `Filter "${item.label}" popover: not yet wired`
                  : `Filter "${item.label}", coming soon`
            );
            onClose();
            return null;
          }}
        />
      );
    }
    if (def.type === 'multi') {
      return (
        <FilterChip
          label={item.label}
          popoverLabel={def.popoverLabel}
          options={optsFor(def)}
          selected={vals}
          onChange={setVals}
          searchable={def.searchable}
          activeSummary={summary}
        />
      );
    }
    if (def.type === 'radio') {
      return (
        <FilterChip
          label={item.label}
          popoverLabel={def.popoverLabel}
          options={def.opts}
          selected={vals}
          onChange={setVals}
          singleSelect
          activeSummary={summary}
        />
      );
    }
    if (def.type === 'date') {
      return (
        <FilterChip
          label={item.label}
          active={active}
          activeSummary={summary}
          onClear={() => setVals([])}
          renderPopover={({ anchorRect, onClose }) => (
            <DateRangePopover
              anchorRect={anchorRect}
              label={def.label}
              selected={vals}
              onChange={setVals}
              onClose={onClose}
              years={def.years}
            />
          )}
        />
      );
    }
    // range
    const lo = def.opts[0];
    const hi = def.opts[def.opts.length - 1];
    const initMin = vals.length >= 2 ? parseInt(vals[0], 10) : parseInt(lo, 10);
    const initMax = vals.length >= 2 ? parseInt(vals[1], 10) : parseInt(hi, 10);
    return (
      <FilterChip
        label={item.label}
        active={active}
        activeSummary={summary}
        onClear={() => setVals([])}
        renderPopover={({ anchorRect, onClose }) => (
          <RangeSliderPopover
            anchorRect={anchorRect}
            label={def.label}
            min={parseInt(lo, 10)}
            max={parseInt(hi, 10)}
            step={1}
            initialMin={initMin}
            initialMax={initMax}
            onApply={(mn, mx) => { setVals([String(mn), String(mx)]); onClose(); }}
            onClose={onClose}
          />
        )}
      />
    );
  };

  return (
    <FilterBar
      collapsed={collapsed}
      autoFit
      // HCC and HEDIS follow the filter spec: primaries always show; More
      // Filters lists the secondary filters by domain.
      pinPrimary
      leading={null}
      filterDefs={filterDefs}
      primaryKeys={primaryFilterKeys}
      filters={filters}
      onFilterChange={list === 'HCC'
        ? (k, next) => withViewTransition(() => setFilter(k, next))
        : (k, next) => setFilter(k, next)}
      onClearAll={list === 'HCC'
        ? () => withViewTransition(() => savedActions.onClearAll())
        : savedActions.onClearAll}
      clearAllLabel={savedActions.clearAllLabel}
      saveLabel={savedActions.saveLabel}
      saveMenuItems={savedActions.saveMenuItems}
      onSaveMenuSelect={savedActions.onSaveMenuSelect}
      onSaveFilter={onSaveFilter}
      multiSelect
      visibleKeys={controlledVisibleKeys}
      onToggleVisible={toggleVisible}
      onClearVisible={clearVisibleFilters}
      moreFilterItems={moreFilterItems}
      hasActive={activeKeys.length > 0 || savedActions.edited}
      showInternalSaveDialog={false}
      renderChip={renderChip}
    />
  );
}

function summarize(k, vals, def) {
  if ((k === 'dec' || def?.type === 'range') && vals.length >= 2) return `${vals[0]}–${vals[1]}`;
  // DOB: a year pick reads "1950 – 1960" (or "1950"); a custom range keeps the year.
  if (k === 'dob' && vals.length >= 2) return dobRangeSummary(vals);
  if ((['cd', 'dos', 'dob', 'lvd', 'lastOutreachDate'].includes(k) || def?.type === 'date') && vals.length >= 2) {
    return `${formatShortDate(vals[0])} – ${formatShortDate(vals[1])}`;
  }
  if (vals.length > 2) return `${vals[0]} +${vals.length - 1}`;
  return vals.join(', ');
}

function formatShortDate(iso) {
  const [, m, d] = (iso || '').split('-');
  return m && d ? `${m}/${d}` : iso;
}
