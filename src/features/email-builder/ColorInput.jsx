import { useState, useEffect, useRef, useLayoutEffect, useId } from 'react';
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
export function ColorInput({ label, value, onChange, allowGradient = true }) {
  const hexId = useId();
  const colorVariables = useAppStore(s => s.colorVariables);
  const recentlyUsedColors = useAppStore(s => s.recentlyUsedColors);
  const pushRecentColor = useAppStore(s => s.pushRecentColor);
  const [open, setOpen] = useState(false);
  const fieldRef = useRef(null);
  const popoverRef = useRef(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
  const v = value || '#FFFFFF';
  const isGrad = isGradient(v);
  const displayText = isGrad ? 'Gradient' : (typeof v === 'string' ? v.toUpperCase() : '');

  useLayoutEffect(() => {
    if (!open || !fieldRef.current) return;
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
      if (spaceBelow >= 200 || spaceBelow >= spaceAbove) {
        top = r.bottom + 4;
      } else {
        top = Math.max(margin, r.top - 4 - popoverMaxH);
      }
      top = Math.max(margin, Math.min(top, window.innerHeight - margin - 40));
      setPopoverPos({ top, left });
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
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (fieldRef.current?.contains(e.target)) return;
      if (popoverRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className={styles.fieldCol} ref={fieldRef}>
      {label && <label className={styles.fieldLabel} htmlFor={hexId}>{label}</label>}
      <div className={styles.colorInputWrap}>
        <button
          type="button"
          className={styles.colorDotBtn}
          onClick={() => setOpen(o => !o)}
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
      {open && createPortal(
        <div
          ref={popoverRef}
          className={styles.colorPickerPortal}
          style={{ top: popoverPos.top, left: popoverPos.left }}
        >
          <ColorPicker
            value={v}
            onChange={onChange}
            variables={colorVariables}
            recentlyUsed={recentlyUsedColors}
            onCommitRecent={pushRecentColor}
            allowGradient={allowGradient}
            onClose={() => setOpen(false)}
          />
        </div>,
        document.body,
      )}
    </div>
  );
}
