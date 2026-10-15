import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from '../Icon/Icon';
import styles from './PanelStack.module.css';

const DEFAULT_PEEK_PX = 56;

/**
 * PanelStack — a horizontal row of panel cards that scrolls and snaps one
 * panel at a time. With more than one panel each card is the row's width
 * minus `peek`, so the next panel's edge always shows; clicking that edge
 * brings it into view. Panels reorder by dragging their header handle.
 *
 * Controlled: the parent owns the order (`panels`) and the active panel.
 *
 * @param {object}   props
 * @param {Array<{ id: string, title: string, actions?: React.ReactNode, content: React.ReactNode }>} props.panels
 *        Panels in display order. Content stays mounted across reorders
 *        (stable keys), so a panel keeps its scroll and state when moved.
 * @param {string}   [props.activeId]        Panel scrolled into view. Changing it scrolls there.
 * @param {(id: string) => void} [props.onActiveChange]  Fires when scrolling settles on another panel.
 * @param {(ids: string[]) => void} [props.onReorder]    Fires with the new id order after a drag.
 * @param {number}   [props.peek=56]         Pixels of the neighbouring panel left visible.
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
  // The id the strip last reported (or was last scrolled to), so an
  // activeId change that came from scrolling doesn't scroll again.
  const settledRef = useRef(activeId);
  const dragIdRef = useRef(null);
  const [dragId, setDragId] = useState(null);
  const [dropHint, setDropHint] = useState(null); // { id, side: 'before' | 'after' }
  const multi = panels.length > 1;
  const activeIndex = Math.max(0, panels.findIndex(p => p.id === activeId));

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

  // Report which panel the scroll settled on, once it has settled (not on
  // every frame of a smooth scroll): the one whose left edge is nearest the
  // scroll position, or the last one at the end, where it right-aligns.
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
    requestAnimationFrame(() => {
      scrollToPanel(from);
      onActiveChange?.(from);
    });
  };

  return (
    <div
      ref={stripRef}
      className={`${styles.strip} ${multi ? styles.multi : ''}`}
      style={{ '--panel-peek': `${peek}px` }}
      onScroll={handleScroll}
      role="group"
      aria-label={ariaLabel}
    >
      {panels.map((panel, i) => {
        const active = i === activeIndex;
        const hint = dropHint?.id === panel.id ? dropHint.side : null;
        return (
          <section
            key={panel.id}
            data-panel-id={panel.id}
            aria-label={panel.title}
            className={[
              styles.panel,
              dragId === panel.id ? styles.panelDragging : '',
              hint === 'before' ? styles.dropBefore : '',
              hint === 'after' ? styles.dropAfter : '',
            ].filter(Boolean).join(' ')}
            onDragOver={handleDragOver(panel.id)}
            onDrop={handleDrop(panel.id)}
          >
            {/* A single panel is just its content: the header (drag handle,
                title, actions) only earns its space once there's a stack. */}
            {multi && (
              <header className={styles.header}>
                <button
                  type="button"
                  className={styles.grip}
                  draggable
                  onDragStart={handleDragStart(panel.id)}
                  onDragEnd={endDrag}
                  aria-label={`Drag to reorder ${panel.title}`}
                  title="Drag to reorder"
                >
                  <Icon name="solar:hamburger-menu-linear" size={14} color="currentColor" />
                </button>
                <span className={styles.title}>{panel.title}</span>
                {panel.actions && <div className={styles.actions}>{panel.actions}</div>}
              </header>
            )}
            <div className={styles.body}>
              {/* An inactive panel shows only its title: the content fades
                  out (still mounted, so it keeps its scroll and state) and
                  goes inert so it can't take focus while out of view. */}
              <div
                className={`${styles.content} ${multi && !active ? styles.contentHidden : ''}`}
                inert={(multi && !active) || undefined}
              >
                {panel.content}
              </div>
              {/* Click target over an inactive panel's (hidden) content;
                  stays mounted so it fades as panels switch. */}
              {multi && (
                <button
                  type="button"
                  className={`${styles.peekCover} ${active ? styles.peekCoverOff : ''}`}
                  onClick={() => { scrollToPanel(panel.id); onActiveChange?.(panel.id); }}
                  aria-label={`Show ${panel.title}`}
                  aria-hidden={active || undefined}
                  tabIndex={active ? -1 : 0}
                />
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
