import { useEffect, useState } from 'react';
import { rasterizeComponent } from './rasterizeComponent';
import interRegularUrl from '../../assets/fonts/inter/Inter-Regular.ttf?url';
import interMediumUrl from '../../assets/fonts/inter/Inter-Medium.ttf?url';
import interSemiBoldUrl from '../../assets/fonts/inter/Inter-SemiBold.ttf?url';
import interBoldUrl from '../../assets/fonts/inter/Inter-Bold.ttf?url';
import interItalicUrl from '../../assets/fonts/inter/Inter-Italic.ttf?url';
import interBoldItalicUrl from '../../assets/fonts/inter/Inter-BoldItalic.ttf?url';

// Shared by printed reports that use Report Header / Report Footer
// components (Employer Impact Report, Care Plan): the components drawn to
// PNG for jsPDF, the Inter fonts jsPDF embeds, and logos as PNGs.

// A footer showing the page number is drawn for each page up to this; any
// page past it gets the built-in footer.
export const FOOTER_PAGES = 30;
export const PAGE_TOKEN = /\{\{\s*page[ _-]?number\s*\}\}/i;

/** 'light' when the right-middle of a drawn footer is dark, else 'dark'. */
export function inkAtRight(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = 1; c.height = 1;
        const g = c.getContext('2d');
        g.drawImage(img, img.width * 0.96, img.height * 0.4, img.width * 0.02, img.height * 0.2, 0, 0, 1, 1);
        const [r, gr, b, a] = g.getImageData(0, 0, 1, 1).data;
        resolve(a > 128 && 0.2126 * r + 0.7152 * gr + 0.0722 * b < 140 ? 'light' : 'dark');
      } catch { resolve('dark'); }
    };
    img.onerror = () => resolve('dark');
    img.src = dataUrl;
  });
}

/**
 * A report component (header / footer) drawn to PNG with its merge tags
 * filled from `ctx`, for the PDF. Redrawn once edits pause; until the first
 * drawing is ready, or if it can't be drawn, returns null so the PDF uses
 * its built-in version. A component showing {{page_number}} comes back as
 * one image per page: `{ width, height, images }`.
 */
export function useComponentImage(component, ctx, fontFaces, enabled) {
  const [result, setResult] = useState(null); // { key, image }
  // Redrawn only when something it shows changes: a footer with just the
  // page number doesn't redraw (30 pages) for a new employer logo or title.
  const tree = component ? JSON.stringify(component.tree) : '';
  const uses = (token) => new RegExp(`\\{\\{\\s*${token}\\s*\\}\\}`, 'i').test(tree);
  const key = [
    component?.id, component?.updatedAt,
    uses('report_title') ? ctx.reportTitle : '',
    uses('generated_on') ? ctx.generatedOn : '',
    uses('employer_logo') ? ctx.employerLogo : '',
    uses('page_count') ? ctx.pageCount : '',
    fontFaces.length,
  ].join('|');
  useEffect(() => {
    if (!enabled || !component) return undefined;
    let live = true;
    const timer = window.setTimeout(async () => {
      const draw = (extra) => rasterizeComponent(component.tree, { ...ctx, ...extra }, { fontFaces });
      let image = null;
      if (PAGE_TOKEN.test(JSON.stringify(component.tree))) {
        const pages = await Promise.all(Array.from({ length: FOOTER_PAGES }, (_, i) => draw({ pageNumber: i + 1, pageCount: ctx.pageCount || '' })));
        if (pages[0]) image = { width: pages[0].width, height: pages[0].height, images: pages.map(p => p?.dataUrl) };
      } else {
        image = await draw({});
        // No page number of its own: the PDF adds one on the right, in
        // white when the footer is dark there.
        if (image) image = { ...image, pageInk: await inkAtRight(image.dataUrl) };
      }
      if (live) setResult({ key, image });
      // The first drawing starts at once; redraws wait for typing to pause.
    }, result ? 250 : 0);
    return () => { live = false; window.clearTimeout(timer); };
    // `key` covers every input that changes the drawing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key]);
  // The last drawing stays up while a new one is made. `settled`: nothing
  // left to draw for the current inputs (or nothing to draw at all).
  return { image: result?.image || null, settled: !enabled || !component || result?.key === key };
}

// jsPDF places PNGs only, so each logo is drawn to a canvas once (at the
// given pixel size, sharp enough for print) and reused for every PDF.
const pngCache = new Map();
/**
 * `url` drawn to a `width` × `height` canvas as a PNG data URL. With
 * `trim`, the result is cropped to its visible pixels (plus `pad` px) and
 * reports that size, so an image is centred by what shows, not by empty
 * space its artwork leaves (e.g. a wordmark set in a machine's own font).
 */
export function loadPng(url, width, height, { trim = false, pad = 0 } = {}) {
  const key = `${url}|${width}|${height}|${trim}|${pad}`;
  if (!pngCache.has(key)) {
    pngCache.set(key, new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        if (!trim) { resolve({ dataUrl: canvas.toDataURL('image/png'), width, height }); return; }
        const { data } = ctx.getImageData(0, 0, width, height);
        let minX = width; let maxX = -1; let minY = height; let maxY = -1;
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            if (data[(y * width + x) * 4 + 3] > 8) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
        if (maxX < 0) { resolve({ dataUrl: canvas.toDataURL('image/png'), width, height }); return; }
        const x0 = Math.max(0, minX - pad);
        const y0 = Math.max(0, minY - pad);
        const w = Math.min(width, maxX + 1 + pad) - x0;
        const h = Math.min(height, maxY + 1 + pad) - y0;
        const out = document.createElement('canvas');
        out.width = w;
        out.height = h;
        out.getContext('2d').drawImage(canvas, x0, y0, w, h, 0, 0, w, h);
        resolve({ dataUrl: out.toDataURL('image/png'), width: w, height: h });
      };
      img.onerror = () => resolve(null);
      img.src = url;
    }));
  }
  return pngCache.get(key);
}

// Inter for the PDF: jsPDF embeds TTFs as base64. Fetched once, on first
// open, so the fonts never weigh on the report page itself.
const INTER_URLS = {
  regular: interRegularUrl,
  medium: interMediumUrl,
  semibold: interSemiBoldUrl,
  bold: interBoldUrl,
  italic: interItalicUrl,
  boldItalic: interBoldItalicUrl,
};
let interPromise = null;
function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
export function loadInter() {
  if (!interPromise) {
    interPromise = Promise.all(Object.entries(INTER_URLS).map(([key, url]) => fetch(url)
      .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(url))))
      .then(buf => [key, toBase64(buf)])))
      .then(Object.fromEntries)
      .catch(() => null); // the PDF falls back to Helvetica
  }
  return interPromise;
}
