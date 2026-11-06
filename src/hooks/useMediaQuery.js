import { useSyncExternalStore } from 'react';

/** True while the CSS media query matches; re-renders when it flips. */
export function useMediaQuery(query) {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/**
 * Phones get the provider mobile app instead of the desktop layout: narrow
 * screens, and touch screens that are short (a phone turned sideways is
 * ~870px wide but only ~400px tall). Keep in sync with the phone block in
 * src/index.css.
 */
export const MOBILE_QUERY = '(max-width: 767px), (pointer: coarse) and (max-height: 500px)';
