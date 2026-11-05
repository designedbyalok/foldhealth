import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Avatar } from '../../components/Avatar/Avatar';
import styles from './RoleTooltip.module.css';

/**
 * Floating tooltip that surfaces an assignee's full name + role. Anchored
 * to whatever element wraps it via `children`; opens on `mouseenter`/focus
 * with a tiny 120ms delay, closes immediately on leave/blur.
 *
 * Mirrors Figma node 50:297369, small white card, 24×24 colored initials
 * avatar on the left, two text lines on the right (name + role), 6px
 * arrow tail centred under the card pointing back at the trigger.
 *
 * Props:
 *  - name       (string)  Full name, e.g. "Deborah Hintz".
 *  - role       (string)  Display role, e.g. "Coder", "Reviewer 1".
 *  - initials   (string)  2-letter avatar text; defaults to first letters.
 *  - variant    ('provider' | 'patient')  Colour palette for the avatar.
 *                          Defaults to 'provider' (orange) since this is
 *                          almost always a staff member tooltip.
 *  - children   (ReactNode)  The trigger element (already styled outside).
 *  - className  (string)  Optional class for the inline trigger wrapper.
 */
export function RoleTooltip({
  name,
  role,
  initials,
  variant = 'staff',
  children,
  className,
}) {
  const triggerRef = useRef(null);
  const openTimer = useRef(null);
  const [rect, setRect] = useState(null);

  const showInitials = initials || deriveInitials(name);

  const open = () => {
    if (!name && !role) return;
    if (openTimer.current) clearTimeout(openTimer.current);
    openTimer.current = setTimeout(() => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (r) setRect(r);
    }, 120);
  };
  const close = () => {
    if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; }
    setRect(null);
  };
  useEffect(() => () => clearTimeout(openTimer.current), []);

  return (
    <>
      <span
        ref={triggerRef}
        className={[styles.triggerWrap, className || ''].filter(Boolean).join(' ')}
        onMouseEnter={open}
        onMouseLeave={close}
        onFocus={open}
        onBlur={close}
      >
        {children}
      </span>
      {rect && (name || role) && (
        <TooltipCard
          rect={rect}
          name={name}
          role={role}
          initials={showInitials}
          variant={variant}
        />
      )}
    </>
  );
}

function TooltipCard({ rect, name, role, initials, variant }) {
  // Tooltip floats just above the trigger, centred horizontally over it.
  // Width is dynamic but capped so long names wrap gracefully.
  const W_MAX = 260;
  // Render off-screen first to measure (single render cycle): simpler is to
  // just use a generous max-width and let the browser size it naturally.
  const triggerCenterX = rect.left + rect.width / 2;
  const triggerTop = rect.top;
  // Position: tooltip's bottom sits 8px above the trigger.
  const style = {
    top: triggerTop - 8,
    left: triggerCenterX,
    maxWidth: W_MAX,
  };
  return createPortal(
    <div className={styles.tooltip} style={style} role="tooltip">
      <div className={[styles.card, variant === 'patient' ? styles.cardPatient : styles.cardProvider].join(' ')}>
        <Avatar
          variant={variant === 'patient' ? 'patient' : 'staff'}
          initials={initials}
          className={[styles.avatar, variant === 'patient' ? styles.avatarPatient : styles.avatarProvider].join(' ')}
        />
        <div className={styles.text}>
          {name && <div className={styles.name}>{name}</div>}
          {role && <div className={styles.role}>{role}</div>}
        </div>
      </div>
      <span className={styles.tail} aria-hidden="true" />
    </div>,
    document.body,
  );
}

function deriveInitials(name) {
  if (!name) return '';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
