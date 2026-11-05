import { useLayoutEffect, useState } from 'react';

/**
 * Compute a portaled popover's fixed position from an anchor element.
 *
 * Reading `ref.current.getBoundingClientRect()` *during render* is a React
 * 19 lint error (`Cannot access refs during render`) and produces a stale
 * rect on the first paint: it works today only because the popover is
 * rendered inside a portal AFTER the anchor mounted. On scroll or resize
 * the popover doesn't reposition either.
 *
 * This hook measures in `useLayoutEffect` (before paint, so the popover
 * renders in place on the first frame) and re-measures on `scroll` +
 * `resize`. Pass `open` so the effect noops when the popover is closed.
 *
 * Returns `{ top, left, width, placement }` where placement is 'bottom'
 * (opens below) or 'top' (opens above). Flips to 'top' when there isn't
 * enough space below the anchor.
 */
export function usePopoverPosition(anchorRef, open, { offset = 4, estimatedHeight = 240 } = {}) {
  const [pos, setPos] = useState(null);

  /* eslint-disable react-hooks/set-state-in-effect --
   * Measure-then-setState in useLayoutEffect is the canonical DOM-read
   * pattern this hook exists to encapsulate: the render must commit before
   * the anchor rect is known. The rule's own guidance allows setState in
   * an effect callback triggered by external state, here, DOM geometry.
   */
  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    const measure = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom;
      const spaceAbove = r.top;
      // Flip to top when there's not enough room below AND above has more.
      const flip = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;
      setPos(flip
        ? { top: r.top - offset, left: r.left, width: r.width, placement: 'top' }
        : { top: r.bottom + offset, left: r.left, width: r.width, placement: 'bottom' });
    };
    measure();
    window.addEventListener('resize', measure);
    // useCapture so we catch scrolls in ancestor scroll containers too.
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [anchorRef, open, offset, estimatedHeight]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return pos;
}
