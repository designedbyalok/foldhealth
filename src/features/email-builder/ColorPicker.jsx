import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Icon } from '../../components/Icon/Icon';
import { Toggle } from '../../components/Toggle/Toggle';
import { Select as SharedSelect } from '../../components/Select/Select';
import {
  isGradient, parseGradient, formatGradient,
  hexToHsv, hsvToHex, hexToRgb, rgbToHex, normalizeHex,
} from './colorHelpers';
import styles from './ColorPicker.module.css';

// ── Saturation/Value square ─────────────────────────────────────────────
// Background is the pure hue (h, 100%, 100%). A white-to-transparent layer
// fades horizontally and a black-to-transparent layer fades vertically so
// the absolute (x, y) of the cursor maps to (s, v) directly.
function SVSquare({ h, s, v, onChange }) {
  const ref = useRef(null);
  const draggingRef = useRef(false);

  const handle = useCallback((clientX, clientY) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
    onChange({ s: x / rect.width, v: 1 - y / rect.height });
  }, [onChange]);

  useEffect(() => {
    const move = (e) => { if (draggingRef.current) handle(e.clientX, e.clientY); };
    const up = () => { draggingRef.current = false; };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [handle]);

  const hueColor = hsvToHex({ h, s: 1, v: 1 });
  return (
    <div
      ref={ref}
      className={styles.svSquare}
      style={{ background: hueColor }}
      onMouseDown={(e) => { draggingRef.current = true; handle(e.clientX, e.clientY); }}
    >
      <div className={styles.svWhite} />
      <div className={styles.svBlack} />
      <div
        className={styles.svPointer}
        style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%` }}
      />
    </div>
  );
}

// ── Hue slider ─────────────────────────────────────────────────────────
function HueSlider({ h, onChange }) {
  const ref = useRef(null);
  const draggingRef = useRef(false);

  const handle = useCallback((clientX) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    onChange((x / rect.width) * 360);
  }, [onChange]);

  useEffect(() => {
    const move = (e) => { if (draggingRef.current) handle(e.clientX); };
    const up = () => { draggingRef.current = false; };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [handle]);

  return (
    <div
      ref={ref}
      className={styles.hueSlider}
      onMouseDown={(e) => { draggingRef.current = true; handle(e.clientX); }}
    >
      <div className={styles.hueThumb} style={{ left: `${(h / 360) * 100}%` }} />
    </div>
  );
}

// EyeDropper button — uses the native EyeDropper API where available
// (Chromium / Edge / Opera). Hidden on browsers that don't support it
// rather than showing a non-functional control.
function EyeDropperBtn({ onPick }) {
  const supported = typeof window !== 'undefined' && 'EyeDropper' in window;
  if (!supported) return null;
  const open = async () => {
    try {
      // eslint-disable-next-line no-undef
      const ed = new window.EyeDropper();
      const { sRGBHex } = await ed.open();
      if (sRGBHex) onPick(sRGBHex.toUpperCase());
    } catch {
      // User cancelled — fine, no-op.
    }
  };
  return (
    <button type="button" className={styles.eyedropperBtn} onClick={open} title="Pick color from screen">
      <Icon name="solar:pipette-linear" size={14} color="var(--neutral-400)" />
    </button>
  );
}

// ── Solid color picker (HSV square + hue + hex/rgb inputs + swatches) ──
function SolidPicker({ value, onChange, variables }) {
  const hex = normalizeHex(value);
  const hsv = useMemo(() => hexToHsv(hex), [hex]);
  const rgb = useMemo(() => hexToRgb(hex), [hex]);
  const [hexDraft, setHexDraft] = useState(hex);

  useEffect(() => { setHexDraft(hex); }, [hex]);

  const commitSV = ({ s, v }) => onChange(hsvToHex({ h: hsv.h, s, v }));
  const commitH = (h) => onChange(hsvToHex({ h, s: hsv.s, v: hsv.v }));
  const commitRgb = (key, n) => {
    const next = { ...rgb, [key]: Number(n) || 0 };
    onChange(rgbToHex(next));
  };
  const commitHex = (raw) => {
    setHexDraft(raw);
    const normalized = normalizeHex(raw);
    if (/^#[0-9A-F]{6}$/.test(normalized)) onChange(normalized);
  };

  return (
    <div className={styles.solidPicker}>
      <SVSquare h={hsv.h} s={hsv.s} v={hsv.v} onChange={commitSV} />
      <HueSlider h={hsv.h} onChange={commitH} />

      <div className={styles.inputsRow}>
        <EyeDropperBtn onPick={onChange} />
        <div className={styles.hexField}>
          <span className={styles.hexHash}>#</span>
          <input
            type="text"
            className={styles.hexInput}
            value={hexDraft.replace('#', '')}
            onChange={(e) => commitHex(e.target.value)}
            maxLength={6}
            spellCheck={false}
          />
        </div>
        <div className={styles.rgbField}>
          <input className={styles.rgbInput} type="text" value={rgb.r} onChange={(e) => commitRgb('r', e.target.value)} />
          <input className={styles.rgbInput} type="text" value={rgb.g} onChange={(e) => commitRgb('g', e.target.value)} />
          <input className={styles.rgbInput} type="text" value={rgb.b} onChange={(e) => commitRgb('b', e.target.value)} />
        </div>
      </div>

      {variables && variables.length > 0 && (
        <>
          <div className={styles.sectionLabel}>Variables</div>
          <div className={styles.swatchGrid}>
            {variables.map(cv => (
              <button
                key={cv.name}
                type="button"
                className={styles.swatch}
                title={`${cv.name} (${cv.hex})`}
                onClick={() => onChange(cv.hex)}
                style={{ background: cv.hex }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Gradient picker (stops list + type + angle) ────────────────────────
const DEFAULT_GRADIENT = { type: 'linear', angle: 90, stops: [
  { color: '#FFFFFF', position: 0 },
  { color: '#999999', position: 100 },
]};

function GradientPicker({ value, onChange, variables }) {
  const initial = useMemo(() => parseGradient(value) || DEFAULT_GRADIENT, [value]);
  const [grad, setGrad] = useState(initial);
  const [activeStop, setActiveStop] = useState(0);

  // Re-sync when the outer value changes (e.g. user pasted a gradient string).
  useEffect(() => {
    const parsed = parseGradient(value);
    if (parsed) setGrad(parsed);
  }, [value]);

  const emit = (next) => {
    setGrad(next);
    onChange(formatGradient(next));
  };

  const updateStop = (idx, patch) => {
    const stops = grad.stops.map((s, i) => i === idx ? { ...s, ...patch } : s);
    emit({ ...grad, stops });
  };

  const addStop = () => {
    const sorted = [...grad.stops].sort((a, b) => a.position - b.position);
    let pos = 50;
    if (sorted.length >= 2) {
      // Insert in the largest gap so stops spread out naturally.
      let bestGap = 0, bestPos = 50;
      for (let i = 0; i < sorted.length - 1; i++) {
        const gap = sorted[i + 1].position - sorted[i].position;
        if (gap > bestGap) {
          bestGap = gap;
          bestPos = sorted[i].position + gap / 2;
        }
      }
      pos = Math.round(bestPos);
    }
    const stops = [...grad.stops, { color: '#888888', position: pos }];
    emit({ ...grad, stops });
    setActiveStop(stops.length - 1);
  };

  const removeStop = (idx) => {
    if (grad.stops.length <= 2) return;
    const stops = grad.stops.filter((_, i) => i !== idx);
    emit({ ...grad, stops });
    if (activeStop >= stops.length) setActiveStop(stops.length - 1);
  };

  const reverseStops = () => {
    const stops = grad.stops.map(s => ({ ...s, position: 100 - s.position }));
    emit({ ...grad, stops });
  };

  const previewCss = formatGradient(grad);
  const active = grad.stops[activeStop] || grad.stops[0];

  return (
    <div className={styles.gradientPicker}>
      <div className={styles.gradientHeader}>
        <SharedSelect
          options={[
            { value: 'linear', label: 'Linear' },
            { value: 'radial', label: 'Radial' },
          ]}
          value={grad.type}
          onChange={(v) => emit({ ...grad, type: v })}
        />
        <button
          type="button"
          className={styles.iconBtn}
          title="Reverse stops"
          onClick={reverseStops}
        >
          <Icon name="solar:transfer-horizontal-linear" size={14} color="var(--neutral-400)" />
        </button>
      </div>

      <div className={styles.gradientPreview} style={{ background: previewCss }} />

      {grad.type === 'linear' && (
        <div className={styles.angleRow}>
          <span className={styles.fieldLabel}>Angle</span>
          <input
            type="range"
            min={0}
            max={360}
            value={grad.angle}
            onChange={(e) => emit({ ...grad, angle: Number(e.target.value) })}
            className={styles.angleSlider}
          />
          <span className={styles.angleValue}>{grad.angle}°</span>
        </div>
      )}

      <div className={styles.stopsHeader}>
        <span className={styles.sectionLabel}>Stops</span>
        <button type="button" className={styles.iconBtn} title="Add stop" onClick={addStop}>
          <Icon name="solar:add-circle-linear" size={14} color="var(--primary-300)" />
        </button>
      </div>

      <div className={styles.stopsList}>
        {grad.stops.map((s, idx) => (
          <div
            key={idx}
            className={[styles.stopRow, idx === activeStop ? styles.stopRowActive : ''].join(' ')}
            onClick={() => setActiveStop(idx)}
          >
            <input
              className={styles.stopPosInput}
              type="text"
              value={Math.round(s.position)}
              onChange={(e) => updateStop(idx, { position: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
              onClick={(e) => e.stopPropagation()}
            />
            <span className={styles.stopPosSuffix}>%</span>
            <div className={styles.stopColorChip} style={{ background: s.color }} />
            <input
              className={styles.stopHexInput}
              type="text"
              value={s.color.replace('#', '').toUpperCase()}
              onChange={(e) => updateStop(idx, { color: normalizeHex(e.target.value) })}
              onClick={(e) => e.stopPropagation()}
              maxLength={6}
            />
            <button
              type="button"
              className={styles.stopRemove}
              title={grad.stops.length <= 2 ? 'At least 2 stops required' : 'Remove stop'}
              disabled={grad.stops.length <= 2}
              onClick={(e) => { e.stopPropagation(); removeStop(idx); }}
            >
              <Icon name="solar:minus-circle-linear" size={12} color="currentColor" />
            </button>
          </div>
        ))}
      </div>

      {/* The active stop's color is edited via the inline Solid picker
          below. We hide the variables grid here to keep the gradient
          popover compact — variables stay accessible in solid mode. */}
      <div className={styles.activeStopWrap}>
        <SolidPicker
          value={active.color}
          onChange={(hex) => updateStop(activeStop, { color: hex })}
          variables={[]}
        />
      </div>
    </div>
  );
}

// ── Top-level ColorPicker — mode toggle + popover frame ────────────────
// Close behavior is owned by the host (ColorInput's outside-click handler).
// We don't render a close button here so the chrome stays minimal.
export function ColorPicker({ value, onChange, variables = [], allowGradient = true }) {
  const initialMode = isGradient(value) ? 'gradient' : 'solid';
  const [mode, setMode] = useState(initialMode);

  const setModeWithConvert = (next) => {
    if (next === mode) return;
    if (next === 'gradient' && !isGradient(value)) {
      onChange(formatGradient({
        type: 'linear', angle: 90,
        stops: [{ color: normalizeHex(value), position: 0 }, { color: '#FFFFFF', position: 100 }],
      }));
    } else if (next === 'solid' && isGradient(value)) {
      const g = parseGradient(value);
      onChange(g?.stops?.[0]?.color || '#000000');
    }
    setMode(next);
  };

  return (
    <div className={styles.popover} onMouseDown={(e) => e.stopPropagation()}>
      {allowGradient && (
        <Toggle
          fullWidth
          size="S"
          items={[
            { key: 'solid',    label: 'Solid' },
            { key: 'gradient', label: 'Gradient' },
          ]}
          active={mode}
          onChange={setModeWithConvert}
        />
      )}
      {mode === 'solid' ? (
        <SolidPicker value={value} onChange={onChange} variables={variables} />
      ) : (
        <GradientPicker value={value} onChange={onChange} variables={variables} />
      )}
    </div>
  );
}
