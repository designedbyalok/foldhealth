import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import GridLayout from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { GRID_COLS, GRID_ROW_HEIGHT, GRID_MARGIN } from './EditableGrid.constants';
import s from '../AnalyticsLayout.module.css';

// Shared grid geometry for every editable analytics dashboard.

// Persisted shape is { layout, manual }. `manual` holds the keys of items
// the user has explicitly resized: those opt out of auto-fit so their
// chosen height sticks. Plain-array values from the older format are read
// as a layout with no manual overrides.
function loadState(storageKey, defaultLayout) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { layout: defaultLayout, manual: [] };
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return { layout: parsed, manual: [] };
    if (parsed && Array.isArray(parsed.layout)) {
      return { layout: parsed.layout, manual: Array.isArray(parsed.manual) ? parsed.manual : [] };
    }
    return { layout: defaultLayout, manual: [] };
  } catch {
    return { layout: defaultLayout, manual: [] };
  }
}

function saveState(storageKey, layout, manual) {
  try { localStorage.setItem(storageKey, JSON.stringify({ layout, manual })); } catch { /* noop */ }
}

// Rows needed to fit `contentPx` of content given the grid's row height and
// vertical margin: h*ROW + (h-1)*MY >= contentPx.
function rowsForContent(contentPx) {
  const my = GRID_MARGIN[1];
  const unit = GRID_ROW_HEIGHT + my;
  return Math.max(1, Math.ceil((contentPx + my) / unit));
}

/**
 * EditableGrid: the single source of truth for the drag/resize analytics
 * dashboards. A view supplies a `defaultLayout` (x/y/w placement; the `h`
 * values are only seeds because heights auto-fit to content) and a
 * `renderers` map keyed by layout id. Panels whose renderer returns null
 * are auto-hidden and the grid re-flows to fill the gap.
 *
 * Height behaviour: each panel's cell auto-fits to its content height, so
 * there's no empty space below a widget on load. Once the user manually
 * resizes a panel, that panel is pinned to their size and stops auto-
 * fitting (Reset clears all pins).
 */
export function EditableGrid({ storageKey, defaultLayout, renderers, editing = false, resetTick = 0 }) {
  const [initial] = useState(() => loadState(storageKey, defaultLayout));

  const [layout, setLayout] = useState(initial.layout);
  const [manual, setManual] = useState(initial.manual);

  const containerRef = useRef(null);
  const [width, setWidth] = useState(1200);
  const itemEls = useRef({});

  // Latest values for the ResizeObserver callback, which closes over them.
  const layoutRef = useRef(layout);
  const manualRef = useRef(manual);
  useEffect(() => {
    layoutRef.current = layout;
    manualRef.current = manual;
  });

  // Track container width so GridLayout can compute column widths.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Render each panel once; drop the ones that return null so they neither
  // occupy a cell nor get observed. Vertical bounds are normalized here
  // (small floor, no ceiling) so auto-fit is never clamped, per-view
  // minH/maxH seeds tuned for the old fixed rowHeight are intentionally
  // ignored. Width bounds (minW/maxW) are preserved.
  const items = useMemo(
    () => layout
      .map(l => ({ l: { ...l, minH: 2, maxH: Infinity }, node: renderers[l.i]?.() }))
      .filter(it => it.node != null),
    [layout, renderers],
  );
  const visibleLayout = useMemo(() => items.map(it => it.l), [items]);

  // Auto-fit: snap every non-pinned panel's cell height to its measured
  // content height. Measuring the inner wrapper (which is height:auto)
  // rather than the cell avoids a feedback loop.
  const measureAndFit = useCallback(() => {
    let changed = false;
    const manual = new Set(manualRef.current);
    const next = layoutRef.current.map(l => {
      if (manual.has(l.i)) return l;
      const el = itemEls.current[l.i];
      if (!el) return l;
      const contentPx = el.offsetHeight;
      if (!contentPx) return l;
      const h = rowsForContent(contentPx);
      if (h !== l.h) { changed = true; return { ...l, h }; }
      return l;
    });
    if (changed) {
      setLayout(next);
      saveState(storageKey, next, manualRef.current);
    }
  }, [storageKey]);

  // Re-attach the content observer whenever the visible panel set or the
  // width changes (width changes reflow content, changing heights).
  const itemKeys = items.map(it => it.l.i).join('|');
  useEffect(() => {
    const ro = new ResizeObserver(() => measureAndFit());
    Object.values(itemEls.current).forEach(el => el && ro.observe(el));
    measureAndFit();
    return () => ro.disconnect();
  }, [measureAndFit, itemKeys, width]);

  const handleDragStop = useCallback((next) => {
    setLayout(next);
    saveState(storageKey, next, manualRef.current);
  }, [storageKey]);

  const handleResizeStop = useCallback((next, _oldItem, newItem) => {
    const nextManual = manualRef.current.includes(newItem.i)
      ? manualRef.current
      : [...manualRef.current, newItem.i];
    setManual(nextManual);
    setLayout(next);
    saveState(storageKey, next, nextManual);
  }, [storageKey]);

  // Reset signal from AnalyticsLayout. Skip the initial 0 so first mount
  // doesn't clobber a persisted custom layout.
  useEffect(() => {
    if (resetTick === 0) return;
    setLayout(defaultLayout);
    setManual([]);
    saveState(storageKey, defaultLayout, []);
  }, [resetTick]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      className={[s.gridContainer, editing ? s.gridEditing : ''].filter(Boolean).join(' ')}
    >
      <GridLayout
        className="layout"
        layout={visibleLayout}
        cols={GRID_COLS}
        rowHeight={GRID_ROW_HEIGHT}
        width={width}
        margin={GRID_MARGIN}
        containerPadding={[0, 0]}
        isDraggable={editing}
        isResizable={editing}
        onDragStop={handleDragStop}
        onResizeStop={handleResizeStop}
        compactType="vertical"
      >
        {items.map(({ l, node }) => (
          <div key={l.i} className={s.gridItem}>
            <div className={s.gridItemInner} ref={el => { itemEls.current[l.i] = el; }}>
              {node}
            </div>
          </div>
        ))}
      </GridLayout>
    </div>
  );
}
