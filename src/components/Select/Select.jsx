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
 *  - options    [{ value: string, label: string, disabled?: boolean, icon?: string }]
 *                 (`icon`: a Solar icon shown before the option's label)
 *                 Options may also carry `badgeTooltip` (node): shown on hovering the
 *                 option's chip when `multiple` + `badges`; and `triggerLabel`, the
 *                 name shown for the pick (chip text, or the open field's hint) when
 *                 `label` is a node or `searchText` has extra words (e.g. an email).
 *  - multiple + badges: picks show as chips on one line; those that don't
 *                 fit fold into a "+N" chip (hover lists them). Searchable, the
 *                 field stays one line while open too: chips first, then the
 *                 search, with no placeholder once something is picked.
 *                 Removing a chip keeps the menu open.
 *  - showInfo + infoText: an (i) beside the label with `infoText` in a
 *                 Tooltip on hover.
 *  - emptyText  (string | (query) => string) — shown when nothing matches; a
 *                 function gets what was typed, for "No users match "x" …"
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
 *  - defaultOpen (boolean)      — mount with the menu already open (and the
 *                                 search focused), for a picker revealed by
 *                                 a click so the user can type straight away
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
  // Optional control at the right end of the label row (e.g. a Remove link).
  labelAction,
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
  defaultOpen = false,
}) {
  // Ensure a stable label↔trigger association even when `id` isn't set.
  const autoId = useId();
  const triggerId = id || (label ? autoId : undefined);
  const listboxId = `${autoId}-listbox`;
  const isError = variant === 'error' || Boolean(errorText);
  const valueArray = multiple ? (Array.isArray(value) ? value : []) : null;
  const valueSet = useMemo(
    () => (multiple ? new Set(Array.isArray(value) ? value : []) : null),
    [multiple, value],
  );
  const isSelected = (v) => multiple ? valueSet.has(v) : v === value;
  const [open, setOpen] = useState(defaultOpen);
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
    // Capture phase: inside a Popover, mouse-downs stop at the panel and
    // would never bubble up to document.
    document.addEventListener('mousedown', handler, true);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler, true);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [open]);

  // Measure the trigger's position on every open — flip up when the
  // 240px menu wouldn't fit below and there IS enough room above.
  useEffect(() => {
    if (!open) return;
    const trigger = wrapRef.current?.querySelector('[data-select-trigger]');
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
  const matches = o => (o.searchText != null ? o.searchText : String(o.label)).toLowerCase().includes(q);
  // While searching, a group header stays when anything under it matches,
  // so results keep their sections.
  const shownOptions = (searchable && q && !externalQuery)
    ? options.filter((o, i) => {
      if (o.type !== 'header') return matches(o);
      for (let j = i + 1; j < options.length && options[j].type !== 'header'; j++) {
        if (matches(options[j])) return true;
      }
      return false;
    })
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
      // The first pick always shows, cut short with an ellipsis if it must
      // be, so a lone long name never reads as a bare "+1".
      setVisibleBadgeCount(Math.max(fit, 1));
    };

    const ro = new ResizeObserver(recompute);
    ro.observe(row);
    // rAF rather than a synchronous call — setting state in an effect body
    // cascades renders.
    const raf = requestAnimationFrame(recompute);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
    // `open` too: a searchable field swaps the badge row for its input while
    // open, so picks made then are measured when it closes and the row returns.
  }, [multiple, badges, selectedKey, open]);

  const hiddenBadges = selectedMulti.slice(visibleBadgeCount);

  // Searchable: the field is a combobox you type into (no search box in
  // the menu). Closed it shows the pick like any Select; a click, Enter,
  // ArrowDown or a typed character opens it for typing.
  // What the open field shows for the current pick: its display name, not
  // the extra words it's searchable by (e.g. an email address).
  const selectedText = !multiple && selected
    ? (selected.triggerLabel ?? selected.searchText ?? (typeof selected.label === 'string' ? selected.label : ''))
    : '';
  const firstPickable = () => shownOptions.find(o => o.type !== 'header' && !o.disabled);
  const onSearchKeyDown = (e) => {
    // Keep Escape / Enter from reaching drawers and dialogs around the field.
    e.stopPropagation();
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      const opt = firstPickable();
      if (!opt) return;
      if (multiple) {
        onChange(valueSet.has(opt.value) ? valueArray.filter(v => v !== opt.value) : [...valueArray, opt.value]);
      } else {
        onChange(opt.value);
        setOpen(false);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      menuRef.current?.querySelector('[role="option"]:not([aria-disabled="true"])')?.focus();
    }
  };
  const TriggerTag = searchable ? 'div' : 'button';
  const triggerProps = searchable
    ? {
      id: open ? undefined : triggerId,
      role: open ? undefined : 'combobox',
      tabIndex: disabled ? -1 : (open ? -1 : 0),
      'aria-disabled': disabled || undefined,
      onClick: () => { if (!disabled && !open) setOpen(true); },
      onKeyDown: (e) => {
        if (disabled || open) return;
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault();
          setOpen(true);
        } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
          // Typing on the closed field starts the search with that letter.
          e.preventDefault();
          setQuery(e.key);
          setOpen(true);
        }
      },
    }
    : {
      id: triggerId,
      type: 'button',
      disabled,
      onClick: () => !disabled && setOpen(o => !o),
    };

  // The one-line chip row (as many as fit, then "+N"), shared by the closed
  // field and the open, searchable one.
  const badgeRow = (
    <span ref={badgeRowRef} className={styles.triggerBadges}>
      {selectedMulti.slice(0, visibleBadgeCount).map((o, i) => {
        const badge = (
          <Badge
            key={o.value}
            tone="grey"
            size="S"
            className={i === 0 ? styles.badgeShrink : undefined}
            label={i === 0 ? <span className={styles.badgeText}>{o.triggerLabel ?? o.label}</span> : (o.triggerLabel ?? o.label)}
            trailingIconElement={<CloseIcon size={12} color="currentColor" />}
            trailingIconLabel={`Remove ${o.triggerLabel ?? o.label}`}
            onTrailingIconClick={() => onChange(valueArray.filter(v => v !== o.value))}
          />
        );
        // An option's `badgeTooltip` shows on hovering its chip (e.g. who a recipient is).
        return o.badgeTooltip
          ? <Tooltip key={o.value} label={o.badgeTooltip} variant="card" placement="bottom" align="left" raised>{badge}</Tooltip>
          : badge;
      })}
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
  );

  const trigger = (
    <div ref={wrapRef} className={[styles.wrap, needsField ? '' : (className || '')].filter(Boolean).join(' ')} style={style}>
      <TriggerTag
        data-select-trigger=""
        {...triggerProps}
        className={[
          styles.trigger,
          searchable ? styles.triggerSearch : '',
          searchable && disabled ? styles.triggerDisabled : '',
          variant === 'ghost' ? styles.triggerGhost : '',
          isError ? styles.triggerError : '',
          (multiple ? selectedMulti.length === 0 : !selected) ? styles.triggerPlaceholder : '',
        ].filter(Boolean).join(' ')}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={isError || undefined}
      >
        {leadingIcon && (
          <Icon name={leadingIcon} size={16} color="currentColor" />
        )}
        {searchable && open && multiple && badges && selectedMulti.length > 0 ? (
          // Searching a multi-pick with chips: the field stays one line; as
          // many chips as fit show, the rest fold into "+N", and the search
          // is typed after them. Removing a chip keeps the menu open.
          <span className={styles.triggerBadgesOpen}>
            <span className={styles.triggerBadgesOpenRow} onClick={(e) => e.stopPropagation()}>
              {badgeRow}
            </span>
            <input
              ref={searchRef}
              id={triggerId}
              type="text"
              role="combobox"
              aria-expanded={open}
              aria-autocomplete="list"
              className={`${styles.triggerInput} ${styles.triggerInputInline}`}
              aria-label={searchPlaceholder}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={onSearchKeyDown}
            />
          </span>
        ) : searchable && open ? (
          // Searching: type in the field itself; the current pick shows as
          // the placeholder until something is typed.
          <input
            ref={searchRef}
            id={triggerId}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-autocomplete="list"
            className={styles.triggerInput}
            placeholder={selectedText || searchPlaceholder}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onSearchKeyDown}
          />
        ) : multiple && badges && selectedMulti.length > 0 ? (
          badgeRow
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
          {...(searchable ? { onClick: (e) => { e.stopPropagation(); if (!disabled) setOpen(o => !o); } } : {})}
        />
      </TriggerTag>
      {open && renderMenu(
        <ul
          ref={menuRef}
          id={listboxId}
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
          {shownOptions.length === 0 && (
            <li className={styles.emptyOption} aria-disabled>
              {searchLoading ? 'Searching…' : ((typeof emptyText === 'function' ? emptyText(query) : emptyText) || 'No matches')}
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
                {opt.icon ? (
                  <span className={styles.itemLabel}>
                    <Icon name={opt.icon} size={14} color="var(--neutral-300)" />
                    {opt.label}
                  </span>
                ) : opt.label}
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
  const labelEl = label && (
    <label className={styles.label} htmlFor={triggerId}>
      <span>{label}</span>
      {showInfo && (
        <Tooltip label={infoText} maxWidth={280}>
          <Icon
            name="solar:info-circle-linear"
            size={12}
            color="var(--neutral-300)"
            className={styles.labelInfo}
            aria-label={infoText}
          />
        </Tooltip>
      )}
      {required && <span className={styles.required} aria-hidden="true" />}
    </label>
  );

  return (
    <div className={[styles.field, wrapperClassName || className || ''].filter(Boolean).join(' ')}>
      {label && (labelAction
        ? <div className={styles.labelRow}>{labelEl}{labelAction}</div>
        : labelEl)}
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
