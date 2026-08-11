import { useState, useEffect, useRef, useLayoutEffect, useId, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../store/useAppStore';
import { ColorPicker } from './ColorPicker';
import { isGradient } from './colorHelpers';
import styles from './EmailBuilder.module.css';

/**
 * Color field — a swatch dot + hex input that opens the full ColorPicker
 * popover (solid/gradient, hue, hex, brand variables, recent). Shared by the
 * email-builder Properties panel and the form-builder settings.
 */
// Must match the popover's transition duration (--duration-fast) — the node
// stays mounted this long after close so it can animate out.
const EXIT_MS = 160;

export function ColorInput({ label, value, onChange, allowGradient = true }) {
  const hexId = useId();
  const colorVariables = useAppStore(s => s.colorVariables);
  const recentlyUsedColors = useAppStore(s => s.recentlyUsedColors);
  const pushRecentColor = useAppStore(s => s.pushRecentColor);
  // `mounted` keeps the popover in the DOM for the length of the exit
  // transition; `shown` is the flag the CSS transitions against.
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);
  const fieldRef = useRef(null);
  const popoverRef = useRef(null);
  const rafRef = useRef(0);
  const exitRef = useRef(0);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0, placement: 'bottom' });
  const v = value || '#FFFFFF';
  const isGrad = isGradient(v);
  const displayText = isGrad ? 'Gradient' : (typeof v === 'string' ? v.toUpperCase() : '');

  // Mount, then flip `shown` a frame later so the entrance transition has a
  // from-state to run from. Re-opening mid-exit cancels the pending unmount,
  // which is what makes the animation interruptible.
  const openPicker = () => {
    clearTimeout(exitRef.current);
    cancelAnimationFrame(rafRef.current);
    setMounted(true);
    rafRef.current = requestAnimationFrame(() => setShown(true));
  };
  const closePicker = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    clearTimeout(exitRef.current);
    setShown(false);
    exitRef.current = setTimeout(() => setMounted(false), EXIT_MS);
  }, []);

  // Both handles outlive the handler that created them, so unmount clears them.
  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    clearTimeout(exitRef.current);
  }, []);

  useLayoutEffect(() => {
    if (!mounted || !fieldRef.current) return;
    const update = () => {
      const r = fieldRef.current?.getBoundingClientRect();
      if (!r) return;
      const popoverWidth = 264;
      const popoverMaxH = Math.min(window.innerHeight - 16, 720);
      const margin = 8;
      let left = r.right - popoverWidth;
      if (left < margin) left = Math.min(r.left, window.innerWidth - popoverWidth - margin);
      left = Math.max(margin, Math.min(left, window.innerWidth - popoverWidth - margin));
      const spaceBelow = window.innerHeight - r.bottom - margin;
      const spaceAbove = r.top - margin;
      let top;
      // Placement also drives the popover's transform-origin, so it grows out
      // of the edge of the field it belongs to.
      let placement = 'bottom';
      if (spaceBelow >= 200 || spaceBelow >= spaceAbove) {
        top = r.bottom + 4;
      } else {
        top = Math.max(margin, r.top - 4 - popoverMaxH);
        placement = 'top';
      }
      top = Math.max(margin, Math.min(top, window.innerHeight - margin - 40));
      setPopoverPos({ top, left, placement });
    };
    update();
    const raf = requestAnimationFrame(update);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    const ro = new ResizeObserver(update);
    ro.observe(fieldRef.current);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      ro.disconnect();
    };
  }, [mounted]);

  useEffect(() => {
    if (!shown) return undefined;
    const handler = (e) => {
      if (fieldRef.current?.contains(e.target)) return;
      if (popoverRef.current?.contains(e.target)) return;
      closePicker();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [shown, closePicker]);

  return (
    <div className={styles.fieldCol} ref={fieldRef}>
      {label && <label className={styles.fieldLabel} htmlFor={hexId}>{label}</label>}
      <div className={styles.colorInputWrap}>
        <button
          type="button"
          className={styles.colorDotBtn}
          onClick={() => (shown ? closePicker() : openPicker())}
          aria-label="Open color picker"
        >
          <span
            className={styles.colorDot}
            style={{
              background: v,
              borderColor: !isGrad && typeof v === 'string' && v.toLowerCase() === '#ffffff' ? '#CED4DD' : (isGrad ? 'transparent' : v),
            }}
          />
        </button>
        <input
          id={hexId}
          type="text"
          className={styles.colorHex}
          value={displayText}
          onChange={e => { if (!isGrad) onChange(e.target.value); }}
          readOnly={isGrad}
        />
      </div>
      {mounted && createPortal(
        <div
          ref={popoverRef}
          className={[styles.colorPickerPortal, shown ? styles.colorPickerPortalOpen : ''].join(' ')}
          style={{ top: popoverPos.top, left: popoverPos.left }}
          data-placement={popoverPos.placement}
        >
          <ColorPicker
            value={v}
            onChange={onChange}
            variables={colorVariables}
            recentlyUsed={recentlyUsedColors}
            onCommitRecent={pushRecentColor}
            allowGradient={allowGradient}
            onClose={closePicker}
          />
        </div>,
        document.body,
      )}
    </div>
  );
}
