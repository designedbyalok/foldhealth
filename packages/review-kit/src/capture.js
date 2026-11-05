import { snapdom } from '@zumer/snapdom';
import { finder } from '@medv/finder';
import { KIT_ATTR } from './picker';

// The kit's own UI (dock, picker overlay) never appears in a screenshot.
const EXCLUDE = `[${KIT_ATTR}]`;
const pixelRatio = () => Math.min(2, window.devicePixelRatio || 1);

/** PNG of one element. */
export function captureElement(el) {
  return snapdom.toBlob(el, { format: 'png', exclude: EXCLUDE, dpr: pixelRatio() });
}

/** PNG of what's on screen right now. */
export async function captureViewport() {
  const dpr = pixelRatio();
  const width = window.innerWidth;
  const height = window.innerHeight;

  // One capture of the whole document, then crop to the viewport. Capturing
  // panes individually and compositing them (an older workaround for a flex
  // layout quirk) risks drawing the same subtree twice when snapdom includes
  // its parent context, so the output doubles up headings and controls.
  const shot = await snapdom.toCanvas(document.documentElement, { exclude: EXCLUDE, dpr });

  const out = document.createElement('canvas');
  out.width = Math.round(width * dpr);
  out.height = Math.round(height * dpr);
  const ctx = out.getContext('2d');

  const bg = [document.body, document.documentElement]
    .map(el => getComputedStyle(el).backgroundColor)
    .find(c => c && c !== 'transparent' && c !== 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = bg || '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);

  // Crop at the current scroll offset so the output matches what the user
  // sees, not the top of the page.
  const sx = Math.round(window.scrollX * dpr);
  const sy = Math.round(window.scrollY * dpr);
  const sw = Math.round(width * dpr);
  const sh = Math.round(height * dpr);
  ctx.drawImage(shot, sx, sy, sw, sh, 0, 0, out.width, out.height);

  return new Promise((resolve, reject) => {
    out.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Screenshot failed'))), 'image/png');
  });
}

// Bundler-generated class names (CSS Modules, styled-components…) change
// between builds, so they make poor selectors.
const GENERATED_CLASS = /^_|__|[_-][a-z0-9]{5,}$|^css-|^sc-/i;

/**
 * A unique CSS selector for the element, so a comment can point back at it.
 * Returns null if none can be built in time.
 */
export function selectorFor(el, options = {}) {
  try {
    return finder(el, {
      className: (name) => !GENERATED_CLASS.test(name),
      timeoutMs: 500,
      ...options,
    });
  } catch {
    return null;
  }
}
