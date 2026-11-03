import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Wraps a click handler so a returned promise (any async handler) marks the
 * control busy until it settles. While busy, further clicks are swallowed, so
 * an impatient second click can't save twice. Shared by Button and
 * ActionButton.
 *
 * @param {function} onClick  The caller's handler.
 * @param {boolean} [blocked] Also swallow clicks (e.g. a controlled `loading`).
 * @returns {[boolean, function]} [pending, handleClick]
 */
export function usePendingClick(onClick, blocked = false) {
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const handleClick = useCallback((e) => {
    if (pendingRef.current || blocked) {
      e.preventDefault();
      return undefined;
    }
    const result = onClick?.(e);
    if (result && typeof result.then === 'function') {
      pendingRef.current = true;
      setPending(true);
      const done = () => {
        pendingRef.current = false;
        if (mounted.current) setPending(false);
      };
      // Both outcomes end the busy state; the caller still owns the error.
      result.then(done, done);
    }
    return result;
  }, [onClick, blocked]);

  return [pending, handleClick];
}
