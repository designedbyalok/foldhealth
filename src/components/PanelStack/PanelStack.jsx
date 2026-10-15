import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from '../Icon/Icon';
import { CloseButton } from '../CloseButton/CloseButton';
import styles from './PanelStack.module.css';

const DEFAULT_PEEK_PX = 56;
// Share of a panel that must be in view before its content shows, so it
// appears as it scrolls in rather than after the scroll settles. The edge
// peek (~6% of a panel) stays below it.
const REVEAL_RATIO = 0.15;
const OBSERVER_THRESHOLDS = [0, 0.1, REVEAL_RATIO, 0.25, 0.5, 0.75, 1];

/**
 * PanelStack — panels side by side that scroll and snap one at a time, with
 * browser-style tabs on top once there's more than one. Each panel is the
 * row's width minus `peek`, so the next one's edge always shows. Clicking a
 * tab (or the peeking edge) brings its panel into focus; dragging a tab
 * reorders the panels. A lone panel renders as just its content.
 *
 * Controlled: the parent owns the order (`panels`) and the active panel.
 *
 * @param {object}   props
 * @param {Array<{
 *   id: string,
 *   title: string,
 *   content: React.ReactNode,
 *   actions?: React.ReactNode,   // small icon buttons on the tab (shown on hover / when active)
 *   onClose?: () => void,        // adds a close × to the tab
 * }>} props.panels  Panels in display order. Content stays mounted across
 *        reorders (stable keys), so a panel keeps its scroll and state.
 * @param {string}   [props.activeId]        Panel in focus. Changing it scrolls there.
 * @param {(id: string) => void} [props.onActiveChange]  Fires when a tab is picked or scrolling settles on another panel.
 * @param {(ids: string[]) => void} [props.onReorder]    Fires with the new id order after a tab drag.
 * @param {number}   [props.peek=56]         Pixels of the next panel left visible.
 * @param {string}   [props.ariaLabel]
 */
export function PanelStack({
  panels,
  activeId,
  onActiveChange,
  onReorder,
  peek = DEFAULT_PEEK_PX,
  ariaLabel = 'Panels',
}) {
  const stripRef = useRef(null);
  // The id the strip last reported (or was last sent to), so an activeId
  // change that came from scrolling or a tab click doesn't scroll again.
  const settledRef = useRef(activeId);
  const dragIdRef = useRef(null);
  const [dragId, setDragId] = useState(null);
  const [dropHint, setDropHint] = useState(null); // { id, side: 'before' | 'after' }
  const [revealed, setRevealed] = useState(() => new Set(activeId ? [activeId] : []));
  const multi = panels.length > 1;
  const activeIndex = Math.max(0, panels.findIndex(p => p.id === activeId));
  const idsKey = panels.map(p => p.id).join('|');

  const panelEl = useCallback(
    (id) => [...(stripRef.current?.children || [])].find(el => el.dataset.panelId === id),
    [],
  );

  const scrollToPanel = useCallback((id, behavior = 'smooth') => {
    const strip = stripRef.current;
    const el = panelEl(id);
    if (!strip || !el) return;
    settledRef.current = id;
    strip.scrollTo({ left: el.offsetLeft, behavior });
  }, [panelEl]);

  const focusPanel = (id) => {
    scrollToPanel(id);
    onActiveChange?.(id);
  };

  // Parent picked a panel (opened, focused): bring it into view. A newly
  // inserted panel jumps there before paint: browsers re-snap to the
  // previously snapped panel after a layout change, which would cancel a
  // smooth scroll. Switching between existing panels animates.
  const prevCountRef = useRef(panels.length);
  useLayoutEffect(() => {
    const inserted = panels.length > prevCountRef.current;
    prevCountRef.current = panels.length;
    if (!activeId || activeId === settledRef.current) return;
    scrollToPanel(activeId, inserted ? 'instant' : 'smooth');
  }, [activeId, panels.length, scrollToPanel]);

  // Which panels are far enough in view to show their content. Updates
  // during the scroll, so an incoming panel fills in as it arrives.
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip || !multi || typeof IntersectionObserver === 'undefined') return undefined;
    const ratios = new Map();
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) ratios.set(entry.target.dataset.panelId, entry.intersectionRatio);
      const next = [...ratios].filter(([, r]) => r >= REVEAL_RATIO).map(([id]) => id);
      setRevealed(prev => (next.length === prev.size && next.every(id => prev.has(id)) ? prev : new Set(next)));
    }, { root: strip, threshold: OBSERVER_THRESHOLDS });
    for (const el of strip.children) io.observe(el);
    return () => io.disconnect();
  }, [multi, idsKey]);

  // Report which panel the scroll settled on, once it has settled: the one
  // whose left edge is nearest the scroll position, or the last one at the
  // end, where it right-aligns.
  const settle = useCallback(() => {
    const strip = stripRef.current;
    if (!strip || !panels.length) return;
    const atEnd = strip.scrollLeft >= strip.scrollWidth - strip.clientWidth - 2;
    let nearest = panels[panels.length - 1].id;
    if (!atEnd) {
      let best = Infinity;
      for (const p of panels) {
        const el = panelEl(p.id);
        if (!el) continue;
        const d = Math.abs(el.offsetLeft - strip.scrollLeft);
        if (d < best) { best = d; nearest = p.id; }
      }
    }
    if (nearest !== settledRef.current) {
      settledRef.current = nearest;
      onActiveChange?.(nearest);
    }
  }, [panels, panelEl, onActiveChange]);

  // `scrollend` where supported; a short debounce on `scroll` covers the rest.
  const settleTimerRef = useRef(0);
  const handleScroll = () => {
    clearTimeout(settleTimerRef.current);
    settleTimerRef.current = setTimeout(settle, 150);
  };
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return undefined;
    strip.addEventListener('scrollend', settle);
    return () => {
      strip.removeEventListener('scrollend', settle);
      clearTimeout(settleTimerRef.current);
    };
  }, [settle]);

  const endDrag = () => {
    dragIdRef.current = null;
    setDragId(null);
    setDropHint(null);
  };

  const handleDragStart = (id) => (e) => {
    try {
      e.dataTransfer.setData('text/plain', id);
      e.dataTransfer.effectAllowed = 'move';
    } catch { /* some browsers restrict dataTransfer during dragstart */ }
    dragIdRef.current = id;
    // Deferred: changing the DOM inside dragstart can cancel the drag.
    setTimeout(() => { if (dragIdRef.current === id) setDragId(id); }, 0);
  };

  const handleDragOver = (id) => (e) => {
    if (!dragIdRef.current) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const side = e.clientX < rect.left + rect.width / 2 ? 'before' : 'after';
    if (!dropHint || dropHint.id !== id || dropHint.side !== side) setDropHint({ id, side });
  };

  const handleDrop = (id) => (e) => {
    e.preventDefault();
    const from = dragIdRef.current;
    const side = dropHint?.side || 'before';
    endDrag();
    if (!from || from === id) return;
    const ids = panels.map(p => p.id).filter(x => x !== from);
    const at = ids.indexOf(id) + (side === 'after' ? 1 : 0);
    ids.splice(at, 0, from);
    onReorder?.(ids);
    // Keep the moved panel in view after it lands, as the active one.
    requestAnimationFrame(() => focusPanel(from));
  };

  return (
    <div className={[styles.root, multi ? styles.multi : '', multi && activeIndex === 0 ? styles.firstActive : ''].filter(Boolean).join(' ')}>
      {multi && (
        <div className={styles.tabBar} role="tablist" aria-label={ariaLabel}>
          {panels.map((panel, i) => {
            const active = i === activeIndex;
            const hint = dropHint?.id === panel.id ? dropHint.side : null;
            return (
              <div
                key={panel.id}
                className={[
                  styles.tab,
                  active ? styles.tabActive : '',
                  dragId === panel.id ? styles.tabDragging : '',
                  hint === 'before' ? styles.dropBefore : '',
                  hint === 'after' ? styles.dropAfter : '',
                ].filter(Boolean).join(' ')}
                onDragOver={handleDragOver(panel.id)}
                onDrop={handleDrop(panel.id)}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={styles.tabMain}
                  draggable
                  onDragStart={handleDragStart(panel.id)}
                  onDragEnd={endDrag}
                  onClick={() => focusPanel(panel.id)}
                  title={`${panel.title} · drag to reorder`}
                >
                  <span className={styles.grip} aria-hidden="true">
                    <Icon name="solar:grip-vertical-linear" size={14} color="currentColor" />
                  </span>
                  <span className={styles.tabTitle}>{panel.title}</span>
                </button>
                {panel.actions && <span className={styles.tabActions}>{panel.actions}</span>}
                {panel.onClose && (
                  <CloseButton
                    size={14}
                    label={`Close ${panel.title}`}
                    className={styles.tabClose}
                    onClick={panel.onClose}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      <div
        ref={stripRef}
        className={styles.strip}
        style={{ '--panel-peek': `${peek}px` }}
        onScroll={handleScroll}
      >
        {panels.map((panel, i) => {
          const active = i === activeIndex;
          // Hidden only while mostly out of view: content shows as soon as
          // a panel starts scrolling in, and always for the active one.
          const shown = !multi || active || revealed.has(panel.id);
          return (
            <section
              key={panel.id}
              data-panel-id={panel.id}
              aria-label={panel.title}
              role={multi ? 'tabpanel' : undefined}
              className={styles.panel}
            >
              <div className={`${styles.content} ${shown ? '' : styles.contentHidden}`} inert={!shown || undefined}>
                {panel.content}
              </div>
              {/* Click target over a panel that's out of view (only its
                  edge shows); fades away as it comes in. */}
              {multi && (
                <button
                  type="button"
                  className={`${styles.peekCover} ${shown ? styles.peekCoverOff : ''}`}
                  onClick={() => focusPanel(panel.id)}
                  aria-label={`Show ${panel.title}`}
                  aria-hidden={shown || undefined}
                  tabIndex={shown ? -1 : 0}
                />
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
