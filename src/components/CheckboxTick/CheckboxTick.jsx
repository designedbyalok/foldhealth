import styles from './CheckboxTick.module.css';

/**
 * Fold Health CheckboxTick — the *look* of a checkbox with none of the
 * behaviour. Purely decorative and always `aria-hidden`.
 *
 * Use it inside a control that already owns the interaction (a menu item
 * `<button role="menuitemcheckbox">`, a `role="checkbox"` row). Putting a real
 * `<input type="checkbox">` there nests one control inside another, which is
 * invalid HTML and leaves the inner box unlabelled — screen readers announce a
 * nameless checkbox next to the row they just read.
 *
 * The enclosing control must carry `aria-checked`; this only paints the state.
 * Styling mirrors the global `input[type="checkbox"]` rule in src/index.css.
 *
 * Props:
 *  - checked (boolean)  Filled + ticked when true.
 *  - size    (number)   Box edge in px. Default 16, the Fold Pixel size.
 */
export function CheckboxTick({ checked = false, size = 16 }) {
  return (
    <span
      aria-hidden="true"
      className={`${styles.tick} ${checked ? styles.tickChecked : ''}`}
      style={{ width: size, height: size }}
    />
  );
}
