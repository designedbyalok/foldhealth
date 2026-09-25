import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Drawer } from '../../../../components/Drawer/Drawer';
import { SplitDrawerLayout } from '../../../../components/Drawer/SplitDrawerLayout';
import { Button } from '../../../../components/Button/Button';
import { Textarea } from '../../../../components/Textarea/Textarea';
import { Switch } from '../../../../components/Switch/Switch';
import { Select } from '../../../../components/Select/Select';
import { Input } from '../../../../components/Input/Input';
import { Toggle } from '../../../../components/Toggle/Toggle';
import { ColorInput } from '../../../../components/ColorInput/ColorInput';
import { Dropzone } from '../../../../components/Dropzone/Dropzone';
import { PhotoSearch } from '../../../../components/PhotoSearch/PhotoSearch';
import { ActionButton } from '../../../../components/ActionButton/ActionButton';
import { CloseIcon } from '../../../../components/Icon/CloseIcon';
import { Link } from '../../../../components/Link/Link';
import { AddIconMinimalist } from '../../../../components/Icon/AddIconMinimalist';
import { PdfPreview } from '../../../../components/PdfPreview/PdfPreview';
import {
  generateEmployerReportPdf, COVER_GRADIENTS, DEFAULT_COVER_BACKGROUND, isLightBackground, gradientCss,
} from './generateEmployerReportPdf';
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
// Section cards and rows match the Update Dashboard drawer.
import cards from './UpdateDashboardDrawer.module.css';

const NOTE_MAX = 500;
const SECTION_TITLE_MAX = 100;
const SECTION_SUBTITLE_MAX = 150;
const COVER_DESCRIPTION_MAX = 300;
const TITLE_MAX = 60;
const DEFAULT_TITLE = 'Employer Impact Report';

// The employer logo goes top right on every page and at the top of the
// cover. The provider logo (Trailhead Clinics) is fixed.
const DARK_INK = '#16181D';
const WHITE_INK = '#FFFFFF';
const LOGO_OPTIONS = EMPLOYER_LOGOS.map(l => ({ value: l.key, label: l.name }));
const CLINIC_LOGO_OPTIONS = [{ value: 'trailhead', label: 'Trailhead Clinics' }];
const BACKGROUND_TYPES = [
  { key: 'color', label: 'Color' },
  { key: 'gradient', label: 'Gradient' },
  { key: 'image', label: 'Image' },
];
const IMAGE_ACCEPT = '.png,.svg';
const IMAGE_MIME = ['image/png', 'image/svg+xml'];
const IMAGE_MAX_MB = 5;
const TRAILHEAD_SIZE = { width: 190, height: 150, format: 'PNG' };

/**
 * A section's title; clicking it renames it. Editing swaps the title for a
 * text input (SECTION_TITLE_MAX characters): Enter or leaving the field
 * saves, Escape cancels, and a blank title goes back to the original.
 */
function EditableSectionTitle({ title, defaultTitle, onSave }) {
  const [draft, setDraft] = useState(null); // null = not editing
  if (draft != null) {
    const save = () => { onSave(draft.trim() || defaultTitle); setDraft(null); };
    return (
      <div className={styles.titleEdit}>
        <Input
          value={draft}
          autoFocus
          maxLength={SECTION_TITLE_MAX}
          characterLimit={SECTION_TITLE_MAX}
          aria-label="Section title"
          onChange={e => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); save(); }
            if (e.key === 'Escape') { e.preventDefault(); setDraft(null); }
          }}
        />
      </div>
    );
  }
  return (
    <button type="button" className={styles.titleButton} title="Click to edit" aria-label={`Edit title: ${title}`} onClick={() => setDraft(title)}>
      {title}
    </button>
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
 * section has its own switch; switching one off leaves it out and hides
 * its widget switches and note. The PDF lists sections and widgets in
 * the viewer's saved order. Modelled on the care plan's Preview & Share
 * drawer, with the Update Dashboard drawer's section cards.
 *
 * @param {object}   props
 * @param {string}   props.meta     – Range, employer, view and time frame, one line
 * @param {string}   props.range    – The date range, for the cover page
 * @param {string}   [props.employerName] – The report's employer, to preselect its logo
 * @param {string}   props.filename – Download name, without extension
 * @param {{ id: string, title: string, items: object[] }[]} props.sections –
 *   Items: `{ key, title, kind: 'widget'|'savings', ... }` (see generateEmployerReportPdf)
 * @param {function} props.onClose
 */
export function PrintReportDrawer({ meta, range, employerName, filename, sections, onClose }) {
  const [notes, setNotes] = useState({}); // { [sectionId]: { html, plain } }
  const [titles, setTitles] = useState({}); // { [sectionId]: custom title }
  const [subtitles, setSubtitles] = useState({}); // { [sectionId]: text }
  // Sections whose subtitle field is open; each starts as an "Add Subtitle" link.
  const [subtitleOpen, setSubtitleOpen] = useState(() => new Set());
  // Clears the subtitle and folds the field back into the "Add Subtitle" link.
  const removeSubtitle = (id) => {
    setSubtitles((prev) => { const next = { ...prev }; delete next[id]; return next; });
    setSubtitleOpen((prev) => { const next = new Set(prev); next.delete(id); return next; });
  };
  const [off, setOff] = useState(() => new Set());
  const [sectionsOff, setSectionsOff] = useState(() => new Set());
  // Print order, from the dashboard's saved order; drag to change it here.
  const [sectionOrder, setSectionOrder] = useState(() => sections.map(s => s.id));
  const [itemOrder, setItemOrder] = useState(() => Object.fromEntries(sections.map(s => [s.id, s.items.map(i => i.key)])));
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
  const [includeEmpty, setIncludeEmpty] = useState(true);
  const [includeCover, setIncludeCover] = useState(true);
  const [coverDescription, setCoverDescription] = useState('');
  const [title, setTitle] = useState(DEFAULT_TITLE);
  // Starts on the report's employer, else the first employer.
  const [logoChoice, setLogoChoice] = useState(() => logoForEmployer(employerName)?.key || EMPLOYER_LOGOS[0].key);
  const [bgType, setBgType] = useState(DEFAULT_COVER_BACKGROUND.type);
  const [bgColor, setBgColor] = useState('#1376BC');
  const [bgGradient, setBgGradient] = useState(DEFAULT_COVER_BACKGROUND.gradient);
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
  // Sections whose note box is open; each starts as an "Add Note" link.
  const [noteOpen, setNoteOpen] = useState(() => new Set());
  const openNote = (id) => setNoteOpen(prev => new Set(prev).add(id));
  // Clears the note and folds the box back into the "Add Note" link.
  const removeNote = (id) => {
    setNotes((prev) => { const next = { ...prev }; delete next[id]; return next; });
    setNoteOpen((prev) => { const next = new Set(prev); next.delete(id); return next; });
  };

  const toggle = (setter, key) => setter((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  // What goes in the PDF: sections switched on, their widgets switched on,
  // and, unless asked for, only widgets that have data in this range.
  const included = useMemo(() => orderedSections
    .filter(s => !sectionsOff.has(s.id))
    .map(s => ({
      title: titles[s.id] || s.title,
      subtitle: (subtitles[s.id] || '').slice(0, SECTION_SUBTITLE_MAX).trim(),
      // Rich text: printed from its HTML; blank when it has no visible text.
      note: notes[s.id]?.plain?.trim() ? notes[s.id].html : '',
      items: s.items.filter(i => !off.has(i.key) && (includeEmpty || hasData(i))),
    }))
    .filter(s => s.items.length), [orderedSections, sectionsOff, off, includeEmpty, notes, titles, subtitles]);
  const nothingSelected = included.length === 0;

  // An image background falls back to the default gradient until one is uploaded.
  const background = useMemo(() => (
    bgType === 'color' ? { type: 'color', color: bgColor }
      : bgType === 'image' && bgImage ? { type: 'image', ...bgImage }
        : { type: 'gradient', gradient: bgType === 'gradient' ? bgGradient : DEFAULT_COVER_BACKGROUND.gradient }
  ), [bgType, bgColor, bgGradient, bgImage]);
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
    const employer = assets.employerLogos?.[logoChoice];
    if (!employer) return { employerHeaderLogo: null, employerCoverLogo: null }; // still loading
    return { employerHeaderLogo: employer.dark, employerCoverLogo: lightCover ? employer.dark : employer.white };
  }, [logoChoice, assets, lightCover]);
  const reportTitle = title.trim() || DEFAULT_TITLE;

  const report = useMemo(() => ({
    title: reportTitle,
    meta,
    generatedAt,
    logo: employerHeaderLogo,
    clientLogo: headerLogo,
    fonts: assets.fonts,
    cover: includeCover ? {
      range,
      description: coverDescription.slice(0, COVER_DESCRIPTION_MAX).trim(),
      background,
      logo: employerCoverLogo,
      clientLogo: coverLogo,
    } : null,
    sections: included,
  }), [reportTitle, meta, generatedAt, assets, headerLogo, employerHeaderLogo, includeCover, range, coverDescription, background, employerCoverLogo, coverLogo, included]);
  const generate = useCallback(() => generateEmployerReportPdf(report), [report]);

  const headerRight = (
    <>
      <Button
        variant="secondary"
        size="L"
        leadingIcon="solar:download-minimalistic-linear"
        disabled={nothingSelected}
        onClick={() => downloadBlob(generate(), `${filename}.pdf`)}
      >
        Download PDF
      </Button>
      <Button
        variant="primary"
        size="L"
        leadingIcon="solar:printer-minimalistic-linear"
        disabled={nothingSelected}
        onClick={() => printBlob(generate())}
      >
        Print
      </Button>
      <span className={styles.headerDivider} aria-hidden="true" />
    </>
  );

  const editor = (
    <div className={styles.editorScroll}>
      <div className={styles.body}>
        {/* Report settings: logos, title, empty widgets and the cover. */}
        <div className={[cards.section, styles.settingsCard].join(' ')}>
          <div className={[cards.sectionHead, styles.settingsHead].join(' ')}>
            <span className={[cards.sectionTitle, styles.grow].join(' ')}>Report Settings</span>
          </div>
          <div className={styles.fields}>
            <Select
              label="Employer Logo"
              portal
              options={LOGO_OPTIONS}
              value={logoChoice}
              onChange={setLogoChoice}
            />
            {/* The clinic providing the report; fixed to Trailhead Clinics for now. */}
            <Select
              label="Clinic Logo"
              portal
              options={CLINIC_LOGO_OPTIONS}
              value="trailhead"
              onChange={() => {}}
              disabled
            />
            <Input
              label="Report Title"
              value={title}
              maxLength={TITLE_MAX}
              placeholder={DEFAULT_TITLE}
              onChange={e => setTitle(e.target.value)}
            />
            <div className={[styles.settingRow, styles.optionRowInline].join(' ')}>
              <Switch checked={includeEmpty} onChange={setIncludeEmpty} ariaLabel="Include widgets with no data" />
              <div className={styles.optionText}>
                <span className={[styles.optionLabel, includeEmpty ? styles.optionLabelOn : ''].filter(Boolean).join(' ')}>
                  Include widgets with no data
                </span>
                <span className={styles.optionDesc}>Empty widgets print as blank cards.</span>
              </div>
            </div>
            <div className={styles.coverRow}>
              <span className={styles.coverLabel}>Cover Page</span>
              <Switch checked={includeCover} onChange={setIncludeCover} ariaLabel="Include cover page" />
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
                  <span className={styles.fieldLabel}>Cover Background</span>
                  <div className={styles.toggleRow}>
                    <Toggle size="S" items={BACKGROUND_TYPES} active={bgType} onChange={setBgType} />
                  </div>
                  {bgType === 'color' && (
                    <ColorInput value={bgColor} onChange={setBgColor} ariaLabel="Cover background colour" />
                  )}
                  {bgType === 'gradient' && (
                    <div className={styles.swatches} role="radiogroup" aria-label="Cover gradient">
                      {COVER_GRADIENTS.map(g => (
                        <button
                          key={g.key}
                          type="button"
                          role="radio"
                          aria-checked={bgGradient === g.key}
                          aria-label={g.label}
                          title={g.label}
                          className={[styles.swatch, bgGradient === g.key ? styles.swatchOn : ''].filter(Boolean).join(' ')}
                          onClick={() => setBgGradient(g.key)}
                        >
                          {/* The swatch shows report content (the PDF's own colours), not UI chrome. */}
                          <span className={styles.swatchFill} style={{ backgroundImage: gradientCss(g) }} />
                        </button>
                      ))}
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
                          readPhotoUrl(photo.full).then((img) => {
                            // Ignore a slow download if another image was picked meanwhile.
                            if (img && pickedPhotoId.current === photo.id) {
                              setBgImage({ ...img, name: `Photo by ${photo.photographer}`, photo });
                            }
                          });
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
          </div>
        </div>

        <div className={cards.sections}>
          <SortableList ids={orderedSections.map(sec => sec.id)} onReorder={setSectionOrder}>
          {orderedSections.map((section) => {
            const sectionOn = !sectionsOff.has(section.id);
            return (
              <SortableItem key={section.id} id={section.id} label={titles[section.id] || section.title} className={cards.section}>
              {sectionHandle => (<>
                <div className={cards.sectionHead}>
                  {sectionHandle}
                  <span className={[cards.sectionTitle, styles.grow].join(' ')}>
                    <EditableSectionTitle
                      title={titles[section.id] || section.title}
                      defaultTitle={section.title}
                      onSave={(t) => setTitles(prev => ({ ...prev, [section.id]: t === section.title ? '' : t }))}
                    />
                  </span>
                  <Switch
                    checked={sectionOn}
                    onChange={() => toggle(setSectionsOff, section.id)}
                    ariaLabel={`Include ${titles[section.id] || section.title}`}
                  />
                </div>
                {sectionOn && (
                  <div className={cards.list}>
                    <SortableList
                      ids={section.items.map(i => i.key)}
                      onReorder={keys => setItemOrder(prev => ({ ...prev, [section.id]: keys }))}
                    >
                    {section.items.map(item => (
                      <SortableItem key={item.key} id={item.key} label={item.title} className={[cards.row, styles.widgetRow].join(' ')}>
                      {rowHandle => (<>
                        {rowHandle}
                        <span className={[cards.rowLabel, styles.rowText].join(' ')}>
                          {item.title}
                          {/* Flag widgets that will print but have nothing to show. */}
                          {!off.has(item.key) && !hasData(item) && (
                            <span className={styles.noData}>No data available for this widget</span>
                          )}
                        </span>
                        <Switch
                          checked={!off.has(item.key)}
                          onChange={() => toggle(setOff, item.key)}
                          ariaLabel={`Include ${item.title}`}
                        />
                      </>)}
                      </SortableItem>
                    ))}
                    </SortableList>
                  </div>
                )}
                {sectionOn && (subtitleOpen.has(section.id) ? (
                  // Once added, the subtitle stays an input with a remove cross.
                  <div className={styles.subtitle}>
                    <div className={styles.subtitleInput}>
                      <Input
                        value={subtitles[section.id] || ''}
                        placeholder="Add a subtitle"
                        autoFocus
                        aria-label={`Subtitle for ${titles[section.id] || section.title}`}
                        maxLength={SECTION_SUBTITLE_MAX}
                        characterLimit={SECTION_SUBTITLE_MAX}
                        onChange={e => setSubtitles(prev => ({ ...prev, [section.id]: e.target.value }))}
                      />
                    </div>
                    {/* Same remove control as the allergy drawer's reaction rows. */}
                    <ActionButton
                      size="S"
                      tooltip="Remove"
                      aria-label={`Remove subtitle for ${titles[section.id] || section.title}`}
                      onClick={() => removeSubtitle(section.id)}
                    >
                      <CloseIcon size={14} color="var(--neutral-300)" />
                    </ActionButton>
                  </div>
                ) : (
                  <Link
                    className={[styles.addSubtitle, styles.gripIndent].join(' ')}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSubtitleOpen(prev => new Set(prev).add(section.id))}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSubtitleOpen(prev => new Set(prev).add(section.id)); } }}
                  >
                    <AddIconMinimalist size={14} color="currentColor" />
                    Add Subtitle
                  </Link>
                ))}
                {sectionOn && (noteOpen.has(section.id) ? (
                  <div className={styles.note}>
                    <Textarea
                      richText
                      value={notes[section.id]?.html || ''}
                      onChange={(html, plain) => setNotes(n => ({ ...n, [section.id]: { html, plain } }))}
                      placeholder="Add a note for this section (optional)"
                      aria-label={`Note for ${section.title}`}
                      maxLength={NOTE_MAX}
                      rows={2}
                      bottomButton={{ label: 'Remove Note', variant: 'secondary', onClick: () => removeNote(section.id) }}
                    />
                  </div>
                ) : (
                  <Link
                    className={[styles.addNote, styles.gripIndent].join(' ')}
                    role="button"
                    tabIndex={0}
                    onClick={() => openNote(section.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openNote(section.id); } }}
                  >
                    <AddIconMinimalist size={14} color="currentColor" />
                    Add Note
                  </Link>
                ))}
              </>)}
              </SortableItem>
            );
          })}
          </SortableList>
        </div>
      </div>
    </div>
  );

  const preview = (
    <div className={styles.previewPane}>
      <PdfPreview
        generate={generate}
        empty={nothingSelected}
        emptyLabel="Select at least one widget to preview the report."
        title="Employer Impact Report PDF preview"
      />
    </div>
  );

  return (
    <Drawer
      title="Print Employer Impact Report"
      onClose={onClose}
      headerRight={headerRight}
      noCloseDivider
      width={1300}
      bodyClassName={SplitDrawerLayout.bodyClassName}
    >
      <SplitDrawerLayout left={preview} right={editor} />
    </Drawer>
  );
}
