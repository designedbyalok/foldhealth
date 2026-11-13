import { useEffect, useMemo, useRef, useState } from 'react';
import { Popover } from '../Popover/Popover';
import { Listbox } from '../Listbox/Listbox';
import { Avatar } from '../Avatar/Avatar';
import { Icon } from '../Icon/Icon';
import { Input } from '../Input/Input';
import { Checkbox } from '../Checkbox/Checkbox';
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
 * @param {{ id?, name, role?, note?, initials?, section?, badge?, disabled?, searchText? }[]} props.users
 *   `section` groups users under that header (in the order given), `note` is
 *   a line under the role (e.g. "Covering for Navin Jethwani"), `badge`
 *   is a node shown after the name (e.g. why they're limited), and
 *   `disabled` lists a user who can't be picked.
 * @param {string}   [props.selected]     – Who's currently picked (ticked): their id, or (older data) name
 * @param {function} props.onSelect       – (user) => void
 * @param {function} [props.onUnassign]   – Shows an "Unassign" row when given
 * @param {function} props.onClose
 * @param {string}   [props.title='Select User']
 * @param {string}   [props.emptyText='No users available.']
 * @param {number}   [props.width=280]   – Wider for rows with badges
 * @param {boolean}  [props.titleCaseSections] – Section headers as written (e.g. "Limited Access")
 *   instead of the list's default uppercase
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

export function UserPickerPopover({ anchorRect, users = NO_USERS, selected, onSelect, onUnassign, onClose, title = 'Select User', emptyText = 'No users available.', align = 'left', width = 280, titleCaseSections = false, multiple = false, pinned = null, restLabel = 'All Users' }) {
  const [pinnedKeys] = useState(() => (pinned?.keys || []).map(String));
  const searchRef = useRef(null);
  const [query, setQuery] = useState('');
  useEffect(() => { searchRef.current?.focus(); }, []);

  const q = query.trim().toLowerCase();
  const shown = useMemo(() => users.filter(u => !q || `${u.searchText || u.name} ${u.role || ''}`.toLowerCase().includes(q)), [users, q]);
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
  const ordered = groups ? [...groups.top, ...groups.rest] : shown;
  const topKeys = new Set(groups ? groups.top.map(keyOf) : []);
  if (!anchorRect) return null;

  return (
    <Popover
      anchor={anchorRect}
      onOpenChange={() => onClose()}
      placement={align === 'right' ? 'bottom-end' : 'bottom-start'}
      width={width}
      listNavigation
      role="dialog"
      aria-label={title}
      className={[styles.menu, titleCaseSections ? styles.titleSections : ''].filter(Boolean).join(' ')}
    >
      <span className={styles.title}>{title}</span>
      <Input
        ref={searchRef}
        leadingIcon="solar:magnifer-linear"
        placeholder="Search"
        aria-label="Search users"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
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
          <button type="button" className={styles.row} onClick={() => { onUnassign(); onClose(); }}>
            <Avatar type="icon" variant="others" iconName="solar:user-linear" size="M" />
            <span className={styles.name}>Unassign</span>
          </button>
        )}
        <Listbox
          aria-label={title}
          size="lg"
          dividers
          multiple={multiple}
          indicator={multiple ? 'checkbox' : 'check'}
          options={ordered.map(u => ({
            value: keyOf(u),
            label: u.badge ? <span className={styles.nameRow}><span className={styles.nameText}>{u.name}</span>{u.badge}</span> : u.name,
            searchText: u.searchText || u.name,
            description: u.role || u.note
              ? <span className={styles.desc}>{u.role && <span>{u.role}</span>}{u.note && <span className={styles.note}>{u.note}</span>}</span>
              : undefined,
            disabled: !!u.disabled,
            leading: <Avatar variant="staff" initials={u.initials || initialsOf(u.name)} size="M" />,
            section: u.section ?? (groups ? (topKeys.has(keyOf(u)) ? pinned.label : restLabel) : undefined),
          }))}
          value={multiple ? ordered.filter(isPicked).map(keyOf) : (ordered.find(isPicked) ? keyOf(ordered.find(isPicked)) : null)}
          onSelect={(o) => {
            const u = ordered.find(x => keyOf(x) === o.value);
            if (multiple) toggle(u);
            else { onSelect(u); onClose(); }
          }}
          emptyText={q ? 'No users match your search.' : emptyText}
        />
      </div>
    </Popover>
  );
}
