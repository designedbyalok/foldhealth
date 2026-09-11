import { useEffect, useId, useLayoutEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../Icon/Icon';
import { Checkbox } from '../ShadcnCheckbox/ShadcnCheckbox';
import { Badge } from '../Badge/Badge';
import { Tooltip } from '../Tooltip/Tooltip';
import { DownChevronIcon } from '../Icon/DownChevronIcon';
import { CloseIcon } from '../Icon/CloseIcon';
import styles from './Select.module.css';

/**
 * Fold Health Select — controlled single-select dropdown that matches
 * <Input>'s design tokens (height 32, border, radius, focus ring). Used in
 * builders that need a styled dropdown without pulling in shadcn/radix.
 *
 * Props:
 *  - options    [{ value: string, label: string, disabled?: boolean }]
 *  - value      (string)
 *  - onChange   (value) => void
 *  - placeholder (string)
 *  - disabled   (boolean)
 *  - variant    'default' | 'error' | 'ghost' (borderless, hover-only bg)
 *  - className  (string)
 *  - style      (object)        — inline style on the outer wrap (e.g. widths)
 *  - id         (string)        — passes through to the trigger button
 *  - menuAlign  'left' | 'right' — popover horizontal anchor (defaults left)
 *  - leadingIcon (string)       — optional Solar icon shown before the label
 *  - portal     (boolean)       — render the menu into document.body with
 *                                 fixed positioning. Needed when the Select
 *                                 sits inside a scroll container (e.g. a
 *                                 horizontally-scrolling table), which would
 *                                 otherwise clip the absolutely-positioned
 *                                 menu. Off by default.
 */
export function Select({
  options = [],
  value,
  onChange,
  placeholder = 'Select…',
  disabled = false,
  variant = 'default',
  className,
  wrapperClassName,
  style,
  id,
  menuAlign = 'left',
  searchable = false,
  searchPlaceholder = 'Search…',
  // External search control — when both are provided, the caller owns the
  // query string and Select stops filtering `options` client-side (it just
  // renders whatever the caller passes in). Used for async remote search
  // (e.g. WHO ICD-11 API in the HCC drawer).
  query: queryProp,
  onQueryChange,
  searchLoading = false,
  emptyText,
  leadingIcon,
  // Field-wrapper props — parity with `src/components/Input`. Any one of
  // these promotes the render from a bare trigger to a labelled field
  // (label + required dot + optional info icon on top, trigger in the
  // middle, helper/error text at the bottom). Callers that just want the
  // pill can keep passing nothing extra.
  label,
  required = false,
  showInfo = false,
  infoText,
  helperText,
  errorText,
  // Multi-select mode. When true, `value` is an array of strings and
  // clicking an option toggles it in place — the menu stays open. The
  // trigger label collapses to a count summary once more than one item
  // is picked. Header items (type: 'header') stay non-interactive; an
  // option with `singleAction: true` (e.g. "+ Custom Date") still fires
  // onChange with its own value and closes the menu (used to break out
  // of multi-select into a one-off action).
  multiple = false,
  // Render a Checkbox in each row instead of the trailing check mark. Opt-in
  // so existing multi-selects keep their current look.
  checkboxes = false,
  // Show each multi-select pick as a grey Badge in the trigger instead of the
  // "first + N" text summary. Opt-in for the same reason.
  badges = false,
  portal = false,
}) {
  // Ensure a stable label↔trigger association even when `id` isn't set.
  const autoId = useId();
  const triggerId = id || (label ? autoId : undefined);
  const isError = variant === 'error' || Boolean(errorText);
  const valueArray = multiple ? (Array.isArray(value) ? value : []) : null;
  const valueSet = useMemo(
    () => (multiple ? new Set(Array.isArray(value) ? value : []) : null),
    [multiple, value],
  );
  const isSelected = (v) => multiple ? valueSet.has(v) : v === value;
  const [open, setOpen] = useState(false);
  // 'bottom' by default; flipped to 'top' when the trigger sits too close
  // to the bottom of the viewport for the 240px menu to fit downward.
  const [menuPlacement, setMenuPlacement] = useState('bottom');
  const externalQuery = typeof queryProp === 'string' && typeof onQueryChange === 'function';
  const [internalQuery, setInternalQuery] = useState('');
  const query = externalQuery ? queryProp : internalQuery;
  const setQuery = externalQuery ? onQueryChange : setInternalQuery;
  const wrapRef = useRef(null);
  const menuRef = useRef(null);
  const searchRef = useRef(null);
  // Trigger geometry, captured on open, used to place a portaled menu.
  const [anchorRect, setAnchorRect] = useState(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      const inWrap = wrapRef.current?.contains(e.target);
      // A portaled menu is outside wrapRef, so check it separately or the
      // menu would close before the click landed on an option.
      const inMenu = menuRef.current?.contains(e.target);
      if (!inWrap && !inMenu) setOpen(false);
    };
    const keyHandler = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [open]);

  // Measure the trigger's position on every open — flip up when the
  // 240px menu wouldn't fit below and there IS enough room above.
  useEffect(() => {
    if (!open) return;
    const trigger = wrapRef.current?.querySelector('button');
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setAnchorRect({ top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width });
    const MENU_MAX = 260; // .menu max-height (240) + a little buffer
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    setMenuPlacement(spaceBelow < MENU_MAX && spaceAbove > spaceBelow ? 'top' : 'bottom');
  }, [open]);

  // Reset the query each time the menu closes; focus the search on open.
  useEffect(() => {
    if (open && searchable) searchRef.current?.focus();
    if (!open) setQuery('');
  }, [open, searchable]);

  // Portaled menus escape any clipping scroll container; inline ones keep
  // the original absolute-in-wrap behaviour.
  const renderMenu = (node) => (portal ? createPortal(node, document.body) : node);

  const selected = multiple ? null : options.find(o => o.value === value);
  // Map picks back to their options for the trigger. With remote search the
  // option list is replaced on every query, so a pick whose option is no
  // longer present falls back to its own value — otherwise the trigger would
  // blank out and read as "nothing selected".
  const selectedMulti = multiple
    ? valueArray.map(v =>
      options.find(o => o.type !== 'header' && o.value === v) || { value: v, label: v })
    : [];
  // Trigger label for multi mode — first pick's label + "+N" summary.
  const multiSummary = () => {
    if (selectedMulti.length === 0) return null;
    const first = selectedMulti[0];
    const firstLabel = first.triggerLabel ?? first.label;
    if (selectedMulti.length === 1) return firstLabel;
    return <><span>{firstLabel}</span> <span style={{ color: 'var(--neutral-300)' }}>+{selectedMulti.length - 1}</span></>;
  };
  const q = query.trim().toLowerCase();
  // Options may carry a `searchText` (plain string) so `label` can be a
  // rich node (e.g. two-line code + description) while search still matches
  // both. Falls back to the label when it's a string. With external search
  // control the caller filters the option list, so client-side filtering
  // is skipped entirely.
  const shownOptions = (searchable && q && !externalQuery)
    ? options.filter(o => (o.searchText != null ? o.searchText : String(o.label)).toLowerCase().includes(q))
    : options;

  const needsField = Boolean(label || helperText || errorText);

  // Badge trigger keeps every pick on one line: measure the full set in a
  // hidden row, then show as many as fit and collapse the rest into a "+N"
  // badge whose tooltip lists them.
  const selectedKey = selectedMulti.map(o => o.value).join('|');
  const badgeRowRef = useRef(null);
  const badgeMeasureRef = useRef(null);
  const [visibleBadgeCount, setVisibleBadgeCount] = useState(selectedMulti.length);

  useLayoutEffect(() => {
    if (!(multiple && badges)) return undefined;
    const row = badgeRowRef.current;
    const measure = badgeMeasureRef.current;
    if (!row || !measure) return undefined;

    const recompute = () => {
      const available = row.clientWidth;
      const widths = [...measure.children].map(c => c.offsetWidth);
      if (widths.length === 0) { setVisibleBadgeCount(0); return; }
      const GAP = 4;
      // Reserve room for the "+N" badge; it's the last measured child.
      const overflowWidth = widths[widths.length - 1] + GAP;
      let used = 0;
      let fit = 0;
      for (let i = 0; i < widths.length - 1; i += 1) {
        const next = used + widths[i] + (i > 0 ? GAP : 0);
        const needsOverflow = i < widths.length - 2;
        if (next + (needsOverflow ? overflowWidth : 0) > available) break;
        used = next;
        fit += 1;
      }
      setVisibleBadgeCount(fit);
    };

    const ro = new ResizeObserver(recompute);
    ro.observe(row);
    // rAF rather than a synchronous call — setting state in an effect body
    // cascades renders.
    const raf = requestAnimationFrame(recompute);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [multiple, badges, selectedKey]);

  const hiddenBadges = selectedMulti.slice(visibleBadgeCount);

  const trigger = (
    <div ref={wrapRef} className={[styles.wrap, needsField ? '' : (className || '')].filter(Boolean).join(' ')} style={style}>
      <button
        id={triggerId}
        type="button"
        className={[
          styles.trigger,
          variant === 'ghost' ? styles.triggerGhost : '',
          isError ? styles.triggerError : '',
          (multiple ? selectedMulti.length === 0 : !selected) ? styles.triggerPlaceholder : '',
        ].filter(Boolean).join(' ')}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={isError || undefined}
        onClick={() => !disabled && setOpen(o => !o)}
      >
        {leadingIcon && (
          <Icon name={leadingIcon} size={16} color="currentColor" />
        )}
        {multiple && badges && selectedMulti.length > 0 ? (
          <span ref={badgeRowRef} className={styles.triggerBadges}>
            {selectedMulti.slice(0, visibleBadgeCount).map(o => (
              <Badge
                key={o.value}
                tone="grey"
                size="S"
                label={o.triggerLabel ?? o.label}
                trailingIconElement={<CloseIcon size={12} color="currentColor" />}
                trailingIconLabel={`Remove ${o.triggerLabel ?? o.label}`}
                onTrailingIconClick={() => onChange(valueArray.filter(v => v !== o.value))}
              />
            ))}
            {hiddenBadges.length > 0 && (
              <Tooltip
                label={hiddenBadges.map(o => o.triggerLabel ?? o.label).join(', ')}
                maxWidth={280}
              >
                <Badge tone="grey" size="S" label={`+${hiddenBadges.length}`} />
              </Tooltip>
            )}
            {/* Hidden mirror of the full set (plus a worst-case "+N") used
                only for width measurement. */}
            <span ref={badgeMeasureRef} className={styles.triggerBadgesMeasure} aria-hidden="true">
              {selectedMulti.map(o => (
                <Badge
                  key={o.value}
                  tone="grey"
                  size="S"
                  label={o.triggerLabel ?? o.label}
                  trailingIconElement={<CloseIcon size={12} color="currentColor" />}
                />
              ))}
              <Badge tone="grey" size="S" label={`+${selectedMulti.length}`} />
            </span>
          </span>
        ) : (
          <span className={styles.triggerLabel} style={selected?.style}>
            {multiple
              ? (selectedMulti.length > 0 ? multiSummary() : placeholder)
              : (selected ? (selected.triggerLabel ?? selected.label) : placeholder)}
          </span>
        )}
        <DownChevronIcon
          size={14}
          color={disabled ? 'var(--neutral-150)' : 'var(--neutral-300)'}
          className={open ? styles.chevronOpen : styles.chevron}
        />
      </button>
      {open && renderMenu(
        <ul
          ref={menuRef}
          role="listbox"
          className={[
            styles.menu,
            portal ? styles.menuPortal : '',
            !portal && menuAlign === 'right' ? styles.menuRight : '',
            !portal && menuPlacement === 'top' ? styles.menuTop : '',
          ].filter(Boolean).join(' ')}
          // Radix Dialog / AlertDialog attach global wheel + touchmove
          // listeners on document with `{ passive: false }` that call
          // preventDefault() to block body scroll while a modal is open.
          // A portaled Select menu is a body sibling of the modal, so
          // those global listeners cancel its scroll wheel events too —
          // even though the menu has `overflow-y: auto`. Stopping
          // propagation at the menu's own wheel + touchmove handlers
          // keeps Radix's document-level listeners from firing, so the
          // menu scrolls normally when opened from inside a modal.
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          style={portal && anchorRect ? {
            width: anchorRect.width,
            left: menuAlign === 'right' ? undefined : anchorRect.left,
            right: menuAlign === 'right' ? window.innerWidth - anchorRect.right : undefined,
            ...(menuPlacement === 'top'
              ? { bottom: window.innerHeight - anchorRect.top + 4 }
              : { top: anchorRect.bottom + 4 }),
          } : undefined}
        >
          {searchable && (
            <li className={styles.searchRow}>
              <Icon name="solar:magnifer-linear" size={13} color="var(--neutral-300)" />
              <input
                ref={searchRef}
                type="text"
                className={styles.searchInput}
                placeholder={searchPlaceholder}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.stopPropagation()}
              />
            </li>
          )}
          {shownOptions.length === 0 && (
            <li className={styles.emptyOption} aria-disabled>
              {searchLoading ? 'Searching…' : (emptyText || 'No matches')}
            </li>
          )}
          {shownOptions.map((opt, i) => {
            // Non-interactive section header — used by callers that want to
            // group options under a label (e.g. cross-row DOSs by Created
            // date). Pass `{ type: 'header', label, value }` and any value
            // works so long as it's unique among options.
            if (opt.type === 'header') {
              return (
                <li
                  key={`h-${i}-${opt.value}`}
                  role="presentation"
                  className={styles.groupHeader}
                >
                  {opt.label}
                </li>
              );
            }
            const isActive = isSelected(opt.value);
            const isSingleAction = !!opt.singleAction;
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={isActive}
                aria-disabled={opt.disabled || undefined}
                tabIndex={opt.disabled ? -1 : 0}
                className={[
                  styles.item,
                  multiple && checkboxes ? styles.itemWithCheckbox : '',
                  isActive ? styles.itemActive : '',
                  opt.disabled ? styles.itemDisabled : '',
                ].filter(Boolean).join(' ')}
                style={opt.style}
                onClick={() => {
                  if (opt.disabled) return;
                  if (multiple && !isSingleAction) {
                    // Toggle this option in the value array; keep menu open.
                    const next = valueSet.has(opt.value)
                      ? valueArray.filter(v => v !== opt.value)
                      : [...valueArray, opt.value];
                    onChange(next);
                    return;
                  }
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                {multiple && checkboxes && (
                  // Presentational — the row's own onClick owns the toggle, so
                  // the checkbox must not also handle the click.
                  <Checkbox
                    checked={isActive}
                    className={styles.itemCheckbox}
                    tabIndex={-1}
                    aria-hidden="true"
                  />
                )}
                {opt.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  // Bare-trigger fast path — no label / helper / error requested, so we
  // return the wrap+trigger as-is. Existing callers that manage their own
  // <label> (e.g. via the Drawer's local Field wrapper) stay unaffected.
  if (!needsField) return trigger;

  const activeError = errorText != null ? errorText : null;

  return (
    <div className={[styles.field, wrapperClassName || className || ''].filter(Boolean).join(' ')}>
      {label && (
        <label className={styles.label} htmlFor={triggerId}>
          <span>{label}</span>
          {showInfo && (
            <Icon
              name="solar:info-circle-linear"
              size={12}
              color="var(--neutral-300)"
              className={styles.labelInfo}
              title={infoText}
            />
          )}
          {required && <span className={styles.required} aria-hidden="true" />}
        </label>
      )}
      {trigger}
      {typeof activeError === 'string' && activeError && (
        <span className={styles.errorText}>{activeError}</span>
      )}
      {!activeError && helperText && (
        <span className={styles.helperText}>{helperText}</span>
      )}
    </div>
  );
}
