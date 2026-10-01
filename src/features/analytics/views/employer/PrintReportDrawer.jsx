import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Drawer } from '../../../../components/Drawer/Drawer';
import { SplitDrawerLayout } from '../../../../components/Drawer/SplitDrawerLayout';
import { Button } from '../../../../components/Button/Button';
import { Textarea } from '../../../../components/Textarea/Textarea';
import { Switch } from '../../../../components/Switch/Switch';
import { Select } from '../../../../components/Select/Select';
import { Input } from '../../../../components/Input/Input';
import { Toggle } from '../../../../components/Toggle/Toggle';
import { TabStrip } from '../../../../components/TabStrip/TabStrip';
import { EditableText } from '../../../../components/EditableText/EditableText';
// The form and email builders' colour field: swatch + hex, opening the full picker.
import { ColorInput } from '../../../email-builder/ColorInput';
import { useAppStore } from '../../../../store/useAppStore';
import { Dropzone } from '../../../../components/Dropzone/Dropzone';
import { PhotoSearch } from '../../../../components/PhotoSearch/PhotoSearch';
import { ActionButton } from '../../../../components/ActionButton/ActionButton';
import { Link } from '../../../../components/Link/Link';
import { AddIconMinimalist } from '../../../../components/Icon/AddIconMinimalist';
import { Icon } from '../../../../components/Icon/Icon';
import { CloseIcon } from '../../../../components/Icon/CloseIcon';
import { Slider } from '../../../../components/ShadcnSlider/ShadcnSlider';
import { AlignmentPicker } from '../../../../components/AlignmentPicker/AlignmentPicker';
import { PdfPreview } from '../../../../components/PdfPreview/PdfPreview';
import { PreviewLoader } from '../../../../components/PreviewLoader/PreviewLoader';
import { MenuPopover } from '../../../../components/MenuPopover/MenuPopover';
import { TypographyPopover } from '../../../../components/TypographyPopover/TypographyPopover';
import { buildReportPage } from './downloadReportPage';
import { REPORT_FONTS, loadReportFont, loadFontPreviews } from './reportFonts';
// import { SendReportEmailDrawer } from './SendReportEmailDrawer'; // Send Report: hidden for now
import {
  generateEmployerReport, generatedOnLabel, COVER_GRADIENTS, DEFAULT_COVER_BACKGROUND, isLightBackground, gradientCss,
  DEFAULT_LOGO_SCALE, DEFAULT_CLIENT_LOGO_SCALE, COVER_TITLE_STYLE, COVER_INTRO_STYLE,
} from './generateEmployerReportPdf';
import { withReportHeader, withReportFooter, defaultReportHeader, defaultReportFooter } from '../../../email-builder/reportHeaderComponent';
import { rasterizeComponent, interFontFaces } from '../../../email-builder/rasterizeComponent';
import clientLogoUrl from '../../../../assets/trailhead-clinics-logo.png';
import clientLogoWhiteUrl from '../../../../assets/trailhead-clinics-logo-white.png';
import interRegularUrl from '../../../../assets/fonts/inter/Inter-Regular.ttf?url';
import interMediumUrl from '../../../../assets/fonts/inter/Inter-Medium.ttf?url';
import interSemiBoldUrl from '../../../../assets/fonts/inter/Inter-SemiBold.ttf?url';
import interBoldUrl from '../../../../assets/fonts/inter/Inter-Bold.ttf?url';
import interItalicUrl from '../../../../assets/fonts/inter/Inter-Italic.ttf?url';
import interBoldItalicUrl from '../../../../assets/fonts/inter/Inter-BoldItalic.ttf?url';
import { EMPLOYER_LOGOS, EMPLOYER_LOGO_HEIGHT, LOGO_ROOM, employerLogoUrl, logoForEmployer } from './employerLogos';
import { SortableItem, SortableList } from './SortableParts';
import styles from './PrintReportDrawer.module.css';

// Section notes are shared by everyone (employer_impact_report_notes). This
// browser keeps a copy so the drawer opens with them straight away, and
// keeps working before the table exists.
const NOTES_KEY = 'employer-impact-print-notes';
function readNotes() {
  try {
    const saved = JSON.parse(localStorage.getItem(NOTES_KEY) || '{}');
    return saved && typeof saved === 'object' ? saved : {};
  } catch {
    return {};
  }
}
function writeNotes(notes) {
  try { localStorage.setItem(NOTES_KEY, JSON.stringify(notes)); } catch { /* storage unavailable */ }
}

const SECTION_TITLE_MAX = 100;
const EDITOR_TABS = [
  { key: 'widgets', label: 'Widgets' },
  { key: 'personalize', label: 'Personalize' },
];
const SECTION_SUBTITLE_MAX = 150;
const COVER_DESCRIPTION_MAX = 300;
const TITLE_MAX = 60;
const DEFAULT_TITLE = 'Employer Impact Report';
const FONT_WEIGHTS = [
  { value: 'regular', label: 'Regular' },
  { value: 'medium', label: 'Medium' },
  { value: 'semibold', label: 'Semi Bold' },
  { value: 'bold', label: 'Bold' },
];
const TITLE_SIZE = { min: 16, max: 60 };
const INTRO_SIZE = { min: 8, max: 16 };

// The employer logo goes top right on every page and at the top of the
// cover. The provider logo (Trailhead Clinics) is fixed.
const DARK_INK = '#16181D';
const WHITE_INK = '#FFFFFF';
const BACKGROUND_TYPES = [
  { key: 'color', label: 'Color' },
  { key: 'gradient', label: 'Gradient' },
  { key: 'image', label: 'Image' },
];
const IMAGE_ACCEPT = '.png,.svg';
const IMAGE_MIME = ['image/png', 'image/svg+xml'];
const IMAGE_MAX_MB = 5;
const TRAILHEAD_SIZE = { width: 190, height: 150, format: 'PNG' };
// Send Report menu (hidden for now; kept for when it returns).
const SEND_OPTIONS = [
  { key: 'email', label: 'Send via Email', icon: 'solar:letter-linear' },
  { key: 'chat', label: 'Send via Chat', icon: 'solar:chat-round-dots-linear' },
  { key: 'efax', label: 'Send via eFax', icon: 'solar:file-send-linear' },
  { key: 'internal', label: 'Internal Chat', icon: 'solar:chat-square-linear' },
];
// A footer showing the page number is drawn for each page up to this; any
// page past it gets the built-in footer.
const FOOTER_PAGES = 30;
// How long the first preview waits for the fonts and logos before building
// without them.
const ASSET_WAIT_MS = 3000;
const PAGE_TOKEN = /\{\{\s*page[ _-]?number\s*\}\}/i;

/** 'light' when the right-middle of a drawn footer is dark, else 'dark'. */
function inkAtRight(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = 1; c.height = 1;
        const g = c.getContext('2d');
        g.drawImage(img, img.width * 0.96, img.height * 0.4, img.width * 0.02, img.height * 0.2, 0, 0, 1, 1);
        const [r, gr, b, a] = g.getImageData(0, 0, 1, 1).data;
        resolve(a > 128 && 0.2126 * r + 0.7152 * gr + 0.0722 * b < 140 ? 'light' : 'dark');
      } catch { resolve('dark'); }
    };
    img.onerror = () => resolve('dark');
    img.src = dataUrl;
  });
}

/**
 * A report component (header / footer) drawn to PNG with its merge tags
 * filled from `ctx`, for the PDF. Redrawn once edits pause; until the first
 * drawing is ready, or if it can't be drawn, returns null so the PDF uses
 * its built-in version. A component showing {{page_number}} comes back as
 * one image per page: `{ width, height, images }`.
 */
function useComponentImage(component, ctx, fontFaces, enabled) {
  const [result, setResult] = useState(null); // { key, image }
  // Redrawn only when something it shows changes: a footer with just the
  // page number doesn't redraw (30 pages) for a new employer logo or title.
  const tree = component ? JSON.stringify(component.tree) : '';
  const uses = (token) => new RegExp(`\\{\\{\\s*${token}\\s*\\}\\}`, 'i').test(tree);
  const key = [
    component?.id, component?.updatedAt,
    uses('report_title') ? ctx.reportTitle : '',
    uses('generated_on') ? ctx.generatedOn : '',
    uses('employer_logo') ? ctx.employerLogo : '',
    uses('page_count') ? ctx.pageCount : '',
    fontFaces.length,
  ].join('|');
  useEffect(() => {
    if (!enabled || !component) return undefined;
    let live = true;
    const timer = window.setTimeout(async () => {
      const draw = (extra) => rasterizeComponent(component.tree, { ...ctx, ...extra }, { fontFaces });
      let image = null;
      if (PAGE_TOKEN.test(JSON.stringify(component.tree))) {
        const pages = await Promise.all(Array.from({ length: FOOTER_PAGES }, (_, i) => draw({ pageNumber: i + 1, pageCount: ctx.pageCount || '' })));
        if (pages[0]) image = { width: pages[0].width, height: pages[0].height, images: pages.map(p => p?.dataUrl) };
      } else {
        image = await draw({});
        // No page number of its own: the PDF adds one on the right, in
        // white when the footer is dark there.
        if (image) image = { ...image, pageInk: await inkAtRight(image.dataUrl) };
      }
      if (live) setResult({ key, image });
      // The first drawing starts at once; redraws wait for typing to pause.
    }, result ? 250 : 0);
    return () => { live = false; window.clearTimeout(timer); };
    // `key` covers every input that changes the drawing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key]);
  // The last drawing stays up while a new one is made. `settled`: nothing
  // left to draw for the current inputs (or nothing to draw at all).
  return { image: result?.image || null, settled: !enabled || !component || result?.key === key };
}

/**
 * The employer's logo as a preview row with a Change action (and Reset once
 * replaced), for the Employer Logo box. The logo comes from the Employer
 * filter; Change swaps in an upload (PNG or SVG, up to IMAGE_MAX_MB).
 */
function EmployerLogoField({ logo, custom, onPick, onReset }) {
  const inputRef = useRef(null);
  const [error, setError] = useState('');
  const src = custom?.dataUrl || (logo && employerLogoUrl(logo, DARK_INK));
  const name = custom?.name || logo?.name || 'No logo';
  return (
    <>
      <div className={styles.logoRow}>
        {src && <span className={styles.logoThumb}><img src={src} alt="" /></span>}
        <span className={styles.pickedName}>{name}</span>
        {custom && (
          <Button variant="tertiary" size="S" onClick={() => { setError(''); onReset(); }}>Reset</Button>
        )}
        <Button variant="secondary" size="S" leadingIcon="solar:upload-minimalistic-linear" onClick={() => inputRef.current?.click()}>
          Change
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          className={styles.hiddenInput}
          aria-label="Upload employer logo"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            if (!IMAGE_MIME.includes(file.type)) { setError('Only PNG or SVG images can be used.'); return; }
            if (file.size > IMAGE_MAX_MB * 1024 * 1024) { setError(`That file is over ${IMAGE_MAX_MB} MB. Choose a smaller image.`); return; }
            setError('');
            const unreadable = () => setError('That image couldn’t be read. Try another PNG or SVG.');
            readImage(file)
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
function LogoScale({ value, onChange, label }) {
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
 * A cover logo's settings (Figma 1031:21133): the logo box (preview, Scale)
 * on the left, where it sits on the cover on the right.
 */
function LogoPlacement({ label, align, onAlign, alignRows, children }) {
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

/**
 * A cover background swatch (Figma Cover Swatch, 1031:55835), with a remove
 * button at its top right on hover.
 */
function CoverSwatch({ label, fill, selected, onSelect, onRemove }) {
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
function AddSwatch({ value, gradient, onPick }) {
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

/**
 * An image picker built on the shared Dropzone: the drop area until a file
 * is picked, then a thumbnail row with a remove action. PNG or SVG, up to
 * IMAGE_MAX_MB; anything else shows why it was refused.
 */
function ImageDropField({ image, fileName, onPick, onRemove }) {
  const [error, setError] = useState('');
  if (image) {
    return (
      <div className={styles.picked}>
        <img className={styles.pickedThumb} src={image.dataUrl} alt="" />
        <span className={styles.pickedName}>{fileName}</span>
        <ActionButton icon="solar:trash-bin-minimalistic-linear" size="S" tooltip="Remove" aria-label={`Remove ${fileName}`} onClick={onRemove} />
      </div>
    );
  }
  return (
    <div className={styles.dropField}>
      <Dropzone
        accept={IMAGE_ACCEPT}
        acceptMime={IMAGE_MIME}
        helperText="Supported formats: PNG or SVG"
        secondaryText={`Max size: ${IMAGE_MAX_MB} MB`}
        onPick={(file) => {
          if (file.size > IMAGE_MAX_MB * 1024 * 1024) { setError(`That file is over ${IMAGE_MAX_MB} MB. Choose a smaller image.`); return; }
          setError('');
          readImage(file).then((img) => {
            if (img) onPick(img, file.name);
            else setError('That image couldn’t be read. Try another PNG or SVG.');
          });
        }}
        onReject={() => setError('Only PNG or SVG images can be used.')}
      />
      {error && <span className={styles.dropError} role="alert">{error}</span>}
    </div>
  );
}

const toHex = ([r, g, b]) => `#${[r, g, b].map(n => n.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
// Default colour swatches: one per gradient preset, so both rows hold the same
// number, each its most colourful stop (the tinted end of the lighter ones).
const chroma = ([r, g, b]) => Math.max(r, g, b) - Math.min(r, g, b);
const DEFAULT_COLOR_SWATCHES = COVER_GRADIENTS.map(g => toHex(
  g.stops.reduce((best, [c]) => (chroma(c) > chroma(best) ? c : best), g.stops[0][0]),
));
const DEFAULT_COVER_COLOR = DEFAULT_COLOR_SWATCHES[0];
/** A preset gradient as the hex CSS the colour picker edits. */
function presetPickerCss(key) {
  const g = COVER_GRADIENTS.find(x => x.key === key) || COVER_GRADIENTS[0];
  return `linear-gradient(${Math.round(g.angle)}deg, ${g.stops.map(([c, p]) => `${toHex(c)} ${Math.round(p * 100)}%`).join(', ')})`;
}

/** A stock photo by URL as what jsPDF needs; kept as JPEG so the PDF stays small. */
function readPhotoUrl(url) {
  return fetch(url)
    .then(r => (r.ok ? r.blob() : Promise.reject(new Error(url))))
    .then(blob => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => resolve({ dataUrl: reader.result, format: 'JPEG', width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => resolve(null);
        img.src = reader.result;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    }))
    .catch(() => null);
}

/**
 * A picked image as what jsPDF needs: a PNG data URL and its pixel size.
 * PNGs pass through; SVGs are drawn to a canvas (jsPDF can't place SVG),
 * at 3x or at least 1200px wide so they stay sharp in print.
 */
function readImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        if (file.type !== 'image/svg+xml' && !/\.svg$/i.test(file.name)) {
          resolve({ dataUrl: reader.result, format: 'PNG', width: img.naturalWidth, height: img.naturalHeight });
          return;
        }
        // SVGs without width/height report 0 (or 300 × 150); fall back to a sensible size.
        const w = img.naturalWidth || 300;
        const h = img.naturalHeight || 150;
        const scale = Math.max(3, 1200 / w);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve({ dataUrl: canvas.toDataURL('image/png'), format: 'PNG', width: canvas.width, height: canvas.height });
      };
      img.onerror = () => resolve(null);
      img.src = reader.result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

// jsPDF places PNGs only, so each logo is drawn to a canvas once (at the
// given pixel size, sharp enough for print) and reused for every PDF.
const pngCache = new Map();
/**
 * `url` drawn to a `width` × `height` canvas as a PNG data URL. With
 * `trim`, the result is cropped to its visible pixels (plus `pad` px) and
 * reports that size, so an image is centred by what shows, not by empty
 * space its artwork leaves (e.g. a wordmark set in a machine's own font).
 */
function loadPng(url, width, height, { trim = false, pad = 0 } = {}) {
  const key = `${url}|${width}|${height}|${trim}|${pad}`;
  if (!pngCache.has(key)) {
    pngCache.set(key, new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        if (!trim) { resolve({ dataUrl: canvas.toDataURL('image/png'), width, height }); return; }
        const { data } = ctx.getImageData(0, 0, width, height);
        let minX = width; let maxX = -1; let minY = height; let maxY = -1;
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            if (data[(y * width + x) * 4 + 3] > 8) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
        if (maxX < 0) { resolve({ dataUrl: canvas.toDataURL('image/png'), width, height }); return; }
        const x0 = Math.max(0, minX - pad);
        const y0 = Math.max(0, minY - pad);
        const w = Math.min(width, maxX + 1 + pad) - x0;
        const h = Math.min(height, maxY + 1 + pad) - y0;
        const out = document.createElement('canvas');
        out.width = w;
        out.height = h;
        out.getContext('2d').drawImage(canvas, x0, y0, w, h, 0, 0, w, h);
        resolve({ dataUrl: out.toDataURL('image/png'), width: w, height: h });
      };
      img.onerror = () => resolve(null);
      img.src = url;
    }));
  }
  return pngCache.get(key);
}

// Inter for the PDF: jsPDF embeds TTFs as base64. Fetched once, on first
// open, so the fonts never weigh on the report page itself.
const INTER_URLS = {
  regular: interRegularUrl,
  medium: interMediumUrl,
  semibold: interSemiBoldUrl,
  bold: interBoldUrl,
  italic: interItalicUrl,
  boldItalic: interBoldItalicUrl,
};
let interPromise = null;
function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
function loadInter() {
  if (!interPromise) {
    interPromise = Promise.all(Object.entries(INTER_URLS).map(([key, url]) => fetch(url)
      .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(url))))
      .then(buf => [key, toBase64(buf)])))
      .then(Object.fromEntries)
      .catch(() => null); // the PDF falls back to Helvetica
  }
  return interPromise;
}

const hasData = (item) => (item.kind === 'savings' ? item.card.hasData : item.model?.hasData);

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Prints the PDF itself (not the page) from a hidden frame.
function printBlob(blob) {
  const url = URL.createObjectURL(blob);
  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  frame.src = url;
  frame.onload = () => {
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch {
      window.open(url, '_blank', 'noopener');
    }
    setTimeout(() => { frame.remove(); URL.revokeObjectURL(url); }, 60000);
  };
  document.body.appendChild(frame);
}

/**
 * Print the Employer Impact Report: a live PDF preview on the left, and on
 * the right what to include, with an optional note per section. Each
 * section has its own switch; switching one off leaves it out and
 * collapses it to its title. Widgets with no data in the range start off.
 * The PDF lists sections and widgets in the viewer's saved order.
 * Modelled on the care plan's Preview & Share drawer.
 *
 * @param {object}   props
 * @param {string}   props.range    – The date range, for the cover page
 * @param {string}   [props.employerName] – The report's employer, to preselect its logo
 * @param {string}   props.filename – Download name, without extension
 * @param {{ id: string, title: string, items: object[] }[]} props.sections –
 *   Items: `{ key, title, kind: 'widget'|'savings', ... }` (see generateEmployerReport)
 * @param {function} props.pageSnapshot – () => the page's snapshot, for Download HTML
 * @param {boolean}  [props.loading]  – The report's data is (re)loading, e.g. after a
 *   filter change: widgets keep their switches and the preview shows the loader
 * @param {(format: 'pdf' | 'html' | 'print', filename: string) => void} [props.onExport] – After each export, for the History log
 * @param {function} props.onClose
 */
export function PrintReportDrawer({ range, employerName, filename, sections, filters, pageSnapshot, loading = false, onExport, onClose }) {
  // { [sectionId]: { html, plain } }, kept between openings of the drawer.
  const [notes, setNotesState] = useState(readNotes);
  const setNotes = (update) => setNotesState((prev) => (
    typeof update === 'function' ? update(prev) : update
  ));
  useEffect(() => { writeNotes(notes); }, [notes]);
  const [titles, setTitles] = useState({}); // { [sectionId]: custom title }
  // { [sectionId]: text }. Unset means the section's default subtitle; '' clears it.
  const [subtitles, setSubtitles] = useState({});
  const subtitleOf = (s) => subtitles[s.id] ?? s.subtitle ?? '';
  const [editorTab, setEditorTab] = useState('widgets');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [reordering, setReordering] = useState(false);
  // Widgets with no data in the range start switched off; a switch flipped
  // by hand wins over that default, whatever the filters do next.
  const [widgetOverrides, setWidgetOverrides] = useState({}); // { [key]: boolean }
  // While data reloads every widget reads as empty; treat them as having
  // data until it lands, so switches and "No data" marks don't flicker.
  const hasDataNow = (item) => loading || hasData(item);
  const isWidgetOn = (item) => widgetOverrides[item.key] ?? hasDataNow(item);
  const [sectionsOff, setSectionsOff] = useState(() => new Set());
  // Print order, from the dashboard's saved order; drag to change it here.
  const [sectionOrder, setSectionOrder] = useState(() => sections.map(s => s.id));
  const [itemOrder, setItemOrder] = useState(() => Object.fromEntries(sections.map(s => [s.id, s.items.map(i => i.key)])));
  // Back to the dashboard's order, for the sections and the widgets in them.
  const resetOrder = () => {
    setSectionOrder(sections.map(s => s.id));
    setItemOrder(Object.fromEntries(sections.map(s => [s.id, s.items.map(i => i.key)])));
  };
  // Sections and widgets in print order; any that arrive later go last.
  const orderedSections = useMemo(() => {
    const inOrder = (order, list, key) => {
      const byKey = new Map(list.map(x => [key(x), x]));
      const known = (order || []).filter(k => byKey.has(k)).map(k => byKey.get(k));
      return [...known, ...list.filter(x => !(order || []).includes(key(x)))];
    };
    return inOrder(sectionOrder, sections, s => s.id)
      .map(s => ({ ...s, items: inOrder(itemOrder[s.id], s.items, i => i.key) }));
  }, [sections, sectionOrder, itemOrder]);
  // Reset is only offered once something has been moved.
  const orderCustomized = orderedSections.some((s, i) => (
    s.id !== sections[i]?.id || s.items.some((it, j) => it.key !== sections[i]?.items[j]?.key)
  ));
  const [includeCover, setIncludeCover] = useState(true);
  const [coverDescription, setCoverDescription] = useState('');
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [titleStyle, setTitleStyle] = useState(COVER_TITLE_STYLE);
  const [introStyle, setIntroStyle] = useState(COVER_INTRO_STYLE);
  // The cover's non-Inter fonts for the PDF, fetched when picked: { [family]: base64 TTFs }.
  const [coverFonts, setCoverFonts] = useState({});
  useEffect(() => {
    let live = true;
    [titleStyle.family, introStyle.family].forEach((family) => {
      if (coverFonts[family] !== undefined) return;
      loadReportFont(family).then((files) => {
        if (live && files) setCoverFonts(prev => ({ ...prev, [family]: files }));
      });
    });
    return () => { live = false; };
  }, [titleStyle.family, introStyle.family, coverFonts]);
  const [typographyAt, setTypographyAt] = useState(null); // { rect, el } of the T button while its popover is open
  // Starts on the report's employer, else the first employer.
  const [logoChoice, setLogoChoice] = useState(() => logoForEmployer(employerName)?.key || EMPLOYER_LOGOS[0].key);
  // The employer logo follows the Employer filter (here or on the page);
  // an uploaded one replaces it until the employer changes.
  const [logoEmployer, setLogoEmployer] = useState(employerName);
  // An uploaded replacement for this employer's logo: { dataUrl, format, width, height, name }.
  const [customLogo, setCustomLogo] = useState(null);
  if (employerName !== logoEmployer) {
    setLogoEmployer(employerName);
    setCustomLogo(null);
    const logo = logoForEmployer(employerName);
    if (logo) setLogoChoice(logo.key);
  }
  // Cover logo size and placement (see coverPage in generateEmployerReportPdf).
  const [logoScale, setLogoScale] = useState(DEFAULT_LOGO_SCALE);
  const [logoAlign, setLogoAlign] = useState('middle-center');
  const [clientLogoScale, setClientLogoScale] = useState(DEFAULT_CLIENT_LOGO_SCALE);
  const [clientLogoAlign, setClientLogoAlign] = useState('center');
  const [bgType, setBgType] = useState(DEFAULT_COVER_BACKGROUND.type);
  const [bgColor, setBgColor] = useState(DEFAULT_COVER_COLOR);
  // The swatch rows: the defaults (any of which can be removed) then the
  // colours and gradients added with "+". Shared with everyone through the
  // saved settings. A custom gradient is picked by id.
  const [customColors, setCustomColors] = useState([]); // ['#RRGGBB']
  const [customGradients, setCustomGradients] = useState([]); // [{ id, css }]
  const [hiddenColors, setHiddenColors] = useState([]); // removed default colours
  const [hiddenGradients, setHiddenGradients] = useState([]); // removed preset keys
  const [bgGradient, setBgGradient] = useState(DEFAULT_COVER_BACKGROUND.gradient); // preset key or a custom id
  const customGradient = customGradients.find(g => g.id === bgGradient) || null;
  const colorList = [...DEFAULT_COLOR_SWATCHES.filter(c => !hiddenColors.includes(c)), ...customColors];
  const gradientList = [
    ...COVER_GRADIENTS.filter(g => !hiddenGradients.includes(g.key)).map(g => ({ id: g.key, label: g.label, css: gradientCss(g) })),
    ...customGradients.map((g, i) => ({ id: g.id, label: `Custom gradient ${i + 1}`, css: g.css })),
  ];
  const pickColor = (color, draft) => {
    const c = color.toUpperCase();
    if (DEFAULT_COLOR_SWATCHES.includes(c)) setHiddenColors(prev => prev.filter(x => x !== c));
    setCustomColors(prev => {
      const base = draft ? prev.filter(x => x !== draft) : prev;
      return DEFAULT_COLOR_SWATCHES.includes(c) || base.includes(c) ? base : [...base, c];
    });
    setBgColor(c);
    return c;
  };
  // Removing the selected swatch selects the first one left.
  const removeColor = (c) => {
    if (DEFAULT_COLOR_SWATCHES.includes(c)) setHiddenColors(prev => [...prev, c]);
    else setCustomColors(prev => prev.filter(x => x !== c));
    if (bgColor.toUpperCase() === c) setBgColor(colorList.find(x => x !== c) || DEFAULT_COVER_COLOR);
  };
  const pickGradient = (css, draft) => {
    const id = draft || `custom-${Date.now().toString(36)}`;
    setCustomGradients(prev => (draft ? prev.map(g => (g.id === id ? { ...g, css } : g)) : [...prev, { id, css }]));
    setBgGradient(id);
    return id;
  };
  const removeGradient = (id) => {
    if (COVER_GRADIENTS.some(g => g.key === id)) setHiddenGradients(prev => [...prev, id]);
    else setCustomGradients(prev => prev.filter(g => g.id !== id));
    if (bgGradient === id) setBgGradient(gradientList.find(g => g.id !== id)?.id || DEFAULT_COVER_BACKGROUND.gradient);
  };
  const [bgImage, setBgImage] = useState(null); // { dataUrl, format, width, height, name, photo? }
  const pickedPhotoId = useRef(null);
  const [assets, setAssets] = useState({}); // logos and fonts for the PDF
  // "Generated On" is the moment the drawer opened, so edits don't move it.
  const [generatedAt] = useState(() => new Date());
  useEffect(() => {
    let live = true;
    Promise.all([
      loadPng(clientLogoUrl, 190, 150),
      loadPng(clientLogoWhiteUrl, 190, 150),
      loadInter(),
      // Each employer logo in dark (headers, light covers) and white (dark covers).
      // Trimmed to their visible pixels so the cover centres what shows.
      Promise.all(EMPLOYER_LOGOS.map(l => Promise.all([
        loadPng(employerLogoUrl(l, DARK_INK, LOGO_ROOM), (l.width + LOGO_ROOM) * 3, EMPLOYER_LOGO_HEIGHT * 3, { trim: true, pad: 2 }),
        loadPng(employerLogoUrl(l, WHITE_INK, LOGO_ROOM), (l.width + LOGO_ROOM) * 3, EMPLOYER_LOGO_HEIGHT * 3, { trim: true, pad: 2 }),
      ]).then(([dark, white]) => [l.key, { dark, white }]))).then(Object.fromEntries),
    ]).then(([clientLogo, clientLogoWhite, fonts, employerLogos]) => {
      if (live) setAssets({ clientLogo, clientLogoWhite, fonts, employerLogos });
    });
    return () => { live = false; };
  }, []);
  // Sections whose note is switched on (printed); a saved note starts on.
  const [noteOpen, setNoteOpen] = useState(() => new Set(Object.keys(notes)));
  // Sections showing the note card: any with a note added, including one
  // switched off since (it keeps its text and just isn't printed).
  const [noteRows, setNoteRows] = useState(() => new Set(Object.keys(notes)));
  const openNote = (id) => {
    setNoteOpen(prev => new Set(prev).add(id));
    setNoteRows(prev => new Set(prev).add(id));
  };
  const setNoteOn = (id, on) => setNoteOpen((prev) => {
    const next = new Set(prev);
    if (on) next.add(id); else next.delete(id);
    return next;
  });

  // Shared notes: loaded on open, saved as typing pauses (and on close).
  const fetchReportNotes = useAppStore(s => s.fetchEmployerReportNotes);
  const saveReportNote = useAppStore(s => s.saveEmployerReportNote);
  const notesRef = useRef(notes); // latest notes, for the save on close
  useEffect(() => { notesRef.current = notes; }, [notes]);
  const editedRef = useRef(new Set()); // sections edited since the drawer opened
  const pendingRef = useRef({});       // { [sectionId]: save timer }
  useEffect(() => {
    let live = true;
    fetchReportNotes().then((shared) => {
      if (!live || !shared) return;
      // The shared copy wins, except for a section already edited here.
      setNotes((prev) => {
        const next = { ...shared };
        editedRef.current.forEach((id) => { if (prev[id]) next[id] = prev[id]; else delete next[id]; });
        return next;
      });
      setNoteOpen(prev => new Set([...prev, ...Object.keys(shared)]));
      setNoteRows(prev => new Set([...prev, ...Object.keys(shared)]));
    });
    const pending = pendingRef.current;
    return () => {
      live = false;
      Object.entries(pending).forEach(([id, timer]) => {
        window.clearTimeout(timer);
        saveReportNote(id, notesRef.current[id] || null);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const persistNote = (id, note, delay = 600) => {
    editedRef.current.add(id);
    window.clearTimeout(pendingRef.current[id]);
    pendingRef.current[id] = window.setTimeout(() => {
      delete pendingRef.current[id];
      saveReportNote(id, note);
    }, delay);
  };
  const editNote = (id, html, plain) => {
    setNotes(n => ({ ...n, [id]: { html, plain } }));
    persistNote(id, { html, plain });
  };
  // Clears the note (for everyone) and folds the card back into the "Add Note" link.
  const removeNote = (id) => {
    setNotes((prev) => { const next = { ...prev }; delete next[id]; return next; });
    setNoteOpen((prev) => { const next = new Set(prev); next.delete(id); return next; });
    setNoteRows((prev) => { const next = new Set(prev); next.delete(id); return next; });
    persistNote(id, null, 0);
  };

  const toggle = (setter, key) => setter((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  // What goes in the PDF: sections switched on and their widgets switched on.
  const included = useMemo(() => orderedSections
    .filter(s => !sectionsOff.has(s.id))
    .map(s => ({
      id: s.id,
      title: titles[s.id] || s.title,
      subtitle: (subtitles[s.id] ?? s.subtitle ?? '').slice(0, SECTION_SUBTITLE_MAX).trim(),
      // Rich text: printed from its HTML; blank when it has no visible text.
      note: noteOpen.has(s.id) && notes[s.id]?.plain?.trim() ? notes[s.id].html : '',
      items: s.items.filter(i => widgetOverrides[i.key] ?? (loading || hasData(i))),
    }))
    .filter(s => s.items.length), [orderedSections, sectionsOff, widgetOverrides, notes, noteOpen, titles, subtitles, loading]);
  const nothingSelected = included.length === 0;
  // Nothing in the whole report has data (once it has loaded): the empty
  // preview says so, rather than asking for a widget to be selected.
  const noWidgetHasData = !loading && sections.every(sec => sec.items.every(i => !hasData(i)));

  // An image background falls back to the default gradient until one is uploaded.
  const background = useMemo(() => (
    bgType === 'color' ? { type: 'color', color: bgColor }
      : bgType === 'image' && bgImage ? { type: 'image', ...bgImage }
        : bgType === 'gradient' && customGradient ? { type: 'gradient', css: customGradient.css }
          : { type: 'gradient', gradient: bgType === 'gradient' && COVER_GRADIENTS.some(g => g.key === bgGradient) ? bgGradient : DEFAULT_COVER_BACKGROUND.gradient }
  ), [bgType, bgColor, bgGradient, customGradient, bgImage]);
  const lightCover = isLightBackground(background);

  // Provider logo (fixed): colour in page headers; on the cover, the white
  // version on dark backgrounds.
  const { headerLogo, coverLogo } = useMemo(() => {
    const withSize = (l) => l && { ...TRAILHEAD_SIZE, ...l };
    return {
      headerLogo: withSize(assets.clientLogo),
      coverLogo: withSize(lightCover ? assets.clientLogo : assets.clientLogoWhite),
    };
  }, [assets, lightCover]);
  // Employer logo (picked), in the cover's text colour. Each image carries
  // its own trimmed pixel size, which sets its proportions.
  const { employerHeaderLogo, employerCoverLogo } = useMemo(() => {
    // An upload is used as it is, on the cover and in page headers.
    if (customLogo) return { employerHeaderLogo: customLogo, employerCoverLogo: customLogo };
    const employer = assets.employerLogos?.[logoChoice];
    if (!employer) return { employerHeaderLogo: null, employerCoverLogo: null }; // still loading
    return { employerHeaderLogo: employer.dark, employerCoverLogo: lightCover ? employer.dark : employer.white };
  }, [logoChoice, customLogo, assets, lightCover]);
  const reportTitle = title.trim() || DEFAULT_TITLE;

  // Page header and footer: Report Header / Report Footer components
  // (Settings → Content → Components), drawn on every page. Each starts on
  // the default one; email headers and footers aren't offered.
  const savedHeaders = useAppStore(s => s.customReportHeaderPresets);
  const savedFooters = useAppStore(s => s.customReportFooterPresets);
  const fetchCustomPresets = useAppStore(s => s.fetchCustomPresets);
  useEffect(() => { fetchCustomPresets(); }, [fetchCustomPresets]);
  const headerComponents = useMemo(() => withReportHeader(savedHeaders), [savedHeaders]);
  const footerComponents = useMemo(() => withReportFooter(savedFooters), [savedFooters]);
  const [showHeader, setShowHeader] = useState(true);
  const [showFooter, setShowFooter] = useState(true);
  const [pickedHeaderId, setPickedHeaderId] = useState(null);
  const [pickedFooterId, setPickedFooterId] = useState(null);
  const headerComponent = headerComponents.find(h => String(h.id) === String(pickedHeaderId))
    || defaultReportHeader(headerComponents);
  const footerComponent = footerComponents.find(f => String(f.id) === String(pickedFooterId))
    || defaultReportFooter(footerComponents);

  // Personalize settings are shared: loaded for this employer on open and
  // saved (shortly after each change) for everyone. A stock photo is saved
  // as its details and fetched again, not as the image itself.
  const settingsKey = employerName || 'all';
  const fetchReportSettings = useAppStore(s => s.fetchEmployerReportSettings);
  const saveReportSettings = useAppStore(s => s.saveEmployerReportSettings);
  const personalizeSettings = useMemo(() => ({
    title, includeCover, coverDescription, titleStyle, introStyle,
    logoScale, logoAlign, clientLogoScale, clientLogoAlign,
    bgType, bgColor, bgGradient, customColors, customGradients, hiddenColors, hiddenGradients,
    bgImage: bgImage?.photo ? { photo: bgImage.photo } : bgImage,
    customLogo, showHeader, showFooter, headerId: pickedHeaderId, footerId: pickedFooterId,
  }), [title, includeCover, coverDescription, titleStyle, introStyle, logoScale, logoAlign, clientLogoScale, clientLogoAlign,
    bgType, bgColor, bgGradient, customColors, customGradients, hiddenColors, hiddenGradients, bgImage, customLogo, showHeader, showFooter, pickedHeaderId, pickedFooterId]);
  const settingsJson = JSON.stringify(personalizeSettings);
  const settingsJsonRef = useRef(settingsJson);
  useEffect(() => { settingsJsonRef.current = settingsJson; }, [settingsJson]);
  // Which employer's settings are on screen (null while loading), and the
  // copy last saved or loaded, so loading doesn't write straight back.
  const [settingsLoadedFor, setSettingsLoadedFor] = useState(null);
  const settingsMissingRef = useRef(false);
  const lastSavedRef = useRef('');
  useEffect(() => {
    let live = true;
    fetchReportSettings(settingsKey).then(({ settings: saved, missing }) => {
      if (!live) return;
      settingsMissingRef.current = missing;
      if (saved) {
        const has = (k) => saved[k] !== undefined;
        if (has('title')) setTitle(saved.title);
        if (has('includeCover')) setIncludeCover(saved.includeCover);
        if (has('coverDescription')) setCoverDescription(saved.coverDescription);
        if (has('titleStyle')) setTitleStyle(saved.titleStyle);
        if (has('introStyle')) setIntroStyle(saved.introStyle);
        if (has('logoScale')) setLogoScale(saved.logoScale);
        if (has('logoAlign')) setLogoAlign(saved.logoAlign);
        if (has('clientLogoScale')) setClientLogoScale(saved.clientLogoScale);
        if (has('clientLogoAlign')) setClientLogoAlign(saved.clientLogoAlign);
        if (has('bgType')) setBgType(saved.bgType);
        if (has('bgColor')) setBgColor(saved.bgColor);
        if (has('customColors')) setCustomColors(saved.customColors);
        if (has('customGradients')) setCustomGradients(saved.customGradients);
        if (has('hiddenColors')) setHiddenColors(saved.hiddenColors);
        if (has('hiddenGradients')) setHiddenGradients(saved.hiddenGradients);
        if (has('bgGradient')) setBgGradient(saved.bgGradient);
        if (has('customLogo')) setCustomLogo(saved.customLogo);
        if (has('showHeader')) setShowHeader(saved.showHeader);
        if (has('showFooter')) setShowFooter(saved.showFooter);
        if (has('headerId')) setPickedHeaderId(saved.headerId);
        if (has('footerId')) setPickedFooterId(saved.footerId);
        const photo = saved.bgImage?.photo;
        if (photo && !saved.bgImage.dataUrl) {
          pickedPhotoId.current = photo.id;
          readPhotoUrl(photo.full).then((img) => {
            if (live && img && pickedPhotoId.current === photo.id) setBgImage({ ...img, name: `Photo by ${photo.photographer}`, photo });
          });
        } else if (has('bgImage')) {
          setBgImage(saved.bgImage);
        }
        lastSavedRef.current = JSON.stringify(saved);
      } else {
        // Nothing saved for this employer: what's on screen stays, and is
        // only written once someone changes it.
        lastSavedRef.current = settingsJsonRef.current;
      }
      setSettingsLoadedFor(settingsKey);
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsKey]);
  const pendingSaveRef = useRef(null); // { key, json, timer }
  useEffect(() => {
    if (settingsLoadedFor !== settingsKey || settingsMissingRef.current) return;
    if (settingsJson === lastSavedRef.current) return;
    const flush = () => {
      pendingSaveRef.current = null;
      lastSavedRef.current = settingsJson;
      saveReportSettings(settingsKey, JSON.parse(settingsJson));
    };
    const timer = window.setTimeout(flush, 800);
    pendingSaveRef.current = { flush, timer };
    return () => window.clearTimeout(timer);
  }, [settingsJson, settingsKey, settingsLoadedFor, saveReportSettings]);
  // Closing the drawer mid-edit still saves the last change.
  useEffect(() => () => { pendingSaveRef.current?.flush(); }, []);
  const fontFaces = useMemo(() => interFontFaces(assets.fonts), [assets.fonts]);
  // The page count of the last PDF built, for "Page 2 of 6" in a header or
  // footer; a change redraws those (and the PDF with them), then settles.
  const [pageCount, setPageCount] = useState(0);
  const componentCtx = useMemo(() => ({
    reportTitle,
    generatedOn: generatedOnLabel(generatedAt).replace(/^Generated On\s*:\s*/, ''),
    employerLogo: employerHeaderLogo?.dataUrl || '',
    pageCount,
  }), [reportTitle, generatedAt, employerHeaderLogo, pageCount]);
  const { image: headerImage, settled: headerSettled } = useComponentImage(headerComponent, componentCtx, fontFaces, showHeader && !!employerHeaderLogo);
  const { image: footerImage, settled: footerSettled } = useComponentImage(footerComponent, componentCtx, fontFaces, showFooter && !!assets.fonts);
  // The preview waits for what the PDF needs, so each version shown is the
  // finished one: the report's data (a filter change reloads it), the fonts
  // and logos (at most ASSET_WAIT_MS, then without them), and the drawn
  // header and footer, including redraws (e.g. a new employer's logo).
  const [assetWaitOver, setAssetWaitOver] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setAssetWaitOver(true), ASSET_WAIT_MS);
    return () => window.clearTimeout(t);
  }, []);
  const fontsReady = 'fonts' in assets || assetWaitOver;
  const previewReady = !loading && fontsReady && headerSettled && footerSettled;

  const report = useMemo(() => ({
    title: reportTitle,
    generatedAt,
    logo: employerHeaderLogo,
    clientLogo: headerLogo,
    // null: no header. Until the component is drawn (or if it can't be),
    // the built-in header stands in.
    header: showHeader ? headerImage || undefined : null,
    footer: showFooter ? footerImage || undefined : null,
    fonts: assets.fonts,
    coverFonts,
    cover: includeCover ? {
      range,
      description: coverDescription.slice(0, COVER_DESCRIPTION_MAX).trim(),
      background,
      logo: employerCoverLogo,
      clientLogo: coverLogo,
      logoScale,
      logoAlign,
      clientLogoScale,
      clientLogoAlign,
      titleStyle,
      introStyle,
    } : null,
    sections: included,
  }), [reportTitle, generatedAt, assets, coverFonts, headerLogo, employerHeaderLogo, showHeader, headerImage, showFooter, footerImage, includeCover, range, coverDescription, titleStyle, introStyle, background, employerCoverLogo, coverLogo, logoScale, logoAlign, clientLogoScale, clientLogoAlign, included]);
  const generate = useCallback(() => {
    const out = generateEmployerReport(report);
    // Called from the preview's timer and from Download / Print, never
    // during render, so setting state here is safe.
    setPageCount(out.numberedPages);
    return out;
  }, [report]);
  // Where the preview should scroll after the next redraw: the part of the
  // report the last interaction was in ('cover', or a section id).
  const [focus, setFocus] = useState(null);
  // `fallbackKey`: where to look when `key` isn't in the new PDF (a widget just
  // switched off falls back to its section).
  const focusOn = (key, fallbackKey) => setFocus(prev => (
    prev?.key === key && prev?.fallbackKey === fallbackKey ? prev : { key, fallbackKey, n: (prev?.n || 0) + 1 }
  ));
  const focusScope = (key, fallbackKey) => ({
    className: styles.focusScope,
    onPointerDownCapture: () => focusOn(key, fallbackKey),
    onKeyDownCapture: () => focusOn(key, fallbackKey),
  });

  const showToast = useAppStore(s => s.showToast);
  // const sendRef = useRef(null); // Send Report: hidden for now
  const [savingPage, setSavingPage] = useState(false);
  const downloadPage = async () => {
    setSavingPage(true);
    try {
      downloadBlob(await buildReportPage(pageSnapshot(), reportTitle), `${filename}.html`);
      onExport?.('html', `${filename}.html`);
    } catch (err) {
      console.error('Download HTML failed:', err);
      showToast('Could not prepare the HTML report. Run bun run build:report-viewer and try again.');
    } finally {
      setSavingPage(false);
    }
  };
  // Send Report: hidden for now.
  // const [sendOpen, setSendOpen] = useState(false);
  // const [emailOpen, setEmailOpen] = useState(false);
  const downloadRef = useRef(null);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const headerRight = (
    <>
      {/* Send Report: hidden for now.
      <span ref={sendRef} className={styles.menuAnchor}>
        <Button
          variant="secondary"
          size="L"
          leadingIcon="solar:plain-2-linear"
          trailingIcon="solar:alt-arrow-down-linear"
          disabled={nothingSelected}
          aria-haspopup="menu"
          aria-expanded={sendOpen}
          onClick={() => setSendOpen(v => !v)}
        >
          Send Report
        </Button>
      </span>
      {sendOpen && (
        <MenuPopover
          anchorRef={sendRef}
          ariaLabel="Send report"
          items={SEND_OPTIONS}
          width={200}
          onSelect={(key, item) => {
            setSendOpen(false);
            if (key === 'email') setEmailOpen(true);
            else showToast(`${item.label} is coming soon`);
          }}
          onClose={() => setSendOpen(false)}
        />
      )}
      */}
      <span ref={downloadRef} className={styles.menuAnchor}>
        <Button
          variant="primary"
          size="L"
          leadingIcon="solar:download-minimalistic-linear"
          trailingIcon="solar:alt-arrow-down-linear"
          disabled={savingPage}
          aria-haspopup="menu"
          aria-expanded={downloadOpen}
          onClick={() => setDownloadOpen(v => !v)}
        >
          {savingPage ? 'Preparing…' : 'Download'}
        </Button>
      </span>
      {downloadOpen && (
        <MenuPopover
          anchorRef={downloadRef}
          ariaLabel="Download report"
          // PDF: the report as printed. HTML: the report page itself, as
          // filtered, saved as an interactive read-only file.
          items={[
            { key: 'pdf', label: 'Download PDF', icon: 'solar:file-download-linear', disabled: nothingSelected },
            { key: 'html', label: 'Download HTML', icon: 'solar:code-file-linear' },
          ]}
          width={200}
          onSelect={(key) => {
            setDownloadOpen(false);
            if (key === 'pdf') {
              downloadBlob(generate().blob, `${filename}.pdf`);
              onExport?.('pdf', `${filename}.pdf`);
            } else downloadPage();
          }}
          onClose={() => setDownloadOpen(false)}
        />
      )}
      <span className={styles.headerDivider} aria-hidden="true" />
      <ActionButton
        icon="solar:printer-minimalistic-linear"
        size="L"
        tooltip="Print"
        // Below: above the drawer's top edge it would be clipped.
        tooltipBelow
        aria-label="Print report"
        state={nothingSelected ? 'disabled' : 'active'}
        onClick={() => { printBlob(generate().blob); onExport?.('print', `${filename}.pdf`); }}
      />
      <span className={styles.headerDivider} aria-hidden="true" />
    </>
  );

  // While a section is being dragged every card shrinks to its title row, so
  // a card never has to travel far to reach its new place.
  const widgetsPanel = (
    <div className={[styles.cards, reordering ? styles.reordering : ''].filter(Boolean).join(' ')}>
    <SortableList
      ids={orderedSections.map(sec => sec.id)}
      onReorder={setSectionOrder}
      onDragStart={() => setReordering(true)}
      onDragFinish={() => setReordering(false)}
    >
      {orderedSections.map((section) => {
        // A section is on only while it's switched on and has a widget on:
        // switching off its last widget switches it off too.
        const switchedOff = sectionsOff.has(section.id);
        const sectionOn = !switchedOff && section.items.some(isWidgetOn);
        const sectionTitle = titles[section.id] || section.title;
        // Switched off, or mid-reorder: just the title row and switch. Off
        // because its widgets are, it stays open so they can go back on.
        const collapsed = switchedOff || reordering;
        const collapse = (children) => (
          <div className={[styles.collapse, collapsed ? styles.collapsed : ''].filter(Boolean).join(' ')} inert={collapsed}>
            <div className={styles.collapseInner}>{children}</div>
          </div>
        );
        return (
          <SortableItem key={section.id} id={section.id} label={sectionTitle} className={styles.sectionCard} dragOnItem>
          {sectionHandle => (<div {...focusScope(section.id)}>
            <div className={styles.cardHead}>
              {/* The card drags from anywhere; the grip stays for keyboard reordering. */}
              <span className={styles.keyboardHandle}>{sectionHandle}</span>
              <div className={styles.cardHeadText}>
                <EditableText
                  className={styles.cardTitle}
                  value={sectionTitle}
                  maxLength={SECTION_TITLE_MAX}
                  ariaLabel={`Title of ${sectionTitle}`}
                  // Blank goes back to the original title.
                  onCommit={t => setTitles(prev => ({ ...prev, [section.id]: t === section.title ? '' : t }))}
                />
                {collapse(
                  <EditableText
                    className={styles.cardSubtitle}
                    value={subtitleOf(section)}
                    placeholder="Add a subtitle"
                    maxLength={SECTION_SUBTITLE_MAX}
                    ariaLabel={`Subtitle of ${sectionTitle}`}
                    onCommit={t => setSubtitles(prev => ({ ...prev, [section.id]: t }))}
                  />,
                )}
              </div>
              <Switch
                checked={sectionOn}
                onChange={() => {
                  if (sectionOn) { toggle(setSectionsOff, section.id); return; }
                  setSectionsOff(prev => { const next = new Set(prev); next.delete(section.id); return next; });
                  // Back on with no widget on: all its widgets go on (those
                  // without data print as empty cards).
                  if (!section.items.some(isWidgetOn)) {
                    setWidgetOverrides(prev => ({ ...prev, ...Object.fromEntries(section.items.map(i => [i.key, true])) }));
                  }
                }}
                ariaLabel={`Include ${sectionTitle}`}
              />
            </div>
            {collapse(<>
              <div className={styles.cardList} data-no-drag>
                <SortableList
                  ids={section.items.map(i => i.key)}
                  onReorder={keys => setItemOrder(prev => ({ ...prev, [section.id]: keys }))}
                >
                {section.items.map(item => (
                  <SortableItem
                    key={item.key}
                    id={item.key}
                    label={item.title}
                    className={[styles.cardRow, isWidgetOn(item) && !hasDataNow(item) ? styles.rowNoData : ''].filter(Boolean).join(' ')}
                  >
                  {rowHandle => (<div {...focusScope(item.key, section.id)}>
                    {rowHandle}
                    <span className={styles.rowText}>
                      {item.title}
                      {/* Flag widgets with nothing to show, on or off; switched on,
                          the row also turns red since it will print blank. */}
                      {!hasDataNow(item) && (
                        <span className={styles.noData}>No data available for this widget</span>
                      )}
                    </span>
                    <Switch
                      checked={isWidgetOn(item)}
                      onChange={() => setWidgetOverrides(prev => ({ ...prev, [item.key]: !isWidgetOn(item) }))}
                      ariaLabel={`Include ${item.title}`}
                    />
                  </div>)}
                  </SortableItem>
                ))}
                </SortableList>
              </div>
              {/* Note: an "Add Note" link until a note is added; then its own
                  card, whose toggle prints it or not and whose Remove Note
                  clears it. */}
              {noteRows.has(section.id) ? (
                <div className={styles.noteCard} data-no-drag>
                  <div className={styles.noteHead}>
                    <span className={styles.rowText}>Note</span>
                    <Switch
                      checked={noteOpen.has(section.id)}
                      onChange={(on) => setNoteOn(section.id, on)}
                      ariaLabel={`Include the note for ${sectionTitle}`}
                    />
                  </div>
                  {noteOpen.has(section.id) && (
                    <Textarea
                      richText
                      value={notes[section.id]?.html || ''}
                      onChange={(html, plain) => editNote(section.id, html, plain)}
                      placeholder="Add a note for this section (optional)"
                      aria-label={`Note for ${sectionTitle}`}
                      rows={2}
                      className={styles.noteField}
                      bottomButton={{ label: 'Remove Note', variant: 'secondary', onClick: () => removeNote(section.id) }}
                    />
                  )}
                </div>
              ) : (
                <div className={styles.noteLinkRow} data-no-drag>
                  <Link
                    className={styles.addNote}
                    role="button"
                    tabIndex={0}
                    onClick={() => openNote(section.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openNote(section.id); } }}
                  >
                    <AddIconMinimalist size={14} color="currentColor" />
                    Add Note
                  </Link>
                </div>
              )}
            </>)}
          </div>)}
          </SortableItem>
        );
      })}
    </SortableList>
    </div>
  );

  const editor = (
    <div className={styles.editorScroll}>
      <div className={styles.tabBar}>
        {/* The filter button sits over the tab row rather than in TabStrip's
            trailing slot: the row scrolls sideways, which would clip its tooltip. */}
        <div className={styles.tabs}>
          <TabStrip
            items={EDITOR_TABS}
            activeKey={editorTab}
            onChange={setEditorTab}
            fullWidth={false}
          />
          {editorTab === 'widgets' && (
            <span className={styles.tabFilter}>
              <ActionButton
                icon="solar:refresh-linear"
                size="S"
                tooltip="Reset order"
                tooltipBelow
                tooltipLeft
                aria-label="Reset sections and widgets to the dashboard order"
                state={orderCustomized ? 'active' : 'disabled'}
                onClick={resetOrder}
              />
              {filters && (<>
              <span className={styles.headerDivider} aria-hidden="true" />
              <ActionButton
                icon="custom:filter"
                size="S"
                tooltip={filtersOpen ? 'Hide filters' : 'Filters'}
                tooltipBelow
                tooltipLeft
                aria-label={filtersOpen ? 'Hide report filters' : 'Show report filters'}
                active={filtersOpen}
                onClick={() => setFiltersOpen(o => !o)}
              />
              </>)}
            </span>
          )}
        </div>
        {/* The report's own filters: changing one redraws the report and this preview. */}
        {editorTab === 'widgets' && filtersOpen && filters && <div className={styles.filterRow}>{filters}</div>}
      </div>
      <div className={styles.body}>
        {editorTab === 'widgets' ? widgetsPanel : (
        <>
        {/* Personalize (Figma 1031:21133): blocks 24px apart, no hairlines. */}
        <div className={styles.personalize} onPointerDownCapture={() => focusOn('cover')} onKeyDownCapture={() => focusOn('cover')}>
          <LogoPlacement label="Employer Logo" align={logoAlign} onAlign={setLogoAlign} alignRows={3}>
            <EmployerLogoField
              logo={EMPLOYER_LOGOS.find(l => l.key === logoChoice)}
              custom={customLogo}
              onPick={setCustomLogo}
              onReset={() => setCustomLogo(null)}
            />
            <LogoScale label="Employer logo" value={logoScale} onChange={setLogoScale} />
          </LogoPlacement>
          {/* The clinic providing the report (Trailhead Clinics for now), on the cover's "Provided By" line. */}
          <LogoPlacement label="Clinic Logo" align={clientLogoAlign} onAlign={setClientLogoAlign} alignRows={1}>
            <LogoScale label="Clinic logo" value={clientLogoScale} onChange={setClientLogoScale} />
          </LogoPlacement>
          <Input
            label="Report Title"
            value={title}
            maxLength={TITLE_MAX}
            placeholder={DEFAULT_TITLE}
            onChange={e => setTitle(e.target.value)}
          />

          <section className={styles.coverGroup}>
            <div className={styles.groupHead}>
              <h3 className={styles.groupTitle}>Cover Page</h3>
              <span className={styles.groupActions}>
                {includeCover && (
                  <>
                    <ActionButton
                      icon="solar:text-linear"
                      size="S"
                      tooltip="Typography"
                      tooltipLeft
                      active={!!typographyAt}
                      onClick={(e) => { const el = e.currentTarget; loadFontPreviews(); setTypographyAt(at => (at ? null : { rect: el.getBoundingClientRect(), el })); }}
                    />
                    <span className={styles.headerDivider} aria-hidden="true" />
                  </>
                )}
                <Switch checked={includeCover} onChange={setIncludeCover} ariaLabel="Include cover page" />
              </span>
              {includeCover && typographyAt && (
                <TypographyPopover
                  anchorRect={typographyAt.rect}
                  anchorEl={typographyAt.el}
                  families={REPORT_FONTS}
                  weights={FONT_WEIGHTS}
                  rows={[
                    { key: 'title', label: 'Report Title', value: titleStyle, ...TITLE_SIZE },
                    { key: 'intro', label: 'Report Introduction', value: introStyle, ...INTRO_SIZE },
                  ]}
                  onChange={(key, next) => (key === 'title' ? setTitleStyle(next) : setIntroStyle(next))}
                  onClose={() => setTypographyAt(null)}
                />
              )}
            </div>
            {includeCover && (
              <>
                <Textarea
                  title="Report Introduction"
                  value={coverDescription}
                  onChange={value => setCoverDescription(value)}
                  placeholder="A short introduction for the cover (optional)"
                  maxLength={COVER_DESCRIPTION_MAX}
                  rows={3}
                />
                <div className={styles.fieldGroup}>
                  <div className={styles.groupHead}>
                    <span className={styles.groupTitle}>Cover Background</span>
                    <Toggle size="S" items={BACKGROUND_TYPES} active={bgType} onChange={setBgType} />
                  </div>
                  {bgType === 'color' && (
                    <div className={styles.swatches} role="radiogroup" aria-label="Cover colour">
                      {colorList.map(c => (
                        <CoverSwatch
                          key={c}
                          label={c}
                          fill={{ background: c }}
                          selected={bgColor.toUpperCase() === c}
                          onSelect={() => setBgColor(c)}
                          onRemove={colorList.length > 1 ? () => removeColor(c) : undefined}
                        />
                      ))}
                      <AddSwatch value={bgColor} onPick={pickColor} />
                    </div>
                  )}
                  {bgType === 'gradient' && (
                    <div className={styles.swatches} role="radiogroup" aria-label="Cover gradient">
                      {gradientList.map(g => (
                        <CoverSwatch
                          key={g.id}
                          label={g.label}
                          fill={{ backgroundImage: g.css }}
                          selected={bgGradient === g.id}
                          onSelect={() => setBgGradient(g.id)}
                          onRemove={gradientList.length > 1 ? () => removeGradient(g.id) : undefined}
                        />
                      ))}
                      {/* Starts from the cover's gradient; the edit is added as a new swatch. */}
                      <AddSwatch gradient value={customGradient?.css || presetPickerCss(bgGradient)} onPick={pickGradient} />
                    </div>
                  )}
                  {bgType === 'image' && (
                    <>
                      <ImageDropField
                        image={bgImage}
                        fileName={bgImage?.name}
                        onPick={(img, name) => { pickedPhotoId.current = null; setBgImage({ ...img, name }); }}
                        onRemove={() => { pickedPhotoId.current = null; setBgImage(null); }}
                      />
                      <span className={styles.orDivider}>or search free photos</span>
                      <PhotoSearch
                        orientation="portrait"
                        selectedId={bgImage?.photo?.id}
                        onSelect={(photo) => {
                          pickedPhotoId.current = photo.id;
                          readPhotoUrl(photo.full)
                            .then((img) => {
                              // Ignore a slow download if another image was picked meanwhile.
                              if (img && pickedPhotoId.current === photo.id) {
                                setBgImage({ ...img, name: `Photo by ${photo.photographer}`, photo });
                              }
                            })
                            // A failed download leaves the current background as it is.
                            .catch(() => {});
                        }}
                      />
                      {bgImage?.photo && (
                        <span className={styles.photoCredit}>
                          Photo by{' '}
                          <a href={bgImage.photo.photographerUrl} target="_blank" rel="noopener noreferrer">{bgImage.photo.photographer}</a>
                          {' '}on{' '}
                          <a href={bgImage.photo.url} target="_blank" rel="noopener noreferrer">Pexels</a>
                        </span>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </section>

          {/* Page header and footer: a saved component on every page, side by side. */}
          <div className={styles.chromeRow}>
            <section className={styles.chromeGroup}>
              <div className={styles.groupHead}>
                <h3 className={styles.groupTitle}>Show Header</h3>
                <Switch checked={showHeader} onChange={setShowHeader} ariaLabel="Show header" />
              </div>
              {showHeader && (
                <>
                  <label className={styles.srOnly} htmlFor="print-report-header">Header</label>
                  <Select
                    id="print-report-header"
                    portal
                    options={headerComponents.map(h => ({ value: String(h.id), label: h.label }))}
                    value={String(headerComponent?.id ?? '')}
                    onChange={setPickedHeaderId}
                  />
                </>
              )}
            </section>
            <section className={styles.chromeGroup}>
              <div className={styles.groupHead}>
                <h3 className={styles.groupTitle}>Show Footer</h3>
                <Switch checked={showFooter} onChange={setShowFooter} ariaLabel="Show footer" />
              </div>
              {showFooter && (
                <>
                  <label className={styles.srOnly} htmlFor="print-report-footer">Footer</label>
                  <Select
                    id="print-report-footer"
                    portal
                    options={footerComponents.map(f => ({ value: String(f.id), label: f.label }))}
                    value={String(footerComponent?.id ?? '')}
                    onChange={setPickedFooterId}
                  />
                </>
              )}
            </section>
          </div>

        </div>
        </>
        )}
      </div>
    </div>
  );

  const preview = (
    <div className={styles.previewPane}>
      <PdfPreview
        generate={generate}
        focus={focus}
        loader={<PreviewLoader />}
        ready={previewReady}
        empty={nothingSelected}
        emptyLabel={noWidgetHasData
          ? 'No widgets have data for this date range. Turn a widget on to generate report anyway.'
          : 'Select at least one widget to preview the report.'}
        title="Employer Impact Report PDF preview"
      />
    </div>
  );

  return (
    <Drawer
      title="Export Employer Impact Report"
      onClose={onClose}
      headerRight={headerRight}
      noCloseDivider
      // Same as the expanded HCC Diagnosis Gaps drawer: 1280px, never past the 8px inset.
      width="min(1280px, calc(100vw - 16px))"
      bodyClassName={SplitDrawerLayout.bodyClassName}
    >
      <SplitDrawerLayout left={preview} right={editor} />
      {/* Send via Email (hidden with Send Report for now): the report as set up here, attached as a PDF.
      {emailOpen && (
        <SendReportEmailDrawer
          buildPdf={() => generate().blob}
          filename={filename}
          title={reportTitle}
          employerName={employerName}
          range={range}
          onClose={() => setEmailOpen(false)}
        />
      )}
      */}
    </Drawer>
  );
}
