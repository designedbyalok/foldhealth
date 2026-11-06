import { useCallback, useEffect, useState } from 'react';

/** Object URLs for local file previews, by key: each is revoked when dropped, and any left over when the screen closes. */
export function useObjectUrls() {
  const [live] = useState(() => new Map());
  useEffect(() => () => {
    live.forEach(url => URL.revokeObjectURL(url));
    live.clear();
  }, [live]);
  const create = useCallback((key, blob) => {
    if (!live.has(key)) live.set(key, URL.createObjectURL(blob));
    return live.get(key);
  }, [live]);
  const revoke = useCallback((key) => {
    if (!live.has(key)) return;
    URL.revokeObjectURL(live.get(key));
    live.delete(key);
  }, [live]);
  return { create, revoke };
}
