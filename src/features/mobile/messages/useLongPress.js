import { useRef } from 'react';

const HOLD_MS = 450;
const SLOP_PX = 10;

/**
 * Press and hold (iOS context-menu feel) on a row: after HOLD_MS without
 * moving, `onLongPress` runs and the click that follows is swallowed.
 * A right-click / Android long-press `contextmenu` does the same.
 * Spread the result on the element; wrap its onClick with `guard`.
 */
export function useLongPress(onLongPress) {
  const timer = useRef(null);
  const start = useRef(null);
  const fired = useRef(false);

  const cancel = () => { clearTimeout(timer.current); timer.current = null; };
  const handlers = {
    onPointerDown: (e) => {
      if (e.button) return;
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      cancel();
      timer.current = setTimeout(() => {
        fired.current = true;
        navigator.vibrate?.(10);
        onLongPress();
      }, HOLD_MS);
    },
    onPointerMove: (e) => {
      if (!start.current) return;
      if (Math.abs(e.clientX - start.current.x) > SLOP_PX || Math.abs(e.clientY - start.current.y) > SLOP_PX) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onContextMenu: (e) => {
      e.preventDefault();
      if (fired.current) return;
      cancel();
      fired.current = true;
      onLongPress();
    },
  };
  const guard = (fn) => (e) => {
    if (fired.current) { fired.current = false; e.preventDefault(); e.stopPropagation(); return; }
    fn?.(e);
  };
  return { handlers, guard };
}
