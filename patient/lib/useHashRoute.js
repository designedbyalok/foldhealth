import { useEffect, useState } from 'react';

/** Go to `path` (e.g. 'messages?to=Sarah%20Kim'). */
export function goTo(path) {
  window.location.hash = `/${path}`;
}

const read = (fallback) => window.location.hash.replace(/^#\/?/, '').split(/[/?]/)[0] || fallback;

export function useHashRoute(fallback) {
  const [route, setRoute] = useState(() => read(fallback));
  useEffect(() => {
    const onChange = () => setRoute(read(fallback));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, [fallback]);
  return [route, (next) => { window.location.hash = `/${next}`; }];
}

const readSub = () => window.location.hash.replace(/^#\/?/, '').split('?')[0].split('/')[1] || '';

/** The second path segment ('settings/packages' → 'packages'). */
export function useHashSubRoute() {
  const [sub, setSub] = useState(readSub);
  useEffect(() => {
    const onChange = () => setSub(readSub());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return sub;
}

/** A query value from the hash ('settings/packages?tab=available' → 'available'). */
export function hashParam(name) {
  const q = window.location.hash.split('?')[1] || '';
  return new URLSearchParams(q).get(name);
}
