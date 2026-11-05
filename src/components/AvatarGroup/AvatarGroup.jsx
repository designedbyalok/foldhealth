import { useState, useRef, useEffect } from 'react';
import styles from './AvatarGroup.module.css';

/**
 * Fold Health AvatarGroup: overlapping stack of Avatar tiles with an
 * overflow "+N" chip. When `people.length > max` the last visible slot
 * turns into a neutral chip counting the hidden members; hovering (or
 * focusing) the chip pops a floating list of every member.
 *
 * Matches Figma Fold-Pixel-1.0 node 25:12371 (variants XS/S/M/L/XL,
 * `patient` and `provider`).
 *
 * @param {object}   props
 * @param {Array<{ id?: string, initials: string, name?: string }>} props.people
 * @param {'patient'|'staff'} [props.variant='patient']
 * @param {'XS'|'S'|'M'|'L'|'XL'} [props.size='M']
 * @param {number}  [props.max=3]   Max tiles rendered before overflow kicks in
 * @param {string}  [props.className]
 */
export function AvatarGroup({
  people = [],
  variant = 'patient',
  size = 'M',
  max = 3,
  className,
}) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const wrapRef = useRef(null);

  // Close the popover when the pointer leaves the whole chip+popover cluster
  // so it doesn't get stuck open after a stray focus event.
  useEffect(() => {
    if (!popoverOpen) return;
    const onDocClick = (e) => {
      if (!wrapRef.current?.contains(e.target)) setPopoverOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [popoverOpen]);

  if (!people.length) return null;

  const sizeClass = styles[size.toLowerCase()] || styles.m;
  const variantClass = styles[variant] || styles.patient;
  const overflowing = people.length > max;
  const visible = overflowing ? people.slice(0, max - 1) : people;
  const hidden = overflowing ? people.slice(max - 1) : [];
  // Tile size in px keyed off the same scale the tile classes use. Setting
  // it on the group lets the overflow wrapper (which doesn't carry a size
  // class of its own) still resolve the negative-margin overlap.
  const tileSizePx = { XS: 20, S: 24, M: 32, L: 40, XL: 48 }[size] ?? 32;

  return (
    <div
      className={[styles.group, className || ''].filter(Boolean).join(' ')}
      style={{ '--avatar-tile-size': `${tileSizePx}px` }}
      role="group"
      aria-label={`${people.length} ${variant === 'staff' || variant === 'provider' ? 'staff' : 'patients'}`}
    >
      {visible.map((p, idx) => (
        <span
          key={p.id ?? `${p.initials}-${idx}`}
          className={[styles.tile, sizeClass, variantClass].join(' ')}
          title={p.name || p.initials}
        >
          {p.initials}
        </span>
      ))}

      {overflowing && (
        <span
          ref={wrapRef}
          className={styles.overflowWrap}
          onMouseEnter={() => setPopoverOpen(true)}
          onMouseLeave={() => setPopoverOpen(false)}
        >
          <button
            type="button"
            className={[styles.tile, sizeClass, styles.overflow].join(' ')}
            aria-label={`Show ${hidden.length} more`}
            aria-expanded={popoverOpen}
            onFocus={() => setPopoverOpen(true)}
            onBlur={() => setPopoverOpen(false)}
          >
            +{hidden.length}
          </button>

          {popoverOpen && (
            <div className={styles.popover} role="menu">
              {people.map((p, idx) => (
                <div
                  key={p.id ?? `${p.initials}-full-${idx}`}
                  className={styles.popoverItem}
                  role="menuitem"
                >
                  <span
                    className={[styles.popoverInitials, styles[variant] || styles.patient]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {p.initials}
                  </span>
                  <span className={styles.popoverName}>{p.name || p.initials}</span>
                </div>
              ))}
            </div>
          )}
        </span>
      )}
    </div>
  );
}
