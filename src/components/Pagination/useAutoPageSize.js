import { useEffect, useRef } from 'react';

/* Page sizes step in fives, never below ten, and always round UP: a partly
   visible row at the bottom is the goal, it signals there's more to scroll
   to: whereas rounding down would leave a band of empty space. MAX guards
   against a mis-measure (e.g. a 1px row height) blowing the size up. */
const STEP_ROWS = 5;
const MIN_ROWS = 10;
const MAX_ROWS = 100;

/** Round up to the next multiple of 5, floored at 10 and capped at 100. */
function quantize(rows) {
  const stepped = Math.ceil(rows / STEP_ROWS) * STEP_ROWS;
  return Math.max(MIN_ROWS, Math.min(MAX_ROWS, stepped));
}

/** Nearest scrollable ancestor: the box whose height the rows must fit in. */
function findScroller(node) {
  let el = node.parentElement;
  while (el) {
    const overflowY = getComputedStyle(el).overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll') return el;
    el = el.parentElement;
  }
  return null;
}

/**
 * useAutoPageSize: sizes a table's page to the space actually available,
 * so a tall screen fills with rows instead of white space.
 *
 * Rather than measuring the gap between the table body and the pagination
 * bar, this compares the scroll container's content height to its visible
 * height and converts the difference into whole rows. That relative form is
 * what makes it correct across our tables: the absolute gap would also count
 * the sticky header, HCC's status legend, and container padding as free
 * space, overshooting by a row. Content-vs-visible counts only real overflow,
 * whatever chrome is in there.
 *
 * Adjusting the page size changes the content height, so this converges over
 * a couple of passes (the effect re-runs on `perPage`) rather than in one.
 * It must not oscillate. Adding rows can change the rows already there
 * (auto-width columns widen for a longer name, so earlier rows wrap less),
 * and row heights vary (HCC, HEDIS), so "20 leaves a gap" and "25 overflows
 * enough to drop back to 20" can both be true at one height. That flipped
 * the page every frame. So after growing, it won't shrink again until the
 * container gets shorter than it was when it grew; and a shrink measures
 * the rows on screen rather than an average.
 *
 * The table is located by walking up from the pagination bar to the nearest
 * ancestor containing a <tbody>, which keeps this working for both
 * WorklistShell tables and the hand-rolled ones without threading a ref
 * through every caller.
 *
 * @param anchorRef  ref to the pagination element (used to find the table)
 * @param enabled    false to leave the page size alone (user picked one)
 * @param perPage    current page size: re-measures when it changes
 * @param totalItems re-measure trigger: the first paint is usually a loading
 *                   skeleton with no <tbody> to measure, and the container
 *                   doesn't resize when real rows replace it, so without this
 *                   the initial bail-out would never be retried
 * @param onFit      called with the fitted row count when it differs
 */
export function useAutoPageSize({ anchorRef, enabled, perPage, totalItems, onFit }) {
  // Keep the callback in a ref so a caller passing an inline arrow doesn't
  // re-subscribe the observers on every render.
  const onFitRef = useRef(onFit);
  useEffect(() => { onFitRef.current = onFit; }, [onFit]);
  // Container height at the last grow; see the oscillation note above.
  const grewAtRef = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;
    const anchor = anchorRef.current;
    if (!anchor) return undefined;

    const findTbody = () => {
      let el = anchor.parentElement;
      for (let depth = 0; depth < 4 && el; depth += 1) {
        const tbody = el.querySelector('tbody');
        if (tbody) return tbody;
        el = el.parentElement;
      }
      return null;
    };

    const measure = () => {
      const tbody = findTbody();
      const rowCount = tbody?.children.length || 0;
      if (!tbody || rowCount === 0) return; // loading / empty, keep current size

      const scroller = findScroller(tbody);
      if (!scroller || scroller.clientHeight < 1) return; // hidden, nothing to measure

      // Average across rendered rows so tables with mixed row heights (a
      // two-line member cell next to a one-line one) don't over- or
      // under-shoot. With too few rows to average, fall back to the first.
      const rowHeight = rowCount >= 3
        ? tbody.getBoundingClientRect().height / rowCount
        : tbody.firstElementChild.getBoundingClientRect().height;
      if (rowHeight < 1) return;

      // Free space = the gap between where the content actually ends and the
      // bottom of the visible box. Measured off the content's own rect
      // rather than scrollHeight, because scrollHeight is clamped to at
      // least clientHeight and so can only ever reveal overflow, never the
      // headroom we're trying to fill. clientHeight (not rect.bottom) keeps
      // a horizontal scrollbar from counting as free space, and scrollTop
      // corrects for the viewport-relative rects when the user has scrolled.
      const content = scroller.lastElementChild;
      if (!content) return;
      const clientBottom = scroller.getBoundingClientRect().top + scroller.clientHeight;
      const freeSpace = clientBottom - content.getBoundingClientRect().bottom - scroller.scrollTop;

      if (freeSpace > 0.5) {
        // Room to spare: how many rows the viewport holds, as a fraction,
        // rounded up so the last row runs past the fold instead of leaving
        // a gap. Don't grow past the data: a page that isn't full means the
        // rows ran out, not that more would fit.
        if (rowCount < perPage) return;
        const fitted = quantize(perPage + freeSpace / rowHeight);
        if (fitted !== perPage) {
          grewAtRef.current = scroller.clientHeight;
          onFitRef.current(fitted);
        }
        return;
      }

      if (grewAtRef.current != null && scroller.clientHeight >= grewAtRef.current) return;
      grewAtRef.current = null;

      // Overflowing in a container that has shrunk: drop to the smallest
      // step whose rendered rows still reach the fold.
      const fold = clientBottom - scroller.scrollTop;
      const tail = content.getBoundingClientRect().bottom - tbody.getBoundingClientRect().bottom;
      for (let k = MIN_ROWS; k < Math.min(perPage, rowCount); k += STEP_ROWS) {
        if (tbody.children[k - 1].getBoundingClientRect().bottom + tail >= fold - 0.5) {
          onFitRef.current(k);
          return;
        }
      }
    };

    // Coalesce every trigger into one measurement per frame, taken after
    // paint so row heights reflect the committed layout.
    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };

    const observed = anchor.parentElement;

    // Resize: the scroll container rather than the window, so the page also
    // refits when a sidebar collapses or a panel opens.
    const ro = new ResizeObserver(schedule);
    if (observed) ro.observe(observed);

    // Mutations: rows frequently appear without any prop this hook can see
    // changing: a loading skeleton swapping to a real table leaves the row
    // count and container size untouched. Without this the first (empty)
    // measurement would be the last one, and the page would keep whatever
    // size it happened to start with.
    const mo = new MutationObserver(schedule);
    if (observed) mo.observe(observed, { childList: true, subtree: true });

    window.addEventListener('resize', schedule);
    schedule();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, [anchorRef, enabled, perPage, totalItems]);
}
