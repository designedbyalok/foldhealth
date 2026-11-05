import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const GAP = 10;
const EDGE = 8;
const WIDTH = 300;

/**
 * Comment right at a picked element: the element keeps an outline and a small
 * card opens next to it. Adding turns the comment (and the element's
 * screenshot) into a new point in the box; Escape or Cancel drops it.
 */
export function InlineComment({ element, elementName, labels: L, onAdd, onCancel }) {
  const [rect, setRect] = useState(() => element.getBoundingClientRect());
  const [text, setText] = useState('');
  const card = useRef(null);
  const input = useRef(null);
  const [place, setPlace] = useState(null);
  // The card opens because the user just picked this element to comment on.
  // It's hidden until placed, so focus once it is.
  const placed = !!place;
  useEffect(() => { if (placed) input.current?.focus({ preventScroll: true }); }, [placed]);

  // Follow the element while the page scrolls or resizes.
  useEffect(() => {
    const update = () => setRect(element.getBoundingClientRect());
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [element]);

  // Below the element when it fits, else above, else inside its bottom edge;
  // always inside the window.
  useLayoutEffect(() => {
    const h = card.current?.offsetHeight || 0;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top = rect.bottom + GAP;
    if (top + h > vh - EDGE) top = rect.top - GAP - h;
    if (top < EDGE) top = Math.min(vh - EDGE - h, Math.max(EDGE, rect.bottom - h - GAP));
    const left = Math.min(Math.max(EDGE, rect.left), vw - EDGE - WIDTH);
    setPlace({ top, left });
  }, [rect]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onCancel]);

  const add = () => onAdd(text.trim());

  return (
    <>
      <div
        className="rk-inline-target"
        style={{ transform: `translate(${rect.left}px, ${rect.top}px)`, width: rect.width, height: rect.height }}
      />
      <div
        ref={card}
        className="rk-inline"
        style={{ width: WIDTH, transform: place ? `translate(${place.left}px, ${place.top}px)` : undefined, visibility: place ? 'visible' : 'hidden' }}
      >
        <div className="rk-inline-element" title={elementName}>{elementName}</div>
        <textarea
          className="rk-inline-input"
          ref={input}
          rows={3}
          value={text}
          placeholder={L.inlinePlaceholder}
          aria-label={L.inlinePlaceholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              add();
            }
          }}
        />
        <div className="rk-inline-actions">
          <span className="rk-inline-hint">{L.inlineHint}</span>
          <button type="button" className="rk-inline-cancel" onClick={onCancel}>{L.cancel}</button>
          <button type="button" className="rk-inline-add" onClick={add}>{L.addPoint}</button>
        </div>
      </div>
    </>
  );
}
