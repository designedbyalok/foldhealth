import { useEffect, useMemo, useRef, useState } from 'react';
import { renderEmailHtml } from './patchEmailHtml';
import styles from './EmailBuilder.module.css';

// Resolve a preset (built-in or user) to a { rootId, blocks } tree we can
// render. Built-ins ship a `build(genId, name)` function; user presets ship
// a stored `tree`.
function resolvePresetTree(preset) {
  if (preset?.tree) return preset.tree;
  if (preset?.build) {
    let n = 0;
    return preset.build(() => `prev-${preset.id}-${++n}`, preset.previewName || 'Welcome');
  }
  return null;
}

/**
 * LivePreview — renders a header/footer preset as a small thumbnail using
 * the same HTML renderer (patchEmailHtml.renderEmailHtml) the production
 * email export uses. Output is dropped into a sandboxed iframe via srcdoc
 * and CSS-scaled down so it fits in `width`. Auto-measures the rendered
 * body height after the iframe loads so the wrapper hugs the content.
 *
 * Going through the HTML renderer (rather than @usewaypoint/email-builder's
 * Reader) means all custom block types — NavBar, Social, Table — render
 * correctly. Reader on its own throws on those because it only knows the
 * default set.
 *
 * Props:
 *  - preset (object) — built-in or user preset
 *  - width  (number) — final visible width in px; default 240
 *  - sourceWidth (number) — email canvas width the iframe renders at; default 600
 */
export function PresetLivePreview({ preset, width, sourceWidth = 600, fontFamily = 'MODERN_SANS' }) {
  const tree = useMemo(() => resolvePresetTree(preset), [preset]);
  const iframeRef = useRef(null);
  const wrapRef = useRef(null);
  const [innerHeight, setInnerHeight] = useState(120);
  // When `width` isn't passed, the preview measures its container so it
  // always fills the available width (e.g. the parent card).
  const [measuredWidth, setMeasuredWidth] = useState(width || 0);

  useEffect(() => {
    if (typeof width === 'number') return; // explicit width takes precedence
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.floor(entry.contentRect.width);
      if (w > 0) setMeasuredWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  const effectiveWidth = typeof width === 'number' ? width : measuredWidth;

  // Build a minimal EmailLayout doc with just this preset as the root's only
  // child, then render it to the same HTML our production exporter produces.
  const html = useMemo(() => {
    if (!tree) return '';
    const doc = {
      root: {
        type: 'EmailLayout',
        data: {
          backdropColor: '#FFFFFF',
          canvasColor: '#FFFFFF',
          textColor: '#3A485F',
          fontFamily: fontFamily || 'MODERN_SANS',
          childrenIds: [tree.rootId],
        },
      },
      ...tree.blocks,
    };
    // Preset previews suppress the email's outer 24px wrapper padding so the
    // header/footer sits flush at the top of the thumbnail.
    return renderEmailHtml(doc, { wrapperPadding: '0' });
  }, [tree, fontFamily]);

  // After the iframe loads its srcdoc, read the rendered body height so the
  // outer wrapper sizes to the actual preview content.
  useEffect(() => {
    const f = iframeRef.current;
    if (!f) return;
    const onLoad = () => {
      try {
        const body = f.contentDocument?.body;
        if (body) {
          const h = Math.ceil(body.scrollHeight);
          if (h > 0) setInnerHeight(h);
        }
      } catch { /* cross-origin or detached */ }
    };
    f.addEventListener('load', onLoad);
    return () => f.removeEventListener('load', onLoad);
  }, [html]);

  if (!tree || !html) {
    return <div ref={wrapRef} className={styles.livePreviewWrap} style={{ width: width ?? '100%', height: 80 }} />;
  }

  const scale = effectiveWidth > 0 ? effectiveWidth / sourceWidth : 0;
  const scaledHeight = scale > 0 ? Math.max(40, Math.ceil(innerHeight * scale)) : 80;

  return (
    <div
      ref={wrapRef}
      className={styles.livePreviewWrap}
      style={{ width: width ?? '100%', height: scaledHeight }}
    >
      <iframe
        ref={iframeRef}
        title="Preset preview"
        // allow-same-origin only — lets the parent measure body.scrollHeight
        // to size the wrapper. Without allow-scripts the email HTML still
        // can't execute any script content it may contain.
        sandbox="allow-same-origin"
        srcDoc={html}
        scrolling="no"
        className={styles.livePreviewIframe}
        style={{
          width: sourceWidth,
          height: innerHeight,
          transform: `scale(${scale})`,
        }}
      />
    </div>
  );
}
