import { useRef, useState } from 'react';
import { Button } from '../Button/Button';
import { Icon } from '../Icon/Icon';
import { CloseIcon } from '../Icon/CloseIcon';
import { Slider } from '../Slider/Slider';
import { AlignmentPicker } from '../AlignmentPicker/AlignmentPicker';
// The form and email builders' colour field: swatch + hex, opening the full picker.
import { ColorInput } from '../../features/email-builder/ColorInput';
import { readReportImage } from './readReportImage';
import styles from './ReportCover.module.css';

/**
 * Building blocks for a printed report's cover settings (Personalize tab),
 * shared by the Employer Impact Report and the care program report.
 * Figma 1031:21133.
 */

const LOGO_ACCEPT = '.png,.svg';
const LOGO_MIME = ['image/png', 'image/svg+xml'];
const LOGO_MAX_MB = 5;

/**
 * A logo as a preview row with Change (and Reset once replaced). Change
 * swaps in an upload: PNG or SVG, up to 5 MB.
 */
export function ReportLogoField({ src, name, custom, onPick, onReset, uploadLabel = 'Upload logo' }) {
  const inputRef = useRef(null);
  const [error, setError] = useState('');
  const shown = custom?.dataUrl || src;
  return (
    <>
      <div className={styles.logoRow}>
        {shown && <span className={styles.logoThumb}><img src={shown} alt="" /></span>}
        <span className={styles.pickedName}>{custom?.name || name || 'No logo'}</span>
        {custom && (
          <Button variant="soft" size="sm" onClick={() => { setError(''); onReset(); }}>Reset</Button>
        )}
        <Button variant="outline" size="sm" leadingIcon="solar:upload-minimalistic-linear" onClick={() => inputRef.current?.click()}>
          Change
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={LOGO_ACCEPT}
          className={styles.hiddenInput}
          aria-label={uploadLabel}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            if (!LOGO_MIME.includes(file.type)) { setError('Only PNG or SVG images can be used.'); return; }
            if (file.size > LOGO_MAX_MB * 1024 * 1024) { setError(`That file is over ${LOGO_MAX_MB} MB. Choose a smaller image.`); return; }
            setError('');
            const unreadable = () => setError('That image couldn’t be read. Try another PNG or SVG.');
            readReportImage(file)
              .then((img) => { if (img) onPick({ ...img, name: file.name }); else unreadable(); })
              .catch(unreadable);
          }}
        />
      </div>
      {error && <span className={styles.dropError} role="alert">{error}</span>}
    </>
  );
}

/** "Scale: ─●── 50%" for a cover logo's size. */
export function LogoScale({ value, onChange, label }) {
  return (
    <div className={styles.scaleRow}>
      <span className={styles.scaleLabel}>Scale:</span>
      <Slider
        variant="neutral"
        min={10}
        max={100}
        step={5}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        aria-label={`${label} scale`}
      />
      <span className={styles.scaleLabel}>{value}%</span>
    </div>
  );
}

/**
 * A cover logo's settings: the logo box (preview, Scale) on the left, where
 * it sits on the cover on the right.
 */
export function LogoPlacement({ label, align, onAlign, alignRows, children }) {
  return (
    <div className={styles.logoPlacement}>
      <div className={styles.fieldGroup}>
        <span className={styles.groupTitle}>{label}</span>
        <div className={styles.logoBox}>{children}</div>
      </div>
      <div className={styles.fieldGroup}>
        <span className={styles.groupTitle}>Alignment</span>
        <div className={styles.alignSlot}>
          <AlignmentPicker rows={alignRows} value={align} onChange={onAlign} ariaLabel={`${label} alignment`} />
        </div>
      </div>
    </div>
  );
}

/** The row of cover background swatches. */
export function CoverSwatches({ ariaLabel, children }) {
  return <div className={styles.swatches} role="radiogroup" aria-label={ariaLabel}>{children}</div>;
}

/**
 * A cover background swatch (Figma Cover Swatch, 1031:55835), with a remove
 * button at its top right on hover.
 */
export function CoverSwatch({ label, fill, selected, onSelect, onRemove }) {
  return (
    <div className={styles.swatchCell}>
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        aria-label={label}
        title={label}
        className={[styles.swatch, selected ? styles.swatchOn : ''].filter(Boolean).join(' ')}
        onClick={onSelect}
      >
        {/* The swatch shows report content (the PDF's own colours), not UI chrome. */}
        <span className={styles.swatchFill} style={fill} />
      </button>
      {onRemove && (
        <button type="button" className={styles.swatchRemove} aria-label={`Remove ${label}`} title="Remove" onClick={onRemove}>
          <CloseIcon size={11} color="var(--neutral-300)" />
        </button>
      )}
    </div>
  );
}

/**
 * The last swatch, always there: "+" opens the picker, starting from the
 * cover's current fill. One opening adds one swatch: the first change
 * creates it (selected), later changes in the same opening update it.
 */
export function AddSwatch({ value, gradient, onPick }) {
  const draft = useRef(null);
  return (
    <ColorInput
      value={value}
      onChange={(v) => { draft.current = onPick(v, draft.current); }}
      allowGradient={gradient}
      gradientOnly={gradient}
      trigger={(
        <button
          type="button"
          aria-label={gradient ? 'Add gradient' : 'Add colour'}
          title={gradient ? 'Add gradient' : 'Add colour'}
          className={[styles.swatch, styles.swatchAdd].join(' ')}
          onClick={() => { draft.current = null; }}
        >
          <Icon name="solar:add-linear" size={20} color="var(--neutral-300)" />
        </button>
      )}
    />
  );
}
