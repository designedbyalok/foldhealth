import { useEffect, useRef } from 'react';
import { CloseIcon } from './icons';

// The file's preview URL lives only while its image is mounted, so the blob
// is freed when the image goes away.
export function BlobImage({ file, alt, className }) {
  const img = useRef(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    img.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return <img ref={img} alt={alt} className={className} />;
}

/**
 * Attachments as a row of square thumbnails, so many fit at once; the row
 * scrolls sideways and a new attachment scrolls into view as it's added.
 * Clicking a thumbnail opens it.
 */
export function AttachmentStrip({ items, onOpen, onRemove, labelFor, labels, className }) {
  const list = useRef(null);
  const count = items.length;
  const lastCount = useRef(count);

  useEffect(() => {
    // Scroll the row itself: scrollIntoView could also scroll the page.
    if (count > lastCount.current) list.current?.scrollTo({ left: list.current.scrollWidth, behavior: 'smooth' });
    lastCount.current = count;
  }, [count]);

  if (!count) return null;

  return (
    <div className={className ? `rk-strip ${className}` : 'rk-strip'}>
      <ul className="rk-strip-list" ref={list} aria-label={labels.attachments}>
        {items.map(a => (
          <li key={a.id} className="rk-thumb">
            <button type="button" className="rk-thumb-open" onClick={() => onOpen(a.id)} title={labelFor(a)} aria-label={labels.openImage(labelFor(a))}>
              <BlobImage file={a.file} alt="" />
              {a.annotated && <span className="rk-thumb-mark" aria-hidden="true" />}
            </button>
            <button type="button" className="rk-thumb-remove" onClick={() => onRemove(a.id)} aria-label={labels.remove(labelFor(a))}>
              <CloseIcon width={10} height={10} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
