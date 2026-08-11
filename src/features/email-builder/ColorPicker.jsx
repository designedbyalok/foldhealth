import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Icon } from '../../components/Icon/Icon';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Toggle } from '../../components/Toggle/Toggle';
import { Select as SharedSelect } from '../../components/Select/Select';
import { Slider } from '../../components/ShadcnSlider/ShadcnSlider';
import {
  isGradient, parseGradient, formatGradient,
  hexToHsv, hsvToHex, normalizeHex,
  splitAlpha, withAlpha, formatColor, parseColor, COLOR_MODES,
} from './colorHelpers';
import styles from './ColorPicker.module.css';

// Arrow-key nudging for the numeric controls: ±1, or ±10 with Shift held.
// `axis: 'vertical'` claims only Up/Down, so text fields keep Left/Right for
// caret movement; 'both' also takes Left/Right for slider-style controls.
// preventDefault doubles as the signal to Radix's own key handling to stand
// down, so a Shift+Arrow is one ±10 step rather than ±10 plus its own ±1.
function nudgeOnArrow(e, current, min, max, apply, axis = 'vertical') {
  const up = e.key === 'ArrowUp' || (axis === 'both' && e.key === 'ArrowRight');
  const down = e.key === 'ArrowDown' || (axis === 'both' && e.key === 'ArrowLeft');
  if (!up && !down) return false;
  e.preventDefault();
  const step = e.shiftKey ? 10 : 1;
  apply(Math.max(min, Math.min(max, current + (up ? step : -step))));
  return true;
}

// ── Saturation/Value square ─────────────────────────────────────────────
// Background is the pure hue (h, 100%, 100%). A white-to-transparent layer
// fades horizontally and a black-to-transparent layer fades vertically so
// the absolute (x, y) of the cursor maps to (s, v) directly.
function SVSquare({ h, s, v, onChange }) {
  const ref = useRef(null);
  const draggingRef = useRef(false);
  // Mirrors draggingRef in state purely so CSS can drop the pointer's
  // position transition mid-drag — a tweened pointer lags the cursor.
  const [dragging, setDragging] = useState(false);

  const handle = useCallback((clientX, clientY) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
    onChange({ s: x / rect.width, v: 1 - y / rect.height });
  }, [onChange]);

  useEffect(() => {
    const move = (e) => { if (draggingRef.current) handle(e.clientX, e.clientY); };
    const up = () => { draggingRef.current = false; setDragging(false); };
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
      className={[styles.svSquare, dragging ? styles.dragging : ''].join(' ')}
      style={{ background: hueColor }}
      onMouseDown={(e) => { draggingRef.current = true; setDragging(true); handle(e.clientX, e.clientY); }}
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

// ── Ramp slider — the hue and opacity tracks ────────────────────────────
// Both are drag-along-a-painted-ramp controls, so they share one component.
// The shared `Slider` can't back these: their track has to render a hue ramp
// or a checkerboard-backed alpha ramp, and its thumb carries the live color.
// Works on a 0–1 fraction; the caller maps that onto its own range.
function RampSlider({ fraction, onChange, trackClass, trackStyle, thumbColor, label, valueText }) {
  const ref = useRef(null);
  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  const handle = useCallback((clientX) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    onChange(x / rect.width);
  }, [onChange]);

  useEffect(() => {
    const move = (e) => { if (draggingRef.current) handle(e.clientX); };
    const up = () => { draggingRef.current = false; setDragging(false); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [handle]);

  // Arrow keys walk the ramp in 1% steps, 10% with Shift — same contract as
  // the numeric fields.
  const onKeyDown = (e) => {
    const up = e.key === 'ArrowUp' || e.key === 'ArrowRight';
    const down = e.key === 'ArrowDown' || e.key === 'ArrowLeft';
    if (!up && !down) return;
    e.preventDefault();
    const step = (e.shiftKey ? 0.1 : 0.01) * (up ? 1 : -1);
    onChange(Math.max(0, Math.min(1, fraction + step)));
  };

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(fraction * 100)}
      aria-valuetext={valueText}
      className={[styles.ramp, trackClass, dragging ? styles.dragging : ''].join(' ')}
      style={trackStyle}
      onMouseDown={(e) => { draggingRef.current = true; setDragging(true); handle(e.clientX); }}
      onKeyDown={onKeyDown}
    >
      <div
        className={styles.rampThumb}
        style={{ left: `${fraction * 100}%`, background: thumbColor }}
      />
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

// ── Solid color picker ─────────────────────────────────────────────────
// SV square → hue + opacity ramps → mode select / value / opacity → swatches.
function SolidPicker({ value, onChange, variables, recentlyUsed, mode, onModeChange }) {
  const { hex, alpha } = useMemo(() => splitAlpha(value), [value]);
  const hsv = useMemo(() => hexToHsv(hex), [hex]);
  const formatted = formatColor(hex, alpha, mode);
  // The field holds a draft while it's being typed — half-finished text must
  // not round-trip through the parser and fight the keystrokes. `from` records
  // the value the draft produced, so a color arriving from anywhere else (a
  // swatch, the ramps, the eyedropper) drops the draft instead of masking it.
  const [draft, setDraft] = useState(null);
  const shownValue = draft && draft.from === value ? draft.text : formatted;

  const emit = (nextHex, nextAlpha = alpha) => onChange(withAlpha(nextHex, nextAlpha));
  const commitSV = ({ s, v }) => emit(hsvToHex({ h: hsv.h, s, v }));
  const commitHue = (fraction) => emit(hsvToHex({ h: fraction * 360, s: hsv.s, v: hsv.v }));
  const commitAlpha = (nextAlpha) => emit(hex, Math.max(0, Math.min(1, nextAlpha)));

  // A swatch is a color choice, not an opacity choice — the current opacity
  // survives unless the swatch itself carries one.
  const pickSwatch = (swatchColor) => {
    const digits = String(swatchColor).trim().replace(/^#/, '');
    const s = splitAlpha(swatchColor);
    emit(s.hex, digits.length === 8 || digits.length === 4 ? s.alpha : alpha);
  };

  const commitText = (raw) => {
    const parsed = parseColor(raw, mode);
    const next = parsed ? withAlpha(parsed.hex, parsed.alpha ?? alpha) : value;
    setDraft({ text: raw, from: next });
    if (parsed) onChange(next);
  };
  const alphaPct = Math.round(alpha * 100);

  return (
    <div className={styles.solidPicker}>
      <SVSquare h={hsv.h} s={hsv.s} v={hsv.v} onChange={commitSV} />

      <div className={styles.rampsRow}>
        <EyeDropperBtn onPick={(picked) => emit(picked)} />
        <div className={styles.rampsCol}>
          <RampSlider
            label="Hue"
            fraction={hsv.h / 360}
            valueText={`${Math.round(hsv.h)}°`}
            onChange={commitHue}
            trackClass={styles.hueTrack}
            thumbColor={hsvToHex({ h: hsv.h, s: 1, v: 1 })}
          />
          <RampSlider
            label="Opacity"
            fraction={alpha}
            valueText={`${alphaPct}%`}
            onChange={commitAlpha}
            trackClass={styles.alphaTrack}
            trackStyle={{ '--ramp-to': hex }}
            thumbColor={withAlpha(hex, alpha)}
          />
        </div>
      </div>

      <div className={styles.valueRow}>
        <SharedSelect
          className={styles.modeSelect}
          options={COLOR_MODES}
          value={mode}
          onChange={(next) => { setDraft(null); onModeChange(next); }}
          aria-label="Color mode"
        />
        <input
          type="text"
          aria-label={`Color value (${mode.toUpperCase()})`}
          className={styles.valueInput}
          value={shownValue}
          onChange={(e) => commitText(e.target.value)}
          onBlur={() => setDraft(null)}
          spellCheck={false}
        />
        <div className={styles.alphaField}>
          <input
            type="text"
            aria-label="Opacity, percent"
            className={styles.alphaInput}
            value={alphaPct}
            onChange={(e) => commitAlpha((Number(e.target.value.replace(/[^\d]/g, '')) || 0) / 100)}
            onKeyDown={(e) => nudgeOnArrow(e, alphaPct, 0, 100, (next) => commitAlpha(next / 100))}
          />
          <span className={styles.alphaSuffix}>%</span>
        </div>
      </div>

      {recentlyUsed && recentlyUsed.length > 0 && (
        <div className={styles.swatchSection}>
          <div className={styles.sectionLabel}>Recently used</div>
          <div className={styles.swatchGrid}>
            {recentlyUsed.map((hexStr, i) => (
              <button
                key={`${hexStr}-${i}`}
                type="button"
                className={styles.swatch}
                title={hexStr}
                onClick={() => pickSwatch(hexStr)}
                style={{ background: hexStr }}
              />
            ))}
          </div>
        </div>
      )}

      {variables && variables.length > 0 && (
        <div className={styles.swatchSection}>
          <div className={styles.sectionLabel}>Variables</div>
          <div className={styles.swatchGrid}>
            {variables.map(cv => (
              <button
                key={cv.name}
                type="button"
                className={styles.swatch}
                title={`${cv.name} (${cv.hex})`}
                onClick={() => pickSwatch(cv.hex)}
                style={{ background: cv.hex }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Gradient picker (stops list + type + angle) ────────────────────────
const DEFAULT_GRADIENT = { type: 'linear', angle: 90, stops: [
  { color: '#FFFFFF', position: 0 },
  { color: '#999999', position: 100 },
]};

function GradientPicker({ value, onChange, variables, mode, onModeChange }) {
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
    const sorted = grad.stops.toSorted((a, b) => a.position - b.position);
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
        <ActionButton
          icon="solar:transfer-horizontal-linear"
          size="S"
          tooltip="Reverse stops"
          onClick={reverseStops}
        />
      </div>

      <div className={styles.gradientPreview} style={{ background: previewCss }} />

      {grad.type === 'linear' && (
        <div className={styles.angleRow}>
          <span className={styles.fieldLabel}>Angle</span>
          {/* Radix handles plain arrows at step=1; Shift+Arrow is ours. */}
          <Slider
            aria-label="Gradient angle in degrees"
            className={styles.angleSlider}
            min={0}
            max={360}
            step={1}
            value={[grad.angle]}
            onValueChange={([angle]) => emit({ ...grad, angle })}
            onKeyDown={(e) => {
              if (!e.shiftKey) return;
              nudgeOnArrow(e, grad.angle, 0, 360, (angle) => emit({ ...grad, angle }), 'both');
            }}
          />
          <span className={styles.angleValue}>{grad.angle}°</span>
        </div>
      )}

      <div className={styles.stopsHeader}>
        <span className={styles.sectionLabel}>Stops</span>
        <ActionButton icon="solar:add-circle-linear" size="S" tooltip="Add stop" onClick={addStop} />
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
              aria-label="Gradient stop position, percent"
              value={Math.round(s.position)}
              onChange={(e) => updateStop(idx, { position: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
              onKeyDown={(e) => nudgeOnArrow(e, Math.round(s.position), 0, 100, (position) => updateStop(idx, { position }))}
              onClick={(e) => e.stopPropagation()}
            />
            <span className={styles.stopPosSuffix}>%</span>
            <div className={styles.stopColorChip} style={{ background: s.color }} />
            <input
              className={styles.stopHexInput}
              type="text"
              aria-label="Gradient stop hex color"
              value={s.color.replace('#', '').toUpperCase()}
              onChange={(e) => {
                // 8 chars so a stop that carries opacity survives a round trip
                // through this field.
                const { hex: stopHex, alpha: stopAlpha } = splitAlpha(e.target.value);
                updateStop(idx, { color: withAlpha(stopHex, stopAlpha) });
              }}
              onClick={(e) => e.stopPropagation()}
              maxLength={8}
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
          mode={mode}
          onModeChange={onModeChange}
        />
      </div>
    </div>
  );
}

// ── Top-level ColorPicker — mode toggle + popover frame ────────────────
// Close behavior is owned by the host (ColorInput's outside-click handler).
// We don't render a close button here so the chrome stays minimal.
export function ColorPicker({ value, onChange, variables = [], recentlyUsed = [], onCommitRecent, allowGradient = true }) {
  const initialMode = isGradient(value) ? 'gradient' : 'solid';
  const [mode, setMode] = useState(initialMode);
  // How the value field reads and accepts colors. A display preference, not
  // part of the value — the stored color is always a hex.
  const [colorMode, setColorMode] = useState('hex');

  // Free drag by the grip. The offset is a transform on top of whatever
  // position the host gave us, so it composes with ColorInput's anchoring
  // instead of fighting it.
  const popoverRef = useRef(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef(null);

  const startDrag = (e) => {
    const el = popoverRef.current;
    if (!el || e.button !== 0) return;
    const rect = el.getBoundingClientRect();
    dragRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      // Where the popover sits with the current offset backed out.
      baseX: rect.left - offset.x,
      baseY: rect.top - offset.y,
      width: rect.width,
      height: rect.height,
    };
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return undefined;
    const MARGIN = 8;
    const move = (e) => {
      const d = dragRef.current;
      if (!d) return;
      // Clamp against the viewport so the picker can't be parked off-screen.
      const maxX = window.innerWidth - MARGIN - d.width;
      const maxY = window.innerHeight - MARGIN - d.height;
      const nextLeft = Math.max(MARGIN, Math.min(maxX, d.baseX + e.clientX - d.pointerX));
      const nextTop = Math.max(MARGIN, Math.min(maxY, d.baseY + e.clientY - d.pointerY));
      setOffset({ x: nextLeft - d.baseX, y: nextTop - d.baseY });
    };
    const up = () => setDragging(false);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [dragging]);

  // Wrap the host onChange so every solid commit feeds the Recently-used
  // MRU list. Gradient commits skip (a gradient string isn't a single hex).
  const handleChange = (next) => {
    onChange(next);
    if (typeof next === 'string' && /^#[0-9A-Fa-f]{6}$/.test(next) && onCommitRecent) {
      onCommitRecent(next);
    }
  };

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
    <div
      ref={popoverRef}
      className={[styles.popover, dragging ? styles.popoverDragging : ''].join(' ')}
      style={offset.x || offset.y ? { transform: `translate3d(${offset.x}px, ${offset.y}px, 0)` } : undefined}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Pointer-only affordance, so it stays out of the tab order — there is
          no keyboard equivalent to drag, and the picker works without it. */}
      <button
        type="button"
        className={styles.dragHandle}
        aria-label="Drag color picker"
        tabIndex={-1}
        onMouseDown={startDrag}
      >
        <span className={styles.dragGrip} />
      </button>
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
      {/* Keyed on mode so the body cross-fades in on every switch instead of
          swapping between two differently-sized panels in one frame. */}
      <div key={mode} className={styles.modeBody}>
        {mode === 'solid' ? (
          <SolidPicker
            value={value}
            onChange={handleChange}
            variables={variables}
            recentlyUsed={recentlyUsed}
            mode={colorMode}
            onModeChange={setColorMode}
          />
        ) : (
          <GradientPicker
            value={value}
            onChange={onChange}
            variables={variables}
            mode={colorMode}
            onModeChange={setColorMode}
          />
        )}
      </div>
    </div>
  );
}
