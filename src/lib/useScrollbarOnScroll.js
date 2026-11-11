import { useEffect } from 'react';

/**
 * Marks `ref`'s element with `data-scrolling` while it, or anything inside
 * it, is scrolling, and for `ms` after. Pair it with the
 * `scrollbar-x-on-scroll` class (src/index.css) so a wide table's
 * horizontal scrollbar shows only while it moves.
 */
export function useScrollbarOnScroll(ref, ms = 800) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let timer;
    const onScroll = () => {
      el.setAttribute('data-scrolling', '');
      clearTimeout(timer);
      timer = setTimeout(() => el.removeAttribute('data-scrolling'), ms);
    };
    // Scroll doesn't bubble; capture catches the table's own scroller too.
    el.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll, { capture: true });
      clearTimeout(timer);
    };
  }, [ref, ms]);
}
