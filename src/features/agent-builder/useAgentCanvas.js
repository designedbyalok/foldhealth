import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useNodesState, useEdgesState, addEdge } from '@xyflow/react';
import { useAppStore } from '../../store/useAppStore';

let nodeIdCounter = 100;
function getNextId() {
  return `n${++nodeIdCounter}`;
}

const MIN_PANEL_WIDTH = 260;
const MAX_PANEL_WIDTH = 480;
const DEFAULT_PANEL_WIDTH = 300;

export function useAgentCanvas() {
  const builderAgent = useAppStore(s => s.builderAgent);
  const builderFlow = useAppStore(s => s.builderFlow);
  const builderFlowLoading = useAppStore(s => s.builderFlowLoading);
  const builderSelectedNode = useAppStore(s => s.builderSelectedNode);
  const builderVersions = useAppStore(s => s.builderVersions);
  const setBuilderSelectedNode = useAppStore(s => s.setBuilderSelectedNode);
  const closeBuilder = useAppStore(s => s.closeBuilder);
  const saveFlow = useAppStore(s => s.saveFlow);
  const createFlowVersion = useAppStore(s => s.createFlowVersion);
  const validateBuilderAgent = useAppStore(s => s.validateBuilderAgent);
  const bumpBuilderValidationAttempt = useAppStore(s => s.bumpBuilderValidationAttempt);
  const showToast = useAppStore(s => s.showToast);

  // Undo/redo history (local — applied via setNodes/setEdges).
  // `past` holds previous flow snapshots; `future` holds states unwound by undo.
  const [history, setHistory] = useState({ past: [], future: [] });
  // Mirror of `history` so undo/redo can read the latest value without a
  // functional updater — keeps the updater pure (no side effects inside).
  const historyRef = useRef(history);
  useEffect(() => { historyRef.current = history; });
  const skipHistory = useRef(false);
  const HISTORY_LIMIT = 50;

  const captureHistory = useCallback((prevNodes, prevEdges) => {
    if (skipHistory.current) return;
    setHistory(h => ({
      past: [...h.past, { nodes: prevNodes, edges: prevEdges }].slice(-HISTORY_LIMIT),
      future: [],
    }));
  }, []);

  // Auto-save status indicator
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved'
  const autoSaveTimer = useRef(null);
  const lastSavedSnapshot = useRef('');

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [activeTab, setActiveTab] = useState('Workflow');
  const [rightTab, setRightTab] = useState('Workflow Assistant');
  // Canvas interaction mode: 'select' (left-drag = lasso) or 'pan' (left-drag = pan).
  // Mirrors the Figma / Miro pattern. Persisted to sessionStorage so the
  // mode survives reloads while the user is iterating on a flow.
  const [canvasMode, setCanvasMode] = useState(() => sessionStorage.getItem('builderCanvasMode') || 'select');
  useEffect(() => { sessionStorage.setItem('builderCanvasMode', canvasMode); }, [canvasMode]);
  const [saving, setSaving] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const hasUnsavedChanges = useRef(false);
  const reactFlowWrapper = useRef(null);
  const reactFlowInstance = useRef(null);
  // Warn on browser refresh with unsaved changes
  useEffect(() => {
    const handler = (e) => {
      if (hasUnsavedChanges.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // Load flow data when it arrives
  useEffect(() => {
    if (builderFlow) {
      const flowNodes = (builderFlow.nodes || []).map(n => ({
        ...n,
        data: { ...n.data },
      }));
      setNodes(flowNodes);
      setEdges(builderFlow.edges || []);
      const maxId = flowNodes.reduce((max, n) => {
        const num = parseInt(n.id.replace(/\D/g, ''), 10);
        return isNaN(num) ? max : Math.max(max, num);
      }, 100);
      nodeIdCounter = maxId;
    }
  }, [builderFlow?.id]);

  // Sync node data changes from store (e.g. transitions edited in NodeSettings) back to React Flow
  useEffect(() => {
    if (!builderFlow?.nodes) return;
    setNodes(prev => prev.map(n => {
      const storeNode = builderFlow.nodes.find(sn => sn.id === n.id);
      if (storeNode && storeNode.data !== n.data) {
        return { ...n, data: { ...storeNode.data } };
      }
      return n;
    }));
  }, [builderFlow?.nodes]);

  const onConnect = useCallback((params) => {
    captureHistory(nodes, edges);
    hasUnsavedChanges.current = true;
    setEdges(eds => addEdge({
      ...params,
      type: 'smoothstep',
      animated: false,
      style: { stroke: 'var(--neutral-150)', strokeWidth: 1.5 },
    }, eds));
  }, [setEdges, captureHistory, nodes, edges]);

  const wrappedOnNodesChange = useCallback((changes) => {
    if (changes.some(c => c.type === 'position' || c.type === 'remove' || c.type === 'add')) {
      hasUnsavedChanges.current = true;
    }
    onNodesChange(changes);
  }, [onNodesChange]);

  // Snapshot pre-drag state so a single Cmd+Z reverses an entire drag
  const handleNodeDragStart = useCallback(() => {
    captureHistory(nodes, edges);
  }, [captureHistory, nodes, edges]);

  const wrappedOnEdgesChange = useCallback((changes) => {
    if (changes.some(c => c.type === 'remove' || c.type === 'add')) {
      hasUnsavedChanges.current = true;
    }
    onEdgesChange(changes);
  }, [onEdgesChange]);

  const onNodeClick = useCallback((_, node) => {
    if (node.type === 'startNode') return;
    setBuilderSelectedNode(node.id);
    // Zoom and center on the clicked node
    reactFlowInstance.current?.fitView({
      nodes: [node],
      padding: 0.5,
      duration: 300,
    });
  }, [setBuilderSelectedNode]);

  const onPaneClick = useCallback(() => {
    setBuilderSelectedNode(null);
  }, [setBuilderSelectedNode]);

  const onInit = useCallback((instance) => {
    reactFlowInstance.current = instance;
    if (builderFlow?.viewport) {
      instance.setViewport(builderFlow.viewport);
    }
  }, [builderFlow?.viewport]);

  // Track zoom
  const onMoveEnd = useCallback((_, viewport) => {
    setZoomLevel(Math.round(viewport.zoom * 100));
  }, []);

  // Drag & Drop support
  const onDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/reactflow');
    if (!raw) return;
    let nodeType, label;
    try {
      ({ nodeType, label } = JSON.parse(raw));
    } catch { return; } // malformed drag payload — ignore the drop
    const instance = reactFlowInstance.current;
    if (!instance) return;

    // screenToFlowPosition takes screen coords directly. The earlier
    // subtraction by wrapper bounds was a leftover from the older
    // `project()` API and double-offset the drop position. Center the
    // node on the cursor (default node width ~280px, height ~80px).
    const position = instance.screenToFlowPosition({
      x: e.clientX,
      y: e.clientY,
    });
    position.x -= 140;
    position.y -= 40;

    const isEnd = nodeType === 'end';
    const newNode = {
      id: getNextId(),
      type: isEnd ? 'endNode' : 'conversationNode',
      position,
      data: {
        label: label || 'New Node',
        prompt: '',
        nodeType: isEnd ? 'end' : nodeType,
        transitions: [],
        guardrails: '',
      },
    };

    captureHistory(nodes, edges);
    setNodes(nds => [...nds, newNode]);
  }, [setNodes, captureHistory, nodes, edges]);

  // ─── Delete selected nodes (Delete / Backspace) ───
  // Handles both: a single click-selected node (builderSelectedNode in
  // the store) and a rectangle multi-selection (React Flow marks each
  // dragged-over node with selected: true). Start nodes are protected.
  const onKeyDown = useCallback((e) => {
    if (e.key !== 'Delete' && e.key !== 'Backspace') return;
    // Don't trigger when typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    const multiSelectedIds = [];
    for (const n of nodes) {
      if (n.selected && n.type !== 'startNode') multiSelectedIds.push(n.id);
    }
    const ids = multiSelectedIds.length > 0
      ? multiSelectedIds
      : (builderSelectedNode && nodes.find(n => n.id === builderSelectedNode)?.type !== 'startNode'
          ? [builderSelectedNode]
          : []);
    if (ids.length === 0) return;

    captureHistory(nodes, edges);
    const idSet = new Set(ids);
    setNodes(nds => nds.filter(n => !idSet.has(n.id)));
    setEdges(eds => eds.filter(e => !idSet.has(e.source) && !idSet.has(e.target)));
    setBuilderSelectedNode(null);
    showToast(ids.length > 1 ? `${ids.length} nodes deleted` : 'Node deleted');
  }, [builderSelectedNode, nodes, edges, setNodes, setEdges, setBuilderSelectedNode, showToast, captureHistory]);

  useEffect(() => {
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);

  // ─── Delete node handler (for button click) ───
  const handleDeleteNode = useCallback((nodeId) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node?.type === 'startNode') return;
    captureHistory(nodes, edges);
    setNodes(nds => nds.filter(n => n.id !== nodeId));
    setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId));
    setBuilderSelectedNode(null);
    showToast('Node deleted');
  }, [nodes, setNodes, setEdges, setBuilderSelectedNode, showToast]);

  // ─── Resizable panel ───
  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = panelWidth;

    const onMouseMove = (e) => {
      const diff = startX - e.clientX;
      const newWidth = Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, startWidth + diff));
      setPanelWidth(newWidth);
    };
    const onMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [panelWidth]);

  // Save
  // Explicit Save = bump version (+0.1). Validates required Global Settings
  // first; if invalid, surface the errors instead of silently failing.
  const handleSave = async () => {
    const { valid, errors } = validateBuilderAgent();
    if (!valid) {
      const first = Object.values(errors)[0];
      showToast(first || 'Please complete required fields in Global Settings');
      // Make sure the user can see/fix the errors: bring them to the
      // workflow tab and switch the right rail to Global Settings.
      setActiveTab('Workflow');
      setRightTab('Global Settings');
      // Tell GlobalSettings to surface inline errors immediately
      bumpBuilderValidationAttempt();
      return;
    }
    setSaving(true);
    let newVersion;
    try {
      const viewport = reactFlowInstance.current?.getViewport() || { x: 0, y: 0, zoom: 1 };
      newVersion = await createFlowVersion(nodes, edges, viewport);
      hasUnsavedChanges.current = false;
    } finally {
      setSaving(false);
    }
    if (newVersion) showToast(`Saved as v${newVersion}`);
  };

  // Auto-save: debounced silent saveFlow on flow changes. No toast, no
  // version bump — just keeps the draft on disk so a reload doesn't
  // lose work. Skipped while loading and while an explicit save is in
  // flight to avoid racing.
  useEffect(() => {
    if (!builderFlow || saving) return;
    const snapshot = JSON.stringify({ nodes, edges });
    if (snapshot === lastSavedSnapshot.current) return;
    // `cancelled` guards the writes that happen after the await, which can
    // land long after this effect has torn down.
    let cancelled = false;
    clearTimeout(autoSaveTimer.current);
    setAutoSaveStatus('idle');
    autoSaveTimer.current = setTimeout(async () => {
      setAutoSaveStatus('saving');
      const viewport = reactFlowInstance.current?.getViewport() || { x: 0, y: 0, zoom: 1 };
      await saveFlow(nodes, edges, viewport);
      if (cancelled) return;
      lastSavedSnapshot.current = snapshot;
      setAutoSaveStatus('saved');
    }, 1500);
    return () => {
      cancelled = true;
      clearTimeout(autoSaveTimer.current);
    };
  }, [nodes, edges, builderFlow, saving, saveFlow]);

  // "Saved" is a transient badge that decays back to idle. It lives in its own
  // effect so the timer is created and cleared in the same scope — previously
  // it was spawned inside the async save callback, where the enclosing
  // effect's cleanup had already run by the time it existed.
  useEffect(() => {
    if (autoSaveStatus !== 'saved') return undefined;
    const t = setTimeout(() => setAutoSaveStatus('idle'), 1500);
    return () => clearTimeout(t);
  }, [autoSaveStatus]);

  // Undo / Redo — pop from past/future and apply via setNodes/setEdges.
  // skipHistory prevents the resulting state change from re-recording.
  const handleUndo = useCallback(() => {
    const h = historyRef.current;
    if (h.past.length === 0) return;
    const prev = h.past[h.past.length - 1];
    skipHistory.current = true;
    setNodes(prev.nodes);
    setEdges(prev.edges);
    requestAnimationFrame(() => { skipHistory.current = false; });
    setHistory({
      past: h.past.slice(0, -1),
      future: [...h.future, { nodes, edges }],
    });
  }, [nodes, edges, setNodes, setEdges]);

  const handleRedo = useCallback(() => {
    const h = historyRef.current;
    if (h.future.length === 0) return;
    const next = h.future[h.future.length - 1];
    skipHistory.current = true;
    setNodes(next.nodes);
    setEdges(next.edges);
    requestAnimationFrame(() => { skipHistory.current = false; });
    setHistory({
      past: [...h.past, { nodes, edges }],
      future: h.future.slice(0, -1),
    });
  }, [nodes, edges, setNodes, setEdges]);

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  // Keyboard shortcuts:
  //   ⌘/Ctrl+Z       — undo
  //   ⌘/Ctrl+⇧+Z / Y — redo
  //   V              — switch to Select tool
  //   H              — switch to Hand (Pan) tool
  useEffect(() => {
    const onKey = (e) => {
      // Skip when user is typing in an input/textarea
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return;
      const key = e.key.toLowerCase();
      const mod = e.metaKey || e.ctrlKey;
      if (mod) {
        if (key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); }
        else if ((key === 'z' && e.shiftKey) || key === 'y') { e.preventDefault(); handleRedo(); }
        return;
      }
      if (key === 'v') { e.preventDefault(); setCanvasMode('select'); }
      else if (key === 'h') { e.preventDefault(); setCanvasMode('pan'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleUndo, handleRedo]);

  // Close with unsaved changes check
  const handleCloseBuilder = useCallback(() => {
    if (hasUnsavedChanges.current) {
      setShowCloseDialog(true);
    } else {
      closeBuilder();
    }
  }, [closeBuilder]);

  // Save as new version
  const handleSaveVersion = async () => {
    setSaving(true);
    let ver;
    try {
      const viewport = reactFlowInstance.current?.getViewport() || { x: 0, y: 0, zoom: 1 };
      ver = await createFlowVersion(nodes, edges, viewport);
    } finally {
      setSaving(false);
    }
    showToast(`Version ${ver} created`);
    setShowVersions(false);
  };

  // ─── Auto-arrange nodes in execution order ───
  const handleAutoArrange = useCallback(() => {
    if (!nodes.length) return;
    captureHistory(nodes, edges);

    // Build adjacency list from edges
    const adj = {};
    const inDegree = {};
    nodes.forEach(n => { adj[n.id] = []; inDegree[n.id] = 0; });
    edges.forEach(e => {
      if (adj[e.source]) adj[e.source].push(e.target);
      if (inDegree[e.target] !== undefined) inDegree[e.target]++;
    });

    // Topological sort (BFS / Kahn's algorithm)
    const queue = Object.keys(inDegree).filter(id => inDegree[id] === 0);
    const layers = [];
    const visited = new Set();
    while (queue.length) {
      const layerSize = queue.length;
      const layer = [];
      for (let i = 0; i < layerSize; i++) {
        const id = queue.shift();
        if (visited.has(id)) continue;
        visited.add(id);
        layer.push(id);
        for (const next of (adj[id] || [])) {
          inDegree[next]--;
          if (inDegree[next] <= 0 && !visited.has(next)) queue.push(next);
        }
      }
      if (layer.length) layers.push(layer);
    }
    // Add any unvisited nodes to last layer
    const unvisited = [];
    for (const n of nodes) {
      if (!visited.has(n.id)) unvisited.push(n.id);
    }
    if (unvisited.length) layers.push(unvisited);

    // Position: horizontal layers, vertical spread within each layer
    const NODE_W = 260;
    const NODE_H = 180;
    const LAYER_GAP = 320;
    const NODE_GAP = 200;

    const newNodes = nodes.map(n => {
      let layerIdx = layers.findIndex(l => l.includes(n.id));
      if (layerIdx === -1) layerIdx = layers.length;
      const layerNodes = layers[layerIdx] || [n.id];
      const posInLayer = layerNodes.indexOf(n.id);
      const layerHeight = layerNodes.length * NODE_GAP;
      const startY = -(layerHeight / 2) + 300;

      return {
        ...n,
        position: {
          x: layerIdx * LAYER_GAP + 50,
          y: startY + posInLayer * NODE_GAP,
        },
      };
    });

    setNodes(newNodes);
    setTimeout(() => reactFlowInstance.current?.fitView({ padding: 0.3 }), 100);
    showToast('Nodes arranged in execution order');
  }, [nodes, edges, setNodes, showToast]);

  // Apply chat modification to nodes/edges
  const applyFlowUpdate = useCallback((newNodes, newEdges) => {
    captureHistory(nodes, edges);
    if (newNodes) setNodes(newNodes);
    if (newEdges) setEdges(newEdges);
    setTimeout(() => reactFlowInstance.current?.fitView({ padding: 0.3 }), 100);
  }, [setNodes, setEdges, captureHistory, nodes, edges]);

  // Selected node object
  const selectedNode = useMemo(() => {
    if (!builderSelectedNode) return null;
    return nodes.find(n => n.id === builderSelectedNode) || null;
  }, [builderSelectedNode, nodes]);

  const showNodeSettings = selectedNode && selectedNode.type !== 'startNode';
  return {
    builderAgent, builderFlow, builderFlowLoading, builderVersions, setBuilderSelectedNode,
    autoSaveStatus, nodes, edges, activeTab, setActiveTab, rightTab, setRightTab,
    canvasMode, setCanvasMode, saving, showVersions, setShowVersions,
    panelWidth, isResizing, zoomLevel, showCloseDialog, setShowCloseDialog,
    reactFlowWrapper, reactFlowInstance, wrappedOnNodesChange, wrappedOnEdgesChange,
    handleNodeDragStart, onConnect, onNodeClick, onPaneClick, onInit, onMoveEnd,
    onDragOver, onDrop, handleResizeStart, handleSave, handleUndo, handleRedo,
    canUndo, canRedo, handleCloseBuilder, handleSaveVersion, handleAutoArrange,
    applyFlowUpdate, selectedNode, showNodeSettings, handleDeleteNode,
    closeBuilder, hasUnsavedChanges,
  };
}
