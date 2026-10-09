import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from '../../../../../../../../components/Icon/Icon';
import { generateCarePlanPdf } from '../../lib/carePlanExport';
import styles from './CarePlanShareDrawer.module.css';

const CROSSFADE_MS = 220;
const DEBOUNCE_MS = 120;

function emptySlot() {
  return { url: null, ready: false };
}

/**
 * Live PDF preview with debounced regeneration and crossfade between
 * versions so toggling goals does not flash the iframe black.
 */
export function CarePlanPdfPreview({ docMeta, selection, options, nothingSelected, onPageCount }) {
  const [slotA, setSlotA] = useState(emptySlot);
  const [slotB, setSlotB] = useState(emptySlot);
  const [front, setFront] = useState('A');
  const [crossfading, setCrossfading] = useState(false);

  const slotARef = useRef(slotA);
  const slotBRef = useRef(slotB);
  const frontRef = useRef(front);
  const fadeTimerRef = useRef(null);

  useLayoutEffect(() => {
    slotARef.current = slotA;
    slotBRef.current = slotB;
    frontRef.current = front;
  }, [slotA, slotB, front]);

  const revoke = (url) => {
    if (url) URL.revokeObjectURL(url);
  };

  const setSlot = (key, next) => {
    if (key === 'A') setSlotA(next);
    else setSlotB(next);
  };

  const getSlot = (key) => (key === 'A' ? slotARef.current : slotBRef.current);

  const clearAll = () => {
    revoke(slotARef.current.url);
    revoke(slotBRef.current.url);
    setSlotA(emptySlot());
    setSlotB(emptySlot());
    setFront('A');
    setCrossfading(false);
  };

  useEffect(() => {
    if (fadeTimerRef.current) {
      clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }

    if (nothingSelected) {
      clearAll();
      return undefined;
    }

    const timer = window.setTimeout(() => {
      const blob = generateCarePlanPdf(docMeta, selection, options);
      onPageCount?.(blob.pageCount);
      const url = URL.createObjectURL(blob);

      if (!slotARef.current.url && !slotBRef.current.url) {
        setSlotA({ url, ready: false });
        setFront('A');
        return;
      }

      if (fadeTimerRef.current) {
        clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = null;
      }
      setCrossfading(false);

      const currentFront = frontRef.current;
      const back = currentFront === 'A' ? 'B' : 'A';
      revoke(getSlot(back).url);
      setSlot(back, { url, ready: false });
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [docMeta, selection, options, nothingSelected]);

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
    setCrossfading(true);
    fadeTimerRef.current = window.setTimeout(() => finishCrossfade(key), CROSSFADE_MS);
  };

  const renderSlot = (key) => {
    const slot = key === 'A' ? slotA : slotB;
    if (!slot.url) return null;

    const isFront = front === key;
    const isBack = !isFront && slot.url;
    const visible = isFront || (crossfading && isBack);

    const className = [
      styles.previewFrame,
      isBack ? styles.previewFrameLayer : '',
      visible ? (crossfading && isBack ? styles.previewFrameIn : styles.previewFrameVisible) : styles.previewFrameHidden,
      crossfading && isFront ? styles.previewFrameOut : '',
    ].filter(Boolean).join(' ');

    return (
      <iframe
        key={key}
        className={className}
        src={slot.url}
        title={key === 'A' ? 'Care plan PDF preview' : 'Care plan PDF preview (updating)'}
        aria-hidden={!isFront}
        tabIndex={isFront ? 0 : -1}
        onLoad={() => handleSlotLoad(key)}
      />
    );
  };

  const hasPreview = slotA.url || slotB.url;
  const frontSlot = front === 'A' ? slotA : slotB;
  const showInitialLoading = hasPreview && !frontSlot.ready && !crossfading;

  if (!hasPreview) {
    return (
      <div className={styles.previewEmpty}>
        <Icon name="custom:pdf-file" size={32} color="var(--neutral-200)" />
        <span>Select items on the right to generate a preview.</span>
      </div>
    );
  }

  return (
    <div className={styles.previewStack}>
      {renderSlot('A')}
      {renderSlot('B')}
      {showInitialLoading && (
        <div className={styles.previewLoading} aria-hidden="true">
          <span className={styles.previewLoadingSpinner} />
        </div>
      )}
    </div>
  );
}
