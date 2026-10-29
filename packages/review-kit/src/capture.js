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

const isVisible = (el) => {
  if (!(el instanceof HTMLElement) || el.matches(EXCLUDE) || el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return false;
  const cs = getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth;
};

const coversViewport = (el) => {
  const r = el.getBoundingClientRect();
  const w = Math.min(r.right, window.innerWidth) - Math.max(r.left, 0);
  const h = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
  return w * h >= 0.9 * window.innerWidth * window.innerHeight;
};

// What's on screen, as layers to draw in order. DOM-to-image renderers lose
// full-height app shells (a 100vh flex container with overflow hidden comes
// out with an empty main column), while each pane renders fine on its own.
// So: walk down from <body> through single-child wrappers to the shell,
// capture the shell's visible panes, then anything portalled outside it
// (drawers, modals, toasts) on top.
function viewportLayers() {
  const path = [document.body];
  let shell = document.body;
  // The first full-screen child at each level is the shell; full-screen
  // siblings after it (a drawer's backdrop, a modal) are overlays.
  for (let next; (next = [...shell.children].find(el => isVisible(el) && coversViewport(el)));) {
    shell = next;
    path.push(shell);
  }
  const panes = shell === document.body ? [] : [...shell.children].filter(isVisible);
  const overlays = path.flatMap((node, i) => [...node.children]
    .filter(child => child !== path[i + 1] && !panes.includes(child) && isVisible(child)));
  return { shell, layers: panes.length ? [...panes, ...overlays] : [shell, ...overlays] };
}

/** PNG of what's on screen right now. */
export async function captureViewport() {
  const dpr = pixelRatio();
  const width = window.innerWidth;
  const height = window.innerHeight;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext('2d');

  const { shell, layers } = viewportLayers();
  const bg = [shell, document.body, document.documentElement]
    .map(el => getComputedStyle(el).backgroundColor)
    .find(c => c && c !== 'transparent' && c !== 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = bg || '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const el of layers) {
    const r = el.getBoundingClientRect();
    const shot = await snapdom.toCanvas(el, { exclude: EXCLUDE, dpr });
    ctx.drawImage(shot, r.left * dpr, r.top * dpr, r.width * dpr, r.height * dpr);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Screenshot failed'))), 'image/png');
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
