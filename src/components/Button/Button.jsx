import { cloneElement, forwardRef, isValidElement, useRef, useState } from 'react';
import { Icon } from '../Icon/Icon';
import { DownChevronIcon } from '../Icon/DownChevronIcon';
import { MenuPopover } from '../MenuPopover/MenuPopover';
import { Tooltip } from '../Tooltip/Tooltip';
import { Spinner } from '../Spinner/Spinner';
import { usePendingClick } from './usePendingClick';
import styles from './Button.module.css';

// Custom icon elements (leadingIconElement / trailingIconElement) inherit the
// button's text color unless the caller explicitly pinned one, the same
// `currentColor` guarantee the name-based leadingIcon/trailingIcon path has.
// Without this, a fixed-color glyph goes invisible when a hover state
// repaints the button background in that same color (e.g. tertiary's
// purple-on-purple on hover).
const tintIconElement = (el) =>
  isValidElement(el) && el.props.color === undefined
    ? cloneElement(el, { color: 'currentColor' })
    : el;

// Emphasis and intent are separate axes (docs/components/library-contract.mdx).
// Tone defaults follow the variant: filled looks are primary, outlined and
// ghost looks are neutral, so the common cases need one prop.
const DEFAULT_TONE = { solid: 'primary', soft: 'primary', outline: 'neutral', ghost: 'neutral' };
const SIZE_CLASS = { sm: 'sizeS', md: 'sizeL', lg: 'sizeXL' };
const ICON_SIZE = { sm: 14, md: 16, lg: 24 };

// The names before the variant/tone split, still accepted (with a one-time
// warning in development) so data-driven values keep working.
const LEGACY_VARIANT = {
  primary: ['solid', 'primary'],
  secondary: ['outline', 'neutral'],
  tertiary: ['soft', 'primary'],
  alt: ['outline', 'primary'],
  success: ['soft', 'success'],
  danger: ['soft', 'danger'],
  error: ['soft', 'danger'],
  dangerFilled: ['solid', 'danger'],
  info: ['solid', 'info'],
};
const LEGACY_SIZE = { S: 'sm', s: 'sm', M: 'md', L: 'md', XL: 'lg' };

const warned = new Set();
function warnLegacy(prop, value, next) {
  if (!import.meta.env?.DEV || warned.has(`${prop}=${value}`)) return;
  warned.add(`${prop}=${value}`);
  console.warn(`Button: ${prop}="${value}" is deprecated; use ${next}. See docs/components/library-contract.mdx.`);
}

/** Resolve variant, tone and size, translating the legacy names. */
function resolveButtonLook(variant = 'solid', tone, size = 'md') {
  let v = variant;
  let t = tone;
  if (LEGACY_VARIANT[variant]) {
    [v, t] = [LEGACY_VARIANT[variant][0], tone ?? LEGACY_VARIANT[variant][1]];
    warnLegacy('variant', variant, `variant="${v}"${t === DEFAULT_TONE[v] ? '' : ` tone="${t}"`}`);
  }
  let z = size;
  if (LEGACY_SIZE[size]) {
    z = LEGACY_SIZE[size];
    warnLegacy('size', size, `size="${z}"`);
  }
  if (!DEFAULT_TONE[v]) v = 'solid';
  return { variant: v, tone: t ?? DEFAULT_TONE[v], size: SIZE_CLASS[z] ? z : 'md' };
}

/**
 * Fold Health Button: single source-of-truth button control.
 *
 * Matches Figma Fold-Pixel-1.0 node 25:155 exactly.
 *
 * @param {object}   props
 * @param {'solid'|'soft'|'outline'|'ghost'} [props.variant='solid'] – Emphasis: filled, tinted,
 *                                                    bordered, or bare until hover.
 * @param {'primary'|'neutral'|'success'|'warning'|'danger'|'info'} [props.tone] – Intent.
 *                                                    Defaults to primary for solid and soft,
 *                                                    neutral for outline and ghost.
 * @param {'sm'|'md'|'lg'} [props.size='md']        – sm=24px, md=32px, lg=52px (mobile)
 * @param {string}   [props.leadingIcon]             – Solar icon name for leading icon
 * @param {React.ReactNode} [props.leadingIconElement] – Custom React node for leading icon (overrides leadingIcon)
 * @param {string}   [props.trailingIcon]            – Solar icon name for trailing icon
 * @param {boolean}  [props.iconOnly=false]          – Square icon-only button (no text)
 * @param {boolean}  [props.fullWidth=false]          – Full-width button
 * @param {boolean}  [props.disabled=false]
 * @param {boolean}  [props.loading=false]           – Busy: a spinner replaces the content (the
 *                                                    button keeps its size and colors) and clicks
 *                                                    are ignored. Set automatically while a promise
 *                                                    returned from `onClick` is pending, so an async
 *                                                    handler gets this for free.
 * @param {string}   [props.disabledReason]          – While disabled, why (e.g. "Pick a form"):
 *                                                    shown in a tooltip on hover, so a greyed-out
 *                                                    action never fails silently.
 * @param {Array}    [props.menuItems]               – When provided, renders the split-button
 *                                                    variant: main action on the left, a divider,
 *                                                    and a chevron on the right that opens a
 *                                                    MenuPopover of secondary actions. Items follow
 *                                                    the MenuPopover schema.
 * @param {function} [props.onMenuSelect]            – (key, item) => void; fired when a menuItem is chosen
 * @param {string}   [props.menuAriaLabel='More actions']
 * @param {number}   [props.menuWidth=200]
 * @param {'left'|'right'} [props.menuAlign='right']
 * @param {string}   [props.className]               – Extra class on the button
 * @param {string}   [props.type='button']
 * @param {React.ReactNode} props.children           – Button text / content
 */
export const Button = forwardRef(function Button(
  {
    variant: variantProp,
    tone: toneProp,
    size: sizeProp,
    leadingIcon,
    leadingIconElement,
    trailingIcon,
    trailingIconElement,
    iconOnly = false,
    fullWidth = false,
    disabled = false,
    loading = false,
    disabledReason,
    menuItems,
    onMenuSelect,
    menuAriaLabel = 'More actions',
    menuWidth = 200,
    menuAlign = 'right',
    className,
    children,
    type = 'button',
    ...rest
  },
  ref
) {
  const { variant, tone, size } = resolveButtonLook(variantProp, toneProp, sizeProp);
  const { onClick, ...domRest } = rest;
  const [pending, handleClick] = usePendingClick(onClick, loading);
  const busy = loading || pending;

  // Split-button rendering (main + divider + chevron + menu) when the caller
  // supplies `menuItems`. Delegates both halves to the base render below so
  // every variant / size / hover / disabled state carries over unchanged.
  if (Array.isArray(menuItems) && menuItems.length > 0) {
    return (
      <SplitButtonBody
        ref={ref}
        variant={variant}
        tone={tone}
        size={size}
        leadingIcon={leadingIcon}
        leadingIconElement={leadingIconElement}
        trailingIcon={trailingIcon}
        trailingIconElement={trailingIconElement}
        disabled={disabled}
        fullWidth={fullWidth}
        menuItems={menuItems}
        onMenuSelect={onMenuSelect}
        menuAriaLabel={menuAriaLabel}
        menuWidth={menuWidth}
        menuAlign={menuAlign}
        className={className}
        type={type}
        busy={busy}
        rest={onClick ? { ...domRest, onClick: handleClick } : domRest}
      >
        {children}
      </SplitButtonBody>
    );
  }

  const sizeClass = styles[SIZE_CLASS[size]];
  const iconSize = ICON_SIZE[size];

  // Icon color follows the button's text color via `currentColor`, so
  // hover states (tertiary purple→white, success green→white, danger
  // red→white) and the disabled state re-tint the icon with the label,
  // no per-variant JS lookup needed.
  const iconColor = 'currentColor';

  const cls = [
    styles.btn,
    sizeClass,
    styles.toned,
    styles[variant],
    iconOnly ? styles.iconOnly : '',
    fullWidth ? styles.fullWidth : '',
    busy ? styles.loading : '',
    className || '',
  ]
    .filter(Boolean)
    .join(' ');

  // Busy is not disabled: the button keeps its look and focus (so the
  // spinner reads as "working on it", not "unavailable") and the handler
  // swallows clicks instead.
  const button = (
    <button
      ref={ref}
      type={type}
      className={cls}
      data-tone={tone}
      disabled={disabled && !busy}
      aria-busy={busy || undefined}
      aria-disabled={busy || undefined}
      onClick={handleClick}
      {...domRest}
    >
      {busy && <span className={styles.spinnerSlot}><Spinner size={iconSize} /></span>}
      {leadingIconElement && tintIconElement(leadingIconElement)}
      {!leadingIconElement && leadingIcon && (
        <Icon name={leadingIcon} size={iconSize} color={iconColor} className={styles.icon} />
      )}
      {!iconOnly && children}
      {trailingIconElement && tintIconElement(trailingIconElement)}
      {!trailingIconElement && trailingIcon && (
        <Icon name={trailingIcon} size={iconSize} color={iconColor} className={styles.icon} />
      )}
    </button>
  );

  // A disabled button gets no pointer events, so the reason's tooltip hangs
  // off a wrapper (the button lets hovers through to it).
  if (disabled && disabledReason && !busy) {
    return (
      <Tooltip label={disabledReason} placement="bottom" align="right" maxWidth={260} className={fullWidth ? styles.fullWidth : undefined}>
        <span className={[styles.disabledWrap, fullWidth ? styles.fullWidth : ''].filter(Boolean).join(' ')}>{button}</span>
      </Tooltip>
    );
  }
  return button;
});

// ── Split-button body ─────────────────────────────────────────────────
// Kept inside Button.jsx (rather than a sibling SplitButton file) so
// callers reach for one API, `<Button menuItems={…} />`, and every
// variant / size / hover / disabled state stays defined in one place.
// Renders two <button>s (main + chevron) inside a wrapper <span>, joined
// by a 1px divider. The main button carries the primary `onClick`; the
// chevron toggles a MenuPopover of secondary actions.
const SplitButtonBody = forwardRef(function SplitButtonBody(
  {
    variant,
    tone,
    size,
    leadingIcon,
    leadingIconElement,
    trailingIcon,
    trailingIconElement,
    disabled,
    fullWidth,
    menuItems,
    onMenuSelect,
    menuAriaLabel,
    menuWidth,
    menuAlign,
    className,
    type,
    busy,
    rest,
    children,
  },
  ref
) {
  const [menuOpen, setMenuOpen] = useState(false);
  const chevronRef = useRef(null);

  const sizeClass = styles[SIZE_CLASS[size]];
  const iconSize = ICON_SIZE[size];
  // Chevron glyph: 14px on sm, 18px on md, 24px on lg, sits slightly larger
  // than the leading icon so the affordance still reads as the dominant hit
  // target on the right half.
  const chevronSize = { sm: 14, md: 18, lg: 24 }[size];
  const iconColor = 'currentColor';

  // Wrapper carries only variant chrome: size lives on the inner halves.
  // Applying `sizeClass` on the wrapper double-paints padding/height and
  // throws off the icon/label alignment; wrapper radius adapts via :has().
  const wrapperCls = [
    styles.splitWrapper,
    styles.toned,
    styles[variant],
    fullWidth ? styles.fullWidth : '',
    className || '',
  ].filter(Boolean).join(' ');

  // The wrapper owns the variant chrome (background, border, radius, color);
  // the two halves are transparent click regions inside it, so the pill reads
  // as one cohesive shape and only paints a hover tint on the hovered half.
  const mainCls = [styles.btn, sizeClass, styles.splitMain, busy ? styles.loading : ''].filter(Boolean).join(' ');
  const chevronCls = [styles.btn, sizeClass, styles.iconOnly, styles.splitChevron]
    .filter(Boolean).join(' ');

  const { onClick, ...restNoClick } = rest || {};
  // If the caller didn't supply a primary onClick, clicking the main half
  // opens the menu too: matching the intent of "the whole pill is one
  // picker trigger" (used by pickers that have no default action). When
  // they DO supply an onClick, classic split-button semantics apply:
  // main runs the primary action, chevron opens the menu.
  const handleMainClick = onClick || (() => setMenuOpen((v) => !v));

  return (
    <span className={wrapperCls} data-tone={tone}>
      <button
        ref={ref}
        type={type}
        className={mainCls}
        disabled={disabled && !busy}
        aria-busy={busy || undefined}
        aria-disabled={busy || undefined}
        onClick={handleMainClick}
        {...restNoClick}
      >
        {busy && <span className={styles.spinnerSlot}><Spinner size={iconSize} /></span>}
        {leadingIconElement && tintIconElement(leadingIconElement)}
        {!leadingIconElement && leadingIcon && (
          <Icon name={leadingIcon} size={iconSize} color={iconColor} className={styles.icon} />
        )}
        {children}
        {trailingIconElement && tintIconElement(trailingIconElement)}
        {!trailingIconElement && trailingIcon && (
          <Icon name={trailingIcon} size={iconSize} color={iconColor} className={styles.icon} />
        )}
      </button>
      <span className={styles.splitDivider} aria-hidden="true" />
      <button
        ref={chevronRef}
        type="button"
        className={chevronCls}
        disabled={disabled}
        onClick={() => setMenuOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={menuAriaLabel}
      >
        <DownChevronIcon size={chevronSize} color="currentColor" />
      </button>
      {menuOpen && (
        <MenuPopover
          anchorRef={chevronRef}
          items={menuItems}
          onSelect={(key, item) => onMenuSelect?.(key, item)}
          onClose={() => setMenuOpen(false)}
          width={menuWidth}
          align={menuAlign}
          ariaLabel={menuAriaLabel}
        />
      )}
    </span>
  );
});
