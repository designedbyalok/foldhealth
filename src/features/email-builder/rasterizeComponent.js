/**
 * Draws a saved component to a PNG, for places that can't show HTML (a
 * jsPDF report). The component renders through the same HTML as a sent
 * email, with its merge tags filled from `ctx`; that HTML is drawn through
 * an SVG <foreignObject> onto a canvas.
 *
 * An SVG drawn as an image can't load anything, so images are inlined as
 * data URLs first and fonts are passed in as @font-face rules.
 */
import { renderEmailHtml } from './patchEmailHtml';
import { applyMergeTags } from './mergeTags';
import { componentToDocument } from './componentDocument';

const WIDTH = 600; // the builder's canvas width

const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

function toDataUrl(src) {
  if (!src || src.startsWith('data:')) return Promise.resolve(src);
  return fetch(src)
    .then(r => (r.ok ? r.blob() : Promise.reject(new Error(src))))
    .then(blob => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(src);
      reader.readAsDataURL(blob);
    }))
    .catch(() => src);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * @param {{ rootId: string, blocks: object }} tree – The component
 * @param {object} ctx      – Merge-tag values (camelCase, e.g. reportTitle)
 * @param {object} [opts]
 * @param {string} [opts.fontFaces] – @font-face CSS, with data URLs
 * @param {number} [opts.scale=3]   – Pixel density of the PNG
 * @returns {Promise<{ dataUrl: string, width: number, height: number } | null>}
 *   `width` × `height` in canvas pixels at 1×; null if it can't be drawn
 */
export async function rasterizeComponent(tree, ctx, { fontFaces = '', scale = 3 } = {}) {
  if (!tree?.rootId || typeof document === 'undefined') return null;
  try {
    const safeCtx = Object.fromEntries(Object.entries(ctx).map(([k, v]) => [k, k.endsWith('Logo') ? v : escapeHtml(v)]));
    const html = applyMergeTags(renderEmailHtml(componentToDocument(tree), { wrapperPadding: '0', theme: 'light' }), safeCtx);
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const body = parsed.querySelector('.email-container');
    if (!body) return null;
    await Promise.all([...body.querySelectorAll('img')].map(async (img) => {
      img.setAttribute('src', await toDataUrl(img.getAttribute('src')));
    }));

    // Measured in this page, which already has the fonts, at the canvas width.
    const host = document.createElement('div');
    host.style.cssText = `position:fixed;left:-10000px;top:0;width:${WIDTH}px;visibility:hidden;`;
    host.innerHTML = body.outerHTML;
    document.body.appendChild(host);
    await Promise.all([...host.querySelectorAll('img')].map(img => (img.complete ? null : img.decode().catch(() => null))));
    const height = Math.ceil(host.getBoundingClientRect().height);
    host.remove();
    if (!height) return null;

    const xhtml = new XMLSerializer().serializeToString(body);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}">`
      + `<foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${WIDTH}px">`
      + `<style>${fontFaces} img{display:block;max-width:100%;height:auto;border:0} p,h1,h2,h3{margin:0}</style>${xhtml}</div></foreignObject></svg>`;
    const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH * scale;
    canvas.height = height * scale;
    const c2d = canvas.getContext('2d');
    c2d.scale(scale, scale);
    c2d.drawImage(img, 0, 0);
    return { dataUrl: canvas.toDataURL('image/png'), width: WIDTH, height };
  } catch {
    // e.g. a browser that won't read back a canvas an SVG was drawn to.
    return null;
  }
}

/** @font-face rules for base64 TTFs keyed regular / medium / semibold / bold. */
export function interFontFaces(fonts) {
  if (!fonts) return '';
  const weights = { regular: 400, medium: 500, semibold: 600, bold: 700 };
  return Object.entries(weights)
    .filter(([key]) => fonts[key])
    .map(([key, weight]) => `@font-face{font-family:'Inter';font-weight:${weight};src:url(data:font/ttf;base64,${fonts[key]}) format('truetype');}`)
    .join('');
}
