import { useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import styles from './EmailBuilder.module.css';

export function getCommonValue(blocks, getter) {
  if (blocks.length === 0) return undefined;
  const first = getter(blocks[0]);
  return blocks.every(b => getter(b) === first) ? first : undefined;
}

export function OverlayVerticalScroll({ innerRef, className, children, ...rest }) {
  const localRef = useRef(null);
  const setRef = (el) => {
    localRef.current = el;
    if (typeof innerRef === 'function') innerRef(el);
    else if (innerRef) innerRef.current = el;
  };
  const [vThumb, setVThumb] = useState({ visible: false, top: 0, height: 0 });
  const [hThumb, setHThumb] = useState({ visible: false, left: 0, width: 0 });
  const draggingRef = useRef(null);

  useEffect(() => {
    const el = localRef.current;
    if (!el) return;
    const update = () => {
      const { scrollTop, scrollLeft, scrollHeight, clientHeight, scrollWidth, clientWidth } = el;
      // Vertical
      if (scrollHeight <= clientHeight) {
        setVThumb((t) => (t.visible ? { visible: false, top: 0, height: 0 } : t));
      } else {
        const ratio = clientHeight / scrollHeight;
        const height = Math.max(24, clientHeight * ratio);
        const maxThumbTop = clientHeight - height;
        const maxScroll = scrollHeight - clientHeight;
        const top = maxScroll > 0 ? (scrollTop / maxScroll) * maxThumbTop : 0;
        setVThumb({ visible: true, top, height });
      }
      // Horizontal
      if (scrollWidth <= clientWidth) {
        setHThumb((t) => (t.visible ? { visible: false, left: 0, width: 0 } : t));
      } else {
        const ratio = clientWidth / scrollWidth;
        const width = Math.max(24, clientWidth * ratio);
        const maxThumbLeft = clientWidth - width;
        const maxScroll = scrollWidth - clientWidth;
        const left = maxScroll > 0 ? (scrollLeft / maxScroll) * maxThumbLeft : 0;
        setHThumb({ visible: true, left, width });
      }
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    const mo = new MutationObserver(update);
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
      mo.disconnect();
    };
  }, []);

  const onVerticalDown = (e) => {
    e.preventDefault();
    const el = localRef.current;
    if (!el) return;
    const startY = e.clientY;
    const startScrollTop = el.scrollTop;
    const trackHeight = el.clientHeight - vThumb.height;
    const maxScroll = el.scrollHeight - el.clientHeight;
    draggingRef.current = 'v';
    const move = (ev) => {
      if (draggingRef.current !== 'v') return;
      const dy = ev.clientY - startY;
      const ratio = trackHeight > 0 ? dy / trackHeight : 0;
      el.scrollTop = Math.max(0, Math.min(maxScroll, startScrollTop + ratio * maxScroll));
    };
    const up = () => { draggingRef.current = null; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const onHorizontalDown = (e) => {
    e.preventDefault();
    const el = localRef.current;
    if (!el) return;
    const startX = e.clientX;
    const startScrollLeft = el.scrollLeft;
    const trackWidth = el.clientWidth - hThumb.width;
    const maxScroll = el.scrollWidth - el.clientWidth;
    draggingRef.current = 'h';
    const move = (ev) => {
      if (draggingRef.current !== 'h') return;
      const dx = ev.clientX - startX;
      const ratio = trackWidth > 0 ? dx / trackWidth : 0;
      el.scrollLeft = Math.max(0, Math.min(maxScroll, startScrollLeft + ratio * maxScroll));
    };
    const up = () => { draggingRef.current = null; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  return (
    <div className={styles.overlayScrollWrap}>
      <div
        ref={setRef}
        className={[styles.overlayScrollInner, className].filter(Boolean).join(' ')}
        {...rest}
      >
        {children}
      </div>
      {vThumb.visible && (
        <div
          className={styles.overlayScrollThumb}
          style={{ top: vThumb.top, height: vThumb.height }}
          onMouseDown={onVerticalDown}
        />
      )}
      {hThumb.visible && (
        <div
          className={styles.overlayScrollThumbH}
          style={{ left: hThumb.left, width: hThumb.width }}
          onMouseDown={onHorizontalDown}
        />
      )}
    </div>
  );
}


export function convertMjmlToFold(mjml) {
  let counter = 0;
  const genId = () => `imported-${++counter}`;
  const blocks = {};

  function parsePadding(str) {
    if (!str) return { top: 0, right: 0, bottom: 0, left: 0 };
    const parts = str.replace(/px/g, '').trim().split(/\s+/).map(Number);
    if (parts.length === 1) return { top: parts[0], right: parts[0], bottom: parts[0], left: parts[0] };
    if (parts.length === 2) return { top: parts[0], right: parts[1], bottom: parts[0], left: parts[1] };
    if (parts.length === 4) return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[3] };
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  function pxToNum(val) {
    if (!val) return undefined;
    return parseInt(String(val).replace('px', ''), 10) || undefined;
  }

  function stripHtml(html) {
    return html?.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '') || '';
  }

  function convertNode(node) {
    if (!node || !node.type) return null;
    const a = node.attributes || {};
    const val = node.data?.value || {};

    switch (node.type) {
      case 'image': {
        const id = genId();
        blocks[id] = {
          type: 'Image',
          data: {
            props: { url: a.src || '', alt: a.alt || '', width: pxToNum(a.width) },
            style: { padding: parsePadding(a.padding), textAlign: a.align || 'center' },
          },
        };
        return id;
      }
      case 'text': {
        const id = genId();
        const content = val.content || '';
        const isHeading = pxToNum(a['font-size']) >= 24;
        blocks[id] = {
          type: isHeading ? 'Heading' : 'Text',
          data: {
            props: { text: content, ...(isHeading ? { level: 'h2' } : {}) },
            style: {
              padding: parsePadding(a.padding),
              color: a.color || '#3A485F',
              fontSize: pxToNum(a['font-size']) || 14,
              fontWeight: a['font-weight'] || 'normal',
              textAlign: a.align || 'left',
            },
          },
        };
        return id;
      }
      case 'button': {
        const id = genId();
        blocks[id] = {
          type: 'Button',
          data: {
            props: {
              text: val.content || stripHtml(a['inner-text'] || 'Click me'),
              url: a.href || '#',
              buttonBackgroundColor: a['background-color'] || '#7C5CFA',
              buttonTextColor: a.color || '#FFFFFF',
            },
            style: { padding: parsePadding(a.padding), textAlign: a.align || 'center' },
          },
        };
        return id;
      }
      case 'divider':
      case 'advanced_divider': {
        const id = genId();
        blocks[id] = {
          type: 'Divider',
          data: {
            props: { lineColor: a['border-color'] || '#E1E4EA', lineHeight: pxToNum(a['border-width']) || 1 },
            style: { padding: parsePadding(a.padding) },
          },
        };
        return id;
      }
      case 'spacer': {
        const id = genId();
        blocks[id] = {
          type: 'Spacer',
          data: {
            props: { height: pxToNum(a.height) || 32 },
            style: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
          },
        };
        return id;
      }
      case 'column': {
        const childIds = (node.children || []).flatMap(child => { const id = convertNode(child); return id ? [id] : []; });
        return childIds;
      }
      case 'group':
      case 'section': {
        const columns = [];
        const flatChildren = [];
        for (const child of (node.children || [])) {
          if (child.type === 'group') {
            for (const gc of (child.children || [])) {
              if (gc.type === 'column') {
                columns.push((gc.children || []).flatMap(child => { const id = convertNode(child); return id ? [id] : []; }));
              } else {
                const cid = convertNode(gc);
                if (cid) flatChildren.push(cid);
              }
            }
          } else if (child.type === 'column') {
            columns.push((child.children || []).flatMap(gc => { const id = convertNode(gc); return id ? [id] : []; }));
          } else {
            const cid = convertNode(child);
            if (cid) flatChildren.push(cid);
          }
        }

        if (columns.length > 1) {
          const id = genId();
          blocks[id] = {
            type: 'ColumnsContainer',
            data: {
              style: { padding: parsePadding(a.padding), backgroundColor: a['background-color'] },
              props: {
                columnsCount: columns.length,
                columnsGap: 16,
                columns: columns.map(col => ({ childrenIds: col.flat() })),
              },
            },
          };
          return id;
        }

        const allChildIds = [...flatChildren, ...columns.flat(2)];
        if (allChildIds.length === 0) return null;

        if (a['background-color'] && a['background-color'] !== 'white' && a['background-color'] !== '#FFFFFF' && a['background-color'] !== '#ffffff') {
          const id = genId();
          blocks[id] = {
            type: 'Container',
            data: {
              style: { padding: parsePadding(a.padding), backgroundColor: a['background-color'] },
              props: { childrenIds: allChildIds },
            },
          };
          return id;
        }

        return allChildIds;
      }
      case 'wrapper': {
        const ids = [];
        for (const wc of (node.children || [])) {
          const r = convertNode(wc);
          if (Array.isArray(r)) ids.push(...r);
          else if (r) ids.push(r);
        }
        if (ids.length === 0) return null;
        if (a['background-color'] && a['background-color'] !== 'white' && a['background-color'] !== '#FFFFFF' && a['background-color'] !== '#ffffff') {
          const id = genId();
          blocks[id] = {
            type: 'Container',
            data: {
              style: { padding: parsePadding(a.padding), backgroundColor: a['background-color'] },
              props: { childrenIds: ids },
            },
          };
          return id;
        }
        return ids;
      }
      default:
        return null;
    }
  }

  const rootChildIds = [];
  for (const child of (mjml.children || [])) {
    const result = convertNode(child);
    if (Array.isArray(result)) rootChildIds.push(...result);
    else if (result) rootChildIds.push(result);
  }

  const pageAttrs = mjml.attributes || {};
  const pageValue = mjml.data?.value || {};

  const doc = {
    root: {
      type: 'EmailLayout',
      data: {
        backdropColor: pageAttrs['background-color'] || '#F2EEFE',
        canvasColor: '#FFFFFF',
        textColor: pageValue['text-color'] || '#3A485F',
        fontFamily: 'MODERN_SANS',
        childrenIds: rootChildIds,
      },
    },
    ...blocks,
  };

  return doc;
}

// ── Code tab ────────────────────────────────────────────────────────────────
// Drop any stale `customHtml` from a doc so it routes through the
// SortableBlock pipeline (full toolbar/DnD). Idempotent — safe to call on
// docs that don't have it.
export function stripCustomHtml(d) {
  if (!d?.root?.data) return d;
  if (!('customHtml' in d.root.data)) return d;
  const { customHtml: _drop, ...rest } = d.root.data;
  return { ...d, root: { ...d.root, data: rest } };
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

export function highlightJson(input) {
  // Walk char-by-char to avoid mistaking strings for keys/values.
  // Simpler: regex over escaped output.
  const safe = escapeHtml(input);
  return safe.replace(
    /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false)\b|\b(null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (m, str, colon, bool, nul, num) => {
      if (str !== undefined) {
        if (colon) return `<span class="${styles.tokKey}">${str}</span>${colon}`;
        return `<span class="${styles.tokString}">${str}</span>`;
      }
      if (bool !== undefined) return `<span class="${styles.tokBoolean}">${bool}</span>`;
      if (nul !== undefined) return `<span class="${styles.tokNull}">${nul}</span>`;
      if (num !== undefined) return `<span class="${styles.tokNumber}">${num}</span>`;
      return m;
    }
  );
}

export function highlightHtml(input) {
  const safe = escapeHtml(input);
  // Highlight tags: &lt;tagname …&gt;  and attributes attr="value"
  return safe.replace(/(&lt;\/?)([A-Za-z][\w-]*)((?:\s+[A-Za-z_:][\w:.-]*(?:=(?:&quot;[^&]*&quot;|&#39;[^&]*&#39;|[^\s&]+))?)*)(\s*\/?&gt;)/g,
    (_m, lt, tag, attrs, gt) => {
      const attrPart = attrs.replace(/(\s+)([A-Za-z_:][\w:.-]*)(=)(&quot;[^&]*&quot;|&#39;[^&]*&#39;)/g,
        (_a, ws, name, eq, val) =>
          `${ws}<span class="${styles.tokAttr}">${name}</span>${eq}<span class="${styles.tokString}">${val}</span>`
      );
      return `<span class="${styles.tokPunct}">${lt}</span><span class="${styles.tokTag}">${tag}</span>${attrPart}<span class="${styles.tokPunct}">${gt}</span>`;
    }
  );
}

// ── Template tab ────────────────────────────────────────────────────────────

