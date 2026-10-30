import { useCallback, useEffect, useMemo, useState } from 'react';
import { Rnd } from 'react-rnd';
import { useDropzone } from 'react-dropzone';
import { pickElement, describeElement, KIT_ATTR } from './picker';
import { captureElement, captureViewport, selectorFor } from './capture';
import {
  PickIcon,
  CameraIcon,
  UploadIcon,
  CloseIcon,
  CollapseIcon,
  ChevronIcon,
  GripIcon,
  PlusIcon,
} from './icons';
import { RichTextEditor } from './RichTextEditor';
import { AttachmentStrip, BlobImage } from './AttachmentStrip';
import { ImagePreview } from './ImagePreview';
import { themeToStyle, mergeLabels } from './theme';

const EDGE = 24; // drop within this many px of a side wall to collapse into a tab
const DEFAULT_SIZE = { width: 380, height: 520 };
const MB = 1024 * 1024;
const isBrowser = typeof window !== 'undefined';

function readSaved(key) {
  if (!isBrowser) return null;
  try { return JSON.parse(window.localStorage.getItem(key) || 'null'); } catch { return null; }
}
function save(key, value) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
}
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
let seq = 0;
const nextId = () => `rk-${Date.now()}-${seq++}`;
const cx = (...parts) => parts.filter(Boolean).join(' ');

const pageContext = () => (isBrowser ? {
  url: window.location.href,
  title: document.title,
  viewport: { width: window.innerWidth, height: window.innerHeight },
} : { url: '', title: '', viewport: { width: 0, height: 0 } });
const newPoint = () => ({ id: nextId(), html: '', text: '', empty: true, attachments: [], context: pageContext() });
const isEmpty = (p) => p.empty && !p.attachments.length;

// Size and position that fit the current window: a saved box from a larger
// screen, or one left off-screen, opens fully visible.
const fitToWindow = (size, pos) => {
  if (!isBrowser) return { size, pos };
  const fit = {
    width: clamp(size.width, 320, Math.max(320, window.innerWidth - 16)),
    height: clamp(size.height, 320, Math.max(320, window.innerHeight - 16)),
  };
  return {
    size: fit,
    pos: {
      x: clamp(pos.x, 0, Math.max(0, window.innerWidth - fit.width)),
      y: clamp(pos.y, 0, Math.max(0, window.innerHeight - fit.height)),
    },
  };
};

// The layer is only an anchor (0x0 at the top-left). Its essentials are set
// inline with !important, so no page stylesheet, extension or browser default
// can give it a background, clip it or hide it: each of those has happened
// to a review layer in the wild (Chromium 155 painted it white).
const LAYER_GUARD = {
  position: 'fixed', top: '0', left: '0', width: '0', height: '0',
  overflow: 'visible', display: 'block', visibility: 'visible', opacity: '1',
  background: 'none', transform: 'none', filter: 'none', 'clip-path': 'none',
  contain: 'none', margin: '0', padding: '0', border: '0', 'pointer-events': 'none',
  'z-index': 'var(--rk-z)',
};
const guardLayer = (el) => {
  if (!el) return;
  for (const [prop, value] of Object.entries(LAYER_GUARD)) el.style.setProperty(prop, value, 'important');
};
const defaultPosition = () => (isBrowser ? {
  x: Math.max(EDGE, window.innerWidth - DEFAULT_SIZE.width - 32),
  y: Math.max(EDGE, window.innerHeight - DEFAULT_SIZE.height - 32),
} : { x: EDGE, y: EDGE });

/**
 * Floating, draggable review box. See README.md for the full API.
 *
 * Feedback is a series of points: each has its own screenshots (element picks,
 * screen shots, uploaded, pasted or dropped images and GIFs, shown as square
 * thumbnails that open a preview with annotation), its own rich-text comment,
 * and the page it was made on.
 *
 * Styling: `theme` (design tokens), CSS variables (--rk-*), and `classNames`
 * slots. Wording: `labels`. Storage: whatever `onSubmit` does with the points.
 */
const DEFAULT_ICONS = {
  select: PickIcon,
  screenshot: CameraIcon,
  upload: UploadIcon,
  close: CloseIcon,
  plus: PlusIcon,
  collapse: CollapseIcon,
  chevron: ChevronIcon,
  grip: GripIcon,
};

export function ReviewDock({
  title,
  subtitle,
  onSubmit,
  onClose,
  storageKey = 'review-kit:dock',
  maxFileSizeMb = 10,
  theme,
  colorMode,
  labels,
  classNames = {},
  className,
  icons,
  headerActions,
  children,
}) {
  const Icons = useMemo(() => ({ ...DEFAULT_ICONS, ...(icons || {}) }), [icons]);
  const L = useMemo(() => mergeLabels(labels), [labels]);
  const themeStyle = useMemo(() => themeToStyle(theme), [theme]);

  const [initial] = useState(() => {
    const saved = readSaved(storageKey);
    return fitToWindow(saved?.size || DEFAULT_SIZE, saved?.pos || defaultPosition());
  });
  const [size, setSize] = useState(initial.size);
  const [pos, setPos] = useState(initial.pos);
  // Always opens expanded: a box that opens as a thin tab at the screen edge
  // reads as "the review box didn't open".
  const [collapsed, setCollapsed] = useState(null); // null | 'left' | 'right'
  const [edgeHint, setEdgeHint] = useState(null);
  const [points, setPoints] = useState(() => [newPoint()]);
  const [activeId, setActiveId] = useState(() => points[0].id);
  const [busy, setBusy] = useState(null); // null | 'pick' | 'capture' | 'send'
  const [notice, setNotice] = useState(null); // { tone: 'error'|'ok', text }
  const [previewId, setPreviewIdState] = useState(null);
  // Wrap preview open/close and collapse/expand in a view transition so the
  // dock morphs smoothly into its tab (and the thumbnail grows into the modal
  // image). Falls back silently in browsers without startViewTransition.
  const withViewTransition = useCallback((fn) => {
    if (typeof document !== 'undefined' && typeof document.startViewTransition === 'function') {
      document.startViewTransition(fn);
    } else {
      fn();
    }
  }, []);
  const setPreviewId = useCallback((next) => withViewTransition(() => setPreviewIdState(next)), [withViewTransition]);
  // The dock gets its view-transition-name only while it is actually morphing
  // between full and collapsed, so other transitions (preview → annotator,
  // image preview open) don't capture the dock as a static snapshot and cause
  // a flicker.
  const [dockMorphing, setDockMorphing] = useState(false);
  const collapseTo = useCallback((side) => {
    setDockMorphing(true);
    withViewTransition(() => setCollapsed(side));
    setTimeout(() => setDockMorphing(false), 500);
  }, [withViewTransition]);

  const active = points.find(p => p.id === activeId) || points[0];
  const activeIndex = points.indexOf(active);

  useEffect(() => { save(storageKey, { size, pos }); }, [storageKey, size, pos]);

  // Keep the box on screen when the window shrinks.
  useEffect(() => {
    const onResize = () => setPos(p => ({
      x: clamp(p.x, 0, Math.max(0, window.innerWidth - size.width)),
      y: clamp(p.y, 0, Math.max(0, window.innerHeight - size.height)),
    }));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [size.width, size.height]);

  const updateActive = useCallback((fn) => {
    setPoints(prev => prev.map(p => (p.id === activeId ? fn(p) : p)));
  }, [activeId]);

  // Attachments go to the current point, which now belongs to this page.
  const add = useCallback((items) => {
    const added = items.map(item => ({ id: nextId(), ...item }));
    updateActive(p => ({ ...p, attachments: [...p.attachments, ...added], context: pageContext() }));
  }, [updateActive]);

  const removeAttachment = (id) => updateActive(p => ({
    ...p,
    attachments: p.attachments.filter(a => a.id !== id),
  }));

  // An annotated copy replaces the original, keeping where it came from.
  const replaceAttachment = (id, file) => updateActive(p => ({
    ...p,
    attachments: p.attachments.map(a => (a.id === id
      ? { ...a, file, type: 'image/png', name: a.name.replace(/\.[^.]+$/, '') + '.png', annotated: true }
      : a)),
  }));

  const tooBig = useCallback((count) => setNotice({ tone: 'error', text: L.skipped(count, maxFileSizeMb) }), [L, maxFileSizeMb]);

  // Uploaded, pasted or dropped files: images and GIFs within the size limit.
  const addFiles = useCallback((files) => {
    const ok = files.filter(f => f.type.startsWith('image/') && f.size <= maxFileSizeMb * MB);
    if (ok.length < files.length) tooBig(files.length - ok.length);
    add(ok.map(f => ({ file: f, name: f.name || 'pasted-image.png', type: f.type, kind: 'upload' })));
  }, [add, maxFileSizeMb, tooBig]);

  // Drop images anywhere on the box (the editor takes drops over the text
  // itself, so a drop there isn't handled twice).
  const { getRootProps, getInputProps, open: openFiles, isDragActive } = useDropzone({
    accept: { 'image/*': [] },
    maxSize: maxFileSizeMb * MB,
    noClick: true,
    noKeyboard: true,
    onDrop: (accepted, rejected) => {
      addFiles(accepted);
      if (rejected.length) tooBig(rejected.length);
    },
  });

  const pick = async () => {
    setNotice(null);
    setBusy('pick');
    try {
      const el = await pickElement({ hint: L.pickHint, style: themeStyle });
      if (!el) return;
      setBusy('capture');
      const file = await captureElement(el);
      const name = describeElement(el);
      const r = el.getBoundingClientRect();
      add([{
        file, name: `${name}.png`, type: 'image/png', kind: 'element',
        selector: selectorFor(el), element: name,
        rect: { x: Math.round(r.left + window.scrollX), y: Math.round(r.top + window.scrollY), width: Math.round(r.width), height: Math.round(r.height) },
      }]);
    } catch (err) {
      setNotice({ tone: 'error', text: L.captureFailed(err?.message || String(err)) });
    } finally {
      setBusy(null);
    }
  };

  const screenshot = async () => {
    setNotice(null);
    setBusy('capture');
    try {
      const file = await captureViewport();
      add([{ file, name: 'screen.png', type: 'image/png', kind: 'screen' }]);
    } catch (err) {
      setNotice({ tone: 'error', text: L.screenshotFailed(err?.message || String(err)) });
    } finally {
      setBusy(null);
    }
  };

  // ── Points ──
  const addPoint = () => {
    // Reuse an untouched last point instead of stacking empty ones.
    const last = points[points.length - 1];
    if (isEmpty(last)) { setActiveId(last.id); return; }
    const p = newPoint();
    setPoints(prev => [...prev, p]);
    setActiveId(p.id);
    setNotice(null);
  };

  const removePoint = (id) => {
    if (points.length === 1) return;
    const i = points.findIndex(p => p.id === id);
    const rest = points.filter(p => p.id !== id);
    setPoints(rest);
    if (id === activeId) setActiveId(rest[Math.max(0, i - 1)].id);
  };

  const filled = points.filter(p => !isEmpty(p));

  const submit = async () => {
    if (busy || !filled.length) return;
    setBusy('send');
    setNotice(null);
    try {
      const result = await onSubmit({
        points: filled.map(p => ({
          text: p.text,
          html: p.empty ? '' : p.html,
          attachments: p.attachments.map(a => ({
            file: a.file, name: a.name, type: a.type, kind: a.kind,
            selector: a.selector, element: a.element, rect: a.rect, annotated: !!a.annotated,
          })),
          context: p.context,
        })),
        context: { ...pageContext(), userAgent: navigator.userAgent, createdAt: new Date().toISOString() },
      });
      if (result !== false) {
        const fresh = newPoint();
        setPoints([fresh]);
        setActiveId(fresh.id);
        setNotice({ tone: 'ok', text: L.sent(filled.length) });
      }
    } catch (err) {
      setNotice({ tone: 'error', text: L.sendFailed(err?.message || String(err)) });
    } finally {
      setBusy(null);
    }
  };

  // ── Collapse to a wall ──
  const nearestSide = () => (pos.x + size.width / 2 < window.innerWidth / 2 ? 'left' : 'right');
  const expand = () => {
    setDockMorphing(true);
    withViewTransition(() => {
      setPos(p => ({
        x: collapsed === 'left' ? EDGE + 8 : Math.max(0, window.innerWidth - size.width - EDGE - 8),
        y: clamp(p.y, 0, Math.max(0, window.innerHeight - size.height)),
      }));
      setCollapsed(null);
    });
    setTimeout(() => setDockMorphing(false), 500);
  };
  const sideAt = (x, width) => {
    if (x <= EDGE) return 'left';
    if (x + width >= window.innerWidth - EDGE) return 'right';
    return null;
  };

  const layerProps = {
    ref: guardLayer,
    className: cx('rk-root', 'rk-layer', className, classNames.root),
    style: themeStyle,
    [KIT_ATTR]: '',
    ...(colorMode ? { 'data-rk-theme': colorMode } : {}),
  };
  const shotCount = points.reduce((n, p) => n + p.attachments.length, 0);

  if (collapsed) {
    return (
      <div {...layerProps}>
        <button
          type="button"
          className={cx('rk-tab', `rk-tab-${collapsed}`, classNames.tab)}
          style={{
            top: clamp(pos.y + 16, 8, (isBrowser ? window.innerHeight : 600) - 96),
            ...(dockMorphing ? { viewTransitionName: 'rk-dock-surface' } : {}),
          }}
          onClick={expand}
          aria-label={L.open(title)}
          title={title}
        >
          <Icons.chevron direction={collapsed === 'left' ? 'right' : 'left'} />
          {(filled.length > 0 || shotCount > 0) && <span className="rk-tab-dot" aria-hidden="true" />}
        </button>
      </div>
    );
  }

  const labelFor = (a) => (a.kind === 'element' ? a.element : a.kind === 'screen' ? L.screenLabel : a.name);
  const previewing = active.attachments.find(a => a.id === previewId);
  const sendLabel = busy === 'send' ? L.sending : filled.length > 1 ? L.sendPoints(filled.length) : L.send;

  return (
    <div {...layerProps}>
      {edgeHint && <div className={`rk-edge-hint rk-edge-hint-${edgeHint}`} aria-hidden="true" />}
      <Rnd
        className={cx('rk-dock', edgeHint && `rk-dock--pulling-${edgeHint}`)}
        bounds="window"
        size={size}
        position={pos}
        minWidth={320}
        minHeight={320}
        dragHandleClassName="rk-drag"
        cancel=".rk-no-drag"
        onDrag={(_e, d) => setEdgeHint(sideAt(d.x, size.width))}
        onDragStop={(_e, d) => {
          setEdgeHint(null);
          setPos({ x: d.x, y: d.y });
          const side = sideAt(d.x, size.width);
          if (side) collapseTo(side);
        }}
        onResizeStop={(_e, _dir, ref, _delta, p) => {
          setSize({ width: ref.offsetWidth, height: ref.offsetHeight });
          setPos(p);
        }}
      >
        <section
          className={cx('rk-panel', classNames.panel)}
          aria-label={`${title}`}
          style={dockMorphing ? { viewTransitionName: 'rk-dock-surface' } : undefined}
          {...getRootProps()}
        >
          <input {...getInputProps()} />
          <header className={cx('rk-header', 'rk-drag', classNames.header)}>
            <Icons.grip className="rk-grip" />
            <div className="rk-heading">
              <div className="rk-title" title={title}>{title}</div>
              {subtitle && <div className="rk-subtitle">{subtitle}</div>}
            </div>
            <div className="rk-header-actions rk-no-drag">
              {headerActions?.map(({ id, label, icon: ActionIcon, onClick }) => (
                <button key={id || label} type="button" className="rk-icon-btn" onClick={onClick} aria-label={label} title={label}>
                  <ActionIcon width={16} height={16} />
                </button>
              ))}
              <button type="button" className="rk-icon-btn" onClick={() => collapseTo(nearestSide())} aria-label={L.collapse} title={L.collapse}>
                <Icons.collapse />
              </button>
              {onClose && (
                <button type="button" className="rk-icon-btn" onClick={onClose} aria-label={L.close} title={L.close}>
                  <Icons.close />
                </button>
              )}
            </div>
          </header>

          <div className="rk-body rk-no-drag">
            <ol className={cx('rk-timeline', classNames.timeline)} aria-label={L.point}>
              {!isEmpty(active) && (
                <li className="rk-timeline-add-item">
                  <button
                    type="button"
                    className="rk-timeline-add"
                    onClick={addPoint}
                    title={L.newPointHint}
                  >
                    <span className="rk-timeline-dot rk-timeline-dot--add" aria-hidden="true">
                      <Icons.plus width={12} height={12} />
                    </span>
                    <span className="rk-timeline-add-label">{L.newPointHint}</span>
                  </button>
                </li>
              )}
              {[...points].reverse().map((p) => {
                const idx = points.indexOf(p);
                const isActive = p.id === active.id;
                return (
                  <li key={p.id} className={cx('rk-timeline-item', isActive && 'rk-timeline-item--active')}>
                    <div className="rk-timeline-rail">
                      <button
                        type="button"
                        className="rk-timeline-dot"
                        onClick={() => setActiveId(p.id)}
                        aria-label={L.pointTitle(idx + 1)}
                        aria-current={isActive || undefined}
                        title={L.pointTitle(idx + 1)}
                      >
                        {idx + 1}
                      </button>
                    </div>
                    <div className="rk-timeline-card">
                      {points.length > 1 && (
                        <button
                          type="button"
                          className="rk-timeline-remove"
                          onClick={() => removePoint(p.id)}
                          aria-label={L.deletePoint(idx + 1)}
                          title={L.deletePoint(idx + 1)}
                        >
                          <Icons.close width={12} height={12} />
                        </button>
                      )}
                      {isActive ? (
                        <>
                          <AttachmentStrip
                            key={`shots-${p.id}`}
                            items={p.attachments}
                            onOpen={setPreviewId}
                            onRemove={removeAttachment}
                            labelFor={labelFor}
                            labels={L}
                            className={classNames.attachments}
                            hiddenId={previewId}
                          />
                          <RichTextEditor
                            key={p.id}
                            initialHtml={p.html}
                            autoFocus={points.length > 1}
                            placeholder={points.length > 1 ? L.pointPlaceholder(idx + 1) : L.placeholder}
                            labels={L}
                            className={classNames.editor}
                            onChange={({ html, text, empty }) => updateActive(x => ({ ...x, html, text, empty }))}
                            onFiles={addFiles}
                            onSubmit={submit}
                          />
                        </>
                      ) : (
                        <button
                          type="button"
                          className="rk-timeline-view"
                          onClick={() => setActiveId(p.id)}
                          aria-label={L.pointTitle(idx + 1)}
                        >
                          {p.attachments.length > 0 && (
                            <ul className="rk-timeline-attachments" aria-label={L.attachments}>
                              {p.attachments.map(a => (
                                <li key={a.id} className="rk-thumb" style={{ viewTransitionName: `rk-att-${a.id}` }}>
                                  <span className="rk-thumb-open">
                                    <BlobImage file={a.file} alt="" />
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                          {p.html ? (
                            <div className="rk-timeline-body" dangerouslySetInnerHTML={{ __html: p.html }} />
                          ) : (
                            <div className="rk-timeline-body rk-timeline-body--empty">{L.placeholder}</div>
                          )}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
            {notice && <p className={`rk-notice rk-notice-${notice.tone}`} role="status">{notice.text}</p>}
            {children && <div className="rk-extra">{children}</div>}
          </div>

          <footer className={cx('rk-footer', 'rk-no-drag', classNames.footer)}>
            <div className="rk-tools">
              <button type="button" className={cx('rk-tool', classNames.toolButton)} onClick={pick} disabled={!!busy} title={L.selectHint} aria-label={L.select}>
                <Icons.select />
                <span>{busy === 'pick' ? L.picking : L.select}</span>
              </button>
              <button type="button" className={cx('rk-tool', classNames.toolButton)} onClick={screenshot} disabled={!!busy} title={L.screenshotHint} aria-label={L.screenshot}>
                <Icons.screenshot />
                <span>{busy === 'capture' ? L.capturing : L.screenshot}</span>
              </button>
              <button type="button" className={cx('rk-tool', classNames.toolButton)} onClick={openFiles} disabled={!!busy} title={L.uploadHint(maxFileSizeMb)} aria-label={L.upload}>
                <Icons.upload />
                <span>{L.upload}</span>
              </button>
            </div>
            <button type="button" className={cx('rk-send', classNames.sendButton)} onClick={submit} disabled={!!busy || !filled.length}>
              {sendLabel}
            </button>
          </footer>

          {isDragActive && <div className="rk-drop-overlay">{L.dropHint(activeIndex + 1)}</div>}
        </section>
      </Rnd>
      {previewing && (
        <ImagePreview
          key={previewing.id}
          attachment={previewing}
          name={labelFor(previewing)}
          labels={L}
          onAnnotated={(file) => replaceAttachment(previewing.id, file)}
          onClose={() => setPreviewId(null)}
        />
      )}
    </div>
  );
}

