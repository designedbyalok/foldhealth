import { useRef, useState } from 'react';
import { newCategory } from '../../lib/templateCategories';

export const COMMON = 'common';
const EMPTY = { goals: [], interventions: [], barriers: [] };

/**
 * Template categories in an editor whose goal / intervention / barrier state
 * is the section on screen. The editor keeps editing its three lists as
 * before; switching to another section stores them and loads that section's.
 * `snapshot()` gives Common + every category for saving.
 *
 * @param {object[]} initial  The template's categories.
 * @param {{goals, interventions, barriers}} lists  The editor's current lists.
 * @param {{setGoals, setInterventions, setBarriers}} setters
 */
export function useTemplateCategories(initial, lists, setters) {
  const [categories, setCategories] = useState(() => initial || []);
  const [active, setActive] = useState(COMMON);
  // Common's lists while a category is on screen. Only read when switching
  // or saving, so a ref.
  const commonRef = useRef(null);

  const load = (next) => {
    setters.setGoals(next.goals || []);
    setters.setInterventions(next.interventions || []);
    setters.setBarriers(next.barriers || []);
  };
  const current = () => ({ goals: lists.goals, interventions: lists.interventions, barriers: lists.barriers });
  // The categories with the one on screen holding the live lists.
  const stored = () => (active === COMMON
    ? categories
    : categories.map(c => (c.id === active ? { ...c, ...current() } : c)));

  const open = (key, cats) => {
    if (key === COMMON) load(commonRef.current || EMPTY);
    else load(cats.find(c => c.id === key) || EMPTY);
    setActive(key);
  };

  const select = (key) => {
    if (key === active) return;
    if (active === COMMON) commonRef.current = current();
    const cats = stored();
    setCategories(cats);
    open(key, cats);
  };

  const add = () => {
    if (active === COMMON) commonRef.current = current();
    const created = newCategory(`Category ${categories.length + 1}`);
    const cats = [...stored(), created];
    setCategories(cats);
    open(created.id, cats);
  };

  const update = (id, patch) => setCategories(prev => prev.map(c => (c.id === id ? { ...c, ...patch } : c)));

  const remove = (id) => {
    const cats = categories.filter(c => c.id !== id);
    setCategories(cats);
    if (active === id) open(COMMON, cats);
  };

  // Categories are checked in order and the first match wins.
  const move = (id, by) => setCategories((prev) => {
    const i = prev.findIndex(c => c.id === id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= prev.length) return prev;
    const next = [...prev];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });

  const snapshot = () => ({
    ...(active === COMMON ? current() : (commonRef.current || EMPTY)),
    categories: stored(),
  });

  return {
    categories,
    active,
    activeCategory: categories.find(c => c.id === active) || null,
    select,
    add,
    update,
    remove,
    move,
    snapshot,
  };
}
