import { useEffect } from 'react';

/**
 * Scroll a drawer section into view when the drawer was opened for it (the
 * plan row's Notes action opens a drawer at its Note section). Re-runs when
 * the drawer switches item. Deferred a frame so the section has laid out.
 */
export function useScrollToSection(ref, active, itemKey) {
  useEffect(() => {
    if (!active) return undefined;
    const raf = requestAnimationFrame(() => {
      ref.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(raf);
  }, [ref, active, itemKey]);
}
