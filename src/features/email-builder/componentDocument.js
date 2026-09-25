/**
 * Saved header / footer components are stored as `{ rootId, blocks }`
 * (see extractSubtree). These turn one into a whole builder document and
 * back, so the email builder can edit a component on its own.
 */
import { extractSubtree } from './blockHelpers';

/** A document holding just `tree`, on a plain white page. */
export function componentToDocument(tree) {
  return {
    root: {
      type: 'EmailLayout',
      data: {
        backdropColor: '#FFFFFF',
        canvasColor: '#FFFFFF',
        textColor: '#3A485F',
        fontFamily: 'Inter',
        childrenIds: tree?.rootId ? [tree.rootId] : [],
      },
    },
    ...(tree?.blocks || {}),
  };
}

/**
 * The component in `doc`, tagged with `role`. A single top-level Container
 * is the component itself; anything else is wrapped in a new Container so
 * the component always has one root.
 */
export function documentToComponent(doc, role) {
  const top = doc?.root?.data?.childrenIds || [];
  if (!top.length) return null;
  if (top.length === 1 && doc[top[0]]?.type === 'Container') {
    const tree = extractSubtree(doc, top[0]);
    tree.blocks[tree.rootId] = { ...tree.blocks[tree.rootId], data: { ...tree.blocks[tree.rootId].data, role } };
    return tree;
  }
  const rootId = `component-root-${Date.now()}`;
  const blocks = {};
  for (const id of top) Object.assign(blocks, extractSubtree(doc, id).blocks);
  blocks[rootId] = { type: 'Container', data: { role, style: { padding: { top: 0, bottom: 0, left: 0, right: 0 } }, props: { childrenIds: top } } };
  return { rootId, blocks };
}
