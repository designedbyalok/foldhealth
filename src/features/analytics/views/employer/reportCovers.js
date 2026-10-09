/**
 * Built-in cover images for the Employer Impact report. Original artwork,
 * drawn for this report (no stock photos, so no licence or attribution to
 * track). A4 portrait, so they fill the cover page without cropping.
 */
import aurora from '../../../../assets/report-covers/aurora.svg';
import tide from '../../../../assets/report-covers/tide.svg';
import dusk from '../../../../assets/report-covers/dusk.svg';
import contour from '../../../../assets/report-covers/contour.svg';
import prism from '../../../../assets/report-covers/prism.svg';
import bloom from '../../../../assets/report-covers/bloom.svg';
import horizon from '../../../../assets/report-covers/horizon.svg';
import pulse from '../../../../assets/report-covers/pulse.svg';

export const PRESET_COVERS = [
  { id: 'aurora', label: 'Aurora', src: aurora },
  { id: 'tide', label: 'Tide', src: tide },
  { id: 'dusk', label: 'Dusk', src: dusk },
  { id: 'contour', label: 'Contour', src: contour },
  { id: 'prism', label: 'Prism', src: prism },
  { id: 'bloom', label: 'Bloom', src: bloom },
  { id: 'horizon', label: 'Horizon', src: horizon },
  { id: 'pulse', label: 'Pulse', src: pulse },
];

// Rendered for print at twice A4's point size, then kept as JPEG so the PDF
// stays light.
const RENDER_W = 1190;
const RENDER_H = 1684;
const loaded = new Map();

/**
 * A cover image by URL (a built-in SVG, or an uploaded PNG/JPG/SVG) as what
 * jsPDF needs: `{ dataUrl, format, width, height }`, or null if it can't be
 * read. Drawn to a canvas so SVGs become pixels and every source ends up the
 * same JPEG shape. Cached per URL.
 */
export function loadCoverImage(src) {
  if (!loaded.has(src)) {
    loaded.set(src, new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const w = img.naturalWidth || RENDER_W;
        const h = img.naturalHeight || RENDER_H;
        // Keep the source's shape, at print size (never upscale a photo past 2x).
        const scale = Math.min(Math.max(RENDER_W / w, RENDER_H / h), 2);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        try {
          resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.9), format: 'JPEG', width: canvas.width, height: canvas.height });
        } catch {
          resolve(null); // a tainted canvas (no CORS on the source)
        }
      };
      img.onerror = () => resolve(null);
      img.src = src;
    }).then((out) => { if (!out) loaded.delete(src); return out; }));
  }
  return loaded.get(src);
}
