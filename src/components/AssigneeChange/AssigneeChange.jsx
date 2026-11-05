import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Avatar } from '../Avatar/Avatar';
import { Icon } from '../Icon/Icon';
import { DownChevronIcon } from '../Icon/DownChevronIcon';
import styles from './AssigneeChange.module.css';

/**
 * AssigneeChange: worklist row cell for assigning / re-assigning a user.
 *
 * States (per Figma Fold-Pixel-1.0 node 8629:178):
 *   • Assigned  → provider avatar + name (+ optional role). Fixed pill
 *                 width; long names truncate with ellipsis.
 *   • Unassigned → outlined person slot + "Assign". Width hugs the
 *                  label so short strings don't leave an oversized dead-zone.
 *   • avatarOnly → avatar + chevron, no text (compact cell mode).
 *   • disabled   → greyed, non-interactive.
 *
 * Sizes:
 *   • 'M' (default): 24px avatar, 14px name, 12px role.
 *   • 'S', 20px (Avatar size XS) + 12px name for tighter rows.
 *
 * When `users` is supplied, the button owns its own portaled searchable
 * picker: click opens a list of `{id, name, initials, role?}` rows, and
 * picking one fires `onSelect(user)`. Without `users`, the button just
 * fires `onClick` for callers that want to open their own picker.
 *
 * Hover / keyboard focus fills the pill with a subtle neutral-50
 * background and reveals a chevron (disabled states skip the reveal).
 */
// v2: added fillContainer prop for row-cell full-width pills.
export const AssigneeChange = forwardRef(function AssigneeChange({
  name,
  initials,
  role,
  showRole = true,          // toggle the role sub-line on/off independently of the value
  unassigned = false,
  unassignedLabel = 'Assign',
  size = 'M',              // 'M' | 'S'
  avatarOnly = false,
  // Avatar variant for the leading initials chip in the assigned state.
  // Default 'staff' matches the assign-a-user shape; callers can pass
  // 'patient' to reuse the pill for member cells.
  avatarVariant = 'staff',
  // hideAvatar drops the initials avatar in the assigned state and swaps the
  // outlined person avatar for a plain leading Solar icon in the unassigned
  // state. Ignored in `avatarOnly` mode (the avatar IS the affordance there).
  hideAvatar = false,
  leadingIconName = 'solar:user-plus-rounded-linear',
  nameMuted = false,
  disabled = false,
  // Opt-in for table rows: drop the fixed 140px pill width and fill the
  // parent cell so long names use every pixel the column allocates.
  // Ignored in avatarOnly mode: that variant is always a tight pill.
  fillContainer = false,
  users,
  onSelect,
  pickerTitle,
  onClick,
  className,
  ariaLabel,
}, ref) {
  const btnRef = useRef(null);
  const searchRef = useRef(null);
  const [pos, setPos] = useState(null);
  const [query, setQuery] = useState('');
  const hasPicker = Array.isArray(users);

  // Hover / focus tooltip: only for the avatar-only variant where the pill
  // hides the name and role. Matches the HCC RoleTooltip visual spec (Figma
  // node 50:297369): white card, 24×24 initials avatar, name + role stacked,
  // 6px arrow tail centred under the card.
  const canShowTooltip = avatarOnly && !unassigned && (name || role);
  const [tipRect, setTipRect] = useState(null);
  const tipTimer = useRef(null);
  useEffect(() => () => tipTimer.current && clearTimeout(tipTimer.current), []);
  const openTip = () => {
    // Show the informational avatar tooltip even when the pill is
    // disabled: the tooltip tells the reader who's assigned, and
    // that context is just as useful (arguably more so) on read-only
    // rows where the name text is hidden and the affordance is
    // muted.
    if (!canShowTooltip) return;
    if (tipTimer.current) clearTimeout(tipTimer.current);
    tipTimer.current = setTimeout(() => {
      const r = btnRef.current?.getBoundingClientRect();
      if (r) setTipRect(r);
    }, 120);
  };
  const closeTip = () => {
    if (tipTimer.current) { clearTimeout(tipTimer.current); tipTimer.current = null; }
    setTipRect(null);
  };

  const setRefs = useCallback((el) => {
    btnRef.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) ref.current = el;
  }, [ref]);

  const open = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    setQuery('');
    // Nudge right-aligned popovers back into the viewport if the pill sits
    // close to the right edge (SNP's Assignee column is well inboard so
    // left alignment is almost always fine).
    const left = Math.min(r.left, window.innerWidth - 300);
    setPos({ top: r.bottom + 4, left });
  };
  const close = () => setPos(null);

  // Close on outside click / Escape; focus the search input on open.
  useEffect(() => {
    if (!pos) return undefined;
    searchRef.current?.focus();
    const onDoc = (e) => {
      if (!btnRef.current?.contains(e.target) && !e.target.closest?.(`.${styles.menu}`)) close();
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [pos]);

  const handleClick = (e) => {
    if (disabled) return;
    e.stopPropagation();
    if (hasPicker) { pos ? close() : open(); return; }
    onClick?.(e);
  };

  // Use Avatar's design-token scale so we inherit the shared radius / font
  // scale instead of hand-picking pixels: 'S' → 24px, 'XS' → 20px.
  // Figma node 8629:178 spec.
  const avatarSize = size === 'S' ? 'XS' : 'S';

  // Chevron picks up the pill's tone in avatar-only mode: variant
  // maps 1:1 to the token, patient → primary purple, staff → the
  // secondary orange. Everywhere else it stays grey until hover
  // reveals it. Figma node 8629:178.
  const chevronColor = avatarOnly && !unassigned
    ? (avatarVariant === 'patient' ? 'var(--primary-300)' : 'var(--secondary-300)')
    : 'var(--neutral-300)';

  const q = query.trim().toLowerCase();
  const filtered = hasPicker && q
    ? users.filter(u =>
        u.name.toLowerCase().includes(q) || (u.role || '').toLowerCase().includes(q))
    : (users || []);

  const label = ariaLabel || (unassigned
    ? 'Assign user'
    : `Change assignee${name ? ` (currently ${name})` : ''}`);

  const rootClass = [
    styles.root,
    unassigned ? styles.unassigned : styles.assigned,
    size === 'S' ? styles.sizeS : styles.sizeM,
    avatarOnly ? styles.avatarOnly : '',
    /* Variant modifier: drives the avatar-only hover tint so
       patient rows fill with a primary halo instead of the default
       secondary one. */
    avatarOnly && !unassigned && avatarVariant === 'patient' ? styles.variantPatient : '',
    fillContainer && !avatarOnly ? styles.fillContainer : '',
    disabled ? styles.disabled : '',
    className || '',
  ].filter(Boolean).join(' ');

  const trigger = unassigned ? (
    <button
      ref={setRefs}
      type="button"
      className={rootClass}
      onClick={handleClick}
      aria-label={label}
      aria-disabled={disabled || undefined}
      aria-haspopup={hasPicker ? 'menu' : undefined}
      aria-expanded={hasPicker ? !!pos : undefined}
      onMouseEnter={openTip}
      onMouseLeave={closeTip}
      onFocus={openTip}
      onBlur={closeTip}
    >
      {hideAvatar && !avatarOnly ? (
        <Icon name={leadingIconName} size={14} color="var(--neutral-200)" />
      ) : (
        <Avatar
          type="icon"
          variant="others"
          size={size === 'S' ? 'XS' : 'S'}
          iconName="solar:user-rounded-linear"
          className={avatarOnly ? styles.avatarInner : undefined}
        />
      )}
      {!avatarOnly && <span className={styles.textLabel}>{unassignedLabel}</span>}
      <DownChevronIcon size={14} color={chevronColor} className={styles.chevron} />
    </button>
  ) : (
    <button
      ref={setRefs}
      type="button"
      className={rootClass}
      onClick={handleClick}
      aria-label={label}
      /* Native browser title as a guaranteed fallback for the hover
         name: the styled tooltip below is nicer, but on avatar-only
         cells any missed tooltip would leave the reader without any
         way to tell who's assigned. */
      title={avatarOnly && !unassigned && name ? name : undefined}
      aria-disabled={disabled || undefined}
      aria-haspopup={hasPicker ? 'menu' : undefined}
      aria-expanded={hasPicker ? !!pos : undefined}
      onMouseEnter={openTip}
      onMouseLeave={closeTip}
      onFocus={openTip}
      onBlur={closeTip}
    >
      {!(hideAvatar && !avatarOnly) && (
        <Avatar
          variant={avatarVariant}
          initials={initials}
          size={avatarSize}
          className={avatarOnly ? styles.avatarInner : undefined}
        />
      )}
      {!avatarOnly && (
        <span className={styles.textBody}>
          <span className={[styles.name, nameMuted ? styles.nameMuted : ''].filter(Boolean).join(' ')} title={name}>{name}</span>
          {showRole && role && <span className={styles.role}>{role}</span>}
        </span>
      )}
      <DownChevronIcon size={14} color={chevronColor} className={styles.chevron} />
    </button>
  );

  return (
    <>
      {trigger}
      {tipRect && canShowTooltip && createPortal(
        <div
          className={styles.tooltip}
          style={{ top: tipRect.top - 8, left: tipRect.left + tipRect.width / 2 }}
          role="tooltip"
        >
          <div className={styles.tooltipCard}>
            <Avatar variant={avatarVariant} initials={initials} className={styles.tooltipAvatar} />
            <span className={styles.tooltipText}>
              {name && <span className={styles.tooltipName}>{name}</span>}
              {role && <span className={styles.tooltipRole}>{role}</span>}
            </span>
          </div>
          <span className={styles.tooltipTail} aria-hidden="true" />
        </div>,
        document.body,
      )}
      {hasPicker && pos && createPortal(
        <div
          className={styles.menu}
          style={{ top: pos.top, left: pos.left }}
          onClick={(e) => e.stopPropagation()}
          role="menu"
        >
          <div className={styles.menuTitle}>
            {pickerTitle || (unassigned ? 'Assign user' : 'Change assignee')}
          </div>
          <div className={styles.search}>
            <Icon name="solar:magnifer-linear" size={14} color="var(--neutral-300)" />
            <input
              ref={searchRef}
              type="text"
              className={styles.searchInput}
              placeholder="Search users…"
              aria-label="Search users"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className={styles.list}>
            {filtered.length === 0 ? (
              <div className={styles.empty}>
                {q ? 'No users match your search.' : 'No users available.'}
              </div>
            ) : filtered.map(u => (
              <button
                key={u.id}
                type="button"
                role="menuitem"
                className={[styles.userRow, u.name === name ? styles.userRowActive : ''].filter(Boolean).join(' ')}
                onClick={() => { onSelect?.(u); close(); }}
              >
                <Avatar variant={u.avatarVariant || 'staff'} initials={u.initials} size={24} />
                <span className={styles.userText}>
                  <span className={styles.userName}>{u.name}</span>
                  {u.role && <span className={styles.userRole}>{u.role}</span>}
                </span>
                {u.name === name && (
                  <Icon name="solar:check-circle-bold" size={14} color="var(--primary-300)" />
                )}
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
});
