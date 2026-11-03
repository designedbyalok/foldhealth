import { useEffect, useRef, useState } from 'react';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { findPassageItems } from './findPassage';
import styles from './PdfPassageViewer.module.css';

async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  return pdfjs;
}

// One page: its canvas at the viewer's width, and when it holds the passage,
// boxes over the lines it came from. `onHighlight(el)` gets the first box.
function Page({ pdf, pdfjs, number, width, passage, onHighlight }) {
  const canvasRef = useRef(null);
  const [size, setSize] = useState(null);
  const [boxes, setBoxes] = useState([]);

  useEffect(() => {
    if (!width) return undefined;
    let cancelled = false;
    let task = null;
    (async () => {
      const page = await pdf.getPage(number);
      const viewport = page.getViewport({ scale: width / page.getViewport({ scale: 1 }).width });
      const canvas = canvasRef.current;
      if (cancelled || !canvas) return;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      setSize({ width: viewport.width, height: viewport.height });
      task = page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport, transform: ratio === 1 ? null : [ratio, 0, 0, ratio, 0, 0] });
      await task.promise.catch(() => {});
      if (cancelled || !passage) { setBoxes([]); return; }
      const { items } = await page.getTextContent();
      const hits = findPassageItems(items, passage);
      if (!cancelled) {
        setBoxes(hits.map((i) => {
          const tx = pdfjs.Util.transform(viewport.transform, items[i].transform);
          const height = Math.hypot(tx[2], tx[3]);
          return { key: i, left: tx[4], top: tx[5] - height, width: items[i].width * viewport.scale, height };
        }));
      }
    })();
    return () => { cancelled = true; task?.cancel(); };
  }, [pdf, pdfjs, number, width, passage]);

  return (
    <div className={styles.page} style={size ? { width: size.width, height: size.height } : undefined} data-page={number}>
      <canvas ref={canvasRef} className={styles.canvas} style={size ? { width: size.width, height: size.height } : undefined} />
      {boxes.map((b, idx) => (
        <span
          key={b.key}
          ref={idx === 0 ? onHighlight : undefined}
          className={styles.highlight}
          style={{ left: b.left, top: b.top, width: b.width, height: b.height }}
        />
      ))}
    </div>
  );
}

/**
 * PdfPassageViewer: a PDF shown page under page at the viewer's width, with
 * a quoted `passage` highlighted where it appears on `page` and scrolled
 * into view. For checking an extracted item against its source document.
 * The passage is matched loosely (spacing, case, punctuation); if it isn't
 * found the viewer still opens at `page`.
 *
 * @param {object} props
 * @param {string} props.src          – URL of the PDF (a signed link is fine)
 * @param {number} [props.page]       – 1-based page to open at
 * @param {string} [props.passage]    – text to highlight on that page
 * @param {string} [props.className]
 */
export function PdfPassageViewer({ src, page = null, passage = '', className }) {
  const rootRef = useRef(null);
  // Both remember the src they belong to, so a new src shows loading again.
  const [loaded, setLoaded] = useState(null); // { src, pdf, pdfjs, pages }
  const [failedSrc, setFailedSrc] = useState(null);
  const [width, setWidth] = useState(0);
  const doc = loaded?.src === src ? loaded : null;
  const failed = failedSrc === src;

  useEffect(() => {
    let cancelled = false;
    let loadingTask = null;
    (async () => {
      try {
        const pdfjs = await loadPdfjs();
        loadingTask = pdfjs.getDocument({ url: src });
        const pdf = await loadingTask.promise;
        if (!cancelled) setLoaded({ src, pdf, pdfjs, pages: pdf.numPages });
      } catch {
        if (!cancelled) setFailedSrc(src);
      }
    })();
    return () => { cancelled = true; loadingTask?.destroy(); };
  }, [src]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Open at the page; the highlight, once drawn, scrolls itself to the middle.
  useEffect(() => {
    if (!doc || !page) return;
    rootRef.current?.querySelector(`[data-page="${page}"]`)?.scrollIntoView({ block: 'start' });
  }, [doc, page, width]);
  const onHighlight = (el) => { el?.scrollIntoView({ block: 'center' }); };

  return (
    <div ref={rootRef} className={[styles.root, className || ''].filter(Boolean).join(' ')}>
      {failed && <p className={styles.status}>The document could not be shown.</p>}
      {!doc && !failed && <p className={styles.status}>Loading the document…</p>}
      {doc && width > 0 && Array.from({ length: doc.pages }, (_, i) => (
        <Page
          key={i + 1}
          pdf={doc.pdf}
          pdfjs={doc.pdfjs}
          number={i + 1}
          width={width}
          passage={i + 1 === page ? passage : ''}
          onHighlight={onHighlight}
        />
      ))}
    </div>
  );
}
