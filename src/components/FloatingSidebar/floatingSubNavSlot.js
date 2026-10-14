import { useSyncExternalStore } from 'react';

// Stash the registry on globalThis so a single instance is shared across
// HMR-split module copies (SidebarFloating lives in the eager app entry,
// each feature layout lives in its own lazy chunk — Vite can hand them
// separate instances of this file in dev, which would make the Set + ref
// orphaned per chunk). The guard also survives SSR / tests cleanly.

/**
 * Tiny module-level registry for the FloatingSidebar's inner sub-panel
 * DOM slot. `SidebarFloating` renders an empty `<div>` inside the
 * floating card and registers it here; each feature's layout
 * (AnalyticsLayout, SettingsLayout, CallsView, MessagesView) reads the
 * registered node via `useFloatingSubNavSlot` and portals its own
 * SideNav into it when `sidebarShape === 'floating'`.
 *
 * Portaling keeps every feature's SideNav state local to its layout
 * (store selectors, local callbacks, scroll refs) — the DOM moves into
 * the floating card, the React fiber tree does not. That's cheaper than
 * extracting each nav into a shared component.
 *
 * The slot is a single DOM node across the app (there's only one
 * SidebarFloating at a time), so a module-level ref + subscriber Set is
 * simpler than threading a Context through every feature route.
 */
const STORE_KEY = '__foldFloatingSubNavSlot__';
const g = typeof globalThis !== 'undefined' ? globalThis : {};
if (!g[STORE_KEY]) {
  g[STORE_KEY] = { currentSlot: null, subscribers: new Set() };
}
const store = g[STORE_KEY];

export function setFloatingSubNavSlot(el) {
  if (store.currentSlot === el) return;
  store.currentSlot = el;
  store.subscribers.forEach(cb => cb(el));
}

function subscribe(cb) {
  store.subscribers.add(cb);
  return () => store.subscribers.delete(cb);
}
function getSnapshot() { return store.currentSlot; }
function getServerSnapshot() { return null; }

export function useFloatingSubNavSlot() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
