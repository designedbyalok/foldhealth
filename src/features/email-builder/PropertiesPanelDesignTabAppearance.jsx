import { useState, useEffect, useRef, useCallback, useLayoutEffect, Fragment } from 'react';
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
import { BorderControl, ColorVariablesEditor, ImageUploader, Row2, Section, SectionHeading, SelectInput } from './PropertiesPanelFields';

const RADIUS_TYPES = new Set(['Button', 'Image', 'Container', 'ColumnsContainer']);
const BG_IMAGE_TYPES = new Set(['Container', 'ColumnsContainer']);
const BUTTON_STYLE_RADIUS = { rectangle: 0, rounded: 6, pill: 9999 };
const FONT_FAMILIES = GOOGLE_FONTS.map(f => ({ value: f.value, label: f.label }));
const FONT_WEIGHTS_FALLBACK = [
  { value: '400', label: 'Regular 400' },
  { value: '700', label: 'Bold 700' },
];

export function DesignTabAppearance({ ctx }) {
  const { block, update, props, style, isLayout, data } = ctx;
  return (
    <>
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
                    const text = res.ok ? await res.text() : '';
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
    </>
  );
}
