import { useState, useEffect, useRef, useCallback, useLayoutEffect, useId, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { renderEmailHtml } from './patchEmailHtml';
import { useAppStore } from '../../store/useAppStore';
import { Icon } from '../../components/Icon/Icon';
import { CloseButton } from '../../components/CloseButton/CloseButton';
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
import { ColorInput } from './ColorInput';
import { parseLineHeight, formatLineHeight, parseLetterSpacing, formatLetterSpacing } from './dimUnits';
import { parseHtmlToDocument, collectUnknownFonts } from './htmlToDocument';
import styles from './EmailBuilder.module.css';

import { getCommonValue } from './PropertiesPanel.utils.jsx';
import { htmlToPlain } from './EmailBuilder.utils';
import { FieldLabel, IconInput, ImageUploader, LinkInput, PlainInput, Row2, Section, SectionHeading, SelectInput, TextStyleChips } from './PropertiesPanelFields';

const RADIUS_TYPES = new Set(['Button', 'Image', 'Container', 'ColumnsContainer']);
const BG_IMAGE_TYPES = new Set(['Container', 'ColumnsContainer']);
const BUTTON_STYLE_RADIUS = { rectangle: 0, rounded: 6, pill: 9999 };
const FONT_FAMILIES = GOOGLE_FONTS.map(f => ({ value: f.value, label: f.label }));
const FONT_WEIGHTS_FALLBACK = [
  { value: '400', label: 'Regular 400' },
  { value: '700', label: 'Bold 700' },
];

export function DesignTabBlocksPrimary({ ctx }) {
  const uid = useId();
  const { block, updateBlock, id, update, props, style, isLayout, padding, rootFontFamily } = ctx;
  return (
    <>
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

      {block.type === 'RawHtml' && (
        <>
          <SectionHeading>HTML</SectionHeading>
          <Section>
            <div className={styles.fieldCol}>
              <label className={styles.fieldLabel} htmlFor={`${uid}-raw-html`}>Markup</label>
              <Textarea
                id={`${uid}-raw-html`}
                value={props.html || ''}
                onChange={e => update(['data', 'props', 'html'], e.target.value)}
                rows={12}
                style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}
              />
            </div>
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
                    const text = res.ok ? await res.text() : '';
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

    </>
  );
}
