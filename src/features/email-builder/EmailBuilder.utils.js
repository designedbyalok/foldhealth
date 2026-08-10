import { buildParentMap } from './blockHelpers';

export function getFirstChild(doc, id) {
  if (id === 'root') return doc.root?.data?.childrenIds?.[0] || null;
  const block = doc[id];
  if (!block) return null;
  const props = block.data?.props || {};
  if (Array.isArray(props.childrenIds) && props.childrenIds.length > 0) return props.childrenIds[0];
  if (Array.isArray(props.columns)) {
    for (const col of props.columns) {
      if (col.childrenIds?.length > 0) return col.childrenIds[0];
    }
  }
  return null;
}

export function getParentId(doc, id) {
  if (id === 'root') return null;
  const map = buildParentMap(doc);
  return map[id]?.parentId || null;
}

export const NEW_PREFIX = '__new:';
const EMPTY_PREFIX = '__empty:';

export function parseDropTarget(overId, doc) {
  if (!overId) return null;
  if (overId.startsWith(EMPTY_PREFIX)) {
    const rest = overId.slice(EMPTY_PREFIX.length);
    const parts = rest.split(':');
    if (parts.length === 1) {
      const parent = doc[parts[0]];
      const list = parent?.data?.props?.childrenIds || [];
      return { parentId: parts[0], index: list.length };
    }
    const containerId = parts[0];
    const columnIdx = Number(parts[1]);
    const parent = doc[containerId];
    const list = parent?.data?.props?.columns?.[columnIdx]?.childrenIds || [];
    return { parentId: containerId, columnIdx, index: list.length };
  }
  const map = buildParentMap(doc);
  const slot = map[overId];
  if (!slot) return null;
  return { parentId: slot.parentId, columnIdx: slot.columnIdx, index: slot.index + 1 };
}

export function countChanges(a, b) {
  if (!a || !b) return 0;
  let n = 0;
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of allKeys) {
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) n++;
  }
  return n;
}

export function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function htmlToPlain(html) {
  if (typeof html !== 'string') return '';
  if (typeof document === 'undefined' || !/[<&]/.test(html)) return html;
  // DOMParser builds an inert document: unlike assigning innerHTML on a
  // detached node, nothing here fetches resources or fires handlers such as
  // <img onerror>. We only ever read text back out.
  const doc = new DOMParser().parseFromString(
    html.replace(/<br\s*\/?>/gi, '\n'),
    'text/html',
  );
  return (doc.body.textContent || '').replace(/ /g, ' ');
}
