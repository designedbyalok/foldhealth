import { useState, useEffect, useRef, useCallback, useLayoutEffect, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { renderEmailHtml } from './patchEmailHtml';
import { useAppStore } from '../../store/useAppStore';
import { Icon } from '../../components/Icon/Icon';
import { Toggle } from '../../components/Toggle/Toggle';
import { Input } from '../../components/Input/Input';
import { Textarea } from '../../components/Textarea/Textarea';
import { Select as SharedSelect } from '../../components/Select/Select';
import { makeInitialDocument } from './initialDocument';
import { HEADER_PRESETS, FOOTER_PRESETS } from './headerFooterLibrary';
import { PresetLivePreview } from './PresetLivePreview';
import { extractSubtree, fingerprintTree } from './blockHelpers';
import { uploadImage } from './uploadImage';
import { GOOGLE_FONTS, injectGoogleFonts, availableWeights, normalizeWeight } from './googleFonts';
import { ColorPicker } from './ColorPicker';
import { isGradient } from './colorHelpers';
import { parseLineHeight, formatLineHeight, parseLetterSpacing, formatLetterSpacing } from './dimUnits';
import { parseHtmlToDocument, collectUnknownFonts } from './htmlToDocument';
import styles from './EmailBuilder.module.css';

// Inject the Google Fonts stylesheet once so the canvas + inline previews
// render with the actual web fonts. Safe to call repeatedly.
injectGoogleFonts();

const MIN_WIDTH = 280;
const MAX_WIDTH = 720;
const DEFAULT_WIDTH = 320;

const RADIUS_TYPES = new Set(['Button', 'Image', 'Container', 'ColumnsContainer']);
const BG_IMAGE_TYPES = new Set(['Container', 'ColumnsContainer']);
const BUTTON_STYLE_RADIUS = { rectangle: 0, rounded: 6, pill: 9999 };

// Pulled from the curated Google Fonts catalogue. Each entry stores the
// Google font name directly so the value renders the same way in builder,
// preview, and the exported email <link rel="stylesheet">.
const FONT_FAMILIES = GOOGLE_FONTS.map(f => ({ value: f.value, label: f.label }));

// Fallback used until the selected fontFamily is known. The real options
// come from availableWeights(fontFamily) at render time so each family
// surfaces only the weights it ships with on Google Fonts.
const FONT_WEIGHTS_FALLBACK = [
  { value: '400', label: 'Regular 400' },
  { value: '700', label: 'Bold 700' },
];

const TABS = [
  { id: 'design',   icon: 'solar:settings-linear',     label: 'Design' },
  { id: 'code',     icon: 'solar:code-square-linear',  label: 'Code' },
  { id: 'template', icon: 'solar:palette-linear',      label: 'Template' },
];

export function PropertiesPanel() {
  const [tab, setTab] = useState('design');
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const dragging = useRef(false);
  const doc = useAppStore(s => s.emailDocument);
  const id = useAppStore(s => s.selectedBlockId);
  const selectedColumnIdx = useAppStore(s => s.selectedColumnIdx);
  const updateBlock = useAppStore(s => s.updateBlock);
  const bulkIds = useAppStore(s => s.bulkSelectedIds);
  const setHtmlPreviewOverride = useAppStore(s => s.setHtmlPreviewOverride);

  const block = doc?.[id];
  const isBulk = bulkIds.length > 0;
  const isColumnSelected = selectedColumnIdx !== null && block?.type === 'ColumnsContainer';

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev) => {
      if (!dragging.current) return;
      const next = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, window.innerWidth - ev.clientX));
      setWidth(next);
    };
    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  return (
    <div className={styles.rightPanel} style={{ width }}>
      <div className={styles.dragHandle} onMouseDown={handleMouseDown} aria-label="Resize panel">
        <div className={styles.dragHandleLine} />
      </div>

      <div className={styles.rightTabs}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={[styles.rightTab, tab === t.id ? styles.rightTabActive : ''].join(' ')}
            onClick={() => setTab(t.id)}
            title={t.label}
            aria-label={t.label}
          >
            <Icon name={t.icon} size={16} color="currentColor" />
            <span className={styles.rightTabLabel}>{t.label}</span>
          </button>
        ))}
      </div>

      {tab === 'design' && (isBulk
        ? <BulkDesignTab doc={doc} bulkIds={bulkIds} updateBlock={updateBlock} />
        : isColumnSelected
          ? <ColumnDesignTab block={block} updateBlock={updateBlock} id={id} columnIdx={selectedColumnIdx} />
          : <DesignTab block={block} updateBlock={updateBlock} id={id} />
      )}
      {tab === 'code' && <CodeTab doc={doc} />}
      {tab === 'template' && <TemplateTab block={block} />}
    </div>
  );
}

// ── Design tab ──────────────────────────────────────────────────────────────
function DesignTab({ block, updateBlock, id }) {
  const rootFontFamily = useAppStore(s => s.emailDocument?.root?.data?.fontFamily);
  if (!block) {
    return <div className={styles.emptyState}>Select a block</div>;
  }

  const update = (path, value) => {
    updateBlock(id, prev => {
      const next = JSON.parse(JSON.stringify(prev));
      let target = next;
      for (let i = 0; i < path.length - 1; i++) {
        target[path[i]] = target[path[i]] ?? {};
        target = target[path[i]];
      }
      target[path[path.length - 1]] = value;
      return next;
    });
  };

  const isLayout = block.type === 'EmailLayout';
  const data = block.data || {};
  const props = data.props || {};
  const style = data.style || {};
  const padding = (style.padding ?? data.padding) || { top: 16, bottom: 16, left: 16, right: 16 };

  return (
    <div className={styles.designScroll}>
      {/* ── Block-specific content sections (shown first) ── */}
      {(block.type === 'Heading' || block.type === 'Text') && (
        <>
          <SectionHeading>Content</SectionHeading>
          <Section>
            <TextStyleChips block={block} updateBlock={updateBlock} id={id} />
            <FieldLabel>Text</FieldLabel>
            {/* props.text can contain inline HTML from the selection toolbar
                (bold/italic/link/etc). The textarea should show only the
                visible text — so we strip tags for display, and on edit
                commit the plain string (which replaces any prior HTML).
                Inline edits made on the canvas via the SelectionToolbar
                still round-trip through the contentEditable directly. */}
            <Textarea
              value={htmlToPlain(props.text || '')}
              onChange={e => update(['data', 'props', 'text'], e.target.value)}
            />
            {block.type === 'Heading' && (
              <SelectInput
                label="Level"
                value={props.level || 'h2'}
                options={[{ value: 'h1', label: 'H1' }, { value: 'h2', label: 'H2' }, { value: 'h3', label: 'H3' }]}
                onChange={v => update(['data', 'props', 'level'], v)}
              />
            )}
            {/* Link wrap — set on the text/heading to render <a href> */}
            <LinkInput
              value={props.linkHref || ''}
              openInNewTab={props.linkOpenInNewTab !== false}
              onChange={v => update(['data', 'props', 'linkHref'], v || null)}
              onChangeOpenInNewTab={v => update(['data', 'props', 'linkOpenInNewTab'], v)}
            />
          </Section>
        </>
      )}

      {block.type === 'Button' && (
        <>
          <SectionHeading>Button</SectionHeading>
          <Section>
            <PlainInput label="Label" value={props.text || ''} onChange={v => update(['data', 'props', 'text'], v)} />
            <PlainInput label="URL" value={props.url || ''} onChange={v => update(['data', 'props', 'url'], v)} />
            <Row2>
              <SelectInput
                label="Size"
                value={props.size || 'medium'}
                options={[{ value: 'x-small', label: 'X-Small' }, { value: 'small', label: 'Small' }, { value: 'medium', label: 'Medium' }, { value: 'large', label: 'Large' }]}
                onChange={v => update(['data', 'props', 'size'], v)}
              />
              <SelectInput
                label="Style"
                value={props.buttonStyle || 'rectangle'}
                options={[{ value: 'rectangle', label: 'Rectangle' }, { value: 'rounded', label: 'Rounded' }, { value: 'pill', label: 'Pill' }]}
                onChange={v => update(['data', 'props', 'buttonStyle'], v)}
              />
            </Row2>
            <Row2>
              <ColorInput label="Border Color" value={props.borderColor} onChange={v => update(['data', 'props', 'borderColor'], v)} />
              <IconInput label="Border" suffix="px" value={props.borderWidth ?? 0} onChange={v => update(['data', 'props', 'borderWidth'], parseFloat(v) || 0)} />
            </Row2>
          </Section>
        </>
      )}

      {block.type === 'Image' && (
        <>
          <SectionHeading>Image</SectionHeading>
          <Section>
            <ImageUploader
              currentUrl={props.url}
              onChange={async (v) => {
                update(['data', 'props', 'url'], v);
                // Best-effort: if the new URL is an SVG, fetch its markup
                // and cache it on the block so we can re-tint the fills
                // via dangerouslySetInnerHTML. CORS-blocked URLs fall back
                // to a plain <img> render — the tint just won't apply.
                if (typeof v === 'string' && /\.svg(\?|#|$)/i.test(v)) {
                  try {
                    const res = await fetch(v);
                    const text = await res.text();
                    if (text.includes('<svg')) {
                      update(['data', 'props', 'svgRaw'], text);
                    }
                  } catch { /* fine — tint just won't apply */ }
                } else if (props.svgRaw) {
                  update(['data', 'props', 'svgRaw'], null);
                }
              }}
            />
            <PlainInput label="URL" value={props.url || ''} onChange={v => update(['data', 'props', 'url'], v)} />
            <PlainInput label="Alt Text" value={props.alt || ''} onChange={v => update(['data', 'props', 'alt'], v)} />
            <PlainInput label="Link URL" value={props.linkHref || ''} onChange={v => update(['data', 'props', 'linkHref'], v || null)} />
            {/* Tint color appears only for SVGs we've cached the raw markup
                for. Substituted into fill="…" attributes at render time so
                a single-color icon recolors cleanly without filter hacks. */}
            {props.svgRaw && (
              <ColorInput
                label="Tint"
                value={props.tintColor || '#3A485F'}
                onChange={v => update(['data', 'props', 'tintColor'], v)}
                allowGradient={false}
              />
            )}
            <Row2>
              <SelectInput
                label="Size"
                value={props.objectFit || 'fill'}
                options={[
                  { value: 'fill', label: 'Fill' },
                  { value: 'cover', label: 'Cover' },
                  { value: 'contain', label: 'Contain' },
                  { value: 'none', label: 'None' },
                ]}
                onChange={v => update(['data', 'props', 'objectFit'], v)}
              />
              <SelectInput
                label="Position"
                value={props.objectPosition || 'center'}
                options={[
                  { value: 'center', label: 'Center' },
                  { value: 'top', label: 'Top' },
                  { value: 'bottom', label: 'Bottom' },
                  { value: 'left', label: 'Left' },
                  { value: 'right', label: 'Right' },
                  { value: 'top left', label: 'Top Left' },
                  { value: 'top right', label: 'Top Right' },
                  { value: 'bottom left', label: 'Bottom Left' },
                  { value: 'bottom right', label: 'Bottom Right' },
                ]}
                onChange={v => update(['data', 'props', 'objectPosition'], v)}
              />
            </Row2>
          </Section>
        </>
      )}

      {block.type === 'Avatar' && (
        <>
          <SectionHeading>Avatar</SectionHeading>
          <Section>
            <ImageUploader
              currentUrl={props.imageUrl}
              onChange={v => update(['data', 'props', 'imageUrl'], v)}
            />
            <PlainInput label="Image URL" value={props.imageUrl || ''} onChange={v => update(['data', 'props', 'imageUrl'], v)} />
            <Row2>
              <IconInput label="Size" suffix="px" value={props.size || 64} onChange={v => update(['data', 'props', 'size'], parseFloat(v) || 64)} />
              <SelectInput
                label="Shape"
                value={props.shape || 'circle'}
                options={[{ value: 'circle', label: 'Circle' }, { value: 'square', label: 'Square' }, { value: 'rounded', label: 'Rounded' }]}
                onChange={v => update(['data', 'props', 'shape'], v)}
              />
            </Row2>
          </Section>
        </>
      )}

      {block.type === 'Divider' && (
        <>
          <SectionHeading>Divider</SectionHeading>
          <Section>
            <div className={styles.fieldCol}>
              <label className={styles.fieldLabel}>Orientation</label>
              <Toggle
                fullWidth
                items={[
                  { key: 'horizontal', label: 'Horizontal' },
                  { key: 'vertical',   label: 'Vertical' },
                ]}
                active={props.orientation || 'horizontal'}
                size="S"
                onChange={v => update(['data', 'props', 'orientation'], v)}
              />
            </div>
            <Row2>
              <ColorInput label="Line Color" value={props.lineColor} onChange={v => update(['data', 'props', 'lineColor'], v)} />
              <IconInput label="Thickness" suffix="px" value={props.lineHeight || 1} onChange={v => update(['data', 'props', 'lineHeight'], parseFloat(v) || 1)} />
            </Row2>
            {/* Vertical dividers get an explicit Height field — without it
                the bar collapses to its 24px min-height inside flex layouts. */}
            {props.orientation === 'vertical' && (
              <IconInput
                label="Height" suffix="px"
                value={props.height ?? 40}
                onChange={v => update(['data', 'props', 'height'], parseFloat(v) || 40)}
              />
            )}
            <div className={styles.fieldCol}>
              <label className={styles.fieldLabel}>Style</label>
              <Toggle
                fullWidth
                items={[
                  { key: 'solid', label: 'Solid' },
                  { key: 'dashed', label: 'Dashed' },
                ]}
                active={props.lineStyle || 'solid'}
                size="S"
                onChange={v => update(['data', 'props', 'lineStyle'], v)}
              />
            </div>
            <Row2>
              <div className={styles.fieldCol}>
                <label className={styles.fieldLabel}>Left End</label>
                <Toggle
                  fullWidth
                  items={[
                    { key: 'none', label: '—' },
                    { key: 'circle', label: '●' },
                    { key: 'arrow', label: '◄' },
                  ]}
                  active={props.endLeft || 'none'}
                  size="S"
                  onChange={v => update(['data', 'props', 'endLeft'], v)}
                />
              </div>
              <div className={styles.fieldCol}>
                <label className={styles.fieldLabel}>Right End</label>
                <Toggle
                  fullWidth
                  items={[
                    { key: 'none', label: '—' },
                    { key: 'circle', label: '●' },
                    { key: 'arrow', label: '►' },
                  ]}
                  active={props.endRight || 'none'}
                  size="S"
                  onChange={v => update(['data', 'props', 'endRight'], v)}
                />
              </div>
            </Row2>
          </Section>
        </>
      )}

      {block.type === 'Spacer' && (
        <>
          <SectionHeading>Spacer</SectionHeading>
          <Section>
            <IconInput label="Height" suffix="px" value={props.height || 16} onChange={v => update(['data', 'props', 'height'], parseFloat(v) || 16)} />
          </Section>
        </>
      )}

      {block.type === 'Table' && (
        <>
          <SectionHeading>Table</SectionHeading>
          <Section>
            <TableEditor
              columns={props.columns || []}
              rows={props.rows || []}
              onChangeColumns={cols => update(['data', 'props', 'columns'], cols)}
              onChangeRows={rows => update(['data', 'props', 'rows'], rows)}
            />
            <Row2>
              <ColorInput label="Header BG" value={props.headerBg || '#7C5CFA'} onChange={v => update(['data', 'props', 'headerBg'], v)} />
              <ColorInput label="Header Text" value={props.headerColor || '#FFFFFF'} onChange={v => update(['data', 'props', 'headerColor'], v)} />
            </Row2>
            <Row2>
              <ColorInput label="Border" value={props.borderColor || '#E1E4EA'} onChange={v => update(['data', 'props', 'borderColor'], v)} />
              <ColorInput label="Stripe" value={props.stripedColor || '#F6F4FF'} onChange={v => update(['data', 'props', 'stripedColor'], v)} />
            </Row2>
            <div className={styles.fieldCol}>
              <label className={styles.fieldLabel}>Striped Rows</label>
              <Toggle
                fullWidth
                items={[{ key: 'on', label: 'On' }, { key: 'off', label: 'Off' }]}
                active={props.stripedRows ? 'on' : 'off'}
                size="S"
                onChange={v => update(['data', 'props', 'stripedRows'], v === 'on')}
              />
            </div>
          </Section>
        </>
      )}

      {block.type === 'Social' && (
        <>
          <SectionHeading>Social Links</SectionHeading>
          <Section>
            <SocialEditor
              platforms={props.platforms || []}
              onChange={platforms => update(['data', 'props', 'platforms'], platforms)}
            />
            <Row2>
              <IconInput label="Icon Size" suffix="px" value={props.iconSize || 24} onChange={v => update(['data', 'props', 'iconSize'], parseFloat(v) || 24)} />
              <IconInput label="Gap" suffix="px" value={props.gap || 16} onChange={v => update(['data', 'props', 'gap'], parseFloat(v) || 16)} />
            </Row2>
            <div className={styles.fieldCol}>
              <label className={styles.fieldLabel}>Alignment</label>
              <Toggle
                fullWidth
                items={[
                  { key: 'left',   label: '', icon: <AlignLeftIcon /> },
                  { key: 'center', label: '', icon: <AlignCenterIcon /> },
                  { key: 'right',  label: '', icon: <AlignRightIcon /> },
                ]}
                active={props.alignment || 'center'}
                size="S"
                onChange={v => update(['data', 'props', 'alignment'], v)}
              />
            </div>
          </Section>
        </>
      )}

      {block.type === 'NavBar' && (
        <>
          <SectionHeading>Nav Links</SectionHeading>
          <Section>
            <NavLinkEditor
              links={props.links || []}
              onChange={links => update(['data', 'props', 'links'], links)}
            />
            <Row2>
              <ColorInput label="Link Color" value={props.linkColor || '#7C5CFA'} onChange={v => update(['data', 'props', 'linkColor'], v)} />
              <IconInput label="Font Size" suffix="px" value={props.fontSize || 14} onChange={v => update(['data', 'props', 'fontSize'], parseFloat(v) || 14)} />
            </Row2>
            <Row2>
              <IconInput label="Gap" suffix="px" value={props.gap || 24} onChange={v => update(['data', 'props', 'gap'], parseFloat(v) || 24)} />
              <SelectInput
                label="Weight"
                value={normalizeWeight(props.fontWeight || 'bold')}
                options={availableWeights(style.fontFamily || 'Inter')}
                onChange={v => update(['data', 'props', 'fontWeight'], v)}
              />
            </Row2>
            <div className={styles.fieldCol}>
              <label className={styles.fieldLabel}>Alignment</label>
              <Toggle
                fullWidth
                items={[
                  { key: 'left',   label: '', icon: <AlignLeftIcon /> },
                  { key: 'center', label: '', icon: <AlignCenterIcon /> },
                  { key: 'right',  label: '', icon: <AlignRightIcon /> },
                ]}
                active={props.alignment || 'center'}
                size="S"
                onChange={v => update(['data', 'props', 'alignment'], v)}
              />
            </div>
          </Section>
        </>
      )}

      {block.type === 'ColumnsContainer' && (
        <>
          <SectionHeading>Columns</SectionHeading>
          <Section>
            <Row2>
              <IconInput
                label="Count"
                value={props.columnsCount || 2}
                onChange={v => {
                  const num = Math.max(1, Math.min(6, parseFloat(v) || 2));
                  updateBlock(id, prev => {
                    const next = JSON.parse(JSON.stringify(prev));
                    next.data = next.data || {};
                    next.data.props = next.data.props || {};
                    next.data.props.columnsCount = num;
                    const cols = next.data.props.columns || [];
                    while (cols.length < num) cols.push({ childrenIds: [] });
                    next.data.props.columns = cols;
                    next.data.props.columnWidths = Array.from({ length: num }, () => Math.round(10000 / num) / 100);
                    return next;
                  });
                }}
              />
              <div className={styles.fieldCol}>
                <label className={styles.fieldLabel}>Direction</label>
                <Toggle
                  fullWidth
                  items={[
                    { key: 'row', label: '', icon: <DirectionRowIcon /> },
                    { key: 'column', label: '', icon: <DirectionColIcon /> },
                  ]}
                  active={props.direction || 'row'}
                  size="S"
                  onChange={v => update(['data', 'props', 'direction'], v)}
                />
              </div>
            </Row2>
            <Row2>
              <IconInput label="H Gap" suffix="px" value={props.columnsGap ?? 16} onChange={v => update(['data', 'props', 'columnsGap'], parseFloat(v) || 0)} />
              <IconInput label="V Gap" suffix="px" value={props.rowGap ?? 0} onChange={v => update(['data', 'props', 'rowGap'], parseFloat(v) || 0)} />
            </Row2>
            <div className={styles.fieldCol}>
              <label className={styles.fieldLabel}>Wrap</label>
              <Toggle
                fullWidth
                items={[
                  { key: 'nowrap', label: 'No Wrap' },
                  { key: 'wrap', label: 'Wrap' },
                ]}
                active={props.flexWrap || 'nowrap'}
                size="S"
                onChange={v => update(['data', 'props', 'flexWrap'], v)}
              />
            </div>
            <div className={styles.fieldCol}>
              <label className={styles.fieldLabel}>Column Widths</label>
              <ColumnWidthBar
                count={props.columnsCount || 2}
                widths={props.columnWidths}
                onChange={next => update(['data', 'props', 'columnWidths'], next)}
              />
            </div>
          </Section>
        </>
      )}

      {/* ── Layout ── */}
      <SectionHeading>Layout</SectionHeading>
      <Section>
        {(block.type === 'Image' || block.type === 'Avatar') ? (
          <Row2>
            {(() => {
              // Width: parse the stored value (number = px, "NN%" = percent)
              // into a numeric input + a unit toggle. Commits a number or
              // a "NN%" string back to props.width depending on the unit.
              const wRaw = props.width;
              const wUnit = typeof wRaw === 'string' && wRaw.endsWith('%') ? '%' : 'px';
              const wNum = wUnit === '%' ? parseFloat(wRaw) : (typeof wRaw === 'number' ? wRaw : '');
              return (
                <IconInput
                  label="Width" icon={<WidthIcon />}
                  unit={wUnit}
                  onUnitChange={(next) => {
                    if (next === '%') update(['data', 'props', 'width'], `${wNum || 100}%`);
                    else update(['data', 'props', 'width'], wNum || null);
                  }}
                  value={wNum}
                  onChange={v => {
                    const n = parseFloat(v);
                    if (Number.isNaN(n)) return update(['data', 'props', 'width'], null);
                    update(['data', 'props', 'width'], wUnit === '%' ? `${n}%` : n);
                  }}
                />
              );
            })()}
            {(() => {
              const hRaw = props.height;
              const hUnit = typeof hRaw === 'string' && hRaw.endsWith('%') ? '%' : 'px';
              const hNum = hUnit === '%' ? parseFloat(hRaw) : (typeof hRaw === 'number' ? hRaw : '');
              return (
                <IconInput
                  label="Height" icon={<HeightIcon />}
                  unit={hUnit}
                  onUnitChange={(next) => {
                    if (next === '%') update(['data', 'props', 'height'], `${hNum || 100}%`);
                    else update(['data', 'props', 'height'], hNum || null);
                  }}
                  value={hNum}
                  onChange={v => {
                    const n = parseFloat(v);
                    if (Number.isNaN(n)) return update(['data', 'props', 'height'], null);
                    update(['data', 'props', 'height'], hUnit === '%' ? `${n}%` : n);
                  }}
                />
              );
            })()}
          </Row2>
        ) : null}

        {(block.type === 'Container' || block.type === 'ColumnsContainer') ? (
          <Row2>
            <div className={styles.fieldCol}>
              <label className={styles.fieldLabel}>Height</label>
              <Toggle
                fullWidth
                items={[
                  { key: 'hug', label: 'Hug' },
                  { key: 'fixed', label: 'Fixed' },
                ]}
                active={props.heightMode || 'hug'}
                size="S"
                onChange={v => {
                  update(['data', 'props', 'heightMode'], v);
                  if (v === 'hug') update(['data', 'props', 'height'], null);
                }}
              />
            </div>
            {(props.heightMode === 'fixed') && (
              <IconInput
                label="Value" suffix="px" icon={<HeightIcon />}
                value={props.height || ''}
                onChange={v => update(['data', 'props', 'height'], parseFloat(v) || null)}
              />
            )}
          </Row2>
        ) : null}

        {/* Fixed-height containers position their child content via flex
            instead of overflowing. Two 3-button toggles (Horizontal +
            Vertical) map to align-items + justify-content respectively. */}
        {(block.type === 'Container' || block.type === 'ColumnsContainer') && props.heightMode === 'fixed' && (
          <Row2>
            <div className={styles.fieldCol}>
              <label className={styles.fieldLabel}>Horizontal</label>
              <Toggle
                fullWidth
                size="S"
                items={[
                  { key: 'left',   label: '', icon: <AlignLeftIcon /> },
                  { key: 'center', label: '', icon: <AlignCenterIcon /> },
                  { key: 'right',  label: '', icon: <AlignRightIcon /> },
                ]}
                active={props.contentAlignH || 'left'}
                onChange={v => update(['data', 'props', 'contentAlignH'], v)}
              />
            </div>
            <div className={styles.fieldCol}>
              <label className={styles.fieldLabel}>Vertical</label>
              <Toggle
                fullWidth
                size="S"
                items={[
                  { key: 'top',    label: '', icon: <AlignTopIcon /> },
                  { key: 'middle', label: '', icon: <AlignMiddleIcon /> },
                  { key: 'bottom', label: '', icon: <AlignBottomIcon /> },
                ]}
                active={props.contentAlign || 'top'}
                onChange={v => update(['data', 'props', 'contentAlign'], v)}
              />
            </div>
          </Row2>
        )}

        {!isLayout && (
          <PaddingControl
            padding={padding}
            onChangeSide={(side, value) => update(['data', 'style', 'padding', side], value)}
            onChangeAll={(value) => update(['data', 'style', 'padding'], { top: value, right: value, bottom: value, left: value })}
          />
        )}

        {/* Block-level horizontal alignment — controls where the rendered
            element sits inside its parent (works for Image/Avatar/Button
            via wrapper text-align, and for Container/ColumnsContainer via
            an inline-block alignment passed to the renderer). Distinct
            from textAlign which only controls text inside the element. */}
        {!isLayout && (
          <div className={styles.fieldCol}>
            <label className={styles.fieldLabel}>Align</label>
            <Toggle
              fullWidth
              items={[
                { key: 'left',   label: '', icon: <AlignLeftIcon /> },
                { key: 'center', label: '', icon: <AlignCenterIcon /> },
                { key: 'right',  label: '', icon: <AlignRightIcon /> },
              ]}
              active={style.blockAlign || 'left'}
              size="S"
              onChange={v => update(['data', 'style', 'blockAlign'], v)}
            />
          </div>
        )}

        {RADIUS_TYPES.has(block.type) && (
          <Row2>
            <IconInput
              label="Radius" suffix="px" icon={<RadiusIcon />}
              value={style.borderRadius ?? (block.type === 'Button' ? BUTTON_STYLE_RADIUS[props.buttonStyle || 'rectangle'] ?? 0 : 0)}
              onChange={v => update(['data', 'style', 'borderRadius'], parseFloat(v) || 0)}
            />
          </Row2>
        )}
      </Section>

      {/* ── Appearance ── (text color, background color, border in one group) */}
      <SectionHeading>Appearance</SectionHeading>
      <Section>
        {isLayout ? (
          <>
            <Row2>
              <ColorInput label="Text Color" value={data.textColor} onChange={v => update(['data', 'textColor'], v)} />
              <ColorInput label="Canvas" value={data.canvasColor} onChange={v => update(['data', 'canvasColor'], v)} />
            </Row2>
            <Row2>
              <ColorInput label="Backdrop" value={data.backdropColor} onChange={v => update(['data', 'backdropColor'], v)} />
            </Row2>
          </>
        ) : (
          <>
            <Row2>
              {(block.type === 'Heading' || block.type === 'Text' || block.type === 'Button') && (
                <ColorInput
                  label="Text Color"
                  value={block.type === 'Button' ? props.buttonTextColor : style.color}
                  onChange={v => update(
                    block.type === 'Button' ? ['data', 'props', 'buttonTextColor'] : ['data', 'style', 'color'],
                    v
                  )}
                />
              )}
              <ColorInput
                label="Background Color"
                value={block.type === 'Button' ? props.buttonBackgroundColor : style.backgroundColor}
                onChange={v => update(
                  block.type === 'Button' ? ['data', 'props', 'buttonBackgroundColor'] : ['data', 'style', 'backgroundColor'],
                  v
                )}
              />
            </Row2>
            <BorderControl
              style={style}
              onUpdate={(key, value) => update(['data', 'style', key], value)}
            />
          </>
        )}
      </Section>

      {/* ── Background Image (containers only) ── */}
      {!isLayout && BG_IMAGE_TYPES.has(block.type) && (
        <>
          <SectionHeading>Background Image</SectionHeading>
          <Section>
            <ImageUploader
              compact
              currentUrl={style.backgroundImage}
              onChange={async (v) => {
                update(['data', 'style', 'backgroundImage'], v);
                if (v && !style.backgroundSize) {
                  update(['data', 'style', 'backgroundSize'], 'cover');
                  update(['data', 'style', 'backgroundPosition'], 'center');
                  update(['data', 'style', 'backgroundRepeat'], 'no-repeat');
                }
                // Cache raw SVG markup so the user can tint it — mirrors
                // the Image-block path. URLs that aren't SVG (or fail to
                // fetch for CORS) just don't get a Tint control surfaced.
                if (typeof v === 'string' && /\.svg(\?|#|$)/i.test(v)) {
                  try {
                    const res = await fetch(v);
                    const text = await res.text();
                    if (text.includes('<svg')) {
                      update(['data', 'style', 'bgSvgRaw'], text);
                    }
                  } catch { /* tint just won't apply */ }
                } else if (style.bgSvgRaw) {
                  update(['data', 'style', 'bgSvgRaw'], null);
                }
              }}
            />
            {style.bgSvgRaw && (
              <ColorInput
                label="Image Tint"
                value={style.bgTintColor || '#3A485F'}
                onChange={v => update(['data', 'style', 'bgTintColor'], v)}
                allowGradient={false}
              />
            )}
            {style.backgroundImage && (
              <>
                <Row2>
                  <SelectInput
                    label="Size"
                    value={style.backgroundSize || 'cover'}
                    options={[
                      { value: 'cover', label: 'Cover' },
                      { value: 'contain', label: 'Contain' },
                      { value: 'auto', label: 'Auto' },
                    ]}
                    onChange={v => update(['data', 'style', 'backgroundSize'], v)}
                  />
                  <SelectInput
                    label="Repeat"
                    value={style.backgroundRepeat || 'no-repeat'}
                    options={[
                      { value: 'no-repeat', label: 'None' },
                      { value: 'repeat', label: 'Repeat' },
                      { value: 'repeat-x', label: 'Repeat X' },
                      { value: 'repeat-y', label: 'Repeat Y' },
                    ]}
                    onChange={v => update(['data', 'style', 'backgroundRepeat'], v)}
                  />
                </Row2>
                <SelectInput
                  label="Position"
                  value={style.backgroundPosition || 'center'}
                  options={[
                    { value: 'center', label: 'Center' },
                    { value: 'top', label: 'Top' },
                    { value: 'bottom', label: 'Bottom' },
                    { value: 'left', label: 'Left' },
                    { value: 'right', label: 'Right' },
                    { value: 'top left', label: 'Top Left' },
                    { value: 'top right', label: 'Top Right' },
                    { value: 'bottom left', label: 'Bottom Left' },
                    { value: 'bottom right', label: 'Bottom Right' },
                  ]}
                  onChange={v => update(['data', 'style', 'backgroundPosition'], v)}
                />
              </>
            )}
          </Section>
        </>
      )}

      {/* ── Color Variables (root only — global tokens) ── */}
      {isLayout && (
        <>
          <SectionHeading>Color Variables</SectionHeading>
          <Section><ColorVariablesEditor /></Section>
        </>
      )}

      {/* ── Typography ── */}
      {(isLayout || block.type === 'Heading' || block.type === 'Text' || block.type === 'Button') && (
        <>
          <SectionHeading>Typography</SectionHeading>
          <Section>
            <SelectInput
              label="Font Family"
              value={(isLayout ? data.fontFamily : style.fontFamily) || rootFontFamily || 'Inter'}
              options={FONT_FAMILIES}
              onChange={v => update(isLayout ? ['data', 'fontFamily'] : ['data', 'style', 'fontFamily'], v)}
            />
            {!isLayout && (
              <>
                <Row2>
                  <SelectInput
                    label="Font Weight"
                    value={normalizeWeight(style.fontWeight)}
                    options={availableWeights(style.fontFamily || (isLayout ? data.fontFamily : 'Inter'))}
                    onChange={v => update(['data', 'style', 'fontWeight'], v)}
                  />
                  <IconInput
                    label="Font Size" suffix="px"
                    value={style.fontSize || 14}
                    onChange={v => update(['data', 'style', 'fontSize'], parseFloat(v) || 14)}
                  />
                </Row2>
                <Row2>
                  <LineHeightInput value={style.lineHeight} onChange={v => update(['data', 'style', 'lineHeight'], v)} />
                  <LetterSpacingInput value={style.letterSpacing} onChange={v => update(['data', 'style', 'letterSpacing'], v)} />
                </Row2>
                <Row2>
                  <div className={styles.fieldCol}>
                    <label className={styles.fieldLabel}>Alignment</label>
                    <Toggle
                      fullWidth
                      items={[
                        { key: 'left',    label: '', icon: <AlignLeftIcon /> },
                        { key: 'center',  label: '', icon: <AlignCenterIcon /> },
                        { key: 'right',   label: '', icon: <AlignRightIcon /> },
                        { key: 'justify', label: '', icon: <AlignJustifyIcon /> },
                      ]}
                      active={style.textAlign || 'left'}
                      size="S"
                      onChange={v => update(['data', 'style', 'textAlign'], v)}
                    />
                  </div>
                  {block.type === 'Text' && (
                    <div className={styles.fieldCol}>
                      <label className={styles.fieldLabel}>List Style</label>
                      <Toggle
                        fullWidth
                        items={[
                          { key: 'none',   label: '', icon: <ListNoneIcon /> },
                          { key: 'bullet', label: '', icon: <ListBulletIcon /> },
                          { key: 'number', label: '', icon: <ListNumberIcon /> },
                        ]}
                        active={props.listStyle || 'none'}
                        size="S"
                        onChange={v => update(['data', 'props', 'listStyle'], v === 'none' ? null : v)}
                      />
                    </div>
                  )}
                </Row2>
                {/* Decoration row applies to the whole block. Selecting text
                    on the canvas reveals the floating toolbar for inline
                    range-level formatting. */}
                <div className={styles.fieldCol}>
                  <label className={styles.fieldLabel}>Decoration</label>
                  <DecorationToggles
                    bold={Number(normalizeWeight(style.fontWeight)) >= 600}
                    italic={style.fontStyle === 'italic'}
                    underline={style.textDecoration === 'underline'}
                    strike={style.textDecoration === 'line-through'}
                    code={style.fontFamily === 'JetBrains Mono' || style.fontFamily === 'Fira Code' || style.fontFamily === 'IBM Plex Mono' || style.fontFamily === 'MONOSPACE'}
                    caps={style.textTransform === 'uppercase'}
                    onChange={(key, on) => {
                      if (key === 'bold') update(['data', 'style', 'fontWeight'], on ? '700' : '400');
                      if (key === 'italic') update(['data', 'style', 'fontStyle'], on ? 'italic' : null);
                      if (key === 'underline') update(['data', 'style', 'textDecoration'], on ? 'underline' : null);
                      if (key === 'strike') update(['data', 'style', 'textDecoration'], on ? 'line-through' : null);
                      if (key === 'code') update(['data', 'style', 'fontFamily'], on ? 'JetBrains Mono' : 'Inter');
                      if (key === 'caps') update(['data', 'style', 'textTransform'], on ? 'uppercase' : null);
                    }}
                  />
                </div>
              </>
            )}
          </Section>
        </>
      )}

    </div>
  );
}

// ── Bulk design tab — edit common properties across multiple selected blocks ─
const TEXT_TYPES = new Set(['Heading', 'Text', 'Button']);

function getCommonValue(blocks, getter) {
  if (blocks.length === 0) return undefined;
  const first = getter(blocks[0]);
  return blocks.every(b => getter(b) === first) ? first : undefined;
}

function ColumnDesignTab({ block, updateBlock, id, columnIdx }) {
  if (!block) return <div className={styles.emptyState}>Select a block</div>;
  const props = block.data?.props || {};
  const col = props.columns?.[columnIdx] || {};
  const colPadding = col.padding || { top: 0, right: 0, bottom: 0, left: 0 };

  const updateCol = (key, value) => {
    updateBlock(id, prev => {
      const next = JSON.parse(JSON.stringify(prev));
      next.data = next.data || {};
      next.data.props = next.data.props || {};
      next.data.props.columns = next.data.props.columns || [];
      while (next.data.props.columns.length <= columnIdx) next.data.props.columns.push({ childrenIds: [] });
      next.data.props.columns[columnIdx][key] = value;
      return next;
    });
  };

  return (
    <div className={styles.designScroll}>
      <SectionHeading>Column {columnIdx + 1}</SectionHeading>
      <Section>
        <Row2>
          <div className={styles.fieldCol}>
            <label className={styles.fieldLabel}>Horizontal</label>
            <Toggle
              fullWidth
              size="S"
              items={[
                { key: 'left',   label: '', icon: <AlignLeftIcon /> },
                { key: 'center', label: '', icon: <AlignCenterIcon /> },
                { key: 'right',  label: '', icon: <AlignRightIcon /> },
              ]}
              active={col.align || 'left'}
              onChange={v => updateCol('align', v)}
            />
          </div>
          <div className={styles.fieldCol}>
            <label className={styles.fieldLabel}>Vertical</label>
            <Toggle
              fullWidth
              size="S"
              items={[
                { key: 'top',    label: '', icon: <AlignTopIcon /> },
                { key: 'middle', label: '', icon: <AlignMiddleIcon /> },
                { key: 'bottom', label: '', icon: <AlignBottomIcon /> },
              ]}
              active={col.valign || 'top'}
              onChange={v => updateCol('valign', v)}
            />
          </div>
        </Row2>

        <div className={styles.fieldCol}>
          <label className={styles.fieldLabel}>Height</label>
          <Toggle
            fullWidth
            size="S"
            items={[
              { key: 'hug',    label: 'Hug' },
              { key: 'fill',   label: 'Fill' },
              { key: 'custom', label: 'Custom' },
            ]}
            active={col.heightMode || 'hug'}
            onChange={v => updateCol('heightMode', v)}
          />
        </div>
        {col.heightMode === 'custom' && (
          <IconInput
            label="Value" suffix="px" icon={<HeightIcon />}
            value={col.customHeight ?? 200}
            onChange={v => updateCol('customHeight', parseFloat(v) || 0)}
          />
        )}

        <PaddingControl
          padding={colPadding}
          onChangeSide={(side, value) => {
            updateCol('padding', { ...colPadding, [side]: value });
          }}
          onChangeAll={(value) => {
            updateCol('padding', { top: value, right: value, bottom: value, left: value });
          }}
        />
        <ColorInput
          label="Background"
          value={col.backgroundColor || ''}
          onChange={v => updateCol('backgroundColor', v || '')}
        />
      </Section>
    </div>
  );
}

function BulkDesignTab({ doc, bulkIds, updateBlock }) {
  const blocks = bulkIds.map(id => doc?.[id]).filter(Boolean);
  const clearBulk = useAppStore(s => s.setBulkSelectedIds);
  if (blocks.length === 0) return <div className={styles.emptyState}>No blocks selected</div>;

  const types = new Set(blocks.map(b => b.type));
  const allText = blocks.every(b => TEXT_TYPES.has(b.type));
  const allHaveRadius = blocks.every(b => RADIUS_TYPES.has(b.type));

  const bulkUpdate = (pathFn, value) => {
    bulkIds.forEach(id => {
      updateBlock(id, prev => {
        const next = JSON.parse(JSON.stringify(prev));
        let target = next;
        const path = typeof pathFn === 'function' ? pathFn(prev) : pathFn;
        for (let i = 0; i < path.length - 1; i++) {
          target[path[i]] = target[path[i]] ?? {};
          target = target[path[i]];
        }
        target[path[path.length - 1]] = value;
        return next;
      });
    });
  };

  const commonPadding = {
    top: getCommonValue(blocks, b => b.data?.style?.padding?.top),
    bottom: getCommonValue(blocks, b => b.data?.style?.padding?.bottom),
    left: getCommonValue(blocks, b => b.data?.style?.padding?.left),
    right: getCommonValue(blocks, b => b.data?.style?.padding?.right),
  };

  return (
    <div className={styles.designScroll}>
      <div className={styles.bulkHeader}>
        <Icon name="solar:layers-linear" size={14} color="var(--primary-400)" />
        <span>{bulkIds.length} blocks selected</span>
        <button className={styles.bulkClear} onClick={() => clearBulk([])}>
          <Icon name="solar:close-circle-linear" size={14} color="var(--neutral-400)" />
        </button>
      </div>

      {/* ── Layout ── */}
      <SectionHeading>Layout</SectionHeading>
      <Section>
        <FieldLabel>Padding</FieldLabel>
        <Row2>
          <IconInput
            suffix="px" icon={<PadLeftIcon />}
            value={commonPadding.left ?? ''} onChange={v => bulkUpdate(['data', 'style', 'padding', 'left'], parseFloat(v) || 0)}
          />
          <IconInput
            suffix="px" icon={<PadTopIcon />}
            value={commonPadding.top ?? ''} onChange={v => bulkUpdate(['data', 'style', 'padding', 'top'], parseFloat(v) || 0)}
          />
        </Row2>
        <Row2>
          <IconInput
            suffix="px" icon={<PadRightIcon />}
            value={commonPadding.right ?? ''} onChange={v => bulkUpdate(['data', 'style', 'padding', 'right'], parseFloat(v) || 0)}
          />
          <IconInput
            suffix="px" icon={<PadBottomIcon />}
            value={commonPadding.bottom ?? ''} onChange={v => bulkUpdate(['data', 'style', 'padding', 'bottom'], parseFloat(v) || 0)}
          />
        </Row2>
        {allHaveRadius && (
          <Row2>
            <IconInput
              label="Radius" suffix="px" icon={<RadiusIcon />}
              value={getCommonValue(blocks, b => b.data?.style?.borderRadius) ?? ''}
              onChange={v => bulkUpdate(['data', 'style', 'borderRadius'], parseFloat(v) || 0)}
            />
          </Row2>
        )}
      </Section>

      {/* ── Color ── */}
      <SectionHeading>Color</SectionHeading>
      <Section>
        <Row2>
          {allText && (
            <ColorInput
              label="Text Color"
              value={getCommonValue(blocks, b => b.type === 'Button' ? b.data?.props?.buttonTextColor : b.data?.style?.color) || ''}
              onChange={v => {
                bulkIds.forEach(id => {
                  const blk = doc[id];
                  const path = blk?.type === 'Button' ? ['data', 'props', 'buttonTextColor'] : ['data', 'style', 'color'];
                  updateBlock(id, prev => {
                    const next = JSON.parse(JSON.stringify(prev));
                    let target = next;
                    for (let i = 0; i < path.length - 1; i++) { target[path[i]] = target[path[i]] ?? {}; target = target[path[i]]; }
                    target[path[path.length - 1]] = v;
                    return next;
                  });
                });
              }}
            />
          )}
          <ColorInput
            label="Background"
            value={getCommonValue(blocks, b => b.type === 'Button' ? b.data?.props?.buttonBackgroundColor : b.data?.style?.backgroundColor) || ''}
            onChange={v => {
              bulkIds.forEach(id => {
                const blk = doc[id];
                const path = blk?.type === 'Button' ? ['data', 'props', 'buttonBackgroundColor'] : ['data', 'style', 'backgroundColor'];
                updateBlock(id, prev => {
                  const next = JSON.parse(JSON.stringify(prev));
                  let target = next;
                  for (let i = 0; i < path.length - 1; i++) { target[path[i]] = target[path[i]] ?? {}; target = target[path[i]]; }
                  target[path[path.length - 1]] = v;
                  return next;
                });
              });
            }}
          />
        </Row2>
      </Section>

      {/* ── Typography (only if all are text-based) ── */}
      {allText && (
        <>
          <SectionHeading>Typography</SectionHeading>
          <Section>
            <Row2>
              <SelectInput
                label="Font Weight"
                value={normalizeWeight(getCommonValue(blocks, b => b.data?.style?.fontWeight))}
                options={availableWeights(getCommonValue(blocks, b => b.data?.style?.fontFamily) || 'Inter')}
                onChange={v => bulkUpdate(['data', 'style', 'fontWeight'], v)}
              />
              <IconInput
                label="Font Size" suffix="px"
                value={getCommonValue(blocks, b => b.data?.style?.fontSize) ?? ''}
                onChange={v => bulkUpdate(['data', 'style', 'fontSize'], parseFloat(v) || 14)}
              />
            </Row2>
            <Row2>
              <div className={styles.fieldCol}>
                <label className={styles.fieldLabelStrong}>Alignment</label>
                <Toggle
                  fullWidth
                  items={[
                    { key: 'left',    label: '', icon: <AlignLeftIcon /> },
                    { key: 'center',  label: '', icon: <AlignCenterIcon /> },
                    { key: 'right',   label: '', icon: <AlignRightIcon /> },
                    { key: 'justify', label: '', icon: <AlignJustifyIcon /> },
                  ]}
                  active={getCommonValue(blocks, b => b.data?.style?.textAlign) || 'left'}
                  size="S"
                  onChange={v => bulkUpdate(['data', 'style', 'textAlign'], v)}
                />
              </div>
            </Row2>
          </Section>
        </>
      )}
    </div>
  );
}

// ── Overlay scrollbar (both axes) ───────────────────────────────────────────
// Wraps a scrollable child and replaces both native scrollbars with thin
// translucent thumbs pinned to the right edge (vertical) and bottom edge
// (horizontal). Both thumbs float over the content with zero width/height
// footprint, so the section width never changes between scroll states.
function OverlayVerticalScroll({ innerRef, className, children, ...rest }) {
  const localRef = useRef(null);
  const setRef = (el) => {
    localRef.current = el;
    if (typeof innerRef === 'function') innerRef(el);
    else if (innerRef) innerRef.current = el;
  };
  const [vThumb, setVThumb] = useState({ visible: false, top: 0, height: 0 });
  const [hThumb, setHThumb] = useState({ visible: false, left: 0, width: 0 });
  const draggingRef = useRef(null);

  useEffect(() => {
    const el = localRef.current;
    if (!el) return;
    const update = () => {
      const { scrollTop, scrollLeft, scrollHeight, clientHeight, scrollWidth, clientWidth } = el;
      // Vertical
      if (scrollHeight <= clientHeight) {
        setVThumb((t) => (t.visible ? { visible: false, top: 0, height: 0 } : t));
      } else {
        const ratio = clientHeight / scrollHeight;
        const height = Math.max(24, clientHeight * ratio);
        const maxThumbTop = clientHeight - height;
        const maxScroll = scrollHeight - clientHeight;
        const top = maxScroll > 0 ? (scrollTop / maxScroll) * maxThumbTop : 0;
        setVThumb({ visible: true, top, height });
      }
      // Horizontal
      if (scrollWidth <= clientWidth) {
        setHThumb((t) => (t.visible ? { visible: false, left: 0, width: 0 } : t));
      } else {
        const ratio = clientWidth / scrollWidth;
        const width = Math.max(24, clientWidth * ratio);
        const maxThumbLeft = clientWidth - width;
        const maxScroll = scrollWidth - clientWidth;
        const left = maxScroll > 0 ? (scrollLeft / maxScroll) * maxThumbLeft : 0;
        setHThumb({ visible: true, left, width });
      }
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    const mo = new MutationObserver(update);
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
      mo.disconnect();
    };
  }, []);

  const onVerticalDown = (e) => {
    e.preventDefault();
    const el = localRef.current;
    if (!el) return;
    const startY = e.clientY;
    const startScrollTop = el.scrollTop;
    const trackHeight = el.clientHeight - vThumb.height;
    const maxScroll = el.scrollHeight - el.clientHeight;
    draggingRef.current = 'v';
    const move = (ev) => {
      if (draggingRef.current !== 'v') return;
      const dy = ev.clientY - startY;
      const ratio = trackHeight > 0 ? dy / trackHeight : 0;
      el.scrollTop = Math.max(0, Math.min(maxScroll, startScrollTop + ratio * maxScroll));
    };
    const up = () => { draggingRef.current = null; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const onHorizontalDown = (e) => {
    e.preventDefault();
    const el = localRef.current;
    if (!el) return;
    const startX = e.clientX;
    const startScrollLeft = el.scrollLeft;
    const trackWidth = el.clientWidth - hThumb.width;
    const maxScroll = el.scrollWidth - el.clientWidth;
    draggingRef.current = 'h';
    const move = (ev) => {
      if (draggingRef.current !== 'h') return;
      const dx = ev.clientX - startX;
      const ratio = trackWidth > 0 ? dx / trackWidth : 0;
      el.scrollLeft = Math.max(0, Math.min(maxScroll, startScrollLeft + ratio * maxScroll));
    };
    const up = () => { draggingRef.current = null; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  return (
    <div className={styles.overlayScrollWrap}>
      <div
        ref={setRef}
        className={[styles.overlayScrollInner, className].filter(Boolean).join(' ')}
        {...rest}
      >
        {children}
      </div>
      {vThumb.visible && (
        <div
          className={styles.overlayScrollThumb}
          style={{ top: vThumb.top, height: vThumb.height }}
          onMouseDown={onVerticalDown}
        />
      )}
      {hThumb.visible && (
        <div
          className={styles.overlayScrollThumbH}
          style={{ left: hThumb.left, width: hThumb.width }}
          onMouseDown={onHorizontalDown}
        />
      )}
    </div>
  );
}

// ── MJML / Easy Email → Fold document converter ─────────────────────────────
function convertMjmlToFold(mjml) {
  let counter = 0;
  const genId = () => `imported-${++counter}`;
  const blocks = {};

  function parsePadding(str) {
    if (!str) return { top: 0, right: 0, bottom: 0, left: 0 };
    const parts = str.replace(/px/g, '').trim().split(/\s+/).map(Number);
    if (parts.length === 1) return { top: parts[0], right: parts[0], bottom: parts[0], left: parts[0] };
    if (parts.length === 2) return { top: parts[0], right: parts[1], bottom: parts[0], left: parts[1] };
    if (parts.length === 4) return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[3] };
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  function pxToNum(val) {
    if (!val) return undefined;
    return parseInt(String(val).replace('px', ''), 10) || undefined;
  }

  function stripHtml(html) {
    return html?.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '') || '';
  }

  function convertNode(node) {
    if (!node || !node.type) return null;
    const a = node.attributes || {};
    const val = node.data?.value || {};

    switch (node.type) {
      case 'image': {
        const id = genId();
        blocks[id] = {
          type: 'Image',
          data: {
            props: { url: a.src || '', alt: a.alt || '', width: pxToNum(a.width) },
            style: { padding: parsePadding(a.padding), textAlign: a.align || 'center' },
          },
        };
        return id;
      }
      case 'text': {
        const id = genId();
        const content = val.content || '';
        const isHeading = pxToNum(a['font-size']) >= 24;
        blocks[id] = {
          type: isHeading ? 'Heading' : 'Text',
          data: {
            props: { text: content, ...(isHeading ? { level: 'h2' } : {}) },
            style: {
              padding: parsePadding(a.padding),
              color: a.color || '#3A485F',
              fontSize: pxToNum(a['font-size']) || 14,
              fontWeight: a['font-weight'] || 'normal',
              textAlign: a.align || 'left',
            },
          },
        };
        return id;
      }
      case 'button': {
        const id = genId();
        blocks[id] = {
          type: 'Button',
          data: {
            props: {
              text: val.content || stripHtml(a['inner-text'] || 'Click me'),
              url: a.href || '#',
              buttonBackgroundColor: a['background-color'] || '#7C5CFA',
              buttonTextColor: a.color || '#FFFFFF',
            },
            style: { padding: parsePadding(a.padding), textAlign: a.align || 'center' },
          },
        };
        return id;
      }
      case 'divider':
      case 'advanced_divider': {
        const id = genId();
        blocks[id] = {
          type: 'Divider',
          data: {
            props: { lineColor: a['border-color'] || '#E1E4EA', lineHeight: pxToNum(a['border-width']) || 1 },
            style: { padding: parsePadding(a.padding) },
          },
        };
        return id;
      }
      case 'spacer': {
        const id = genId();
        blocks[id] = {
          type: 'Spacer',
          data: {
            props: { height: pxToNum(a.height) || 32 },
            style: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
          },
        };
        return id;
      }
      case 'column': {
        const childIds = (node.children || []).map(convertNode).filter(Boolean);
        return childIds;
      }
      case 'group':
      case 'section': {
        const columns = [];
        const flatChildren = [];
        for (const child of (node.children || [])) {
          if (child.type === 'group') {
            for (const gc of (child.children || [])) {
              if (gc.type === 'column') {
                columns.push((gc.children || []).map(convertNode).filter(Boolean));
              } else {
                const cid = convertNode(gc);
                if (cid) flatChildren.push(cid);
              }
            }
          } else if (child.type === 'column') {
            columns.push((child.children || []).map(convertNode).filter(Boolean));
          } else {
            const cid = convertNode(child);
            if (cid) flatChildren.push(cid);
          }
        }

        if (columns.length > 1) {
          const id = genId();
          blocks[id] = {
            type: 'ColumnsContainer',
            data: {
              style: { padding: parsePadding(a.padding), backgroundColor: a['background-color'] },
              props: {
                columnsCount: columns.length,
                columnsGap: 16,
                columns: columns.map(col => ({ childrenIds: col.flat() })),
              },
            },
          };
          return id;
        }

        const allChildIds = [...flatChildren, ...columns.flat(2)];
        if (allChildIds.length === 0) return null;

        if (a['background-color'] && a['background-color'] !== 'white' && a['background-color'] !== '#FFFFFF' && a['background-color'] !== '#ffffff') {
          const id = genId();
          blocks[id] = {
            type: 'Container',
            data: {
              style: { padding: parsePadding(a.padding), backgroundColor: a['background-color'] },
              props: { childrenIds: allChildIds },
            },
          };
          return id;
        }

        return allChildIds;
      }
      case 'wrapper': {
        const ids = [];
        for (const wc of (node.children || [])) {
          const r = convertNode(wc);
          if (Array.isArray(r)) ids.push(...r);
          else if (r) ids.push(r);
        }
        if (ids.length === 0) return null;
        if (a['background-color'] && a['background-color'] !== 'white' && a['background-color'] !== '#FFFFFF' && a['background-color'] !== '#ffffff') {
          const id = genId();
          blocks[id] = {
            type: 'Container',
            data: {
              style: { padding: parsePadding(a.padding), backgroundColor: a['background-color'] },
              props: { childrenIds: ids },
            },
          };
          return id;
        }
        return ids;
      }
      default:
        return null;
    }
  }

  const rootChildIds = [];
  for (const child of (mjml.children || [])) {
    const result = convertNode(child);
    if (Array.isArray(result)) rootChildIds.push(...result);
    else if (result) rootChildIds.push(result);
  }

  const pageAttrs = mjml.attributes || {};
  const pageValue = mjml.data?.value || {};

  const doc = {
    root: {
      type: 'EmailLayout',
      data: {
        backdropColor: pageAttrs['background-color'] || '#F2EEFE',
        canvasColor: '#FFFFFF',
        textColor: pageValue['text-color'] || '#3A485F',
        fontFamily: 'MODERN_SANS',
        childrenIds: rootChildIds,
      },
    },
    ...blocks,
  };

  return doc;
}

// ── Code tab ────────────────────────────────────────────────────────────────
// Drop any stale `customHtml` from a doc so it routes through the
// SortableBlock pipeline (full toolbar/DnD). Idempotent — safe to call on
// docs that don't have it.
function stripCustomHtml(d) {
  if (!d?.root?.data) return d;
  if (!('customHtml' in d.root.data)) return d;
  const { customHtml: _drop, ...rest } = d.root.data;
  return { ...d, root: { ...d.root, data: rest } };
}

function CodeTab({ doc }) {
  const setEmailDocument = useAppStore(s => s.setEmailDocument);
  const htmlPreviewOverride = useAppStore(s => s.htmlPreviewOverride);
  const setHtmlPreviewOverride = useAppStore(s => s.setHtmlPreviewOverride);
  // selectedBlockId drives the "jump to this block's source" cursor sync
  // below — whenever the user picks a block on the canvas, we scroll the
  // matching `"block-…": {` (JSON) or that block's first inner element
  // (HTML) into view in the editor.
  const selectedBlockId = useAppStore(s => s.selectedBlockId);

  const [mode, setMode] = useState('json');
  const [text, setText] = useState('');
  const [error, setError] = useState(null);
  const textareaRef = useRef(null);
  // Track whether the local `text` state is the user's draft (true) or freshly
  // synced from the document/override (false). When sync'd, we re-format from
  // the doc; when drafting, we keep the user's text untouched.
  const drafting = useRef(false);

  // Re-derive text whenever the document changes externally — unless the user
  // is mid-edit, in which case we keep their draft.
  useEffect(() => {
    if (drafting.current) return;
    let cancelled = false;
    (async () => {
      if (mode === 'json') {
        const next = JSON.stringify(doc, null, 2);
        if (!cancelled) setText(next);
      } else {
        // Always render the email HTML even if prettier fails to load —
        // an unformatted but valid HTML string is much more useful than
        // a comment placeholder.
        const seed = htmlPreviewOverride ?? renderEmailHtml(doc);
        if (!cancelled) setText(seed);
        try {
          const [{ format }, htmlPlugin] = await Promise.all([
            import('prettier/standalone'),
            import('prettier/plugins/html'),
          ]);
          const next = await format(seed, { parser: 'html', plugins: [htmlPlugin.default || htmlPlugin], printWidth: 80, htmlWhitespaceSensitivity: 'ignore' });
          if (!cancelled) setText(next);
        } catch { /* keep the unformatted seed */ }
      }
      setError(null);
    })();
    return () => { cancelled = true; };
  }, [mode, doc, htmlPreviewOverride]);

  // Canvas-selection → code-jump. Whenever the user picks a block on the
  // canvas, scroll the editor to that block's location in the source and
  // place the caret + selection there so it visually highlights.
  // JSON mode: search for the block id literal (the key in the object).
  // HTML mode: try `data-eb-block-id` (none today — we strip on export)
  //   then fall back to the first occurrence of the block's text content.
  useEffect(() => {
    if (!selectedBlockId || selectedBlockId === 'root') return;
    const el = textareaRef.current;
    if (!el || !text) return;
    let index = -1;
    if (mode === 'json') {
      // The block appears as `"block-…": {` — match the opening quote so
      // we land right on the key rather than inside a childrenIds array.
      const needle = `"${selectedBlockId}"`;
      index = text.indexOf(needle);
    } else {
      // HTML export doesn't include block ids today; try the rendered
      // text of the selected block (Heading/Text only — anything short
      // enough to be unique). For other types we give up gracefully.
      const block = doc?.[selectedBlockId];
      const t = block?.data?.props?.text;
      if (typeof t === 'string' && t.length > 4) {
        // Strip inline HTML tags to match against the formatted body.
        const plain = t.replace(/<[^>]+>/g, '').trim().slice(0, 80);
        if (plain) index = text.indexOf(plain);
      }
    }
    if (index < 0) return;
    // Place the caret at the match, then scroll the editor viewport so
    // the caret line ends up roughly centred. The textarea itself has
    // overflow:hidden — the OverlayVerticalScroll wrapper (parent
    // `.overlayScrollInner`) owns the scrollbar, so we scroll that.
    el.focus({ preventScroll: true });
    el.setSelectionRange(index, index);
    const lineHeight = 18; // matches .codeTextarea line-height: 1.55 × 11.5
    const lineNo = text.slice(0, index).split('\n').length - 1;
    const viewport = el.closest?.('[class*="overlayScrollInner"]') || el.parentElement;
    if (viewport) {
      const targetTop = Math.max(0, lineNo * lineHeight - viewport.clientHeight / 2);
      viewport.scrollTop = targetTop;
    }
    // Highlight by setting a full-token selection on JSON, or the search
    // phrase on HTML, so the user sees where they landed.
    if (mode === 'json') {
      el.setSelectionRange(index, index + selectedBlockId.length + 2);
    } else {
      const block = doc?.[selectedBlockId];
      const t = block?.data?.props?.text;
      const plain = typeof t === 'string' ? t.replace(/<[^>]+>/g, '').trim().slice(0, 80) : '';
      el.setSelectionRange(index, index + plain.length);
    }
    // Drafting flag stays false so future doc changes still re-format.
    drafting.current = false;
  }, [selectedBlockId, mode, text, doc]);

  const handleChange = (e) => {
    const v = e.target.value;
    setText(v);
    drafting.current = true;
    if (mode === 'json') {
      try {
        let sanitized = v.replace(/[\x00-\x1F\x7F]/g, (ch) => {
          if (ch === '\n' || ch === '\r' || ch === '\t') return ch;
          return '';
        });
        sanitized = sanitized.replace(/"(?:[^"\\]|\\.)*"/g, (match) =>
          match.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
        );
        let parsed = JSON.parse(sanitized);
        if (parsed && parsed.type === 'page' && Array.isArray(parsed.children)) {
          parsed = convertMjmlToFold(parsed);
        }
        if (!parsed || typeof parsed !== 'object' || !parsed.root) {
          setError('Document must contain a "root" block');
          return;
        }
        setError(null);
        setEmailDocument(parsed);
      } catch (err) {
        setError(err.message);
      }
    } else {
      // HTML edits are pushed to a preview override; they don't round-trip to JSON.
      setHtmlPreviewOverride(v);
      setError(null);
    }
  };

  // When user blurs, we let future doc updates re-sync the text again.
  const handleBlur = () => { drafting.current = false; };

  const copy = () => { if (text) navigator.clipboard?.writeText(text); };

  const reformat = async () => {
    drafting.current = false;
    if (mode === 'json') {
      try {
        const parsed = JSON.parse(text);
        setText(JSON.stringify(parsed, null, 2));
        setError(null);
      } catch (e) { setError(e.message); }
    } else {
      try {
        const [{ format }, htmlPlugin] = await Promise.all([
          import('prettier/standalone'),
          import('prettier/plugins/html'),
        ]);
        const next = await format(text, { parser: 'html', plugins: [htmlPlugin.default || htmlPlugin], printWidth: 80, htmlWhitespaceSensitivity: 'ignore' });
        setText(next);
      } catch (e) { setError(e.message); }
    }
  };

  const highlighted = mode === 'json' ? highlightJson(text) : highlightHtml(text);

  return (
    <div className={styles.codeScroll}>
      <div className={styles.codeToolbar}>
        <Toggle
          items={[{ key: 'json', label: 'JSON' }, { key: 'html', label: 'HTML' }]}
          active={mode}
          size="S"
          onChange={(k) => { setMode(k); drafting.current = false; }}
        />
        <div className={styles.codeToolbarRight}>
          <button className={styles.codeCopyBtn} onClick={reformat} aria-label="Format">
            <Icon name="solar:magic-stick-3-linear" size={14} color="currentColor" />
            Format
          </button>
          <button className={styles.codeCopyBtn} onClick={copy} aria-label="Copy">
            <Icon name="solar:copy-linear" size={14} color="currentColor" />
            Copy
          </button>
        </div>
      </div>

      {mode === 'html' && htmlPreviewOverride && (
        <div className={styles.codeBanner}>
          <Icon name="solar:info-circle-linear" size={12} color="currentColor" />
          <span style={{ flex: 1 }}>Previewing edited HTML — confirm to import as editable blocks.</span>
          <button
            type="button"
            className={styles.codeBannerBtn}
            onClick={async () => {
              const html = htmlPreviewOverride;
              const parsed = await parseHtmlToDocument(html);
              if (parsed?.doc) {
                // Render through the normal block pipeline — drag/drop,
                // toolbar, reordering, and component-panel insertion all
                // keep working. Style fidelity comes from the parser's
                // computed-style extraction, not from re-using the raw HTML.
                const next = stripCustomHtml(parsed.doc);
                const unknownFonts = collectUnknownFonts(next);
                if (unknownFonts.length > 0) {
                  // Stash the pending doc; the dialog applies font
                  // substitutions and commits via setEmailDocument.
                  useAppStore.getState().openFontSubstitutionDialog(next, unknownFonts);
                } else {
                  setEmailDocument(next);
                }
              } else {
                // Parsing produced nothing usable — keep the HTML as a raw
                // custom body so the user still gets WYSIWYG editing.
                setEmailDocument({
                  ...doc,
                  root: {
                    ...doc.root,
                    data: { ...(doc.root?.data || {}), customHtml: html },
                  },
                });
              }
            }}
            title="Import HTML as editable blocks"
          >
            <Icon name="solar:check-circle-linear" size={13} color="currentColor" />
            Confirm
          </button>
        </div>
      )}
      {mode === 'html' && !htmlPreviewOverride && doc?.root?.data?.customHtml && (
        <div className={styles.codeBanner}>
          <Icon name="solar:check-circle-linear" size={12} color="currentColor" />
          <span style={{ flex: 1 }}>Custom HTML body is active.</span>
          <button
            type="button"
            className={styles.codeBannerBtn}
            onClick={async () => {
              const html = doc.root.data.customHtml;
              const parsed = await parseHtmlToDocument(html);
              if (parsed?.doc) {
                const next = stripCustomHtml(parsed.doc);
                const unknownFonts = collectUnknownFonts(next);
                if (unknownFonts.length > 0) {
                  useAppStore.getState().openFontSubstitutionDialog(next, unknownFonts);
                } else {
                  setEmailDocument(next);
                }
              } else {
                setError('Could not parse the HTML into editable blocks. Try simplifying the markup or remove the custom HTML to start over.');
              }
            }}
            title="Convert the HTML into editable blocks"
            style={{ marginRight: 4 }}
          >
            <Icon name="solar:layers-linear" size={13} color="currentColor" />
            Convert to blocks
          </button>
          <button
            type="button"
            className={styles.codeBannerBtn}
            onClick={() => setEmailDocument(stripCustomHtml(doc))}
            title="Remove custom HTML and revert to block-based body"
          >
            <Icon name="solar:trash-bin-minimalistic-linear" size={13} color="currentColor" />
            Remove
          </button>
        </div>
      )}

      {error && (
        <div className={styles.codeError}>
          <Icon name="solar:danger-triangle-linear" size={12} color="currentColor" />
          {error}
        </div>
      )}

      {/* Editor viewport scrolls both axes. The native vertical scrollbar
          is hidden by the OverlayVerticalScroll wrapper, which renders a
          custom translucent thumb on the right edge so it floats above
          the content. The native horizontal scrollbar (slim, translucent)
          stays visible at the bottom of the viewport. */}
      <OverlayVerticalScroll className={styles.codeEditorScroll}>
        <div className={styles.codeEditor}>
          <pre className={styles.codePre} aria-hidden="true">
            <code className={styles.codeBlock} dangerouslySetInnerHTML={{ __html: highlighted + '\n' }} />
          </pre>
          <textarea
            ref={textareaRef}
            className={styles.codeTextarea}
            value={text}
            onChange={handleChange}
            onBlur={handleBlur}
            spellCheck={false}
            autoComplete="off"
            aria-label={`Edit ${mode.toUpperCase()}`}
          />
        </div>
      </OverlayVerticalScroll>
    </div>
  );
}

// ── Syntax highlighters (regex-based, distinct token colors) ────────────────
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function highlightJson(input) {
  // Walk char-by-char to avoid mistaking strings for keys/values.
  // Simpler: regex over escaped output.
  const safe = escapeHtml(input);
  return safe.replace(
    /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false)\b|\b(null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (m, str, colon, bool, nul, num) => {
      if (str !== undefined) {
        if (colon) return `<span class="${styles.tokKey}">${str}</span>${colon}`;
        return `<span class="${styles.tokString}">${str}</span>`;
      }
      if (bool !== undefined) return `<span class="${styles.tokBoolean}">${bool}</span>`;
      if (nul !== undefined) return `<span class="${styles.tokNull}">${nul}</span>`;
      if (num !== undefined) return `<span class="${styles.tokNumber}">${num}</span>`;
      return m;
    }
  );
}

function highlightHtml(input) {
  const safe = escapeHtml(input);
  // Highlight tags: &lt;tagname …&gt;  and attributes attr="value"
  return safe.replace(/(&lt;\/?)([A-Za-z][\w-]*)((?:\s+[A-Za-z_:][\w:.-]*(?:=(?:&quot;[^&]*&quot;|&#39;[^&]*&#39;|[^\s&]+))?)*)(\s*\/?&gt;)/g,
    (_m, lt, tag, attrs, gt) => {
      const attrPart = attrs.replace(/(\s+)([A-Za-z_:][\w:.-]*)(=)(&quot;[^&]*&quot;|&#39;[^&]*&#39;)/g,
        (_a, ws, name, eq, val) =>
          `${ws}<span class="${styles.tokAttr}">${name}</span>${eq}<span class="${styles.tokString}">${val}</span>`
      );
      return `<span class="${styles.tokPunct}">${lt}</span><span class="${styles.tokTag}">${tag}</span>${attrPart}<span class="${styles.tokPunct}">${gt}</span>`;
    }
  );
}

// ── Template tab ────────────────────────────────────────────────────────────
const TEMPLATE_PRESETS = [
  { id: 'welcome',  label: 'Welcome',          accent: '#7C5CFA' },
  { id: 'reminder', label: 'Care Reminder',    accent: '#22C55E' },
  { id: 'followup', label: 'Visit Follow-up',  accent: '#F59E0B' },
  { id: 'survey',   label: 'Patient Survey',   accent: '#EC4899' },
];

function TemplateTab({ block }) {
  const editingCampaignName = useAppStore(s => s.editingCampaignName);
  const replaceHeaderFooter = useAppStore(s => s.replaceHeaderFooter);
  const customHeaderPresets = useAppStore(s => s.customHeaderPresets);
  const customFooterPresets = useAppStore(s => s.customFooterPresets);
  const saveCurrentAsPreset = useAppStore(s => s.saveCurrentAsPreset);
  const deleteCustomPreset = useAppStore(s => s.deleteCustomPreset);
  const updateCustomPreset = useAppStore(s => s.updateCustomPreset);
  const applyCustomPreset = useAppStore(s => s.applyCustomPreset);
  const setDocument = useAppStore.setState;
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveDesc, setSaveDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [presetQuery, setPresetQuery] = useState('');
  const [renamingId, setRenamingId] = useState(null);
  const [renameName, setRenameName] = useState('');
  const [renameDesc, setRenameDesc] = useState('');

  const role = block?.data?.role;
  const isHeaderOrFooter = role === 'header' || role === 'footer';

  const applyPreset = (preset) => {
    const fresh = makeInitialDocument({ name: editingCampaignName || preset.label });
    fresh.root.data.backdropColor = preset.accent + '22';
    fresh['header-text'].data.style.color = preset.accent;
    setDocument({ emailDocument: fresh, selectedBlockId: 'root' });
  };

  const applyRolePreset = (preset) => {
    if (preset.isUserPreset) {
      applyCustomPreset(role, preset);
      return;
    }
    let counter = Date.now();
    const genId = () => `block-${counter++}-${Math.random().toString(36).slice(2, 5)}`;
    const tree = preset.build(genId, editingCampaignName || undefined);
    replaceHeaderFooter(role, tree);
  };

  const handleSave = async () => {
    setSaving(true);
    const result = await saveCurrentAsPreset(role, { name: saveName, description: saveDesc });
    setSaving(false);
    if (result) {
      setSaveOpen(false);
      setSaveName('');
      setSaveDesc('');
    }
  };

  if (isHeaderOrFooter) {
    const builtIn = role === 'header' ? HEADER_PRESETS : FOOTER_PRESETS;
    const userPresets = role === 'header' ? customHeaderPresets : customFooterPresets;
    const label = role === 'header' ? 'Header' : 'Footer';

    // Detect whether the currently-selected header/footer matches an existing
    // built-in or user preset byte-for-byte. If it does, hiding the Save
    // button avoids creating duplicate library entries. Read `doc` via the
    // *prop* (`block`) so this recomputes whenever the doc mutates — using
    // useAppStore.getState() here would skip re-runs since it doesn't sub.
    let currentFingerprint = '';
    if (block?.data?.role === role) {
      const doc = useAppStore.getState().emailDocument;
      const rootChildren = doc?.root?.data?.childrenIds || [];
      const rootId = rootChildren.find(id => doc[id]?.data?.role === role);
      if (rootId) currentFingerprint = fingerprintTree(extractSubtree(doc, rootId));
    }
    const knownFingerprints = new Set();
    builtIn.forEach(p => {
      let n = 0;
      const tree = p.build(() => `fp-${p.id}-${++n}`, editingCampaignName || 'Welcome');
      knownFingerprints.add(fingerprintTree(tree));
    });
    userPresets.forEach(p => {
      if (p.tree) knownFingerprints.add(fingerprintTree(p.tree));
    });
    const canSavePreset = !!currentFingerprint && !knownFingerprints.has(currentFingerprint);

    const matches = (p) => {
      if (!presetQuery.trim()) return true;
      const q = presetQuery.trim().toLowerCase();
      return (p.label || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q);
    };
    const filteredUser = userPresets.filter(matches);
    const filteredBuiltIn = builtIn.filter(matches);

    const startRename = (p) => {
      setRenamingId(p.id);
      setRenameName(p.label || '');
      setRenameDesc(p.description || '');
    };
    const commitRename = (p) => {
      updateCustomPreset(p.id, role, { name: renameName, description: renameDesc });
      setRenamingId(null);
    };

    return (
      <div className={styles.templateScroll}>
        <SectionHeading>{`Change ${label}`}</SectionHeading>

        {/* Save current as preset — only when the current header/footer
            differs from every known preset. Avoids creating duplicates. */}
        {canSavePreset && (
        <div className={styles.presetSaveBar}>
          {!saveOpen ? (
            <button
              type="button"
              className={styles.presetSaveBtn}
              onClick={() => { setSaveOpen(true); setSaveName(''); setSaveDesc(''); }}
            >
              <Icon name="solar:bookmark-linear" size={14} color="currentColor" />
              Save current {label.toLowerCase()} as preset
            </button>
          ) : (
            <div className={styles.presetSaveForm}>
              <input
                autoFocus
                className={styles.presetSaveInput}
                placeholder={`${label} name (e.g. Brand banner)`}
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setSaveOpen(false); }}
                maxLength={60}
              />
              <input
                className={styles.presetSaveInput}
                placeholder="Short description (optional)"
                value={saveDesc}
                onChange={e => setSaveDesc(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setSaveOpen(false); }}
                maxLength={120}
              />
              <div className={styles.presetSaveActions}>
                <button type="button" className={styles.presetSaveCancel} onClick={() => setSaveOpen(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.presetSavePrimary}
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          )}
        </div>
        )}

        {/* Search across both saved + built-in presets, using the shared
            <Input> so the field matches the rest of the app. */}
        <div className={styles.presetSearchBar}>
          <Input
            placeholder={`Search ${label.toLowerCase()}s…`}
            value={presetQuery}
            onChange={(e) => setPresetQuery(e.target.value)}
          />
        </div>

        <div className={styles.presetCardList}>
          {filteredUser.length > 0 && (
            <>
              <SectionSubHeading>Your presets</SectionSubHeading>
              {filteredUser.map(p => (
                <TemplatePresetCard
                  key={`u-${p.id}`}
                  preset={p}
                  isRenaming={renamingId === p.id}
                  draftName={renameName}
                  draftDesc={renameDesc}
                  onDraftName={setRenameName}
                  onDraftDesc={setRenameDesc}
                  onCommitRename={() => commitRename(p)}
                  onCancelRename={() => setRenamingId(null)}
                  onApply={() => applyRolePreset(p)}
                  onEdit={() => startRename(p)}
                  onDelete={() => { if (window.confirm(`Delete preset "${p.label}"?`)) deleteCustomPreset(p.id, role); }}
                />
              ))}
            </>
          )}
          {filteredBuiltIn.length > 0 && (
            <>
              {filteredUser.length > 0 && <SectionSubHeading>Built-in</SectionSubHeading>}
              {filteredBuiltIn.map(p => (
                <TemplatePresetCard key={p.id} preset={p} onApply={() => applyRolePreset(p)} />
              ))}
            </>
          )}
          {filteredUser.length === 0 && filteredBuiltIn.length === 0 && (
            <div className={styles.presetPickerEmpty}>No {label.toLowerCase()}s match "{presetQuery}"</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.templateScroll}>
      <SectionHeading>Templates</SectionHeading>
      <div className={styles.templateGrid}>
        {TEMPLATE_PRESETS.map(p => (
          <button key={p.id} className={styles.templateTile} onClick={() => applyPreset(p)}>
            <div className={styles.templateThumb} style={{ background: p.accent + '22', borderColor: p.accent + '44' }}>
              <div className={styles.templateThumbBar} style={{ background: p.accent }} />
            </div>
            <div className={styles.templateLabel}>{p.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Section primitives ──────────────────────────────────────────────────────
// ── Column width ratio bar ──────────────────────────────────────────────────
const RATIO_PRESETS_2 = [
  { label: '1 : 1', widths: [50, 50] },
  { label: '1 : 2', widths: [33.33, 66.67] },
  { label: '2 : 1', widths: [66.67, 33.33] },
  { label: '1 : 3', widths: [25, 75] },
  { label: '3 : 1', widths: [75, 25] },
];
const RATIO_PRESETS_3 = [
  { label: '1 : 1 : 1', widths: [33.33, 33.33, 33.34] },
  { label: '1 : 1 : 2', widths: [25, 25, 50] },
  { label: '2 : 1 : 1', widths: [50, 25, 25] },
  { label: '1 : 2 : 1', widths: [25, 50, 25] },
];
const RATIO_PRESETS_4 = [
  { label: 'Equal', widths: [25, 25, 25, 25] },
  { label: '2:1:1:1', widths: [40, 20, 20, 20] },
];

function ratioPresetsForCount(n) {
  if (n === 2) return RATIO_PRESETS_2;
  if (n === 3) return RATIO_PRESETS_3;
  if (n === 4) return RATIO_PRESETS_4;
  return [{ label: 'Equal', widths: Array.from({ length: n }, () => Math.round(10000 / n) / 100) }];
}

const COL_COLORS = ['var(--neutral-300, #6F7A90)', 'var(--neutral-100, #E9ECF1)'];

function ColumnWidthBar({ count, widths, onChange }) {
  const barRef = useRef(null);
  const dragging = useRef(null);

  const safeWidths = widths && widths.length >= count
    ? widths.slice(0, count)
    : Array.from({ length: count }, () => Math.round(10000 / count) / 100);

  const handleMouseDown = useCallback((e, handleIdx) => {
    e.preventDefault();
    const bar = barRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    dragging.current = { handleIdx, barLeft: rect.left, barWidth: rect.width, startWidths: [...safeWidths] };

    const onMove = (me) => {
      const d = dragging.current;
      if (!d) return;
      const x = me.clientX - d.barLeft;
      const pct = (x / d.barWidth) * 100;
      const leftSum = d.startWidths.slice(0, d.handleIdx).reduce((a, b) => a + b, 0);
      const pairTotal = d.startWidths[d.handleIdx] + d.startWidths[d.handleIdx + 1];
      const minPct = 10;
      const leftPct = Math.max(minPct, Math.min(pairTotal - minPct, pct - leftSum));
      const rightPct = pairTotal - leftPct;
      const next = [...d.startWidths];
      next[d.handleIdx] = Math.round(leftPct * 100) / 100;
      next[d.handleIdx + 1] = Math.round(rightPct * 100) / 100;
      onChange(next);
    };
    const onUp = () => {
      dragging.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [safeWidths, onChange]);

  const presets = ratioPresetsForCount(count);

  return (
    <div className={styles.colWidthWrap}>
      <div ref={barRef} className={styles.colWidthBar}>
        {safeWidths.map((w, i) => (
          <Fragment key={i}>
            <div
              className={styles.colWidthSeg}
              style={{ width: `${w}%`, backgroundColor: COL_COLORS[i % COL_COLORS.length] }}
            >
              <span className={styles.colWidthLabel} style={{ color: i % 2 === 0 ? '#fff' : 'var(--neutral-400, #6F7A90)' }}>{Math.round(w)}%</span>
            </div>
            {i < count - 1 && (
              <div
                className={styles.colWidthHandle}
                onMouseDown={e => handleMouseDown(e, i)}
              />
            )}
          </Fragment>
        ))}
      </div>
      <div className={styles.colWidthPresets}>
        {presets.map(p => (
          <button
            key={p.label}
            className={styles.colWidthPresetBtn}
            onClick={() => onChange(p.widths)}
            title={p.label}
          >
            <span className={styles.colWidthPresetGlyph}>
              {p.widths.map((w, i) => (
                <span key={i} style={{ flex: w, backgroundColor: COL_COLORS[i % COL_COLORS.length] }} />
              ))}
            </span>
            <span className={styles.colWidthPresetLabel}>{p.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SectionHeading({ children }) {
  return <div className={styles.sectionHeadingStrip}>{children}</div>;
}

function SectionSubHeading({ children }) {
  return <div className={styles.sectionSubHeading}>{children}</div>;
}

// Header/footer preset card — live preview + meta. User presets show edit /
// delete actions on hover; built-in presets are apply-only. Shares the same
// CSS classes as the ComponentsPanel PresetCard so the picker and the right-
// panel list stay visually identical.
function TemplatePresetCard({
  preset,
  isRenaming = false,
  draftName,
  draftDesc,
  onDraftName,
  onDraftDesc,
  onCommitRename,
  onCancelRename,
  onApply,
  onEdit,
  onDelete,
}) {
  const isUser = !!preset.isUserPreset;
  return (
    <div className={styles.presetCardWrap}>
      <button
        type="button"
        className={styles.presetCard}
        onClick={isRenaming ? undefined : onApply}
        disabled={isRenaming}
      >
        <PresetLivePreview preset={preset} />
        {!isRenaming && (
          <div className={styles.presetCardMeta}>
            <div className={styles.presetCardTitle}>{preset.label}</div>
            {preset.description && (
              <div className={styles.presetCardDesc}>{preset.description}</div>
            )}
          </div>
        )}
      </button>
      {isRenaming && (
        <div className={styles.presetCardEditForm}>
          <input
            autoFocus
            className={styles.presetCardEditInput}
            placeholder="Name"
            value={draftName}
            onChange={(e) => onDraftName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onCommitRename(); if (e.key === 'Escape') onCancelRename(); }}
            maxLength={60}
          />
          <input
            className={styles.presetCardEditInput}
            placeholder="Description (optional)"
            value={draftDesc}
            onChange={(e) => onDraftDesc(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onCommitRename(); if (e.key === 'Escape') onCancelRename(); }}
            maxLength={120}
          />
          <div className={styles.presetCardEditActions}>
            <button type="button" className={styles.presetCardEditCancel} onClick={onCancelRename}>Cancel</button>
            <button type="button" className={styles.presetCardEditSave} onClick={onCommitRename}>Save</button>
          </div>
        </div>
      )}
      {isUser && !isRenaming && (
        <div className={styles.presetCardActions}>
          <button
            type="button"
            className={styles.presetCardActionBtn}
            title="Rename"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
          >
            <Icon name="solar:pen-2-linear" size={12} color="currentColor" />
          </button>
          <button
            type="button"
            className={[styles.presetCardActionBtn, styles.presetCardActionDanger].join(' ')}
            title="Delete"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            <Icon name="solar:trash-bin-minimalistic-linear" size={12} color="currentColor" />
          </button>
        </div>
      )}
    </div>
  );
}

function Section({ children }) {
  return <div className={styles.sectionContent}>{children}</div>;
}

function Row2({ children }) {
  return <div className={styles.row2}>{children}</div>;
}

function FieldLabel({ children }) {
  return <p className={styles.fieldLabelStrong}>{children}</p>;
}

// ── Image uploader ──────────────────────────────────────────────────────────
function ImageUploader({ currentUrl, onChange, compact }) {
  const inputRef = useRef(null);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const acceptFile = async (file) => {
    if (!file) return;
    const isImage = file.type.startsWith('image/') || file.name.endsWith('.svg');
    if (!isImage) { setError('File must be an image or SVG'); return; }
    setError(null);
    setUploading(true);
    try {
      const url = await uploadImage(file);
      onChange(url);
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={styles.fieldCol}>
      <div
        className={[styles.imgUploader, dragOver ? styles.imgUploaderOver : '', compact ? styles.imgUploaderCompact : ''].join(' ')}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault();
          setDragOver(false);
          acceptFile(e.dataTransfer.files?.[0]);
        }}
        onClick={() => !uploading && inputRef.current?.click()}
      >
        {uploading ? (
          <div className={styles.imgUploaderEmpty}>
            <Icon name="solar:upload-linear" size={20} color="var(--primary-300)" />
            <span style={{ fontSize: 11, color: 'var(--neutral-300)', marginTop: 4 }}>Uploading…</span>
          </div>
        ) : currentUrl ? (
          <img src={currentUrl} alt="" className={styles.imgUploaderPreview} />
        ) : (
          <div className={styles.imgUploaderEmpty}>
            <Icon name="solar:gallery-add-linear" size={20} color="var(--neutral-300)" />
          </div>
        )}
        {!uploading && (
          <div className={styles.imgUploaderHint}>
            <Icon name="solar:upload-linear" size={12} color="currentColor" />
            {currentUrl ? 'Replace' : 'Click or drop'}
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.svg"
          style={{ display: 'none' }}
          onChange={e => acceptFile(e.target.files?.[0])}
        />
      </div>
      {currentUrl && compact && (
        <button
          type="button"
          className={styles.bgImageRemoveBtn}
          onClick={e => { e.stopPropagation(); onChange(null); }}
        >
          <Icon name="solar:trash-bin-minimalistic-linear" size={12} color="currentColor" /> Remove
        </button>
      )}
      {error && <div className={styles.imgUploaderError}>{error}</div>}
    </div>
  );
}

// ── Color Variables (global) ────────────────────────────────────────────────
function ColorVarSwatch({ value, name, onChange }) {
  const recentlyUsed = useAppStore(s => s.recentlyUsedColors);
  const pushRecent = useAppStore(s => s.pushRecentColor);
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const popoverRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const update = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (!r) return;
      const popoverWidth = 264;
      const margin = 8;
      let left = r.left;
      left = Math.max(margin, Math.min(left, window.innerWidth - popoverWidth - margin));
      const popoverMaxH = Math.min(window.innerHeight - 16, 720);
      const spaceBelow = window.innerHeight - r.bottom - margin;
      const spaceAbove = r.top - margin;
      let top = (spaceBelow >= 200 || spaceBelow >= spaceAbove) ? r.bottom + 4 : Math.max(margin, r.top - 4 - popoverMaxH);
      top = Math.max(margin, Math.min(top, window.innerHeight - margin - 40));
      setPos({ top, left });
    };
    update();
    const raf = requestAnimationFrame(update);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    const ro = new ResizeObserver(update);
    ro.observe(btnRef.current);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); ro.disconnect(); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (btnRef.current?.contains(e.target)) return;
      if (popoverRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={styles.colorDotBtn}
        onClick={() => setOpen(o => !o)}
        aria-label={`Color for ${name}`}
        style={{ flexShrink: 0 }}
      >
        <span
          className={styles.colorDot}
          style={{
            background: value,
            borderColor: typeof value === 'string' && value.toLowerCase() === '#ffffff' ? '#CED4DD' : value,
          }}
        />
      </button>
      {open && createPortal(
        <div ref={popoverRef} className={styles.colorPickerPortal} style={{ top: pos.top, left: pos.left }}>
          <ColorPicker
            value={value}
            onChange={onChange}
            variables={[]}
            recentlyUsed={recentlyUsed}
            onCommitRecent={pushRecent}
            allowGradient={false}
            onClose={() => setOpen(false)}
          />
        </div>,
        document.body,
      )}
    </>
  );
}

function ColorVariablesEditor() {
  const variables = useAppStore(s => s.colorVariables);
  const addColorVariable = useAppStore(s => s.addColorVariable);
  const updateColorVariable = useAppStore(s => s.updateColorVariable);
  const removeColorVariable = useAppStore(s => s.removeColorVariable);

  const handleAdd = () => {
    let n = 1;
    let name = `Color ${n}`;
    while (variables.some(v => v.name === name)) { n++; name = `Color ${n}`; }
    addColorVariable({ name, hex: '#7C5CFA' });
  };

  return (
    <div className={styles.colorVarList}>
      {variables.map((cv, idx) => (
        <div key={idx} className={styles.colorVarRow}>
          <ColorVarSwatch
            value={cv.hex}
            name={cv.name}
            onChange={hex => updateColorVariable(cv.name, { hex })}
          />
          <input
            type="text"
            value={cv.name}
            onChange={e => updateColorVariable(cv.name, { name: e.target.value })}
            className={styles.colorVarNameInput}
          />
          <input
            type="text"
            value={cv.hex.toUpperCase()}
            onChange={e => updateColorVariable(cv.name, { hex: e.target.value })}
            className={styles.colorVarHexInput}
          />
          <button
            type="button"
            className={styles.colorVarRemove}
            onClick={() => removeColorVariable(cv.name)}
            aria-label="Remove"
          >
            <Icon name="solar:close-circle-linear" size={14} color="currentColor" />
          </button>
        </div>
      ))}
      <button type="button" className={styles.colorVarAdd} onClick={handleAdd}>
        <Icon name="solar:add-circle-linear" size={14} color="currentColor" />
        Add variable
      </button>
    </div>
  );
}

// Line height with px/% unit toggle. Storage stays backward-compatible:
// number = unitless multiplier (legacy %), string like "18px" = explicit px.
function LineHeightInput({ value, onChange }) {
  const lh = parseLineHeight(value);
  return (
    <IconInput
      label="Line Height"
      unit={lh.unit}
      onUnitChange={u => onChange(formatLineHeight(lh.value, u))}
      value={lh.value}
      onChange={v => onChange(formatLineHeight(v, lh.unit))}
    />
  );
}

function LetterSpacingInput({ value, onChange }) {
  const ls = parseLetterSpacing(value);
  return (
    <IconInput
      label="Letter Spacing"
      unit={ls.unit}
      onUnitChange={u => onChange(formatLetterSpacing(ls.value, u))}
      value={ls.value}
      onChange={v => onChange(formatLetterSpacing(v, ls.unit))}
    />
  );
}

// ── Field primitives ────────────────────────────────────────────────────────
function IconInput({ label, suffix, icon, value, onChange, freeform, unit, onUnitChange }) {
  const [localValue, setLocalValue] = useState(null);
  const editing = localValue !== null;
  const displayed = editing ? localValue : (value ?? '');

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const current = parseFloat(displayed) || 0;
      const next = String(e.key === 'ArrowUp' ? current + step : current - step);
      setLocalValue(null);
      onChange(next);
    }
  };
  const handleChange = (e) => {
    const raw = freeform ? e.target.value : e.target.value.replace(/[^0-9.-]/g, '');
    setLocalValue(raw);
    onChange(raw);
  };
  const handleBlur = () => setLocalValue(null);

  return (
    <div className={styles.fieldCol}>
      {label && <label className={styles.fieldLabel}>{label}</label>}
      <div className={styles.iconInputWrap}>
        {icon && <span className={styles.iconInputIcon}>{icon}</span>}
        <input
          className={styles.iconInputValue}
          type="text"
          value={displayed}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
        />
        {unit && onUnitChange ? (
          <button
            type="button"
            className={styles.unitToggleBtn}
            onClick={() => onUnitChange(unit === 'px' ? '%' : 'px')}
            title={`Switch to ${unit === 'px' ? '%' : 'px'}`}
          >
            {unit}
          </button>
        ) : (suffix && <span className={styles.iconInputSuffix}>{suffix}</span>)}
      </div>
    </div>
  );
}

// Thin wrappers around the shared Input/Select primitives so the rest of
// PropertiesPanel keeps its label-above-control field-col layout but stops
// reimplementing the chrome. Single source of truth for visual style now
// lives in src/components/{Input,Select}.
function PlainInput({ label, value, onChange }) {
  return (
    <div className={styles.fieldCol}>
      {label && <label className={styles.fieldLabel}>{label}</label>}
      <Input
        type="text"
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

function SelectInput({ label, value, options, onChange }) {
  return (
    <div className={styles.fieldCol}>
      {label && <label className={styles.fieldLabel}>{label}</label>}
      <SharedSelect
        options={options}
        value={value ?? ''}
        onChange={onChange}
      />
    </div>
  );
}

function ColorInput({ label, value, onChange, allowGradient = true }) {
  const colorVariables = useAppStore(s => s.colorVariables);
  const recentlyUsedColors = useAppStore(s => s.recentlyUsedColors);
  const pushRecentColor = useAppStore(s => s.pushRecentColor);
  const [open, setOpen] = useState(false);
  const fieldRef = useRef(null);
  const popoverRef = useRef(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
  const v = value || '#FFFFFF';
  const isGrad = isGradient(v);
  const displayText = isGrad ? 'Gradient' : (typeof v === 'string' ? v.toUpperCase() : '');

  // Position the portalled popover so it stays fully on-screen, flush
  // with the right edge of the field. We re-run the calculation on:
  //   • initial open (+ next rAF, after the right-panel scroll settles)
  //   • window resize / scroll bubbling
  //   • the field's own size or position changing (ResizeObserver)
  // and clamp both axes so the popover never drifts off-screen.
  useLayoutEffect(() => {
    if (!open || !fieldRef.current) return;
    const update = () => {
      const r = fieldRef.current?.getBoundingClientRect();
      if (!r) return;
      const popoverWidth = 264;
      // The popover has internal scroll so we can constrain its height
      // tightly against the viewport without losing content.
      const popoverMaxH = Math.min(window.innerHeight - 16, 720);
      const margin = 8;
      // Horizontal: prefer flush-right with the field; if that clips at
      // the left edge, slide it back in. Final clamp keeps it on-screen.
      let left = r.right - popoverWidth;
      if (left < margin) left = Math.min(r.left, window.innerWidth - popoverWidth - margin);
      left = Math.max(margin, Math.min(left, window.innerWidth - popoverWidth - margin));
      // Vertical: prefer below; flip above when there's more room there.
      const spaceBelow = window.innerHeight - r.bottom - margin;
      const spaceAbove = r.top - margin;
      let top;
      if (spaceBelow >= 200 || spaceBelow >= spaceAbove) {
        top = r.bottom + 4;
      } else {
        top = Math.max(margin, r.top - 4 - popoverMaxH);
      }
      // Final clamp so we always sit inside the viewport.
      top = Math.max(margin, Math.min(top, window.innerHeight - margin - 40));
      setPopoverPos({ top, left });
    };
    // Run now, then once more after the next paint so any pending layout
    // (right-panel scroll, route transitions, font loading) is settled.
    update();
    const raf = requestAnimationFrame(update);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    // Watch the field itself so any size/position drift (panel resize,
    // section expand/collapse) keeps the popover anchored.
    const ro = new ResizeObserver(update);
    ro.observe(fieldRef.current);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      ro.disconnect();
    };
  }, [open]);

  // Dismiss on outside click. Both the field button and the portalled
  // popover count as "inside" so clicking either keeps the picker open.
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (fieldRef.current?.contains(e.target)) return;
      if (popoverRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className={styles.fieldCol} ref={fieldRef}>
      {label && <label className={styles.fieldLabel}>{label}</label>}
      <div className={styles.colorInputWrap}>
        <button
          type="button"
          className={styles.colorDotBtn}
          onClick={() => setOpen(o => !o)}
          aria-label="Open color picker"
        >
          <span
            className={styles.colorDot}
            style={{
              background: v,
              borderColor: !isGrad && typeof v === 'string' && v.toLowerCase() === '#ffffff' ? '#CED4DD' : (isGrad ? 'transparent' : v),
            }}
          />
        </button>
        <input
          type="text"
          className={styles.colorHex}
          value={displayText}
          onChange={e => { if (!isGrad) onChange(e.target.value); }}
          readOnly={isGrad}
        />
      </div>
      {open && createPortal(
        <div
          ref={popoverRef}
          className={styles.colorPickerPortal}
          style={{ top: popoverPos.top, left: popoverPos.left }}
        >
          <ColorPicker
            value={v}
            onChange={onChange}
            variables={colorVariables}
            recentlyUsed={recentlyUsedColors}
            onCommitRecent={pushRecentColor}
            allowGradient={allowGradient}
            onClose={() => setOpen(false)}
          />
        </div>,
        document.body,
      )}
    </div>
  );
}

function TableEditor({ columns, rows, onChangeColumns, onChangeRows }) {
  const updateHeader = (idx, header) => {
    const next = columns.map((c, i) => i === idx ? { ...c, header } : c);
    onChangeColumns(next);
  };
  const updateCell = (ri, key, value) => {
    const next = rows.map((r, i) => i === ri ? { ...r, [key]: value } : r);
    onChangeRows(next);
  };
  const addColumn = () => {
    const key = `col${columns.length + 1}`;
    onChangeColumns([...columns, { key, header: `Column ${columns.length + 1}` }]);
    onChangeRows(rows.map(r => ({ ...r, [key]: '' })));
  };
  const removeColumn = (idx) => {
    if (columns.length <= 1) return;
    const removed = columns[idx];
    onChangeColumns(columns.filter((_, i) => i !== idx));
    onChangeRows(rows.map(r => { const n = { ...r }; delete n[removed.key]; return n; }));
  };
  const addRow = () => {
    const empty = {};
    columns.forEach(c => { empty[c.key] = ''; });
    onChangeRows([...rows, empty]);
  };
  const removeRow = (idx) => {
    if (rows.length <= 1) return;
    onChangeRows(rows.filter((_, i) => i !== idx));
  };

  return (
    <div className={styles.tableEditor}>
      <div className={styles.tableEditorGrid} style={{ gridTemplateColumns: `repeat(${columns.length}, 1fr) 24px` }}>
        {columns.map((col, ci) => (
          <div key={ci} className={styles.tableEditorHeaderCell}>
            <input
              className={styles.tableEditorInput}
              value={col.header}
              onChange={e => updateHeader(ci, e.target.value)}
              style={{ fontWeight: 600 }}
            />
            {columns.length > 1 && (
              <button className={styles.tableEditorRemoveBtn} onClick={() => removeColumn(ci)} title="Remove column">
                <Icon name="solar:close-circle-linear" size={10} color="var(--neutral-300)" />
              </button>
            )}
          </div>
        ))}
        <div />
        {rows.map((row, ri) => (
          <Fragment key={ri}>
            {columns.map((col, ci) => (
              <div key={ci} className={styles.tableEditorCell}>
                <input
                  className={styles.tableEditorInput}
                  value={row[col.key] || ''}
                  onChange={e => updateCell(ri, col.key, e.target.value)}
                />
              </div>
            ))}
            <button className={styles.tableEditorRemoveRowBtn} onClick={() => removeRow(ri)} title="Remove row">
              <Icon name="solar:close-circle-linear" size={12} color="var(--neutral-300)" />
            </button>
          </Fragment>
        ))}
      </div>
      <div className={styles.tableEditorActions}>
        <button className={styles.tableEditorAddBtn} onClick={addRow}>+ Row</button>
        <button className={styles.tableEditorAddBtn} onClick={addColumn}>+ Column</button>
      </div>
    </div>
  );
}

// ── Social / NavBar editors ────────────────────────────────────────────────
const SOCIAL_PRESETS = [
  { id: 'twitter',   label: 'Twitter',   iconUrl: 'https://cdn.simpleicons.org/x/000000' },
  { id: 'linkedin',  label: 'LinkedIn',  iconUrl: 'https://cdn.simpleicons.org/linkedin/0A66C2' },
  { id: 'instagram', label: 'Instagram', iconUrl: 'https://cdn.simpleicons.org/instagram/E4405F' },
  { id: 'facebook',  label: 'Facebook',  iconUrl: 'https://cdn.simpleicons.org/facebook/1877F2' },
  { id: 'youtube',   label: 'YouTube',   iconUrl: 'https://cdn.simpleicons.org/youtube/FF0000' },
  { id: 'tiktok',    label: 'TikTok',    iconUrl: 'https://cdn.simpleicons.org/tiktok/000000' },
  { id: 'github',    label: 'GitHub',    iconUrl: 'https://cdn.simpleicons.org/github/181717' },
];

function SocialIconUpload({ currentUrl, onUpload }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const showToast = useAppStore(s => s.showToast);

  const accept = async (file) => {
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    const isSvg = file.type === 'image/svg+xml' || file.name.endsWith('.svg');
    if (!isImage && !isSvg) {
      showToast('Icon must be an image or SVG');
      return;
    }
    setUploading(true);
    try {
      const url = await uploadImage(file);
      onUpload(url);
    } catch (err) {
      showToast(err?.message || 'Icon upload failed');
    }
    setUploading(false);
  };

  return (
    <>
      <button
        type="button"
        className={styles.socialIconBtn}
        onClick={() => inputRef.current?.click()}
        title="Change icon"
      >
        {uploading
          ? <Icon name="solar:upload-linear" size={14} color="var(--primary-300)" />
          : currentUrl
            ? <img src={currentUrl} alt="" width={16} height={16} style={{ borderRadius: 2, display: 'block' }} />
            : <Icon name="solar:upload-linear" size={14} color="var(--neutral-300)" />}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.svg"
        style={{ display: 'none' }}
        onChange={e => accept(e.target.files?.[0])}
      />
    </>
  );
}

function SocialEditor({ platforms, onChange }) {
  const updatePlatform = (idx, key, value) => {
    const next = platforms.map((p, i) => i === idx ? { ...p, [key]: value } : p);
    onChange(next);
  };
  const removePlatform = (idx) => onChange(platforms.filter((_, i) => i !== idx));
  const addPlatform = (preset) => {
    if (platforms.some(p => p.id === preset.id)) return;
    onChange([...platforms, { ...preset, url: `https://${preset.id}.com` }]);
  };
  const addCustom = () => {
    const id = `custom-${Date.now()}`;
    onChange([...platforms, { id, label: 'Custom', url: '#', iconUrl: '' }]);
  };

  return (
    <div className={styles.tableEditor}>
      {platforms.map((p, i) => (
        <div key={i} className={styles.socialRow}>
          <SocialIconUpload
            currentUrl={p.iconUrl}
            onUpload={url => updatePlatform(i, 'iconUrl', url)}
          />
          <input
            className={styles.tableEditorInput}
            value={p.label}
            onChange={e => updatePlatform(i, 'label', e.target.value)}
            style={{ fontWeight: 500, flex: '0 0 70px' }}
          />
          <input
            className={styles.tableEditorInput}
            value={p.url || ''}
            onChange={e => updatePlatform(i, 'url', e.target.value)}
            placeholder="URL"
            style={{ flex: 1 }}
          />
          <button className={styles.tableEditorRemoveRowBtn} onClick={() => removePlatform(i)} title="Remove">
            <Icon name="solar:close-circle-linear" size={12} color="var(--neutral-300)" />
          </button>
        </div>
      ))}
      <div className={styles.socialPresets}>
        {SOCIAL_PRESETS.filter(sp => !platforms.some(p => p.id === sp.id)).map(sp => (
          <button key={sp.id} className={styles.tableEditorAddBtn} onClick={() => addPlatform(sp)}>
            + {sp.label}
          </button>
        ))}
        <button className={styles.tableEditorAddBtn} onClick={addCustom}>
          + Custom
        </button>
      </div>
    </div>
  );
}

function NavLinkEditor({ links, onChange }) {
  const updateLink = (idx, key, value) => {
    const next = links.map((l, i) => i === idx ? { ...l, [key]: value } : l);
    onChange(next);
  };
  const removeLink = (idx) => onChange(links.filter((_, i) => i !== idx));
  const addLink = () => onChange([...links, { label: 'Link', url: '#' }]);

  return (
    <div className={styles.tableEditor}>
      {links.map((link, i) => (
        <div key={i} className={styles.socialRow}>
          <input
            className={styles.tableEditorInput}
            value={link.label}
            onChange={e => updateLink(i, 'label', e.target.value)}
            placeholder="Label"
            style={{ fontWeight: 500, flex: '0 0 80px' }}
          />
          <input
            className={styles.tableEditorInput}
            value={link.url || ''}
            onChange={e => updateLink(i, 'url', e.target.value)}
            placeholder="URL"
            style={{ flex: 1 }}
          />
          <button className={styles.tableEditorRemoveRowBtn} onClick={() => removeLink(i)} title="Remove">
            <Icon name="solar:close-circle-linear" size={12} color="var(--neutral-300)" />
          </button>
        </div>
      ))}
      <button className={styles.tableEditorAddBtn} onClick={addLink}>+ Add link</button>
    </div>
  );
}

// Quick-style chips at the top of the Content section. Tapping one applies a
// preset of typography settings (fontSize + fontWeight, and for Headings the
// `level` too). The matching chip highlights if the current style is already
// at that preset.
const TEXT_STYLE_PRESETS = [
  { key: 'title',    label: 'Title',    fontSize: 24, fontWeight: 'bold',   level: 'h1' },
  { key: 'subtitle', label: 'Subtitle', fontSize: 18, fontWeight: 'bold',   level: 'h2' },
  { key: 'heading',  label: 'Heading',  fontSize: 16, fontWeight: 'bold',   level: 'h3' },
  { key: 'body',     label: 'Body',     fontSize: 14, fontWeight: 'normal', level: null },
];

// Strip inline HTML for plain-text display in the right-panel Text
// textarea. The DOM parses the markup and `innerText` gives us the
// visible characters with `<br>` honoured as newlines. Empty / non-string
// inputs short-circuit so we don't hit jsdom in tests.
function htmlToPlain(html) {
  if (typeof html !== 'string') return '';
  if (typeof document === 'undefined' || !/[<&]/.test(html)) return html;
  const div = document.createElement('div');
  div.innerHTML = html.replace(/<br\s*\/?>/gi, '\n');
  return (div.textContent || div.innerText || '').replace(/ /g, ' ');
}

function TextStyleChips({ block, updateBlock, id }) {
  const style = block.data?.style || {};
  const props = block.data?.props || {};
  const apply = (preset) => {
    updateBlock(id, prev => {
      const next = JSON.parse(JSON.stringify(prev));
      next.data = next.data || {};
      next.data.style = next.data.style || {};
      next.data.style.fontSize = preset.fontSize;
      next.data.style.fontWeight = preset.fontWeight;
      next.data.props = next.data.props || {};
      if (next.type === 'Heading' && preset.level) next.data.props.level = preset.level;
      return next;
    });
  };
  // Which chip matches the current element? Text blocks → Body; Headings map
  // to the chip whose `level` matches the block's `level`. Falls back to
  // Heading for unknown levels so something is always selected.
  const active = (() => {
    if (block.type !== 'Heading') return 'body';
    const lvl = (props.level || 'h2').toLowerCase();
    const byLevel = TEXT_STYLE_PRESETS.find(p => p.level === lvl);
    return byLevel ? byLevel.key : 'heading';
  })();
  return (
    <Toggle
      fullWidth
      size="S"
      items={TEXT_STYLE_PRESETS.map(p => ({ key: p.key, label: p.label }))}
      active={active || ''}
      onChange={(key) => {
        const preset = TEXT_STYLE_PRESETS.find(p => p.key === key);
        if (preset) apply(preset);
      }}
    />
  );
}

// Link input — inline collapsible row. Shows a "+ Add link" affordance when
// no link is set, expands to an Input that captures the href and a checkbox
// to toggle target="_blank" (defaults to true to match prior behaviour).
function LinkInput({ value, openInNewTab = true, onChange, onChangeOpenInNewTab }) {
  const [open, setOpen] = useState(!!value);
  return (
    <div className={styles.fieldCol}>
      <div className={styles.linkHeader}>
        <label className={styles.fieldLabel}>Link</label>
        <button
          type="button"
          className={styles.linkToggle}
          onClick={() => {
            if (open && value) { onChange(''); }
            setOpen(o => !o);
          }}
          aria-label={open ? 'Remove link' : 'Add link'}
        >
          <Icon name={open ? 'solar:minus-circle-linear' : 'solar:add-circle-linear'} size={14} color="currentColor" />
        </button>
      </div>
      {open && (
        <>
          <Input
            type="url"
            placeholder="https://example.com"
            value={value}
            onChange={e => onChange(e.target.value)}
          />
          {onChangeOpenInNewTab && (
            <label className={styles.linkNewTab}>
              <input
                type="checkbox"
                checked={openInNewTab}
                onChange={(e) => onChangeOpenInNewTab(e.target.checked)}
              />
              <span>Open in New Tab</span>
            </label>
          )}
        </>
      )}
    </div>
  );
}

// Padding control — three modes:
//  • uniform:   one value for all four sides (1 input)
//  • symmetric: top/bottom + left/right (2 inputs)
//  • per-side:  four independent values (4 inputs)
// The mode auto-detects from current values so something else editing
// padding can't strand the UI in the wrong mode.
function PaddingControl({ padding, onChangeSide, onChangeAll }) {
  const allEqual = padding.top === padding.right
                && padding.right === padding.bottom
                && padding.bottom === padding.left;
  const symmetric = !allEqual
                 && padding.top === padding.bottom
                 && padding.left === padding.right;
  const detected = allEqual ? 'uniform' : (symmetric ? 'symmetric' : 'per-side');
  const [mode, setMode] = useState(detected);
  // Keep mode in sync with the values when they're changed elsewhere.
  useEffect(() => { setMode(detected); }, [detected]);

  const setSymmetric = (vertical, horizontal) => {
    onChangeSide('top', vertical);
    onChangeSide('bottom', vertical);
    onChangeSide('left', horizontal);
    onChangeSide('right', horizontal);
  };

  return (
    <>
      <div className={styles.paddingLabelRow}>
        <label className={styles.fieldLabelStrong}>Padding</label>
        <Toggle
          size="S"
          items={[
            { key: 'uniform',   label: '', icon: <PadUniformIcon /> },
            { key: 'symmetric', label: '', icon: <PadSymmetricIcon /> },
            { key: 'per-side',  label: '', icon: <PadPerSideIcon /> },
          ]}
          active={mode}
          onChange={(v) => {
            setMode(v);
            if (v === 'uniform') onChangeAll(padding.top);
            else if (v === 'symmetric') setSymmetric(padding.top, padding.left);
          }}
        />
      </div>
      {mode === 'uniform' && (
        <IconInput
          suffix="px" icon={<PadAllSidesIcon />}
          value={padding.top}
          onChange={v => onChangeAll(parseFloat(v) || 0)}
        />
      )}
      {mode === 'symmetric' && (
        <Row2>
          <IconInput
            label="Vertical" suffix="px" icon={<PadVerticalIcon />}
            value={padding.top}
            onChange={v => {
              const n = parseFloat(v) || 0;
              onChangeSide('top', n);
              onChangeSide('bottom', n);
            }}
          />
          <IconInput
            label="Horizontal" suffix="px" icon={<PadHorizontalIcon />}
            value={padding.left}
            onChange={v => {
              const n = parseFloat(v) || 0;
              onChangeSide('left', n);
              onChangeSide('right', n);
            }}
          />
        </Row2>
      )}
      {mode === 'per-side' && (
        <>
          <Row2>
            <IconInput
              suffix="px" icon={<PadLeftIcon />}
              value={padding.left}
              onChange={v => onChangeSide('left', parseFloat(v) || 0)}
            />
            <IconInput
              suffix="px" icon={<PadTopIcon />}
              value={padding.top}
              onChange={v => onChangeSide('top', parseFloat(v) || 0)}
            />
          </Row2>
          <Row2>
            <IconInput
              suffix="px" icon={<PadRightIcon />}
              value={padding.right}
              onChange={v => onChangeSide('right', parseFloat(v) || 0)}
            />
            <IconInput
              suffix="px" icon={<PadBottomIcon />}
              value={padding.bottom}
              onChange={v => onChangeSide('bottom', parseFloat(v) || 0)}
            />
          </Row2>
        </>
      )}
    </>
  );
}

// Border control — uses the same +/− toggle pattern as LinkInput so the
// builder UI is consistent. Collapsed when no border values are set;
// expanding applies sensible defaults.
function BorderControl({ style, onUpdate }) {
  // Two storage shapes:
  //   uniform → style.borderWidth/Color/Style (existing)
  //   per-side → style.borderSides = { top, right, bottom, left } where
  //     each side is null (no border) or { width, color, style }
  const hasUniform = !!(style.borderWidth || style.borderColor || style.borderStyle);
  const hasPerSide = !!(style.borderSides && Object.values(style.borderSides).some(Boolean));
  const hasBorder = hasUniform || hasPerSide;
  const [open, setOpen] = useState(hasBorder);
  const [mode, setMode] = useState(hasPerSide ? 'per-side' : 'uniform');

  const removeBorder = () => {
    onUpdate('borderWidth', null);
    onUpdate('borderStyle', null);
    onUpdate('borderColor', null);
    onUpdate('borderSides', null);
    setOpen(false);
  };
  const addBorder = () => {
    onUpdate('borderWidth', style.borderWidth || 1);
    onUpdate('borderStyle', style.borderStyle || 'solid');
    onUpdate('borderColor', style.borderColor || '#E1E4EA');
    setOpen(true);
  };

  // Seed per-side from current uniform when the user switches modes so
  // they don't lose the values they already configured.
  const seedSide = () => ({ width: style.borderWidth || 1, color: style.borderColor || '#E1E4EA', style: style.borderStyle || 'solid' });
  const switchMode = (next) => {
    if (next === mode) return;
    if (next === 'per-side') {
      const seed = style.borderSides || { top: seedSide(), right: seedSide(), bottom: seedSide(), left: seedSide() };
      onUpdate('borderSides', seed);
    } else {
      onUpdate('borderSides', null);
    }
    setMode(next);
  };

  const sides = style.borderSides || {};
  const toggleSide = (side) => {
    const next = { ...sides };
    next[side] = next[side] ? null : seedSide();
    onUpdate('borderSides', next);
  };
  const updateSide = (side, key, value) => {
    const next = { ...sides, [side]: { ...(sides[side] || seedSide()), [key]: value } };
    onUpdate('borderSides', next);
  };

  return (
    <div className={styles.fieldCol}>
      <div className={styles.linkHeader}>
        <label className={styles.fieldLabel}>Border</label>
        <button
          type="button"
          className={styles.linkToggle}
          onClick={() => open ? removeBorder() : addBorder()}
          aria-label={open ? 'Remove border' : 'Add border'}
        >
          <Icon name={open ? 'solar:minus-circle-linear' : 'solar:add-circle-linear'} size={14} color="currentColor" />
        </button>
      </div>
      {open && (
        <>
          <div className={styles.fieldCol}>
            <Toggle
              fullWidth
              size="S"
              items={[
                { key: 'uniform',  label: 'All sides' },
                { key: 'per-side', label: 'Per side' },
              ]}
              active={mode}
              onChange={switchMode}
            />
          </div>
          {mode === 'uniform' ? (
            <>
              <Row2>
                <IconInput
                  label="Width" suffix="px"
                  value={style.borderWidth ?? 1}
                  onChange={v => onUpdate('borderWidth', parseFloat(v) || 0)}
                />
                <ColorInput
                  label="Color"
                  value={style.borderColor || '#E1E4EA'}
                  onChange={v => onUpdate('borderColor', v)}
                />
              </Row2>
              <div className={styles.fieldCol}>
                <label className={styles.fieldLabel}>Style</label>
                <Toggle
                  fullWidth
                  size="S"
                  items={[
                    { key: 'solid',  label: 'Solid' },
                    { key: 'dashed', label: 'Dashed' },
                    { key: 'dotted', label: 'Dotted' },
                  ]}
                  active={style.borderStyle || 'solid'}
                  onChange={v => onUpdate('borderStyle', v)}
                />
              </div>
            </>
          ) : (
            <>
              {/* Side enable toggles — clicking a side enables/disables its
                  border. Compact icon set top/right/bottom/left. */}
              <div className={styles.fieldCol}>
                <label className={styles.fieldLabel}>Sides</label>
                <div className={styles.bsideRow}>
                  {[
                    { key: 'top', label: 'T' },
                    { key: 'right', label: 'R' },
                    { key: 'bottom', label: 'B' },
                    { key: 'left', label: 'L' },
                  ].map(s => (
                    <button
                      key={s.key}
                      type="button"
                      className={[styles.bsideBtn, sides[s.key] ? styles.bsideBtnOn : ''].join(' ')}
                      onClick={() => toggleSide(s.key)}
                      title={`Toggle ${s.key}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Render width + color rows for each enabled side. Keeping
                  these stacked avoids cramming 4 cols × 3 fields in a tiny
                  panel; users typically enable 1–2 sides. */}
              {['top', 'right', 'bottom', 'left'].filter(k => sides[k]).map((k) => (
                <Row2 key={k}>
                  <IconInput
                    label={`${k} width`} suffix="px"
                    value={sides[k]?.width ?? 1}
                    onChange={v => updateSide(k, 'width', parseFloat(v) || 0)}
                  />
                  <ColorInput
                    label="Color"
                    value={sides[k]?.color || '#E1E4EA'}
                    onChange={v => updateSide(k, 'color', v)}
                  />
                </Row2>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── Independent decoration toggles — bold/italic/underline/strike can combine ─
// The leading "none" button is a one-click clear that turns every decoration
// off in a single tap (matches the Figma reference).
function DecorationToggles({ bold, italic, underline, strike, code, caps, onChange }) {
  const anyOn = bold || italic || underline || strike || code || caps;
  const items = [
    { key: 'bold',      on: bold,      icon: <DecoBoldIcon />,      label: 'Bold' },
    { key: 'italic',    on: italic,    icon: <DecoItalicIcon />,    label: 'Italic' },
    { key: 'underline', on: underline, icon: <DecoUnderlineIcon />, label: 'Underline' },
    { key: 'strike',    on: strike,    icon: <DecoStrikeIcon />,    label: 'Strikethrough' },
    { key: 'code',      on: code,      icon: <DecoCodeIcon />,      label: 'Code' },
    { key: 'caps',      on: caps,      icon: <DecoCapsIcon />,      label: 'Uppercase' },
  ];
  return (
    <div className={styles.decoToggles}>
      <button
        type="button"
        className={[styles.decoToggleBtn, !anyOn ? styles.decoToggleActive : ''].join(' ')}
        onClick={() => {
          if (bold) onChange('bold', false);
          if (italic) onChange('italic', false);
          if (underline) onChange('underline', false);
          if (strike) onChange('strike', false);
          if (code) onChange('code', false);
          if (caps) onChange('caps', false);
        }}
        title="None"
        aria-label="No decoration"
        aria-pressed={!anyOn}
      >
        <DecoNoneIcon />
      </button>
      {items.map(it => (
        <button
          key={it.key}
          type="button"
          className={[styles.decoToggleBtn, it.on ? styles.decoToggleActive : ''].join(' ')}
          onClick={() => onChange(it.key, !it.on)}
          title={it.label}
          aria-label={it.label}
          aria-pressed={it.on}
        >
          {it.icon}
        </button>
      ))}
    </div>
  );
}

// ── Inline icons (precise to match Figma) ──────────────────────────────────
function svg(d, w = 16, h = 16) {
  return (
    <svg width={w} height={h} viewBox="0 0 16 16" fill="none">
      <path d={d} stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const WidthIcon     = () => svg('M2 4v8 M14 4v8 M4 8h8 M4 8l2-2 M4 8l2 2 M12 8l-2-2 M12 8l-2 2');
const HeightIcon    = () => svg('M4 2h8 M4 14h8 M8 4v8 M8 4l-2 2 M8 4l2 2 M8 12l-2-2 M8 12l2-2');
const RadiusIcon    = () => svg('M4 12V7a5 5 0 0 1 5-5h5');
const PadLeftIcon   = () => svg('M3 2v12 M7 5h7 M7 8h7 M7 11h7');
const PadTopIcon    = () => svg('M2 3h12 M5 7v7 M8 7v7 M11 7v7');
const PadRightIcon  = () => svg('M13 2v12 M2 5h7 M2 8h7 M2 11h7');
const PadBottomIcon = () => svg('M2 13h12 M5 2v7 M8 2v7 M11 2v7');
// Uniform / Symmetric (vertical bars) / Per-side mode icons. Symmetric is a
// square with two vertical guides hinting at independent top/bottom only.
const PadUniformIcon   = () => svg('M3 3h10v10H3z');
const PadSymmetricIcon = () => svg('M3 3h10v10H3z M3 8h10');
const PadPerSideIcon   = () => svg('M3 3h10v10H3z M3 8h10 M8 3v10');

// PadAllSidesIcon — used as the input-field icon when padding is in
// uniform mode. Two concentric squares clearly read as "padding on all
// sides" and avoid clashing with RadiusIcon (rounded-corner glyph).
const PadAllSidesIcon = () => svg('M2 2h12v12H2z M5 5h6v6H5z');

// Symmetric input icons — vertical & horizontal axes.
const PadVerticalIcon   = () => svg('M8 3v10 M5 4l3-1 3 1 M5 12l3 1 3-1');
const PadHorizontalIcon = () => svg('M3 8h10 M4 5l-1 3 1 3 M12 5l1 3-1 3');

const DirectionRowIcon = () => svg('M2 8h10 M9 5l3 3-3 3');
const DirectionColIcon = () => svg('M8 2v10 M5 9l3 3 3-3');

const AlignLeftIcon    = () => svg('M2 4h12 M2 8h8 M2 12h12');
const AlignCenterIcon  = () => svg('M2 4h12 M4 8h8 M2 12h12');
const AlignRightIcon   = () => svg('M2 4h12 M6 8h8 M2 12h12');
const AlignJustifyIcon = () => svg('M2 4h12 M2 8h12 M2 12h12');
// Vertical-align icons for the fixed-height container Position toggle.
// Top: heavy bar at the top, two shorter rows below. Middle: shorter
// rows above and below a heavy bar. Bottom: heavy bar at the bottom.
const AlignTopIcon     = () => svg('M2 3h12 M4 7h8 M4 11h8');
const AlignMiddleIcon  = () => svg('M4 4h8 M2 8h12 M4 12h8');
const AlignBottomIcon  = () => svg('M4 5h8 M4 9h8 M2 13h12');

const DecoNoneIcon  = () => svg('M3 8h10');
const DecoBoldIcon = () => (
  <svg width={14} height={14} viewBox="0 0 14 14" fill="none">
    <text x="3" y="11" fontSize="11" fontWeight="700" fontFamily="Inter" fill="currentColor">B</text>
  </svg>
);
const DecoItalicIcon = () => (
  <svg width={14} height={14} viewBox="0 0 14 14" fill="none">
    <text x="4" y="11" fontSize="11" fontStyle="italic" fontFamily="Georgia" fill="currentColor">I</text>
  </svg>
);
const DecoUnderlineIcon = () => (
  <svg width={14} height={14} viewBox="0 0 14 14" fill="none">
    <text x="3" y="10" fontSize="11" fontFamily="Inter" fill="currentColor">U</text>
    <line x1="3" y1="12" x2="11" y2="12" stroke="currentColor" strokeWidth="1" />
  </svg>
);
const DecoStrikeIcon = () => (
  <svg width={14} height={14} viewBox="0 0 14 14" fill="none">
    <text x="4" y="11" fontSize="11" fontFamily="Inter" fill="currentColor">T</text>
    <line x1="2" y1="7" x2="12" y2="7" stroke="currentColor" strokeWidth="1" />
  </svg>
);
const DecoCodeIcon = () => (
  <svg width={14} height={14} viewBox="0 0 14 14" fill="none">
    <path d="M5 4L2 7L5 10 M9 4L12 7L9 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const DecoCapsIcon = () => (
  <svg width={16} height={14} viewBox="0 0 16 14" fill="none">
    <text x="1" y="10" fontSize="9" fontFamily="Inter" fontWeight="500" fill="currentColor">AB</text>
  </svg>
);

// Three icons for the list-style toggle on Text blocks.
const ListNoneIcon = () => (
  <svg width={14} height={14} viewBox="0 0 14 14" fill="none">
    <line x1="3" y1="4" x2="11" y2="4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    <line x1="3" y1="7" x2="11" y2="7" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    <line x1="3" y1="10" x2="11" y2="10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
  </svg>
);
const ListBulletIcon = () => (
  <svg width={14} height={14} viewBox="0 0 14 14" fill="none">
    <circle cx="2.5" cy="4" r="0.9" fill="currentColor" />
    <circle cx="2.5" cy="7" r="0.9" fill="currentColor" />
    <circle cx="2.5" cy="10" r="0.9" fill="currentColor" />
    <line x1="5.5" y1="4" x2="11.5" y2="4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    <line x1="5.5" y1="7" x2="11.5" y2="7" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    <line x1="5.5" y1="10" x2="11.5" y2="10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
  </svg>
);
const ListNumberIcon = () => (
  <svg width={14} height={14} viewBox="0 0 14 14" fill="none">
    <text x="1" y="5" fontSize="3.5" fontFamily="Inter" fontWeight="500" fill="currentColor">1.</text>
    <text x="1" y="8.5" fontSize="3.5" fontFamily="Inter" fontWeight="500" fill="currentColor">2.</text>
    <text x="1" y="12" fontSize="3.5" fontFamily="Inter" fontWeight="500" fill="currentColor">3.</text>
    <line x1="5.5" y1="4" x2="11.5" y2="4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    <line x1="5.5" y1="7" x2="11.5" y2="7" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    <line x1="5.5" y1="10" x2="11.5" y2="10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
  </svg>
);
