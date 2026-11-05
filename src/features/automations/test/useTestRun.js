import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { orderedSteps } from '../lib/graph';
import { testStep } from '../lib/simulate';

const RUN_MS = 900;
const ADVANCE_MS = 700;

/**
 * The step-by-step test run (Figma test grid, steps 1–11).
 * phase: 'intro' | 'steps' | 'done'
 * Each step: 'ready' → 'running' → 'success' | 'error' | 'skipped'.
 * Nothing is sent or created; a step checks its own setup (lib/simulate testStep).
 */
export function useTestRun(graph) {
  const steps = useMemo(() => orderedSteps(graph), [graph]);
  const [phase, setPhase] = useState('intro');
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState({}); // { [nodeId]: { status, errors } }
  const [running, setRunning] = useState(false);
  const [autoplay, setAutoplay] = useState(false);
  const timers = useRef([]);
  // The latest steps, for timer callbacks.
  const live = useRef({ steps });
  useEffect(() => { live.current = { steps }; }, [steps]);

  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const current = steps[index] || null;
  const result = current ? results[current.id] : null;

  // Run step i; on success move to the next step.
  const runAt = useCallback((i) => {
    const node = live.current.steps[i];
    if (!node) return;
    setRunning(true);
    setResults(r => ({ ...r, [node.id]: { status: 'running', errors: [] } }));
    later(() => {
      // Test the step as it is now (the author may have just fixed it).
      const fresh = live.current.steps.find(s => s.id === node.id) || node;
      const res = testStep(fresh);
      setResults(r => ({ ...r, [node.id]: res }));
      setRunning(false);
      if (res.status === 'error') { setAutoplay(false); return; }
      later(() => {
        if (i + 1 >= live.current.steps.length) { setPhase('done'); setAutoplay(false); return; }
        setIndex(i + 1);
      }, ADVANCE_MS);
    }, RUN_MS);
  }, []);

  // Play All Steps: each new step that hasn't run yet starts on its own.
  useEffect(() => {
    if (!autoplay || phase !== 'steps' || running || !current || results[current.id]) return undefined;
    const t = setTimeout(() => runAt(index), 0);
    return () => clearTimeout(t);
  }, [autoplay, phase, running, current, results, index, runAt]);

  const run = useCallback(() => { if (!running) runAt(index); }, [running, runAt, index]);

  const skip = useCallback(() => {
    if (!current) return;
    setResults(r => ({ ...r, [current.id]: { status: 'skipped', errors: [] } }));
    if (index + 1 >= steps.length) { setPhase('done'); return; }
    setIndex(index + 1);
  }, [current, index, steps.length]);

  const playAll = useCallback(() => setAutoplay(true), []);

  const start = useCallback(() => { setPhase('steps'); setIndex(0); setResults({}); }, []);
  const stop = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setAutoplay(false);
    setRunning(false);
  }, []);

  // Per-node canvas state.
  const nodeState = useMemo(() => {
    const out = {};
    steps.forEach((s, i) => {
      const r = results[s.id];
      if (phase === 'intro') { out[s.id] = 'pending'; return; }
      if (r?.status === 'running') out[s.id] = 'running';
      else if (r?.status) out[s.id] = r.status;
      else if (i === index && phase === 'steps') out[s.id] = 'current';
      else out[s.id] = 'pending';
    });
    return out;
  }, [steps, results, index, phase]);

  const summary = useMemo(() => {
    // Delays are skipped by design, not by the author: they don't count.
    const vals = steps.filter(s => s.type !== 'delay').map(s => results[s.id]?.status);
    return {
      passed: vals.filter(v => v === 'success').length,
      skipped: vals.filter(v => v === 'skipped').length,
      failed: vals.filter(v => v === 'error').length,
    };
  }, [steps, results]);

  return {
    steps, phase, index, current, result, running, autoplay, nodeState, summary,
    start, run, skip, stop, playAll,
  };
}
