import { createContext, forwardRef, useContext, useId, useState } from 'react';
import styles from './Collapsible.module.css';

const CollapsibleContext = createContext(null);

/**
 * Collapsible: a region that folds away, in parts (as in Radix):
 *
 *   <Collapsible defaultOpen>
 *     <CollapsibleTrigger>Details</CollapsibleTrigger>
 *     <CollapsibleContent>…</CollapsibleContent>
 *   </Collapsible>
 *
 * The root owns the open state (`open` / `defaultOpen` / `onOpenChange`), the
 * trigger is a button wired with `aria-expanded` / `aria-controls`, and the
 * content eases its height open and shut. When the control lives elsewhere
 * (a row's chevron, a toggle in another column), use `CollapsibleContent` on
 * its own and pass `open` to it.
 *
 * @param {object}   props
 * @param {boolean}  [props.open]          – Controlled
 * @param {boolean}  [props.defaultOpen=false] – Uncontrolled starting state
 * @param {(open: boolean) => void} [props.onOpenChange]
 * @param {boolean}  [props.disabled]      – The trigger does nothing
 */
export const Collapsible = forwardRef(function Collapsible(
  { open: openProp, defaultOpen = false, onOpenChange, disabled = false, children, ...rest },
  ref,
) {
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const open = openProp ?? uncontrolled;
  const contentId = useId();
  const setOpen = (next) => {
    if (openProp === undefined) setUncontrolled(next);
    onOpenChange?.(next);
  };
  return (
    <CollapsibleContext.Provider value={{ open, setOpen, disabled, contentId }}>
      <div ref={ref} data-state={open ? 'open' : 'closed'} data-disabled={disabled || undefined} {...rest}>
        {children}
      </div>
    </CollapsibleContext.Provider>
  );
});

/** The button that opens and closes its `Collapsible`. */
export const CollapsibleTrigger = forwardRef(function CollapsibleTrigger({ onClick, children, ...rest }, ref) {
  const ctx = useContext(CollapsibleContext);
  if (!ctx) throw new Error('CollapsibleTrigger must sit inside a Collapsible.');
  return (
    <button
      ref={ref}
      type="button"
      aria-expanded={ctx.open}
      aria-controls={ctx.contentId}
      data-state={ctx.open ? 'open' : 'closed'}
      disabled={ctx.disabled}
      {...rest}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) ctx.setOpen(!ctx.open);
      }}
    >
      {children}
    </button>
  );
});

/**
 * The folding region. Stays mounted; while shut it's inert, so it can't be
 * tabbed into.
 *
 * @param {boolean} [props.open] – Only when used without a `Collapsible`
 */
export const CollapsibleContent = forwardRef(function CollapsibleContent(
  { open: openProp, className, children, ...rest },
  ref,
) {
  const ctx = useContext(CollapsibleContext);
  const open = ctx ? ctx.open : Boolean(openProp);
  // Clipped while the height animates, then let out once fully open, so
  // dropdowns and popovers inside aren't cut off at the edge.
  const [settled, setSettled] = useState(open);
  const onTransitionEnd = (e) => {
    if (e.target === e.currentTarget && e.propertyName === 'grid-template-rows') setSettled(open);
  };
  return (
    <div
      ref={ref}
      id={ctx?.contentId}
      data-state={open ? 'open' : 'closed'}
      className={[styles.outer, open ? styles.open : '', open && settled ? styles.settled : '', className || ''].filter(Boolean).join(' ')}
      inert={!open}
      onTransitionEnd={onTransitionEnd}
      {...rest}
    >
      <div className={styles.inner}>{children}</div>
    </div>
  );
});
