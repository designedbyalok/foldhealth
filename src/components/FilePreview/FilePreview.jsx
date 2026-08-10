import { useEffect, useState } from 'react';
import { Icon } from '../Icon/Icon';
import { Button } from '../Button/Button';
import { sanitizeRichText } from '../../lib/sanitizeHtml';
import styles from './FilePreview.module.css';

/**
 * FilePreview — inline viewer for a document URL (object URL, Supabase
 * Storage public URL, or bundled /charts asset). Routes by file type so a
 * preview NEVER turns into a browser download:
 *
 *   - images (png/jpg/…)  → <img>
 *   - pdf (incl. blob:)   → <iframe>
 *   - docx                → rendered to HTML client-side via mammoth
 *   - anything else (doc, xls, csv, tiff, …) → fallback card with an
 *     explicit "Open in new tab" action — the browser may download there,
 *     but only on a deliberate click, never on preview open.
 *
 * Extension is resolved from `ext` → `name` → the URL's pathname, so
 * Storage URLs (which embed the original filename) type correctly even
 * when the doc record predates the `ext` field.
 */
const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg']);

function extOf(str) {
  if (!str) return '';
  const clean = String(str).split(/[?#]/)[0];
  const m = clean.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : '';
}

export function resolveFileKind({ src, name, ext }) {
  const e = (ext || '').toLowerCase() || extOf(name) || (src && !src.startsWith('blob:') ? extOf(src) : '');
  if (IMAGE_EXTS.has(e)) return 'image';
  if (e === 'docx') return 'docx';
  if (e === 'pdf' || e === '') return 'pdf'; // blob: URLs from jsPDF/PDF uploads carry no ext
  return 'other';
}

export function FilePreview({ src, name, ext, className }) {
  const kind = resolveFileKind({ src, name, ext });
  const [docxHtml, setDocxHtml] = useState(null);
  const [docxError, setDocxError] = useState(false);

  useEffect(() => {
    if (kind !== 'docx' || !src) return undefined;
    let cancelled = false;
    setDocxHtml(null);
    setDocxError(false);
    (async () => {
      try {
        const { default: mammoth } = await import('mammoth/mammoth.browser');
        const res = await fetch(src);
        if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
        const buf = await res.arrayBuffer();
        const { value } = await mammoth.convertToHtml({ arrayBuffer: buf });
        if (!cancelled) setDocxHtml(value);
      } catch (e) {
        console.warn('[FilePreview] docx render failed:', e?.message || e);
        if (!cancelled) setDocxError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [kind, src]);

  const wrapClass = [styles.wrap, className || ''].filter(Boolean).join(' ');

  if (!src) return null;

  if (kind === 'image') {
    return (
      <div className={wrapClass}>
        <img src={src} alt={name || 'Document'} className={styles.image} />
      </div>
    );
  }

  if (kind === 'pdf') {
    return <iframe src={src} title={name || 'Document'} className={wrapClass} />;
  }

  if (kind === 'docx' && !docxError) {
    if (docxHtml === null) {
      return (
        <div className={`${wrapClass} ${styles.center}`}>
          <span className={styles.loadingText}>Rendering document…</span>
        </div>
      );
    }
    return (
      <div className={wrapClass}>
        {/* mammoth output is HTML derived from a user-uploaded .docx, so it is
            untrusted input and gets sanitized before it reaches the DOM. */}
        <div className={styles.docxPage} dangerouslySetInnerHTML={{ __html: sanitizeRichText(docxHtml) }} />
      </div>
    );
  }

  // Unsupported inline (legacy .doc, xls, csv, tiff…) or a failed docx render.
  return (
    <div className={`${wrapClass} ${styles.center}`}>
      <div className={styles.fallbackCard}>
        <Icon name="solar:file-text-linear" size={36} color="var(--neutral-200)" />
        <div className={styles.fallbackName}>{name || 'Document'}</div>
        <div className={styles.fallbackHint}>
          This file type can&rsquo;t be previewed in the app.
        </div>
        <Button
          variant="secondary"
          size="S"
          leadingIcon="solar:square-top-down-linear"
          onClick={() => window.open(src, '_blank', 'noopener')}
        >
          Open in new tab
        </Button>
      </div>
    </div>
  );
}
