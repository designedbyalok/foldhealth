import { useEffect, useRef, useState } from 'react';
import { ChevronIcon, CloseIcon } from './icons';

// The file's preview URL lives only while its slide is mounted, so the
// blob is freed when the slide goes away.
function SlideImage({ file, alt }) {
  const img = useRef(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    img.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return <img ref={img} alt={alt} />;
}

export function AttachmentCarousel({ items, onRemove, labelFor, labels, className }) {
  const track = useRef(null);
  const [index, setIndex] = useState(0);
  const count = items.length;
  const lastCount = useRef(count);

  const goTo = (i, behavior = 'smooth') => {
    const el = track.current?.children[i];
    if (!el) return;
    track.current.scrollTo({ left: el.offsetLeft - track.current.offsetLeft, behavior });
  };

  // Slide to the newest attachment when one is added.
  useEffect(() => {
    if (count > lastCount.current) goTo(count - 1);
    lastCount.current = count;
  }, [count]);

  // Keep the counter in step with swipes and arrow clicks.
  const onScroll = () => {
    const t = track.current;
    if (!t || !t.children.length) return;
    const slide = t.children[0].getBoundingClientRect().width;
    setIndex(Math.min(count - 1, Math.round(t.scrollLeft / Math.max(1, slide))));
  };

  if (!count) return null;
  const current = Math.min(index, count - 1);

  return (
    <div className={className ? `rk-carousel ${className}` : 'rk-carousel'} aria-roledescription="carousel" aria-label={labels.attachments}>
      <ul className="rk-carousel-track" ref={track} onScroll={onScroll}>
        {items.map((a, i) => (
          <li key={a.id} className="rk-slide" aria-roledescription="slide" aria-label={`${i + 1} of ${count}: ${labelFor(a)}`}>
            <SlideImage file={a.file} alt={labelFor(a)} />
            <span className="rk-slide-label">{labelFor(a)}</span>
            <button type="button" className="rk-slide-remove" onClick={() => onRemove(a.id)} aria-label={labels.remove(labelFor(a))}>
              <CloseIcon width={12} height={12} />
            </button>
          </li>
        ))}
      </ul>
      {count > 1 && (
        <>
          <button
            type="button"
            className="rk-carousel-arrow rk-carousel-prev"
            onClick={() => goTo(Math.max(0, current - 1))}
            disabled={current === 0}
            aria-label={labels.previous}
          >
            <ChevronIcon direction="left" />
          </button>
          <button
            type="button"
            className="rk-carousel-arrow rk-carousel-next"
            onClick={() => goTo(Math.min(count - 1, current + 1))}
            disabled={current === count - 1}
            aria-label={labels.next}
          >
            <ChevronIcon direction="right" />
          </button>
          <span className="rk-carousel-count" aria-live="polite">{current + 1} / {count}</span>
        </>
      )}
    </div>
  );
}
