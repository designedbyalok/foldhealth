import '@xyflow/react/dist/style.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlow, Background, BackgroundVariant, Panel, ReactFlowProvider, useReactFlow, useStore } from '@xyflow/react';
import { Icon } from '../../../components/Icon/Icon';
import { Tooltip } from '../../../components/Tooltip/Tooltip';
import { layoutGraph, nodeSummary } from '../lib/graph';
import { NODE_TYPES } from './CanvasNodes';
import { CanvasContext } from './canvasContext';
import styles from './AutomationCanvas.module.css';

const zoomSelector = (s) => Math.round(s.transform[2] * 100);
const NOOP = () => {};

/**
 * The automation graph on a pannable, zoomable canvas. One component for
 * every place a flow is drawn:
 *   mode 'edit'     builder: "+" slots, selection, drag-and-drop, delete
 *   mode 'readonly' template preview, quick view
 *   mode 'test'     test run: per-node state (current / running / success / error)
 *   mode 'stats'    node-level analytics and the member trace: counts and status
 *
 * Positions come from lib/graph.js layoutGraph (fixed card sizes), so the
 * canvas never measures the DOM.
 */
export function AutomationCanvas(props) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function CanvasInner({
  graph,
  mode = 'readonly',
  selectedId = null,
  selectedSlot = null,
  onSelectNode,
  onSelectSlot,
  onDropType,
  onDeleteNode,
  isAllowed,
  nodeState = {},
  stats = null,
  flagged = null,
  annotations = [],
  focusId = null,
  templateName,
  controls = true,
  leftControl = null,
  className,
}) {
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [dragging, setDragging] = useState(false);
  const [fitted, setFitted] = useState(true);
  const wrapRef = useRef(null);
  const rf = useReactFlow();
  const zoom = useStore(zoomSelector);
  const editing = mode === 'edit';

  // Drop targets show only while a palette item is dragged (the Figma has no
  // "+" buttons); a click on a palette item adds under the selected step.
  const slotFilter = editing && dragging;
  const layout = useMemo(() => layoutGraph(graph, { slots: slotFilter, collapsed, statBlock: mode === 'stats' }), [graph, slotFilter, collapsed, mode]);

  const toggleCollapse = useCallback((id) => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  }), []);
  const splitterIds = useMemo(() => layout.items.filter(i => i.outcomeCount).map(i => i.id), [layout]);
  const anyCollapsed = collapsed.size > 0;
  const toggleAll = useCallback(() => {
    setCollapsed(anyCollapsed ? new Set() : new Set(splitterIds));
  }, [anyCollapsed, splitterIds]);

  const ctx = useMemo(() => ({
    mode, selectedId, selectedSlot, onSelectNode, onSelectSlot, onDropType, onDeleteNode, isAllowed,
    nodeState, stats, flagged, dragging, collapsed, toggleCollapse, toggleAll, anyCollapsed,
    summaryOf: (node) => nodeSummary(node, { templateName }),
  }), [mode, selectedId, selectedSlot, onSelectNode, onSelectSlot, onDropType, onDeleteNode, isAllowed,
    nodeState, stats, flagged, dragging, collapsed, toggleCollapse, toggleAll, anyCollapsed, templateName]);

  const nodes = useMemo(() => {
    const out = layout.items.map(it => ({
      id: it.id,
      type: it.kind === 'node' ? (['delay', 'repeat', 'and', 'or'].includes(it.node.type) ? 'pill' : it.node.type === 'microAutomation' ? 'groupHeader' : 'card') : it.kind,
      position: { x: it.x, y: it.y },
      data: it,
      draggable: false,
      selectable: false,
      connectable: false,
      zIndex: it.kind === 'groupBox' ? -1 : 1,
      // Clicks on steps must not start a canvas pan (which swallows the click).
      className: it.kind === 'groupBox' ? undefined : 'nopan',
      style: { width: it.w, height: it.h },
    }));
    for (const a of annotations) {
      const anchor = layout.items.find(i => i.id === a.anchorId);
      if (!anchor) continue;
      out.push({
        id: `note:${a.anchorId}`,
        type: 'annotation',
        position: { x: anchor.x + anchor.w / 2 - (a.width || 360) / 2, y: anchor.y + anchor.h + 16 },
        data: { content: a.content },
        draggable: false,
        selectable: false,
        zIndex: 20,
        style: { width: a.width || 360 },
      });
    }
    return out;
  }, [layout, annotations]);

  const edges = useMemo(() => layout.edges.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: e.loop ? 'default' : 'smoothstep',
    sourceHandle: e.loop ? 'right' : undefined,
    targetHandle: e.loop ? 'right' : undefined,
    animated: false,
    // Figma connectors: 1px grey, elbows rounded at 15px.
    pathOptions: { borderRadius: 15 },
    style: { stroke: 'var(--placeholder-text)', strokeWidth: 1, strokeDasharray: e.dashed ? '4 4' : undefined },
  })), [layout]);

  // Follow a node (test run / trace) into view.
  const focus = useCallback((id, duration) => {
    const it = layout.items.find(i => i.id === id);
    if (!it) return false;
    rf.setCenter(it.x + it.w / 2, it.y + it.h / 2 + 120, { zoom: Math.max(rf.getZoom(), 0.85), duration });
    return true;
  }, [layout, rf]);

  // First view: the focused node if there is one, else fit the flow. Later
  // edits keep the viewport.
  const didFit = useRef(false);
  useEffect(() => {
    if (didFit.current || !nodes.length) return;
    didFit.current = true;
    requestAnimationFrame(() => {
      if (focusId && focus(focusId, 0)) return;
      // The builder opens at actual size with "Starts here" at the top
      // center (Figma); previews and analytics fit the whole flow.
      const start = layout.items.find(i => i.id === 'start');
      if ((editing || nodes.length === 1) && start && wrapRef.current) {
        const width = wrapRef.current.clientWidth;
        rf.setViewport({ x: width / 2 - (start.x + start.w / 2), y: 40, zoom: 1 });
        setFitted(false);
        return;
      }
      rf.fitView({ padding: 0.15, maxZoom: 1 });
    });
  }, [nodes.length, rf, focusId, focus, editing, layout]);

  useEffect(() => {
    if (focusId && didFit.current) focus(focusId, 400);
  }, [focusId, focus]);

  // When a side panel opens or closes the canvas narrows or widens; keep the
  // flow centered on "Starts here" (Figma 64 → 65).
  const startRef = useRef(null);
  useEffect(() => { startRef.current = layout.items.find(i => i.id === 'start') || null; }, [layout]);
  useEffect(() => {
    const el = wrapRef.current;
    if (!editing || !el || typeof ResizeObserver === 'undefined') return undefined;
    let last = el.clientWidth;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      const start = startRef.current;
      if (w === last || !start || !didFit.current) { last = w; return; }
      const { y, zoom } = rf.getViewport();
      rf.setViewport({ x: w / 2 - (start.x + start.w / 2) * zoom, y, zoom });
      last = w;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [rf, editing]);

  // Palette drags light up every "+" slot.
  useEffect(() => {
    if (!editing) return undefined;
    const start = (e) => { if (e.dataTransfer?.types?.includes('application/x-automation-node')) setDragging(true); };
    const end = () => setDragging(false);
    window.addEventListener('dragstart', start);
    window.addEventListener('dragend', end);
    window.addEventListener('drop', end);
    return () => {
      window.removeEventListener('dragstart', start);
      window.removeEventListener('dragend', end);
      window.removeEventListener('drop', end);
    };
  }, [editing]);

  const fitOrActual = () => {
    if (fitted) rf.zoomTo(1, { duration: 200 });
    else rf.fitView({ padding: 0.15, duration: 200 });
    setFitted(!fitted);
  };
  const recenter = () => {
    const start = layout.items.find(i => i.id === 'start');
    if (start) rf.setCenter(start.x + start.w / 2, start.y + 260, { zoom: rf.getZoom(), duration: 300 });
  };

  return (
    <CanvasContext.Provider value={ctx}>
      <div ref={wrapRef} className={`${styles.canvas} ${className || ''}`}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          onPaneClick={() => { onSelectNode?.(null); onSelectSlot?.(null); }}
          // Nodes handle their own clicks; without a node click handler
          // xyflow gives non-selectable nodes pointer-events: none.
          onNodeClick={NOOP}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          deleteKeyCode={null}
          minZoom={0.2}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
          panOnScroll
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="var(--neutral-150)" />
          {leftControl && <Panel position="bottom-left">{leftControl}</Panel>}
          {controls && (
            <Panel position="bottom-right" className={styles.controls}>
              <button type="button" className={styles.controlBtn} onClick={fitOrActual}>
                <Icon name={fitted ? 'solar:maximize-square-minimalistic-linear' : 'solar:minimize-square-minimalistic-linear'} size={14} />
                {fitted ? 'Actual Size' : 'Fit to Canvas'}
              </button>
              <span className={styles.zoomGroup}>
                <Tooltip label="Zoom out"><button type="button" className={styles.iconBtn} aria-label="Zoom out" onClick={() => rf.zoomOut({ duration: 150 })}><Icon name="solar:minus-square-linear" size={16} /></button></Tooltip>
                <span className={styles.zoomValue}>{zoom}</span>
                <Tooltip label="Zoom in"><button type="button" className={styles.iconBtn} aria-label="Zoom in" onClick={() => rf.zoomIn({ duration: 150 })}><Icon name="solar:add-square-linear" size={16} /></button></Tooltip>
              </span>
              <Tooltip label="Recenter"><button type="button" className={styles.iconBtn} aria-label="Recenter" onClick={recenter}><Icon name="solar:target-linear" size={16} /></button></Tooltip>
            </Panel>
          )}
        </ReactFlow>
      </div>
    </CanvasContext.Provider>
  );
}
