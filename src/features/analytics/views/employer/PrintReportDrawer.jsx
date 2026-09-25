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
import { UploadDropField } from '../../../../components/UploadDropField/UploadDropField';
import { PhotoSearch } from '../../../../components/PhotoSearch/PhotoSearch';
import { Link } from '../../../../components/Link/Link';
import { AddIconMinimalist } from '../../../../components/Icon/AddIconMinimalist';
import { PdfPreview } from '../../../../components/PdfPreview/PdfPreview';
import {
  generateEmployerReportPdf, COVER_GRADIENTS, DEFAULT_COVER_BACKGROUND, isLightBackground, rgbCss,
} from './generateEmployerReportPdf';
import foldWordmarkUrl from '../../../../assets/foldhealth-wordmark.svg';
import clientLogoUrl from '../../../../assets/trailhead-clinics-logo.png';
import foldWordmarkWhiteUrl from '../../../../assets/foldhealth-wordmark-white.svg';
import clientLogoWhiteUrl from '../../../../assets/trailhead-clinics-logo-white.png';
import interRegularUrl from '../../../../assets/fonts/inter/Inter-Regular.ttf?url';
import interMediumUrl from '../../../../assets/fonts/inter/Inter-Medium.ttf?url';
import interSemiBoldUrl from '../../../../assets/fonts/inter/Inter-SemiBold.ttf?url';
import interBoldUrl from '../../../../assets/fonts/inter/Inter-Bold.ttf?url';
import interItalicUrl from '../../../../assets/fonts/inter/Inter-Italic.ttf?url';
import interBoldItalicUrl from '../../../../assets/fonts/inter/Inter-BoldItalic.ttf?url';
import styles from './PrintReportDrawer.module.css';
// Section cards and rows match the Update Dashboard drawer.
import cards from './UpdateDashboardDrawer.module.css';

const NOTE_MAX = 500;
const COVER_DESCRIPTION_MAX = 300;
const TITLE_MAX = 60;
const DEFAULT_TITLE = 'Employer Impact Report';

// Employer logos to pick from. Only Trailhead Clinics is bundled today;
// "Upload logo" covers any other employer.
const LOGO_OPTIONS = [
  { value: 'trailhead', label: 'Trailhead Clinics' },
  { value: 'upload', label: 'Upload logo' },
  { value: 'none', label: 'No logo' },
];
const BACKGROUND_TYPES = [
  { key: 'color', label: 'Color' },
  { key: 'gradient', label: 'Gradient' },
  { key: 'image', label: 'Image' },
];
const IMAGE_ACCEPT = '.png,.jpg,.jpeg';
const TRAILHEAD_SIZE = { width: 190, height: 150, format: 'PNG' };

/** A picked image as what jsPDF needs: data URL, format and pixel size. */
function readImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve({
        dataUrl: reader.result,
        format: file.type === 'image/png' ? 'PNG' : 'JPEG',
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
      img.onerror = () => resolve(null);
      img.src = reader.result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

/** A stock photo by URL, read the same way as an uploaded file. */
function readImageUrl(url) {
  return fetch(url)
    .then(r => (r.ok ? r.blob() : Promise.reject(new Error(url))))
    .then(readImage)
    .catch(() => null);
}

// jsPDF places PNGs only, so each logo is drawn to a canvas once (at the
// given pixel size, sharp enough for print) and reused for every PDF.
const pngCache = new Map();
function loadPng(url, width, height) {
  if (!pngCache.has(url)) {
    pngCache.set(url, new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve({ dataUrl: canvas.toDataURL('image/png') });
      };
      img.onerror = () => resolve(null);
      img.src = url;
    }));
  }
  return pngCache.get(url);
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
 * @param {string}   props.filename – Download name, without extension
 * @param {{ id: string, title: string, items: object[] }[]} props.sections –
 *   Items: `{ key, title, kind: 'widget'|'savings', ... }` (see generateEmployerReportPdf)
 * @param {function} props.onClose
 */
export function PrintReportDrawer({ meta, range, filename, sections, onClose }) {
  const [notes, setNotes] = useState({}); // { [sectionId]: { html, plain } }
  const [off, setOff] = useState(() => new Set());
  const [sectionsOff, setSectionsOff] = useState(() => new Set());
  const [includeEmpty, setIncludeEmpty] = useState(true);
  const [includeCover, setIncludeCover] = useState(true);
  const [coverDescription, setCoverDescription] = useState('');
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [logoChoice, setLogoChoice] = useState('trailhead');
  const [uploadedLogo, setUploadedLogo] = useState(null);
  const [bgType, setBgType] = useState(DEFAULT_COVER_BACKGROUND.type);
  const [bgColor, setBgColor] = useState('#1376BC');
  const [bgGradient, setBgGradient] = useState(DEFAULT_COVER_BACKGROUND.gradient);
  const [bgImage, setBgImage] = useState(null);
  // The Pexels photo behind bgImage, if it came from search, not an upload.
  const [bgPhoto, setBgPhoto] = useState(null);
  const [uploadKey, setUploadKey] = useState(0);
  const pickedPhotoId = useRef(null);
  const [assets, setAssets] = useState({}); // logos and fonts for the PDF
  // "Generated On" is the moment the drawer opened, so edits don't move it.
  const [generatedAt] = useState(() => new Date());
  useEffect(() => {
    let live = true;
    Promise.all([
      loadPng(foldWordmarkUrl, 108 * 3, 20 * 3),
      loadPng(clientLogoUrl, 190, 150),
      loadPng(foldWordmarkWhiteUrl, 151 * 3, 28 * 3),
      loadPng(clientLogoWhiteUrl, 190, 150),
      loadInter(),
    ]).then(([logo, clientLogo, logoWhite, clientLogoWhite, fonts]) => {
      if (live) setAssets({ logo, clientLogo, logoWhite, clientLogoWhite, fonts });
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
  const included = useMemo(() => sections
    .filter(s => !sectionsOff.has(s.id))
    .map(s => ({
      title: s.title,
      // Rich text: printed from its HTML; blank when it has no visible text.
      note: notes[s.id]?.plain?.trim() ? notes[s.id].html : '',
      items: s.items.filter(i => !off.has(i.key) && (includeEmpty || hasData(i))),
    }))
    .filter(s => s.items.length), [sections, sectionsOff, off, includeEmpty, notes]);
  const nothingSelected = included.length === 0;

  // An image background falls back to the default gradient until one is uploaded.
  const background = useMemo(() => (
    bgType === 'color' ? { type: 'color', color: bgColor }
      : bgType === 'image' && bgImage ? { type: 'image', ...bgImage }
        : { type: 'gradient', gradient: bgType === 'gradient' ? bgGradient : DEFAULT_COVER_BACKGROUND.gradient }
  ), [bgType, bgColor, bgGradient, bgImage]);
  const lightCover = isLightBackground(background);

  // The employer logo in colour for page headers; on the cover, the white
  // version on dark backgrounds. Uploaded logos are used as they are.
  const { headerLogo, coverLogo } = useMemo(() => {
    if (logoChoice === 'upload') return { headerLogo: uploadedLogo, coverLogo: uploadedLogo };
    if (logoChoice !== 'trailhead') return { headerLogo: null, coverLogo: null };
    const withSize = (l) => l && { ...TRAILHEAD_SIZE, ...l };
    return {
      headerLogo: withSize(assets.clientLogo),
      coverLogo: withSize(lightCover ? assets.clientLogo : assets.clientLogoWhite),
    };
  }, [logoChoice, uploadedLogo, assets, lightCover]);
  const reportTitle = title.trim() || DEFAULT_TITLE;

  const report = useMemo(() => ({
    title: reportTitle,
    meta,
    generatedAt,
    logo: assets.logo,
    clientLogo: headerLogo,
    fonts: assets.fonts,
    cover: includeCover ? {
      range,
      description: coverDescription.slice(0, COVER_DESCRIPTION_MAX).trim(),
      background,
      logo: lightCover ? assets.logo : assets.logoWhite,
      clientLogo: coverLogo,
    } : null,
    sections: included,
  }), [reportTitle, meta, generatedAt, assets, headerLogo, includeCover, range, coverDescription, background, lightCover, coverLogo, included]);
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
        {/* Report details and cover, styled like the section cards. */}
        <div className={cards.section}>
          <div className={[cards.sectionHead, styles.sectionHead].join(' ')}>
            <span className={[cards.sectionTitle, styles.grow].join(' ')}>Report Details</span>
          </div>
          <div className={styles.form}>
            <Select
              label="Employer Logo"
              portal
              options={LOGO_OPTIONS}
              value={logoChoice}
              onChange={setLogoChoice}
            />
            {logoChoice === 'upload' && (
              <UploadDropField
                accept={IMAGE_ACCEPT}
                helperText="Supported formats: PNG or JPG"
                secondaryText="A transparent PNG looks best"
                onChange={(file) => { if (!file) { setUploadedLogo(null); return; } readImage(file).then(setUploadedLogo); }}
              />
            )}
            <Input
              label="Report Title"
              value={title}
              maxLength={TITLE_MAX}
              placeholder={DEFAULT_TITLE}
              onChange={e => setTitle(e.target.value)}
            />
          </div>
        </div>

        <div className={cards.section}>
          <div className={[cards.sectionHead, styles.sectionHead].join(' ')}>
            <span className={[cards.sectionTitle, styles.grow].join(' ')}>Cover Page</span>
            <Switch checked={includeCover} onChange={setIncludeCover} ariaLabel="Include cover page" />
          </div>
          {includeCover && (
            <div className={styles.form}>
              <Textarea
                title="Report Introduction"
                value={coverDescription}
                onChange={value => setCoverDescription(value)}
                placeholder="A short introduction for the cover (optional)"
                maxLength={COVER_DESCRIPTION_MAX}
                rows={3}
              />
              <div className={styles.fieldGroup}>
                <span className={styles.fieldLabel}>Report Background</span>
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
                        className={[styles.swatch, bgGradient === g.key ? styles.swatchOn : ''].filter(Boolean).join(' ')}
                        onClick={() => setBgGradient(g.key)}
                      >
                        {/* The swatch shows report content (the PDF's own colours), not UI chrome. */}
                        <span className={styles.swatchFill} style={{ backgroundImage: `linear-gradient(${rgbCss(g.from)}, ${rgbCss(g.to)})` }} />
                        <span className={styles.swatchLabel}>{g.label}</span>
                      </button>
                    ))}
                  </div>
                )}
                {bgType === 'image' && (
                  <>
                    <UploadDropField
                      key={uploadKey}
                      accept={IMAGE_ACCEPT}
                      helperText="Supported formats: PNG or JPG"
                      secondaryText="Fills the page; text sits on a dark overlay"
                      onChange={(file) => {
                        if (!file) { if (!bgPhoto) setBgImage(null); return; }
                        setBgPhoto(null);
                        pickedPhotoId.current = null;
                        readImage(file).then(setBgImage);
                      }}
                    />
                    <span className={styles.orDivider}>or search free photos</span>
                    <PhotoSearch
                      orientation="portrait"
                      selectedId={bgPhoto?.id}
                      onSelect={(photo) => {
                        setBgPhoto(photo);
                        pickedPhotoId.current = photo.id;
                        // Clears any uploaded file so only one source is picked.
                        setUploadKey(k => k + 1);
                        readImageUrl(photo.full).then((img) => {
                          // Ignore a slow download if another photo was picked meanwhile.
                          if (pickedPhotoId.current === photo.id) setBgImage(img);
                        });
                      }}
                    />
                    {bgPhoto && (
                      <span className={styles.photoCredit}>
                        Photo by{' '}
                        <a href={bgPhoto.photographerUrl} target="_blank" rel="noopener noreferrer">{bgPhoto.photographer}</a>
                        {' '}on{' '}
                        <a href={bgPhoto.url} target="_blank" rel="noopener noreferrer">Pexels</a>
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <div className={styles.optionRow}>
          <Switch checked={includeEmpty} onChange={setIncludeEmpty} ariaLabel="Include widgets with no data" />
          <div className={styles.optionText}>
            <span className={[styles.optionLabel, includeEmpty ? styles.optionLabelOn : ''].filter(Boolean).join(' ')}>
              Include widgets with no data
            </span>
            <span className={styles.optionDesc}>
              Empty widgets print as blank cards.
            </span>
          </div>
        </div>

        <div className={cards.sections}>
          {sections.map((section) => {
            const sectionOn = !sectionsOff.has(section.id);
            return (
              <div key={section.id} className={cards.section}>
                <div className={[cards.sectionHead, styles.sectionHead].join(' ')}>
                  <span className={[cards.sectionTitle, styles.grow].join(' ')}>{section.title}</span>
                  <Switch
                    checked={sectionOn}
                    onChange={() => toggle(setSectionsOff, section.id)}
                    ariaLabel={`Include ${section.title}`}
                  />
                </div>
                {sectionOn && (
                  <div className={cards.list}>
                    {section.items.map(item => (
                      <div key={item.key} className={cards.row}>
                        <span className={cards.rowLabel}>
                          {item.title}
                          {!hasData(item) && <span className={styles.noData}> · No data</span>}
                        </span>
                        <Switch
                          checked={!off.has(item.key)}
                          onChange={() => toggle(setOff, item.key)}
                          ariaLabel={`Include ${item.title}`}
                        />
                      </div>
                    ))}
                  </div>
                )}
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
                    className={styles.addNote}
                    role="button"
                    tabIndex={0}
                    onClick={() => openNote(section.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openNote(section.id); } }}
                  >
                    <AddIconMinimalist size={14} color="currentColor" />
                    Add Note
                  </Link>
                ))}
              </div>
            );
          })}
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
