import { useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Group, Image as KImage, Rect, Ellipse, Arrow, Line, Text, Circle, Transformer } from 'react-konva';
import { ANNOTATOR_ICONS } from './annotator-icons';

// Toolbar groups, in order. Letters are keyboard shortcuts.
const TOOL_GROUPS = [
  [['select', 'V']],
  [['rect', 'R'], ['highlight', 'H'], ['ellipse', 'O']],
  [['arrow', 'A'], ['line', 'L'], ['pen', 'P']],
  [['text', 'T'], ['step', 'N']],
  [['redact', 'X']],
  [['crop', 'C']],
];
const SHORTCUTS = Object.fromEntries(TOOL_GROUPS.flat().map(([tool, key]) => [key.toLowerCase(), tool]));
const BOX_TYPES = new Set(['rect', 'highlight', 'ellipse', 'redact']);
const PAD = 40;
const BAR = 88; // room under the image for the toolbar
const TIP_DELAY = 400;
const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+';

let seq = 0;
const uid = () => `rk-shape-${Date.now()}-${seq++}`;

function ToolIcon({ name, size = 18 }) {
  // Static SVG bodies generated from the Solar icon set, not user input.
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ANNOTATOR_ICONS[name] }} />;
}

// Marks are drawn in the host's own colours, read from the kit's variables.
function kitPalette() {
  const layer = document.querySelector('.rk-layer') || document.documentElement;
  const cs = getComputedStyle(layer);
  const v = (name) => cs.getPropertyValue(name).trim();
  return {
    colors: [v('--rk-danger'), v('--rk-warning'), v('--rk-success'), v('--rk-accent'), v('--rk-text'), v('--rk-bg')],
    font: cs.fontFamily,
    contrast: v('--rk-bg'),
    shade: v('--rk-overlay'),
  };
}

// A blocky copy of the image: Redact shows the matching part of it.
function pixelate(img) {
  const block = Math.max(8, Math.round(img.naturalWidth / 110));
  const small = document.createElement('canvas');
  small.width = Math.ceil(img.naturalWidth / block);
  small.height = Math.ceil(img.naturalHeight / block);
  small.getContext('2d').drawImage(img, 0, 0, small.width, small.height);
  const out = document.createElement('canvas');
  out.width = img.naturalWidth;
  out.height = img.naturalHeight;
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(small, 0, 0, out.width, out.height);
  return out;
}

const normalizeBox = ({ ox, oy, ...s }, p) => ({
  ...s,
  x: Math.min(ox, p.x), y: Math.min(oy, p.y),
  width: Math.abs(p.x - ox), height: Math.abs(p.y - oy),
  ox, oy,
});

/**
 * Full-screen annotator for one image: shapes, arrows, pen, text, numbered
 * steps, redaction and crop. Done hands back a PNG at the image's original
 * resolution (the marks are redrawn at full size, never upscaled).
 */
export default function Annotator({ file, name, labels, onSave, onCancel }) {
  const L = labels;
  const T = labels.tools;
  const [palette] = useState(kitPalette);
  const [img, setImg] = useState(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [tool, setTool] = useState('arrow');
  const [color, setColor] = useState(palette.colors[0]);
  const [colorOpen, setColorOpen] = useState(false);
  const [doc, setDoc] = useState({ shapes: [], crop: null });
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const [draft, setDraft] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [editing, setEditing] = useState(null); // { x, y, value } while typing text
  const [saving, setSaving] = useState(false);
  const box = useRef(null);
  const stage = useRef(null);
  const transformer = useRef(null);
  const chrome = useRef(null); // crop shade and frame, hidden when exporting
  const [tip, setTip] = useState(null); // { label, keys, x, y } over a toolbar button
  const tipTimer = useRef(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => setImg(image);
    image.src = url;
    return () => { image.onload = null; URL.revokeObjectURL(url); };
  }, [file]);

  useEffect(() => {
    const ro = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => () => clearTimeout(tipTimer.current), []);

  // Toolbar tooltips (from each button's data-tip / data-keys): after a short
  // hover, or at once on keyboard focus. Handled once, on the toolbar.
  const tipEl = useRef(null);
  const placeTip = (el) => {
    const b = box.current.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setTip({ label: el.dataset.tip, keys: el.dataset.keys, x: r.left + r.width / 2 - b.left, y: r.top - b.top });
  };
  const hideTip = () => { clearTimeout(tipTimer.current); tipEl.current = null; setTip(null); };
  const tipHandlers = {
    onPointerOver: (e) => {
      const el = e.target.closest('[data-tip]');
      if (!el || el === tipEl.current) return;
      hideTip();
      tipEl.current = el;
      tipTimer.current = setTimeout(() => placeTip(el), TIP_DELAY);
    },
    onPointerOut: (e) => {
      const el = e.target.closest('[data-tip]');
      if (el && el.contains(e.relatedTarget)) return;
      hideTip();
    },
    onPointerDown: hideTip,
    onFocus: (e) => {
      const el = e.target.closest('[data-tip]');
      if (el?.matches(':focus-visible')) placeTip(el);
    },
    onBlur: hideTip,
  };

  const pixelated = useMemo(() => (img ? pixelate(img) : null), [img]);

  // Fit the image into the canvas area (never more than 2x), centred above the toolbar.
  const view = useMemo(() => {
    if (!img || !size.w) return null;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const scale = Math.max(0.05, Math.min((size.w - PAD * 2) / iw, (size.h - PAD - BAR) / ih, 2));
    return { iw, ih, scale, x: (size.w - iw * scale) / 2, y: Math.max(PAD / 2, (size.h - BAR - ih * scale) / 2) };
  }, [img, size]);

  // Mark sizes follow the image, so they look the same on any screenshot.
  const unit = view ? Math.max(2, Math.round(Math.max(view.iw, view.ih) / 400)) : 2;
  const fontSize = unit * 7;
  const stepRadius = unit * 5;

  const commit = (next) => {
    setPast(p => [...p, doc]);
    setFuture([]);
    setDoc(next);
  };
  const undo = () => {
    if (!past.length) return;
    setFuture(f => [doc, ...f]);
    setDoc(past[past.length - 1]);
    setPast(p => p.slice(0, -1));
    setSelectedId(null);
  };
  const redo = () => {
    if (!future.length) return;
    setPast(p => [...p, doc]);
    setDoc(future[0]);
    setFuture(f => f.slice(1));
    setSelectedId(null);
  };
  const updateShape = (id, patch) => commit({ ...doc, shapes: doc.shapes.map(s => (s.id === id ? { ...s, ...patch } : s)) });
  const removeSelected = () => {
    if (!selectedId) return;
    commit({ ...doc, shapes: doc.shapes.filter(s => s.id !== selectedId) });
    setSelectedId(null);
  };
  const pickTool = (next) => {
    hideTip();
    setTool(next);
    setSelectedId(null);
    setColorOpen(false);
  };

  const commitText = () => {
    if (editing?.value.trim()) {
      commit({ ...doc, shapes: [...doc.shapes, { id: uid(), type: 'text', x: editing.x, y: editing.y, text: editing.value, color }] });
    }
    setEditing(null);
  };

  const save = () => {
    if (!view || saving) return;
    setSaving(true);
    // Leave out the selection box and crop shade, then render the image
    // area (or the crop) at the image's own pixel size.
    transformer.current?.nodes([]);
    chrome.current?.hide();
    const c = doc.crop || { x: 0, y: 0, width: view.iw, height: view.ih };
    const canvas = stage.current.toCanvas({
      x: view.x + c.x * view.scale,
      y: view.y + c.y * view.scale,
      width: c.width * view.scale,
      height: c.height * view.scale,
      pixelRatio: 1 / view.scale,
    });
    chrome.current?.show();
    canvas.toBlob((blob) => {
      setSaving(false);
      if (blob) onSave(blob);
    }, 'image/png');
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
      if (mod && e.key === 'Enter') { e.preventDefault(); save(); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) { e.preventDefault(); removeSelected(); return; }
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (colorOpen) setColorOpen(false);
        else if (selectedId) setSelectedId(null);
        else onCancel();
        return;
      }
      if (!mod && !e.altKey && SHORTCUTS[e.key.toLowerCase()]) pickTool(SHORTCUTS[e.key.toLowerCase()]);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  // The selection box follows whichever shape is selected.
  useEffect(() => {
    const tr = transformer.current;
    if (!tr) return;
    const node = selectedId ? stage.current?.findOne(`#${selectedId}`) : null;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, doc]);

  const pointer = () => {
    const p = stage.current.getPointerPosition();
    return {
      x: Math.max(0, Math.min(view.iw, (p.x - view.x) / view.scale)),
      y: Math.max(0, Math.min(view.ih, (p.y - view.y) / view.scale)),
    };
  };

  const onDown = (e) => {
    if (!view || editing) return;
    setColorOpen(false);
    const p = pointer();
    if (tool === 'select') {
      if (e.target === e.target.getStage() || e.target.name() === 'base') setSelectedId(null);
      return;
    }
    // Text opens on release: opening on press loses focus to the same click.
    if (tool === 'text') { setDraft({ type: 'text-pending', x: p.x, y: p.y }); return; }
    if (tool === 'step') {
      const n = doc.shapes.filter(s => s.type === 'step').length + 1;
      commit({ ...doc, shapes: [...doc.shapes, { id: uid(), type: 'step', x: p.x, y: p.y, n, color }] });
      return;
    }
    const base = { id: uid(), type: tool, color };
    if (tool === 'arrow' || tool === 'line') setDraft({ ...base, x: 0, y: 0, points: [p.x, p.y, p.x, p.y] });
    else if (tool === 'pen') setDraft({ ...base, x: 0, y: 0, points: [p.x, p.y] });
    else setDraft({ ...base, x: p.x, y: p.y, width: 0, height: 0, ox: p.x, oy: p.y });
  };

  const onMove = () => {
    if (!draft || draft.type === 'text-pending') return;
    const p = pointer();
    if (draft.type === 'arrow' || draft.type === 'line') setDraft({ ...draft, points: [draft.points[0], draft.points[1], p.x, p.y] });
    else if (draft.type === 'pen') setDraft({ ...draft, points: [...draft.points, p.x, p.y] });
    else setDraft(normalizeBox(draft, p));
  };

  const onUp = () => {
    if (!draft) return;
    const d = draft;
    setDraft(null);
    if (d.type === 'text-pending') { setEditing({ x: d.x, y: d.y, value: '' }); return; }
    const min = unit * 2;
    if (d.points) {
      const [x1, y1] = d.points;
      const [x2, y2] = d.points.slice(-2);
      if (Math.hypot(x2 - x1, y2 - y1) < min && d.points.length <= 4) return;
      commit({ ...doc, shapes: [...doc.shapes, d] });
      return;
    }
    if (d.width < min || d.height < min) return;
    const { ox: _ox, oy: _oy, ...shape } = d;
    if (d.type === 'crop') commit({ ...doc, crop: { x: shape.x, y: shape.y, width: shape.width, height: shape.height } });
    else commit({ ...doc, shapes: [...doc.shapes, shape] });
  };

  const onDragEnd = (s) => (e) => {
    const node = e.target;
    if (s.type === 'ellipse') updateShape(s.id, { x: node.x() - s.width / 2, y: node.y() - s.height / 2 });
    else updateShape(s.id, { x: node.x(), y: node.y() });
  };

  const onTransformEnd = (s) => (e) => {
    const node = e.target;
    const sx = node.scaleX();
    const sy = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    if (s.type === 'ellipse') {
      const width = node.radiusX() * 2 * sx;
      const height = node.radiusY() * 2 * sy;
      updateShape(s.id, { x: node.x() - width / 2, y: node.y() - height / 2, width, height });
    } else {
      updateShape(s.id, { x: node.x(), y: node.y(), width: Math.max(4, node.width() * sx), height: Math.max(4, node.height() * sy) });
    }
  };

  const renderShape = (s, live = false) => {
    const interactive = tool === 'select' && !live;
    const common = {
      key: s.id,
      id: s.id,
      draggable: interactive,
      listening: interactive,
      onPointerDown: interactive ? () => setSelectedId(s.id) : undefined,
      onDragEnd: interactive ? onDragEnd(s) : undefined,
      onTransformEnd: interactive ? onTransformEnd(s) : undefined,
    };
    const line = { stroke: s.color, strokeWidth: unit, lineCap: 'round', lineJoin: 'round', hitStrokeWidth: unit * 6 };
    switch (s.type) {
      case 'rect':
        return <Rect {...common} x={s.x} y={s.y} width={s.width} height={s.height} cornerRadius={unit} stroke={s.color} strokeWidth={unit} />;
      case 'highlight':
        return <Rect {...common} x={s.x} y={s.y} width={s.width} height={s.height} cornerRadius={unit} fill={s.color} opacity={0.28} />;
      case 'ellipse':
        return <Ellipse {...common} x={s.x + s.width / 2} y={s.y + s.height / 2} radiusX={s.width / 2} radiusY={s.height / 2} stroke={s.color} strokeWidth={unit} />;
      case 'redact':
        return <KImage {...common} image={pixelated} x={s.x} y={s.y} width={s.width} height={s.height} crop={{ x: s.x, y: s.y, width: s.width, height: s.height }} />;
      case 'arrow':
        return <Arrow {...common} {...line} x={s.x} y={s.y} points={s.points} fill={s.color} pointerLength={unit * 4} pointerWidth={unit * 4} />;
      case 'line':
        return <Line {...common} {...line} x={s.x} y={s.y} points={s.points} />;
      case 'pen':
        return <Line {...common} {...line} x={s.x} y={s.y} points={s.points} tension={0.4} />;
      case 'text':
        return <Text {...common} x={s.x} y={s.y} text={s.text} fill={s.color} fontSize={fontSize} fontFamily={palette.font} fontStyle="500" lineHeight={1.25} />;
      case 'step':
        return (
          <Group {...common} x={s.x} y={s.y}>
            <Circle radius={stepRadius} fill={s.color} />
            <Text text={String(s.n)} fill={palette.contrast} fontSize={stepRadius * 1.1} fontFamily={palette.font} fontStyle="600"
              width={stepRadius * 2} height={stepRadius * 2} offsetX={stepRadius} offsetY={stepRadius} align="center" verticalAlign="middle" />
          </Group>
        );
      case 'crop':
        return <Rect key={s.id} x={s.x} y={s.y} width={s.width} height={s.height} stroke={palette.contrast} strokeWidth={1 / view.scale} dash={[6 / view.scale, 4 / view.scale]} listening={false} />;
      default:
        return null;
    }
  };

  const selected = doc.shapes.find(s => s.id === selectedId);
  const crop = draft?.type === 'crop' ? draft : doc.crop;
  const cursor = tool === 'select' ? 'default' : tool === 'text' ? 'text' : 'crosshair';

  return (
    <div className="rk-modal-backdrop">
      <div className="rk-annotator" role="dialog" aria-modal="true" aria-label={L.annotateTitle(name)}>
        <header className="rk-preview-header">
          <span className="rk-preview-name" title={name}>{L.annotateTitle(name)}</span>
          <button type="button" className="rk-tool" onClick={onCancel}>{L.cancel}</button>
          <button type="button" className="rk-send rk-annotator-done" onClick={save} disabled={!view || saving}>
            <ToolIcon name="done" size={16} />
            <span>{L.done}</span>
          </button>
        </header>

        <div className="rk-annotator-canvas" ref={box} style={{ cursor }}>
          {view && (
            <Stage
              ref={stage}
              width={size.w}
              height={size.h}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerLeave={onUp}
            >
              <Layer>
                <Group x={view.x} y={view.y} scaleX={view.scale} scaleY={view.scale}>
                  <KImage name="base" image={img} width={view.iw} height={view.ih} />
                  {doc.shapes.map(s => renderShape(s))}
                  {draft && draft.type !== 'crop' && renderShape(draft, true)}
                  <Group ref={chrome} listening={false}>
                    <Rect width={view.iw} height={view.ih} stroke={palette.colors[4]} strokeWidth={1 / view.scale} opacity={0.15} />
                    {crop && (
                      <>
                        <Rect width={view.iw} height={crop.y} fill={palette.shade} />
                        <Rect y={crop.y + crop.height} width={view.iw} height={view.ih - crop.y - crop.height} fill={palette.shade} />
                        <Rect y={crop.y} width={crop.x} height={crop.height} fill={palette.shade} />
                        <Rect x={crop.x + crop.width} y={crop.y} width={view.iw - crop.x - crop.width} height={crop.height} fill={palette.shade} />
                        {renderShape({ ...crop, id: 'crop-frame', type: 'crop' })}
                      </>
                    )}
                  </Group>
                </Group>
                <Transformer
                  ref={transformer}
                  rotateEnabled={false}
                  resizeEnabled={!!selected && BOX_TYPES.has(selected.type)}
                  keepRatio={false}
                  borderStroke={palette.colors[3]}
                  anchorStroke={palette.colors[3]}
                  anchorSize={8}
                  anchorCornerRadius={4}
                  ignoreStroke
                />
              </Layer>
            </Stage>
          )}

          {editing && view && (
            <textarea
              className="rk-annotator-text"
              autoFocus
              rows={1}
              placeholder={L.textPlaceholder}
              value={editing.value}
              onChange={e => setEditing({ ...editing, value: e.target.value })}
              onBlur={commitText}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitText(); }
                if (e.key === 'Escape') setEditing(null);
              }}
              style={{
                left: view.x + editing.x * view.scale,
                top: view.y + editing.y * view.scale,
                fontSize: fontSize * view.scale,
                color,
              }}
            />
          )}

          {tip && (
            <div className="rk-annotator-tip" role="tooltip" style={{ left: tip.x, top: tip.y }}>
              {tip.label}
              {tip.keys && <kbd>{tip.keys}</kbd>}
            </div>
          )}

          {view && <span className="rk-annotator-zoom" aria-label={L.zoom}>{Math.round(view.scale * 100)}%</span>}

          <div className="rk-annotator-bar" role="toolbar" aria-label={L.annotateTitle(name)} {...tipHandlers}>
            {TOOL_GROUPS.map((group, gi) => (
              <div className="rk-annotator-group" key={group[0][0]}>
                {gi > 0 && <span className="rk-annotator-divider" aria-hidden="true" />}
                {group.map(([t, key]) => (
                  <button
                    key={t}
                    type="button"
                    className={`rk-annotator-tool${tool === t ? ' rk-annotator-tool-on' : ''}`}
                    aria-pressed={tool === t}
                    aria-label={T[t]}
                    data-tip={T[t]}
                    data-keys={key}
                    onClick={() => pickTool(t)}
                  >
                    <ToolIcon name={t} />
                  </button>
                ))}
                {group[0][0] === 'redact' && (
                  <div className="rk-annotator-color-wrap">
                    <button
                      type="button"
                      className="rk-annotator-tool"
                      aria-label={T.color}
                      aria-expanded={colorOpen}
                      data-tip={T.color}
                      onClick={() => setColorOpen(v => !v)}
                    >
                      <span className="rk-annotator-swatch" style={{ background: color }} />
                    </button>
                    {colorOpen && (
                      <div className="rk-annotator-colors" role="listbox" aria-label={T.color}>
                        {palette.colors.map((c, i) => (
                          <button
                            key={c}
                            type="button"
                            role="option"
                            aria-selected={c === color}
                            aria-label={T.colorNames[i] || c}
                            data-tip={T.colorNames[i] || c}
                            className={`rk-annotator-color${c === color ? ' rk-annotator-color-on' : ''}`}
                            onClick={() => {
                              setColor(c);
                              setColorOpen(false);
                              if (selected && selected.type !== 'redact') updateShape(selected.id, { color: c });
                            }}
                          >
                            <span className="rk-annotator-swatch" style={{ background: c }} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div className="rk-annotator-group">
              <span className="rk-annotator-divider" aria-hidden="true" />
              <button type="button" className="rk-annotator-tool" onClick={undo} aria-disabled={!past.length} aria-label={T.undo} data-tip={T.undo} data-keys={`${MOD}Z`}>
                <ToolIcon name="undo" />
              </button>
              <button type="button" className="rk-annotator-tool" onClick={redo} aria-disabled={!future.length} aria-label={T.redo} data-tip={T.redo} data-keys={`⇧${MOD}Z`}>
                <ToolIcon name="redo" />
              </button>
              {selected && (
                <button type="button" className="rk-annotator-tool" onClick={removeSelected} aria-label={T.remove} data-tip={T.remove} data-keys="⌫">
                  <ToolIcon name="remove" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
