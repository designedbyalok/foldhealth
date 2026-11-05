import { useRef } from 'react';
import Signature from '@uiw/react-signature';
import { Button } from '../Button/Button';
import styles from './SignaturePad.module.css';

const STROKE = { size: 4, smoothing: 0.46, thinning: 0.73, streamline: 0.5 };

// The pad's live <svg> as a standalone file, so it can be stored or uploaded.
function svgBlob(svg) {
  const clone = svg.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  return new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' });
}

/**
 * Draw-to-sign pad. Calls `onChange(File)` (an SVG named `signature.svg`)
 * after each stroke, and `onChange(null)` when cleared.
 *
 * @param {function} props.onChange
 * @param {boolean}  [props.hasError]  Red border, e.g. when a signature is required.
 * @param {string}   [props.ariaLabel]
 */
export function SignaturePad({ onChange, hasError = false, ariaLabel = 'Signature pad' }) {
  const padRef = useRef(null);

  // Once per finished stroke; the frame lets the pad paint its last point.
  const emit = () => requestAnimationFrame(() => {
    const svg = padRef.current?.svg;
    if (svg?.querySelector('path')) onChange?.(new File([svgBlob(svg)], 'signature.svg', { type: 'image/svg+xml' }));
  });

  const clear = () => {
    padRef.current?.clear();
    onChange?.(null);
  };

  return (
    <div className={`${styles.pad} ${hasError ? styles.padError : ''}`} onPointerUp={emit}>
      <Signature
        ref={padRef}
        options={STROKE}
        className={styles.canvas}
        aria-label={ariaLabel}
      />
      <div className={styles.actions}>
        <Button variant="outline" size="sm" leadingIcon="solar:eraser-linear" onClick={clear}>Clear</Button>
      </div>
    </div>
  );
}
