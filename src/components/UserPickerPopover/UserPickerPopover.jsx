import { useEffect, useMemo, useRef, useState } from 'react';
import { Popover } from '../Popover/Popover';
import { Avatar } from '../Avatar/Avatar';
import { Icon } from '../Icon/Icon';
import { Checkbox } from '../ShadcnCheckbox/ShadcnCheckbox';
import styles from './UserPickerPopover.module.css';

const initialsOf = (name) => String(name || '?').trim().split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase();

/**
 * "Select User" popover (Figma Eventus 16978:128278): a title, a search
 * box, an optional "Unassign" row, then people with avatar, name and role.
 * Anchored to a trigger's rect and portalled, so callers keep their own
 * trigger (an AssigneeChange pill, a bulk-bar button, …).
 *
 * @param {object}   props
 * @param {DOMRect}  props.anchorRect
 * @param {{ id?, name, role?, initials? }[]} props.users
 * @param {string}   [props.selected]     – Who's currently picked (ticked): their id, or (older data) name
 * @param {function} props.onSelect       – (user) => void
 * @param {function} [props.onUnassign]   – Shows an "Unassign" row when given
 * @param {function} props.onClose
 * @param {string}   [props.title='Select User']
 * @param {string}   [props.emptyText='No users available.']
 * @param {'left'|'right'} [props.align='left'] – Line up with the trigger's left edge, or its right edge
 *   (opening leftward, for triggers at the right of a panel)
 * @param {boolean}  [props.multiple]     – Checkbox rows (Figma Eventus 16978:128250): `selected` is
 *   an array of ids/names, each click toggles one and calls `onSelect(nextArray)`, and the menu stays open
 * @param {{ label: string, keys: string[] }} [props.pinned] – Users (by id/name) listed first under their
 *   own section header, the rest after a divider under `restLabel`. The group is fixed when the menu
 *   opens, so rows don't jump as they're ticked.
 * @param {string}   [props.restLabel='All Users'] – Header for the users after the pinned group
 */
const NO_USERS = [];

export function UserPickerPopover({ anchorRect, users = NO_USERS, selected, onSelect, onUnassign, onClose, title = 'Select User', emptyText = 'No users available.', align = 'left', multiple = false, pinned = null, restLabel = 'All Users' }) {
  const [pinnedKeys] = useState(() => (pinned?.keys || []).map(String));
  const searchRef = useRef(null);
  const [query, setQuery] = useState('');
  useEffect(() => { searchRef.current?.focus(); }, []);

  const q = query.trim().toLowerCase();
  const shown = useMemo(() => users.filter(u => !q || `${u.name} ${u.role || ''}`.toLowerCase().includes(q)), [users, q]);
  const keyOf = (u) => (u.id != null ? String(u.id) : u.name);
  // Pinned first, in the order given; everyone else keeps the caller's order.
  const groups = useMemo(() => {
    if (!pinnedKeys.length) return null;
    const rank = new Map(pinnedKeys.map((k, i) => [k, i]));
    const rankOf = (u) => rank.get(u.id != null ? String(u.id) : u.name) ?? rank.get(u.name);
    const top = shown.filter(u => rankOf(u) != null).sort((a, b) => rankOf(a) - rankOf(b));
    const rest = shown.filter(u => rankOf(u) == null);
    return top.length ? { top, rest } : null;
  }, [shown, pinnedKeys]);
  const pickedSet = new Set(multiple ? (selected || []).map(String) : []);
  const isPicked = (u) => (multiple
    ? pickedSet.has(keyOf(u)) || pickedSet.has(u.name)
    : selected != null && (String(u.id) === String(selected) || u.name === selected));
  const toggle = (u) => {
    const k = keyOf(u);
    const next = isPicked(u) ? [...pickedSet].filter(x => x !== k && x !== u.name) : [...pickedSet, k];
    onSelect(next);
  };
  if (!anchorRect) return null;

  return (
    <Popover
      anchor={anchorRect}
      onOpenChange={() => onClose()}
      placement={align === 'right' ? 'bottom-end' : 'bottom-start'}
      width={280}
      listNavigation
      role="menu"
      aria-label={title}
      className={styles.menu}
    >
      <span className={styles.title}>{title}</span>
      <label className={styles.search}>
        <Icon name="solar:magnifer-linear" size={16} color="var(--neutral-300)" />
        <input
          ref={searchRef}
          type="text"
          className={styles.searchInput}
          placeholder="Search"
          aria-label="Search users"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {multiple && (() => {
        // Select All / Clear All act on the users in view (the search narrows them).
        const allOn = shown.length > 0 && shown.every(isPicked);
        const someOn = shown.some(isPicked);
        return (
          <div className={styles.bulk}>
            <button
              type="button"
              className={styles.selectAll}
              onClick={() => {
                const keys = new Set(pickedSet);
                shown.forEach(u => (allOn ? (keys.delete(keyOf(u)), keys.delete(u.name)) : keys.add(keyOf(u))));
                onSelect([...keys]);
              }}
            >
              <Checkbox checked={allOn ? true : someOn ? 'indeterminate' : false} tabIndex={-1} aria-hidden="true" className={styles.check} />
              Select All
            </button>
            <button type="button" className={styles.clearAll} onClick={() => onSelect([])} disabled={!pickedSet.size}>Clear All</button>
          </div>
        );
      })()}
      <div className={styles.list}>
        {onUnassign && !q && (
          <button type="button" role="menuitem" className={styles.row} onClick={() => { onUnassign(); onClose(); }}>
            <Avatar type="icon" variant="others" iconName="solar:user-linear" size="M" />
            <span className={styles.name}>Unassign</span>
          </button>
        )}
        {shown.length === 0 ? (
          <span className={styles.empty}>{q ? 'No users match your search.' : emptyText}</span>
        ) : (groups ? [
          { key: 'pinned', label: pinned.label, rows: groups.top },
          { key: 'rest', label: restLabel, rows: groups.rest },
        ] : [{ key: 'all', rows: shown }]).filter(g => g.rows.length).map((g, gi) => (
          <div key={g.key} className={gi ? styles.groupNext : undefined} role="group" aria-label={g.label}>
            {g.label && <span className={styles.groupLabel}>{g.label}</span>}
            {g.rows.map(u => (
          <button
            key={u.id || u.name}
            type="button"
            role={multiple ? 'menuitemcheckbox' : 'menuitem'}
            aria-checked={multiple ? isPicked(u) : undefined}
            className={[styles.row, multiple ? styles.rowMulti : '', isPicked(u) && !multiple ? styles.rowActive : ''].filter(Boolean).join(' ')}
            onClick={() => (multiple ? toggle(u) : (onSelect(u), onClose()))}
          >
            {multiple && <Checkbox checked={isPicked(u)} tabIndex={-1} aria-hidden="true" className={styles.check} />}
            <Avatar variant="staff" initials={u.initials || initialsOf(u.name)} size="M" />
            <span className={styles.text}>
              <span className={styles.name}>{u.name}</span>
              {u.role && <span className={styles.role}>{u.role}</span>}
            </span>
            {isPicked(u) && !multiple && <Icon name="solar:check-circle-linear" size={16} color="var(--primary-300)" />}
          </button>
            ))}
          </div>
        ))}
      </div>
    </Popover>
  );
}
