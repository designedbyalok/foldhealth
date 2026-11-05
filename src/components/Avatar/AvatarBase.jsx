import { Icon } from '../Icon/Icon';
import styles from './Avatar.module.css';

// Wrap the rendered avatar in a locked container when a caller passes
// `locked`, greys the avatar out and stamps a lock badge (white rounded
// square + outlined red lock) on the bottom-right corner. Matches the HCC
// "record rejected" treatment (Figma spec).
//
// `billed` layers on top with the same badge slot: a green dollar coin
// marks a DOS that has been billed out. Billed also implies read-only
// (like rejected) but keeps the inner avatar in its normal colours since
// billing is a happy-path terminal state, not a failure.
function LockedWrapper({ locked, billed, children, className }) {
  if (!locked && !billed) return children;
  return (
    <span className={[styles.lockedWrap, className || ''].filter(Boolean).join(' ')}>
      {children}
      {locked && (
        <span className={styles.lockBadge} aria-label="Locked: record rejected">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="12" height="12" rx="2" fill="white" />
            <path
              d="M3 5V4C3 2.34 4.34 1 6 1C7.66 1 9 2.34 9 4V5M4 11H8C9.41 11 10.12 11 10.56 10.56C11 10.12 11 9.41 11 8C11 6.59 11 5.88 10.56 5.44C10.12 5 9.41 5 8 5H4C2.59 5 1.88 5 1.44 5.44C1 5.88 1 6.59 1 8C1 9.41 1 10.12 1.44 10.56C1.88 11 2.59 11 4 11ZM7 8C7 8.55 6.55 9 6 9C5.45 9 5 8.55 5 8C5 7.45 5.45 7 6 7C6.55 7 7 7.45 7 8Z"
              stroke="var(--status-error)"
              strokeLinecap="round"
            />
          </svg>
        </span>
      )}
      {!locked && billed && (
        <span className={styles.billedBadge} aria-label="Billed: record is read-only">
          <Icon name="solar:dollar-linear" size={10} color="var(--neutral-0)" />
        </span>
      )}
    </span>
  );
}

// Design-token size scale (Figma Fold-Pixel-1.0 node 25:4262). When `size`
// matches one of these keys, the tile picks up width/height/radius/font from
// the matching CSS class. Anything else (`lg`, `md`, a raw number, undefined)
// falls through to the legacy per-variant sizing so existing callers keep
// rendering as before.
const SIZE_CLASS_KEYS = new Set(['XS', 'S', 'M', 'L', 'XL', 'DXL']);
const sizeScaleClass = (size, styles) => {
  if (!SIZE_CLASS_KEYS.has(size)) return '';
  return styles[`size${size}`] || '';
};

// Icon size per tile: ~55% of tile edge. Keeps the icon optically balanced
// across every step in the token scale (Figma Fold-Pixel-1.0 node 25:4344).
const ICON_SIZE_BY_TOKEN = { XS: 12, S: 14, M: 18, L: 22, XL: 28, DXL: 36 };

// Foreground token per color variant: used for the icon fill so an Icon
// Avatar reads with the same weight as the corresponding Initial Avatar.
const ICON_COLOR_BY_VARIANT = {
  patient: 'var(--primary-300)',
  staff: 'var(--secondary-300)',
  provider: 'var(--secondary-300)',
  others: 'var(--neutral-300)',
  // Outcome-bearing tiles: an activity that succeeded or failed says so in
  // the tile itself rather than only in its text. `warning` and `primary`
  // complete the set so a tile can match the status badge beside it.
  success: 'var(--status-success)',
  error: 'var(--status-error)',
  warning: 'var(--status-warning)',
  primary: 'var(--primary-300)',
};

export function AvatarBase({ type = 'initial', variant = 'patient', initials, iconName, size, agentName, icon, backgroundColor, borderColor, color, className, locked = false, billed = false }) {
  const agentKey = agentName ? agentName.toLowerCase() : '';
  const lockedClass = locked ? styles.locked : '';
  const scaleClass = sizeScaleClass(size, styles);
  // Only patient / staff / provider / others honor `type="icon"`; the other
  // legacy variants (agent, assignee, callCard, generic) keep their existing
  // contract so callers don't break.
  const isIcon = type === 'icon' && iconName
    && ['patient', 'staff', 'provider', 'others', 'success', 'error', 'warning', 'primary'].includes(variant);
  const iconEl = isIcon
    ? <Icon name={iconName} size={ICON_SIZE_BY_TOKEN[size] || 18} color={ICON_COLOR_BY_VARIANT[variant]} />
    : null;
  
  if (variant === 'generic' || variant === 'icon') {
    return (
      <div 
        className={[styles.generic, className || ''].filter(Boolean).join(' ')}
        style={{ 
          background: backgroundColor, 
          borderColor: borderColor, 
          color: color,
          width: size,
          height: size
        }}
      >
        {icon || initials}
      </div>
    );
  }

  if (variant === 'agent') {
    const hasGradient = ['erica', 'ricardo', 'maria', 'jia', 'dubois'].includes(agentKey);
    return (
      <div className={[styles.agent, styles[agentKey], className || ''].filter(Boolean).join(' ')}>
        {!hasGradient && initials}
      </div>
    );
  }
  if (variant === 'invokeAgent') {
    return <div className={[styles.invokeAgent, styles[agentKey], className || ''].filter(Boolean).join(' ')} />;
  }
  if (variant === 'provider' || variant === 'staff') {
    // Honor a numeric `size` override so callers can render a compact
    // provider chip (e.g. 24×24) without duplicating the variant. Font
    // scales at ~44% of size (matches the default 14px / 32px ratio) with
    // a 10px floor so short initials don't disappear.
    const style = typeof size === 'number'
      ? { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.44)) }
      : undefined;
    return (
      <LockedWrapper locked={locked} billed={billed}>
        <div className={[styles.provider, scaleClass, lockedClass, className || ''].filter(Boolean).join(' ')} style={style}>
          {iconEl || initials}
        </div>
      </LockedWrapper>
    );
  }
  if (['others', 'success', 'error', 'warning', 'primary'].includes(variant)) {
    return (
      <LockedWrapper locked={locked} billed={billed}>
        <div className={[styles[variant], scaleClass, lockedClass, className || ''].filter(Boolean).join(' ')}>
          {iconEl || initials}
        </div>
      </LockedWrapper>
    );
  }
  if (variant === 'assignee') {
    return (
      <LockedWrapper locked={locked} billed={billed}>
        <div className={[styles.assignee, scaleClass, lockedClass, className || ''].filter(Boolean).join(' ')}>{initials}</div>
      </LockedWrapper>
    );
  }
  if (variant === 'callCard') {
    return <div className={[styles.callCard, className || ''].filter(Boolean).join(' ')}>{initials}</div>;
  }
  {
    // Mirror the staff/provider numeric-size override so a caller passing
    // `size={24}` gets a compact patient chip that lines up with the
    // matching staff avatar in the same list (e.g. the AssigneeChange
    // picker mixing user + member rows).
    const style = typeof size === 'number'
      ? { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.44)) }
      : undefined;
    return (
      <LockedWrapper locked={locked} billed={billed}>
        <div className={[styles.patient, scaleClass, lockedClass, className || ''].filter(Boolean).join(' ')} style={style}>{iconEl || initials}</div>
      </LockedWrapper>
    );
  }
}
