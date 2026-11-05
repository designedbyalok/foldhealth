import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import {
  allowedAt, branchesOf, childrenOf, deleteNode, descendantIds, emptyGraph, findDuplicates, getNode,
  graphProblems, insertBetween, insertMicroAutomation, insertNode, pruneBranches, setTrigger, updateNodeConfig,
} from '../lib/graph';
import { nodeDef } from '../lib/catalog';

const AUTOSAVE_MS = 10 * 60 * 1000;

/** Where a palette click lands when no "+" is selected: under the selected node, else the end of the main path. */
export function defaultSlot(graph, selectedId) {
  const open = (node) => {
    const b = branchesOf(node);
    if (!b.length) return null;
    const empty = b.find(x => !childrenOf(graph, node.id, x.key).length);
    return empty ? { parentId: node.id, branch: empty.key } : null;
  };
  const sel = selectedId && getNode(graph, selectedId);
  if (sel) {
    const s = open(sel);
    if (s) return s;
  }
  let cur = getNode(graph, 'trigger');
  while (cur) {
    const s = open(cur);
    if (s) return s;
    const next = childrenOf(graph, cur.id)[0];
    if (!next) return null;
    cur = next;
  }
  return null;
}

const snapshot = (s) => JSON.stringify([s.name, s.description, s.status, s.schedule, s.runTime, s.populationGroupId, s.graph]);

/**
 * State and edits for one automation in the builder. `id` is an automation id
 * or 'new' (opened blank, from a template, or as a copy: `automationNew`).
 */
export function useAutomationBuilder(id) {
  const automation = useAppStore(s => (id === 'new' ? null : s.automations.find(a => a.id === id)));
  const seed = useAppStore(s => s.automationNew);
  const saveAutomation = useAppStore(s => s.saveAutomation);
  const saveAutomationDraft = useAppStore(s => s.saveAutomationDraft);
  const isNew = id === 'new';

  const initial = () => {
    if (isNew) {
      return {
        name: seed?.name || 'New Automation',
        description: seed?.description || '',
        status: 'draft',
        schedule: seed?.schedule || 'onTrigger',
        runTime: null,
        populationGroupId: null,
        populationGroupName: null,
        templateId: seed?.templateId || null,
        graph: seed?.graph ? structuredClone(seed.graph) : emptyGraph(),
      };
    }
    if (!automation) return null;
    return {
      name: automation.name,
      description: automation.description,
      status: automation.status,
      schedule: automation.schedule,
      runTime: automation.runTime,
      populationGroupId: automation.populationGroupId,
      populationGroupName: automation.populationGroupName,
      templateId: automation.templateId,
      // The working copy, when an autosave left one, is what the author edits.
      graph: structuredClone(automation.draftGraph || automation.graph),
    };
  };

  // Read once on open: later store updates (our own saves) must not reset edits.
  // The caller mounts this only once the automation is loaded.
  const [state, setState] = useState(initial);
  const [persisted, setPersisted] = useState(() => (state ? snapshot(state) : null));
  const [selectedId, setSelectedId] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [panel, setPanel] = useState(null); // { kind: 'trigger' | 'node' | 'save' | 'test' | 'micro', id?, slot? }
  const [lastAutosave, setLastAutosave] = useState(null);

  const graph = state?.graph || emptyGraph();
  const dirty = !!state && snapshot(state) !== persisted;
  const hasDraftCopy = !isNew && !!automation?.draftGraph;

  const patch = useCallback((p) => setState(s => ({ ...s, ...p })), []);
  const setGraph = useCallback((fn) => setState(s => ({ ...s, graph: typeof fn === 'function' ? fn(s.graph) : fn })), []);

  // ── Autosave (existing automations): the working copy only ──
  const stateRef = useRef(state);
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    stateRef.current = state;
    dirtyRef.current = dirty;
  }, [state, dirty]);
  useEffect(() => {
    if (isNew) return undefined;
    const t = setInterval(async () => {
      if (!dirtyRef.current || !stateRef.current) return;
      const ok = await saveAutomationDraft(id, stateRef.current.graph);
      if (ok) {
        setPersisted(snapshot(stateRef.current));
        setLastAutosave(new Date());
      }
    }, AUTOSAVE_MS);
    return () => clearInterval(t);
  }, [id, isNew, saveAutomationDraft]);

  // ── Edits ──
  const triggerType = getNode(graph, 'trigger')?.type || null;

  const chooseTrigger = useCallback((type, config = {}) => {
    setGraph(g => setTrigger(g, type, config));
  }, [setGraph]);

  const insertAt = useCallback((type, slot) => {
    const target = slot || defaultSlot(graph, selectedId);
    if (!target) return null;
    if (!allowedAt(graph, target)(type)) return null;
    if (type === 'microAutomation') {
      setPanel({ kind: 'micro', slot: target });
      return null;
    }
    const { graph: next, node } = insertNode(graph, { ...target, type });
    setGraph(next);
    setSelectedSlot(null);
    setSelectedId(node.id);
    // Steps that need setup open their editor straight away.
    const def = nodeDef(type);
    if (def?.kind !== 'logic' || type === 'delay' || type === 'repeat') setPanel({ kind: 'node', id: node.id });
    return node;
  }, [graph, selectedId, setGraph]);

  const insertMicro = useCallback((template, slot) => {
    const { graph: next, node } = insertMicroAutomation(graph, { ...slot, template });
    setGraph(next);
    setSelectedSlot(null);
    setSelectedId(node.id);
    setPanel(null);
  }, [graph, setGraph]);

  const updateConfig = useCallback((nodeId, config) => {
    setGraph(g => pruneBranches(updateNodeConfig(g, nodeId, config), nodeId));
  }, [setGraph]);

  const removeNode = useCallback((nodeId) => {
    setGraph(g => deleteNode(g, nodeId));
    if (selectedId === nodeId) setSelectedId(null);
    setPanel(p => (p?.id === nodeId ? null : p));
  }, [selectedId, setGraph]);

  const addDelayBefore = useCallback((nodeId, config = { amount: 2, unit: 'days' }) => {
    const { graph: next, node } = insertBetween(graph, nodeId, 'delay', config);
    setGraph(next);
    if (node) { setSelectedId(node.id); setPanel({ kind: 'node', id: node.id }); }
  }, [graph, setGraph]);

  const duplicates = useMemo(() => findDuplicates(graph), [graph]);
  const problems = useMemo(() => graphProblems(graph), [graph]);
  const subtreeSize = useCallback((nodeId) => descendantIds(graph, nodeId).length, [graph]);

  // ── Save ──
  const save = useCallback(async (values = {}) => {
    const next = { ...state, ...values };
    const saved = await saveAutomation({ ...next, draftGraph: null }, isNew ? null : id);
    if (saved) {
      setState(next);
      setPersisted(snapshot(next));
    }
    return saved;
  }, [state, saveAutomation, isNew, id]);

  const discardDraftCopy = useCallback(async () => {
    if (!automation) return;
    await saveAutomationDraft(id, null);
    const fresh = { ...state, graph: structuredClone(automation.graph) };
    setState(fresh);
    setPersisted(snapshot(fresh));
  }, [automation, id, saveAutomationDraft, state]);

  return {
    isNew, automation, state, patch, graph, setGraph, dirty, hasDraftCopy, lastAutosave,
    selectedId, setSelectedId, selectedSlot, setSelectedSlot, panel, setPanel,
    triggerType, chooseTrigger, insertAt, insertMicro, updateConfig, removeNode, addDelayBefore,
    duplicates, problems, subtreeSize, save, discardDraftCopy,
    ready: !!state,
  };
}
