// ── Default style/props for every block type the editor exposes. ──
// Each factory returns a fresh object so blocks can be safely mutated.
// `createBlock` returns a single block; `createBlockTree` may return many
// (e.g. Hero = Container wrapping a Heading) so the editor can drop a
// preconfigured composite onto the canvas in one click.

const baseStyle = () => ({
  padding: { top: 0, bottom: 0, left: 0, right: 0 },
});

const FACTORIES = {
  Heading: () => ({
    type: 'Heading',
    data: {
      props: { text: 'Write title here', level: 'h2' },
      style: { ...baseStyle(), color: '#3A485F', textAlign: 'center' },
    },
  }),
  Text: () => ({
    type: 'Text',
    data: {
      props: { text: 'Write your email body…' },
      style: {
        ...baseStyle(),
        color: '#3A485F',
        fontSize: 14,
        fontWeight: 'normal',
        textAlign: 'left',
        fontFamily: 'MODERN_SANS',
      },
    },
  }),
  Button: () => ({
    type: 'Button',
    data: {
      props: { text: 'Click me', url: 'https://example.com', size: 'medium', fullWidth: false, buttonStyle: 'rectangle', buttonBackgroundColor: '#7C5CFA', buttonTextColor: '#FFFFFF' },
      style: { padding: { top: 0, bottom: 0, left: 0, right: 0 }, textAlign: 'center' },
    },
  }),
  Image: () => ({
    type: 'Image',
    data: {
      props: { url: 'https://images.unsplash.com/photo-1494232410401-ad00d5433cfa?w=480', alt: 'Placeholder', linkHref: null, contentAlignment: 'middle' },
      style: { padding: { top: 0, bottom: 0, left: 0, right: 0 }, textAlign: 'center' },
    },
  }),
  Avatar: () => ({
    type: 'Avatar',
    data: {
      props: { imageUrl: 'https://i.pravatar.cc/96', alt: 'Avatar', shape: 'circle', size: 64 },
      style: { padding: { top: 0, bottom: 0, left: 0, right: 0 }, textAlign: 'center' },
    },
  }),
  Divider: () => ({
    type: 'Divider',
    data: {
      props: { lineColor: '#E1E4EA', lineHeight: 1 },
      style: { padding: { top: 0, bottom: 0, left: 0, right: 0 } },
    },
  }),
  Spacer: () => ({
    type: 'Spacer',
    data: {
      props: { height: 32 },
      style: { padding: { top: 0, bottom: 0, left: 0, right: 0 } },
    },
  }),
  Container: () => ({
    type: 'Container',
    data: {
      style: { padding: { top: 0, bottom: 0, left: 0, right: 0 }, backgroundColor: '#F6F4FF', gap: 0 },
      props: { childrenIds: [] },
    },
  }),
  ColumnsContainer: () => ({
    type: 'ColumnsContainer',
    data: {
      style: { padding: { top: 0, bottom: 0, left: 0, right: 0 }, gap: 0 },
      props: {
        columnsCount: 2,
        columnsGap: 16,
        contentAlignment: 'top',
        columns: [{ childrenIds: [] }, { childrenIds: [] }, { childrenIds: [] }],
      },
    },
  }),
  RawHtml: () => ({
    type: 'RawHtml',
    data: {
      props: { html: '<div style="padding:24px;background:#FAFAF9;border:1px dashed #E7E5E4;border-radius:8px;font-family:Inter,sans-serif;color:#78716C;text-align:center;font-size:13px">Paste your HTML here</div>' },
      style: { padding: { top: 0, bottom: 0, left: 0, right: 0 } },
    },
  }),
  Social: () => ({
    type: 'Social',
    data: {
      props: {
        platforms: [
          { id: 'twitter',   label: 'Twitter',   url: 'https://twitter.com', iconUrl: 'https://cdn.simpleicons.org/x/000000' },
          { id: 'linkedin',  label: 'LinkedIn',  url: 'https://linkedin.com', iconUrl: 'https://cdn.simpleicons.org/linkedin/0A66C2' },
          { id: 'instagram', label: 'Instagram', url: 'https://instagram.com', iconUrl: 'https://cdn.simpleicons.org/instagram/E4405F' },
        ],
        iconSize: 24,
        gap: 16,
        alignment: 'center',
      },
      style: { padding: { top: 0, bottom: 0, left: 0, right: 0 } },
    },
  }),
  NavBar: () => ({
    type: 'NavBar',
    data: {
      props: {
        links: [
          { label: 'Home', url: '#' },
          { label: 'About', url: '#' },
          { label: 'Contact', url: '#' },
        ],
        alignment: 'center',
        gap: 24,
        linkColor: '#7C5CFA',
        fontSize: 14,
        fontWeight: 'bold',
      },
      style: { padding: { top: 0, bottom: 0, left: 0, right: 0 }, backgroundColor: '#FFFFFF' },
    },
  }),
  Table: () => ({
    type: 'Table',
    data: {
      props: {
        columns: [
          { key: 'col1', header: 'Column 1' },
          { key: 'col2', header: 'Column 2' },
          { key: 'col3', header: 'Column 3' },
        ],
        rows: [
          { col1: 'Row 1', col2: 'Data', col3: 'Data' },
          { col1: 'Row 2', col2: 'Data', col3: 'Data' },
        ],
        headerBg: '#7C5CFA',
        headerColor: '#FFFFFF',
        stripedRows: true,
        stripedColor: '#F6F4FF',
        borderColor: '#E1E4EA',
      },
      style: { ...baseStyle(), fontSize: 13 },
    },
  }),
};

export function createBlock(type) {
  const factory = FACTORIES[type];
  if (!factory) throw new Error(`Unknown block type: ${type}`);
  return factory();
}

export const SUPPORTED_BLOCK_TYPES = Object.keys(FACTORIES);

// ── Composite & layout factories ──────────────────────────────────────────
// Returns { rootId, blocks } so the caller can drop several linked blocks at
// once. The library natively supports Heading/Text/Button/Image/Avatar/
// Divider/Spacer/Container/ColumnsContainer; everything else (Hero, Social,
// Nav Bar, Group, Section, layout presets) is composed from those primitives.

export function createBlockTree(type, genId) {
  // Simple, single-block types fall through to createBlock.
  if (FACTORIES[type]) {
    const id = genId();
    return { rootId: id, blocks: { [id]: createBlock(type) } };
  }

  switch (type) {
    case 'Hero': {
      const headingId = genId();
      const textId = genId();
      const containerId = genId();
      return {
        rootId: containerId,
        blocks: {
          [headingId]: {
            type: 'Heading',
            data: {
              props: { text: 'Hero headline', level: 'h1' },
              style: { color: '#3A485F', textAlign: 'center', padding: { top: 0, bottom: 0, left: 0, right: 0 } },
            },
          },
          [textId]: {
            type: 'Text',
            data: {
              props: { text: 'Add a short tagline here.' },
              style: { color: '#6B7280', fontSize: 14, textAlign: 'center', padding: { top: 0, bottom: 0, left: 0, right: 0 } },
            },
          },
          [containerId]: {
            type: 'Container',
            data: {
              style: { backgroundColor: '#F2EEFE', padding: { top: 0, bottom: 0, left: 0, right: 0 } },
              props: { childrenIds: [headingId, textId] },
            },
          },
        },
      };
    }

    case 'Group': {
      const id = genId();
      return {
        rootId: id,
        blocks: {
          [id]: {
            type: 'Container',
            data: {
              style: { padding: { top: 0, bottom: 0, left: 0, right: 0 } },
              props: { childrenIds: [] },
            },
          },
        },
      };
    }

    case 'Section': {
      // Section = Container with section-like defaults — generous vertical
      // padding and a transparent background so the user can drop it as a
      // structural divider that's visually distinct from a Wrapper (which
      // ships with a colored backdrop).
      const id = genId();
      return {
        rootId: id,
        blocks: {
          [id]: {
            type: 'Container',
            data: {
              alias: 'Section',
              style: { padding: { top: 0, bottom: 0, left: 0, right: 0 } },
              props: { childrenIds: [], contentAlignment: 'center' },
            },
          },
        },
      };
    }

    case 'Column':
      return makeColumns(genId, 2, null);

    // ── Layout presets — preconfigured ColumnsContainer ──
    case 'Layout-2-equal':   return makeColumns(genId, 2, [50, 50]);
    case 'Layout-1-2':       return makeColumns(genId, 2, [33.33, 66.67]);
    case 'Layout-2-1':       return makeColumns(genId, 2, [66.67, 33.33]);
    case 'Layout-3-equal':   return makeColumns(genId, 3, [33.33, 33.33, 33.34]);
    case 'Layout-1-1-2':     return makeColumns(genId, 3, [25, 25, 50]);
    default:
      return null;
  }
}

// Walk the whole document and produce a parent map:
//   { blockId: { parentId: 'root' | string, columnIdx?: 0|1|2, index } }
// Used by the DnD layer to figure out where each draggable block lives so we
// can compute the right insert target on drop.
export function buildParentMap(doc) {
  const map = {};
  const walk = (parentId, childrenIds, columnIdx) => {
    childrenIds.forEach((id, index) => {
      map[id] = { parentId, columnIdx, index };
      const block = doc[id];
      if (!block) return;
      const props = block.data?.props || {};
      if (Array.isArray(props.childrenIds)) {
        walk(id, props.childrenIds);
      } else if (Array.isArray(props.columns)) {
        props.columns.forEach((col, idx) => walk(id, col.childrenIds || [], idx));
      }
    });
  };
  if (doc?.root) walk('root', doc.root.data.childrenIds || []);
  return map;
}

const EMPTY_PREFIX = '__empty:';

export function computeDropPosition(event, doc, activeId) {
  const { over } = event;
  if (!over) return null;
  const overId = String(over.id);

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

  if (overId === activeId) return null;

  const overBlock = doc[overId];
  if (!overBlock) return null;
  const map = buildParentMap(doc);
  const slot = map[overId];
  if (!slot) return null;

  const overRect = over.rect;
  const pointerY = (event.activatorEvent?.clientY || 0) + (event.delta?.y || 0);
  const relY = overRect && overRect.height ? (pointerY - overRect.top) / overRect.height : 0.5;

  const isContainer = overBlock.type === 'Container' || overBlock.type === 'ColumnsContainer';
  if (isContainer && relY > 0.25 && relY < 0.75) {
    if (overBlock.type === 'Container') {
      return { parentId: overId, index: (overBlock.data?.props?.childrenIds || []).length, isNest: true };
    }
    const cols = overBlock.data?.props?.columns || [];
    return { parentId: overId, columnIdx: 0, index: (cols[0]?.childrenIds || []).length, isNest: true };
  }

  return {
    parentId: slot.parentId,
    columnIdx: slot.columnIdx,
    index: relY < 0.5 ? slot.index : slot.index + 1,
  };
}

// Deep-clone a block subtree with fresh ids. Returns { rootId, blocks } in the
// same shape as createBlockTree so the caller can reuse insert logic.
export function cloneBlockTree(doc, sourceId, genId) {
  const blocks = {};
  const cloneOne = (id) => {
    const src = doc[id];
    if (!src) return null;
    const newId = genId();
    const clone = JSON.parse(JSON.stringify(src));
    const data = clone.data || {};
    const props = data.props || {};
    if (Array.isArray(props.childrenIds)) {
      props.childrenIds = props.childrenIds.flatMap(cid => { const c = cloneOne(cid); return c ? [c] : []; });
    }
    if (Array.isArray(props.columns)) {
      props.columns = props.columns.map(col => ({
        ...col,
        childrenIds: (col.childrenIds || []).flatMap(cid => { const c = cloneOne(cid); return c ? [c] : []; }),
      }));
    }
    blocks[newId] = clone;
    return newId;
  };
  const rootId = cloneOne(sourceId);
  return rootId ? { rootId, blocks } : null;
}

// Extract a self-contained { rootId, blocks } subtree from a live document.
// Used when saving the currently-selected header/footer to the preset library —
// the returned object has the same shape replaceHeaderFooter() expects, and
// can be re-IDed via cloneStoredTree() before being applied somewhere else.
export function extractSubtree(doc, rootId) {
  const ids = collectBlockTree(doc, rootId);
  const blocks = {};
  ids.forEach(id => {
    if (doc[id]) blocks[id] = JSON.parse(JSON.stringify(doc[id]));
  });
  return { rootId, blocks };
}

// Produce a stable, ID-independent fingerprint of a { rootId, blocks } subtree
// so two trees with different block ids but the same shape + props compare
// equal. Walks from root, replaces each block's id with a sequential token,
// rewrites childrenIds / columns references, and emits a JSON string.
//
// Used by the Save-as-preset affordance to detect whether the currently
// selected header/footer is byte-equal to a built-in (or already-saved)
// preset — if so, saving would duplicate, so we hide the button.
export function fingerprintTree(tree) {
  if (!tree?.rootId || !tree?.blocks) return '';
  const order = [];
  const visited = new Set();
  const visit = (id) => {
    if (!id || visited.has(id) || !tree.blocks[id]) return;
    visited.add(id);
    order.push(id);
    const props = tree.blocks[id].data?.props;
    if (props?.childrenIds) props.childrenIds.forEach(visit);
    if (Array.isArray(props?.columns)) {
      props.columns.forEach(col => (col.childrenIds || []).forEach(visit));
    }
  };
  visit(tree.rootId);
  const idMap = {};
  order.forEach((id, i) => { idMap[id] = `n${i}`; });
  const normalized = order.map(oldId => {
    const block = JSON.parse(JSON.stringify(tree.blocks[oldId]));
    const props = block.data?.props;
    if (props) {
      if (Array.isArray(props.childrenIds)) {
        props.childrenIds = props.childrenIds.map(c => idMap[c] || c);
      }
      if (Array.isArray(props.columns)) {
        props.columns = props.columns.map(col => ({
          ...col,
          childrenIds: (col.childrenIds || []).map(c => idMap[c] || c),
        }));
      }
    }
    return [idMap[oldId], block];
  });
  return JSON.stringify(normalized);
}

// Re-ID a stored { rootId, blocks } subtree. Old → new id mapping is built
// up-front, then every childrenIds / columns reference is rewritten in one
// pass. Returns a fresh tree safe to merge into a document without collision.
export function cloneStoredTree(stored, genId) {
  if (!stored?.rootId || !stored?.blocks) return null;
  const idMap = {};
  for (const oldId of Object.keys(stored.blocks)) idMap[oldId] = genId();
  const blocks = {};
  for (const [oldId, block] of Object.entries(stored.blocks)) {
    const cloned = JSON.parse(JSON.stringify(block));
    const props = cloned.data?.props;
    if (props) {
      if (Array.isArray(props.childrenIds)) {
        props.childrenIds = props.childrenIds.map(cid => idMap[cid] || cid);
      }
      if (Array.isArray(props.columns)) {
        props.columns = props.columns.map(col => ({
          ...col,
          childrenIds: (col.childrenIds || []).map(cid => idMap[cid] || cid),
        }));
      }
    }
    blocks[idMap[oldId]] = cloned;
  }
  return { rootId: idMap[stored.rootId], blocks };
}

// Walk a block + descendants and return all ids that belong to the subtree.
// Used when we need to remove a header/footer cleanly without orphan blocks.
export function collectBlockTree(doc, rootId) {
  const ids = [];
  const visit = (id) => {
    if (!id || !doc[id] || ids.includes(id)) return;
    ids.push(id);
    const block = doc[id];
    const data = block.data || {};
    const props = data.props || {};
    if (Array.isArray(props.childrenIds)) props.childrenIds.forEach(visit);
    if (Array.isArray(props.columns)) props.columns.forEach(c => (c.childrenIds || []).forEach(visit));
  };
  visit(rootId);
  return ids;
}

function makeColumns(genId, count, columnWidths) {
  const root = genId();
  const cols = Array.from({ length: Math.max(count, 3) }, () => ({ childrenIds: [] }));
  const widths = columnWidths || Array.from({ length: count }, () => Math.round(10000 / count) / 100);
  return {
    rootId: root,
    blocks: {
      [root]: {
        type: 'ColumnsContainer',
        data: {
          style: { padding: { top: 0, bottom: 0, left: 0, right: 0 } },
          props: {
            columnsCount: count,
            columnsGap: 16,
            contentAlignment: 'top',
            columns: cols,
            columnWidths: widths,
          },
        },
      },
    },
  };
}
