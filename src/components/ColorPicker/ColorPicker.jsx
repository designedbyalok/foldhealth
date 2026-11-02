import { useRef, useState } from 'react';
import { Popover } from '../Popover/Popover';
import { hexToRgb, rgbToHex, rgbToHsv, hsvToRgb, normaliseHex } from './colorMath';
import styles from './ColorPicker.module.css';

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
// Hue strip: red → yellow → green → cyan → blue → magenta → red.
const HUE_STRIP = `linear-gradient(to right, ${[0, 60, 120, 180, 240, 300, 360].map(h => `hsl(${h} 100% 50%)`).join(', ')})`;

// Drag inside an element: calls onMove with the pointer's 0–1 position.
function useDrag(onMove) {
  const ref = useRef(null);
  const at = (e) => {
    const r = ref.current.getBoundingClientRect();
    onMove(clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1));
  };
  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    at(e);
  };
  const onPointerMove = (e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) at(e); };
  return { ref, onPointerDown, onPointerMove };
}

/**
 * ColorPicker (Figma Mar-Present 2026 215:25): suggested colours, then a
 * saturation / brightness square, a hue strip, and the colour as hex and
 * R / G / B. The colour is data (what the person picked), so it's applied
 * inline.
 *
 * @param {string}   props.value      – "#RRGGBB"
 * @param {function} props.onChange   – called with a "#RRGGBB"
 * @param {{value: string, label: string}[]} [props.suggestions] – swatches on top
 */
export function ColorPicker({ value, onChange, suggestions = [] }) {
  const rgb = hexToRgb(value) || { r: 0, g: 0, b: 0 };
  // Hue is kept separately so it survives greys and black, where it can't be read back.
  const [hue, setHue] = useState(() => rgbToHsv(rgb).h);
  const [shownFor, setShownFor] = useState(value);
  const [hexText, setHexText] = useState(value || '');
  if (value !== shownFor) {
    setShownFor(value);
    setHexText(value || '');
    const next = rgbToHsv(rgb);
    if (next.s > 0 && next.v > 0) setHue(next.h);
  }
  const { s, v } = rgbToHsv(rgb);

  const emit = (hsv) => onChange?.(rgbToHex(hsvToRgb(hsv)));
  const square = useDrag((x, y) => emit({ h: hue, s: x, v: 1 - y }));
  const strip = useDrag((x) => { const h = x * 359.9; setHue(h); emit({ h, s, v }); });

  const setChannel = (key, text) => {
    const n = clamp(Number(text.replace(/\D/g, '')) || 0, 0, 255);
    onChange?.(rgbToHex({ ...rgb, [key]: n }));
  };
  const commitHex = (text) => {
    setHexText(text);
    const hex = normaliseHex(text);
    if (hex) onChange?.(hex);
  };

  return (
    <div className={styles.picker}>
      {suggestions.length > 0 && (
        <>
          <span className={styles.label}>Suggested Colors</span>
          <div className={styles.swatches}>
            {suggestions.map(c => (
              <button
                key={c.value}
                type="button"
                className={[styles.swatch, c.value.toUpperCase() === (value || '').toUpperCase() ? styles.swatchOn : ''].filter(Boolean).join(' ')}
                style={{ background: c.value }}
                aria-label={c.label}
                title={c.label}
                onClick={() => onChange?.(c.value.toUpperCase())}
              />
            ))}
          </div>
          <span className={styles.divider} />
          <span className={styles.label}>or select a color below:</span>
        </>
      )}
      <div
        {...square}
        className={styles.square}
        style={{ background: `hsl(${hue} 100% 50%)` }}
        role="slider"
        aria-label="Saturation and brightness"
        aria-valuetext={`${Math.round(s * 100)}% saturation, ${Math.round(v * 100)}% brightness`}
      >
        <span className={styles.squareWhite} />
        <span className={styles.squareBlack} />
        <span className={styles.thumb} style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%` }} />
      </div>
      <div
        {...strip}
        className={styles.strip}
        style={{ background: HUE_STRIP }}
        role="slider"
        aria-label="Hue"
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(hue)}
      >
        <span className={styles.stripThumb} style={{ left: `${(hue / 360) * 100}%` }} />
      </div>
      <div className={styles.values}>
        <label className={styles.valueGroup}>
          <input
            className={`${styles.valueBox} ${styles.hexBox}`}
            value={hexText}
            onChange={e => commitHex(e.target.value)}
            onBlur={() => setHexText(value || '')}
            aria-label="Hex"
            spellCheck={false}
          />
          <span className={styles.caption}>Hex</span>
        </label>
        <div className={styles.valueGroup}>
          <span className={styles.rgb}>
            {['r', 'g', 'b'].map(k => (
              <input
                key={k}
                className={`${styles.valueBox} ${styles.channelBox}`}
                value={Math.round(rgb[k])}
                inputMode="numeric"
                onChange={e => setChannel(k, e.target.value)}
                aria-label={k.toUpperCase()}
              />
            ))}
          </span>
          <span className={`${styles.caption} ${styles.rgbCaption}`}><span>R</span><span>G</span><span>B</span></span>
        </div>
      </div>
    </div>
  );
}

/**
 * A round colour dot that opens the ColorPicker in a popover. Sized to sit
 * inside a field (Input's `trailingElement`).
 */
export function ColorDotButton({ value, onChange, suggestions, ariaLabel = 'Pick a color' }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        ref={ref}
        type="button"
        className={styles.dot}
        style={{ background: value }}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      />
      {open && (
        <Popover anchor={ref} onOpenChange={setOpen} placement="bottom-end" width={248} overlay={false}>
          <ColorPicker value={value} onChange={onChange} suggestions={suggestions} />
        </Popover>
      )}
    </>
  );
}
