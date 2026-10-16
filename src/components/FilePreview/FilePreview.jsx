import { useEffect, useState } from 'react';
import { Icon } from '../Icon/Icon';
import { Button } from '../Button/Button';
import { sanitizeRichText } from '../../lib/sanitizeHtml';
import { resolveFileKind } from './FilePreview.utils';
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
export function FilePreview({ src, file, name, ext, className, hideScrollbar = false }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const kind = resolveFileKind({ src: src || blobUrl, name, ext });
  const [docxHtml, setDocxHtml] = useState(null);
  const [docxError, setDocxError] = useState(false);

  useEffect(() => {
    if (!file) {
      setBlobUrl(null);
      return undefined;
    }
    const objectUrl = URL.createObjectURL(file);
    setBlobUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const resolvedSrc = src || blobUrl;

  useEffect(() => {
    if (kind !== 'docx' || !resolvedSrc) return undefined;
    let cancelled = false;
    setDocxHtml(null);
    setDocxError(false);
    (async () => {
      try {
        const { default: mammoth } = await import('mammoth/mammoth.browser');
        const res = await fetch(resolvedSrc);
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
  }, [kind, resolvedSrc]);

  const wrapClass = [styles.wrap, className || ''].filter(Boolean).join(' ');

  // A document row whose bytes never reached Storage (failed upload) has
  // nothing to show; say so instead of rendering a blank pane.
  if (!resolvedSrc) {
    return (
      <div className={`${wrapClass} ${styles.center}`}>
        <div className={styles.fallbackCard}>
          <Icon name="solar:file-corrupted-linear" size={36} color="var(--neutral-200)" />
          <div className={styles.fallbackName}>{name || 'Document'}</div>
          <div className={styles.fallbackHint}>
            The file wasn&rsquo;t uploaded, so there&rsquo;s nothing to preview. Upload it again.
          </div>
        </div>
      </div>
    );
  }

  if (kind === 'image') {
    return (
      <div className={wrapClass}>
        <img src={resolvedSrc} alt={name || 'Document'} className={styles.image} />
      </div>
    );
  }

  if (kind === 'pdf') {
    // The browser's PDF viewer draws its own scrollbar, which CSS can't
    // style, so `hideScrollbar` clips it off the right edge instead.
    // Scrolling by wheel or trackpad still works.
    if (hideScrollbar) {
      return (
        <div className={`${wrapClass} ${styles.pdfClip}`}>
          <iframe src={resolvedSrc} title={name || 'Document'} className={styles.pdfClipFrame} />
        </div>
      );
    }
    return <iframe src={resolvedSrc} title={name || 'Document'} className={wrapClass} />;
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
          onClick={() => window.open(resolvedSrc, '_blank', 'noopener')}
        >
          Open in new tab
        </Button>
      </div>
    </div>
  );
}
