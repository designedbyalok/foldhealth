/**
 * Pure helpers for the form layout/view modes. No React.
 *
 * Three layouts: 'by-question' (Typeform-style, paged), 'by-section' (paged by
 * section), 'entire-page' (one scrolling page: the default + legacy behavior).
 */

export const LAYOUTS = { 'by-question': 1, 'by-section': 1, 'entire-page': 1 };

// Backward-compatible: unknown / absent / the old 'sectioned' constant all map
// to 'entire-page' so existing forms render exactly as they do today.
export function normalizeLayout(v) {
  return LAYOUTS[v] ? v : 'entire-page';
}

/**
 * Build the step list for a paged layout.
 * - A top-level `group` (health component / validated instrument) is always its
 *   own step rendering all its items.
 * - 'by-question': each loose top-level field is its own step.
 * - 'by-section': consecutive loose top-level fields bundle into one step.
 * `single` flags a step that is a single single-select choice → auto-advance.
 * @returns {{id:string,title:string|null,items:object[],single:boolean}[]}
 */
export function buildSteps(fields, mode) {
  const steps = [];
  let bucket = null;
  const flush = () => { if (bucket) { steps.push(bucket); bucket = null; } };
  for (const f of fields || []) {
    if (f.type === 'group') {
      flush();
      steps.push({ id: f.linkId, title: f.text || null, items: [f], single: false });
    } else if (mode === 'by-question') {
      flush();
      const single = f.type === 'choice' && f.control !== 'checkbox';
      steps.push({ id: f.linkId, title: null, items: [f], single });
    } else {
      if (!bucket) bucket = { id: `loose-${f.linkId}`, title: null, items: [], single: false };
      bucket.items.push(f);
    }
  }
  flush();
  return steps;
}

/** A field is visible unless the engine's visibility map explicitly marks it false. */
export function isVisible(linkId, visibility) {
  return !visibility || visibility[linkId] !== false;
}

/**
 * Build the one-question-at-a-time flow used by the paged renderers.
 * Both modes show ONE question per screen; they differ in section metadata:
 * - 'by-question': flat list, no sections.
 * - 'by-section': questions grouped into sections (top-level group = a section;
 *   consecutive loose fields = a "Questions" section) for the top stepper.
 *
 * `visibility` (optional, from evaluate().visibility) drives branching: any leaf
 * marked hidden is dropped from the flow, and a section that ends up empty is
 * omitted. Omit it and the flow is fully linear (legacy behavior).
 * @returns {{questions:{field:object,sectionIndex:number|null}[], sections:{title:string,count:number}[]|null}}
 */
export function buildFlow(fields, mode, visibility) {
  if (mode === 'by-question') {
    return { questions: leavesOf(fields, visibility).map((field) => ({ field, sectionIndex: null })), sections: null };
  }
  const sections = [];
  const questions = [];
  let bucket = null;
  const flush = () => {
    if (bucket && bucket.items.length) {
      const si = sections.length;
      sections.push({ title: bucket.title, count: bucket.items.length });
      bucket.items.forEach((field) => questions.push({ field, sectionIndex: si }));
    }
    bucket = null;
  };
  for (const f of fields || []) {
    if (f.type === 'group') {
      flush();
      if (!isVisible(f.linkId, visibility)) continue;       // whole section hidden
      const items = leavesOf(f.items, visibility);
      if (!items.length) continue;
      const si = sections.length;
      sections.push({ title: f.text || 'Section', count: items.length });
      items.forEach((field) => questions.push({ field, sectionIndex: si }));
    } else {
      if (!isVisible(f.linkId, visibility)) continue;
      if (!bucket) bucket = { title: 'Questions', items: [] };
      bucket.items.push(f);
    }
  }
  flush();
  return { questions, sections };
}

/**
 * Flatten a list of items to their answerable leaves (descends into groups).
 * With `visibility`, hidden leaves (and the contents of hidden groups) are skipped.
 */
export function leavesOf(items, visibility) {
  const out = [];
  const walk = (list) => (list || []).forEach((f) => {
    if (!isVisible(f.linkId, visibility)) return;           // skip hidden field / group subtree
    if (f.items) walk(f.items);
    else out.push(f);
  });
  walk(items);
  return out;
}

/** Required, non-display, visible leaves within a set of items (for validation). */
export function requiredLeaves(items, visibility) {
  return leavesOf(items, visibility).filter((f) => f.required && f.type !== 'display');
}
