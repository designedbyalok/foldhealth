import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from '../Icon/Icon';
import styles from './PdfPreview.module.css';

// Long enough that moving to the edited page reads as a gentle transition
// (the native viewer can't animate its own scrolling); --duration-slow, the
// design system's ceiling for UI motion.
const CROSSFADE_MS = 300;
// The browser's PDF viewer fires `load` before it has drawn the first page,
// so the new version waits this long, hidden behind the old one, before the
// crossfade starts. Without it the preview flashes blank on every edit.
const SETTLE_MS = 350;
// Rebuild only once edits pause, so typing doesn't refresh the viewer per keystroke.
const DEBOUNCE_MS = 600;

const emptySlot = () => ({ url: null, ready: false });

/** The viewer's open parameters: fit to width, at a page and position if known. */
function viewHash(anchor) {
  if (anchor == null) return '#view=FitH';
  const { page, top } = typeof anchor === 'number' ? { page: anchor } : anchor;
  return `#page=${page}&view=FitH${top != null ? `,${Math.round(top)}` : ''}`;
}

/**
 * Fold Health PdfPreview: a live, in-browser PDF preview. Regenerates when
 * `generate` changes (debounced), and crossfades between two iframes so an
 * edit never flashes the viewer blank. Pair with a split drawer, the PDF on
 * one side and its options on the other.
 *
 * Same behaviour as the care plan's preview, taking any generator.
 *
 * @param {object}   props
 * @param {function} props.generate     – () => Blob, or () => { blob, anchors }
 *                                         where `anchors` maps keys to a 1-based
 *                                         page, or to `{ page, top }` (`top` in
 *                                         points down from the page top, as
 *                                         Chrome's viewer reads it). Memoize
 *                                         it: a new function means "the document
 *                                         changed".
 * @param {{ key: string, fallbackKey?: string }} [props.focus] – After a rebuild,
 *                                         open the viewer at `anchors[focus.key]`
 *                                         (else `fallbackKey`'s) so the change is
 *                                         in view. With neither in this version,
 *                                         it stays where the last one opened.
 *
 * The viewer always opens fit to width.
 * @param {React.ReactNode} [props.loader] – Shown while the first version is
 *                                         being built (e.g. <PreviewLoader />);
 *                                         later rebuilds crossfade instead.
 * @param {boolean}  [props.empty=false] – Nothing to render; shows `emptyLabel`
 * @param {string}   [props.emptyLabel='Select items to generate a preview.']
 * @param {string}   [props.title='PDF preview'] – Accessible name of the viewer
 */
export function PdfPreview({ generate, focus, loader, empty = false, emptyLabel = 'Select items to generate a preview.', title = 'PDF preview' }) {
  const [slotA, setSlotA] = useState(emptySlot);
  const [slotB, setSlotB] = useState(emptySlot);
  const [front, setFront] = useState('A');
  const [crossfading, setCrossfading] = useState(false);

  const slotARef = useRef(slotA);
  const slotBRef = useRef(slotB);
  const frontRef = useRef(front);
  const fadeTimerRef = useRef(null);
  const focusRef = useRef(focus);
  // Where the last version opened, reused when an edit has no anchor of its
  // own (e.g. its widget was just switched off), so the view doesn't jump.
  const lastHashRef = useRef('#view=FitH');
  useEffect(() => { focusRef.current = focus; }, [focus]);

  useLayoutEffect(() => {
    slotARef.current = slotA;
    slotBRef.current = slotB;
    frontRef.current = front;
  }, [slotA, slotB, front]);

  const revoke = (url) => { if (url) URL.revokeObjectURL(url.split('#')[0]); };
  const setSlot = (key, next) => (key === 'A' ? setSlotA(next) : setSlotB(next));
  const getSlot = (key) => (key === 'A' ? slotARef.current : slotBRef.current);

  useEffect(() => {
    if (fadeTimerRef.current) { clearTimeout(fadeTimerRef.current); fadeTimerRef.current = null; }
    // Generation runs in the timer (not the effect body), so a burst of edits
    // builds one PDF, and state is only set from that callback.
    const timer = window.setTimeout(() => {
      if (empty) {
        revoke(slotARef.current.url);
        revoke(slotBRef.current.url);
        setSlotA(emptySlot());
        setSlotB(emptySlot());
        setFront('A');
        setCrossfading(false);
        return;
      }
      const out = generate();
      const blob = out instanceof Blob ? out : out.blob;
      const anchors = out instanceof Blob ? null : out.anchors;
      const f = focusRef.current;
      const anchor = anchors?.[f?.key] ?? anchors?.[f?.fallbackKey];
      // The browser viewer honours these on load, so the edit stays in view.
      if (anchor != null) lastHashRef.current = viewHash(anchor);
      const url = `${URL.createObjectURL(blob)}${lastHashRef.current}`;
      if (!slotARef.current.url && !slotBRef.current.url) {
        setSlotA({ url, ready: false });
        setFront('A');
        return;
      }
      setCrossfading(false);
      const back = frontRef.current === 'A' ? 'B' : 'A';
      revoke(getSlot(back).url);
      setSlot(back, { url, ready: false });
    }, empty ? 0 : DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [generate, empty]);

  useEffect(() => () => {
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    revoke(slotARef.current.url);
    revoke(slotBRef.current.url);
  }, []);

  const finishCrossfade = (back) => {
    const oldFront = back === 'A' ? 'B' : 'A';
    revoke(getSlot(oldFront).url);
    setSlot(oldFront, emptySlot());
    setFront(back);
    setCrossfading(false);
  };

  const handleSlotLoad = (key) => {
    setSlot(key, { ...getSlot(key), ready: true });
    if (key === frontRef.current) return;
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    fadeTimerRef.current = window.setTimeout(() => {
      setCrossfading(true);
      fadeTimerRef.current = window.setTimeout(() => finishCrossfade(key), CROSSFADE_MS);
    }, SETTLE_MS);
  };

  const renderSlot = (key) => {
    const slot = key === 'A' ? slotA : slotB;
    if (!slot.url) return null;
    const isFront = front === key;
    const isBack = !isFront;
    const visible = isFront || (crossfading && isBack);
    const className = [
      styles.frame,
      isBack ? styles.frameLayer : '',
      visible ? '' : styles.frameHidden,
      crossfading && isFront ? styles.frameHidden : '',
    ].filter(Boolean).join(' ');
    return (
      <iframe
        key={key}
        className={className}
        src={slot.url}
        title={isFront ? title : `${title} (updating)`}
        aria-hidden={!isFront}
        tabIndex={isFront ? 0 : -1}
        onLoad={() => handleSlotLoad(key)}
      />
    );
  };

  const hasPreview = slotA.url || slotB.url;
  const frontSlot = front === 'A' ? slotA : slotB;

  if (!hasPreview && !empty && loader) return loader;
  if (!hasPreview) {
    return (
      <div className={styles.empty}>
        <Icon name="custom:pdf-file" size={32} color="var(--neutral-200)" />
        <span>{empty ? emptyLabel : 'Generating preview…'}</span>
      </div>
    );
  }

  return (
    <div className={styles.stack}>
      {renderSlot('A')}
      {renderSlot('B')}
      {!frontSlot.ready && !crossfading && (
        loader
          ? <div className={styles.loaderLayer}>{loader}</div>
          : (
            <div className={styles.loading} aria-hidden="true">
              <span className={styles.spinner} />
            </div>
          )
      )}
    </div>
  );
}
